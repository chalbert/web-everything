---
bornAs: x86ncif
kind: story
size: 2
status: open
dateOpened: "2026-07-28"
tags: [maas, authoring, testing]
---

# Author + commit we:src/_data/authorModeSource.json so the skipped maas authoring tests run

Author + commit `we:src/_data/authorModeSource.json` (and the webtheme vector source it needs —
`we:conformance-vectors/surfaceVectors.ts`) so the two currently-`describe.skip`ped maas
`functionalAuthoringForm` describes (`fui:tools/maas/__tests__/functionalAuthoringForm.test.mjs:25,49`, plus the
`fui:vitest.config.ts` exclude) run for real under the `test` check. They are skipped today only because the
artifact was never committed to WE — it is ENOENT in every environment, sibling checkout or not — so authoring
and committing it un-skips both describes.

Relates #2315 (the ratified repo↔drain check contract — the `test` check certifies ~386 files today, with only
these two describes honestly skipped) and the maas authoring-form work (#1602 / #1619).

## STOP — this card's premise was overturned before it was filed

**Do not start building this as written.** The artifact it asks WE to author and commit was deliberately
**deleted from WE by a ratified decision**, and the generator that would produce it was deleted with it.
Verified on this branch:

- `we:src/_data/authorModeSource.json` — absent.
- `we:scripts/gen-author-mode-source.mjs` (the #954 build-emit that produced it) — absent.
- `we:blocks/renderers/module-service/` — reduced to four files: the serve-path IR, its OpenAPI
  projection, the emitted OpenAPI document, and the frozen conformance vectors. The `authorModeSource` projector, the module-service runtime and the whole
  generation subtree are gone.

The deletion is #1730's Progress note (resolved), executed per #1771's ruling (a resolved `decision`).
#1618 (resolved 2026-06-27) records the consequence in one sentence: *"the transport premise [was settled]
by #1730/#1752 — **the WE artifact is gone; generation is a FUI concern**"*, and its build lowered FUI's own
fixtures into `fui:workbench/authorModeData.ts` instead. This card was filed **2026-07-28**, a month after
that. So it is not merely stale — it asks WE to re-introduce an artifact a ratified call removed.

**The second cited path is wrong as well, and points at a third thing.** `we:conformance-vectors/surfaceVectors.ts`
does not exist and never did under that name. The importer that wants surface vectors is
`fui:tools/gen-wrapper/__tests__/surfaceContract.test.mjs`, and it imports
`we:blocks/renderers/module-service/conformance/surfaceVectors.ts` — also deleted by #1730, leaving only the frozen
`we:blocks/renderers/module-service/conformance/golden.json` in that directory. That test is the one behind the single `fui:vitest.config.ts` `exclude` entry, which names a **different**
file from the two `describe.skip`s. The card conflates two independent skips with one artifact.

**What IS still true.** The two `describe.skip`s are exactly where the card says — `describe.skip` at lines
25 and 49 of `fui:tools/maas/__tests__/functionalAuthoringForm.test.mjs` — and
`fui:tools/maas/functionalAuthoringForm.mjs` still resolves `AUTHOR_MODE_SOURCE_PATH` to the deleted WE
path (`we:src/_data/authorModeSource.json`, joined onto its `WE_ROOT`) and reads it with `readFileSync`. So FUI still carries a
consumer pointed at an artifact WE ruled out of existence. That contradiction is the real finding, and it
is a FUI-side one.

**And it is wider than two skipped tests.** `readAuthorModeSource` is also the default `readSource` for
`fui:tools/maas/functionalServeHandler.mjs`, wired without an override by `fui:tools/maas/vite-plugin.mjs`.
So the FUI dev server's functional-serve path reads the same absent WE artifact at request time — which
means whatever fork is taken has to cover that route, not just the test file. Worth confirming what that
route actually does today before choosing.

## The fork the next agent must settle before writing code

Three live options, and this card does not choose between them:

1. **Re-point the FUI adapter at FUI's own data** — `fui:workbench/authorModeData.ts` already lowers the
   `component-cases` fixtures to the three ratified forms (#1865 Fork 1), which is what
   `readAuthorModeSource` wants. Un-skip both describes against that. Consistent with #1730/#1771/#1618;
   **no WE change at all**, which means this item is mis-located and should be re-homed to FUI.
2. **Delete the two describes and the reader.** A permanently-skipped describe is worse than no describe —
   it reads as coverage. **But the reader is NOT dead**, and this option is bigger than it looks:
   `readAuthorModeSource` is imported by `fui:tools/maas/functionalServeHandler.mjs` as the **default**
   `readSource`, and `fui:tools/maas/vite-plugin.mjs` wires `createFunctionalServeHandler` with no
   `readSource` override — so it is live dev-server middleware, not test-only. Taking this option means
   touching both of those too. (Raised by the independent review below.)
3. **Overturn #1730/#1771** and restore a WE-side emit. That is a `decision`, not a story, and it would need
   to re-argue the #1282 "WE = contract/protocol/interface only" line that removed the runtime in the first
   place.

The `fui:vitest.config.ts` exclude is a **separate** question with its own version of the same fork, about the
surface vectors rather than the author-mode source — carve it out rather than solving both here.

## Done when

- **No tier-1 criterion is authorable yet, and this is the exemption:** the item's stated build was ruled
  out of existence by resolved decisions #1730/#1771 (recorded in #1618), so there is nothing to make
  fail-before that would not first require re-opening that ruling. The next action is a fork call, not a
  command.
- The absence is re-verified rather than trusted from this note — all three paths must still be missing:

  ```
  ls src/_data/authorModeSource.json scripts/gen-author-mode-source.mjs \
     blocks/renderers/module-service/conformance/surfaceVectors.ts
  ```

- One of the three options above is chosen and recorded on this card, and the card is re-typed or re-homed
  to match (`decision` for option 3; FUI locus for options 1 and 2).
- Once an option is chosen, the successor item carries its own tier-1: for option 1 or 2, the two describes
  no longer read `describe.skip` and `npm test` in the FUI checkout is green with them running or removed.
- The `fui:vitest.config.ts` `exclude` of the gen-wrapper surface-contract test is split out as its own
  item — it is a different artifact and a different consumer.

## Independent review — 2026-08-21

Confidence: **High**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: verify by mutation or reversion, ahead of implementation) — The card's core move is exactly this: it re-verifies (and I independently re-confirmed) that we:src/_data/authorModeSource.json, we:scripts/gen-author-mode-source.mjs, and we:blocks/renderers/module-service/conformance/surfaceVectors.ts are all absent, and traces the deletion to resolved decisions #1730/#1771 (both status: resolved in we:backlog/), with #1618 (status: resolved, graduatedTo `fui:workbench/authorModeData.ts`) recording the consequence. It also supplies a re-runnable ls command for future re-verification — a textbook premise check.
- **consumer** (NOT addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — The card finds the FUI test-file consumer of we:src/_data/authorModeSource.json (fui:tools/maas/functionalAuthoringForm.mjs's AUTHOR_MODE_SOURCE_PATH/readFileSync) but its option-2 fork header called readAuthorModeSource "the dead reader" without completing a second consumer sweep. It is not dead: fui:tools/maas/functionalServeHandler.mjs imports readAuthorModeSource as the default readSource, and fui:tools/maas/vite-plugin.mjs calls `createFunctionalServeHandler` with no `readSource` override as live dev-server middleware — a production wiring the card's consumer check missed.

**Corrections applied by this review:**

- Option 2's header "Delete the two describes and the dead reader" is inaccurate: readAuthorModeSource (declared in `fui:tools/maas/functionalAuthoringForm.mjs`) is not dead — it is imported and used as the default readSource by `fui:tools/maas/functionalServeHandler.mjs`, which is wired into live dev-server middleware via `fui:tools/maas/vite-plugin.mjs` (createFunctionalServeHandler({ producer: FUNCTIONAL_PRODUCER }), no readSource override). Deleting it under option 2 would require also touching those two modules, not just the two-describe test file — the card's own conditional ("if nothing consumes readAuthorModeSource in production any more") is not actually satisfied as stated.

The STOP analysis is factually accurate and well-verified on every checkable claim (all three artifact paths confirmed absent, #1730/#1771/#1618/#1282/#1865 citations all check out, both describe.skip locations and the separate `fui:vitest.config.ts` exclude confirmed exactly as described), but its option-2 fork mischaracterizes readAuthorModeSource as possibly "the dead reader" when it is in fact a live, wired production consumer.

_Recorded through the declared `review-prep` operation._
