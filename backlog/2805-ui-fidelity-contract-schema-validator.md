---
bornAs: xpcdbsy
kind: story
size: 5
parent: "2804"
status: resolved
dateOpened: "2026-08-01"
dateStarted: "2026-08-01"
dateResolved: "2026-08-01"
tags: [plateau-loop, conveyor, ui-fidelity, we, slice-uifg]
---

# UI-fidelity contract schema + validator

Define the fidelity: frontmatter block (route, host, assembledOwner, webcases required-set, seeds, themes, target registryId/contentHash/authoredInCommit, baseline template) and validate well-formedness in the WE standards gate. WE-side validation only; no product boot.

## Delivered

**Built:** `we:scripts/lib/fidelity-contract.mjs` — a pure, deterministic `validateFidelityContract(fidelity, {id})` that shape-validates the full `fidelity:` block: route, host, optional assembledOwner (boolean), webcases (file + required-set), seeds (empty* / populated / overflow*), themes (light+dark mandatory), target (registryId / contentHash / authoredInCommit), baseline (template). It validates SHAPE only and never boots the product (MEMORY #6) — the real route table + render live in the product repo. The route fixture check is a WE-side heuristic: route must be a repo-qualified served route (repo:/path) with no query string and no demo/fixture marker, so a ?demo= fixture route (the console-board post-mortem root cause) is rejected without consulting the app.

**Wired:** called from `validateBacklogItem` in `we:scripts/check-standards-rules.mjs` (top-level ES import), so any backlog item that authors a `fidelity:` block is gated by `we:scripts/check-standards.mjs`.

**Verified:** `npx vitest run we:scripts/__tests__/fidelity-contract.test.mjs` — 18 tests pass, covering all three mandated rejections (incomplete contract, fixture ?demo=/leaf-source route, omitted empty/overflow seed) plus acceptance of a well-formed contract. `node we:scripts/check-standards.mjs` gives 0 errors; existing `we:scripts/__tests__/check-standards-rules.test.mjs` gives 254 pass.
