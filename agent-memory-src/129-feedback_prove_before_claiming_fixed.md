---
name: feedback_prove_before_claiming_fixed
description: "Never say \"fixed\" or assert a root cause without a runtime test proving it end-to-end on the real surface"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 0d6f1013-70c8-49c4-a0a9-caf39ad50453
---

Never tell the user something is fixed, or assert a root cause, without a **runtime test that proves it** — and for a rendered/HMR/dev-server claim the proof must exercise the **real surface the user sees** (live page in a real browser, the actual running server), not an isolated unit or a plausible mechanism.

**Why:** On the #1202/#1207 thread I (a) implied the demo would work after a restart when I had only proven cold-start, and (b) floated a "disconnected-upgrade" root cause and nearly acted on it — then disproved it myself one probe later (append-then-upgrade ALSO rendered the raw identifier). Plausible ≠ proven. The user: "never assume something without testing… never tell me it's fixed without proof."

**How to apply:**
- A fix is "done" only when an end-to-end test on the live surface shows the user-visible symptom gone (demo renders `World`, not `{{name}}`/`name`) — scope what you proved vs didn't, explicitly.
- Before naming a cause, run the decisive differential probe that would FALSIFY it. If you can't falsify it, you can't claim it.
- HMR / config-reload / cold-start claims are testable — prove them (probe the running port, diff the served bytes, check the pid/build-id), never assert from how the tool "normally" behaves.
- Distinguish "primitives work in isolation" (parse ✓, resolve ✓, evaluate ✓) from "the integrated path works" — the bug usually lives in the wiring between them (e.g. #449 duplicate-module class-identity split), so the proving test must be integrated.
- Relates to [[feedback_test_before_asserting_cause]] (run the real browser probe FIRST) — this extends it to "fixed" claims and to falsifying your own hypothesis before acting.
