---
name: land-on-no-regression-not-perfection
description: The land bar is "no regression + no new impact + no weakened gate", NOT "no findings" — residue is filed and worked non-blocking, but a fail-open gate change or a mandatory-lens non-accept still blocks
metadata:
  type: feedback
---

# Land on no-regression, not on perfection

The bar for landing a PR is **no regression and no new impact** — not the absence of findings. An improvement
that leaves known issues **lands**; its residue is filed and built in a non-blocking follow-up.

**Why (operator ruling, 2026-08-05).** PR #1031 bounced four review rounds; its carve-out PR #1037 bounced two
more. Across those six rounds, **every finding landed in the guard, never in the fix** — the 8-line change that
unblocked the review chain was correct from round 1 and was held hostage the whole time. Worse, each round's
repair *grew* the diff (PR #1037: 241 → 407 → 472 lines), so repairing-in-place was itself the loop. Meanwhile
the parked queue did not move at all. Perfection-before-land cost more than the defects it caught.

> **Citation form.** A bare `#NNNN` in this corpus means a BACKLOG item. Pull requests are always written
> `PR #NNNN` — the two counters currently overlap in the 1000s, so a bare number silently resolves to an
> unrelated card.

## The three tests — all about the DELTA vs current `main`

1. **No regression.** Does anything that works today work *worse*? A false denial, a crash, a changed result on
   an existing path. A guard that blocks a previously-working command **is** a regression.
2. **No new impact.** Does it add a **new** way to damage something outside its scope — writing outside its own
   tree, dropping another actor's work, auto-installing something machine-global?
3. **No weakened gate.** Does it make an existing **fail-closed** check fail *open*, or widen what
   **auto-clears** a gate? Loosening `partitionAgentClearable`, letting an unverifiable label read as clearable,
   or shrinking what forces `review:human` all fail this test — even when framed as *"removing a false denial"*.
   The trust chain's standing posture is that over-escalating is the safe direction
   (`we:scripts/lib/review-escalation.mjs`), so a change that trades a false denial for a possible false
   clearance is a **regression**, not a fix.
   **Unless a ratified anchor already ruled that exact narrowing.** This carve-out covers the `review:human`
   clause **only** — it never excuses making a fail-closed check fail open, nor widening what auto-clears.
   Test 3 targets *unilateral* loosening: an agent deciding on its own that a gate is too tight. Codifying a
   statute ruling is not unilateral, so an impl item enforcing an anchor in
   `we:docs/agent/platform-decisions.md` is exempt — but only when all three hold: **(a)** the anchor is
   already `status: resolved` on `main` (never one landing in the same pass); **(b)** the anchor's own text
   rules *this* narrowing — an anchor that only *adds* human-gating on other axes does not license shrinking
   them; and **(c)** the diff keeps every invariant that ruling retained. **Quote the sentence that rules the
   narrowing** — a bare anchor name is not a clearance, and nothing checks the citation for you. *(Provenance:
   #2771 and #2840 each ruled one such narrowing. Their impl items are provenance, not the scope — the
   exemption is per-anchor, so a later item enforcing either one qualifies on the same terms.)*

**Incompleteness is not a blocker.** A guard with known bypasses beats no guard, provided it does not
false-deny **and does not weaken a gate that already holds**. *"It doesn't catch everything"* → file it and
land. *"It breaks something that worked"*, *"it can now damage X"*, or *"it lets something through that used to
be held"* → fix before landing.

**A mandatory-lens non-accept is blocking on its own.** `correctness` and `security` are unanimity lenses in
`we:scripts/lib/review-core.mjs` (`MANDATORY_LENSES`, and the security bar *"the trust boundary is not
widened"*). This rule tunes how *incompleteness* is weighed; it does not override that unanimity — do not
file-and-land past a mandatory lens that has not accepted.

## Corollaries

- Prefer **carving the risky half out** to repairing it in place. A clean file seam (impl vs policy, mechanical
  vs judgment) usually exists: PR #1031 (+1499) carved down to PR #1037 (+13/−20), which landed.
- Every accepted-with-issues PR **files its residue in the same pass** — "non-blocking" means *tracked*, never
  *forgotten*.
- This does **not** weaken the trust chain **for the surfaces the chain actually covers**: a policy-tier or
  statute-tier edit still forces a human, and the #2439 independence rule (the actor that produced a diff must
  not clear it) is unchanged. Know the limit — "policy-tier" is the path list in `BLAST_RADIUS` /
  `isGateSelfPath` / `isStatutePath`, not every file that steers agent behaviour. Check the list before citing
  the gate as protection.
- A reviewer's job shifts accordingly: separate *regression/impact* findings (blocking) from *incompleteness*
  findings (file-and-land), and say which is which in the verdict.
