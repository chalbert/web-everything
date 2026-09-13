---
name: prototype-fix-what-you-find-by-default
description: "Standing instruction — while working the mechanical-dispatch prototype, fix any real problem found along the way directly, without asking first, unless the fix is genuinely risky or has real consequences beyond the immediate fix."
metadata:
  type: feedback
---

**Operator (2026-09-12): "The standard stance of the prototype... is to always fix all we find, no
need to ask, unless risky or has consequences."** Said after a watchdog-crash investigation turned
up a real, well-understood, low-risk gap (the driver-watchdog had no concept of a bounded `--once`
run vs. a resident one, and asserted "that is a crash" without evidence) — the operator's framing
made clear this should just get fixed, not raised as a question first.

**How to apply:** For prototype-branch work (epic #3383, `origin/lane/mechanical-dispatcher`, and by
extension anything covered by [[default-to-prototype-for-mechanical-fixes]]), when an agent or
session finds a real bug/gap/inefficiency while doing other work, the default is to fix it directly
in the same pass — not file it and wait, not ask "should I fix this?" first. This mirrors (and
extends) the established "no PR/review tax" fast-iteration doctrine already governing this branch:
just as landing doesn't need review, finding-and-fixing doesn't need permission.

**The exception, stated as plainly as the default:** stop and ask first when the fix is genuinely
risky (touches security-relevant code like `guard-bash.mjs`'s deny rules, could destabilize
something currently relied upon, requires a real design call rather than a mechanical correction) or
has consequences reaching beyond the immediate fix (affects `main`, a running live process, another
session's in-flight work, or anything a human would reasonably want visibility into before it
happens). The bar is "is this a small, well-understood, contained correction" vs. "is this a real
judgment call or does it touch something load-bearing" — when genuinely unsure which side a finding
falls on, ask; don't guess toward silence.

**This does not relax the surrounding process guarantees** — real tests, `check:standards`, the
lane+PR flow, and (for anything landing outside the prototype branch) the normal review flow all
still apply. "No need to ask" is about not pausing for a go-ahead on the DECISION to fix something,
not about skipping verification of the fix itself.
