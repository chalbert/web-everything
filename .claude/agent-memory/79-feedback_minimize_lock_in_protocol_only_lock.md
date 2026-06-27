---
name: minimize-lock-in-protocol-is-the-only-escapable-lock
description: "Lock-in avoidance is the governing principle — never introduce a project-facing format/standard; the inter-module protocol is the single, unavoidable, deliberately-escapable exception."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5680caac-1c91-4fd9-b9c1-0670abaa6c18
---

**Minimize lock-in at every layer of Web Everything. The thing we refuse to introduce is a project-facing *format/standard*, because it forces continuous maintenance of the format and ties the project to a custom solution forever. Classify every surface by how much lock-in it imposes — and keep that as close to zero as the surface allows.**

The layered taxonomy that came out of the dev-authoring-preferences decision (backlog #150):

- **Project-facing format/standard → refused.** Introducing one (e.g. a neutral cross-tool dev-preference config schema) creates permanent maintenance burden + custom-solution coupling. This is the trap to avoid, not a feature to ship.
- **Devtools (e.g. the validation normalization hub) → zero lock-in.** You can use the tool once and stop; the project keeps *no reference to it whatsoever* — it only ever touches the incumbents' own config files (eslint/oxlint/Sheriff/etc.). Disposable by design.
- **Protocols (blocks) → the *only* lock, and even it is soft and escapable.** Interop requires a contract, so a protocol is unavoidable. But the lock is minimized three ways: (1) protocol ≠ implementation — pick any compatible impl and **switch freely**; (2) **graceful degradation** — a non-compliant module still *works*, it just doesn't receive the injection/configuration that compliant modules get (non-compliance costs benefits, not function).

**Why:** This is the *why* underneath several existing principles, not a new isolated rule. It explains [[feedback_native_first_default]] (native = no library lock-in), adapter-over-reinvent, and part of the open-core value prop in [[project_monetization_strategy]] (no lock-in is what makes "open" worth choosing). Worked example: for dev preferences, introducing an interop *format* would have locked the project in; a devtool that adapts to existing tools (see [[feedback_adapter_normalization_hub]]) does not. Relates to [[feedback_protocol_first_class]].

**How to apply:**
- When tempted to standardize something, first ask: *does this force the project to carry a format/reference forever?* If yes, prefer a disposable devtool that adapts to incumbents instead.
- Reserve hard contracts for genuine interop (protocols). Test: violating it **breaks interoperation** → it's a Protocol (enforced); it merely **offends a convention** → it's a soft preference (adapter-lowered, opt-in, never forced).
- Even for protocols, design for impl-swappability and graceful degradation of non-compliant modules — the lock should cost benefits, never basic function.
