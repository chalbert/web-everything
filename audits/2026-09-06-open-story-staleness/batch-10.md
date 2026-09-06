# Batch 10 — staleness audit (9 cards)

- ALREADY-DONE: 0
- SUPERSEDED: 0
- STALE-INFO: 7 (#1104, #1992, #2130, #2910, #3041, #3048, #3162)
- STALE-PREMISE: 0 · DEAD-REFS: 1 (#1138)
- OK: 1 (#1137)

Cross-cutting pattern: four of the long process/decision cards (#1992, #2910, #3041, #3048) cite
`file:line` into fast-moving files. `we:docs/agent/platform-decisions.md` has grown to 4138 lines and
**every** line citation into it in this batch is now wrong by 130–520 lines; `we:scripts/lib/review-escalation.mjs`
citations are off by 100–260 lines. The prose and the anchors are still correct — only the numbers rotted.
A cheap systemic fix: cite `#anchor` / function name instead of `:NNN`.

---

## #1104 — Publish the website publicly — controlled, gated rollout
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:**
  - Body ¶1: *"The site today has **no public deployment** (Eleventy docs run only on localhost — `we:` Eleventy at :8080, Vite demos at :3000)."* — **false since 2026-07-02.** The gated site is live on Cloudflare Workers: `/home/user/web-everything/worker.js`, `/home/user/web-everything/wrangler.toml` (`workers_dev = true`, line 20), cross-repo auto-deploy at `/home/user/web-everything/.github/workflows/deploy.yml` ("Deploy WE site (Cloudflare Worker)"), runbook `/home/user/web-everything/functions/README.md`, gate tests `/home/user/web-everything/functions/__tests__/gate.test.ts`. #1137's own body records the live URL.
  - "Open decisions to carve during `/slice`" lists **Host** and **Gate mechanism (phase 1)** as still-open forks. Both are settled: `backlog/1135-*.md` is `status: resolved`, and the platform is **Workers Static Assets**, not the "Cloudflare Pages / Netlify / Vercel / GitHub Pages" menu the card offers (see the deviation rider in #1137).
  - "**#1137** — *story*: … (blockedBy #1135)" — #1137's frontmatter is now `blockedBy: ["3121"]`.
  - Child list omits two live children: **#2130** (`parent: "1104"`, open) and **#2363** (`parent: "1104"`, resolved). The card's own caveat ("enumerate live children by `parent:`") mitigates this.
  - "Unblocking action: ship #1135 + #1137, then `/slice` #1104 again" — #1135 is shipped; only #1137's human DNS step remains.
  - Minor: "#182 license keys, #183 payments" are both now `resolved` (the "#181 is deprioritized" framing itself is still accurate — `backlog/181-*.md:32`).
- **suggested action:** edit card — replace the "no public deployment" paragraph with the current state (live + gated at the Workers preview URL, public go-live pending the DNS step in #1137); strike Host and Gate-mechanism from the open-forks list and point at #1135's ruling (Workers, not Pages); fix the `#1137 blockedBy #1135` line; add #2130/#2363 to the child list.

## #1137 — Public deploy: WE site live behind a splash + shared entry code
- **verdict:** OK
- **confidence:** high
- **evidence:** re-verified every claim in the 2026-08-15 correction: `worker.js`, `wrangler.toml`, `functions/README.md`, `functions/__tests__/gate.test.ts`, `.github/workflows/deploy.yml` all present; `functions/_middleware.js` absent as stated; `workers_dev = true` is on **line 20** exactly as the runbook says; blocker `backlog/3121-*.md` is still `status: open`; `backlog/2127-*.md` is `resolved`. Nothing stale.
- **suggested action:** none

## #1138 — Instrument the live WE site with the chosen analytics
- **verdict:** DEAD-REFS (otherwise current; still valid work)
- **confidence:** high
- **evidence:** two backticked paths in "Decided design" item 3 carry the wrong repo prefix:
  - `we:analytics/provider.ts`'s `NoopTracker` — **does not exist in WE.** WE has `/home/user/web-everything/analytics/contract.ts` (the `CustomTracker` interface, line 62) and `analytics/dev-metrics.ts`; `NoopTracker` is defined at `/home/user/frontierui/plugs/webanalytics/provider.ts:27`. Should read `fui:plugs/webanalytics/provider.ts`.
  - `we:plugs/webanalytics/CustomTrackerRegistry.ts` — **no `plugs/webanalytics/` directory in WE.** The file is `/home/user/frontierui/plugs/webanalytics/CustomTrackerRegistry.ts`. Should read `fui:`.
  - Everything else verified current: `src/privacy.njk` still asserts "no analytics" (lines 10 and 48) and still carries the rewrite-first promise; `src/_layouts/base.njk:128` still carries "No analytics, no tracking"; `src/_data/site.js` still uses the `process.env.SITE_URL` / `COMPONENT_NAMESPACE` pattern the design mirrors; `.github/workflows/deploy.yml` has the "Build WE site" step (line 183); `functions/README.md:50-51` has the `wrangler secret put GATE_CODE` runbook entry the new subsection is told to sit next to; `backlog/1013-*.md` is `resolved` and `fui:plugs/webanalytics/{ga4,mixpanel,segment}.ts` all exist, as claimed; `backlog/1136-*.md` `resolved`, `backlog/1137-*.md` still `open` (so the `blockedBy` note remains accurate).
- **suggested action:** edit card — change those two `we:` prefixes to `fui:` (and `provider.ts` → note WE's own contract lives at `we:analytics/contract.ts`). No change to the design or tasks.

## #1992 — Configurable directive-separator mechanism (the objector escape hatch + migration bridge)
- **verdict:** STALE-INFO (line-reference rot only; the decision is un-made and un-superseded)
- **confidence:** high
- **evidence:** all four citations into `we:docs/agent/platform-decisions.md` now land on unrelated text (the file is 4138 lines):
  - `:757-775` (cited as `registry-name-guard`) → line 757 is now `### Vision / AI = a Plateau no-leakage service client`. The anchor `{#registry-name-guard-namespace}` is at **line 898**.
  - `:773-774` (cited as "the three directive surfaces have different ratified separator policies") → now AI-model-tier prose. The per-surface ruling is inside `{#attribute-name-colon-namespacing}` at **lines 2919-2921**.
  - `:1446` (cited as `config-extends-platform-default`) → now Plugged-mode prose. The anchor is at **line 1633**.
  - `:2401` (cited as `attribute-name-colon-namespacing`) → now live-test/vendor-dependency prose. The anchor is at **line 2919**.
  - `we:config/defineConfig.ts:90-101` — the `WebEverythingConfig` interface now starts at line 91 and runs past 101 (a `#2523` list-virtualization dimension was added), so the cited range no longer covers it. `:12` (`.json` conceptually accepted) and `:37` (`DimensionPointer`) are still exact; `we:config/platformDefaults.ts:38` (`PLATFORM_FLAVOR_DEFAULTS`) is exact.
  - **All FUI citations verified exact:** `CustomAttributeRegistry.ts:178-185` (`#assertValidName`), `:308-309` (`#update` → `getDefinition`), `:463-464` (`attr.localName`), `CustomCommentParser.ts:34` (`DIRECTIVE_NAME`), `:38` (`OPTION_RE`), `CustomTemplateTypeRegistry.ts:79-87` (colon-rejecting guard), `OnEventAttribute.ts:277-295` (the `on:*` map).
  - Not superseded: only #1987 and #2112 reference it, and #2112 (resolved) explicitly records "#1992 is a different surface … disjoint turf".
- **suggested action:** edit card — replace the four `platform-decisions.md:NNN` citations with `#anchor` links (`#registry-name-guard-namespace`, `#attribute-name-colon-namespacing`, `#config-extends-platform-default`) and drop the `:90-101` range from the `defineConfig.ts` cite.

## #2130 — Ungated-public stage: splash off only on the full dogfood ratchet + claims-audit re-run
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:**
  - `blockedBy: ["867"]` — **`backlog/867-*.md` is `status: resolved` (dateResolved 2026-07-09)**. #867 is the *decision* "per-page rollout ratchet for the WE-docs FUI dogfood", not the ratchet reaching full enforcement. So the card now reads mechanically **unblocked** while the condition its title states ("the full dogfood ratchet") is demonstrably unmet: `/home/user/web-everything/tests/a11y/sitemap-routes.ts` documents the last promotion run (2026-07-28, #2378) as **33 of 43 derived routes enforced**, with 10 named routes still warn-only, and the parent dogfood epic `backlog/777-*.md` is still `status: open`.
  - `#2127` (the claims-truth audit whose *method* this card wants re-run) is `resolved` — still consistent with the card, which asks for a re-run, but worth noting the referenced original is closed.
  - `#2089` (the ratified sequencing decision it descends from) is `resolved` — fine.
- **suggested action:** edit card — retarget `blockedBy` from the resolved decision #867 to whatever actually tracks full enforcement (#777, or a new "all derived routes enforced" item), and say so in the body; otherwise this card will surface as ready when it is not.

## #2910 — Amend #2563 — a machine park is the only available spelling of "wait for the panel"
- **verdict:** STALE-INFO (line-reference rot; the decision is un-made and still needed)
- **confidence:** high
- **evidence:** citations into `we:scripts/lib/review-escalation.mjs` (now 2280 lines) have drifted:
  - `producerReviewLabel` cited at `:658-662` — actually **`:761`** (line 658 is now blast-radius-narrowing prose).
  - `hasUnclearedReviewLabel` cited at `:1394-1427` with "operative logic at `:1423-1426`" — actually **`:1603`**; lines 1390-1428 are now the human-cleared-sha comment scanner and its threat-model note.
  - The #2425 merge-anyway-timer quote *"landing unreviewed code on a clock is never the right failure mode"* cited at `:2022-2024` — actually **`:2277`**.
  - Accurate as cited: `plateau-app:tools/drain-daemon/daemon.mjs:9` is exactly the "no agent spawning" de-scope line.
  - Substance still holds: the anchor it amends is unamended — `docs/agent/platform-decisions.md:2887` `{#blast-radius-advisory-care-not-a-gate}`, clause 1 still reads "they do **not** block the land on a review verdict … just not a human park", and the two later anchors that cite it (#3320 at `:3762`, #3314 at `:3856`) explicitly *refine, do not alter* it. `#2572` (the converge daemon that would make the drain able to spawn agents) is still `open`, so the premise stands. All 15 `#N` refs in the card resolve to real items.
- **suggested action:** edit card — refresh the three `review-escalation.mjs` line ranges (or cite the function names, which are stable).

## #3041 — Deadlock relief: progress-gated rounds vs partial escalation of the disputed finding
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:**
  - `blockedBy: ["2908"]` — **`backlog/2908-*.md` is `status: resolved`** (ratified 2026-08-08, implemented in PR #1106). The card's own prep section already folds #2908's ruling in ("Correction folded at prep"), so the blocker edge is left over and should be cleared.
  - `we:docs/agent/platform-decisions.md:3432` cited as where the "rounds spent, panel still at `changes`" deadlock category is named → line 3432 is now CI name+conclusion-contract prose. That category is in the `#converge-editor-enabled-at-low-only` anchor at **line 3633**.
  - `we:scripts/workflows/review-parked-prs.mjs:1226-1229` cited as the round-cap backstop (`if (last.outcome === OUTCOME_CONTINUE && round >= roundCap)`) → that statement is now at **`:1235-1238`**; 1226-1229 is the preceding defense-in-depth comment.
  - `:918-920` cited as `careRigorFor`'s `EDITOR_MIN_ROUNDS` floor → `careRigorFor` is declared at `:891` and the floor math (`Math.min(Math.max(panelRounds, EDITOR_MIN_ROUNDS), NEGOTIATION_ROUND_CAP)`) is at **`:928`**; 918-920 is comment text.
  - `:1299-1303` (the editor gate) and `:1234-1277` (juror-invite round consumption) are near-misses of the same ~8-line drift.
- **suggested action:** edit card — drop the resolved `blockedBy: ["2908"]`, and refresh the four line ranges (or cite symbol names).

## #3048 — An operator approval has no recording route on a self-authored `review:pending` PR
- **verdict:** STALE-INFO (minor; the gap itself is live and re-verified)
- **confidence:** high
- **evidence:**
  - The described gap **still exists in the shipped tree**: `scripts/review-set-label.mjs` `decideSetLabel` still refuses `--to=clear-human` when the PR carries no `review:human` (`:183-192`, *"no review:human label — nothing to clear"*), and `accepted`/`clear-human`/`restamp` still go through the self-clear independence check at `:652-673` with `clear-human` the only exemption. So the card is correctly open.
  - Stale: `we:scripts/lib/review-escalation.mjs:574` is cited as `scoreEscalation` — the function is declared at **`:578`** and the `humanRequired = leashFiles.length > 0 || statuteFiles.length > 0` line the card quotes is at **`:639`**.
  - Verified accurate: `review-core.mjs:351` (the "A reviewer subagent (independent of you …)" prompt string) is exact; `review-set-label.mjs:100`, `:152-170`, `:281-293`, `:354-379`, `:489-505` and `gate-config.mjs:101-107`, `:114-124` all still land on the described code; `scripts/lib/review-independence.mjs` exists.
  - `relatedTo` items all exist; #2888, #2946, #3055 still open, #2844/#2895/#2439/#2398/#3028/#3039 resolved — none of them closes this gap.
  - Not verifiable here: the live state of `chalbert/web-everything#1128` (no `gh` in this environment), so the "Reproduced live" section's PR state may have moved on.
- **suggested action:** edit card (one line ref: `review-escalation.mjs:574` → `:578`/`:639`); otherwise leave open.

## #3162 — General agent-liveness check: is a dispatched agent still running, stalled, or finished
- **verdict:** STALE-INFO (close to ALREADY-DONE — flagging for an operator call, not asserting it)
- **confidence:** medium
- **evidence:**
  - The card's opening premise — *"There is no way to ask 'is agent X still alive, stalled, or already finished' without either waiting for its completion notification or spawning a new agent to go check"* — **is no longer true.** `/home/user/web-everything/skills-src/inspect-agent-health/` ships exactly such an on-demand query: `agent-health.mjs <agentId | output_file path | .jsonl path> [--lines=N] [--json]`, resolving a bare agent id via `~/.claude/projects/**/subagents/agent-<id>.jsonl`, returning one of `BLOCKED_ON_CHILD` / `BLOCKED_ON_TOOL` / `IDLE_OR_STALLED` / `ACTIVE` (`agent-health.mjs:342-360`), with unit tests at `skills-src/inspect-agent-health/__tests__/agent-health.test.mjs` and registration as the `inspect-agent-health` skill. Landed in commits `d5e8588` ("Add inspect-agent-health skill: read a subagent's own transcript instead of pinging it") and `26f606a` (review fixes, PR #1905). No commit references #3162, so this was built for the same problem without being routed through this card.
  - **Why not ALREADY-DONE:** the "Done when" asks for classification "sourced from the same `claude agents --json` data `#3149` already reads" — the shipped tool reads the agent's JSONL transcript instead (arguably a better source, since it works while the target is mid-blocking-call). It also has no distinct `finished` or `unknown` verdict (a completed agent reads as `IDLE_OR_STALLED`), and the tests cover arg clamping, tail-read bounds, control-sequence stripping and blocked-on-child detection rather than "a fixture session in each state".
  - Also stale: the card says `#3149` "already reads" `claude agents --json` — `backlog/3149-*.md` is still `status: open`, so nothing reads it yet.
- **suggested action:** edit card — record the shipped `we:skills-src/inspect-agent-health/` tool, narrow the remaining scope to the residual (a `finished`/`unknown` classification + a per-state fixture test, and whether `claude agents --json` is still wanted as the source), fix the "#3149 already reads" claim. If the operator accepts the transcript-based source as satisfying the intent, this can be resolved instead.

---

### OK cards
- #1137 OK
