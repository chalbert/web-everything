// backlogMeta — the single source of truth for the backlog badge VOCABULARY (colours, labels, tooltips)
// shared by every surface that renders a backlog item: the /backlog/ tile + Prioritisation table
// (src/backlog.njk) and the /backlog/{id}/ detail page (src/backlog-pages.njk). The badge MACROS that
// consume this live in src/_includes/backlog-badges.njk (imported by both templates); keeping the data
// here — not duplicated inline in each .njk — is what stops the two surfaces from drifting (the bug this
// file fixes: a `preparing`/`program` colour added to one surface but not the other). Pure data, no logic.
//
// Dogfood note: these badges map to the FUI `badge` / `filter-chip` components in the #778 inventory; the
// #777 chrome-rework will swap the macros' internals to render via those FUI components (Mode-C, #765),
// at which point this vocabulary becomes the component's props. One seam, by design.
module.exports = {
  // Why a childless epic has no child stories yet — author-supplied (`childlessReason`), since the reason
  // lives in the body, not in derivable fields. `blocked` is also shown structurally (the red Blocked-by
  // row), so its badge stays muted. `program` mirrors the `ongoing: true` epicState (continuous program).
  // NOTE: `undecided` is RETIRED — an epic never holds its open decision inline as a reason. The decision is
  // its own `kind: decision` item and the epic depends on it via `blockedBy` (childlessReason: blocked);
  // "slices not yet scoped" is the unsliced state (no childlessReason). `check:standards` errors on `undecided`.
  childlessReasonMeta: {
    blocked: { label: 'blocked', bg: '#fef2f2', fg: '#991b1b', tip: "No child stories yet — it's waiting on the prerequisites in the Blocked-by row. The slices can't be cut until those clear." },
    untriaged: { label: 'needs triage', bg: '#ede9fe', fg: '#5b21b6', tip: 'No child stories yet — a holding-pen of candidates; each must be triaged (promote / fold / drop) before any become stories.' },
    program: { label: 'ongoing program', bg: '#e0f2fe', fg: '#075985', tip: 'No fixed child stories by design — a continuous program measured by progress, not a fixed set of child stories.' },
  },
  // Why a non-epic item is `status: parked` — a machine-readable hold reason (#1392). TIGHTENED 2026-06-22
  // (parked-item sweep): parking is NOT a prioritisation escape, so the soft `deferred`/`external-infra`/
  // `superseded` reasons are retired. A park must reduce to a real structural state — a `blockedBy` edge, a
  // `humanGate`, `kind: decision` + `status: open` (decision lane), or — the only standalone `parkedReason`
  // left — `platform-gated`. `check:standards` errors on a parked item with no such reason.
  parkedReasonMeta: {
    'platform-gated': { label: 'platform-gated', bg: '#e0f2fe', fg: '#075985', tip: 'Held on a web-platform capability shipping in browsers (a native element/CSS feature not yet broadly available) — not a backlog item and not a human action. Unpark when the platform feature lands.' },
  },
  // Why an oversized story (size > 8) is NOT a /split candidate after analysis — author-supplied
  // (`unsplittableReason`), the story-side mirror of an epic's `childlessReason`. Recording it clears the
  // `splittable` flag (no orange split badge, excluded from the "Splittable only" chip) and shows this muted
  // "atomic · <label>" pill instead, naming WHY + the action that would unblock a future split. Values track
  // the /split could-not-split rubric failures (docs/agent/backlog-workflow.md → "Splitting").
  unsplittableReasonMeta: {
    // `undecided` is RETIRED here too — a buried fork that blocks splitting is its own `kind: decision`
    // item the story `blockedBy`-depends on, not an inline reason. `check:standards` errors on it.
    foundational: { label: 'foundational first', bg: '#ede9fe', fg: '#5b21b6', tip: 'Could-not-split: the reproduction/impl surface does not exist yet — a foundational slice must land first to expose the seams. This story IS that slice; re-run /split once it ships.' },
    atomic: { label: 'atomic', bg: '#f1f5f9', fg: '#475569', tip: 'Could-not-split: genuinely one coherent deliverable — no clean seam where one slice ends and the next begins. Build it as-is (just beyond the batch pool).' },
    fixture: { label: 'needs fixture', bg: '#e0f2fe', fg: '#075985', tip: 'Could-not-split: the slices can only demo independently once a shared fixture is authored up front. Author the fixture first, then re-run /split.' },
  },
  // Human-gate kinds (#1137 class) — a residual only a person can clear, so the item is demoted out of
  // Tier A like a pending project (a non-`blockedBy` hold). The pill on the Prioritisation tab + the
  // selector's held section read their label/colour/tooltip from here. `feedback` covers agent-training
  // feedback; `deploy`/`credential`/`setup` cover never-push operational residuals; `review` a human sign-off.
  humanGateMeta: {
    deploy: { label: 'human deploy', bg: '#fef2f2', fg: '#991b1b', tip: 'Held on a human deploy — a credentialed push an agent can’t run (never-push). Run the runbook from an authed session, then resolve.' },
    credential: { label: 'needs credential', bg: '#fef2f2', fg: '#991b1b', tip: 'Held on a credential/secret only a human can provision. Supply it, then the item is agent-workable (or resolves).' },
    feedback: { label: 'needs feedback', bg: '#eff6ff', fg: '#1e40af', tip: 'Held on human feedback (e.g. agent-training signal / a judgement call). Give the feedback asked for in `what`, then it proceeds.' },
    review: { label: 'needs review', bg: '#fef3c7', fg: '#92400e', tip: 'Held on a human review / sign-off. Approve (or request changes), then it proceeds.' },
    setup: { label: 'needs setup', bg: '#ede9fe', fg: '#5b21b6', tip: 'Held on a one-time human setup (external account, hosted resource). Do it once, then the item is agent-workable.' },
  },
  // Non-batchable reason pills (#487/#1137 rigor) — an open item that is NOT in the batch pool carries a
  // pill naming WHY, so "looks ready but isn't" never reads as unexplained. `human-gate` is rendered by the
  // dedicated humanGate pill, `oversized` by the split pill, `decision` by the tier-B badge — so only these
  // three need an entry here. `blocked` interpolates the open blocker list at render (so no static label).
  notBatchableMeta: {
    'stop-the-world': { label: 'migration', bg: '#fef2f2', fg: '#991b1b', tip: 'Stop-the-world migration — touches the whole backlog, so it can only run when the backlog is QUIESCENT (no active claims / reservations) in a dedicated run. Never packed into a routine batch.' },
    'project-pending': { label: 'project pending', bg: '#ede9fe', fg: '#5b21b6', tip: 'Held by D3-readiness — its relatedProject is a `concept` with no shipped surface; the standard must exist first. Ship/graduate the project, then it becomes agent-ready.' },
  },
  // Tier labels & one-line meaning — kept in one place so the chip, the card badge, and its tooltip stay in sync.
  tierLabel: { A: 'Agent-ready', B: 'Decision-ready', C: 'Not ready' },
  tierMeaning: {
    A: 'issue/idea with all prerequisites resolved — nothing structural blocks an agent starting',
    B: 'a decision awaiting a nod — ratify it, then it’s a quick build',
    C: 'needs design or is blocked — an issue/idea with an unresolved prerequisite',
  },
};
