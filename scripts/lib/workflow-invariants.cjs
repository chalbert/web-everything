// Workflow-intent invariants (#2084) — the CROSS-ITEM backlog rules the per-item schema validator
// (validateBacklogItem in check-standards-rules.mjs) structurally cannot see, because they need the
// whole collection (a parent's children) or a clock (a scaffold's age). docs/agent/backlog-workflow.md
// defines them; before #2084 they were split between an inline block in check-standards.mjs and a
// convention-only `check:health` candidate (O1). This is the single, unit-tested home.
//
// SCOPE — collection-level only. Per-item schema constraints (a story must be Fibonacci-sized, a task is
// never sized, a size is Fibonacci, a parent resolves) stay in validateBacklogItem: they're checkable
// from one item and already gated. Here live the rules that need siblings or a date:
//
//   1. sliced-epic sizing (backlog-workflow.md §"Strict rule — an epic is in exactly one of two states"):
//      an epic with ≥1 child of ANY kind is SLICED → must carry no `size` (scope lives on the children).
//      A SIZED child additionally double-counts its points, so that gets the sharper message.
//   2. born-active settlement (backlog-workflow.md §"Spin-offs …", #670): a `scaffold --session` item is
//      born `active` + `scaffoldedBy` with NO `dateStarted` (dateStarted is the *claim* signal). Left
//      unsettled past its creating day it's a stranded spin-off — `settle` it (→ open) or revert. Warned,
//      matching the advisory O1 health candidate this promotes into the deterministic validator.
//
// Deliberately NOT enforced (verified against real data #2084): "an unstoried epic must be sized" —
// an unsliced epic legitimately carries no `size` while awaiting slicing (it shows the `slice` CTA;
// backlog-workflow.md §"once the design is settled but the slice breakdown isn't scoped yet … that's just
// an unsliced epic"), so a size requirement would false-positive on those. "blockedBy target not parked"
// — a block on a `platform-gated` parked item is a legitimate can't-clear-yet edge, not a defect.

// today: 'YYYY-MM-DD'. Injected (not read from a clock) so the rule is pure and fixture-testable.
function validateWorkflowInvariants(items, { today } = {}) {
  const errors = [];
  const warnings = [];
  const list = Array.isArray(items) ? items.filter(Boolean) : [];

  // parent num → children[]. `parent` is stored as an NNN string (leading zeros); item.num matches.
  const childrenOf = new Map();
  for (const it of list) {
    if (it.parent === undefined || it.parent === null) continue;
    const p = String(it.parent);
    if (!childrenOf.has(p)) childrenOf.set(p, []);
    childrenOf.get(p).push(it);
  }

  // 1. Sliced-epic sizing — an epic is UNSLICED (no children → carries a `size`) or SLICED (≥1 child →
  //    no `size`, a pure umbrella). Gaining the first child of any kind flips it; the `size` must drop in
  //    that edit. A sized child double-counts (points already on the child) → sharper message.
  for (const it of list) {
    if (it.kind !== 'epic' || typeof it.size !== 'number') continue;
    const kids = childrenOf.get(it.num) || [];
    if (!kids.length) continue;
    const sized = kids.filter((k) => typeof k.size === 'number').length;
    if (sized)
      errors.push({ message:
        `Backlog item "${it.id}" is a sized epic but has ${sized} sized child item(s) — that double-counts. ` +
        `Make it storied (drop its size) or re-parent the children.` });
    else
      errors.push({ message:
        `Backlog item "${it.id}" is a sized epic but has ${kids.length} child item(s) — an epic with any ` +
        `child is SLICED and must carry no \`size\` (its scope lives on the children). Drop the epic's ` +
        `size, or detach the child if the epic is genuinely an unsliced bucket.` });
  }

  // 2. Born-active settlement TTL — an unsettled `scaffold --session` spin-off past its creating day.
  //    Predicate mirrors check:health O1: status active + scaffoldedBy + no dateStarted (never claimed).
  if (today) {
    for (const it of list) {
      if (it.status !== 'active' || !it.scaffoldedBy || it.dateStarted) continue;
      const born = typeof it.dateScaffolded === 'string' ? it.dateScaffolded.slice(0, 10) : undefined;
      if (born && born < today)
        warnings.push({ message:
          `Backlog item "${it.id}" is a born-active scaffold (owned by "${it.scaffoldedBy}" since ${born}) ` +
          `left unsettled past its creating day — a likely stranded spin-off. Publish it with ` +
          `\`node scripts/backlog.mjs settle ${it.num}\` (→ open) once its digest/edges/body are written, ` +
          `or revert it to open. (#670)` });
    }
  }

  return { errors, warnings };
}

module.exports = { validateWorkflowInvariants };
