---
name: feedback_reusable_to_neutral_home
description: reusable-against-all-impls → plateau (shared/neutral); impl-specific → its implementer; a multi-surface tool is shared infra — fix the surface not the home;
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 78e1963d-2397-43d4-b80c-9d15225b65ec
---

A tool/runtime **reusable against all implementers** belongs in the **shared, neutral home (plateau)**; code **specific to one implementer** belongs in that implementer (FUI for FUI's own).

**Why:** the user overturned my prepared default on #1788. I'd recommended re-homing the generic conformance *runner* into FUI (one implementer's repo) to satisfy one consuming surface (the WE docs page's mode-C trust gate). Wrong — the runner is a **multi-surface tool** (run via `npx` inside the implementation under test, from the dev browser, from the SaaS exerciser, and as the docs demo), so it is shared infrastructure by construction. My "neutrality is about who-hosts, not where-source-lives" reframe was a rationalization the rule exposes.

**How to apply:** when a placement decision is pressured by *one* surface's constraint (a trust-gate, an origin requirement, a backward-edge), **fix the surface, not the home** — never relocate shared infra to serve one consumer. The per-implementer piece is the thin adapter (the binding's `dispatch`/`observe`), not the engine. Distinguish from #899's "runnable backends → FUI", which means the *impl-specific* backend (the binding), not the generic runner/judge. Related: [[reference_repo_constellation]], [[project_managed_offering_constellation_layering]], [[feedback_constellation_backward_edge_is_module_import]].
