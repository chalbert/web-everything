---
bornAs: xxrq31g
kind: story
size: 5
parent: "2804"
status: open
scope: ["we:scripts/lib/target-registry.mjs", "we:scripts/__tests__/target-registry.test.mjs"]
dateOpened: "2026-09-07"
tags: []
---

# Harden frozenArtifactScan's live-fetch detection ceiling + add a concurrent-write stress test for the target registry's hash chain

we:scripts/lib/target-registry.mjs's frozenArtifactScan (#2806, requirement #5) is a deterministic text-level
regex scan with a known ceiling — it cannot see a live network call made from inline `<script>` body
JavaScript, and has no defense-in-depth beyond the regex layer. Extend its attribute coverage against a
canonical list, evaluate a network-sandboxed render check as the real enforcement boundary once wired into a
live mint-time gate (#2812), and add a genuinely concurrent stress test for appendRegistryEntry's hash chain
(the existing suite only simulates lock contention deterministically, never a true race).

## Done when

- `npx vitest run we:scripts/__tests__/target-registry.test.mjs` is green and includes:
  - A parameterized test enumerating a canonical URL-valued-attribute list (the WHATWG living standard's
    enumeration, or a documented equivalent) asserting `frozenArtifactScan` flags every entry — a missing
    attribute must fail a NAMED test case, not silently return `frozen:true`.
  - A genuinely concurrent stress test for `appendRegistryEntry`: two real overlapping append calls
    (`Promise.all` against real fs, or two child processes) against the same root, asserting `verifyChain`
    stays valid afterward (or that the second call is correctly refused) — not the deterministic
    pre-held-lock simulation the existing suite uses.
- A decision is recorded (in this item or a linked one) on whether a network-sandboxed render check
  (block all outbound requests, assert zero fired) becomes the real enforcement boundary once
  `frozenArtifactScan` is wired into a live mint-time gate (#2812), with `frozenArtifactScan`'s own
  docstring updated to describe itself as a fast pre-filter rather than the final authority if so.
- `node we:scripts/check-standards.mjs` — 0 new errors.
