# Batch 05 — staleness audit (23 open cards)

- ALREADY-DONE: 2 (#2369, #2383)
- SUPERSEDED: 0
- STALE-INFO: 12 (#089, #1971, #2355, #2356, #2357, #2358, #2360, #2755, #2761, #2762, #2764, #3144)
- STALE-PREMISE: 0
- DEAD-REFS (as secondary on a STALE-INFO card): 1 (#3144)
- OK: 9 (#2069, #2370, #2384, #2385, #2757, #2758, #2763, #2767, #3141)

Cross-cutting note: `/home/user/frontierui` `origin/main` = `b2d7b1e`. The SSR subtrees that exist are
`plugs/webdirectives/ssr/{jvm,net,python}`. There is **no** `go/`, `php/` or `rust/` subtree.

---

## #089 — Monetize the standard without compromising open-source / non-vendor-lock
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** All `#N` refs resolve to real cards (checked #081, #086–#088, #090–#097, #181, #428, #451,
  #554, #868, #869) and all `platform-decisions.md` anchors exist (`#constellation-placement`,
  `#intents-ux-only`, `#monetization`). The stale statements:
  - **"Next step (open) … Optional later items: conformance-case generator (#868) and platform impact
    narrator (#869) — now filed."** Both are now `status: resolved`
    (`backlog/868-…md`, `backlog/869-…md`). They are no longer pending next steps.
  - **Every "Promoted to its own item" pointer is now a resolved card** — #091, #092, #093, #094, #095,
    #096, #086, #090 are all `status: resolved`. The card still reads as if they are the live queue.
  - **"Roadmap to MVP → #097 (product choice, CI, auth/licensing, payments, distribution, marketing,
    legal/brand/insurance)."** #097 (`097-roadmap-to-mvp.md`, reopened 2026-06-20, `ongoing: true`,
    retitled **"Emergent MVP strategy"**) explicitly *decoupled* commercialization infrastructure
    (auth/licensing, payments, marketing, legal) out to **#181** (`181-commercialization-infrastructure.md`,
    open). The parenthetical scope list and the "Roadmap to MVP" name are both out of date; #089 never
    mentions #181.
  - **"Module-as-a-Service … *already half-built (#081)*"** — #081 is `status: resolved` with
    `graduatedTo: blocks/renderers/module-service/moduleService.ts`. That file does **not** exist; the
    live tree has `blocks/renderers/module-service/{servePathIR.ts,servePathOpenAPI.ts,
    maas-servepath.openapi.json,conformance/}`. (The bad `graduatedTo` belongs to #081, not this card, but
    #089's "half-built" claim should be re-pointed at the real path.)
  - **"plateau-app's `we:CLAUDE.md`"** — wrong repo prefix; the file quoted is
    `plateau-app:CLAUDE.md` (its content still matches, so only the prefix is wrong).
- **suggested action:** edit card — retitle the #097 pointer to "Emergent MVP strategy", move the
  commercialization-infra list to #181, drop #868/#869 from "Next step (open)" (both resolved), re-point
  the #081 "half-built" claim at `blocks/renderers/module-service/servePathIR.ts`, fix `we:CLAUDE.md` →
  `plateau-app:CLAUDE.md`.

## #1971 — Phase 2 — nested-directive lifecycle composition
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** All five named slices are delivered. Children of #1971:
  #2001 (A, lifecycle/ownership) resolved, #2003 (B, reactive cascade) resolved, #2002 (C, keyed
  reconciliation) resolved, #2004 (D, moveBefore) resolved, #2005 (E, SSR & hydration) resolved,
  plus #2030 and #2068 resolved. The only open child is **#2069** (the per-language SSR renderer
  scale-out), which is a fan-out of E, not remaining Phase-2 lifecycle work.
  Stale statements in the body:
  - `"about 80% remains and was deferred as Phase 2"` — no longer true; A–E all landed.
  - `"E — SSR & hydration of comment regions — *deferred*: no SSR surface exists in FUI to ground seams;
    design-gated child epic, a future /slice candidate once an SSR-of-comment-regions spike lands."`
    An SSR surface now exists and is shipped: `frontierui:plugs/webdirectives/ssr/ServerRenderer.ts`,
    `nodeReferenceRenderer.ts`, `python/`, `jvm/`, `net/`, plus WE vectors at
    `web-everything:conformance-vectors/webdirectives-ssr.vectors.json`. #2005 and #2030 are resolved.
  - `"Case 10 declarative-HTML deep STRUCTURAL nesting is UNMET"` — no longer accurate at the epic's own
    scope; the nesting/reconciliation slices resolved.
- **suggested action:** edit card — rewrite the slice list to mark A–E delivered and state that the only
  remaining child is #2069 (per-language SSR renderers); or park the epic body and let it ride #2069.

## #2069 — Per-language / per-framework SSR renderers for directive regions
- **verdict:** OK
- **evidence:** Every claim checks out. #2030, #2063, #2064, #2065, #2066, #2067, #2354 all
  `status: resolved`; `we:reports/2026-07-09-backlog-split-analysis.md` exists;
  `we:conformance-vectors/webdirectives-ssr.vectors.json` + `webdirectives-ssr-harness-contract.md` exist;
  the `we:platform-decisions.md#ssr-external-io-standard-renderers-conform` anchor exists. Python (#2359)
  resolved and shipped at `frontierui:plugs/webdirectives/ssr/python/`.

## #2355 — Native JVM SSR renderer for directive regions
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** Two of this epic's three slices are already delivered in `frontierui:main`:
  #2368 (foundation + if/switch) is `status: resolved`, and **#2369 (resource:loader + defer) landed as
  commit `51852bf` "FUI #2369: JVM SSR renderer — resource:loader + defer directives"** (merged via
  `8af2c9d`, PR #41) — see `frontierui:plugs/webdirectives/ssr/jvm/src/main/java/.../JvmServerRenderer.java`
  lines 27–32 and 68–82, and `ConformanceHarness.java`'s `IMPLEMENTED = {if, switch, resource:loader,
  defer}`. Only #2370 (for-each) remains. The card's "**Sliced (2026-07-09):** … then two per-directive
  slices fanning out behind it" reads as if both are still pending.
  Minor: frontmatter `blockedBy: ["2354"]` where #2354 is resolved (the prose already says so).
- **suggested action:** edit card — note #2368 and #2369 delivered, only #2370 (for-each) outstanding.

## #2356 — Native Go SSR renderer for directive regions
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** `"passes the WE-owned conformance vectors byte-for-byte via the cross-language harness
  (blocked on the foundational export slice)"` — the foundational export slice **#2354 is
  `status: resolved`** (`backlog/2354-export-webdirectives-ssr-conformance-vectors-as-language-neu.md`),
  and the vectors are committed at `we:conformance-vectors/webdirectives-ssr.vectors.json`. The epic is
  no longer blocked. (Its sibling #2360 already carries the corrected wording: "(#2354, now resolved)".)
  Frontmatter `blockedBy: ["2354"]` is likewise satisfied. Work itself is genuinely open — no `go/`
  subtree exists in `frontierui:plugs/webdirectives/ssr/`.
- **suggested action:** edit card — replace "(blocked on the foundational export slice)" with "(#2354,
  resolved)"; optionally drop the satisfied `blockedBy`.

## #2357 — Native PHP SSR renderer for directive regions
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** Identical stale clause to #2356 — "(blocked on the foundational export slice)" while
  #2354 is resolved. Work still genuinely open (no `php/` subtree).
- **suggested action:** edit card — same wording fix as #2356.

## #2358 — Native Rust SSR renderer for directive regions
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** Same stale "(blocked on the foundational export slice)" clause with #2354 resolved.
  Additionally, its own foundation slice **#2756 was resolved today (2026-09-06)**
  (`dateResolved: "2026-09-06"`, `graduatedTo: frontierui:plugs/webdirectives/ssr/rust/`, WE commit
  `f3994e8`), so this epic is now partly delivered — **but the graduated path does not exist on
  `frontierui:origin/main` (`b2d7b1e`)**; there is no `rust/` directory and no `.rs` file anywhere in the
  frontierui checkout, and `git log --all --grep 2756` in frontierui returns nothing. Either the FUI lane
  PR has not landed or the resolve was premature.
- **suggested action:** edit card (wording fix) **and** verify #2756's FUI landing before treating the
  Rust foundation as shipped.

## #2360 — Native .NET SSR renderer for directive regions
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:**
  - `"The same re-analysis is still owed for the three remaining sub-epics filed as unscoped epics
    (#2356–2358, Go/PHP/Rust) — flagged, not done here"` — **done since.** All three were sliced
    2026-07-27/28 into the same foundation + for-each + loader/defer shape:
    Go → #2755/#2758/#2757; PHP → #2762/#2767/#2763; Rust → #2756/#2761/#2764 (all filed
    `dateOpened: "2026-07-28"`, and the epics' own bodies now read "Sliced (2026-07-27)").
  - The `foundation + if/switch` build slice it names is **delivered in code**: commit
    `f918b99 "FUI #2383: native .NET SSR renderer foundation + if/switch (#2069)"` on
    `frontierui:main`, with `plugs/webdirectives/ssr/net/{src,tests}` and the CI step at
    `frontierui:.github/workflows/ci.yml:94-96`. The card presents it as still to build.
- **suggested action:** edit card — delete the "re-analysis still owed for #2356–2358" paragraph, and mark
  the foundation slice as landed.

## #2369 — JVM SSR renderer: resource:loader + defer directives
- **verdict:** ALREADY-DONE
- **confidence:** high
- **evidence:** `frontierui` commit **`51852bf` "FUI #2369: JVM SSR renderer — resource:loader + defer
  directives"**, merged to `main` via `8af2c9d` (PR #41), present at `origin/main` (`b2d7b1e`).
  Both scope files carry the work:
  - `frontierui:plugs/webdirectives/ssr/jvm/src/main/java/com/frontierui/webdirectives/ssr/JvmServerRenderer.java`
    — `markerToken()` returns `"resource:loader"` and `"defer"` (lines 31–32); `renderInner()` implements
    the resource:loader success-branch inline emit (lines 73–76) and the defer placeholder-only emit
    (lines 78–84), exactly as the card specifies.
  - `.../src/test/java/.../ConformanceHarness.java` — `IMPLEMENTED = {"if","switch","resource:loader",
    "defer"}` with the `#2369` attribution in its javadoc; only `for-each` is still SKIPped.
  The WE-side card was never flipped: no commit in `web-everything` mentions `2369`
  (`git log --all --grep='2369'` is empty) and `backlog/2369-…md` still reads `status: open`.
- **suggested action:** resolve #2369.

## #2370 — JVM SSR renderer: for-each directive
- **verdict:** OK
- **evidence:** Genuinely undone — `ConformanceHarness.java` explicitly SKIPs `for-each`, and
  `JvmServerRenderer.markerToken()` has no `for-each` branch. Both scope files exist (plus `Renderers.java`,
  `HtmlParse.java`). `we:conformance-vectors/webdirectives-ssr-harness-contract.md` exists. Its
  `blockedBy: ["2368"]` is satisfied (#2368 resolved).

## #2383 — Native .NET SSR renderer foundation + if/switch directives
- **verdict:** ALREADY-DONE
- **confidence:** high
- **evidence:** `frontierui` commit **`f918b99` "FUI #2383: native .NET SSR renderer foundation + if/switch
  (#2069)"**, merged via `b2d7b1e` (PR #42), on `origin/main`. The declared scope is fully populated:
  - `frontierui:plugs/webdirectives/ssr/net/` — `src/{NetServerRenderer.cs, Renderers.cs, HtmlParse.cs,
    Json.cs, ServerRenderer.cs, ConformanceHarness.cs}`, `tests/ConformanceTests.cs`,
    `WebDirectivesSsr.Conformance.csproj`, `build.sh`, `README.md`.
  - `frontierui:.github/workflows/ci.yml` — `actions/setup-dotnet@v4` (line 65-67) and the
    `".NET SSR conformance harness"` step running `plugs/webdirectives/ssr/net/build.sh` (lines 92-96).
  - `NetServerRenderer.MarkerToken` implements `if` → `control:if` and `switch` → `control:switch`;
    `ConformanceHarness.cs` skips for-each/resource-loader/defer, as the card scopes.
  Corroborated independently by #2385's own prepared verification section, which cites `f918b99` and
  records a local run reporting `Passed: 5 / Skipped: 5 / Failed: 0` against the live vectors.
  Note (does not change the verdict): the card suggested "a real HTML parser/DOM, e.g. AngleSharp"; the
  landed build is dependency-free (`HtmlParse.cs`) — an allowed black-box choice under #2030.
  The WE card was never flipped (`status: open`; no `web-everything` commit mentions 2383).
- **suggested action:** resolve #2383 — this also clears the `blockedBy` edge for #2384 and #2385, which
  #2385's own body flags as owed housekeeping.

## #2384 — Native .NET SSR renderer: resource:loader + defer directives
- **verdict:** OK
- **evidence:** Genuinely undone — `net/src/ConformanceHarness.cs:16` states for-each/resource:loader/defer
  are SKIPped, and `NetServerRenderer.MarkerToken` has no branch for either. `blockedBy: ["2383"]` is
  satisfied in code (see #2383 above) but not yet in card status.

## #2385 — Native .NET SSR renderer: for-each directive
- **verdict:** OK
- **evidence:** Best-verified card in the batch and still accurate today. Its "Verification against the live
  tree (2026-08-15)" claims re-checked: `f918b99` is on `frontierui:main`; **#2383's card does still read
  `status: open`** as the card says; the three for-each vectors are present in
  `we:conformance-vectors/webdirectives-ssr.vectors.json`; the Python surrogate-pair comparison target
  `frontierui:plugs/webdirectives/ssr/python/webdirectives_ssr/renderer.py` exists (441 lines, so the cited
  `:311-321` / `:338-361` ranges are in range); `NetServerRenderer.cs:57` really does carry the comment
  *"Directives that add extra tokens (for-each's count/key-hash) will append them here."*

## #2755 — Native Go SSR renderer foundation + if/switch directives
- **verdict:** STALE-INFO (minor)
- **confidence:** high
- **evidence:** Work is genuinely open (no `frontierui:plugs/webdirectives/ssr/go/`). One stale statement,
  in `scopeRationale`: *"adds the Go conformance-harness CI step, **alongside the existing JVM step**"* —
  `frontierui:.github/workflows/ci.yml` now carries **two** harness steps, JVM (lines 88-90) and .NET
  (lines 94-96), since `f918b99`.
- **suggested action:** none required (cosmetic); edit the scopeRationale phrase if convenient.

## #2757 — Native Go SSR renderer: resource:loader + defer directives
- **verdict:** OK
- **evidence:** Scope paths (`go/renderer.go`, `go/conformance_test.go`) don't exist yet, which is correct
  — they are created by its blocker #2755 (open). Harness-contract path exists.

## #2758 — Native Go SSR renderer: for-each directive
- **verdict:** OK
- **evidence:** Same as #2757 — correctly build-gated on #2755 (open). No stale statements found.

## #2761 — Native Rust SSR renderer: for-each directive
- **verdict:** STALE-INFO
- **confidence:** medium
- **evidence:** `"_Scope build-gated on #2756 (per blockedBy)_"` — **#2756 is now `status: resolved`**
  (`dateResolved: "2026-09-06"`, WE commit `f3994e8` "WE #2756: resolve — Rust native SSR renderer
  foundation landed"), so the stated gate no longer holds and the card should be unblocked. **However**
  the foundation's `graduatedTo` path `frontierui:plugs/webdirectives/ssr/rust/` does **not** exist on
  `frontierui:origin/main` (`b2d7b1e`) — no `rust/` dir, no `*.rs` files, no matching FUI commit. Its
  scope files `rust/src/renderer.rs` and `rust/tests/conformance.rs` are therefore absent.
- **suggested action:** none to the card text yet — first verify whether #2756's FUI lane actually landed.
  If it has not, #2756's resolve is premature and #2761/#2764 are not really unblocked.

## #2762 — Native PHP SSR renderer foundation + if/switch directives
- **verdict:** STALE-INFO (minor)
- **confidence:** high
- **evidence:** Same single stale phrase as #2755: `scopeRationale` says the CI change lands *"alongside the
  existing JVM step"*, but `frontierui:.github/workflows/ci.yml` now has both a JVM and a .NET harness step.
  The build itself is genuinely open (no `php/` subtree).
- **suggested action:** none required (cosmetic).

## #2763 — Native PHP SSR renderer: resource:loader + defer directives
- **verdict:** OK
- **evidence:** Correctly gated on #2762 (open); scope paths intentionally not yet created.

## #2764 — Native Rust SSR renderer: resource:loader + defer directives
- **verdict:** STALE-INFO
- **confidence:** medium
- **evidence:** Identical to #2761 — `"_Scope build-gated on #2756 (per blockedBy)_"` while #2756 is now
  resolved (2026-09-06), yet the Rust subtree it graduated to is absent from `frontierui:origin/main`.
- **suggested action:** same as #2761 — verify #2756's FUI landing before acting.

## #2767 — Native PHP SSR renderer: for-each directive
- **verdict:** OK
- **evidence:** Correctly gated on #2762 (open). Harness-contract reference exists.

## #3141 — Safe-edit sandbox: discard-or-emit-PR orchestration
- **verdict:** OK
- **confidence:** high
- **evidence:** Every backticked cross-repo path in the card resolves, and the API claims it leans on are
  still true:
  - `plateau-app:packages/dev-browser/src/{credential-source,forge,ide-bridge,pr-body/renderer.ts}` all exist;
    `forge/registry.ts` exists.
  - `IdeBridgeRegistry.patch(write: PatchWrite): Promise<BridgeOutcome>` — `ide-bridge/registry.ts:66`.
  - `ForgeProviderRegistry.openPullRequest(...)` — present in `forge/`.
  - `we:conformance-evidence/provider.ts` and `we:scripts/autofix/engine.mjs` exist; the load-bearing
    `if (before.ok) break` claim is real — `scripts/autofix/engine.mjs:294` (`if (before.ok) break; // green — done`).
  - Its own scope files (`safe-edit/emit.ts`, `emit.test.ts`) correctly do **not** exist yet; `safe-edit/`
    holds only `buffer.ts`/`buffer.test.ts`/`index.ts`/`types.ts` (slice 1, #3139, resolved).
  - `blockedBy: ["3139","3140"]` — #3139 resolved, **#3140 still open**, and `safe-edit/verify-gate.ts`
    correctly does not exist yet. Referenced decisions #598/#600 are both resolved. Parent #1650 open.

## #3144 — Reconcile #2564's constitution-tier artifact … then quantify the amendment-entrenchment gate
- **verdict:** STALE-INFO (+ DEAD-REFS: drifted line anchors)
- **confidence:** high
- **evidence:** The substance is intact — #2568 is still `status: open` (so "ratify #2568 first, then this
  item" still holds), and every cited decision (#2564, #2561, #911, #2771, #2840, #2839, #2851) is
  `resolved`. What has rotted is the **line-number citation set**, which is the card's main grounding
  device. `docs/agent/platform-decisions.md` has grown ~+180 lines above line 3400 since preparation:
  - `platform-decisions.md#review-human-declarative-leash-only` cited at **`:3408`/`:3412`/`:3414`** —
    the anchor is now at **line 3589**.
  - `#human-required-is-judgment-only` cited at **`:3430`** — now at **line 3611** (`:3430` today is a
    `#deterministic-core-thin-judgment` cross-reference).
  - `#principle-and-impl-two-pr` cited at **`:3470`** — now at **line 3651**.
  - `#human-is-principle-surface-not-path` cited at **`:3478`**, and its trigger-3 quote at **`:3480`** —
    now at **line 3659** (`:3480` today is unrelated text about `test`-check pinning).
  - **`:3496`** likewise points at unrelated text ("distinct validator, never peer/self agreement").
  - **`:2883`** cited for *"route-to-a-human, never hard-block-with-no-reviewer"* — line 2883 today is
    `by we:reports/2026-07-10-ai-code-review-best-practices.md; the build lands under epic #2410 …`.
  - **`:2969-2970`** cited for *"#2564 ratified subordinate tiers"* — those lines today are the
    schema-prose-expressibility audit sentences inside `#spec-is-schema-human-gates-spec`.
  - **`we:scripts/lib/gate-config.mjs:355-374`** cited for `POLICY_SPEC_BASENAMES` — that constant is now
    declared at **`gate-config.mjs:446`** (and is *derived*, not a literal roster); lines 355-374 today are
    `BLAST_RADIUS_ENGINE` roster entries (`dispatch-operation-io`, `dispatch-runner`).
  Refs that DO still check out (so the drift is selective, not wholesale):
  `platform-decisions.md:1630-1638` (= `#config-extends-platform-default`), `:2962-2963`
  (= `#spec-is-schema-human-gates-spec` heading, off by ~2), `review-escalation.mjs:70-73` (`STATUTE_PATHS`),
  `:245-254` (`BLAST_RADIUS`), `review-independence.mjs:42-48`, `check-standards.mjs:273-286`,
  `backlog-workflow.md:423`, `reports/2026-08-17-constitutional-amendment-gate-quantification.md`,
  and both `scripts/lib/review-policy.contract.json` / `review-escalation.mjs`.
  `we:docs/agent/constitution-index.json` does not exist, but that is correct — it appears only inside
  Fork 1 option (b) as a *hypothetical* new file, not as a claimed existing one.
- **suggested action:** edit card — re-resolve every `platform-decisions.md:34xx` and the
  `gate-config.mjs:355-374` citation to current lines (or, better, replace bare line numbers with
  `#anchor` references, which have not drifted) before this decision is put to ratification, since the
  decider is asked to verify grounding claims per `backlog-workflow.md:423`.

---

### OK cards (no further output)
- #2069 OK
- #2370 OK
- #2384 OK
- #2385 OK
- #2757 OK
- #2758 OK
- #2763 OK
- #2767 OK
- #3141 OK
