---
bornAs: xu48h7u
kind: story
size: 1
tier: pinned
parent: "2562"
status: open
scope: ["plateau-app:src/backlog-view/proof-tiers.ts", "plateau-app:src/backlog-view/proof-tiers.test.ts"]
dateOpened: "2026-09-07"
tags: []
deliveryAgent: codex
deliveryAgentReason: "astra graduation trial (epic #3383/#4034/#3906): non-critical per the #4034/#2752 critical-work rule — a tiny (size 1) same-origin/host-allowlist hardening in plateau-app's proof-tiers UI, no daemon/conveyor/gate/statute path in scope; the pre-existing deliveryAgent marker had no reason, which #3840's rule refuses outright — this reason fills that gap; operator-directed, 2026-09-26"
---

# Harden the proof-tiers evidence-link sanitizer against protocol-relative/open-redirect URLs

plateau-app:src/backlog-view/proof-tiers.ts's safeHref() (we:backlog/2759-proof-provenance-tier-spine-agent-asserted-tier-review-surfa.md) allowlists the http(s) scheme but not the host, so a bottom-tier agent-asserted evidence.url like '//attacker.example/phish' resolves to https: and passes through verbatim as a live, trustworthy-looking href once wired into the future review surface (we:backlog/2555-real-launch-review-console-board.md) — add a same-origin (or explicit host-allowlist) check alongside the scheme check in plateau-app:src/backlog-view/proof-tiers.ts, with an integration-style test in plateau-app:src/backlog-view/proof-tiers.test.ts asserting a protocol-relative/cross-host URL is neutralized the same way a javascript:/data: URL already is.

## Done when

1. **Executable** — `plateau-app:src/backlog-view/proof-tiers.test.ts` gains a case asserting `safeHref('//attacker.example/phish')` is neutralized the same way `safeHref('javascript:alert(1)')` already is (empty string / non-navigable placeholder, per the existing convention in the same test file); it fails against today's `safeHref()` (host-blind) and passes once `plateau-app:src/backlog-view/proof-tiers.ts` adds the same-origin (or explicit host-allowlist) check alongside the existing scheme check.
2. The same case set also asserts a `https://attacker.example/x` absolute cross-host URL is neutralized, and that a same-origin relative path (e.g. `/backlog/3383`) and a same-origin absolute `https://<own-origin>/x` still pass through unchanged (no regression on the legitimate-link path).
3. `npx vitest run proof-tiers` (plateau-app) is green.
4. Mutation check: removing the new same-origin/host-allowlist clause from `safeHref()` makes the new case(s) fail.
