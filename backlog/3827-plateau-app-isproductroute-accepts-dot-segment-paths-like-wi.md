---
bornAs: x8i1gsp
kind: story
size: 1
status: open
scope: ["plateau:src/return-to.ts", "plateau:src/return-to.test.ts", "plateau:src/main.ts"]
dateOpened: "2026-09-21"
tags: []
---

# plateau-app isProductRoute accepts dot-segment paths like /wip/../x, so the sign-in return target can leave the product routes

Found by the independent review of chalbert/plateau-app PR #157 and re-confirmed by the fix worker of PR #158 (left unchanged there because that brief forbade behaviour changes). plateau:src/main.ts:276 (main 14b45e0; PR #158 moves it verbatim to plateau:src/return-to.ts) is a prefix check: path === r or path.startsWith(r + '/'). So isProductRoute('/wip/../x') is true, and takeReturnTo (plateau:src/main.ts:290-297) returns the stored value as-is; the browser then resolves it to /x, which is not a product route. Low severity: rememberReturnTo stores location.pathname, which the browser always normalises, so the only way a dot-segment value gets in is same-origin sessionStorage tampering. But it is a real hole in the documented rule 'same-origin product routes only', and it was raised in the same review as the gate deep-link decision `3826`. FIX: isProductRoute accepts only a canonical path: it returns false when new URL(path, 'https://x').pathname !== path (catches /./, /../, %2e%2e, backslash, and a double slash), then does the existing prefix match. Keep the existing startsWith('/') and '//' clauses in takeReturnTo.

## Done when

1. **Executable** — run in the plateau-app checkout: `grep -rqF "isProductRoute('/wip/../x')" src --include='return-to.test.*' && npx vitest run return-to`. It fails today (no such case) and passes once `plateau:src/return-to.test.ts` has a case asserting `isProductRoute('/wip/../x')` is `false`, and that suite is green.
2. The same case also asserts `false` for `/wip/./a`, `/wip/%2e%2e/x`, `/wip\..\x` and `/wip x`, and `true` for `/wip`, `/wip/` and `/backlog/3383` (checked on 2026-09-21 with Node's URL parser: the canonical-form check gives exactly these answers).
3. `takeReturnTo` returns `'/'` when storage holds `/wip/../x` (a second case in the same file).
4. Mutation check: removing the canonical-form clause from `isProductRoute` makes the new case fail.

## Notes

- **Order:** needs chalbert/plateau-app PR #158 merged first, because that PR creates `plateau:src/return-to.ts` and its test file. If #158 is abandoned, make the same change in `plateau:src/main.ts:276` and add the test there instead.
- **Related:** `3826`, the gate deep-link decision filed alongside this card. Under its default, the gate has its own local same-origin check and does not depend on this card. This card only fixes the SPA's own rule.
- Found in the review of chalbert/plateau-app PR #157; noted, not fixed, in PR #158.
