/**
 * @file wip-report-queue.mjs
 * @description PURE classification of the `/wip` Attention findings (#3736): which are already queued for a live handler,
 * which are gaps that need a backlog item, and which have waited past a deadline. No fs, clock, env, network or `gh`
 * (the caller passes `now`), and NOTHING here files or writes anything. The report only computes and shows the queue plan;
 * filing an item goes through the `file-item` operation, later, by the orchestrator or a worker.
 *
 * A finding is classified by its (already runner-resolved) remedy, from `wip-report.mjs#resolveRemedy`:
 * - HANDLED: remedy `auto`. A handler exists AND the runner is live, so something acts on it. It leaves Attention and shows
 *   under Work items as `queued`.
 * - NO HANDLER: remedy `no-handler`. Nothing mechanical picks it up, so it needs a backlog item. It is listed in the queue
 *   plan under a stable dedup key ({@link dedupKey}: rule plus target) and the report shows ONE `N gaps queued (<keys>)` line.
 * - SHOWN: any other remedy (`auto (runner down)`, `run: session-reaper`, `start: /conveyor`, ...). A handler exists but
 *   no live runner would run it, so it stays in Attention with its remedy. It is neither queued nor a gap.
 * - OVERDUE: a HANDLED or NO HANDLER finding whose `since` is more than {@link OVERDUE_MS} ago. One line names it. A finding
 *   with no known `since` is never overdue (never a guess).
 */

/** How long a queued finding may stay unresolved before the report names it as overdue. */
export const OVERDUE_MS = 2 * 60 * 60 * 1000;

const slug = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, '-');
/**
 * The stable dedup key of a finding: `<rule>:<target>`, or just `<rule>` for an aggregate finding with no single target
 * (a count of sessions, the runner). It depends on the rule and the target ONLY: a changed count, age or wording gives the
 * same key, so a later run finds the item it filed the first time.
 */
export const dedupKey = (rule, target) => (slug(target) ? `${rule}:${slug(target)}` : String(rule));

/** Short words for what a handler does per rule: the title of a `queued` Work-items row. */
export const HANDLER_WORDS = Object.freeze({
  'ci-failed-no-fixer': 'CI fix', 'conflict-no-fix-in-flight': 'conflict fix', 'changes-requested-no-fixer': 'review fix',
  'review-pending-no-reviewer': 'review', 'stale-tag': 'tag clear', 'session-stalled': 'escalate', 'session-finished-unreaped': 'reap',
});

/** `'handled' | 'no-handler' | 'shown'` for one finding. */
export function classifyFinding(finding) {
  if (finding.remedy === 'auto') return 'handled';
  if (finding.remedy === 'no-handler') return 'no-handler';
  return 'shown';
}

const entry = (a, now, klass) => ({ key: dedupKey(a.rule, a.target), class: klass, rule: a.rule, target: a.target ?? '', ref: a.ref ?? '', item: a.item, what: a.what,
  since: a.since ?? null, ageMs: Number.isFinite(a.since) ? Math.max(0, now - a.since) : null });

/**
 * Classify every Attention finding. Pure and order-stable (the input order is kept within each class).
 * @param {Array<{rule:string,target?:string,ref?:string,item:string,what:string,since:number|null,remedy:string}>} attention
 * @param {{now:number, overdueMs?:number}} opts
 * @returns {{deadlineMs:number, handled:object[], handledRows:object[], plan:object[], shown:object[], overdue:object[]}}
 *   `plan` is the queue plan (one entry per dedup key, the NO HANDLER findings); `handledRows` is one `queued` Work-items row per
 *   target; `shown` is what stays in Attention; `overdue` is one entry per overdue finding.
 */
export function buildQueue(attention, { now, overdueMs = OVERDUE_MS } = {}) {
  const handled = [], plan = [], shown = [], seen = new Set();
  for (const a of attention ?? []) {
    const klass = classifyFinding(a);
    if (klass === 'shown') { shown.push(a); continue; }
    const e = entry(a, now, klass);
    if (klass === 'handled') handled.push(e);
    else if (!seen.has(e.key)) { seen.add(e.key); plan.push(e); }
  }
  const byTarget = new Map();
  for (const h of handled) {
    const id = h.target || h.rule, row = byTarget.get(id) ?? { ref: h.ref || h.item, target: h.target, keys: [], rules: [], since: null };
    row.keys.push(h.key); row.rules.push(h.rule);
    if (h.since != null && (row.since == null || h.since < row.since)) row.since = h.since;
    byTarget.set(id, row);
  }
  const handledRows = [...byTarget.values()].map((r) => ({ ...r, state: 'queued', words: [...new Set(r.rules.map((x) => HANDLER_WORDS[x] ?? x))].join('+') }));
  const overdue = [...handled, ...plan].filter((e) => e.ageMs != null && e.ageMs > overdueMs).sort((a, b) => b.ageMs - a.ageMs || a.key.localeCompare(b.key));
  return { deadlineMs: overdueMs, handled, handledRows, plan, shown, overdue };
}

/** `2 gaps queued (a, b)`; `null` when the plan is empty. */
export const gapsLine = (queue) => (queue.plan.length ? `${queue.plan.length} gap${queue.plan.length === 1 ? '' : 's'} queued (${queue.plan.map((p) => p.key).join(', ')})` : null);

const ageWords = (ms) => (ms >= 86400000 ? `${Math.floor(ms / 86400000)}d ${Math.floor(ms / 3600000) % 24}h` : ms >= 3600000 ? `${Math.floor(ms / 3600000)}h ${Math.floor(ms / 60000) % 60}m` : `${Math.floor(ms / 60000)}m`);
/** `overdue 2h 5m: changes-requested-no-fixer:we#2349`: one line naming an overdue finding by its dedup key. */
export const overdueLine = (e) => `overdue ${ageWords(e.ageMs)}: ${e.key}`;

/** The `--queue-plan` text: what would be filed (nothing is, here), what is handled, and what is overdue. Plain lines. */
export function renderQueuePlan(queue) {
  const out = [];
  if (!queue.plan.length) out.push('Queue plan: nothing to file.');
  else {
    out.push(`Queue plan: ${queue.plan.length} to file (read-only: this report files nothing)`);
    for (const p of queue.plan) out.push(`- ${p.key} — ${p.what}`);
  }
  if (queue.handled.length) out.push(`Already queued for a live handler: ${queue.handled.length} (${queue.handled.map((h) => h.key).join(', ')})`);
  for (const o of queue.overdue) out.push(overdueLine(o));
  return out.join('\n');
}
