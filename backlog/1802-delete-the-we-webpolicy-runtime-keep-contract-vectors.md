---
kind: story
size: 2
parent: "1294"
status: resolved
blockedBy: ["1801"]
dateOpened: "2026-06-26"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: "fui:webpolicy/"
tags: []
---

# Delete the WE webpolicy runtime (keep contract + vectors)

Delete we:webpolicy/enforcement.ts + we:webpolicy/proof.ts + their __tests__ (the runtime graduated to FUI in W1, demo repointed in W3). Keep we:webpolicy/contract.ts (the WE contract) + we:conformance-vectors/webpolicy.vectors.ts. Completes the webpolicy #1282 end-state. Blocked on the docs repoint (W3) so the demo never strands.

## Progress

- **Status:** resolved
- **Branch:** main
- **Done:**
  - Pre-flight: confirmed zero live WE importer of the runtime (only the deleted files referenced each other; the W3 demo repoint stands).
  - Deleted `we:webpolicy/enforcement.ts`, `we:webpolicy/proof.ts`, `we:webpolicy/__tests__/enforcement.test.ts`, `we:webpolicy/__tests__/proof.test.ts` (`git rm`). `we:webpolicy/` now holds only `we:webpolicy/contract.ts`.
  - Removed the now-dead `webpolicy/**/__tests__/**` glob from `we:vitest.config.ts`.
  - Updated `we:webpolicy/contract.ts` docstring — the runtime no longer "lives next door"; it lives in FUI (`fui:webpolicy/`), WE keeps contract + vectors.
  - Corrected the statute doc `we:docs/agent/platform-decisions.md`: webpolicy moved from the "currently-violating WE-resident debt" list to "first fully relocated" (both gates cleared), residual is the ~8 other subsystems.
- **Verified:** WE typecheck clean for webpolicy · `we:conformance-vectors` tests 14/14 (kept vectors still resolve `we:webpolicy/contract.ts`) · check:standards has no webpolicy error (the 1 gate error is a concurrent session's #1792 report, not this work).
- **Next:** done — webpolicy is the **#1282 end-state**: impl in FUI, contract + vectors in WE, conformance visible via the plateau iframe. #1294 epic stays open for the remaining ~8 subsystems (webpolicy proved the cascade).
- **Notes:** Kept WE-side: `we:webpolicy/contract.ts`, `we:contracts/webpolicy.ts` (published re-export), `we:conformance-vectors/webpolicy.vectors.ts`. Historical references in resolved items (#407/#408/#1077/#1078) + reports are immutable audit trail — left as-is.
