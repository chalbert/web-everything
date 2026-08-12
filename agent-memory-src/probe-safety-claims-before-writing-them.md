---
name: probe-safety-claims-before-writing-them
description: A claimed safety/isolation property must be falsified by a probe before it is written down — three rounds in a row shipped a guarantee the code did not deliver, each time because the claim was reasoned rather than run. Recall before writing any "X is refused / cannot happen / is structural" sentence in a comment, commit message or PR body.
metadata:
  type: feedback
---

Before writing that something **cannot happen** — a spawn is refused, a write is denied, a state is
unreachable — run the probe that would falsify it, in the deployment that actually runs. Reasoning from the
source is what produced all three failures below.

WE PR #1178 shipped the same class of defect three rounds running, each caught by a reviewer who *ran* it:

1. **Round 1** claimed a juror's working directory was a lane. Nothing set it. It also claimed `guard-lane`
   would deny a shared-tree write — but `--safe-mode` disables hooks, so that guard never ran inside the
   juror at all.
2. **Round 2** added a real refusal, `assertLaneCwd`. It still did not fire: `judgeSpawn` DEFAULTED the
   directory to `process.cwd()`, and a review normally runs inside a lane, so an omitted directory passed the
   check by donating the driver's own tree. The reviewer's one-line probe printed
   `SAME TREE AS PARENT: true`.
3. **PR #1180**, same day, claimed a write-before-the-work made a crash recoverable. The crash case is
   exactly the case the code refuses. The reviewer constructed it and showed the refusal.

**Why:** a safety property is a claim about the WORST path, and reading the source walks the intended one.
Every one of these survived my own review and died in under a minute to someone who executed it. The mutation
the third reviewer ran — deleting the feature's assignment — left 2095 tests green, so the gate could not
catch it either.

**How to apply:** for each "cannot happen" sentence, name the input that would make it happen and run it.
Prefer the mutation form: delete or invert the guard and confirm a NAMED test reddens. If nothing reddens, the
guarantee is prose, not a guarantee. Watch the DEFAULT specifically — two of the three failures were a default
value quietly satisfying a check written for the explicit value. See also
[[129-feedback_prove_before_claiming_fixed]] and [[stop-hardening-an-unachievable-guarantee]]: when the same
finding-class returns a layer down, narrow the claim instead of hardening it again.
