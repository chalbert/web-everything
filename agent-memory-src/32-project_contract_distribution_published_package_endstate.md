---
name: project_contract_distribution_published_package_endstate
metadata: 
  node_type: memory
  type: project
  originSessionId: 813cf9f3-0b01-4a2c-9480-af246680e9c7
---

Ratified in #834's discussion (2026-06-17): the constellation's end-state mechanism for FUI consuming
WE contracts is a **WE-published, type-only contract package** (`@webeverything/contracts`, per-protocol
subpath exports) that FUI depends on — the **FUI→WE** arrow, the literal form of "no contract, no
implementation." **Byte-replication (#694 + #170 byte-equality gate) is the INTERIM**, not the end-state.

Key correction that unlocked this: **#700 (DC-7) is UNIDIRECTIONAL** — it ruled only against the
**WE→FUI** arrow (WE docs/demos importing FUI's compiler, which inverts the constellation). It does NOT
exclude FUI→WE (impl depending on a published WE standard contract); that's the *correct* arrow and is
endorsed by #239 (`@webeverything/*` reserved for standard artifacts; contract package name == specifier).
Citing #700 as "no cross-repo WE↔FUI import path" (bidirectional) is the mis-read to avoid.

Mechanism caveat: WE contract modules are often **mixed** (e.g. `guard/provider.ts` = contract types
*and* runtime `assertGuardDecision`/`NativeGuardProvider`/`ALLOW`), so only the type half goes in the
package; the runtime half stays impl (→ FUI). That split is the prerequisite (#873).

Epic **#872** holds the build: #873 contract/impl split · #874 publish `@webeverything/contracts` ·
#875 FUI migrates byte-copies (incl. #834/#836 guard) to imports · #876 version-skew drift gate (the new
drift surface a pinned npm version introduces) · #877 CI publish pipeline · #878 dev-time wiring
(TS project refs / `file:` dep over flaky `npm link`). Applies to ALL contracts (guard, validators,
positioning, the #694 families). Relates to [[npm_scope_mirrors_layer]], [[reference_repo_constellation]],
[[feedback_impl_is_not_a_standard]].

**Codified:** the canonical rule is `docs/agent/platform-decisions.md#constellation-placement` (the statute is source-of-truth; the `#NNN` above is provenance, not the reference).
