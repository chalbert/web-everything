# Unmetered App GraphQL spend: the drain bypass survived PR #3103

The resident drain is a confirmed unmetered App caller. PR #3103 did **not** ship its proposed synchronous throttle coverage: CI-heal commit `3dabd061b2785291ae6ed581e7e742e13b5846d8` explicitly removed that adapter after a 90-second soak timeout. Its asynchronous discovery and commit reads also invoke raw `gh`. The launchd service supplies App credentials but no shim PATH. This explains a real hole in the meter; the available evidence does **not** assign all alleged 4,500 missing points/hour to that hole.

Two measurement assumptions also need correction. Four error lines are two failed drain passes, each logged twice. The exact 17:48–18:48Z raw ledger contains **6,194 observed App-labelled points**, including **2,550 unattributed**, rather than 488 points with zero unattributed. The ledger merges different installation identities under `app`, and most caller costs are still shared-counter delta estimates. It cannot prove the precise hourly spend of installation 163880042.

Investigation date: 2026-09-30. Analysis checkout: `0bb00011a`. Incident interval: **[17:48:00Z, 18:48:00Z)**, 13:48–14:48 EDT. No runtime, credential, daemon, workflow, or shared agent documentation was changed. Only this report and four unqueued stories were authored. No private-key file was read; token values and secret-bearing environment values were never printed.

## Evidence and estimates

| Finding | Evidence | Points in the incident hour | Disposition |
| --- | --- | --- | --- |
| Resident drain bypasses both throttle and ledger | Raw imports and calls in we:scripts/merge-ai-prs.mjs:129, :3402, :3824, :4130; App refresh at :3546; launchd configuration below | 44 passes, 42 exit 0, 2 exit 4, 12 merges. At least 126 successful initial repository-list invocations inferred from 42 completed three-repository passes, plus six initial attempts in the failed passes. At one or more points per successful list this is a conservative **126 points/hour floor**; pagination, per-PR reads, merge/edit operations, and extra listings are additional and unmeasured. | Confirmed unmetered spender; story #xp83iru. Do not treat the floor as its total. |
| Generated shim can fall back to direct App-authenticated gh | we:scripts/lib/gh-app-shim.mjs:318–:363; installed shared shim lines 39–85 | **Unknown**. 162 of 177 generated shim files point to missing throttle files. This inventory is not a count of active callers or fallbacks. | Confirmed bypass mechanism, incident activity unproven; story #xkcp5vc. |
| Meter conflates installation identities and legacy costs | we:scripts/lib/gh-throttle.mjs:1208; we:scripts/lib/gh-spend.mjs:163, :181 | 6,100- and 5,000-limit observations coexist under `app`; no installation ID is recorded. | Measurement root cause, not another spender; story #x3u395z. |
| Report interval and coverage are easy to misread | we:scripts/lib/gh-spend.mjs:449–:467 | `--hours=1` selects the current UTC clock hour, not the previous 60 minutes. | Measurement root cause; story #xmjz7ex. The historical 488-point output was not supplied and cannot be reconstructed exactly. |

The initial-list floor is a source-plus-pass-history estimate, not captured HTTP cost. GitHub documents a minimum one point for ordinary GraphQL queries; nested connections and pagination can cost more. REST and GraphQL have separate primary buckets. Actions' built-in `GITHUB_TOKEN` has a separate per-repository GraphQL allowance; a run triggered by this App does not thereby use this App's token. [GitHub rate-limit documentation](https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api).

## The drain's credential-to-call chain

The host LaunchAgent `~/Library/LaunchAgents/com.plateau.drain-daemon.plist` starts the dedicated Plateau drain clone. Its non-secret configuration is App ID **5037855**, installation ID **163880042**, interval **60 seconds**, maximum backoff **900 seconds**, and WE clone `we:../.lanes/we-drain-daemon/lane-1`. Its PATH includes the Node installation and Homebrew, but neither the shared nor a checkout-specific App shim. The first available `gh` there is the Homebrew binary.

The daemon spawns the WE merge script with the inherited environment at we:../plateau-app/tools/drain-daemon/daemon.mjs:296. The merge CLI refreshes App auth at we:scripts/merge-ai-prs.mjs:3546. Auth sets `process.env.GH_TOKEN` at we:scripts/lib/github-app-auth-env.mjs:252; it does not install a PATH shim. The cache is host-shared, at `we:/Users/nicolasgilbert/.claude/github-app-token/web-everything.json`, with fields `v`, `token`, and `expiresAt`, but no installation identity. The cache was observed refreshing during this investigation; values were not exported.

The deployed WE drain clone was inspected directly, rather than assuming this lane represents production. It retains the raw child-process import and these paths:

- `execFileP = promisify(execFile)` at we:scripts/merge-ai-prs.mjs:3402; the three-repository candidate listing uses it at :4130.
- Per-PR commit reads use that same raw asynchronous executor at we:scripts/merge-ai-prs.mjs:3832. The SHA cache reduces frequency, but cache misses still bypass accounting.
- Synchronous reads and writes include land guard signals at we:scripts/merge-ai-prs.mjs:1608, comments at :3696, already-merged state at :3845, and label operations at :3974. None acquires metering merely because `GH_TOKEN` is set.

The decisive historical probe was `git show 3dabd061b`: it removes the throttle import and restores `execFileSync` from `node:child_process`. Its commit message explicitly names the soak timeout. Merge commit `e8268403c` landed PR #3103. The drain log records that merge in the pass that completed **17:48:10.365Z**, at we:../plateau-app/.drain-daemon/daemon.log:120771. The existing account in we:reports/2026-09-30-gh-graphql-spend.md describes an earlier proposed adapter state; it is not evidence that the final merged drain is metered.

Use the structured history for pass counts: we:../plateau-app/.drain-daemon/history.jsonl has **44** entries whose `at` is inside the interval. The human log omits routine idle passes and shows only 14 pass-summary lines for the same start-time filter. The failed passes began **18:24:27.093Z** and **18:26:29.418Z**. The four installation-exhaustion lines at we:../plateau-app/.drain-daemon/daemon.log:120905, :120906, :120909, :120910 are a summary and backoff message for each of those two passes.

Fix design: provide metered synchronous **and asynchronous** drain transports independently of PATH, retaining async concurrency and subprocess limits. Capture actual query costs where feasible, record every attempt once, and preserve error/stdio behavior. Reproduce the 90-second soak regression with an isolated admission root; repair its cause rather than removing the adapter. Prove the production launchd-equivalent environment produces drain ledger entries before claiming coverage. No such fix or live drain run was attempted here.

## What the raw ledger actually proves

Read-only parsing covered the entire roughly 61 MB host ledger, `we:../.lanes/.admission/gh/calls.jsonl`, rather than only the reporter's bounded tail. Records were filtered by `ts` to the exact incident interval, then passed to the existing pure `attributeSpend` function. Nested invocation records were grouped by its existing logic. Results:

- Observed gap total: **6,194**; attributed: **3,644**; estimated: **0**; unattributed: **2,550**.
- **883** logical App GraphQL invocations. Largest groups: dispatch-plan **416**, pr-land **246**, fix-dispatch **113**, review-daemon **31**, parked-conflict **28**.
- Dispatch-plan's already-done searches have **402** in-band one-point cost observations; another **4** belong to we:scripts/operations/run.mjs. These **406 measured points** are visible traffic, not missing traffic. Continued searches may be legitimate git fallbacks; their presence alone does not diagnose failed deployment.
- No drain caller appears in those App GraphQL invocations. Conversely, most listed callers have no in-band costs: their assigned points must not be interpreted as exclusively their own consumption.

An independent counter-span calculation, grouping by limit and reset and taking maximum minus minimum used, gives:

| GraphQL limit | Reset UTC | Observations | Used range | Observed span |
| --- | --- | ---: | --- | ---: |
| 6,100 | 17:28:09 | 5 | 5,579–5,579 | 0 |
| 6,100 | 18:09:33 | 1 | 51–51 | 0 |
| 6,100 | 18:28:10 | 311 | 2,617–6,100 | 3,483 |
| 6,100 | 19:10:43 | 5 | 6–45 | 39 |
| 6,100 | 19:28:11 | 422 | 34–2,086 | 2,052 |
| 5,000 | 18:25:04 | 6 | 264–671 | 407 |
| 5,000 | 19:25:05 | 2 | 61–62 | 1 |
| **Total** | | **752** | | **5,982** |

This span excludes unobserved edges. It differs from `attributeSpend`, which can establish an initial baseline from a known cost and also assigns all responses in a nested invocation to its first nonempty identity (we:scripts/lib/gh-spend.mjs:121). The exact interval has **498 mixed-identity invocation groups**: 266 App/default, 24 personal-token/App, and 208 personal-token/default. Thus its `app` rollup can incorporate outer records with a different identity and exclude raw App-labelled records grouped under another identity. The 6,194 figure is the existing meter algorithm’s output, not an independent per-installation measurement. Neither number is a trustworthy installation-163880042 total without provenance. Some reset times precede the local log timestamp; these observations need response-time/cache provenance too.

The dominant observed bucket reached 6,100 used at **18:23:40.538Z**, immediately before the drain's failures, and the next dominant reset window starts at **18:28:26.673Z** with 34 used. That is temporal evidence, not proof that this bucket belongs to installation 163880042. The stated 5,000 capacity should be rechecked with an authenticated installation-labelled observation, not used as a subtraction constant.

The reporter has three further limits. It floors the start to a UTC hour; reads at most 16 MiB of unconsumed live log; and prefers previously persisted hourly rows over recomputing that hour. Moreover `now` selects a lower bound but is not a historical upper-bound filter. Consequently, backdating `now` is not an exact replay. Zero unattributed in one report section/window is not proof of complete capture. The 488 figure cannot justify `5,000 - 488` as an identified external spender.

Fix design: record a non-secret installation ID alongside auth provenance, distinguish Actions installations and personal fallback, retain unknown identities as unknown, and carry that identity through cache/child environments. For legacy responses without in-band cost, keep counter movement distinct from per-caller cost; currently up to 50 points of the gap can be assigned to the next caller, hiding concurrent unmetered work. Expose exact start/end, reset windows, skipped bytes, baseline coverage, and persisted/live provenance. Add explicit interval queries; never silently label a partial clock hour as a trailing hour.

## Shim, launchd, and other candidates

The shared shim's throttle target currently exists and points at the primary WE checkout. Its installed lines 70–85 fall back to the real binary when the target or module graph disappears. Source is we:scripts/lib/gh-app-shim.mjs:321. The fallback carries the fresh cached token but captures no ledger entry. Of **177** installed shim files inspected, all contain a throttle target; **162** targets no longer exist, predominantly deleted smoke-candidate or temporary checkouts. The shared shim is not one of those missing targets. No timestamped fallback was found in the inspected incident-hour daemon logs. `ps` was denied (`Operation not permitted`), so no claim is made that those 162 stale shims remain in live process PATHs.

Fix design: use a stable fallback meter/transport outside disposable checkout module graphs, preserving one execution per command and secret redaction. Record fallback reason and cost/unknown-cost even when pacing cannot load. Regenerate affected shims through their owner and verify active-process adoption separately; do not delete shims still referenced by a process. This is a real coverage defect but its incident-hour spend remains unknown.

All **13** `com.we.*` LaunchAgent plists were read with an allowlist of non-secret fields. None includes the App shim in its installed PATH. The configured services are:

- `com.we.health-watch`: health-watch clone.
- `com.we.build-dispatch-daemon`, `com.we.verify-daemon`: control clone.
- `com.we.review-daemon`, `com.we.fix-dispatch-daemon`, `com.we.lease-reaper`, three `com.we.lane-pool-health-watch-*`, and three `com.we.parked-pr-conflict-watch-*`: review-daemon clone.
- `com.we.conveyor-pass-daemon.merge-orphan-sweep`: merge-daemon clone.

Each configures App auth. PATH absence alone is insufficient to indict them: snapshot and parked-conflict transports import the throttle (we:scripts/lib/pr-snapshot.mjs:30; we:scripts/conveyor/parked-pr-conflict-watch.mjs:123), and their calls appear in the ledger. Review jobs explicitly install the shim at we:scripts/operations/review-job.mjs:510–:525; raw `ghPrView` at we:scripts/operations/review-pr-io.mjs:122 is therefore not automatically an unmetered daemon call.

Lifecycle helpers still have raw reads at we:scripts/lib/daemon-edge.mjs:574 and we:scripts/lib/daemon-rebuild.mjs:897. They would bypass the meter under these daemon PATHs, but the observed control/review overlay registries were empty and no default edge directory was present. Their historical execution count is unavailable; do not assign spend. Follow up within the direct-call coverage audit. Smoke probes use a generated shim (we:scripts/lib/daemon-live-smoke.mjs:220, :258), so inspect the actual target lifetime before treating smoke as a separate bypass.

Tracked-file `git grep` ran across WE, Plateau App, and Frontier UI for token minting/cache use, GitHub API URLs, GraphQL, Octokit, direct child-process gh calls, fetch/curl, and workflow authentication. WE's mint and installation-access checks use REST, at we:scripts/lib/github-app-token.mjs:97, :146 and we:scripts/lib/github-app-auth-env.mjs:97. They do not explain GraphQL depletion. Plateau's direct fetch PR provider is REST (we:../plateau-app/packages/dev-browser/src/forge/providers.ts:51); its alpha helper shells gh but no incident invocation/App identity was established. Frontier UI yielded no tracked direct GraphQL/Octokit/App-token client. Other raw-gh utilities require caller-environment evidence before attribution.

The webhook Worker has no outbound GitHub client or installation-token minting in the inspected source. we:scripts/conveyor/pr-events-worker/worker.mjs:42 receives requests and delegates to its Durable Object; we:scripts/conveyor/pr-events-worker/core.mjs handles event ingestion/readout. Its configured secrets are webhook verification and event-reader credentials (we:scripts/conveyor/pr-events-worker/wrangler.toml:10), not the App private key. **Zero GraphQL calls by this source implementation**; the deployed bundle was not remotely verified.

## Actions: authentication inspected, hourly run counts blocked

| Repository | Workflow evidence | Installation-163880042 run count, 17:48–18:48Z |
| --- | --- | --- |
| WE | we:.github/workflows/apply-review-request.yml:99 and we:.github/workflows/stage-pr-view.yml:111 use `secrets.GITHUB_TOKEN`; deploy uses `github.token` at we:.github/workflows/deploy.yml:117. Release-please has no custom token override at we:.github/workflows/release-please.yml:51. | **Unavailable**, not zero |
| Plateau App | we:../plateau-app/.github/workflows/apply-review-request.yml:94, deploy at we:../plateau-app/.github/workflows/deploy.yml:83, alpha at we:../plateau-app/.github/workflows/deploy-alpha.yml:225, :229, and destroy at we:../plateau-app/.github/workflows/destroy-alpha.yml:83 use built-in workflow tokens. | **Unavailable**, not zero |
| Frontier UI | Only tracked workflow is we:../frontierui/.github/workflows/ci.yml; checkout/build jobs, no custom App-token mint or GraphQL step found. | **Unavailable**, not zero |

WE and Plateau also use `FUI_READ_TOKEN` for sibling checkout. Its secret value/type was not read, and checkout authentication is not evidence of GraphQL traffic. No tracked workflow mints this App's token. Thus Actions are **not supported as the missing spender by this source audit**, but remote workflow revisions and actual runtime credentials remain unverified.

Read-only REST requests for each repository's Actions runs, filtered with `created=2026-09-30T17:48:00Z..2026-09-30T18:48:00Z&per_page=100`, all failed with `error connecting to api.github.com`. A public API fetch through the web tool also failed. No authentication refresh or secret retrieval was attempted to work around this. To finish that evidence slice on a network-enabled host, paginate all three results, deduplicate run IDs, group by workflow and creation hour, then inspect the workflow revision and job auth. Actor counts measure triggers, **not the installation used by API requests**. Match installation identity and response cost before converting runs/hour into points/hour.

## Follow-up cards and verification

Filed through `node we:scripts/operations/run.mjs file-item`, with `kind=story`, explicit WE-qualified scopes, and `queue=false` so this diagnosis does not dispatch fixes:

- #xp83iru: drain synchronous/asynchronous transport coverage and the soak regression; owns this report through `relatedReport`.
- #xkcp5vc: missing-throttle shim fallback metering.
- #x3u395z: installation identity and legacy-cost uncertainty.
- #xmjz7ex: exact report intervals and observable coverage.

The required `node we:scripts/verify-lane.mjs` selected checks for all five changed files, but could not write its verification marker under we:.git (sandbox `EPERM`). The supported `run` mode then executed the same selected checks without a marker, using a temporary writable admission root:

- Selected Vitest check: no test files relate to these five Markdown additions; exited 0 under the gate's own `--passWithNoTests` selection.
- Standards check: two report path-prefix errors were corrected. The final run reports **one error**: the new report is untracked. It also reports 4,509 existing warnings. The required report pointer and all new card content pass the remaining checks.
- Individual locus checks pass for all five additions. `git diff --check` passes; only the four cards and report are present in the working-tree status.

Verification is **not green**: the normal marker cannot be written in this sandbox, and the untracked-report guard requires index/commit work that this environment does not permit. The report is preserved for the requested human diff review; it was not deleted to silence the gate. No tests, gates, runtime code, or shared agent docs were weakened or edited. No commit, push, or PR was performed.
