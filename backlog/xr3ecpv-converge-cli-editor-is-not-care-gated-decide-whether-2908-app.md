---
kind: decision
blockedBy: ["2908"]
status: open
dateOpened: "2026-08-08"
tags: [review, converge-loop]
---

# /converge's editor is not care-gated — decide whether #2908 applies to the lane-working-tree loop too

#2908 gates the **parked-PR** convergence loop's editor to care `low`
(`we:scripts/workflows/review-parked-prs.mjs`, per that item's declared scope). The **second** editor path —
`we:scripts/lib/converge-core.mjs` `convergeStep` returning `CONVERGE_ACTIONS.EDIT`, driven by
`we:scripts/converge-cli.mjs` for the `/converge` skill — is **not** gated, and its default care band is
`elevated`.

Surfaced while implementing #2908 (PR #1106) against the instruction to verify no path reaches an editor
without passing the gate. Deliberately left out of scope there, on two grounds worth re-testing rather than
assuming:

1. **#2908's declared scope names only the parked-PR loop and `we:scripts/lib/jury-core.mjs`.** Widening a ratified rule to a second
   mechanism during its implementation would be ratifying a design nobody prepared.
2. **The hazard is materially different.** #2908's stated ground is *"mutating someone's branch is not
   reversible from their side."* `/converge` edits the **lane the operator pointed it at**, in their own
   working tree, with the ordinary git undo available. The parked-PR loop pushes to another author's branch.

The fork: **(a)** extend the gate into `convergeStep` so both loops share one rule — consistent, but makes
`/converge --care=elevated` (its default) review-only, which substantially changes a tool in daily use;
**(b)** leave `/converge` ungated and record *why* the two loops differ, in the statute, so the asymmetry is
deliberate rather than an oversight; **(c)** gate it but move `/converge`'s default care to `low`. Note the two
bodies are already flagged `@duplicate-of` and slated to merge under **#2970** (filed as `xyihiji`) — whichever
way this goes should land before that merge, or the merge will pick an answer by accident. **That ordering is
now enforced, not merely asked for:** #2970 carries `blockedBy: ["xr3ecpv"]`, so it cannot land first and decide
this fork by default.
