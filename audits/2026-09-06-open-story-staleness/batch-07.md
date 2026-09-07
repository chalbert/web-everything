# Batch 07 — staleness audit (11 cards), 2026-09-06

- ALREADY-DONE: 0
- SUPERSEDED: 0
- STALE-INFO: 5 (#2249, #2079, #2096, #2255, #2256)
- STALE-PREMISE: 0 · DEAD-REFS (primary verdict): 1 (#2250)
- OK: 5 (#2251, #2252, #2253, #2254, #3013)
- Highest-value: **#2096** — its three forks appear to have been built and shipped (`src/spec-pages.njk`
  cites "#2096 Fork 1-a", `normativeSpecs.js` says "ratified by #2096") while the card is still `open`
  with no ratification recorded, and its resolved child #2097 is blocked on it.

---

## #2249 — Decide the system-wide visual language (flat vs rich-dimensional)
- **verdict:** STALE-INFO (minor) — the substance of the card is current
- **confidence:** high
- **evidence:**
  - Everything the grounding digest asserts is still literally true, verified by reading the files:
    `/home/user/web-everything/src/assets/logo.svg` is still the flat 40×40 `rx="12"` squircle with a
    2-stop `#4f46e5`→`#9333ea` gradient (lines 13–16) and the white `stroke-width="2.5"` W (line 6) +
    `stroke-opacity="0.6"` ghost-E (line 11). `/home/user/plateau-app/branding-proposals/loop/plateau-rich-a.svg`
    still carries `feDropShadow` at line 8, the `pra_front` white→pale-blue face gradient at 5–6, and the
    `pra_glow` radialGradient at 9–10 — all three line cites resolve.
    `/home/user/web-everything/reports/2026-07-04-constellation-visual-language-and-color-architecture.md`
    and `/home/user/plateau-app/branding.html#journeys` both exist. Nothing has shipped; the fork is live.
  - **Stale statement:** the Axis-framing and Fork-1 text call #2209 Fork 2's per-size variant policy
    *"ratified"* ("composes with #2209 Fork 2's **ratified** per-size variant policy", Supported-by-default
    bullet 1). `/home/user/web-everything/backlog/2209-ratify-the-constellation-branding-system-naming-marks-icon-r.md`
    is `status: open`, `preparedDate: "2026-07-03"`, **no `resolvedDate` and no `## Ratified`/`RULED`
    section anywhere in the file** (grepped). Its own line 281 still reads "**On ratify, file the
    children:** WE favicon small-variant (Fork 2) …". Sibling cards #2251/#2253/#2254/#2255 all correctly
    describe #2209 as unratified — only #2249/#2250 assert otherwise.
- **suggested action:** edit card — replace "#2209 Fork 2's ratified per-size variant policy" with
  "#2209 Fork 2's **prepared (unratified)** per-size variant policy" (2 occurrences: Axis-framing para and
  the first Supported-by-default bullet). No other change; the fork itself is current.

## #2250 — WE mark system: multi-color umbrella vs monochrome
- **verdict:** DEAD-REFS (primary) + STALE-INFO (same "ratified #2209" error as #2249)
- **confidence:** high
- **evidence:**
  - **Dead ref (×2, one with a line number): `plateau:branding-proposals/loop/we-venn-lumin.svg` does not
    exist.** Cited at card line 28 ("overlaps three translucent radial circles under
    `mix-blend-mode:screen` (`:16`)") and again at line 127 (the ban clause:
    "`mix-blend-mode:screen` (`plateau:branding-proposals/loop/we-venn-lumin.svg:16`)").
    `find /home/user/plateau-app -iname '*lumin*'` → nothing; no file of that name in
    `/home/user/plateau-app/branding-proposals/loop/` (dir listed in full) or anywhere in the repo.
    The real `mix-blend-mode` probes are the `weB-venn-*` family:
    `weB-venn-constellation.svg`, `weB-venn-constellation-grad.svg`, `weB-venn-constellation-v2.svg`,
    `weB-venn-constellation-v3.svg`, `weB-venn-rgb.svg` (the 5 files that actually contain
    `mix-blend-mode`). #2251 cites the same family correctly as `weB-venn-constellation-v2.svg`.
  - **Dead ref: `plateau:branding-proposals/loop/we-venn-flat.svg` does not exist** (card line 30,
    "siblings `weB-venn-constellation.svg` / `we-venn-flat.svg`"). Only `weB-venn-*` files exist.
    `weB-venn-constellation.svg` in that same sentence is real.
  - **Stale line cite:** card line ~19 cites `we:src/assets/logo.svg:13-14` for the `#4f46e5`→`#9333ea`
    stops. Line 13 is `<defs>`, 14 is `<linearGradient …>`; the two `<stop>` elements are lines **15–16**.
  - **Stale statement (same as #2249):** "#2209 Fork 2's **ratified** mono-W-≤32px favicon" (Axis-framing)
    and "#2209 Fork 2's ratified default degrades the WE favicon…" — #2209 is `status: open`, unratified
    (see #2249 evidence above).
  - Still-valid: fork is live, WE logo/favicon unchanged (2-stop), `plateau:branding.html#journeys` exists
    and contains the `WE-37`/`WE-38` node ids the digest names.
- **suggested action:** edit card — replace both `we-venn-lumin.svg` cites with the real probe
  (`plateau:branding-proposals/loop/weB-venn-constellation.svg`, which does carry `mix-blend-mode`), drop
  or correct `we-venn-flat.svg`, fix the logo.svg stop cite to `:15-16`, and downgrade the two "ratified
  #2209 Fork 2" phrasings to "prepared". Do not resolve — the fork is genuinely open.

## #2251 — Finalize the Web Everything mark
- **verdict:** OK (with one cosmetic edit suggestion)
- **confidence:** high
- **evidence:** every claim re-verified live. `#2249` and `#2250` both still `status: open` with
  `preparedDate` set and no `resolvedDate`. `we:src/assets/logo.svg` (40×40, `rx="12"`, 2-stop
  `#4f46e5`→`#9333ea`, W `stroke-width="2.5"` + `stroke-opacity="0.6"` echo-E) and `we:src/assets/favicon.svg`
  (`width="32" height="32" viewBox="0 0 40 40"`) are byte-for-byte the flat baseline described.
  Consumer cites are exact: `we:src/_layouts/base.njk:8` is the `<link rel="icon" … href="/assets/favicon.svg">`,
  `:39` is the `<img src="/assets/logo.svg">`, `we:src/_data/chrome.js:16` is `logoSrc: '/assets/logo.svg'`.
  `we:skills-src/brand-mark-loop/SKILL.md`, `plateau:scripts/render-mark.mjs`, `plateau:branding-refs/*.json`,
  `plateau:package.json:22` (`gen:branding`) all exist. `plateau:branding-proposals/loop/LOOP-LOG.md:68-76`
  is exactly the "constellation Venn = the breakthrough lead" passage quoted. `#2250`'s ban clause is at
  `2250-*.md:124-129` as cited.
- **suggested action:** none required. Optional: the **filename slug still says
  `…-constellation-venn.md`** while the H1 and the whole body have moved off the Venn (which #2250 now
  bans) — a rename to match the title would remove the last "build the Venn" signal, but that costs a
  redirect entry, so leave unless the card is being touched anyway.

## #2252 — Finalize the Frontier UI mark
- **verdict:** OK (one stale cross-reference)
- **confidence:** high
- **evidence:** `fui:src/assets/logo.svg` still renders the F/U/I letterforms with `fui_gradient`
  `#0d9488`→`#06b6d4`; `fui:src/assets/favicon.svg` is `width="32" height="32"` with id `fui_fav` — both
  exactly as the card's "Decided design" describes. Consumer cites exact: `fui:src/_layouts/base.njk:28`
  (`<img src="/assets/logo.svg" … width="32" height="32">`), `:7` (`<link rel="icon">`), `fui:.eleventy.js:7`
  (`addPassthroughCopy("src/assets")`). All three shortlist files exist:
  `plateau:branding-proposals/explore/fui3e-advance.svg`, `fui3h-ground-edge.svg`, `fui3m-edge-post.svg`.
  `plateau:branding-proposals/journey.json`'s `fui` journey ends at "Round 3 — mesa-family, learned
  constraints" with `FUI-12`/`FUI-18`/`FUI-21` all `verdict: "candidate"` and no `review` — i.e. the loop
  has NOT run; the card's work is genuinely outstanding. Finding 3's "no `check:branding` script in either
  repo" confirmed (`grep check:branding` on all three package.json files → no hits). `LOCI` entries in
  `we:scripts/check-standards-rules.mjs:169-170` match the stated gate commands exactly.
- **suggested action:** edit card (one word) — finding 5 says "heavier than **#2253 (Plateau, size 3**,
  refinement …)"; #2253's frontmatter is now `size: 2` (its own prep revised 3→2). Change "size 3" → "size 2".

## #2253 — Finalize the Plateau mark
- **verdict:** OK
- **confidence:** high
- **evidence:** every single grounded finding re-verified. `plateau:index.html:7` is the `<link rel="icon"
  href="/favicon.svg">`; `plateau:index.html:23` is `<symbol id="mesa-mark" …>`; `plateau:index.html:20-21`
  is the `#mesaGrad` linearGradient with `stop-color="#6453f4"`. `plateau:favicon.svg:9` is
  `stop-color="#6d5efc"` — so the two-copies-disagree drift finding is still live and unfixed.
  Sizes: `.sidebar-brand-mark` 30px (`src/styles/layout.css:69-75`), `.auth-mark` 34px
  (`layout.css:94-99`, used at `index.html:305,336,370` — exactly 3 instances), `.pricing-brand svg` 36px
  (`packages/saas/src/marketing/pricing.ts:72`). `journey.json`'s `plateau` journey still has one round
  with `PLT-01: "promising"` / `PLT-02: "heavier"` (not `"excluded"`), and `LOOP-LOG.md` still has no
  `## Plateau — log` section (sections are: Standing findings, WE — log, FUI — log, Next-round queue,
  WE — log (cont.)) — so the whole deliverable is genuinely outstanding.
  `2249-*.md:118-129` is indeed the size-gating "Supported by default" text quoted.
- **suggested action:** none.

## #2254 — Web Everything website UI — review & redesign direction
- **verdict:** OK
- **confidence:** high
- **evidence:** the page inventory is exact — `we:src/_data/chrome.js` yields **15** nav links
  (Standards: intents/blocks/capabilities/protocols/design-systems/presets/semantics = 7; Explore:
  demos/conformance/validation-rules/research/backlog = 5; About: mission/governance/author = 3) + home
  = **16**, as claimed. All three named generated-page templates exist (`src/backlog-pages.njk`,
  `src/adapter-pages.njk`, `src/spec-pages.njk`; 15 `*-pages.njk` in total).
  `we:skills-src/review-design/SKILL.md` exists; #1035 (the skill) and #1034 (the rubric) are both
  `status: resolved`, so "Phase A is buildable today" holds. #2249 and #2209 both still `status: open`,
  so both `blockedBy` edges are live. #2207 still `status: open`. No website-UI-review report exists yet
  under `we:reports/` (only `2026-07-01-we-standard-vs-website-boundary.md`), so nothing has been done.
  `plateau:branding-refs.html` (249 KB) and `plateau:branding.html` (430 KB) both present.
- **suggested action:** none.

## #2255 — Ratify #2209 and roll out the brand assets
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence — stale statements (the card's own status section, dated 2026-08-15):**
  1. *"#2251 and #2252 are themselves **mid-preparation right now**, not yet build-ready, let alone
     executed: open PRs `chalbert/web-everything#1303` … and `#1311` … as of this writing."* — **those
     prep PRs have landed.** `we:backlog/2251-*.md` and `we:backlog/2252-*.md` both now carry their full
     `## Status: blocked, not build-ready (prep finding, 2026-08-15)` / `## Grounded findings (2026-08-15
     prep)` sections on disk. #2252 is now fully build-ready-once-unblocked (Decided design + Tasks +
     Done-when); #2251 is prepared-and-blocked. Neither is "mid-preparation".
  2. *"#2253 has no PR at all — **not yet touched**."* — false now: `we:backlog/2253-*.md` carries a
     complete `## Grounded findings (2026-08-15 prep)` (6 findings), a `## Decided design` ("ship no
     change"), Tasks, and Done-when, and its size was revised 3 → 2 by that prep.
  3. *"against `we:src/assets/icons/*.svg` (**70 files**)"* — the live set is **63** `.svg` files
     (`ls src/assets/icons/*.svg | wc -l` = 63). The derived findings in the same paragraph all still
     reproduce exactly, so only the population count is wrong: `weblayout.svg` is the sole
     `viewBox="0 0 24 24"`; **exactly the 18 named files** are below `stroke-width` 6 (re-measured
     file-by-file: prefetch 4, range-anchor 5, suggested-edit 2.5, webcharts 2, webdecisions 3, webgraph
     2.5, webguards 3, webintl 5, webisolation 5, weblayout 1.75, webpolicy 3, webportals 4,
     webpositioning 3, webregistries 2, webresources 3, webrouting 2.5, webstates 2, webtheme 3 — an
     exact match); `_template.svg` defines exactly 4 gradients (gradRed/gradIndigo/gradPurple/gradSky)
     against **73** distinct `linearGradient` ids live ("70+" holds).
  4. **Misquote:** the card presents *"Ratify **#2209** with all the above folded in; then execute the
     asset rollout"* as a quote from `plateau:branding-proposals/TRANSITION.md:50-51`. That line actually
     reads *"Ratify **#2191** …"* (TRANSITION.md predates the renumbering; #2191 today is an unrelated
     card, "Route close-out commits…"). The renumber is almost certainly right, but it is presented as a
     verbatim quote and is not one.
- **evidence — everything else verified still true:** `we:src/index.njk:66`/`:68` are the frontierui/plateau
  icon entries; `we:src/_layouts/base.njk:8` is the sole `<link rel="icon">`;
  `we:src/assets/icons/webtraces.svg` is still the unmodified `_template.svg` placeholder (single
  `<circle … fill="url(#gradIndigo)">`); `plateau.svg` is still amber `#f59e0b`→`#d97706`;
  `frontierui.svg` is still `fuiGrad` `#0d9488`→`#06b6d4` letterforms; `TRANSITION.md:65` is exactly the
  "FUI 14° / WE 28° / mesa 61°" line; `scanRepoLocusPrefixes` (`check-standards-rules.mjs:1841`) and
  `validatePlugWeFuiDrift` (`:2009`) exist as the cited wiring precedent; no `check:branding` script
  exists in any repo. All five `blockedBy` items (#2209, #2250, #2251, #2252, #2253) are still open.
- **suggested action:** edit card — rewrite the two PR-state bullets to "#2251, #2252 and #2253 are now
  prepared (blocked, not started); #2253's prep found zero asset edits and resized it 3→2", fix the icon
  population count 70 → 63, and mark the TRANSITION.md quote as renumbered (`#2191` in the source).
  Do NOT resolve — every blocker is live.

## #2256 — Constellation branding and website design (epic)
- **verdict:** STALE-INFO (minor — the epic's core "zero shipped outcomes" claim is still exactly right)
- **confidence:** high
- **evidence — still true, re-verified:** every "NOT done" bullet holds. No mark shipped on any project
  (`we:src/assets/logo.svg` + `favicon.svg`, `fui:src/assets/logo.svg` + `favicon.svg`,
  `plateau:favicon.svg` all unchanged from the pre-decision baseline); #2209 `status: open`, unratified;
  visual language undecided (#2249 open); website not reviewed (no report under `we:reports/`);
  no `check:branding` script in any of the three repos. All seven children (#2249–#2255) exist and are
  `status: open`, and the transition order matches each child's `blockedBy` graph. `relatedTo` #2209,
  #2207, #2208 all exist (#2207 open story, #2208 open epic). `plateau:branding.html` (430 KB, with the
  `#journeys` anchor), `plateau:branding-refs.html`, `plateau:branding-proposals/TRANSITION.md`,
  `plateau:branding-proposals/loop/LOOP-LOG.md`, `plateau:scripts/render-mark.mjs`, and
  `we:skills-src/brand-mark-loop/SKILL.md` all exist. **"85 cited case studies" is exact** —
  `ls plateau:branding-refs/*.json` = 85.
- **evidence — stale statements:**
  1. *"**~40** explored candidate marks across 8 WE rounds + 3 FUI rounds + 1 Plateau probe"* — the round
     counts are exact (`journey.json`: WE Rounds 1–8, FUI Rounds 1–3, Plateau 1 probe, each plus a
     Round-0 incumbent node), but the candidate total is an undercount: **65 candidates** (WE 40, FUI 23,
     Plateau 2), 67 nodes including the two Round-0 incumbents. "~40" is WE's count alone, not the total.
  2. The `## Status honest snapshot` is stamped **(2026-07-04)** and the child cards have moved
     substantially since (all of #2251–#2255 gained full 2026-08-15 prep sections; #2253's prep found a
     zero-asset-edit design and resized 3→2). Nothing in the snapshot is *contradicted*, but it no longer
     reflects the current readiness of the children.
  3. `plateau:branding-proposals/TRANSITION.md` — named here as the "full handoff + recommended order" —
     still uses the **pre-renumber ids `#2191` (→ #2209) and `#2192` (→ #2207)** in its steps 4 and 5.
     `#2191` and `#2192` today are unrelated cards (memory-index / close-out-commit items), so a reader
     following the epic's pointer lands on a doc whose `#N` refs mislead.
- **suggested action:** edit card — correct "~40" to "~65 explored candidate marks (WE 40 / FUI 23 /
  Plateau 2)", re-date the snapshot to note that #2249–#2255 are now all prepared-and-blocked rather than
  unprepared, and either renumber `TRANSITION.md`'s `#2191`/`#2192` refs (plateau-app edit) or add a
  one-line "TRANSITION.md predates the renumber: #2191 = #2209, #2192 = #2207" caveat next to the pointer.
  Keep open — the epic's actual outcomes are genuinely unshipped.

## #3013 — Rule the safety model for routine merges: detect-and-revert, not prevent-everything
- **verdict:** OK
- **confidence:** high
- **evidence:** the card's own reason for staying `open` still holds exactly as written — *"`codifiedIn`
  is blocked on the four statute collisions"*. Verified live: **no `codifiedIn` field** in the frontmatter
  and **no #3013 anchor** in `we:docs/agent/platform-decisions.md` (grep for `3013` → 0 hits).
  `enforceFlipReady` **still does not exist** in the tree — the only occurrences are the citation-gate's
  own negative fixtures (`scripts/lib/citation-check.mjs`, `scripts/__tests__/citation-check.test.mjs`)
  and prose comments; `scripts/lib/decision-routing.mjs` carries only `computeAgreementMetric` /
  `resolveLandMode`, exactly as the card's refutation table says. `we:scripts/lib/review-policy.contract.json`
  still has no always-review blacklist / irreversibility term (keys: contract, version, summary,
  thresholds, todoMarker, reasons, disposition, careJury) — so Fork 2's ruled data has not landed either.
  Collision anchors all still resolve and are resolved items: #2840, #2838, #2851, #2771, #2563, #2398 all
  `status: resolved`. #3007 (the ratified throughput path the ruling defers to) is still `open`.
  All `relatedTo` refs exist (#3021, #3024, #3039 present).
- **note (not a finding):** #3046, listed among the separately-filed gate defects, has since resolved
  (`status: resolved`); #3047 is still open. The card does not assert either is open, so nothing is
  actually wrong — but a future editor may want to strike #3046 from the "defects, separately filed" list.
- **suggested action:** none. (If touched: the item is ruled-but-uncodified; the unblocking action is
  writing the statute text, not more judgment.)

## #2079 — Author W3C-spec-shaped normative standards for every WE standard
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence — stale statements:**
  1. *"'Every current standard' enumerates to **279 registry entries** — 81 blocks / 98 intents /
     59 plugs / 41 protocols"* — live counts are **283**: blocks 81 ✓, **intents 100** (+2),
     **plugs 60** (+1), **protocols 42** (+1) (`ls src/_data/{blocks,intents,plugs,protocols}/*.json`).
  2. *"with **zero RFC-2119 language in any of them today**"* — no longer true. The register shipped:
     `we:src/_includes/spec-descriptions/plugs/customnoderegistry.njk` exists and contains 13
     MUST/SHOULD/MAY occurrences, rendered at `/specs/plugs/customnoderegistry/` by
     `we:src/spec-pages.njk` off `we:src/_data/normativeSpecs.js`. (The four *registry* surfaces still
     carry none, so the sentence is right about the registries and wrong about "any of them".)
  3. *"the per-category authoring waves are carved after those land … re-run `/slice 2079` once #2096
     resolves and **#2097 calibrates effort-per-spec**"* — **#2097 is `status: resolved`,
     `dateResolved: "2026-07-03"`**; the calibration half of that condition is already met (only #2096's
     ratification is outstanding). The epic reads as if neither child has moved.
  - Still valid: `#2096` open, `#2074` resolved (the conformance-table shape template is real),
    `we:reports/2026-07-02-backlog-split-analysis.md` exists.
- **suggested action:** edit card — refresh the counts to 283 (81/100/60/42), replace "zero RFC-2119
  language in any of them today" with "zero RFC-2119 language in the four registries; one normative spec
  authored (`spec-descriptions/plugs/customnoderegistry.njk`, #2097)", and state that #2097 has landed so
  the remaining `/slice 2079` precondition is #2096's ratification alone. Keep open — the 280+ authoring
  waves are genuinely unbuilt.

## #2096 — Spec register — home, skeleton house style, and scope policy for normative WE specs
- **verdict:** STALE-INFO (strong — borderline "already ratified in practice, never recorded")
- **confidence:** medium-high on the staleness; **deliberately NOT calling this ALREADY-DONE**, because a
  `kind: decision` closes only by explicit ratification, which this repo's own statute forbids inferring.
- **evidence — the card's opening premise is now false, and its defaults appear to have been built:**
  - Card lede: *"**Prepared for ratification.** No normative spec surface exists today (zero RFC-2119
    language across all 279 registry standards), **so this is greenfield**."* The surface exists:
    - `/home/user/web-everything/src/spec-pages.njk` — a size-1 pagination template whose header comment
      reads verbatim *"Normative spec pages (**#2096 Fork 1-a**, piloted by #2097). Renders at
      /specs/<category>/<id>/ using the spec partial at src/_includes/spec-descriptions/<category>/<id>.njk"*
      — i.e. Fork 1 option (a) exactly as recommended, permalink and all.
    - `/home/user/web-everything/src/_data/normativeSpecs.js` — header comment reads *"**The skeleton and
      home are ratified by #2096**"* and *"**Scope policy (Fork 3-a of #2096)**: active ⇒ spec required;
      draft/experimental ⇒ permitted + required for promotion; concept ⇒ exempt."* The shipped code
      treats all three forks as ruled on their bold defaults.
    - `/home/user/web-everything/src/_includes/spec-descriptions/plugs/customnoderegistry.njk` — the
      authored pilot spec, 13 RFC-2119 keywords.
  - Its own child **#2097 is `status: resolved` (`dateResolved: "2026-07-03"`) while still carrying
    `blockedBy: ["2096"]`** — a resolved item blocked on an open blocker, and its H1 is literally
    "Pilot normative spec — CustomNodeRegistry (#2074) in the **ratified** skeleton". So the pilot ran on
    the prepared defaults one day after this card was prepared, and the ratification was never recorded.
  - #2096 itself has **no `## Ratified`/`RULED` block, no `resolvedDate`, and no anchor in
    `we:docs/agent/platform-decisions.md`** (grepped) — the codify step named in its own `## Context`
    never happened.
- **evidence — secondary staleness (counts + line-cite drift):**
  - *"279 entries (81 blocks / 98 intents / 59 plugs / 41 protocols; active = 39/6/31/0 = 76)"* — totals
    are now **283 (81/100/60/42)**; the **active split 39/6/31/0 = 76 still matches exactly**.
  - *"59 partials exist"* for `plug-descriptions/` — now **60**. ("83" block-descriptions is still exact.)
  - **Six `docs/agent/platform-decisions.md` line cites have all drifted** (anchors themselves are fine):
    `#constellation-placement` cited `:67` → now **:136**; `#non-verdict-conformance-matcher` `:387` →
    **:466**; `#intents-ux-only` `:464` → **:543**; `#intent-conformance-is-block-compliance` `:497` →
    **:581**; `#surface-contract-not-computation` `:912` → **:1114**;
    `#single-authoring-sot-derived-projection` `:1267` → **:1473**.
  - **Two `scripts/check-standards.mjs` line cites have drifted:** the plug-description gate is cited at
    `:141-143` and `:137-147`; it is now at **:183-185**
    (`err('Plug "…" has no src/_includes/plug-descriptions/…')`). Lines 137–147 today are `arr`/
    `checkStatusInto`/`RESEARCH_STATUSES`.
  - All `docs/agent/design-first.md` cites still resolve exactly (`:50`, `:125` protocol home; `:138`
    "behavioral spec"; `:155` plug partial; `:160-165` intents-JSON-only; `:217-221` lifecycle), as do
    `we:src/_data/blocks/audit-trail.json` + `we:src/_data/protocols/audit-trail.json` (the
    category-collision example) and `plug-descriptions/customtextnoderegistry.njk`.
- **suggested action:** **surface to the operator as a ratification-recording gap** — the highest-value
  item in this batch. Either (a) ratify #2096 explicitly on the card (recording Fork 1-a / Fork 2-a /
  Fork 3-a, which the shipped code already implements) and set `resolvedDate` + `codifiedIn`, or
  (b) if it was in fact ruled in-session, splice the ruling in. Then fix the lede ("greenfield" → "the
  home + skeleton shipped with the #2097 pilot"), refresh 279→283 and 59→60, and re-anchor the eight
  drifted line cites. Do not silently resolve without the explicit ratification act.
