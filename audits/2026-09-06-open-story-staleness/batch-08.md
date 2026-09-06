# Batch 08 — staleness audit (21 cards)

**Summary (verdict counts)**
- ALREADY-DONE: 0
- SUPERSEDED: 0
- STALE-INFO: 15 (of which 4 also carry DEAD-REFS: #1255, #1391, #1756, #1757)
- STALE-PREMISE: 0
- DEAD-REFS (primary verdict): 1 (#1757) · OK: 5 (#890 near-OK, #3120, #3122, #3136, #2768)

Highest-value: #1754/#1755 both assert "the dev-browser shell directory does not exist / #1753 has not
landed" — false since plateau commit `fe2c210`; #912's whole build is on disk; #1294's parked/violation
framing is obsolete (webpolicy/webcompliance/webprocess runtimes already deleted from WE).

---

## #746 — Block Explorer: the interactive FUI block workbench
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** Every one of the 9 slices in the card's "The slices" table is now `status: resolved`
  (#747, #748, #749, #750, #751, #752, #753, #754, #755 — checked frontmatter of each
  `/home/user/web-everything/backlog/<N>-*.md`). The card's own gating claim *"effectively `blockedBy`
  **#971** (the per-block demo slot)"* is stale — #971 and its parent #970 are both resolved, as is #727
  ("Where #727 *shows* a block…"). The 5 unchecked Acceptance boxes all name resolved slices. The epic
  nevertheless still has 3 open + 1 parked children carved later: #890 (open, blocked on #1073), #912
  (open), #967 (open), #1735 (parked).
- **suggested action:** edit card — mark the 9-slice acceptance as met, drop the "#971 gate" sentence,
  and restate the open residue as exactly {#890 parked-vision, #912 (only #1762 left), #967, #1735}.

## #777 — Dogfood the WE-docs website on FUI components
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** Opening sentence — *"Today the WE-docs site (`:8080`) is hand-written Nunjucks + CSS —
  header/nav … none rendered from FUI's real component impl"* — is no longer true.
  `/home/user/web-everything/src/_layouts/base.njk` now carries the `#865` mode-C dogfood mount
  (`<div id="we-chrome-shell" data-embed-mode="in-document" data-embed-src="…/embed/chrome-in-document.ts">`
  plus a `data-chrome-config` JSON sidecar), and the page templates use `<we-card>`, `<we-badge>`,
  `<we-tag>`, `<we-data-table>`, `<we-code-view>`, `<we-filter-chip>`.
  The whole section **"The gate — #765 must ratify *relax*" is obsolete**: #765 resolved, #786 resolved,
  #747 resolved — as the card's own Slicing note already says, but the gate section above it still reads
  "**This epic's migration slices stay blocked until #765 resolves.**"
  The Slicing note's per-child blockers are stale too: it says "#866 — Blocked on the chrome slice #865"
  and "#867 — Blocked on the migration slices"; #864/#865/#866/#867 (and #778, #931, #934, #881, #932,
  the whole 2016–2021 dogfood run, #2375/#2376/#2377/#2378) are **all resolved**.
  Only two children remain open: **#2379** and **#3122** (both a11y-ratchet, both in this batch).
- **suggested action:** edit card — rewrite the intro + delete the "#765 gate" section; restate the epic
  as "chrome + page UI migrated; residue = the a11y-gate drain (#3122 → #2379)".

## #890 — Screenshot to theme (paid vision) for the Plateau creator
- **verdict:** STALE-INFO (very low severity; content otherwise accurate)
- **confidence:** medium
- **evidence:** Body opens "PARKED — the paid vision path", and the card is tagged `parked`, but
  frontmatter is `status: open`. The repo does support `status: parked` (e.g. sibling #1735
  `1735-design-option-c-s-emit-purpose-ir-contract-shape-held-on-per.md` → `status: parked`), so this is
  an inconsistency, not a convention. Everything else re-verified current: blocker **#1073 is still open**
  (`1073-…on-device-small-vlm-vision-tier…`), #086/#382/#475 all exist, and the
  `#no-leakage-client` anchor resolves (`docs/agent/platform-decisions.md:757`).
- **suggested action:** edit card — set `status: parked` to match the body (or drop the "PARKED" prefix).

## #912 — Polyglot panel — live-test sandbox
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** The card's entire decomposition is delivered. All five named children are resolved —
  A0 #1085, A #1029, A-test #1086, B #1030, C #1031 — and the code is on disk in `/home/user/frontierui`:
  `tools/maas/wrapperServeHandler.mjs` (+ `__tests__/wrapperServeHandler.test.mjs`),
  `workbench/live-test/liveMount.ts`, `workbench/__tests__/mountLive.test.ts`,
  `workbench/__tests__/e2e/live-test-panel.spec.ts`, `tools/maas/vite-plugin.mjs`.
  The two long block-quotes still read as present tense and are now historical fiction:
  *"Claimed in batch-2026-06-18, then re-blocked + re-sized (NOT built)"* and *"OUTGREW size 8, re-sized
  8 → 13, released NOT built … **Suggested next step: `/split 912`**"* — the split already happened
  (2026-06-18) and every resulting slice landed.
  The only thing keeping the epic open is a later-carved functional-preview child, **#1762** (also in
  this batch); the other later children #1501/#1594/#1759/#1760/#1761 are all resolved.
- **suggested action:** edit card — collapse the two "NOT built" block-quotes into one dated history
  line, and state that the epic's remaining scope is #1762 only.

## #967 — Polyglot panel — behavioral wrapper-conformance badge (FUI-side runner)
- **verdict:** STALE-INFO (work itself is genuinely NOT done)
- **confidence:** high
- **evidence:** `blockedBy: ["912", "954"]` — **#954 is resolved** (`954-decide-how-polyglot-author-mode-source…` → `status: resolved`),
  so only #912 remains, and #912's live-test sandbox (the "MOUNTED subject" this card needs) is itself
  built and landed (see #912 above), so the card's practical precondition is met even though the umbrella
  is open. Substance still valid: `we:wrapper-conformance/runner.ts` exists and is **166 lines** (card says
  "~165 lines"), imports nothing from FUI; there is no `wrapper-conformance/` directory anywhere in
  `/home/user/frontierui` and no FUI-side runner call site — the badge is unbuilt. `#872` (runner packaging)
  is still open, so that dependency line holds.
- **suggested action:** edit card — drop `954` from `blockedBy`; note that #912's sandbox has landed so
  the mounted subject exists.

## #1255 — FUI convergence (umbrella)
- **verdict:** STALE-INFO + DEAD-REFS
- **confidence:** high
- **evidence:** The "Facet map" hand-labels statuses that have moved:
  - `#170 … · **open** (reconcile children #649 ✓, #1250 open)` — **#170 is resolved and #1250 is resolved**.
  - `#728 — component embedding capability · **open**` — **#728 is resolved**.
  - (`#746` open ✓, `#777` open ✓, `#904` resolved ✓, `#658` resolved ✓ — those four are still right.)
  The "Open structural decision" section is doubly stale: **#1281 is resolved**, *and the ruling was already
  executed* — both #746 and #777 now carry `parent: "1255"` in frontmatter, i.e. the facet epics were
  re-parented, contradicting the card's "coordinates … by reference rather than re-parenting them".
  Definition of Done: "#170 closed" is now satisfied; only "#777 closed" remains.
  **DEAD-REFS** — 6 `/backlog/<slug>/` links whose slugs do not match the real filenames and which have no
  `formerSlugs:` alias to redirect them (checked: none of the targets declares `formerSlugs`):
  - `/backlog/170-the-plugs-runtime-is-duplicated-and-drifting-between-web-ev/` → `170-plugs-duplicated-across-webeverything-frontierui`
  - `/backlog/658-promote-frontierui-blocks-canonical-migrate-the-9-we-only-f/` → `…-fa`
  - `/backlog/728-component-embedding-capability-embed-a-live-component-examp/` → `…-exampl`
  - `/backlog/746-block-explorer-the-interactive-fui-block-workbench-live-the/` → `746-block-explorer-interactive-fui-block-workbench`
  - `/backlog/904-fui-block-impl-backfill-drift-enforcement-umbrella-for-the-/` → `904-close-the-10-block-contract-impl-drift-gaps-in-fui-flip-bloc`
  - `/backlog/934-we-docs-chrome-composes-real-we-traits-instead-of-hand-roll/` → `…-rolle`
- **suggested action:** edit card — refresh the facet-map statuses, delete/close-out the "Open structural
  decision" section (ratified + executed), fix the 6 links. This umbrella is now one child from its DoD.

## #1762 — Playwright e2e for the functional live-preview
- **verdict:** STALE-INFO (work genuinely NOT done)
- **confidence:** high
- **evidence:** `blockedBy: ["1761"]` — **#1761 is resolved** (as are #1759, #1760, #1746), so this card is
  ready to build now, not blocked. The work itself is real: `/home/user/frontierui/workbench/__tests__/e2e/`
  contains only `live-test-panel.spec.ts` and `workbench.spec.ts`; no spec in that directory mentions
  "functional".
- **suggested action:** edit card — clear `blockedBy` (or note the blocker resolved); it is a ready
  agent-sized task.

## #2379 — Fork-2 endgame: flip the a11y gate to enforce-by-default
- **verdict:** STALE-INFO (low severity — the substantive grounding re-verified as still accurate)
- **confidence:** high
- **evidence:** Re-verified against the tree today, all still true: `tests/a11y/sitemap-routes.ts` is 176
  lines with 33 `ENFORCED_ROUTES` entries and the stale-10 comment at lines 34-37; `isDrainComplete` at
  171-176; `tests/a11y/rendered-site-a11y.spec.ts` still has `const enforce = ENFORCE_ALL ||
  ENFORCED_ROUTES.has(path);` and the drain-trigger block at 71-99; `tests/smoke/rendered-site-smoke.spec.ts`
  imports `gatedRoutes` at line 16 and loops it at line 26 (exactly as cited);
  `/home/user/frontierui/tests/a11y/sitemap-routes.ts` has its own 8-entry `ENFORCED_ROUTES`.
  `git log -- tests/a11y/sitemap-routes.ts` shows no change since. Stale items:
  1. `blockedBy: ["2377","2376","2378","2375","3122"]` — **four of the five are resolved**; only #3122 is
     a live blocker.
  2. Grounding section says FUI is *"checked out at `/Users/nicolasgilbert/workspace/frontierui` in this
     environment"* — a machine-specific path that does not exist here (`/home/user/frontierui`).
- **suggested action:** edit card — trim `blockedBy` to `["3122"]`; drop the absolute FUI checkout path.

## #3122 — Remediate the 10 red warn-only WE-docs a11y routes
- **verdict:** OK
- **confidence:** medium (could not re-measure axe live — no dev server in this session)
- **evidence:** Every static claim re-verified: `tests/a11y/sitemap-routes.ts:34-37` still names the same
  10 routes as warn-only; `ENFORCED_ROUTES` is still the 33-entry post-#2378 set; the file's last commit
  is the same merge as everything else in the tree (no remediation since). #2376/#2377/#2378 all resolved
  as cited.
- **suggested action:** none.

## #1391 — Dev-browser shell build (umbrella)
- **verdict:** STALE-INFO + DEAD-REFS
- **confidence:** high
- **evidence:**
  - `blockedBy: ["2342"]` — **#2342 is resolved** (2026-07-09); the umbrella is not blocked.
  - **DEAD-REFS** — every plateau path in the body is pre-#2342:
    `plateau:src/technical-configurator/` → `packages/tooling/src/technical-configurator/`;
    `intent-configurator/` → `packages/tooling/src/intent-configurator/`;
    `profiles/` → `packages/saas/src/profiles/`;
    "Homed in `plateau:src/dev-browser/shell/`" → `packages/dev-browser/src/shell/`
    (verified: `/home/user/plateau-app/src/dev-browser` does not exist; `packages/dev-browser/src/shell/` does).
  - S1 (#1753) has landed its scaffold on plateau `main` (commit `fe2c210`) though its card is still
    `status: active`, so S2–S5 (#1754–#1757) are in practice unblocked.
- **suggested action:** edit card — repath all four, clear `blockedBy`, note S1's scaffold landed.

## #1754 — Dev-browser shell: navigation interception + takeover screen
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** The card's "Scope correction (verified against the tree, 2026-08-15)" and its "Hard
  sequencing note" are both now false:
  > "That directory also does not exist yet on `main` — **#1753 has not landed**, only been re-prepared
  > (its PR #1309 is doc-only…) … this PR cannot be authored, typechecked, or opened until #1753's shell
  > scaffold has actually merged to `main`"

  `/home/user/plateau-app/packages/dev-browser/src/shell/` now exists (commit `fe2c210`, "Dev-browser shell
  scaffold: Chromium shell + WE-conformance probe on load (#1753)") and contains exactly the files this card
  says it will extend: `main.ts` (`createShellWindow`, two `WebContentsView`s, `win.on('resize', layoutViews)`,
  `contentView.webContents.loadURL(targetUrl)`), `layout.ts` (`computeLayout`, `DEFAULT_CHROME_HEIGHT_PX`),
  `ipc.ts` (`PROBE_RESULT_CHANNEL = 'we:probe-result'`), `probe-preload.ts`, `chrome/chrome.ts`
  (`applyStatus`), `chrome/chrome-preload.ts`, `chrome/status.html`.
  Task 1 ("confirm its actual file names… its own card didn't pin the status page's exact HTML filename")
  is now answerable: the convention is `chrome/chrome.ts` + `chrome/chrome-preload.ts` + `chrome/status.html`
  (so the takeover mirror is `chrome/takeover.ts` / `takeover-preload.ts` / a second HTML in `chrome/`).
  Note: the electron `electron.d.ts:16687-16699` line cite could not be checked — `node_modules` is not
  installed in this clone (`packages/dev-browser/package.json` does pin `"electron": "^38.8.6"` as cited).
- **suggested action:** edit card — replace the Scope-correction / Hard-sequencing paragraphs with "#1753's
  scaffold landed (`fe2c210`); the files below exist", and pin the real chrome/* filenames. The card is
  buildable now.

## #1755 — Dev-browser shell: conformance-gated feature lighting
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** Of the card's two "verified against the tree (2026-08-15)" blockers, **blocker 1 is now
  false and blocker 2 is still true**:
  1. *"verified live: there is no `plateau:packages/dev-browser/src/shell/` directory in the tree at all
     (`find packages/dev-browser -iname "*shell*"` returns nothing), and `packages/dev-browser/package.json`'s
     own header comment calls it 'the future Electron shell (#1753)'"* — **both false**: the directory exists
     (commit `fe2c210`, 10 files incl. the `chrome/chrome.ts` `applyStatus(el, result)` this card cites as
     not-yet-existing), and that package.json's `description` now reads *"Plateau dev-browser — Electron
     shell + explorer surface (#2342, epic #2346)"*, with no "future" wording.
  2. **Still true** — `we:capability-manifest/check.ts:107` is verbatim
     `export const IMPLEMENTATION_MANIFESTS: readonly AdherenceInput[] = [];`, so **#3120 remains a real
     blocker**. `blockedBy: ["1753","3120"]` should narrow to `["3120"]`.
  "What IS settled" re-verified accurate: `packages/dev-browser/src/feature-lighting/{light,types,index}.ts`
  + `feature-lighting.test.ts` exist (#2212); the `packages/dev-browser/src/*` capability directories are as
  described.
- **suggested action:** edit card — strike blocker 1, narrow `blockedBy` to `["3120"]`, and move the "how
  does a lit/dark module state present in the shell chrome?" question from "not answerable today" to
  answerable (the chrome files now exist).

## #1756 — Dev-browser shell: embed plateau-app config panels via direct mount import
- **verdict:** DEAD-REFS (+ STALE-INFO)
- **confidence:** high
- **evidence:** All three cited mount paths are pre-#2342 and dead; the real ones (verified) are:
  - `plateau:src/technical-configurator/configurator.ts:639` → `packages/tooling/src/technical-configurator/configurator.ts:639` (`mountTechnicalConfigurator` — line still correct)
  - `plateau:src/intent-configurator/configurator.ts:421` → `packages/tooling/src/intent-configurator/configurator.ts:425` (`mountIntentConfigurator`)
  - `plateau:src/profiles/profiles-page.ts:165` → `packages/saas/src/profiles/profiles-page.ts:167` (`mountProfiles`)
  - "Home `plateau:src/dev-browser/shell/`" → `packages/dev-browser/src/shell/` (which now exists).
  `blockedBy: ["1753"]` — #1753's scaffold has landed (`fe2c210`) though its card is still `active`.
- **suggested action:** edit card — repath + re-line all three mounts and the home path.

## #1757 — Dev-browser shell: license-gating wiring
- **verdict:** DEAD-REFS
- **confidence:** high
- **evidence:** "Home `plateau:src/dev-browser/shell/`" is dead (`/home/user/plateau-app/src/dev-browser`
  does not exist); the real home is `packages/dev-browser/src/shell/` (post-#2342, landed `fe2c210`).
  The #1655 two-gate substance is unchanged and still accurate.
- **suggested action:** edit card — fix the home path; note #1753's scaffold has landed.

## #3120 — Dev-browser shell has no runtime-readable CapabilityManifest
- **verdict:** OK
- **confidence:** high
- **evidence:** Spot-checked every load-bearing citation and all hold:
  `we:capability-manifest/check.ts:107` `IMPLEMENTATION_MANIFESTS` is still `[]`;
  `we:capability-manifest/provider.ts` has `ConformanceLevel` at 31 / `ValidationFeatureId` at 41 and the
  OP-19 comment naming `ElementInternals` + `InjectorRoot.getProviderOf` at 120-127;
  `we:capability-manifest/guard.ts:51` `guardCapability`;
  `fui:plugs/webregistries/declarativeRegistry.ts` — `WE_DEVTOOLS_GLOBAL_HOOK` 330, `WebEverythingDevtoolsHook`
  340, `getActiveRegistryResult()` 350, `markWebEverythingActive` 368;
  `fui:plugs/webinjectors/InjectorRoot.ts:118` `getProviderOf`;
  `plateau:packages/core/src/probe/detect.ts:50` reads `win[WE_DEVTOOLS_GLOBAL_HOOK]`;
  `plateau:packages/extensions/src/chrome-extension/panel-detect.js:24` the eval string.
  `relatedReport` file and the `/research/live-page-we-conformance-detection/` topic both exist
  (`src/_data/researchTopics/live-page-we-conformance-detection.json`).
- **suggested action:** none — ready to ratify.

## #1294 — Relocate WE-resident logic reference runtimes to FUI
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** The card's framing is several months behind its own delivery.
  1. Title/intro: *"~10 pre-existing logic reference runtimes still live in WE in violation —
     `we:webpolicy/enforcement.ts` + `we:webpolicy/proof.ts`"* — **both files are gone**;
     `/home/user/web-everything/webpolicy/` now contains only `contract.ts`. Same for `webcompliance/`
     (contract.ts only), `process/` (contract.ts only), `reliability/`, `intl/`, `webtheme/`.
  2. The whole **"Why parked (gate not met — verified 2026-06-20)"** block and its "**Un-park when:**"
     conditions are obsolete (the card itself says un-parked 2026-06-26, but the parked section is still
     the second heading and reads as current).
  3. **"Slices (to carve on un-park)"** + "**Re-run `/slice 1294`**" are obsolete — the carve happened and
     landed: webpolicy #1799/#1800/#1801/#1802 ✓, webcompliance #1808/#1814/#1809/#1810/#1815 ✓,
     webprocess #2293/#2294/#2295/#2296/#2297 ✓, #1816 ✓. The Carve-status section still calls
     webcompliance "**CARVED.** Next ready" and process "**CARVED**" with an unstarted cascade.
  4. Residue is only the two clusters at the bottom: webtraits (#2298 open) and webcases (#2299/#2300 open)
     — confirmed on disk: `webtraits/surfaceIntentResolver.ts`, `webcases/driftCheck.ts`,
     `webcases/generateCase.ts` all still WE-resident.
  All five `relatedReport`/inline report paths exist.
- **suggested action:** edit card — delete the parked + to-carve sections, mark webcompliance/webprocess
  cascades DONE, and restate the epic as "residue = 3 open low-priority placement decisions (#2298, #2299,
  #2300) + their downstream slices".

## #2298 — webtraits surface resolver placement
- **verdict:** STALE-INFO (low — line-number citations only; the argument is sound)
- **confidence:** high
- **evidence:** Code citations verified: `we:webtraits/surfaceIntentResolver.ts` still holds
  `elevationShadow` (~line 70), the `blur(12px)` glass fallback (~97) and the `translateY(-2px)` /
  `0.2s ease` lift ramp (~119-123); `fui:webtheme/` holds both `tokens.ts` and `compile.ts` while
  `we:webtheme/` is `contract.ts` only (the precedent the card leans on); `src/_data/intents/surface.json`
  and `src/_data/assemblerPresets/hovercard.json` exist; the prep report exists.
  Stale: the `platform-decisions.md` **line numbers have drifted** — the card cites
  `{#constellation-placement}` as `we:docs/agent/platform-decisions.md:84-89` and `:86` for the
  "native-default strategies" clause, but that clause is now at **line 142** (section header at 136); and
  `#1816` is cited at `:421` while `{#non-verdict-conformance-matcher}` is now at **466**. The anchors
  themselves all still resolve.
- **suggested action:** edit card — re-cite by anchor only (or refresh the line numbers).

## #2299 — webcases driftCheck placement
- **verdict:** STALE-INFO (low — line-number citations only)
- **confidence:** high
- **evidence:** Code citations verified: `we:webcases/driftCheck.ts` still WE-resident, `detectDrift` at
  line 97, the *"a response as recorded from the real service"* comment at 22 / `RecordedResponse` at 23.
  Stale: `{#devtools-placement}` is cited as `we:docs/agent/platform-decisions.md:326-337` — the section
  header is now at **line 370**; the WE carve-out cited at `:338-342` is now at **~395**. Anchors resolve.
- **suggested action:** edit card — refresh those two line cites (or drop to anchors).

## #2300 — webcases generateCase placement
- **verdict:** STALE-INFO (low — line-number citations only)
- **confidence:** high
- **evidence:** Code citations verified: `we:webcases/generateCase.ts` — `RequirementProposer` interface at
  37, `validateRequirement`/`compileRequirement` at 81/86, `heuristicProposer` still `export function` at
  103 (the "one genuine defect" the card names is still present and still test-only).
  Stale: `{#no-leakage-client}` is cited as `we:docs/agent/platform-decisions.md:701-706`; that section is
  now at **line 757**. Anchor resolves.
- **suggested action:** edit card — refresh the line cite. Otherwise ready for its near-instant ratify.

## #3136 — FT screen: name the cross-slice "slot" + delegated-jump mechanism
- **verdict:** OK
- **confidence:** high
- **evidence:** Re-verified: all eleven related cards (#2705, #2721, #2723, #2725, #2726, #2727, #2728,
  #2729, #2731, #2732, #3132) are still **open**, so the coordination window the card describes is still
  open. Its "what actually exists on disk right now" claim still holds: `plateau-app:src/feature-tracker/`
  contains exactly one file, `feature-tracking.webcases.ts`. Precedent cites hold:
  `plateau-app:src/backlog-view/lane-board.ts:305` `renderInfraBanner`, its interpolation at `:1459`, the
  `data-cause`/`data-id` buttons at 295/322, the `.lb-infra-resume` branch of the delegated listener at
  ~1648-1651, and `plateau-app:src/main.ts:696` mounting by `getElementById`.
- **suggested action:** none.

## #2768 — Author + commit we:src/_data/authorModeSource.json
- **verdict:** OK
- **confidence:** high
- **evidence:** Both artifacts are still absent: `we:src/_data/authorModeSource.json` (ENOENT) and
  `we:conformance-vectors/surfaceVectors.ts` (ENOENT — the directory holds 15 other `*.vectors.ts`).
  `fui:tools/maas/__tests__/functionalAuthoringForm.test.mjs` still has `describe.skip(...)` at **lines 25
  and 49**, exactly as cited; `fui:vitest.config.ts` still carries an `exclude` entry for the paired
  `tools/gen-wrapper/__tests__/surfaceContract.test.mjs`. #2315/#1602/#1619 all exist as cited.
  Only unverifiable detail: the "~386 files today" count (not re-measured).
- **suggested action:** none.

---

### OK list
- #3120 OK · #3122 OK · #3136 OK · #2768 OK (#890 effectively OK — frontmatter/body status mismatch only)
