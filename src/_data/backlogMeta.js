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
  childlessReasonMeta: {
    blocked: { label: 'blocked', bg: '#fef2f2', fg: '#991b1b', tip: "No child stories yet — it's waiting on the prerequisites in the Blocked-by row. The slices can't be cut until those clear." },
    undecided: { label: 'needs decisions', bg: '#fef3c7', fg: '#92400e', tip: 'No child stories yet — open design decisions determine where the slices fall. Resolve them and it splits into stories.' },
    untriaged: { label: 'needs triage', bg: '#ede9fe', fg: '#5b21b6', tip: 'No child stories yet — a holding-pen of candidates; each must be triaged (promote / fold / drop) before any become stories.' },
    program: { label: 'ongoing program', bg: '#e0f2fe', fg: '#075985', tip: 'No fixed child stories by design — a continuous program measured by progress, not a fixed set of child stories.' },
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
