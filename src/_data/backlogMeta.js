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
  // Tier labels & one-line meaning — kept in one place so the chip, the card badge, and its tooltip stay in sync.
  tierLabel: { A: 'Agent-ready', B: 'Decision-ready', C: 'Not ready' },
  tierMeaning: {
    A: 'issue/idea with all prerequisites resolved — nothing structural blocks an agent starting',
    B: 'a decision awaiting a nod — ratify it, then it’s a quick build',
    C: 'needs design or is blocked — an issue/idea with an unresolved prerequisite',
  },
};
