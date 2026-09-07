# Batch 04 — staleness audit (13 open cards), 2026-09-06

- ALREADY-DONE: 0
- SUPERSEDED: 0
- STALE-INFO: 8 (#142, #302, #428, #1648, #1694, #1697, #3115, #3140)
- STALE-PREMISE: 0 | DEAD-REFS (as secondary tag): 2 (#142, #302)
- OK: 5 (#554, #561, #1650, #1695, #3138)

No card in this batch is closeable. The dominant rot is **line-number/path drift in heavily-cited
prep cards** (`plateau-app:tsconfig.json` has shifted ~+7 lines since 2026-08-15, invalidating cited
anchors in #1697 and #3140) and **resolved blockers still listed as blocking** (#3140←#3139, #302←#217).

---

## #142 — AI-DX dev-experience feature family (epic)
- **verdict:** STALE-INFO (+ DEAD-REFS)
- **confidence:** high
- **evidence:**
  - The triage verdict's closing line — *"**Not yet applied** — the reclassification (retype the 20 to
    `story`, fold #1639) is a state change held for a human go"* — is no longer true. **8 of the 20
    have been retyped to `kind: story`** and parked: #1633, #1635, #1637, #1638, #1639, #1641, #1646,
    #1649 (frontmatter checked on each). #1650 was additionally converted `story → epic` (2026-08-15)
    and sliced into #3139/#3140/#3141.
  - **#1639 was NOT folded into #1631** as the verdict directs — it still exists as its own
    `backlog/1639-semantic-handoff-packets-between-roles.md`, `kind: story`, `status: parked`.
    #1631 is itself `resolved`.
  - The card presents itself as a 22-child pool; **the epic now has 34 children** (`grep -l 'parent:
    "142"' backlog/*.md` → 34). The 12 unlisted ones are the build stories the resolved decisions
    graduated into (#1663, #1667, #1689, #1690, #1691, #1692, #1693, #1694, #1695, #1696, #1697) plus
    the spun-out fork #3115. A reader of this epic cannot find the live work from the card.
  - **12 of the 22 listed children are now `resolved`** (#1631, #1632, #1634, #1636, #1640, #1642,
    #1643, #1644, #1645, #1647, #1651, #1652), so "Nothing here is a committed build yet" is stale —
    e.g. #1691 (variant simulator), #1692 (fault injector) and #1696 (scenario loader) have shipped
    code in `plateau-app:packages/dev-browser/src/{variant-simulator,fault-injector,scenario-loader}/`.
  - **DEAD-REFS (slug rot, low severity — the site has a slug-redirect layer so these may still
    resolve):** `/backlog/091-gap-2-webdocs-project/` → actual file is
    `backlog/091-web-docs-as-a-service-plateau.md`; `/backlog/1638-in-context-annotation-and-discussion-threads-on-semantic-no/`
    → actual slug ends `…-semantic-nod`.
- **suggested action:** edit card — (a) replace the "Not yet applied" sentence with the actual applied
  state (8 retyped, #1639 still unfolded, #1650 became an epic); (b) add a "Graduated build stories"
  section listing #1663/#1667/#1689–#1697/#3115 so the epic points at live work; (c) mark the 12
  resolved children; (d) fix the two slugs.

## #302 — Roll out the CLA to Frontier UI + Plateau and activate enforcement
- **verdict:** STALE-INFO (+ DEAD-REFS)
- **confidence:** high
- **evidence:**
  - The work itself is genuinely undone — `/home/user/frontierui/CLA.md` and
    `/home/user/plateau-app/CLA.md` do not exist; neither repo's `.github/workflows/` has a CLA
    workflow (FUI: `ci.yml` only; Plateau: `apply-review-request.yml`, `ci.yml`). Card stays open.
  - **Dead path:** the card asserts *"The CLA artifacts (`we:CLA.md` + `we:.github/workflows/cla.yml`,
    the CLA Assistant bot) now exist in Web Everything"* and the Scope bullet says to copy
    `we:.github/workflows/cla.yml`. **That file does not exist** — it is
    `we:.github/workflows/cla.yml.disabled` (the only cla* file in the tree). `we:CLA.md` does exist.
    The `.disabled` rename is unmentioned anywhere in `backlog/` or `docs/` (grepped).
  - The activation bullet ("replace the `OWNER/REPO` placeholders in each `we:cla.yml`") therefore
    points at a filename that isn't on disk, and understates the real first step: **re-enabling the WE
    workflow itself**.
  - **Stale blocker:** `blockedBy: ["217", "186"]` — **#217 is `resolved`**; only #186 (legal review,
    `status: open`) still blocks.
- **suggested action:** edit card — retarget every `cla.yml` reference to `cla.yml.disabled`, add a
  scope bullet "re-enable the WE workflow (rename `.yml.disabled` → `.yml`) before/with the rollout",
  and drop `217` from `blockedBy`.

## #428 — Web Docs open-core tiering mechanics
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:**
  - Still correctly parked: `blockedBy: ["554"]`, and **#554 is still `open`/parked** — the unpark
    trigger has not fired. The decision content (fork framing, prior art) is intact and the cited
    research topic exists (`src/_data/researchTopics/web-docs-open-core-tiering.json`), as do
    `src/_data/cases.js` and `reports/2026-06-12-web-docs-tiering-mechanics.md`.
  - **Stale dependency chain.** *"Build sequence once ratified: the tiering build is a plateau-app
    slice `blockedBy` #427, itself `blockedBy` the #424 generator + #425 primitives — so resolving this
    decision produces an unblocked build, not code."* **All three are now `resolved`** (#424, #425,
    #427). The chain has cleared; ratifying now would produce a *directly buildable* slice, not a
    still-chained one. Same for the Context section's *"surfaced by slicing epic #398"* — **#398 is
    `resolved`**.
  - **Internal stale label.** The Relationship-to-neighbours bullet for #427 says *"…where **Fork 2's**
    numbers are calibrated"*, but the section formerly called Fork 2 was dissolved on 2026-07-01 and
    is now headed "Settled (not a fork) — the free/paid threshold". There is no Fork 2 in the card.
- **suggested action:** edit card — update the build-sequence paragraph (#424/#425/#427/#398 all
  resolved; the ratify now unblocks an immediately-buildable slice) and rename the surviving "Fork 2"
  reference to "the settled threshold section".

## #554 — Plateau hosted SaaS product-suite shell
- **verdict:** OK
- **confidence:** high
- **evidence:** Parked-by-intent concept anchor; every cited neighbour resolves (#089 open epic, #428
  open/parked, #183 resolved, #398/#402 resolved, `/backlog/091-web-docs-as-a-service-plateau/` slug
  matches the real filename). #398/#402 having since shipped doesn't falsify anything the card
  claims — they are named as *candidate tenants*, which they still are. No edit needed.
- **suggested action:** none

## #561 — Auto-update operated runner surface + dashboard (hosted tier)
- **verdict:** OK
- **confidence:** high
- **evidence:** Every factual claim in the `humanGate` and body verifies: parent **#554 open/parked**;
  slice deps **#558, #559, #560 all `resolved`**; **#497 `resolved`**; the phase framing matches
  `plateau-app/CLAUDE.md`'s "THE PHASE RULE". Correctly parked as out-of-phase.
- **suggested action:** none

## #1648 — PII and sensitive-data flow map
- **verdict:** STALE-INFO (minor)
- **confidence:** medium
- **evidence:**
  - **The card's central gate still holds** — I verified there is no visibility/persistence/egress
    facet classification anywhere: `grep -rn "StoragePersistence"` across WE + FUI hits only
    `frontierui/plugs/webstates/{index.ts,__tests__/…}`, which is the **browser storage-quota API**
    (`navigator.storage` persist/persisted/estimate), *not* a per-state-node persistence facet. #1089
    and #1106 are both `resolved` and neither delivered the classification. So step 1 of the ratify
    question ("do the declared state facets exist?") is still legitimately open and answers "no".
  - **Stale sequencing statement.** Twice the card says *"decide #1632 first so this reuses its seam
    model"* and gates on *"#1632 has landed a seam model"*. **#1632 is `resolved`** (2026-06-23,
    `graduatedTo: 1697`) — the decision is made. The thing that must actually land is the *build*,
    **#1697** (`status: open`, unbuilt — `plateau-app:packages/dev-browser/src/contract-inspector/`
    does not exist).
- **suggested action:** edit card — repoint the "decide #1632 first" line and un-gate condition (2)
  from #1632 to **#1697** (the build story #1632 graduated into), and note that step 1's answer is
  currently a verified "no" (no facet classification exists as of 2026-09).

## #1650 — Safe-edit sandbox emitting a PR (epic)
- **verdict:** OK
- **confidence:** high
- **evidence:** The umbrella note verifies end-to-end. Cited already-shipped infrastructure is real
  and on disk: `plateau-app:packages/dev-browser/src/{element-resolver,ide-bridge,forge,pr-body,
  credential-source,declared-rules}/` (#1690/#576/#577/#598/#601/#600/#1689 — all `resolved`).
  `we:scripts/autofix/engine.mjs` exists and `npm run autofix` is a real script. Slice status matches
  reality: **#3139 `resolved` 2026-08-16** (`packages/dev-browser/src/safe-edit/buffer.ts` exists),
  #3140 and #3141 open. The "out of scope: no dev-browser panel/UI exists yet to mount these" caveat
  is still true — `safe-edit/` contains only `buffer.ts`/`types.ts`/`index.ts`/`buffer.test.ts`, no
  panel. The #3138 live-preview follow-up exists.
  *(Only cosmetic wrinkle, not worth an edit: the retained "Recommendation" section still says #095
  "isn't settled" while the Dependencies section and the top note both correct it to shipped — the
  card explicitly labels that block as retained historical rationale.)*
- **suggested action:** none

## #1694 — In-browser standard-aware review lens (dev browser)
- **verdict:** STALE-INFO (minor)
- **confidence:** high
- **evidence:**
  - Core state verifies: `blockedBy: ["3115"]` and **#3115 is still `open`** — correctly blocked. The
    "red herring" rulings hold (#1391 open/blocked, #1753 active, #1656 resolved-but-status-slot-only).
    #1696's proven pattern is real: `plateau-app:packages/dev-browser/src/scenario-loader/panel.ts` +
    `plateau-app:tests/e2e/scenario-loader-roundtrip.spec.ts` both exist.
  - **Inaccurate citation:** the prep note states *"`registry.register(` fires nowhere outside
    `plateau:packages/dev-browser/src/element-resolver/element-resolver.test.ts:52`"*. There are now
    **six further `reg.register(` call sites** in
    `plateau-app:packages/dev-browser/src/declared-rules/declared-rules.test.ts` (lines 65, 67, 75, 97,
    106, 107). The *substantive* claim ("no app declares rules — every call site is a test fixture")
    still holds, and `grep -rn conformanceLevel` still returns only `feature-lighting/` hits, so the
    conclusion is unaffected.
- **suggested action:** edit card — soften "the only call site" to "every call site is a test fixture
  (`element-resolver.test.ts`, `declared-rules.test.ts`); no app registers rules."

## #1695 — Permission and identity simulator (dev browser)
- **verdict:** OK
- **confidence:** high
- **evidence:** Unusually well-grounded and every checkable claim still holds as of today:
  `we:permissions/contract.ts` exists and `PermissionDecision` really is at ~line 83;
  `we:contracts/package.json:52` really is `"./permissions": "./permissions.ts"` (and
  `contracts/permissions.ts` exists); **zero `PermissionModel`/`webpermissions` hits across plateau-app
  and frontierui** (re-grepped — the "unconsumed" premise is intact); `plateau-app:tsconfig.json` still
  has **no** `@webeverything/contracts/permissions` entry; `packages/dev-browser/src/permission-simulator/`
  still does not exist (all 6 scope paths are net-new, correctly); `variant-simulator/`,
  `intent-inspector/`, `scenario-loader/`, `feature-lighting/` all exist as cited;
  `frontierui/demos/auto-insurance/app.ts:58` really is `const ACTOR = { role: 'agent' as const };`;
  #1699/#1060/#1061/#1691/#1696 statuses all match. The `humanGate` already carries the
  "#1699 note is stale" correction and the body's Prepared note repeats it explicitly.
- **suggested action:** none

## #1697 — Live contract and data inspector at provider/context seams (dev browser)
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** The design and all substantive premises verify — `we:webcontexts/contract.ts` +
  `we:contracts/webcontexts.ts` exist with the `"./webcontexts"` export at `contracts/package.json:53`
  ✓; `grep -rn ValueShape` over plateau-app is still **zero hits**; `contract-inspector/` still does
  not exist; plateau-app still has **no** `@webeverything/contracts/webcontexts` alias;
  `plateau-app:src/platform-manager/types.ts:32-39` really is the unrelated `SeamContract` ✓.
  But **every `plateau-app:tsconfig.json` line citation has drifted** (the file grew ~7 lines since
  2026-08-15), and one capture citation is off:

  | Card says | Actual today |
  |---|---|
  | `@plateau/dev-browser/*` at tsconfig `:107-108` | line **115** |
  | webpolicy at tsconfig `:61` | line **68** |
  | webcompliance at tsconfig `:62` | line **69** |
  | webdocs at tsconfig `:74` | line **81** |
  | backlog at tsconfig `:58` | line **65** (line 58 is now `repro-bundle`) |
  | "checked plateau-app:tsconfig.json:**44-79**" (no webcontexts entry) | the alias table now runs past line 90 |
  | `capture/types.ts:69` `snapshotDeclaredState` | line **71** |
  | `capture/types.ts:21` `DeclaredState` | line 21 ✓ still correct |

- **suggested action:** edit card — restate the tsconfig anchors by *name* rather than line number
  (e.g. "alongside the `@webeverything/contracts/webpolicy` entry") so this card stops rotting on every
  tsconfig edit; fix `capture/types.ts:69` → `:71`.

## #3115 — Declared-conformance drift signal for the standard-aware review assistant
- **verdict:** STALE-INFO (minor)
- **confidence:** high
- **evidence:** The fork is genuinely still open and every structural citation resolves:
  `plateau-app:packages/dev-browser/declared-rules/{registry,types,index}.ts` ✓,
  `packages/core/src/conformance-engine/{conformanceVectors,conformanceEmbed,embedSuites}.ts` ✓,
  `feature-lighting/light.ts` ✓, `scenario-loader/panel.ts` ✓,
  `tests/e2e/scenario-loader-roundtrip.spec.ts` ✓, `extensions/src/chrome-extension/panel.js` ✓;
  #1689/#1690/#1696/#2210 resolved, #1693 parked, #1391 open, #1753 active — all as stated.
  Same single inaccuracy as #1694: *"`registry.register(` fires nowhere outside a test fixture
  (`…element-resolver.test.ts:52` is the only call site)"* — `declared-rules.test.ts` now has six more
  register calls (all still tests, so the conclusion stands).
- **suggested action:** edit card — same one-line correction as #1694 ("every call site is a test
  fixture", drop "the only call site").

## #3138 — Safe-edit sandbox: live preview against a running instance
- **verdict:** OK
- **confidence:** high
- **evidence:** Short, accurate, and its premise is verified: the epic's three slices genuinely never
  apply buffer content to a running instance — `plateau-app:packages/dev-browser/src/safe-edit/` holds
  only `buffer.ts`/`types.ts`/`index.ts`/`buffer.test.ts` (no DOM/fs/preview code), #3140's scope is
  `verify-gate.ts` only, #3141 is emit-orchestration. Parent #1650 open; correctly flagged `unprepared`.
- **suggested action:** none

## #3140 — Safe-edit sandbox: verify-gate wiring over declared rules
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:**
  - **Stale blocker (the actionable one).** `blockedBy: ["3139"]` and the body's *"Blocked on Slice 1 —
    #3139 — for the `SafeEditBuffer` this wraps"*. **#3139 is `resolved` (2026-08-16)** and
    `plateau-app:packages/dev-browser/src/safe-edit/buffer.ts:36` exports `class SafeEditBuffer` with
    the `write`-throws-on-absent-key contract (`buffer.ts:58-61`), `token()` (`:86`) and `isCurrent()`
    (`:104`) the card's later rounds depend on. **This card is unblocked and buildable now** — its
    frontmatter says otherwise.
  - **Stale count.** *"6 vitest cases at `we:scripts/autofix/__tests__/engine.test.mjs`"* — the file
    now has **17 `it(` cases across 4 describes**; the `#095` describe alone (lines 53-214) has **9**.
  - **Stale line refs.** `plateau-app:tsconfig.json` "line 80: `@webeverything/conformance-vectors/schema`"
    → actually **line 87** (same +7 drift as #1697).
    `we:backlog/3139-…md:192` cited as the Interfaces block "Throws if no edit is pending for `key`" →
    that text is at **line 142**; line 192 is a Tasks bullet.
  - **Mislabeled repo prefix:** `we:packages/core/src/conformance-engine/conformanceVectors.ts:297-301`
    — that file is in **plateau-app**, not WE (the card catches itself with a parenthetical "in the
    `plateau-app` repo", but the `we:` prefix is wrong). The cited awaits are real
    (`conformanceVectors.ts:300-301`).
  - Engine line refs into `we:scripts/autofix/engine.mjs` (293, 330/331, 353, 363; file is 366 lines)
    all still land correctly — **that** set of citations has not rotted.
- **suggested action:** edit card — clear `blockedBy: ["3139"]` (blocker resolved) and drop the
  "Blocked on Slice 1" sentence; fix "6 vitest cases" → 9 (in the `#095` describe); repoint tsconfig
  `:80` → `:87` (or by name); fix `3139-….md:192` → `:142`; correct the `we:` prefix on the
  `conformanceVectors.ts` citation to `plateau-app:`.
