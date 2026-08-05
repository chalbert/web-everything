---
name: land-on-no-regression-not-perfection
description: The land bar is "no regression + no new impact", NOT "no findings" — residue is filed and worked non-blocking
metadata:
  type: feedback
---

# Land on no-regression, not on perfection

The bar for landing a PR is **no regression and no new impact** — not the absence of findings. An improvement
that leaves known issues **lands**; its residue is filed and built in a non-blocking follow-up.

**Why (operator ruling, 2026-08-05).** PR #1031 bounced four review rounds; its carve-out #1037 bounced two
more. Across those six rounds, **every finding landed in the guard, never in the fix** — the 8-line change that
unblocked the review chain was correct from round 1 and was held hostage the whole time. Worse, each round's
repair *grew* the diff (#1037: 241 → 407 → 472 lines), so repairing-in-place was itself the loop. Meanwhile the
parked queue did not move at all. Perfection-before-land cost more than the defects it caught.

## The two tests — both about the DELTA vs current `main`

1. **No regression.** Does anything that works today work *worse*? A false denial, a crash, a changed result on
   an existing path. A guard that blocks a previously-working command **is** a regression.
2. **No new impact.** Does it add a **new** way to damage something outside its scope — writing outside its own
   tree, dropping another actor's work, auto-installing something machine-global?

**Incompleteness is not a blocker.** A guard with known bypasses beats no guard, provided it does not
false-deny. *"It doesn't catch everything"* → file it and land. *"It breaks something that worked"* or *"it can
now damage X"* → fix before landing.

## Corollaries

- Prefer **carving the risky half out** to repairing it in place. A clean file seam (impl vs policy, mechanical
  vs judgment) usually exists; #1022 splits exactly that way.
- Every accepted-with-issues PR **files its residue in the same pass** — "non-blocking" means *tracked*, never
  *forgotten*.
- This does **not** weaken the trust chain: policy-tier edits still require a human, and the #2439 independence
  rule (the actor that produced a diff must not clear it) is unchanged.
- A reviewer's job shifts accordingly: separate *regression/impact* findings (blocking) from *incompleteness*
  findings (file-and-land), and say which is which in the verdict.
