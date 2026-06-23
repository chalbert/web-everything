/**
 * check-standards-rules.mjs — pure, individually-testable rule bodies for the validator.
 *
 * `check-standards.mjs` is a top-to-bottom live script (it loads the real registries and
 * `process.exit`s), which makes a new rule's correctness — false-positive safety especially — a
 * manual, un-regressed check. This module factors the highest-value, context-pure rules out of that
 * script so they can be unit-tested with synthetic fixtures (see `scripts/__tests__/`). The script
 * stays the single source of live behavior: it *imports and composes* these, so the test exercises
 * the exact code the production gate runs (backlog #251).
 *
 * Each rule takes already-loaded data + an item and returns `{ errors, warnings }`, where every entry
 * is `{ message, descriptor? }` — identical to what `check-standards.mjs` pushes — so the descriptor
 * feed (#095/#196/#197) and the human output are unchanged.
 */

// Backlog operational axis (not the implementation lifecycle) + agile sizing — see
// docs/agent/backlog-workflow.md. Exported so the script and the tests share one definition.
// `preparing` (#375) — a decision being researched by /prepare: non-open + in-flight (drops from
// selection like `active`) but distinct on the board from a story mid-build.
export const BACKLOG_STATUSES = new Set(['open', 'active', 'preparing', 'parked', 'resolved']);
// Valid `parkedReason` values (#1392) — the machine-readable WHY a non-epic item is parked, mirror of an
// epic's childlessReason. Vocab + pill colours live in backlogMeta.js `parkedReasonMeta`.
// Tightened 2026-06-22 (parked-item sweep): parking is NOT a prioritisation escape. A park must reduce to a
// real structural reason — a `blockedBy` edge, a `humanGate` (human-only action), or being a `kind: decision`
// (decisions live in the decision lane, not parked). The soft `deferred`/`superseded`/`external-infra`
// reasons are retired; the ONLY standalone `parkedReason` left is `platform-gated` (held on a web-platform
// capability shipping in browsers — not a backlog item or a human action).
// #1620 added `maturityGated` — held because building NOW would yield a worse artifact (guess the shape,
// tune against no integration, automate the unproven). It REQUIRES a typed, externally-verifiable
// `maturityTrigger` (see MATURITY_TRIGGER_RE) — the gate errors on a maturityGated item without one, which
// is exactly what keeps it from being a soft `deferred` 2.0 escape.
export const PARKED_REASONS = new Set(['platform-gated', 'maturityGated']);
// A `maturityGated` park's `maturityTrigger` must name a COUNTER or an external artifact's EXISTENCE — never
// a date or bare "later". One of: `externalConsumers>=N` · `realRuns>=N` · `adoptionSignal:<named milestone>`.
export const MATURITY_TRIGGER_RE = /^(externalConsumers>=\d+|realRuns>=\d+|adoptionSignal:\s*\S.+)$/;
// One `kind` axis (#466/#487) — the merged nature+hierarchy field that replaced the former two
// correlated axes (`type ∈ idea|issue|decision` + `workItem ∈ story|epic|task`). `story|epic|task` keep
// the sizing/hierarchy semantics; `decision` keeps Tier-B + fork validation. `size` stays a separate
// orthogonal field; fix-vs-feature, if ever wanted, is an optional `tags: [fix]` (never a field).
export const BACKLOG_KINDS = new Set(['story', 'epic', 'task', 'decision']);
// The repo's single "build kind" rule: every kind except `decision` ships work (story/task build leaves,
// epic is the umbrella). This is the canonical form of proposer.mjs's `isBuildable` and the backlog-health
// audit's G2/G3 exec gate — keeping it here, beside the kind set, means a future kind rename surfaces it.
// Defined as `!== 'decision'` (not a positive list) on purpose: a NEW build kind is auto-covered, and the
// only silent-death vector is `decision` itself being renamed — pinned by the kinds test (#1473).
export const isExecKind = (kind) => kind !== 'decision';
// G3 subject scope (#1498) — the backlog-health "ungoverned-arch" gate fires only when a build graduated
// to a new named STANDARD ENTITY (a governable architectural noun), not a routine file-path / locus-prefixed
// graduation (`we:`/`fui:`/`plateau:scripts/...`) or a `demo:`. The principle: a governance gate's subject is
// governable architecture, not impl — a file landing in an existing subsystem is settled arch and needs no
// fresh decision. The `:` anchor discriminates: entity kinds always carry `<kind>:<name>`; locus paths use a
// repo prefix; free-text graduations have no clean prefix. Pinned by exec-kind.test.mjs so a future
// `graduatedTo` grammar change can't silently re-broaden (back to ~350) or re-kill (to 0) G3.
export const STANDARD_ENTITY_KINDS = new Set(['block', 'intent', 'protocol', 'project', 'plug', 'capability', 'adapter']);
export const isEntityGraduation = (graduatedTo) => {
  if (typeof graduatedTo !== 'string') return false;
  const m = graduatedTo.match(/^([a-z]+):/);
  return !!m && STANDARD_ENTITY_KINDS.has(m[1]);
};
// Repo-LOCUS (backlog-workflow.md → "Repo-locus") — the declarative per-locus gate registry (#498/#500).
// An item's `locus` is its **gate home**: which repo's gate can honestly CLOSE it. A cross-locus `/batch`
// is locus-agnostic — it packs items of any locus and gates **each in its own locus** using this record:
//   `repoPath`     — dir (relative to the WE root) to run the gate in; `.` = this repo.
//   `gateCommand`  — the close-out gate that must be green before resolving an item of this locus.
//   `devServerProbe` — the canonical dev port to DETECT-or-skip for a render check (never spin/kill one).
//   `commitTarget` — the repo the per-item commit lands in (commits are per-repo, never `git add -A` across).
//   `closeoutDiscipline?` — an extra, non-skippable close-out rule beyond the gate (exercise-app only).
// `webeverything` is the default. The inferred values in src/_data/backlog.js `inferLocus`
// (frontierui / plateau-app / exercise-app) must stay a subset of these keys.
export const LOCI = {
  webeverything: { repoPath: '.', gateCommand: 'npm run check:standards', devServerProbe: 3000, commitTarget: 'webeverything' },
  frontierui: { repoPath: '../frontierui', gateCommand: 'npm run check:standards', devServerProbe: 3001, commitTarget: 'frontierui' },
  'plateau-app': { repoPath: '../plateau-app', gateCommand: 'npm test', devServerProbe: 4000, commitTarget: 'plateau-app' },
  'exercise-app': {
    repoPath: '.',
    gateCommand: 'npm run check:standards && npm run check:app-conformance',
    devServerProbe: 3000,
    commitTarget: 'webeverything',
    closeoutDiscipline: 'platform-first build; if you must bypass a standard, tag a GAP — a required, non-skippable close-out step (see /exercise-app)',
  },
};
export const FIB = new Set([1, 2, 3, 5, 8, 13]);
// The digest is each item's lead paragraph (the loader's derived `summary`), surfaced for one-glance
// selection. Presence is a required-field error; length is a soft nudge — a runaway opener defeats the
// "scan, don't read the body" purpose. Accuracy (does it still describe the item?) is a review-time
// concern, not mechanical. See docs/agent/backlog-workflow.md → "The digest".
export const DIGEST_MAX_WORDS = 100;

// ── Failure descriptors (#095 → fed to the auto-fix agent #196) ────────────────
// A required field declared in the spec but absent — the model fixer supplies a value.
export const dMissingField = (entity, id, file, field) =>
  ({ kind: 'missing-required-field', fix: 'model', entity, id, file, field });
// A cross-reference whose value doesn't resolve in its target registry — model judgment (typo vs.
// genuinely-missing entity), so `model`. `refRegistry` names the registry the value should resolve in.
// `global: true` — a cross-registry JOIN: in an isolated `--local` worktree the referent may live in a
// sibling lane or a not-yet-regenerated registry, so this defers to the integrator's per-merge gate (#1159).
export const dUnresolvedRef = (entity, id, file, field, value, refRegistry) =>
  ({ kind: 'unresolved-ref', fix: 'model', entity, id, file, field, value, refRegistry, global: true });

// graduatedTo compact ref shape (#247): a single lowercase kind, a colon, and a kebab/underscore slug
// — no spaces, slashes, or dots, so prose / paths / URLs / the `none` sentinel never match and stay
// free-form (the sanctioned alternative, left untouched).
export const GRADUATED_REF = /^([a-z][a-z]*):([A-Za-z0-9_-]+)$/;

// #614 — graduatedTo canonical form. The field must lead with a resolvable entity reference so the
// audit's G3 lineage walk and entity-graph joins can read it: `none`, a resolving `<kind>:<id>`, a repo
// path, or a bare id resolvable in a registry (which `normalize-graduated.mjs` upgrades to `<kind>:<id>`).
// A trailing annotation after that leading token is tolerated; pure prose where the entity is buried mid-
// sentence (or absent) is NOT canonical — it belongs in the body. Returns true for the object (crossRef)
// form, which is a different legacy shape this rule doesn't police.
const GRAD_REPO_PATH_LEAD = /^[A-Za-z0-9_.@-]+\/[A-Za-z0-9_.@{}-]+/;   // leading token carries a path separator
export function isCanonicalGraduated(value, graduatedKinds) {
  if (typeof value !== 'string') return true;
  const v = value.replace(/\s+#\s.*$/, '').trim();                     // strip a YAML end-of-line comment
  if (v === '' || v === 'none') return true;
  const lead = v.split(/\s+/)[0].replace(/[.,;]+$/, '');
  const typed = /^([a-z]+):([A-Za-z0-9_-]+)$/.exec(lead);
  if (typed) { const reg = graduatedKinds[typed[1]]; return !!reg && reg.ids.has(typed[2]); }
  if (GRAD_REPO_PATH_LEAD.test(lead)) return true;
  return Object.values(graduatedKinds).some((r) => r.ids.has(lead));   // bare id resolvable in some registry
}

/**
 * Build the graduatedTo `kind → { ids, file }` resolution table from the loaded registries. A
 * graduatedTo written in the compact `kind:slug` form is resolved against the matching registry, so a
 * typo'd kind or a stale slug is caught instead of silently silencing the nudge. Adapters live nested
 * under adapters.json `items[]`.
 */
export function buildGraduatedKinds({ blocks = [], intents = [], protocols = [], projects = [], plugs = [], capabilityIds = new Set(), adapters = [], demos = [] }) {
  return {
    block: { ids: new Set(blocks.map((b) => b.id)), file: 'blocks.json' },
    intent: { ids: new Set(intents.map((i) => i.id)), file: 'intents.json' },
    protocol: { ids: new Set(protocols.map((p) => p.id)), file: 'protocols.json' },
    project: { ids: new Set(projects.map((p) => p.id)), file: 'projects.json' },
    plug: { ids: new Set(plugs.map((p) => p.id)), file: 'plugs.json' },
    capability: { ids: capabilityIds instanceof Set ? capabilityIds : new Set(capabilityIds), file: 'capabilities.json' },
    adapter: { ids: new Set(adapters.flatMap((a) => (a.items || []).map((i) => i.id))), file: 'adapters.json' },
    demo: { ids: new Set(demos.map((d) => d.id)), file: 'demos.json' },
  };
}

/**
 * Validate a single backlog item's fields and outward references.
 *
 * Pure: all I/O is injected via `ctx`, so the rule is exercisable with synthetic items.
 * @param item  one backlog entry (frontmatter fields, incl. derived `num`).
 * @param ctx   { projectById: Map, graduatedKinds: object (buildGraduatedKinds output),
 *                knownNums: Set<string> (every item's `num`, for parent resolution),
 *                reportExists: (relPath: string) => boolean (relatedReport file probe) }
 * @returns { errors: Array<{message, descriptor?}>, warnings: Array<{message, descriptor?}> }
 */
export function validateBacklogItem(item, ctx) {
  const { projectById, graduatedKinds, knownNums, reportExists } = ctx;
  const errors = [];
  const warnings = [];
  const err = (m, descriptor) => errors.push({ message: m, descriptor });
  const warn = (m, descriptor) => warnings.push({ message: m, descriptor });

  const backlogFile = item.id ? `backlog/${item.id}.md` : undefined;
  for (const f of ['id', 'title', 'kind', 'status', 'summary', 'dateOpened']) {
    if (item[f] === undefined || item[f] === null || item[f] === '')
      err(`Backlog item "${item.id || '<no id>'}" missing required field "${f}"`,
        dMissingField('Backlog', item.id, backlogFile, f));
  }
  // Digest length nudge — the lead paragraph is surfaced for one-glance selection; keep it scannable.
  if (typeof item.summary === 'string') {
    const words = item.summary.split(/\s+/).filter(Boolean).length;
    if (words > DIGEST_MAX_WORDS)
      warn(`Backlog item "${item.id}" digest (lead paragraph) is ${words} words — keep it under ${DIGEST_MAX_WORDS} for one-glance selection`);
  }
  if (item.kind && !BACKLOG_KINDS.has(item.kind))
    err(`Backlog item "${item.id}" has invalid kind "${item.kind}" (expected ${[...BACKLOG_KINDS].join(' / ')})`);
  if (item.status && !BACKLOG_STATUSES.has(item.status))
    err(`Backlog item "${item.id}" has invalid status "${item.status}" (expected ${[...BACKLOG_STATUSES].join(' / ')})`);
  // Parked items must carry a machine-readable reason (#1392) — parking is a deliberate hold and the WHY
  // must be first-class + surfaced as a pill, never buried in prose. A reason is derivable from a real
  // `blockedBy` edge (pills "blocked by #N"), a `humanGate`, a `parkedReason`, or — for an epic — a
  // `childlessReason`. None of those → hard error.
  if (item.status === 'parked') {
    if (item.parkedReason && !PARKED_REASONS.has(item.parkedReason))
      err(`Backlog item "${item.id}" has invalid parkedReason "${item.parkedReason}" (expected ${[...PARKED_REASONS].join(' / ')})`);
    // A `maturityGated` park MUST carry a typed, externally-verifiable `maturityTrigger` (#1620) — the
    // guard that keeps it from being a soft `deferred` 2.0 escape. Missing/untyped/date-only → hard error.
    if (item.parkedReason === 'maturityGated' &&
        (typeof item.maturityTrigger !== 'string' || !MATURITY_TRIGGER_RE.test(item.maturityTrigger.trim())))
      err(`Backlog item "${item.id}" is \`parkedReason: maturityGated\` but lacks a typed \`maturityTrigger\` ` +
        `— it must name a counter or an external artifact's existence: \`externalConsumers>=N\` · ` +
        `\`realRuns>=N\` · \`adoptionSignal:<named milestone>\` (never a date or bare "later"). That typed ` +
        `trigger is what makes maturityGated a real hold, not a soft "deferred" escape (#1620).`);
    const hasEdge = Array.isArray(item.blockedBy) && item.blockedBy.length > 0;
    if (!hasEdge && !item.humanGate && !item.parkedReason && !item.childlessReason)
      err(`Backlog item "${item.id}" is \`status: parked\` but carries no machine-readable reason — parking is ` +
        `NOT a prioritisation escape. Reduce it to a real structural state: a \`blockedBy\` edge (file the ` +
        `prereq as its own card if missing), a \`humanGate\` (human-only action), \`kind: decision\` + ` +
        `\`status: open\` (let the decision lane rank it), or \`parkedReason: platform-gated\` (held on a ` +
        `browser-platform capability). Soft "deferred" holds are retired (#1392, tightened 2026-06-22). ` +
        `See docs/agent/backlog-workflow.md → Parking.`);
  }
  // Repo-locus: an AUTHORED `locus:` must be a known registry key (a typo'd locus → the batch runs the
  // wrong/nonexistent gate at close-out → hard error). An item whose tags INFERRED a cross-repo locus but
  // never declared it gets a nudge (warning) to make the gate home explicit — so which repo's gate closes
  // it rests on an author choice, not a tag heuristic. (Loader-derived item.locus/locusAuthored; absent on raw fixtures.)
  if (item.locusAuthored && !Object.hasOwn(LOCI, item.locus))
    err(`Backlog item "${item.id}" has invalid locus "${item.locus}" (expected ${Object.keys(LOCI).join(' / ')})`);
  else if (!item.locusAuthored && item.locus && item.locus !== 'webeverything' && item.batchable)
    warn(`Backlog item "${item.id}" reads as locus "${item.locus}" (inferred from its tags/parent) but has no explicit \`locus:\` — a cross-locus /batch will gate it with ${item.locus}'s gate; set \`locus: ${item.locus}\` to confirm, or \`locus: webeverything\` if it's actually built and gated here`);
  if (item.relatedProject && !projectById.has(item.relatedProject))
    err(`Backlog item "${item.id}" relatedProject "${item.relatedProject}" does not resolve in projects.json`,
      dUnresolvedRef('Backlog', item.id, backlogFile, 'relatedProject', item.relatedProject, 'projects.json'));
  if (item.relatedReport && !reportExists(item.relatedReport))
    err(`Backlog item "${item.id}" relatedReport does not exist: ${item.relatedReport}`,
      dUnresolvedRef('Backlog', item.id, backlogFile, 'relatedReport', item.relatedReport, 'reports/'));
  if (item.crossRef && (!item.crossRef.url || !item.crossRef.label))
    err(`Backlog item "${item.id}" crossRef must have both "url" and "label"`);
  // graduatedTo records the entity a resolved item became. It doesn't apply to outcomes that aren't a
  // new entity: a `task` (bounded sub-work / a fix that rolls up) or a `decision` (a ruling). A resolved
  // `story`/`epic` that produced no entity sets the sentinel `graduatedTo: none`; any present value
  // silences this nudge. (Pre-#487 this exempted `issue`; issues are now `story`/`task` by kind, so the
  // fix-class exemption maps to `task`.)
  if (item.status === 'resolved' && !item.graduatedTo && !['task', 'decision'].includes(item.kind))
    warn(`Backlog item "${item.id}" is resolved but has no graduatedTo — record what it became`);
  // #247 — resolve the value, not just its presence. A compact `kind:slug` ref must have a known kind
  // and a resolving slug; the `none` sentinel and every free-form value don't match GRADUATED_REF and
  // are left untouched.
  if (typeof item.graduatedTo === 'string') {
    const gm = GRADUATED_REF.exec(item.graduatedTo.trim());
    if (gm) {
      const [, kind, slug] = gm;
      const reg = graduatedKinds[kind];
      if (!reg)
        err(`Backlog item "${item.id}" graduatedTo "${item.graduatedTo}" uses unknown kind "${kind}" — expected one of ${Object.keys(graduatedKinds).join(' / ')}, the sentinel "none", or a free-form description of what it became`);
      else if (!reg.ids.has(slug))
        err(`Backlog item "${item.id}" graduatedTo "${kind}:${slug}" does not resolve to a known ${kind} in ${reg.file}`,
          dUnresolvedRef('Backlog', item.id, backlogFile, 'graduatedTo', `${kind}:${slug}`, reg.file));
    }
  }

  // ── Agile sizing — drives the /backlog/ burndown (keyed on the merged `kind` axis, #487) ──
  // `kind` presence + enum are checked above; here only the size-by-kind constraints. A `story` requires
  // Fibonacci points; a `task` is never sized (rolls up to a parent); an `epic` is sized only while
  // unsliced (the sized-epic-with-children double-count is caught in check-standards.mjs); a `decision`
  // carries an optional size (its analysis effort) — no constraint.
  if (item.size !== undefined && !FIB.has(item.size))
    err(`Backlog item "${item.id}" has non-Fibonacci size "${item.size}" (expected one of ${[...FIB].join(', ')})`);
  if (item.kind === 'story' && item.size === undefined)
    err(`Backlog item "${item.id}" is a story but has no size — every story must carry Fibonacci points`);
  if (item.kind === 'task' && item.size !== undefined)
    err(`Backlog item "${item.id}" is a task but has a size — tasks are never sized (they roll up under a story/epic)`);
  if (item.parent !== undefined && !knownNums.has(String(item.parent)))
    err(`Backlog item "${item.id}" parent "#${item.parent}" does not resolve to an existing item`,
      dUnresolvedRef('Backlog', item.id, backlogFile, 'parent', String(item.parent), 'backlog/'));
  // Resolution date is what the burndown plots — required once resolved.
  if (item.status === 'resolved' && !item.dateResolved)
    err(`Backlog item "${item.id}" is resolved but has no dateResolved — the burndown needs the resolution date`);

  return { errors, warnings };
}

// ── Classification-axis loud-fail (#1247) ─────────────────────────────────────
// The Prioritisation board buckets every open item onto the merged `kind` axis (#487): a `task`/small
// `story` → `batchable`, a `decision` → Tier B, an open `epic` → `sliceable`. Each of those three pools
// keys off `item.kind`. So if the kind axis is ever UNPOPULATED for the whole collection — the #487
// near-miss, where consumers were switched to `item.kind` ahead of the producer, leaving `kind`
// undefined everywhere — all three pools collapse to zero AT ONCE while the board still renders (a
// silent empty Prioritisation tab: "0 batchable / 0 decision / 0 program"), because `deriveTier` still
// hands an undefined-kind item Tier A. A per-item "missing kind" error catches the field being absent;
// this aggregate canary additionally catches a *bucketing-logic* break that leaves `kind` present but
// every classified pool empty. Both failure modes share one observable signature: open items exist but
// {batchable, tierB, sliceable} are all zero. That is the loud-fail — never a quiet zero board.
//
// Pure over the loaded + enriched collection (items carry `.status`, `.kind`, `.tier`, `.batchable`,
// `.sliceable`); returns null when healthy, else a diagnosis object the script turns into one error.
export function detectClassificationCollapse(items) {
  const open = (items || []).filter((it) => it && it.status === 'open');
  if (open.length === 0) return null; // an all-resolved backlog legitimately classifies nothing
  const batchable = open.filter((it) => it.batchable === true).length;
  const tierB = open.filter((it) => it.tier === 'B').length;
  const sliceable = open.filter((it) => it.sliceable === true).length;
  if (batchable + tierB + sliceable > 0) return null;
  const kindlessOpen = open.filter((it) => !BACKLOG_KINDS.has(it.kind)).length;
  return { openCount: open.length, batchable, tierB, sliceable, kindlessOpen };
}

// ── Front-A native-first conformance metric (#1267) ───────────────────────────
// The platform-standards watch (#1257) front A: every WE standard with a SHIPPED native equivalent should
// defer to it (native-first, #031). This turns that from a one-time assertion into a living, QUANTITATIVE
// check — the metric the next watch run reads. Pure over the `nativeFirstWatch.json` ledger (one row per
// tracked native equivalent, each carrying a `registered` flag the watch flips when the standard repoints).
// Returns the totals + the still-unregistered rows; the script surfaces them as a nudge (not an error —
// the registrations are tracked open work, so red-gating would just block the batch fixing them).
export function computeNativeFirstConformance(watch) {
  const entries = (watch && Array.isArray(watch.entries)) ? watch.entries : [];
  const pending = entries.filter((e) => e && e.registered !== true);
  return {
    total: entries.length,
    registered: entries.length - pending.length,
    pending: pending.length,
    pendingList: pending.map((e) => `${e.id}${e.trackingItem ? ` (#${e.trackingItem})` : ''}`),
  };
}

// ── Front-A design-knowledge conformance metric (#1586) ───────────────────────
// The design-knowledge intake program (#1585) front A: every ADMITTED authoritative source should
// eventually be distilled into the codified #1034 design-critique rubric (its priors carried per axis as
// provenance, #1587). This turns that from an aspiration into a living, QUANTITATIVE check — the metric
// the next watch run reads. Pure over the `designKnowledgeWatch.json` ledger (one row per admitted source,
// each carrying a `distilledInto` field the watch fills when the source lands in the rubric). A row counts
// as distilled when `distilledInto` is a non-empty value (a rubric axis/version ref). Mirrors
// computeNativeFirstConformance (#1267). Returns the totals + the still-undistilled rows; the script
// surfaces them as a nudge (not an error — distillation is tracked open work, so red-gating would just
// block the batch doing it).
export function computeDesignKnowledgeConformance(watch) {
  const entries = (watch && Array.isArray(watch.entries)) ? watch.entries : [];
  const isDistilled = (e) => e && e.distilledInto != null &&
    (Array.isArray(e.distilledInto) ? e.distilledInto.length > 0 : String(e.distilledInto).trim() !== '');
  const pending = entries.filter((e) => !isDistilled(e));
  return {
    total: entries.length,
    distilled: entries.length - pending.length,
    pending: pending.length,
    pendingList: pending.map((e) => `${e.id}${e.trackingItem ? ` (#${e.trackingItem})` : ''}`),
  };
}

// ── Raw-HTML-in-backlog-body lint (#290) ──────────────────────────────────────
// An un-backticked HTML tag in a backlog markdown body is passed through verbatim by 11ty and parsed
// by the browser as a live element. A void/unclosed interactive one (`<select>`, `<dialog>`,
// `<textarea>`) then swallows the rest of the page body, rendering the item visibly empty — the #020
// bug, which shipped silently because check:standards didn't look. This lint flags tag-like `<…>`
// sequences outside code spans/fences so the author wraps them (cheap fix: backticks).
//
// Severity is WARNING, not error: balanced raw HTML (e.g. #028's deliberate `<h3>/<p>/<ul>` block)
// renders fine, so banning all body HTML would red-gate a working item. The warning surfaces every
// raw tag — including the dangerous unclosed ones — without failing on legitimate rich-HTML prose.
//
// Match is restricted to RECOGNISED HTML element names. Backlog/doc prose is dense with `<NNN>`,
// `<date>`, `<slug>` placeholders that are valid tag-name syntax but are NOT elements (the browser
// treats them as inert unknown tags); matching every `<…>` would bury the real hits under placeholder
// noise. Every content-swallowing element is a standard one, so the recognised-element set IS the
// danger zone — custom elements (hyphenated, inert) are intentionally excluded.
export const HTML_ELEMENTS = new Set([
  'a', 'abbr', 'address', 'area', 'article', 'aside', 'audio', 'b', 'base', 'bdi', 'bdo',
  'blockquote', 'body', 'br', 'button', 'canvas', 'caption', 'cite', 'code', 'col', 'colgroup',
  'data', 'datalist', 'dd', 'del', 'details', 'dfn', 'dialog', 'div', 'dl', 'dt', 'em', 'embed',
  'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head',
  'header', 'hgroup', 'hr', 'html', 'i', 'iframe', 'img', 'input', 'ins', 'kbd', 'label', 'legend',
  'li', 'link', 'main', 'map', 'mark', 'menu', 'meta', 'meter', 'nav', 'noscript', 'object', 'ol',
  'optgroup', 'option', 'output', 'p', 'picture', 'pre', 'progress', 'q', 'rp', 'rt', 'ruby', 's',
  'samp', 'script', 'section', 'select', 'slot', 'small', 'source', 'span', 'strong', 'style', 'sub',
  'summary', 'sup', 'table', 'tbody', 'td', 'template', 'textarea', 'tfoot', 'th', 'thead', 'time',
  'title', 'tr', 'track', 'u', 'ul', 'var', 'video', 'wbr',
]);

/**
 * Find un-backticked HTML element tags in a markdown body. Fenced code blocks (``` / ~~~) and inline
 * code spans (`…`) are stripped first, so a `<select>` shown as an example inside backticks is ignored
 * and only prose-level raw HTML remains. Only tags whose name resolves in HTML_ELEMENTS are reported.
 *
 * Pure: takes the raw body string (the script reads the file) and returns `{ line, tag, name }` per
 * hit, line-numbered against the original body for an actionable message.
 */
export function findRawHtmlInMarkdown(body) {
  const findings = [];
  if (typeof body !== 'string' || body === '') return findings;
  let fenceChar = null;   // the char of the open fence (` or ~), or null when outside a fence
  let fenceLen = 0;       // its run length — a fence closes on the same char, run length ≥ this
  body.split('\n').forEach((line, i) => {
    const fm = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceChar) {
      if (fm && fm[1][0] === fenceChar && fm[1].length >= fenceLen) { fenceChar = null; fenceLen = 0; }
      return; // inside a fence — drop the line
    }
    if (fm) { fenceChar = fm[1][0]; fenceLen = fm[1].length; return; }
    // Strip inline code spans (a backtick run, lazily, to a matching-length run) before scanning.
    const prose = line.replace(/(`+)[\s\S]*?\1/g, ' ');
    for (const m of prose.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g)) {
      const name = m[1].toLowerCase();
      if (HTML_ELEMENTS.has(name)) findings.push({ line: i + 1, tag: m[0], name });
    }
  });
  return findings;
}

// ── Buried-fork lint: a fork section in a non-decision body (#441 carve rule) ──
// A fork belongs in a `type: decision` item, never inline in an idea/epic/story body. The tell is a
// fork-shaped SECTION HEADING ("## Open design points", "## Open decisions", "## Design tensions") in
// a non-decision item — exactly the #192 / #315 / #087 pattern. This lint flags those so the author
// carves the fork to a decision item that `blocks` the original (docs/agent/backlog-workflow.md → the
// carve rule). Severity is WARNING: the heading is a strong signal but not proof (a section may list
// forks already deferred elsewhere), so it nudges rather than red-gates.
//
// Suppressed when the section is already SETTLED — it names a decision item (`#NNN`) alongside
// carve/delegate/resolve/block language — so a correctly-carved item (#192's "→ #441", #134's "carved
// to #450", #315's "resolved by the child stories … #346") does NOT warn. The script applies it only
// to non-`decision`, non-`resolved` items; a decision item legitimately *is* the fork, and a resolved
// item's open-questions are historical.
// The fork tells are "Open …", "… tension", and "… to settle" — headings that announce an UNSETTLED
// choice. A bare "Design decisions" (esp. "(recommended)") is the opposite — a settled section — so it
// is intentionally NOT a term (it produced false positives on resolved-inline sections).
export const FORK_HEADING_TERMS = [
  'open design', 'open decision', 'open question', 'open fork', 'open sub-decision',
  'design tension', 'forks to settle', 'decisions to settle', 'tensions to settle',
];
// A section is "settled" (→ already carved/resolved, suppress) when it cites an item number next to
// carve/delegate/resolve/settle/blockedBy/decision language. NB: match `blockedby`/`blocked by`, NOT
// bare "block" — a live fork can be *about* whether to build a block (#369), which must still warn.
const FORK_SETTLED_RX = /(carv|deleg|resolv|settl|blocked\s?by|decision)/i;
const ITEM_REF_RX = /#\d{1,4}\b/;

/**
 * Find fork-shaped section headings in a backlog markdown body that are NOT already settled (carved to
 * a decision). A "section" runs from its heading to the next markdown heading (any level). A heading
 * matches when its text contains a FORK_HEADING_TERMS phrase; it is reported only when its section body
 * lacks a decision pointer (an `#NNN` ref alongside carve/resolve/block language).
 *
 * Pure: takes the raw body string (frontmatter already stripped by the caller) and returns
 * `{ line, heading }` per unsettled fork section, line-numbered against the body for an actionable
 * message. The caller restricts this to non-decision, non-resolved items.
 */
export function findBuriedForkSections(body) {
  const findings = [];
  if (typeof body !== 'string' || body === '') return findings;
  const lines = body.split('\n');
  // Index every heading line first, so a section's end is the next heading (or EOF).
  const headings = [];
  lines.forEach((line, i) => {
    const m = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (m) headings.push({ i, text: m[2] });
  });
  for (let h = 0; h < headings.length; h++) {
    const { i, text } = headings[h];
    const low = text.toLowerCase();
    if (!FORK_HEADING_TERMS.some((t) => low.includes(t))) continue;
    const end = h + 1 < headings.length ? headings[h + 1].i : lines.length;
    const section = lines.slice(i, end).join('\n');
    // Settled (already carved/resolved) → suppress.
    if (ITEM_REF_RX.test(section) && FORK_SETTLED_RX.test(section)) continue;
    findings.push({ line: i + 1, heading: text });
  }
  return findings;
}

// ── Mis-flagged-batchable lint: a batchable item whose body asserts non-batchability ──────────────
// The `--select` loader derives `batchable` from STRUCTURED fields only (Tier A + size ≤ 8 + all
// `blockedBy` resolved). The disqualifier that actually makes an item un-workable often lives only in
// PROSE — a buried fork, an author "not batchable as one; re-slice" note, an "external infra" / "agent
// cannot provision" deliverable, a "blocked-in-fact" / "open question" caveat. When that prose is
// present but the flags still compute `batchable`, the loader over-reports agent-readiness and every
// batch pre-flight re-rejects the item by hand instead of fixing the data (the recurring slip this
// lint kills — see memory `feedback_misflagged_batchable_fix_real_state`).
//
// The caller restricts this to `item.batchable === true`, so the lint SELF-CLEARS the moment the real
// state is encoded: retyping to `decision`, bumping `size` to ≥13, parking, or adding the real
// `blockedBy` edge all drop the item out of `batchable`, and the warning vanishes with no further
// edit. The only items it fires on are exactly those still computed-batchable while their body says
// otherwise. WARNING, not error: prose heuristics aren't proof, and the fix is a deliberate re-flag.
//
// Each entry is [label, regex]. Kept high-signal to limit false positives (a passing mention like
// "this is NOT external infra" can trip it — the message says "encode the real state or reword").
export const NON_BATCHABLE_MARKERS = [
  ['not batchable', /\bnot\s+batchable\b/i],
  ['re-slice', /\bre-?slice\b/i],
  ['blocked-in-fact', /\bblocked[-\s]in[-\s]fact\b/i],
  ['external infra', /\bexternal\s+infra(structure)?\b/i],
  ['human-in-the-loop', /\bhuman[-\s]in[-\s]the[-\s]loop\b/i],
  ['needs prep/decision', /\bneeds\s+(a\s+)?[`/]*(prep|prepare|decision)\b/i],
  ['agent cannot provision', /\b(agent\s+cannot|cannot\s+(stand\s+up|provision|be\s+(built|done|stood)))\b/i],
  ['unverified prerequisite', /\b(verify|unverified|unconfirmed)\b[^.\n]{0,60}\bbefore\s+(claim|build)/i],
];

/**
 * Scan a backlog markdown body for non-batchability MARKERS (frontmatter already stripped by the
 * caller). Skips fenced + inline code (mirrors findRawHtmlInMarkdown) so a sample/path doesn't trip it.
 * Returns `{ line, marker }` per hit; the caller restricts this to `item.batchable === true` items and
 * groups the distinct markers per item. Pure.
 */
export function findNonBatchableMarkers(body) {
  const findings = [];
  if (typeof body !== 'string' || body === '') return findings;
  let fenceChar = null, fenceLen = 0;
  body.split('\n').forEach((line, i) => {
    const fm = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceChar) {
      if (fm && fm[1][0] === fenceChar && fm[1].length >= fenceLen) { fenceChar = null; fenceLen = 0; }
      return;
    }
    if (fm) { fenceChar = fm[1][0]; fenceLen = fm[1].length; return; }
    // Scan the raw line (fenced blocks already skipped). Unlike the raw-HTML lint we do NOT strip
    // inline code spans: these markers are natural-language phrases and authors routinely backtick the
    // slash-commands inside them (e.g. "needs a `/decision`"), which must still match.
    for (const [label, rx] of NON_BATCHABLE_MARKERS) {
      if (rx.test(line)) findings.push({ line: i + 1, marker: label });
    }
  });
  return findings;
}

// ── Bad-body-link lint: leaked authoring syntax in a backlog body ──────────────
// A backlog body is rendered at `/backlog/<id>/` on the 11ty site, so a link that only resolves in the
// repo/editor (or not at all) renders as dead text or a 404 for a reader. Three recurring leaks:
//   • `[[wiki-link]]` — MEMORY-files-only syntax (`[[feedback_*]]`/`[[project_*]]`); markdown renders it
//     literally and the slug has no page anywhere. ERROR — there is no valid use in a backlog body.
//   • `localhost` / absolute-`/Users/` / `file://` links — dead for any reader. WARN.
//   • a link to ANOTHER backlog item's `.md` file (`](…/backlog/NNN-x.md)`) — 404s on the live site;
//     the correct form is the rendered URL `/backlog/NNN-slug/`. WARN. (Links to reports/ or docs/agent/
//     `.md`, which are deliberately NOT on the site, are the sanctioned agent-facing ref and NOT flagged.)
// Skips fenced + inline code (an array literal `[[1,2]]` or a sample path in a code span is legitimate),
// mirroring findRawHtmlInMarkdown. Returns `{ line, kind, text }`; the caller groups per item + severity.
export function findBadBodyLinks(body) {
  const findings = [];
  if (typeof body !== 'string' || body === '') return findings;
  let fenceChar = null, fenceLen = 0;
  body.split('\n').forEach((line, i) => {
    const fm = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceChar) {
      if (fm && fm[1][0] === fenceChar && fm[1].length >= fenceLen) { fenceChar = null; fenceLen = 0; }
      return; // inside a fence
    }
    if (fm) { fenceChar = fm[1][0]; fenceLen = fm[1].length; return; }
    const prose = line.replace(/(`+)[\s\S]*?\1/g, ' '); // strip inline code spans
    const ln = i + 1;
    for (const m of prose.matchAll(/\[\[[^\]]*\]\]/g)) findings.push({ line: ln, kind: 'wikilink', text: m[0] });
    for (const m of prose.matchAll(/\]\(([^)\s]+)/g)) {
      const tgt = m[1];
      if (/^(https?:\/\/)?localhost\b/i.test(tgt)) findings.push({ line: ln, kind: 'localhost', text: tgt });
      else if (/^(\/Users\/|file:\/\/)/i.test(tgt)) findings.push({ line: ln, kind: 'absfile', text: tgt });
      // A link to another backlog item — bare sibling `NNN-slug.md`, or `./`, `../backlog/`, `/backlog/`,
      // `backlog/` prefixed. ALL render as a dead href from `/backlog/<id>/` (bare `NNN-slug.md` resolves to
      // `/backlog/<id>/NNN-slug.md` → 404); the live route is `/backlog/NNN-slug/`. The `\d{3}-` prefix +
      // absence of any non-`backlog/` dir keeps sanctioned `reports/…md` / `docs/…md` refs out of scope.
      else if (/^(?:\.{0,2}\/)?(?:backlog\/)?\d{3}-[a-z0-9-]+\.md(?:#.*)?$/.test(tgt)) findings.push({ line: ln, kind: 'backlog-md', text: tgt });
    }
  });
  return findings;
}

// ── Unquoted-colon scalar lint for backlog frontmatter (#453) ──────────────────
// The loader (#430) skips a malformed-YAML item and only warns, so a frontmatter typo slips past the
// gate unseen. The recurring trigger is an UNQUOTED plain scalar whose value embeds a `: ` (colon +
// space) or a trailing `:` — e.g. `graduatedTo: a/b.json: foo` — which YAML reads as a nested mapping
// ("mapping values are not allowed here") and the parse dies. This pure helper scans the raw
// frontmatter block (NOT the loader output — that's already dropped the broken items) and returns one
// finding per offending line, so check:standards prompts the quote-fix at author time, in CI, before
// the loader has to skip it. Takes the full file content; reports ABSOLUTE 1-based line numbers.
//
// Deliberately conservative — only a top-level `key: value` plain scalar is examined, and a value is
// EXEMPT (skipped) when it is already quoted (`"`/`'`), a flow collection (`{`/`[` — inner colons are
// legal there, e.g. `crossRef: { url: /x, label: Foo }`), a block scalar (`|`/`>`), a comment, or a
// YAML anchor/alias (`&`/`*`). A bare colon WITHOUT a following space (a URL like `https://x`) is fine
// in plain YAML and is NOT flagged — only `: ` or a trailing `:` breaks the parse.
export function findUnquotedColonScalars(content) {
  const findings = [];
  if (typeof content !== 'string' || !content.startsWith('---\n')) return findings;
  const lines = content.split('\n');
  // The frontmatter block is lines[1 .. closing fence). Find the next bare `---`.
  let close = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---' || lines[i] === '---\r') { close = i; break; }
  }
  if (close === -1) return findings; // no closing fence — not our concern here
  for (let i = 1; i < close; i++) {
    const line = lines[i];
    const m = line.match(/^([A-Za-z_][\w-]*):(\s+)(.*)$/);
    if (!m) continue;                       // not a top-level `key: value` line
    const value = m[3].trim();
    if (value === '') continue;             // an empty value (a nested block follows) — fine
    const first = value[0];
    if (first === '"' || first === "'" || first === '{' || first === '[' ||
        first === '|' || first === '>' || first === '#' || first === '&' || first === '*') continue;
    // Strip a trailing inline comment (` # …`) before testing the scalar itself.
    const scalar = value.replace(/\s+#.*$/, '');
    if (/:\s/.test(scalar) || /:$/.test(scalar)) {
      findings.push({ line: i + 1, key: m[1], value });
    }
  }
  return findings;
}

// ── Per-item backlog RENDERING lint (#845) ────────────────────────────────────
// The structural/rendering checks that operate on ONE backlog item in isolation — no registry/cross-item
// context needed, so they're cheap enough to run on every edit (a scoped `check:standards --item NNN`
// validator, or a PostToolUse hook on backlog/*.md). Composes the pure detectors above with the SAME
// canonical messages the whole-repo gate (`check-standards.mjs`) emits, so the two never diverge — the
// gate calls this for its per-item rendering passes and the scoped script calls it standalone.
//
// Inputs: `body` = the item body with frontmatter stripped (for the markdown scans); `item` = the
// loader-shaped record (id/type/status/batchable — drives the conditional checks). Returns
// `{ errors, warnings }` of message strings. The frontmatter unquoted-colon scan is NOT here — it must
// run file-driven (a malformed-YAML item is skipped by the loader, so it isn't in the item array at all),
// so each caller runs `findUnquotedColonScalars(content)` over the raw file itself. Also excludes the
// digest-length nudge (validateBacklogItem owns it) and the blockedBy cycle walk (a graph-level check).
export function lintBacklogItemRendering({ item, body }) {
  const errors = [];
  const warnings = [];
  const id = item.id;

  // Body links — a backlog body renders at /backlog/<id>/, so leaked authoring syntax reads as dead text.
  const linkHits = findBadBodyLinks(body);
  if (linkHits.length) {
    const byKind = (k) => linkHits.filter((h) => h.kind === k);
    const lines = (k) => [...new Set(byKind(k).map((h) => h.line))].join(', ');
    if (byKind('wikilink').length) {
      errors.push(`Backlog item "${id}" uses [[wiki-link]] syntax at body line(s) ${lines('wikilink')} — ` +
        `that is MEMORY-files-only; markdown renders it literally and the slug has no page. In a backlog ` +
        `body, link another item as /backlog/NNN-slug/ or drop to plain prose.`);
    }
    if (byKind('backlog-md').length) {
      errors.push(`Backlog item "${id}" links to another item with a dead .md path @ line(s) ${lines('backlog-md')} ` +
        `— a bare/relative \`NNN-slug.md\` renders as a 404 from /backlog/${id}/. ` +
        `Use the rendered URL \`/backlog/NNN-slug/\` instead.`);
    }
    const warnKinds = ['localhost', 'absfile'].filter((k) => byKind(k).length);
    if (warnKinds.length) {
      const detail = warnKinds.map((k) => `${k === 'absfile' ? 'absolute /Users//file:// link' :
        'localhost link'} @ line(s) ${lines(k)}`).join('; ');
      warnings.push(`Backlog item "${id}" has a body link that is dead on the live site — ${detail}. ` +
        `Use the rendered /backlog/NNN-slug/ URL (or a site-relative path); editor-only refs to ` +
        `reports/ and docs/agent/ are fine.`);
    }
  }

  // Raw HTML — an un-backticked recognised element is parsed live by the browser; a void/unclosed one
  // swallows the rest of the page (the #020 bug). WARN (balanced rich-HTML bodies render fine).
  const htmlHits = findRawHtmlInMarkdown(body);
  if (htmlHits.length) {
    const tags = [...new Set(htmlHits.map((h) => h.name))].map((n) => `<${n}>`).join(', ');
    const hl = [...new Set(htmlHits.map((h) => h.line))].join(', ');
    warnings.push(`Backlog item "${id}" has raw HTML (${tags}) at body line(s) ${hl} outside code — ` +
      `11ty passes it through and the browser parses it as a live element; a void/unclosed interactive ` +
      `tag (e.g. <select>/<script>) swallows the rest of the page. Wrap them in backticks.`);
  }

  // Buried fork — a fork-shaped section in a non-decision, non-resolved body should be carved to a decision.
  if (item.kind !== 'decision' && item.status !== 'resolved') {
    const forkHits = findBuriedForkSections(body);
    if (forkHits.length) {
      const where = forkHits.map((h) => `"${h.heading}" (line ${h.line})`).join(', ');
      warnings.push(`Backlog item "${id}" (${item.kind}) has a fork-shaped section ${where} in a non-decision ` +
        `body — if it's a live design fork, carve it to a type:decision item that blocks this one; if it's ` +
        `already resolved or deferred elsewhere, reframe the heading or cite the decision (#NNN). ` +
        `See docs/agent/backlog-workflow.md → the carve rule.`);
    }
  }

  // Mis-flagged batchable — body asserts non-batchability but the structured flags compute batchable.
  if (item.batchable === true) {
    const markerHits = findNonBatchableMarkers(body);
    if (markerHits.length) {
      const markers = [...new Set(markerHits.map((h) => h.marker))].join('", "');
      const ml = [...new Set(markerHits.map((h) => h.line))].join(', ');
      warnings.push(`Backlog item "${id}" computes \`batchable\` but its body asserts non-batchability ("${markers}" ` +
        `@ line(s) ${ml}) — the loader only sees tier+size+blockedBy, so this over-reports agent-readiness. ` +
        `Encode the real state so it drops from the pool: retype \`type: decision\`, bump \`size\` to ≥13, ` +
        `\`status: parked\`, or add the real \`blockedBy\` edge (file the prereq/decision if missing). ` +
        `If the marker is a passing mention, reword it. See docs/agent/backlog-workflow.md → batching.`);
    }
  }

  // Premature-epic-closure guard (the #777 lesson). The cross-item guard in check-standards.mjs only
  // catches a resolved epic with an open CHILD; #777 resolved with its one child done while four
  // migration slices lived only as prose ("Not carved yet (gated on #765)"), so it slipped through —
  // an umbrella closed over uncarved scope. Two body-level tells of that, scanned only on a RESOLVED
  // epic, skipping fenced code:
  //   1. an unchecked GFM task box `- [ ]` — a literal "not done" marker. Closing over it is always a
  //      contradiction (check the box once the scope ships, or don't resolve) → ERROR.
  //   2. forward-looking uncarved-slice language ("not carved", "carve once/after/later") — softer,
  //      because a deliberate deferral that cites its tracking item (#666 → #665) is legitimate → WARN.
  if (item.status === 'resolved' && item.kind === 'epic') {
    const uncheckedBoxes = [];
    const uncarvedTells = [];
    let inFence = false;
    body.split('\n').forEach((raw, i) => {
      const l = raw.trim();
      if (/^```/.test(l)) { inFence = !inFence; return; }
      if (inFence) return;
      if (/^[-*]\s*\[ \]/.test(l)) uncheckedBoxes.push(i + 1);
      if (/\b(not (yet )?carved|left uncarved|uncarved|carve (once|after|later))\b/i.test(l)) uncarvedTells.push(i + 1);
    });
    if (uncheckedBoxes.length)
      errors.push(`Backlog item "${id}" is a RESOLVED epic with ${uncheckedBoxes.length} unchecked scope box(es) ` +
        `(\`- [ ]\` @ line(s) ${uncheckedBoxes.join(', ')}) — an umbrella closed over work it still marks as not done ` +
        `(the #777 footgun). If the scope shipped, check the box and cite the child that delivered it; if it didn't, ` +
        `reopen the epic (status: open) and carve the remaining slice(s). See docs/agent/backlog-workflow.md → "Closing out".`);
    if (uncarvedTells.length)
      warnings.push(`Backlog item "${id}" is a RESOLVED epic whose body still uses uncarved-slice language @ line(s) ` +
        `${uncarvedTells.join(', ')} — verify that scope actually shipped or is a deliberate deferral that cites its ` +
        `tracking item (#NNN). If it was simply never sliced, reopen and carve it rather than closing the umbrella over it.`);
  }

  return { errors, warnings };
}

// ── Implementation-lifecycle vocabulary + descriptor plumbing (#256) ───────────
// Shared by the script (blocks/plugs status) AND the entity validators below, so the lifecycle
// vocabulary and the descriptor `file` pointers have a single definition. Ordered concept → draft →
// experimental → active. Deprecated synonyms map to their canonical target (flagged so drift can't
// return). Research topics use a separate axis (RESEARCH_STATUSES, kept in the script).
export const LIFECYCLE = new Set(['concept', 'draft', 'experimental', 'active']);
export const STATUS_SYNONYMS = { implemented: 'active', stable: 'active', done: 'active', planned: 'concept', wip: 'draft' };

// Spec data files, keyed by entity for descriptor `file` pointers (the row/file a fixer edits).
// Block is NOT here: blocks are split one-file-per-block (#882), so a Block fixer's target is
// per-id — resolve it through `fileFor`/`blockSpecFile`, never a single registry path.
export const FILE = {
  Plug: 'src/_data/plugs.json', Protocol: 'src/_data/protocols.json',
  Intent: 'src/_data/intents.json', Capability: 'src/_data/capabilities.json',
  CapabilityAdapter: 'src/_data/capabilityMatrix.json', Project: 'src/_data/projects.json',
  Research: 'src/_data/researchTopics.json',
  Preset: 'src/_data/assemblerPresets.json',
  DesignSystem: 'src/_data/designSystems.json',
};

// Entities split one-file-per-id: the descriptor `file` must point at the per-entry spec, not the (now
// virtual) monolith — so the autofix write-target is real AND the #1144 --scope/--local lane attribution
// matches the file a lane actually dirties. Block #882, Intent + Research #1145.
const PER_ID_SPEC_DIR = {
  Block: 'blocks', Intent: 'intents', Research: 'researchTopics',
  Protocol: 'protocols', Demo: 'demos', Preset: 'assemblerPresets', // #1146
  Plug: 'plugs', Capability: 'capabilities', Project: 'projects', DesignSystem: 'designSystems', // #1157
};

/** The per-block spec file a Block fixer edits (#882 — replaces the former single blocks.json row). */
export const blockSpecFile = (id) => `src/_data/blocks/${id}.json`;

/** Resolve the descriptor `file` write-target for an entity kind: per-id for split entities, the registry otherwise. */
export const fileFor = (kind, id) => (PER_ID_SPEC_DIR[kind] ? `src/_data/${PER_ID_SPEC_DIR[kind]}/${id}.json` : FILE[kind]);

// A spec entity with no matching description .njk — the model writes the prose; `file` is the path to create.
export const dMissingDescription = (entity, id, file) =>
  ({ kind: 'missing-description', fix: 'model', entity, id, file });

/**
 * Status enum check — returns an array of `{ message, descriptor? }` error entries (status rules
 * never warn). A deprecated synonym is `reference`-fixable (canonical target known); an
 * otherwise-invalid value is `model`-fixable (intended status isn't derivable). Pure: the caller
 * pushes the entries onto its own error list, so the script and the entity validators share one body.
 */
export function checkStatus(kind, id, status) {
  const out = [];
  if (!status) return out;
  // The descriptor `file` is where a fixer WRITES the corrected status. Blocks are split one-file-per
  // block (#882), so a Block fix must target its own src/_data/blocks/<id>.json, not a single registry.
  const file = fileFor(kind, id);
  if (STATUS_SYNONYMS[status]) {
    const to = STATUS_SYNONYMS[status];
    out.push({
      message: `${kind} "${id}" uses deprecated status "${status}" — use canonical "${to}"`,
      descriptor: file ? { kind: 'deprecated-status', fix: 'reference', entity: kind, id, file, field: 'status', from: status, to } : undefined,
    });
  } else if (!LIFECYCLE.has(status)) {
    out.push({
      message: `${kind} "${id}" has invalid status "${status}" (expected ${[...LIFECYCLE].join(' / ')})`,
      descriptor: file ? { kind: 'invalid-status', fix: 'model', entity: kind, id, file, field: 'status', from: status, allowed: [...LIFECYCLE] } : undefined,
    });
  }
  return out;
}

/**
 * Validate a single protocol (§6b) — required fields, ownedByProject / realizesIntent resolution,
 * and the project-partial anchor probe.
 *
 * Pure: the anchor probe's file read is injected via `readProjectPartial(projectId) => string|null`
 * (null = the partial file is absent), so the rule is exercisable with synthetic projects.
 * @param ctx { projectById: Map, intentById: Map, readProjectPartial: (projectId) => string|null }
 */
export function validateProtocol(proto, ctx) {
  const { projectById, intentById, readProjectPartial } = ctx;
  const errors = [];
  const err = (m, descriptor) => errors.push({ message: m, descriptor });
  const file = fileFor('Protocol', proto.id); // per-protocol spec path (#1146) for descriptor attribution
  for (const f of ['id', 'name', 'summary', 'status', 'ownedByProject', 'anchor']) {
    if (!proto[f]) err(`Protocol "${proto.id || '<no id>'}" missing required field "${f}"`,
      dMissingField('Protocol', proto.id, file, f));
  }
  for (const e of checkStatus('Protocol', proto.id, proto.status)) err(e.message, e.descriptor);
  if (proto.ownedByProject && !projectById.has(proto.ownedByProject))
    err(`Protocol "${proto.id}" ownedByProject "${proto.ownedByProject}" does not resolve in projects.json`,
      dUnresolvedRef('Protocol', proto.id, file, 'ownedByProject', proto.ownedByProject, 'projects.json'));
  if (proto.realizesIntent && !intentById.has(proto.realizesIntent))
    err(`Protocol "${proto.id}" realizesIntent "${proto.realizesIntent}" does not resolve in intents.json`,
      dUnresolvedRef('Protocol', proto.id, file, 'realizesIntent', proto.realizesIntent, 'intents.json'));
  if (proto.ownedByProject && proto.anchor) {
    const body = readProjectPartial(proto.ownedByProject);
    if (body === null || body === undefined)
      err(`Protocol "${proto.id}" expects project partial src/_includes/project-${proto.ownedByProject}.njk`);
    else if (!body.includes(`id="${proto.anchor}"`))
      err(`Protocol "${proto.id}" anchor "${proto.anchor}" not found in project-${proto.ownedByProject}.njk`);
  }
  return { errors, warnings: [] };
}

/**
 * Validate a single assembler preset (#646/#667) — a shadcn-shaped registry-item. Required fields,
 * status, `ownedByProject` resolution, every `composesBlocks`/`composesIntents` id resolves, and each
 * `files[]` entry carries a `path` + non-empty `content` (the ejectable recipe IS the standard, so an
 * empty file is a broken preset). The recipe is plain markup — it is NOT re-validated as a block.
 * @param ctx { projectById: Map, blockIds: Set, intentById: Map }
 */
export function validatePreset(preset, ctx) {
  const { projectById, blockIds, intentById } = ctx;
  const errors = [];
  const err = (m, descriptor) => errors.push({ message: m, descriptor });
  const file = fileFor('Preset', preset.name); // per-preset spec path (#1146) for descriptor attribution
  for (const f of ['name', 'type', 'title', 'description', 'status', 'ownedByProject', 'files']) {
    if (preset[f] === undefined || preset[f] === null || preset[f] === '')
      err(`Preset "${preset.name || '<no name>'}" missing required field "${f}"`,
        dMissingField('Preset', preset.name, file, f));
  }
  for (const e of checkStatus('Preset', preset.name, preset.status)) err(e.message, e.descriptor);
  if (preset.ownedByProject && !projectById.has(preset.ownedByProject))
    err(`Preset "${preset.name}" ownedByProject "${preset.ownedByProject}" does not resolve in projects.json`,
      dUnresolvedRef('Preset', preset.name, file, 'ownedByProject', preset.ownedByProject, 'projects.json'));
  for (const b of preset.composesBlocks || []) {
    if (!blockIds.has(b))
      err(`Preset "${preset.name}" composesBlocks "${b}" does not resolve in the blocks registry (src/_data/blocks/)`,
        dUnresolvedRef('Preset', preset.name, file, 'composesBlocks', b, 'blocks registry'));
  }
  for (const i of preset.composesIntents || []) {
    if (!intentById.has(i))
      err(`Preset "${preset.name}" composesIntents "${i}" does not resolve in intents.json`,
        dUnresolvedRef('Preset', preset.name, file, 'composesIntents', i, 'intents.json'));
  }
  // Optional CEM descriptor (#668) — coexists with the recipe, describing the composed-API surface. Rides
  // the #653 CEM protocol; when present it must be a minimal CEM declaration (kind + name).
  if (preset.cem !== undefined) {
    if (!preset.cem || typeof preset.cem !== 'object')
      err(`Preset "${preset.name}" cem must be a CEM declaration object`,
        dMissingField('Preset', preset.name, file, 'cem'));
    else {
      if (!preset.cem.kind)
        err(`Preset "${preset.name}" cem missing "kind" (e.g. "class")`,
          dMissingField('Preset', preset.name, file, 'cem.kind'));
      if (!preset.cem.name)
        err(`Preset "${preset.name}" cem missing "name"`,
          dMissingField('Preset', preset.name, file, 'cem.name'));
    }
  }
  if (Array.isArray(preset.files)) {
    if (preset.files.length === 0)
      err(`Preset "${preset.name}" has an empty files[] — a preset must ship at least one recipe file`,
        dMissingField('Preset', preset.name, file, 'files'));
    preset.files.forEach((file, idx) => {
      if (!file || !file.path)
        err(`Preset "${preset.name}" files[${idx}] missing "path"`,
          dMissingField('Preset', preset.name, file, `files[${idx}].path`));
      if (!file || !file.content)
        err(`Preset "${preset.name}" file "${file && file.path ? file.path : idx}" has empty content`,
          dMissingField('Preset', preset.name, file, `files[${idx}].content`));
    });
  }
  return { errors, warnings: [] };
}

/**
 * Validate a single design-system bundle (#747 Fork-3-A, #871) — a thin registry entry that points at
 * a manifest of shape `{ extends, themeTokens (DTCG ref), intentDefaults?, traitDefaults? }`. Two layers
 * are checked: the rendering index (id/name/summary/status/ownedByProject + a `manifest` pointer that
 * resolves) and the manifest it points at (per #747: `themeTokens` is the only required field, it must
 * resolve as a file, `extends` must resolve to the platform default or another design system, and every
 * other field is optional). `intentDefaults` keys, when present, must resolve to known intents (the
 * bundle sets intent defaults — Fork 2-A); `traitDefaults` stays free-form (Fork 4-A's forward-compatible
 * presentational slot — the behavioral traits in traits.json are deliberately NOT a valid target here).
 *
 * Pure: manifest reads are injected — `readManifest(relPath) => object|null` (null = absent/unparseable)
 * and `tokenRefResolves(manifestRelPath, tokenRef) => boolean` (resolves the DTCG ref relative to the
 * manifest's own directory) — so the rule is exercisable with synthetic manifests.
 * @param ctx { projectById: Map, intentById: Map, designSystemIds: Set, readManifest, tokenRefResolves }
 */
export function validateDesignSystem(ds, ctx) {
  const { projectById, intentById, designSystemIds, readManifest, tokenRefResolves } = ctx;
  const errors = [];
  const warnings = [];
  const err = (m, descriptor) => errors.push({ message: m, descriptor });
  const warn = (m, descriptor) => warnings.push({ message: m, descriptor });
  const id = ds.id || '<no id>';
  for (const f of ['id', 'name', 'summary', 'status', 'ownedByProject', 'manifest']) {
    if (!ds[f]) err(`Design system "${id}" missing required field "${f}"`,
      dMissingField('DesignSystem', ds.id, FILE.DesignSystem, f));
  }
  for (const e of checkStatus('DesignSystem', ds.id, ds.status)) err(e.message, e.descriptor);
  if (ds.ownedByProject && !projectById.has(ds.ownedByProject))
    err(`Design system "${id}" ownedByProject "${ds.ownedByProject}" does not resolve in projects.json`,
      dUnresolvedRef('DesignSystem', ds.id, FILE.DesignSystem, 'ownedByProject', ds.ownedByProject, 'projects.json'));
  if (!ds.manifest) return { errors, warnings };

  const manifest = readManifest(ds.manifest);
  if (!manifest) {
    err(`Design system "${id}" manifest "${ds.manifest}" does not resolve (missing or not valid JSON)`,
      dUnresolvedRef('DesignSystem', ds.id, FILE.DesignSystem, 'manifest', ds.manifest, ds.manifest));
    return { errors, warnings };
  }
  // themeTokens — the only required manifest field; it must resolve as a DTCG file.
  if (!manifest.themeTokens)
    err(`Design system "${id}" manifest missing required field "themeTokens" (a DTCG token ref)`,
      dMissingField('DesignSystem', ds.id, ds.manifest, 'themeTokens'));
  else if (!tokenRefResolves(ds.manifest, manifest.themeTokens))
    err(`Design system "${id}" themeTokens "${manifest.themeTokens}" does not resolve relative to ${ds.manifest}`,
      dUnresolvedRef('DesignSystem', ds.id, ds.manifest, 'themeTokens', manifest.themeTokens, ds.manifest));
  // extends — must resolve to the platform default sentinel or another registered design system.
  if (manifest.extends !== undefined) {
    const ok = manifest.extends === '@webtheme/default' || designSystemIds.has(manifest.extends);
    if (!ok)
      err(`Design system "${id}" extends "${manifest.extends}" does not resolve (expected "@webtheme/default" or another design-system id)`,
        dUnresolvedRef('DesignSystem', ds.id, ds.manifest, 'extends', manifest.extends, FILE.DesignSystem));
  }
  // intentDefaults — optional; when present every key must resolve to a known intent (Fork 2-A).
  if (manifest.intentDefaults !== undefined) {
    if (typeof manifest.intentDefaults !== 'object' || Array.isArray(manifest.intentDefaults))
      err(`Design system "${id}" intentDefaults must be an object of { intentId: value }`,
        dMissingField('DesignSystem', ds.id, ds.manifest, 'intentDefaults'));
    else for (const intentId of Object.keys(manifest.intentDefaults))
      if (!intentById.has(intentId))
        err(`Design system "${id}" intentDefaults "${intentId}" does not resolve in intents.json`,
          dUnresolvedRef('DesignSystem', ds.id, ds.manifest, 'intentDefaults', intentId, 'intents.json'));
  }
  // traitDefaults — optional, presentational only (Fork 4-A). Kept free-form: today's behavioral traits
  // (traits.json) are deliberately not a valid target, so we only type-check the slot's shape.
  if (manifest.traitDefaults !== undefined &&
      (typeof manifest.traitDefaults !== 'object' || Array.isArray(manifest.traitDefaults)))
    err(`Design system "${id}" traitDefaults must be an object of presentational { trait: value }`,
      dMissingField('DesignSystem', ds.id, ds.manifest, 'traitDefaults'));
  return { errors, warnings };
}

/**
 * Validate a single intent (§6c) — required fields, status, `dimensions` presence (warn), and
 * `requiresCapabilities` resolution (every declared id must resolve in capabilities.json).
 * @param ctx { capabilityIds: Set }
 */
export function validateIntent(intent, ctx) {
  const { capabilityIds } = ctx;
  const errors = [];
  const warnings = [];
  const err = (m, descriptor) => errors.push({ message: m, descriptor });
  const warn = (m, descriptor) => warnings.push({ message: m, descriptor });
  for (const f of ['id', 'name', 'summary', 'status', 'dimensions']) {
    if (intent[f] === undefined || intent[f] === null || intent[f] === '')
      err(`Intent "${intent.id || '<no id>'}" missing required field "${f}"`,
        dMissingField('Intent', intent.id, fileFor('Intent', intent.id), f));
  }
  for (const e of checkStatus('Intent', intent.id, intent.status)) err(e.message, e.descriptor);
  const dimCount = intent.dimensions && typeof intent.dimensions === 'object'
    ? Object.keys(intent.dimensions).length
    : 0;
  if (!dimCount) warn(`Intent "${intent.id}" has no dimensions — /intents/ catalog needs at least one axis`);
  // Intent → required-capabilities mapping (data-driven, D3′): every declared id must resolve.
  if (intent.requiresCapabilities !== undefined) {
    if (!Array.isArray(intent.requiresCapabilities)) {
      err(`Intent "${intent.id}" requiresCapabilities must be an array of capability ids`);
    } else {
      for (const capId of intent.requiresCapabilities)
        if (!capabilityIds.has(capId))
          err(`Intent "${intent.id}" requires unknown capability "${capId}" — not in capabilities.json`,
            dUnresolvedRef('Intent', intent.id, fileFor('Intent', intent.id), 'requiresCapabilities', capId, 'capabilities.json'));
    }
  }
  return { errors, warnings };
}

// Capability + build-matrix vocabularies (§6c-bis, #204). Exported so the script and tests share one
// definition of the three tier states and the polyfill classes.
export const TIER_STATES = new Set(['native-ok', 'polyfill-ok', 'capability-hard']);
// Library impls (#1450/#1487) score on a coverage axis, not the platform-relative substrate axis — a JS
// library does not sit on native-ok/polyfill-ok/capability-hard. A `kind: library` row tiers each capability
// supported/partial/unsupported instead. `kind` defaults to `native` (the existing substrate rows).
export const LIBRARY_TIER_STATES = new Set(['supported', 'partial', 'unsupported']);
export const CAP_POLYFILL = new Set(['polyfillable', 'partial', 'capability']);

/**
 * Validate a single capability (§6c-bis) — required fields, the `baseline` year-string-or-false
 * shape, and the polyfill class vocabulary.
 */
export function validateCapability(cap) {
  const errors = [];
  const err = (m, descriptor) => errors.push({ message: m, descriptor });
  for (const f of ['id', 'label', 'webFeaturesKey', 'baseline', 'polyfill', 'summary']) {
    if (cap[f] === undefined || cap[f] === null || cap[f] === '')
      err(`Capability "${cap.id || '<no id>'}" missing required field "${f}"`,
        dMissingField('Capability', cap.id, FILE.Capability, f));
  }
  if (cap.baseline !== undefined && cap.baseline !== false && typeof cap.baseline !== 'string')
    err(`Capability "${cap.id}" baseline must be a year string or false (not-yet-Baseline)`);
  if (cap.polyfill && !CAP_POLYFILL.has(cap.polyfill))
    err(`Capability "${cap.id}" has invalid polyfill class "${cap.polyfill}" (expected ${[...CAP_POLYFILL].join(' / ')})`);
  return { errors, warnings: [] };
}

/**
 * Validate the registered capability-adapter table + static build-matrix invariants (§6c-bis,
 * #204/#206/#216). The `impls[]` array IS the registered adapter table — one row per impl — and the
 * matrix's row source. This guards: a non-empty table, unique ids, per-row required fields, a boolean
 * `native` marker, a tier map whose values are all valid states keying only known capabilities, the
 * *completeness* of the grid (every row tiers every capability), a detail-page partial per row, and
 * the single-native-substrate invariant.
 *
 * Pure: `capabilityIds` (the known-capability id set) and `hasAdapterDesc(id) => bool` (the partial
 * probe) are injected, so the gnarly completeness/native-count logic is fixture-testable.
 * @param ctx { capabilityIds: Set, hasAdapterDesc: (id) => boolean }
 */
export function validateCapabilityMatrix(matrixImpls, ctx) {
  const { capabilityIds, hasAdapterDesc } = ctx;
  const errors = [];
  const warnings = [];
  const err = (m, descriptor) => errors.push({ message: m, descriptor });
  const warn = (m, descriptor) => warnings.push({ message: m, descriptor });
  const impls = Array.isArray(matrixImpls) ? matrixImpls : [];
  if (!impls.length) err('capabilityMatrix.json has no registered capability adapters — the default provider needs at least one impl row');
  // Unique adapter ids (dup rows would silently double-tier a capability).
  const seenIds = new Set();
  for (const impl of impls) {
    if (!impl.id) continue;
    if (seenIds.has(impl.id)) err(`Duplicate id "${impl.id}" in capabilityMatrix.json adapter table (impls)`);
    seenIds.add(impl.id);
  }
  let nativeImplCount = 0;
  for (const impl of impls) {
    for (const f of ['id', 'label', 'summary', 'tiers']) {
      if (impl[f] === undefined || impl[f] === null || impl[f] === '')
        err(`Registered capability adapter "${impl.id || '<no id>'}" missing required field "${f}"`,
          dMissingField('CapabilityAdapter', impl.id, FILE.CapabilityAdapter, f));
    }
    // `native` (the native-first tiebreak marker, #205) is optional but, when present, a boolean.
    if (impl.native !== undefined && typeof impl.native !== 'boolean')
      err(`Capability adapter "${impl.id}" native must be a boolean (the native-first substrate marker)`);
    if (impl.native === true) nativeImplCount++;
    // `kind` selects the tier vocabulary: `native` (default) → substrate states; `library` → coverage states.
    const kind = impl.kind ?? 'native';
    if (kind !== 'native' && kind !== 'library')
      err(`Capability adapter "${impl.id}" kind must be "native" or "library" (got "${impl.kind}")`);
    const validStates = kind === 'library' ? LIBRARY_TIER_STATES : TIER_STATES;
    const tiers = impl.tiers && typeof impl.tiers === 'object' ? impl.tiers : {};
    // Every tier value must be one of the kind's states, and key a known capability id (no stray rows).
    for (const [capId, tier] of Object.entries(tiers)) {
      if (!capabilityIds.has(capId))
        err(`Capability adapter "${impl.id}" tiers unknown capability "${capId}" — not in capabilities.json`,
          dUnresolvedRef('CapabilityAdapter', impl.id, FILE.CapabilityAdapter, 'tiers', capId, 'capabilities.json'));
      if (!validStates.has(tier))
        err(`Capability adapter "${impl.id}" (kind ${kind}) capability "${capId}" has invalid tier "${tier}" (expected ${[...validStates].join(' / ')})`);
    }
    // The build-matrix is a complete grid: tier() must be total, so every row tiers every capability.
    for (const capId of capabilityIds)
      if (!(capId in tiers))
        err(`Capability adapter "${impl.id}" is missing a tier for capability "${capId}" — the registered row must tier every capability (the matrix is a complete impl × capability grid)`);
    // Each registered adapter gets a detail page (capability-adapter-pages.njk) backed by a prose
    // partial — the column-detail discovery surface (#216), mirroring adapter-descriptions/{id}.njk.
    if (impl.id && !hasAdapterDesc(impl.id))
      err(`Capability adapter "${impl.id}" has no src/_includes/capability-adapter-descriptions/${impl.id}.njk`,
        dMissingDescription('CapabilityAdapter', impl.id, `src/_includes/capability-adapter-descriptions/${impl.id}.njk`));
  }
  // The native-first tiebreak needs an unambiguous substrate: at most one impl may be marked native.
  if (nativeImplCount > 1)
    err(`capabilityMatrix.json registers ${nativeImplCount} native adapters — the native-first tiebreak needs a single native substrate`);
  // Zero native is legal but means native-first can never win a lightness tie on the bundled table.
  if (impls.length && nativeImplCount === 0)
    warn('capabilityMatrix.json registers no native adapter — native-first has no substrate to prefer on a tie');
  return { errors, warnings };
}

// Strip the leading `YYYY-MM-DD-` date and the `.md` suffix from a report filename to get its slug
// (the id a /research/ topic would carry). Exported for the reports-not-hidden test fixtures.
export const deDateReport = (f) => f.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.md$/, '');

/**
 * Reports-not-hidden (§6e): reports/ is NOT in the 11ty build, so a report is reachable only when a
 * /research/ topic (id = its de-dated slug) or a backlog item (relatedReport) references it. A report
 * that is neither is invisible — fail.
 *
 * Pure: the fs walk stays in the script; the file list + the two reference sets are injected.
 * @param ctx { researchIds: Set, backlogReportRefs: Set } — refs are filenames with the `reports/`
 *              prefix stripped (matching how the script normalises relatedReport).
 */
export function validateReportsNotHidden(reportFiles, ctx) {
  const { researchIds, backlogReportRefs } = ctx;
  const errors = [];
  for (const f of reportFiles) {
    const slug = deDateReport(f);
    if (!researchIds.has(slug) && !backlogReportRefs.has(f))
      errors.push({ message:
        `Report "reports/${f}" is hidden — no /research/ topic (id "${slug}") and no /backlog/ item ` +
        `references it (relatedReport). Promote it to a research topic or add a backlog item.` });
  }
  return { errors, warnings: [] };
}

/**
 * Compiled-artifact shadow (§8): a `.js`/`.d.ts` emitted next to its `.ts`/`.tsx` source silently
 * shadows it in vitest (extensionless imports resolve `.js` BEFORE `.tsx`). Fail on any such pair.
 *
 * Pure: takes a flat list of file paths (the fs walk stays in the script) and returns one error per
 * shadowing artifact. `rel(path)` formats the display path (default: identity).
 */
export function findCompiledShadows(fileList, rel = (f) => f) {
  const errors = [];
  const fileSet = new Set(fileList);
  for (const f of fileList) {
    const base = f.endsWith('.d.ts') ? f.slice(0, -5) : f.endsWith('.js') ? f.slice(0, -3) : null;
    if (!base) continue;
    if (fileSet.has(`${base}.ts`) || fileSet.has(`${base}.tsx`))
      errors.push({ message:
        `Compiled artifact "${rel(f)}" shadows its TS source — delete it. ` +
        `Stale .js/.d.ts next to .ts/.tsx silently override the source in vitest (.js resolves first).` });
  }
  return { errors, warnings: [] };
}

// Escape a string for literal use inside a RegExp (the proxy-coverage probe builds a regex per segment).
export const escapeRegExp = (s) => s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');

/**
 * Is a top-level catalog segment covered by the Vite proxy allowlist? (§9, #210.) A segment is
 * "covered" when it appears in the proxy-key blob bounded by a path/alternation delimiter — so `js`
 * matches `|js)` but the `js` inside `project-lifecycle` does not. This bounded-match regex is the
 * gnarly bit a silent false-positive/negative most likely hides in, so it's factored for fixtures.
 */
export function isSegmentCovered(seg, proxyKeys) {
  return new RegExp(`(?:^|[\\/|(])${escapeRegExp(seg)}(?:[\\/|)\\\\$]|$)`).test(proxyKeys);
}

/**
 * Derive a catalog njk's top-level URL segment from its body — its `permalink:` front-matter, else
 * the 11ty default `/<name>/`. Returns null for the root or a fully-templated first segment (neither
 * maps to a fixed proxy route).
 */
export function permalinkSegment(njkBody, filename) {
  const m = njkBody.match(/^\s*permalink:\s*["']?([^"'\n]+)/m);
  const permalink = m ? m[1].trim() : `/${filename.replace(/\.njk$/, '')}/`;
  const seg = permalink.replace(/^\//, '').split('/')[0];
  if (!seg || seg.includes('{')) return null;
  return seg;
}

/**
 * Vite dev-proxy allowlist coverage (§9): every catalog route that renders on 11ty :8080 must be
 * forwarded by the Vite proxy, or it 404s on :3000. Pure: takes the parsed `{ seg, file }` segments
 * (via permalinkSegment) + the proxy-key blob and reports each uncovered segment.
 */
export function validateViteProxyCoverage(segments, proxyKeys) {
  const errors = [];
  for (const { seg, file } of segments)
    if (!isSegmentCovered(seg, proxyKeys))
      errors.push({ message:
        `Vite proxy is missing catalog route "/${seg}/" (from src/${file}) — it renders on 11ty :8080 ` +
        `but 404s on the Vite dev server :3000. Add "${seg}" to the proxy allowlist alternation in vite.config.mts.` });
  return { errors, warnings: [] };
}

// ── Module-resolution exports-lock (#274, materialising #271) ──────────────────────────────────────
// The module-resolution axis lets a project resolve a bare specifier however its toolchain does
// (node_modules+exports, importmap, CDN URL, dev alias) — but with ONE lock: an `@frontierui/*` entry
// in any of those native manifests must terminate at the PACKAGE's `exports`, never at WE/foreign
// source or a raw in-repo path. "protocol is the only lock." This is the lint half of #274's three
// deliverables (the model + reference page are the other two); the resolution itself is native, no
// runtime code.

/** The published-impl scope whose entries are locked to package-exports resolution (#239/#271). */
export const MODULE_RESOLUTION_LOCKED_SCOPE = '@frontierui/';

/**
 * Is an importmap/alias `target` a legitimate package-exports terminus (vs a raw source path)? OK:
 * an http(s) URL (CDN/served), a `node_modules` path, or a bare specifier (no leading `/`, `.` — node
 * resolves it via `exports`). NOT OK: a raw in-repo/foreign source path — a leading `/` that is not a
 * URL (e.g. `/plugs/...`), a relative `./`/`../` path, or any path reaching into a `/src/` tree.
 */
export function isExportsSafeTarget(target) {
  if (typeof target !== 'string' || target.trim() === '') return false;
  if (/^https?:\/\//.test(target)) return true; // URL override
  if (/(^|\/)node_modules\//.test(target)) return true; // resolved package path
  if (target.startsWith('/') || target.startsWith('./') || target.startsWith('../')) return false; // raw path
  if (target.includes('/src/')) return false; // foreign/WE source tree
  return true; // bare specifier → node-resolution via exports
}

/**
 * Module-resolution exports-lock: every locked-scope (`@frontierui/*`) importmap/alias entry must
 * resolve to the package's exports (URL, node_modules, or bare specifier), never a raw WE/foreign
 * source path. Pure: takes the gathered `{ specifier, target, source }` entries and reports each
 * violation. Vacuously passes when no locked entry exists (the common case until a project repoints).
 */
export function validateModuleResolutionLock(entries) {
  const errors = [];
  for (const { specifier, target, source } of entries) {
    if (!specifier.startsWith(MODULE_RESOLUTION_LOCKED_SCOPE)) continue;
    if (!isExportsSafeTarget(target))
      errors.push({ message:
        `Module-resolution lock: "${specifier}" → "${target}"${source ? ` (in ${source})` : ''} resolves to a ` +
        `raw source path, not the package exports. An ${MODULE_RESOLUTION_LOCKED_SCOPE}* entry must terminate at ` +
        `the published package (a bare specifier, a node_modules path, or an http(s) URL) — never WE/foreign ` +
        `source. See the module-resolution reference (#271/#274).` });
  }
  return { errors, warnings: [] };
}

// ── Codegen-placement invariants (#964, hardening #956's ruling) ─────────────
// #956 ratified: the `serve()` form-generators stay in the WE repo as reference runtime (#791), but
// `@webeverything` publishes only the contract + conformance vectors — never the lowering code (#855).
// Both load-bearing invariants were true-by-absence; #964 makes them enforced.

export const RENDERERS_PUBLISH_ENFORCED = true; // #964: renderers never enter a published @webeverything exports map
/** The published WE scope (`npm scope mirrors layer`, #239): standard artifacts only — never impl/renderers. */
export const WEBEVERYTHING_PUBLISHED_SCOPE = '@webeverything/';

/** Flatten an `exports` map (string | nested conditions/subpaths) to its leaf target strings. */
export function flattenExportsTargets(exports) {
  const out = [];
  const walk = (node) => {
    if (typeof node === 'string') out.push(node);
    else if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === 'object') Object.values(node).forEach(walk);
  };
  walk(exports);
  return out;
}

/**
 * Invariant 1 (#956/#855): no `@webeverything/*` published package may re-export the reference-runtime
 * renderers. The form-generators (`blocks/renderers/*`) are repo-internal reference runtime (#791); a
 * published `exports` target that reaches into `blocks/renderers/` would ship the lowering code as a de
 * facto standard — exactly what #855 forbids. Pure: takes the gathered `{ name, exports, source }`
 * manifests; vacuously passes when no `@webeverything/*` manifest exists (true today — root pkg is the
 * unscoped `web-everything` with no exports map).
 */
export function validateRenderersNotPublished(manifests) {
  if (!RENDERERS_PUBLISH_ENFORCED) return { errors: [], warnings: [] };
  const errors = [];
  for (const { name, exports, source } of manifests) {
    if (typeof name !== 'string' || !name.startsWith(WEBEVERYTHING_PUBLISHED_SCOPE)) continue;
    for (const target of flattenExportsTargets(exports)) {
      if (/(^|\/)blocks\/renderers\//.test(String(target).replace(/^\.\//, '')))
        errors.push({ message:
          `Published-renderer leak: ${name} (${source}) has an exports target "${target}" reaching ` +
          `blocks/renderers/. The form-generators are WE-repo reference runtime (#791) — @webeverything ` +
          `publishes only the contract + conformance vectors, never the lowering code (#855/#956). ` +
          `Drop the renderer from the published exports map.` });
    }
  }
  return { errors, warnings: [] };
}

export const REFERENCE_RUNTIME_FORMS_ENFORCED = true; // #964: WE-side serve() form catalog is frozen to the ratified reference-runtime set
/**
 * The form ids WE's reference runtime emits in-repo (#956's principled refinement). These five are the
 * forms a `<component>` definition is *already* lowered to by WE-side code — they stay WE (#791). A
 * genuinely-new framework target (Vue/Svelte/Angular SFC, …) has NO WE reference runtime, so its
 * generator must follow the #855/genWrapper pattern (contract+vectors in WE, generator in FUI) and must
 * NOT be slipped into the WE-side `serve()` switch — the catalog's openness lives in the *adapter* layer
 * (#663), not the reference runtime.
 */
export const REFERENCE_RUNTIME_FORMS = new Set(['declarative', 'wc-class', 'html', 'jsx', 'functional']);

/**
 * Invariant 2 (#956 per-form refinement → gate): the WE-side `serve()` form catalog (the `FORMS` ids /
 * `ServeForm` union in `module-service/moduleService.ts`) must be a subset of the ratified
 * reference-runtime set. A new id beyond it manufactures a WE-side codegen path for a framework target
 * that should go through FUI — closing the "a demo ships a consumer to keep codegen in WE" escape #956's
 * skeptic flagged. Pure: takes the gathered form ids; the fs parse lives in the gate.
 */
export function validateReferenceRuntimeForms(formIds) {
  if (!REFERENCE_RUNTIME_FORMS_ENFORCED) return { errors: [], warnings: [] };
  const errors = [];
  for (const id of formIds) {
    if (!REFERENCE_RUNTIME_FORMS.has(id))
      errors.push({ message:
        `New WE-side serve() form "${id}": the reference-runtime form catalog is frozen to ` +
        `{${[...REFERENCE_RUNTIME_FORMS].join(', ')}} (#956). A genuinely-new framework target has no WE ` +
        `reference runtime — its generator must follow the #855/genWrapper pattern (contract+vectors in ` +
        `WE, generator in FUI), not a WE-side serve() case. The form catalog's openness lives in the ` +
        `adapter layer (#663), never the WE renderer.` });
  }
  return { errors, warnings: [] };
}

// ── Research freshness derivation (#441 Fork 4 / #477) ───────────────────────
// The derivation lives in a CommonJS module (scripts/lib/research-freshness.cjs) so the sync-only
// Eleventy 2.x config can `require` it for the reader freshness badge; here we re-export its named
// bindings so the warn-only check:standards rule shares the *exact* same logic — one source of
// truth, two module systems.
export { RESEARCH_REVIEW_HORIZON_DEFAULT, addIsoDuration, deriveResearchFreshness } from './lib/research-freshness.cjs';

// ── Benchmark capability-presence join table (#352) ──────────────────────────
/**
 * Validate the capability×source presence join table (`benchmarkCapabilityPresence.json`, #352): every
 * row must reference a known capability id and a known corpus source id, `present` must be a boolean,
 * and `provenance` one of the declared kinds. A `verified` row without a `url` warns (the deep doc link
 * is the point of verifying); a `notable-inference` row legitimately has none yet. Pure: takes the rows
 * + the id sets the script gathers from the sibling registries.
 */
export function validateCapabilityPresence(presence, { capabilityIds, sourceIds, provenanceKinds }) {
  const errors = [];
  const warnings = [];
  const rows = Array.isArray(presence?.rows) ? presence.rows : [];
  const kinds = new Set(provenanceKinds ?? ['notable-inference', 'verified']);
  const seen = new Set();
  for (const r of rows) {
    const key = `${r.capabilityId}${r.sourceId}`;
    if (seen.has(key)) errors.push({ message: `capability-presence: duplicate row for (${r.capabilityId}, ${r.sourceId})` });
    seen.add(key);
    if (!capabilityIds.has(r.capabilityId))
      errors.push({ message: `capability-presence: row references unknown capability "${r.capabilityId}" (not in benchmarkCapabilities)` });
    if (!sourceIds.has(r.sourceId))
      errors.push({ message: `capability-presence: row references unknown corpus source "${r.sourceId}" (not in benchmarkCorpus)` });
    if (typeof r.present !== 'boolean')
      errors.push({ message: `capability-presence: row (${r.capabilityId}, ${r.sourceId}) "present" must be a boolean` });
    if (!kinds.has(r.provenance))
      errors.push({ message: `capability-presence: row (${r.capabilityId}, ${r.sourceId}) has unknown provenance "${r.provenance}"` });
    if (r.provenance === 'verified' && !r.url)
      warnings.push({ message: `capability-presence: verified row (${r.capabilityId}, ${r.sourceId}) has no deep doc url — the URL is the point of verifying (#352)` });
  }
  return { errors, warnings };
}

// ── General reference-retirement convention (#584) ───────────────────────────
const RETIREMENT_ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
/**
 * Shared validator for the general reference-retirement convention (#584 ruling): ONE uniform
 * field-set applied to every structured reference home (corpus sources, `references.json` links,
 * `designSystemResearch` refs, capability-presence rows) — the homes differ in container, not in the
 * retirement concept, so the shape reads identically everywhere. Two orthogonal, independently-optional
 * markers (Fork 3-A — death and supersession are distinct facts a single enum can't both hold):
 *   • the #546 death triplet — `retired:true` + `retiredDate` (ISO) + `retiredReason` (keep-not-delete);
 *   • the #192 supersession pointer — `supersededBy` ("a newer canonical replaces this").
 * Pure: takes one entry object + a `label` and an optional `resolveSupersededBy(target)` predicate
 * (supplied only by homes with an id space, e.g. the corpus, where the pointer is a sibling id).
 * Vacuously passes when an entry carries no retirement markers — the common, most-permissive case
 * (the metadata is always opt-in, never required). See docs/agent/reference-retirement.md.
 */
export function validateRetirementShape(entry, { label = 'entry', resolveSupersededBy } = {}) {
  const errors = [];
  const warnings = [];
  if (!entry || typeof entry !== 'object') return { errors, warnings };
  const present = (k) => entry[k] != null && entry[k] !== '';
  // Death triplet — all-or-nothing: retired:true requires a reason + ISO date; neither field stands alone.
  if ('retired' in entry && typeof entry.retired !== 'boolean')
    errors.push({ message: `${label}: "retired" must be a boolean (#584)` });
  if (entry.retired === true) {
    if (!present('retiredReason'))
      errors.push({ message: `${label}: retired:true requires a retiredReason — keep-not-delete: record why it left (#584)` });
    if (!present('retiredDate'))
      errors.push({ message: `${label}: retired:true requires a retiredDate (#584)` });
    else if (!RETIREMENT_ISO_DATE.test(entry.retiredDate))
      errors.push({ message: `${label}: retiredDate must be an ISO date (YYYY-MM-DD), got "${entry.retiredDate}" (#584)` });
  } else if (present('retiredDate') || present('retiredReason')) {
    errors.push({ message: `${label}: retiredDate/retiredReason present without retired:true — the death triplet is all-or-nothing (#584)` });
  }
  // Supersession pointer — orthogonal to death; resolved only where the home has an id space.
  if (present('supersededBy') && typeof resolveSupersededBy === 'function') {
    const targets = Array.isArray(entry.supersededBy) ? entry.supersededBy : [entry.supersededBy];
    for (const t of targets)
      if (!resolveSupersededBy(t))
        errors.push({ message: `${label}: supersededBy "${t}" does not resolve to a known entry (#584)` });
  }
  return { errors, warnings };
}

// ── Plug dual-mode conformance (#636, enforcing the #606 invariants) ───────────
// #606 ruled: every plug ships passing automated tests for BOTH the unplugged
// (non-invasive) and plugged modes, and NO plug may require plugged mode — the
// unplugged form is mandatory and is the real-app surface; plugged is POC/demo.
// A passing *unplugged-mode* test is the automated proof a plug doesn't require
// plugged mode, so the dual-mode test coverage IS the enforcement mechanism.
//
// This rule is pure: `domains` is the pre-collected metadata (the fs walk lives in
// check-standards.mjs). Each domain = { name, hasSource, hasPluggedTest, hasUnpluggedTest }.
//
// Staging (per #636, "defines the test shape the backfill fills"): the #635 audit
// found all 10 domains have an unplugged FORM but only webbehaviors has an
// unplugged-mode TEST. The #649 backfill fills the rest. So the unplugged-mode
// requirement is a WARN until that backfill lands, then it promotes to ERROR
// (flip PLUG_UNPLUGGED_TEST_ENFORCED to true) so "missing either mode's tests"
// fully fails the gate. The plugged-mode + no-untested-plug invariants are ERROR now.
export const PLUG_UNPLUGGED_TEST_ENFORCED = true;

export function validatePlugDualMode(domains) {
  const errors = [];
  const warnings = [];
  for (const d of domains) {
    if (!d.hasSource) continue; // not a plug domain (no implementation files)
    // ERROR — a plug with no plugged-mode test (the global-patched / real-DOM path).
    if (!d.hasPluggedTest)
      errors.push({
        message: `Plug domain "${d.name}" ships no plugged-mode test — every plug needs passing tests for BOTH modes (#606/#636).`,
      });
    // The unplugged-mode test is the proof the plug does not REQUIRE plugged mode.
    if (!d.hasUnpluggedTest) {
      const msg = `Plug domain "${d.name}" ships no unplugged-mode (non-invasive) test — a plug may not require plugged mode; the unplugged form is mandatory (#606). #649 backfill target.`;
      if (PLUG_UNPLUGGED_TEST_ENFORCED) errors.push({ message: msg });
      else warnings.push({ message: msg });
    }
  }
  return { errors, warnings };
}

// ── Repo-locus prefix detection (#884, enforces the #883 convention; #880 slice B) ──
// Every code-path reference in backlog/*.md + reports/*.md must carry a `<repo>:` locus marker
// (`we:`/`fui:`/`plateau:` or the full name) so its constellation repo is unambiguous in chat / raw
// markdown (the convention codified in conventions.md by #883). This scans for path-like tokens that
// LACK a marker. Carve-outs (per #880): fenced code blocks, markdown-link targets (the link *text*
// carries the locus — `[we:path](path)`), `@scope/pkg` npm specifiers, URLs, and the WE-relative
// frontmatter fields (`relatedReport`/`graduatedTo`/`crossRef`). WARN-level until the #885 corpus
// migration, then it flips to ERROR (flip REPO_LOCUS_PREFIX_ENFORCED). Pure: docs read by the caller.
export const REPO_LOCUS_PREFIX_ENFORCED = true;

// Longer/prefix-conflicting extensions first + a no-trailing-letter guard so `blocks.json` matches
// `json` (not `js` + leftover `on`).
const PATHLIKE_RE = /[\w./-]+\.(?:tsx|ts|json|mjs|cjs|js|md|njk|css|html|yaml|yml)(?![a-z])(?::\d+(?:-\d+)?)?/g;
const LOCUS_MARKER_RE = /(?:we|fui|plateau|webeverything|frontierui|plateau-app):$/;
const EXEMPT_FIELD_RE = /^\s*(?:relatedReport|graduatedTo|crossRef|codifiedIn)\s*:/;
// #885 false-positive carve-outs (these are NOT repo code-path references): JS-ecosystem product
// names (`Node.js`/`Next.js`/`Three.js` — a single Capitalized word + `.js`) and bare type-suffix
// fragments (`.d.ts`/`.spec.ts` — an extension chain with no name segment). Glob masks (`*.test.ts`)
// are caught separately by a `*` immediately before the token.
const PRODUCT_JS_RE = /^[A-Z][a-z]+\.js$/;
const TYPE_FRAGMENT_RE = /^\.(?:d|test|spec|stories|sw\.spec)\.[a-z]+$/;

/**
 * Scan docs (`[{ file, content }]`) for code-path tokens lacking a `<repo>:` locus marker. Returns
 * per-file findings `[{ file, count, sample }]` (pure). Strips fenced code blocks first; applies the
 * #880 carve-outs per token. Inline backtick code is NOT exempt — a path in backticks still needs the
 * prefix (`` `we:scripts/x.ts` ``).
 */
export function scanRepoLocusPrefixes(docs) {
  const findings = [];
  for (const { file, content } of docs) {
    const noFenced = content.replace(/```[\s\S]*?```/g, '');
    const unmarked = [];
    for (const line of noFenced.split('\n')) {
      if (EXEMPT_FIELD_RE.test(line)) continue;
      for (const m of line.matchAll(PATHLIKE_RE)) {
        const before = line.slice(0, m.index);
        if (LOCUS_MARKER_RE.test(before)) continue;        // already marked (we:/fui:/… or full name)
        if (/\]\($/.test(before)) continue;                // markdown link target — text carries the locus
        if (/@$/.test(before)) continue;                   // @scope/pkg npm specifier (scope sits in the token)
        if (/https?:\/*$/.test(before)) continue;          // URL (the `//…` is consumed into the token)
        if (/\*$/.test(before)) continue;                  // glob mask (`*.test.ts`) — a file-type pattern, not a path
        if (PRODUCT_JS_RE.test(m[0])) continue;            // JS-ecosystem product name (`Node.js`), not a repo file
        if (TYPE_FRAGMENT_RE.test(m[0])) continue;         // bare type-suffix fragment (`.d.ts`), not a path
        unmarked.push(m[0]);
      }
    }
    if (unmarked.length) findings.push({ file, count: unmarked.length, sample: unmarked[0] });
  }
  return findings;
}

// ── Block contract↔impl drift conformance (#659 — the #606/#641 plugs analogue for blocks) ──
// #641 ruled WE blocks are pure *protocols*; the impl lives in FUI (`implementedBy:
// @frontierui/blocks/…`). Unlike the plug runtime, WE holds NO block-impl copy post-#641
// (`sourcePath` is gone), so the #170 drift hazard for blocks is not byte-divergence but a
// *contract pointing at an impl that has moved or does not exist*. This gate is cross-repo and
// detect-or-skip (the `devServerProbe` pattern, mirroring 8b's "skip when plugs/ isn't checked
// out"): when FUI is present every `implementedBy` must resolve to a real impl path; when FUI is
// absent (CI without the sibling repo) the content arm is SKIPPED, never failed.
//
// Staging (mirroring the #636 warn→enforce shape): a contract may legitimately point *ahead* of an
// impl FUI hasn't built yet, so a missing impl is a WARN until the FUI block-impl backfill closes
// the gaps (#659 found 10 such gaps at authoring time), then it promotes to ERROR (flip
// BLOCK_IMPL_DRIFT_ENFORCED) so a moved/deleted impl hard-fails. The fs walk lives in
// check-standards.mjs; this rule is pure.
//
// `blocks` = [{ id, implementedBy, implPresent }] — implPresent is true/false when FUI was walked,
// or null when FUI is absent (→ skip that block). Returns { errors, warnings, skipped, checked }.
export const BLOCK_IMPL_DRIFT_ENFORCED = true; // #926: all 10 FUI block impls (#916–#925) landed (batch-2026-06-18); a moved/deleted impl now hard-fails

export function validateBlockImplConformance(blocks) {
  const errors = [];
  const warnings = [];
  let skipped = 0;
  let checked = 0;
  for (const b of blocks) {
    if (!b.implementedBy) continue; // no impl pointer — form is gated elsewhere (#641)
    if (b.implPresent === null || b.implPresent === undefined) {
      skipped++; // FUI absent — the cross-repo content arm can't run here
      continue;
    }
    checked++;
    if (b.implPresent === false) {
      const msg = `Block "${b.id}" implementedBy points at an impl that does not resolve in ../frontierui — ${b.implementedBy} (block contract↔impl drift, #170/#659). Build the FUI impl or correct the reference.`;
      if (BLOCK_IMPL_DRIFT_ENFORCED) errors.push({ message: msg });
      else warnings.push({ message: msg });
    }
  }
  return { errors, warnings, skipped, checked };
}

// ── validatePlugWeFuiDrift — plug contract↔impl drift conformance (#1309, the §8c/#659 plugs analogue) ──
// WE owns the plug platform layer; FUI ports each plug domain UP to the WE contract (the #1250 reconcile
// epic + its per-domain slices #1297–#1308/#1350/#1354). This is the regression guard so a reconciled
// domain can't silently re-drift — the plugs edition of #170/#659. Two arms, both cross-repo and
// detect-or-skip when ../frontierui is absent (mirrors validateBlockImplConformance's null→skip):
//   (1) DOMAIN PRESENCE — every we:plugs/<domain> must have a matching fui:plugs/<domain> impl dir;
//   (2) SHARED-CORE BYTE PARITY — the plug-core contract files declared byte-identical across both repos
//       (PLUG_SHARED_CORE_FILES, per #1304/#1350) must match FUI byte-for-byte.
// Enforced from landing: #1309 lands AFTER the reconciliation slices, so both arms are green.
//
// `domains` = [{ domain, implPresent }] — implPresent true/false when FUI was walked, null when FUI is
// absent (→ skip). `parityFiles` = [{ file, identical }] — identical true/false when both copies were
// read, null when FUI is absent or the file is WE-only (→ skip). Returns { errors, warnings, skipped, checked }.
export const PLUG_DRIFT_ENFORCED = true; // #1309: lands after the #1250 reconciliation slices, so green; a re-drift now hard-fails

// The plug-core files contractually required to be byte-identical across WE and FUI (#1304/#1350). NOT
// the whole core/ — `plugs/core/CustomRegistry.ts` carries the #1350-governed lifecycle divergence, and
// `plugs/index.ts` / `plugs/bootstrap.ts` are per-repo domain-registration wiring; all three legitimately
// differ, so gating them would false-positive. This curated list is exactly the shared contract substrate.
export const PLUG_SHARED_CORE_FILES = [
  'plugs/core/Plug.ts',
  'plugs/core/HTMLRegistry.ts',
  'plugs/unplugged.ts',
];

export function validatePlugWeFuiDrift({ domains = [], parityFiles = [] } = {}) {
  const errors = [];
  const warnings = [];
  let skipped = 0;
  let checked = 0;
  for (const d of domains) {
    if (d.implPresent === null || d.implPresent === undefined) { skipped++; continue; }
    checked++;
    if (d.implPresent === false) {
      const msg = `WE plug domain "we:plugs/${d.domain}" has no matching fui:plugs/${d.domain} impl in ../frontierui (plug contract↔impl drift, #170/#1309). Port the domain to FUI or retire the WE contract.`;
      (PLUG_DRIFT_ENFORCED ? errors : warnings).push({ message: msg });
    }
  }
  for (const p of parityFiles) {
    if (p.identical === null || p.identical === undefined) { skipped++; continue; }
    checked++;
    if (p.identical === false) {
      const msg = `Shared plug-core contract file "${p.file}" has drifted between WE and FUI — it must be byte-identical (#1304/#1350; plug contract↔impl drift, #170/#1309). Re-converge the two copies.`;
      (PLUG_DRIFT_ENFORCED ? errors : warnings).push({ message: msg });
    }
  }
  return { errors, warnings, skipped, checked };
}

// ── validateBlockComposesTraits — compose-don't-hand-roll deny-list (#937, Fork 1 of #933) ──
// Sibling of validateBlockImplConformance (same cross-repo, source-null→skip precedent). Where the
// #936 §3b resolution arm asserts a block's *declared* `composesBehaviors` resolve, THIS arm catches
// the inverse: a block that hand-rolls behaviour it should have COMPOSED. It is a *curated* deny-list,
// NOT an open `addEventListener` sniff (that framing was rejected on #933): each rule names the block
// ids it applies to, so it can never false-positive on an unrelated block (e.g. the behaviour's own
// provider impl, which hand-rolls the choreography by design). A block silences a rule the intended
// way — by actually composing the named behaviour (declaring it in `composesBehaviors`), which is the
// migration #944/#934 perform. Warn-first until the list is curated + false-positive-free, then flip
// COMPOSE_TRAITS_ENFORCED (the #840/#844/#477 warn→ERROR precedent). Static (source regex), not
// rendered/axe — it reads the impl source, never the computed DOM.
export const COMPOSE_TRAITS_ENFORCED = false; // #937: warn-first; flip once the deny-list is curated + false-positive-free

// Seed rules. `signature` = every regex must match the block's concatenated impl source for the rule to
// fire (an AND, to keep the match specific). `appliesTo` = the curated block-id allow-list it scans.
export const COMPOSE_DENY_LIST = [
  {
    id: 'disclosure-aria-expanded',
    requires: 'nav:section',
    appliesTo: ['disclosure-nav', 'sectioned-nav'],
    signature: [/aria-expanded/, /addEventListener\(\s*['"`](?:click|keydown)['"`]/],
    why: 'hand-wires click/keydown on an aria-expanded head — that disclosure choreography is exactly what the nav:section behavior provides',
  },
  {
    id: 'roving-tabindex',
    requires: 'nav:list',
    appliesTo: [], // seeded rule; no curated target yet — adding one is a one-line edit
    signature: [/tabindex/i, /Arrow(?:Up|Down|Left|Right)/],
    why: 'hand-wires roving tabindex + arrow-key movement — that is what the nav:list behavior provides',
  },
];

// `blocks` = [{ id, composesBehaviors, source }] — `source` is the block's concatenated FUI impl source,
// or null/undefined when ../frontierui isn't checked out (→ skip, mirrors validateBlockImplConformance).
// Returns { errors, warnings, skipped, checked }.
export function validateBlockComposesTraits(blocks) {
  const errors = [];
  const warnings = [];
  let skipped = 0;
  let checked = 0;
  const rulesByBlock = new Map();
  for (const r of COMPOSE_DENY_LIST)
    for (const id of r.appliesTo) {
      if (!rulesByBlock.has(id)) rulesByBlock.set(id, []);
      rulesByBlock.get(id).push(r);
    }
  for (const b of blocks) {
    const rules = rulesByBlock.get(b.id);
    if (!rules) continue; // not a curated target — never sniffed
    if (b.source === null || b.source === undefined) { skipped++; continue; } // FUI absent
    checked++;
    const composed = new Set((b.composesBehaviors || []).map((e) => (typeof e === 'string' ? e : e && e.name)));
    for (const r of rules) {
      if (composed.has(r.requires)) continue; // already composes it — migrated, no finding
      if (r.signature.every((re) => re.test(b.source))) {
        const msg = `Block "${b.id}" ${r.why}, but does not compose "${r.requires}" (compose-don't-hand-roll, #933/#937). Declare composesBehaviors: ["${r.requires}"] and delegate to the behavior.`;
        if (COMPOSE_TRAITS_ENFORCED) errors.push({ message: msg, descriptor: dUnresolvedRef('Block', b.id, blockSpecFile(b.id), 'composesBehaviors', r.id, r.requires) });
        else warnings.push({ message: msg, descriptor: dUnresolvedRef('Block', b.id, blockSpecFile(b.id), 'composesBehaviors', r.id, r.requires) });
      }
    }
  }
  return { errors, warnings, skipped, checked };
}

// ── Block export-shape drift conformance (#927, the deeper #170 arm #659 deferred) ──
// #659 shipped impl-EXISTENCE only (validateBlockImplConformance: does the implementedBy path resolve?).
// This second arm goes deeper: does the impl actually EXPORT the surface the contract DECLARES? It compares
// each barrel block's declared `exports` (`we:src/_data/blocks/<id>.json`) against the RESOLVED actual
// exports of its FUI barrel — gathered by a real TS program (not regex) so `export type *` and
// `@webeverything/contracts/…` package re-exports are followed (a regex can't; that's why resource-loader /
// type-ahead, which re-export contract types, would false-fail a textual scan).
//
// Warn-first (EXPORT_SHAPE_ENFORCED=false), mirroring the #840/#937/BLOCK_IMPL_DRIFT warn→flip precedent:
// the two embedded forks are carved to #1164 (renderer coverage) / #1165 (resolve the genuine drifts), and
// the flip waits on them. Scope is the 7 barrel blocks (implementedBy `…/index.ts` + a declared `exports`);
// renderer/file-pointer blocks have no enumerable barrel and are skipped (logged un-coverable, #1164).
// A declared export ABSENT from the resolved barrel is the drift (the impl can export MORE — extras are
// fine). Cross-repo detect-or-skip: `actualExports === null` (FUI absent / barrel unresolved) → skip.
export const EXPORT_SHAPE_ENFORCED = true; // #927: ENFORCED (#1206) — #1164 renderer coverage (#1203/#1204) + #1165/#1205 drifts landed; contract↔barrel drift is now a hard gate error

// `blocks` = [{ id, implementedBy, declaredExports: string[], actualExports: string[] | null }].
// Returns { errors, warnings, skipped, checked }.
export function validateBlockExportShape(blocks) {
  const errors = [];
  const warnings = [];
  let skipped = 0;
  let checked = 0;
  for (const b of blocks) {
    if (b.actualExports === null || b.actualExports === undefined) {
      skipped++; // FUI absent, or no enumerable barrel (#1164) — the export-shape arm can't run
      continue;
    }
    checked++;
    const actual = new Set(b.actualExports);
    const missing = (b.declaredExports || []).filter((name) => !actual.has(name));
    if (missing.length) {
      const msg = `Block "${b.id}" declares export(s) [${missing.join(', ')}] that the resolved FUI barrel (${b.implementedBy}) does not export — CEM surface ↔ impl export drift (#170/#927). Correct the contract \`exports\` or build the missing FUI surface (#1165).`;
      const d = dUnresolvedRef('Block', b.id, blockSpecFile(b.id), 'exports', missing[0], 'export-shape');
      if (EXPORT_SHAPE_ENFORCED) errors.push({ message: msg, descriptor: d });
      else warnings.push({ message: msg, descriptor: d });
    }
  }
  return { errors, warnings, skipped, checked };
}

// ── Static template a11y lint (#772, ratified #763 supported-not-decided) ──────
// The structural a11y rules a headless axe run (the #770/#771 rendered-DOM gate) CANNOT observe from the
// computed page — they live in the .njk SOURCE and must be caught at authoring time, before render. Scoped
// to the site-chrome layouts (`src/_layouts/*`) — the #762 regression locus and the only hand-authored page
// shell — so spec-content navs (block-descriptions) and in-page breadcrumbs never false-positive.
//
// Two rule classes (mirroring the #636 dual-mode warn→enforce shape):
//   • page-shell landmarks — a full-page layout (one emitting `<html`) MUST carry a `lang` attribute, a
//     `<title>`, and a `<main>` landmark. ERROR: these are structural invariants both layouts satisfy today,
//     so a regression hard-fails (the value the rendered gate can give only post-render).
//   • nav active-state wiring (the #762 class) — a `<nav>` holding a hardcoded `<a href=` link list MUST
//     wire `aria-current` so the current page is distinguishable. ENFORCED (#795): the only offending file
//     was the dead/legacy base.html (7 links, no aria-current), removed in #795; the live base.njk wires
//     aria-current, so the lane is green and this regression class now hard-fails going forward.
export const NAV_ACTIVE_STATE_ENFORCED = true;

/**
 * Static a11y lint over the site-chrome layouts. `layouts` = [{ path, content }] (the `src/_layouts/*`
 * files the script reads). Pure: returns { errors, warnings }. A nav whose links are macro-driven with a
 * conditional `aria-current` passes (the token is present in source); a hardcoded link list with none fails.
 */
export function validateTemplateA11y(layouts) {
  const errors = [];
  const warnings = [];
  for (const { path, content } of layouts) {
    const isFullPage = /<html[\s>]/i.test(content);
    if (isFullPage) {
      if (!/<html[^>]*\slang=/i.test(content))
        errors.push({ message: `Layout "${path}" emits <html> without a lang attribute (WCAG 3.1.1 html-has-lang) — set <html lang="…">.` });
      if (!/<title[\s>]/i.test(content))
        errors.push({ message: `Layout "${path}" emits <html> but has no <title> (WCAG 2.4.2 document-title) — add a <title> in <head>.` });
      if (!/<main[\s>]/i.test(content))
        errors.push({ message: `Layout "${path}" has no <main> landmark (WCAG 1.3.1 region) — wrap the page body in <main>.` });
    }
    // Nav active-state wiring (#762): only fires on a hardcoded <a href=…> list inside a <nav>.
    const hasNav = /<nav[\s>]/i.test(content);
    const hasHardcodedNavLink = /<a\s[^>]*href=/i.test(content);
    if (hasNav && hasHardcodedNavLink && !/aria-current/i.test(content)) {
      const msg = `Layout "${path}" has a <nav> with a hardcoded link list but no aria-current wiring — the current page is indistinguishable from siblings (#762, WCAG 2.4.8). Mark the active link with aria-current="page".`;
      if (NAV_ACTIVE_STATE_ENFORCED) errors.push({ message: msg });
      else warnings.push({ message: msg });
    }
  }
  return { errors, warnings };
}
