---
type: issue
workItem: story
size: 3
status: resolved
locus: plateau-app
blockedBy: ["598"]
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: plateau-app/src/dev-browser/credential-source/ (CredentialSourceRegistry + bridge-auth/broker/pat sources)
tags: []
---

# Credential-source provider seam — bridge-auth (v1) + GitHub-App broker (hosted) for forge writes

Build the credential-source provider seam ruled by #578 (Fork 1, dissolved to support-all): the forge write authenticates via co-existing providers selected by runtime context — A = reuse the IDE-bridge's git auth (v1/local, zero new credential surface, user identity + signing), B = a GitHub-App backend broker (hosted/org tier, short-lived tokens, bot identity, auto-signed). Identity/signing ride the source. Security invariant: no long-lived credential in the browser → user PAT/OAuth is fallback-only. The per-context default and that rule are compliance-layer policy (#579). Layer: Plateau, no standard contract; couples to #410's auth dial; consumed via #598.

## Progress

Built the seam in plateau-app at `src/dev-browser/credential-source/` — the auth twin of the #598 forge registry, mirroring its runtime-DI registry + injected-seam pattern:

- **`types.ts`** — `CredentialSource` contract (`handles(ctx)` / `isAvailable()` / `provide(ctx)`), `ForgeCredential` (`token` + `identity` + `signing` + `lifetime` + `fallbackOnly`), `CredentialContext` (`{ repo, tier: local|hosted }`), and `CREDENTIAL_PRECEDENCE` (the #579 per-context default policy as numbers: bridge 50 > broker 40 > pat 10).
- **`registry.ts`** — `CredentialSourceRegistry` resolves the highest-precedence *available* source that handles the context, degrades to a clear reason when none does (async-availability honoured).
- **`providers.ts`** — the three co-existing sources (#578 Fork 1): **A** `bridge-auth` (handles `local`, reuses IDE-bridge git auth, user identity + session lifetime, zero new surface), **B** `github-app-broker` (handles `hosted`, mints short-lived bot tokens server-side, auto-signed), and the **fallback** `user-pat` (handles every tier at lowest precedence, `lifetime: long-lived` + `fallbackOnly: true` so the #579 layer can flag the no-long-lived-credential-in-browser invariant). Every side effect is an injected seam (testable, no real bridge/broker/network).
- **`index.ts`** — `createDefaultCredentialSourceRegistry` wiring + `forgeTokenFromCredential` (the thin hand-off feeding the resolved token + author to the #598 forge provider — the "consumed via #598" integration).
- **`credential-source.test.ts`** — 9 tests: context selection (local→bridge, hosted→broker), precedence ordering, PAT-only-as-fallback, the long-lived-fallback invariant, degradation reason, and the forge hand-off.
- Gate: `npm test` green (122/122, +9); module type-clean (`tsc --noEmit` 0 errors in the new files). Code → plateau-app; tracker → webeverything.
