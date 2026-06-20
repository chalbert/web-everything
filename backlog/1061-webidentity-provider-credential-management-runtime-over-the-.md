---
type: idea
workItem: story
size: 5
parent: "1022"
status: resolved
blockedBy: ["1060"]
dateOpened: "2026-06-19"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "fui:plugs/webidentity/index.ts"
tags: []
---

# webidentity provider — credential-management runtime over the Credential Management API in FUI

Slice B of webidentity impl epic #1022 (blockedBy slice A contract). Implement the credential-management provider runtime in FUI over the platform Credential Management API (native-first), conforming to the WE contract; swappable provider.

## Resolution (batch-2026-06-19)

Built in `fui:plugs/webidentity/` (headless runtime → plug, no element):

- `fui:plugs/webidentity/provider.ts` — `NativeCredentialProvider`, a native-first passthrough over `navigator.credentials` mapping each member 1:1 (`credential-request`→`get`, `credential-enrollment`→`create`, `session-mediation`→`preventSilentAccess`) and normalizing to `CredentialResult`. The `CredentialsContainer` is injected (defaults to the global; absent → `unavailable`, never throws). Plus `assertCredentialResult` — the trust-boundary check (acquire is trust-crossing, #1022), mirroring `assertGuardDecision`.
- `fui:plugs/webidentity/registry.ts` — `CustomCredentialRegistry`, the **per-family** swap point (Fork 1-A: one provider per family, registry-resolved). `acquire` fans a request to its accepted families' providers in order, returning the first conformant non-`unavailable` result (asserted at the seam).
- `fui:plugs/webidentity/index.ts` — `createDefaultCredentialRegistry()` seeding the native provider for every family.

Conforms to `@webeverything/contracts/credential-management` (the FUI→WE arrow). Added the **WE-side distribution seam** (`we:contracts/credential-management.ts` type re-export of `we:identity/contract.ts` + the `./credential-management` subpath in `we:contracts/package.json` — slice A built only the contract module, not the entry) and the FUI `fui:tsconfig.json` + `fui:vite.config.mts` path-maps + the `webidentity` `fui:src/_data/plugs.json` catalog entry. Covered by `fui:plugs/webidentity/__tests__/webidentity.test.ts` (10 tests, mocked CredentialsContainer). FUI `check:standards` green.
