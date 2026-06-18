/**
 * Conformance Auto-Fix Playground — backlog #298 (the interactive surface over the #095/#196/#293 engine).
 *
 * The sibling of the Code Upgrader playground, one domain over. Where the upgrader lifts legacy code
 * ONTO the standard, this drives a failing conformance suite back to GREEN — and lets a human watch
 * and gate the loop card by card:
 *
 *   failure (check:standards)  →  proposed patch  →  diff  →  verify gate  →  accept / revert
 *
 * It drives the SAME `autofix` orchestrator the CLI and the unit suite use — only the I/O is swapped:
 * an IN-MEMORY world (mirroring check-standards' deprecated-status / invalid-json / missing-description
 * rules) stands in for the repo, so the verify-gated loop runs end-to-end with no key and no risk to
 * real specs. The two new things this surface adds over the headless engine (#293 shipped both as
 * engine/CLI pieces): the diff is rendered for a human, and the `decide` review hook is wired to live
 * Accept / Revert buttons — so you drive the propose → verify → accept/revert loop by hand.
 *
 * Native APIs only; no bootstrap. AI is a swappable provider: the model cards run a SCRIPTED (no-key)
 * client through the exact `CustomFixerRegistry` seam a BYO-key Anthropic client would use.
 */
import { setPlaygroundReady } from '/demos/playground-harness';
import {
  CustomFixerRegistry, registerReferenceFixers, autofix, lineDiff,
} from '/scripts/autofix/engine.mjs';
import { registerModelFixers, createScriptedClient } from '/scripts/autofix/modelFixer.mjs';

// The engine's Failure shape (its JSDoc @typedef, restated locally so the demo doesn't depend on a
// type export from the .mjs). A failure always carries a message; only descriptor-bearing ones are fixable.
interface Failure {
  message: string;
  descriptor?: { kind: string; entity?: string; id?: string; file?: string; field?: string; from?: string; to?: string };
}

// ── In-memory world: reproduce the check-standards rules the engine fixes ─────────
//
// The CLI wires `verify` to `check:standards --json` and `read`/`write` to node fs; here they run over
// a plain object so the same loop is exercised deterministically. This verifier mirrors three real
// rules: deprecated `status` synonyms (the reference fixer's class), unparseable JSON, and a
// `missing-description` (an entity with no `*-descriptions/*.njk` — the model fixer's class). It also
// models a "no live markup in a description partial" rule, so a draft that injects a <script> is caught
// as a NEW failure and reverted by the gate — the moat, visible.

const STATUS_SYNONYMS: Record<string, string> = {
  implemented: 'active', stable: 'active', done: 'active', planned: 'concept', wip: 'draft',
};

interface DescNeed { entity: string; id: string; file: string; }

interface World {
  fs: Record<string, string>;
  read: (file: string) => string;
  write: (file: string, content: string) => void;
  exists: (file: string) => boolean;
  remove: (file: string) => void;
  verify: () => { ok: boolean; failures: Failure[] };
}

function makeWorld(files: Record<string, string>, descNeeds: DescNeed[] = []): World {
  const fs: Record<string, string> = { ...files };
  const read = (file: string): string => {
    if (!(file in fs)) throw new Error(`ENOENT ${file}`);
    return fs[file];
  };
  const write = (file: string, content: string): void => { fs[file] = content; };
  const exists = (file: string): boolean => file in fs;
  const remove = (file: string): void => { delete fs[file]; };

  const verify = () => {
    const failures: Failure[] = [];
    // JSON registry rules: bad JSON, then deprecated status synonyms.
    for (const [file, content] of Object.entries(fs)) {
      if (!file.endsWith('.json')) continue;
      let data: unknown;
      try { data = JSON.parse(content); }
      catch { failures.push({ message: `Invalid JSON in ${file}`, descriptor: { kind: 'invalid-json', file } }); continue; }
      // Per-block specs are one object per file (#882); the monolith was an array. Accept both.
      const rows = Array.isArray(data) ? data : (data && typeof data === 'object' && 'id' in (data as object) ? [data] : []);
      for (const row of rows) {
        const r = row as { id?: string; status?: string };
        if (r?.status && STATUS_SYNONYMS[r.status]) {
          failures.push({
            message: `Block "${r.id}" uses deprecated status "${r.status}" — use canonical "${STATUS_SYNONYMS[r.status]}"`,
            descriptor: { kind: 'deprecated-status', entity: 'Block', id: r.id, file, field: 'status', from: r.status, to: STATUS_SYNONYMS[r.status] },
          });
        }
      }
    }
    // Description rules: missing file → missing-description; live markup in a draft → a NEW failure.
    for (const need of descNeeds) {
      const body = fs[need.file];
      if (body == null || !body.trim()) {
        failures.push({
          message: `${need.entity} "${need.id}" has no description partial (${need.file})`,
          descriptor: { kind: 'missing-description', entity: need.entity, id: need.id, file: need.file },
        });
      } else if (/<script[\s>]/i.test(body)) {
        failures.push({
          message: `${need.entity} "${need.id}" description has raw <script> — partials must be inert markup`,
          descriptor: { kind: 'forbidden-markup', entity: need.entity, id: need.id, file: need.file },
        });
      }
    }
    return { ok: failures.length === 0, failures };
  };
  return { fs, read, write, exists, remove, verify };
}

// ── Scripted (no-key) model client ───────────────────────────────────────────────
//
// `responder(prompt)` returns a canned completion. The prompt embeds the entity id/name/summary, so we
// switch on the id to return a draft grounded in that entity — exactly the shape a real model returns,
// and run through the SAME `parseDescriptionDraft` validation + verify gate a live model's output is.

const DRAFTS: Record<string, string> = {
  // A clean, grounded description partial — passes validation AND the verify gate.
  'kanban-board':
    `<h3 id="overview">Overview</h3>\n` +
    `<p>The <code>kanban-board</code> block renders a column-based task board with drag-to-reorder cards.</p>\n` +
    `<h3 id="when">When to use</h3>\n` +
    `<ul><li>Triaging work across stages (backlog → in-progress → done).</li>\n` +
    `<li>Any bounded set of items that move between a small number of named columns.</li></ul>\n`,
  // Valid markup, but it injects a live <script> — the gate flags a NEW failure and reverts it (the moat).
  'tag-input':
    `<h3 id="overview">Overview</h3>\n` +
    `<p>The <code>tag-input</code> block collects a set of tokens.</p>\n` +
    `<script>alert('tracking')</script>\n`,
  // A hallucinated, prose-only draft with no markup — rejected by parseDescriptionDraft, never offered.
  'split-pane': `Sure! Here is a description of the split-pane component for you to use on your site.`,
};

function scriptedResponderFor(prompt: string): string {
  const id = (prompt.match(/Id \(custom-element \/ registry key\): (\S+)/) || [])[1] ?? '';
  return DRAFTS[id] ?? `<h3 id="overview">Overview</h3>\n<p>${id}.</p>\n`;
}

// ── DOM helpers (mirrors the upgrader demo's vocabulary) ─────────────────────────

function el(tag: string, className?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function pane(label: string, body: string | HTMLElement, lang?: string): HTMLElement {
  const p = el('div', 'pane');
  p.append(el('div', 'pane-label', label));
  if (typeof body === 'string') {
    const code = el('pre', 'code', body);
    if (lang) code.dataset.lang = lang;
    p.append(code);
  } else {
    p.append(body);
  }
  return p;
}

/** Render a `lineDiff` as a coloured +/− block. */
function diffPane(before: string, after: string, file: string): HTMLElement {
  const p = el('div', 'pane');
  p.append(el('div', 'pane-label', `Proposed patch — ${file}`));
  const pre = el('pre', 'diff');
  for (const { sign, text } of lineDiff(before, after).lines) {
    const cls = sign === '+' ? 'add' : sign === '-' ? 'del' : 'ctx';
    pre.append(el('span', `dl ${cls}`, `${sign}${text}\n`));
  }
  p.append(pre);
  return p;
}

function badge(ok: boolean, text: string): HTMLElement {
  return el('span', `badge ${ok ? 'pass' : 'fail'}`, text);
}

// ── A card: one fixture failure, driven through the real loop with live review ────

interface CardSpec {
  title: string;
  note: string;
  world: World;
  registry: CustomFixerRegistry;
  /** The single failure this card targets (for the failure pane). */
  target: Failure;
  maxModelFixes?: number;
  /** When true, wire the diff to Accept/Revert buttons; else the gate/budget decides the outcome. */
  interactive: boolean;
}

function buildCard(spec: CardSpec): { node: HTMLElement; settle: Promise<boolean> } {
  const section = el('section', 'ex');
  const title = el('h2', 'ex-title');
  title.append(document.createTextNode(spec.title + ' '));
  section.append(title);
  section.append(el('p', 'ex-note', spec.note));

  const grid = el('div', 'ex-grid');
  section.append(grid);
  grid.append(pane('Conformance failure (check:standards)', spec.target.message, 'text'));

  const outcome = el('div', 'pane outcome');
  outcome.append(el('div', 'pane-label', 'Outcome'));
  const outcomeBody = el('div', 'outcome-body', 'running…');
  outcome.append(outcomeBody);

  // The review hook: on a patch that passed the verify gate, render the diff + verify badge, and (if
  // interactive) hand the accept/revert decision to the human via buttons.
  const decide = (proposal: { file: string; before: string; after: string; summary: string }) => {
    grid.append(diffPane(proposal.before, proposal.after, proposal.file));
    const gate = el('div', 'pane');
    gate.append(el('div', 'pane-label', 'Verify gate'));
    gate.append(badge(true, '✓ suite accepts (target cleared, no new failure)'));
    grid.append(gate);

    if (!spec.interactive) return 'accept' as const;
    return new Promise<'accept' | 'revert'>((resolve) => {
      const actions = el('div', 'actions');
      const accept = el('button', 'act act-accept', '✓ Accept patch') as HTMLButtonElement;
      const revert = el('button', 'act act-revert', '✗ Revert') as HTMLButtonElement;
      const choose = (verdict: 'accept' | 'revert') => {
        accept.disabled = revert.disabled = true;
        (verdict === 'accept' ? accept : revert).classList.add('chosen');
        resolve(verdict);
      };
      accept.addEventListener('click', () => choose('accept'));
      revert.addEventListener('click', () => choose('revert'));
      actions.append(accept, revert);
      gate.append(actions);
    });
  };

  const settle = (async (): Promise<boolean> => {
    const result = await autofix({
      verify: spec.world.verify, read: spec.world.read, write: spec.world.write,
      exists: spec.world.exists, remove: spec.world.remove,
      registry: spec.registry, maxModelFixes: spec.maxModelFixes, decide,
    });
    // Classify this card's single target into the bucket the loop put it in.
    let cls = 'fail', text = '';
    if (result.applied.length) { cls = 'pass'; text = `✓ applied — ${result.applied[0].summary}. Suite is green.`; }
    else if (result.reviewed.length) { cls = 'warn'; text = `↩ reverted by reviewer — the suite accepted it, you rejected it on the diff. Failure left open.`; }
    else if (result.deferred.length) { cls = 'warn'; text = `⏸ deferred — model-fix budget (${spec.maxModelFixes}) spent; never attempted (no key burned).`; }
    else if (result.gaveUp.length) { cls = 'fail'; text = `✗ not offered — ${result.gaveUp[0].reason}.`; }
    else { cls = 'pass'; text = '✓ no fix needed.'; }
    outcomeBody.replaceChildren(badge(cls === 'pass', text));
    if (cls === 'warn') outcomeBody.firstElementChild!.className = 'badge warn';
    return result.ok || cls === 'pass';
  })();

  grid.append(outcome);
  return { node: section, settle };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────────

function refWorld(id: string, status: string): { world: World; target: Failure } {
  const world = makeWorld({ [`src/_data/blocks/${id}.json`]: JSON.stringify({ id, status }, null, 2) + '\n' });
  return { world, target: world.verify().failures[0] };
}

function modelWorld(id: string, name: string, summary: string): { world: World; target: Failure } {
  const file = `src/_data/block-descriptions/${id}.njk`;
  const world = makeWorld(
    { [`src/_data/blocks/${id}.json`]: JSON.stringify({ id, name, summary, type: 'block' }, null, 2) + '\n' },
    [{ entity: 'Block', id, file }],
  );
  return { world, target: world.verify().failures[0] };
}

const referenceRegistry = () => registerReferenceFixers(new CustomFixerRegistry());
const modelRegistry = () => registerModelFixers(new CustomFixerRegistry(), createScriptedClient(scriptedResponderFor));

const CARDS: CardSpec[] = [
  (() => { const { world, target } = refWorld('view-tabs', 'implemented');
    return { title: 'Reference fixer — deprecated status', note: 'A mechanical, contract-encoded fix (implemented → active). No model: the canonical value is derived deterministically. You still gate it on the diff.', world, registry: referenceRegistry(), target, interactive: true }; })(),
  (() => { const { world, target } = refWorld('for-each', 'wip');
    return { title: 'Reference fixer — deprecated status (revert me)', note: 'Same class (wip → draft). Click Revert to see the verify-passed patch rolled back and the failure left open — review is yours even when the suite accepts.', world, registry: referenceRegistry(), target, interactive: true }; })(),
  (() => { const { world, target } = modelWorld('kanban-board', 'Kanban Board', 'A column-based task board with drag-to-reorder cards.');
    return { title: 'Model fixer — drafts a missing description', note: 'A content-generation class (no mechanical answer): a scripted, no-key model drafts the description partial, grounded in the block’s own registry row. Passes validation and the verify gate; accept or revert it.', world, registry: modelRegistry(), target, interactive: true }; })(),
  (() => { const { world, target } = modelWorld('tag-input', 'Tag Input', 'Collects a set of tokens.');
    return { title: 'The moat — a draft the suite rejects', note: 'The scripted draft is valid markup but injects a live <script>. The verify gate re-runs, sees a NEW failure, and reverts automatically — a plausible-but-wrong fix is never shipped.', world, registry: modelRegistry(), target, interactive: false }; })(),
  (() => { const { world, target } = modelWorld('split-pane', 'Split Pane', 'A resizable two-pane layout.');
    return { title: 'Validate before trust — hallucinated draft', note: 'The scripted model returns prose with no markup. parseDescriptionDraft rejects it before it ever reaches the gate — the fixer gives up rather than guess, no patch offered.', world, registry: modelRegistry(), target, interactive: false }; })(),
  (() => { const { world, target } = modelWorld('kanban-board', 'Kanban Board', 'A column-based task board with drag-to-reorder cards.');
    return { title: 'Cost bound — model budget spent', note: 'Same fixable failure, but the model-fix budget is 0 (#293). The loop DEFERS it without calling the client — a runaway loop can’t burn a BYO key. Reference fixes stay free.', world, registry: modelRegistry(), target, maxModelFixes: 0, interactive: false }; })(),
];

// ── Mount ───────────────────────────────────────────────────────────────────────

function sectionHeading(title: string, blurb: string): HTMLElement {
  const wrap = el('div', 'section-head');
  wrap.append(el('h2', undefined, title));
  wrap.append(el('p', 'ex-note', blurb));
  return wrap;
}

const host = document.getElementById('examples');
if (host) {
  const built = CARDS.map(buildCard);
  const summary = el('div', 'summary', 'Drive each card: watch the failure → proposed patch → verify gate, then Accept or Revert. The non-interactive cards show the gate auto-reverting bad fixes.');
  host.replaceChildren(
    summary,
    sectionHeading('Reference fixer (deterministic, no key)', 'Failures whose fix the conformance contract already encodes — a canonical value derived mechanically, gated on the diff.'),
    built[0].node, built[1].node,
    sectionHeading('Model fixer (BYO key — scripted here)', 'Failures whose fix is content generation. A scripted no-key client stands in for a real model; the same verify gate and cost bound apply.'),
    built[2].node, built[3].node, built[4].node, built[5].node,
  );
  // The surface is ready as soon as the cards mount — outcomes are user-driven (interactive cards) or
  // settle on their own (gate/budget cards). E2E asserts the card count, not a pass tally.
  setPlaygroundReady(built.length);
  void Promise.allSettled(built.map((b) => b.settle));
}
