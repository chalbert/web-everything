# Machine PR titles: review notes / proposed PR body

Machine titles now name the card, finding or repair. The shared formatter reserves the stable repository/item/kind prefix, caps PR titles at 70 Unicode characters, and preserves prevention review provenance. Missing publication subjects fail closed; builds can use the files actually changed. Card-only kinds remain annotations, and cited review PR numbers do not become delivered item IDs.

Stacked dependency: `lane/pr-titles` (locally available commit `271472aa6`, “Machine PR titles name the card”). It is not an ancestor of this checkout. The requested fetch/merge was attempted, but the sandbox refused the fetch’s Git metadata write; GitHub was unreachable. Its locally available file diff is included here. A human must confirm merge status and perform the merge or rebase before publishing. No commit, push or PR was created.

## Source inventory

Locations refer to the resulting working files. “Before” records the baseline template (including the earlier branch where applicable). Audited with `git grep` across executable sources and brief templates; scanned both sibling repositories as well.

| Source | Before | Result |
| --- | --- | --- |
| `we:scripts/operations/open-pr.mjs:127` | `--title=${title.trim()}`; prepare planning used fixed plan prose | Pass explicit subjects; prepare IO replaces planning metadata before publishing. |
| `we:scripts/operations/open-pr-io.mjs:45` | preparePrTitle(item) | Read the origin/main card; reject absent subject before spawning. |
| `we:scripts/pr-land.mjs:760` | TITLE ?? latest commit subject ?? `land ${REF}` | Normalize legacy machine subjects and refuse missing metadata. |
| `we:scripts/lib/forge-land-provider.mjs:86` | `--title`, title (unvalidated) | Validate and cap the title immediately before creating the PR. |
| `we:scripts/operations/prepare-pr.mjs:13` | `WE #${item}: prepare item — Design/MVP/Test plan/Proof plan/Follow-ups` | `WE #id: prepare — card title`. |
| `we:scripts/operations/deliver-item-wrapper.mjs:2148` | `<REPO> #${item}: delivery build` / `gate-failure fix` | Card title, or actual touched paths, after build/gate-fix. |
| `we:scripts/operations/deliver-item-wrapper.mjs:1992` | `WE #${item}: converge round ${round} revision` | Card title or revised paths after fix; round remains in the body. |
| `we:scripts/lib/approval-prevention-notice.mjs:385` | `File the prevention guard(s) owed by ${repo}#${pr}’s independent review` | First finding, then review provenance, in the CARD title. |
| `we:scripts/lib/review-loop-policy.mjs:355` | Same generic prevention-card heading | Same descriptive card builder, used by unattended review filing. |
| `we:scripts/operations/land-prevention-card.mjs:371` | `WE #${item}: file the prevention guard(s) owed by an independent review` | Normalize legacy card input at filing; PR subject precedes `(from #PR review)`. |
| `we:scripts/operations/health-file-request-land.mjs:178` | `WE #${filedCard}: health daemon filing request — ${entry.title}` | Preserve entry title; shorter file prefix and 70-character bound. |
| `we:scripts/operations/prepare-stamp-land.mjs:50` | `WE #${num}: complete prepare stamp` | Card heading after prepare-stamp. |
| `we:scripts/operations/review-prep-io.mjs:334` | `review-prep: independent review of #${item} — confidence ${confidence}, ...` | Staged card heading after review-prep. |
| `we:scripts/lib/probation-launcher.mjs:172` | `WE #${num}: ${taskType} build on probation (${executor}/${model})` | Card title after task-specific build kind; attribution stays in trailers. |
| `we:scripts/lib/probation-launcher.mjs:381` | `<item-or-PR>: CI-heal PR #${pr} on probation (${executor}/${model}, ${reason})` | Repair subject and target PR; actual producer supplies reason plus changed paths. |
| `we:scripts/operations/probation-build-run.mjs:525` | `WE #${num}: record standalone worker Findings` / probation commit builder | Card heading after findings or task-specific build. |
| `we:scripts/operations/probation-build-run.mjs:600` | `WE #${num}: ${taskType} build — ${slug}` | Readable slug subject, stable kind and length cap. |
| `we:scripts/operations/probation-heal-run.mjs:194` | Heal builder with only reason and worker | Supply actual changed paths as the repair subject. |
| `we:scripts/operations/build-dispatch-hold-route-land.mjs:317` | `WE #${num}: auto-resolve — build-dispatch hold cited commit ${commit} as already landing the spec` | Card heading after auto-resolve, with the verified delivery commit subject as fallback. |
| `we:scripts/operations/build-dispatch-hold-route-land.mjs:324` | `WE #${num}: auto-route to prepare — build-dispatch hold found the spec out of scope / superseded` | Card heading or hold reason after auto-route. |
| `we:scripts/conveyor/orphan-claim-release.mjs:372` | `backlog: release ${count} orphaned claim(s) to open (#3913)` | Names the affected claims and their actions after release. |
| `we:skills-src/conveyor/prepare-item-agent-brief.md:184` | Fixed Design/MVP/Test plan/Proof plan/Follow-ups title | Explicit short card-title slot; producer re-reads the card. |
| `we:skills-src/conveyor/fix-agent-brief.md:400` | `{{ATTRIBUTION}}: address review:changes on PR #{{PR_NUM}} — <one-line what you fixed>` | Specific correction before target PR, preserving repo attribution. |
| `we:skills-src/conveyor/fix-agent-ci-brief.md:340` | `{{ATTRIBUTION}}: CI-heal PR #{{PR_NUM}} — rebase onto main + repair the failing check` | Required failing-check-and-repair slot before target PR. |

## Audited paths that do not open a new PR

| Source | Current template / behavior | Disposition |
| --- | --- | --- |
| `we:scripts/lane-drain.mjs:957` | `drain: JIT-number ${summary} at land (#2288)` | Number mapping is already specific; housekeeping publishes main, not a new PR. |
| `we:scripts/lane-drain.mjs:1066` | `drain: unqueue + cleanup card ${num} lane manifest post-land (#2175)` | Existing main housekeeping; no new PR. Reopen and resolve at lines 1117/1200 likewise. |
| `we:scripts/lib/nnn-collision-heal.mjs:302` | `backlog: heal new-item id collision(s) pre-check (${tag}) (#2222)` | Repairs an existing ref; tag carries the renumbering mapping. |
| `we:scripts/lib/rebase-drop-content.mjs:395` | `drain: rebase ${laneRef} onto ${base}, auto-resolve ... ${mergedPaths}` | Existing PR conflict repair; concrete paths already present. |
| `we:scripts/lib/rebase-drop-manifest.mjs:222` | `drain: rebase ${laneRef} onto ${base}, drop transient ${manifest}${healTag}` | Existing ref repair; no PR create. |
| `we:scripts/conveyor/parked-pr-conflict-watch.mjs:1897` | Conflict repair delegates ref mutation; notification titles are not PR titles. | Existing PR only. |
| `we:scripts/lib/daemon-rebuild.mjs:368` | `daemon-rebuild: merge overlay ${ref} (PR #${pr}) onto ${cur}` | Disposable daemon overlay commit; no PR create. |
| `we:scripts/lib/daemon-edge.mjs:223` | `daemon-edge: merge main ${sha}`; lines 287/327 name reverted/merged PR and ref | Daemon execution refs; no PR create. |
| `we:scripts/conveyor/poc-branch-sync.mjs:214` | `mergeCommitMessage(branch, target)` | Branch synchronization, no PR create. |
| `we:scripts/operations/ci-heal-pr-dispatch.mjs:1` | Dispatches the CI-heal brief/provider; no title builder | Actual sources are the CI-heal brief and probation launcher above. |
| `we:scripts/conveyor/reconcile-fix-dispatch.mjs:1` | Dispatches the fix brief; no title builder | Actual source is the fix brief above. |
| `we:scripts/review-set-label.mjs:151` | Delegates approval filing to the prevention landing job | Card builder and landing producer are covered above. |
| `we:scripts/lib/prevention-landing-job.mjs:89` | Forwards `input.title` to the landing job | No independent template. |
| `we:scripts/operations/file-item.mjs:32` | Explicitly excludes commit/verify/open-pr from filing | Explore, reference remediation and health diagnostics supply card subjects to filing; PR-producing landing jobs are covered above. |
| `we:scripts/operator/dispatch.mjs:257`, `we:scripts/operator/converge.py:336` | `ci-heal: <what was stale/broken and what you did>` | Existing-PR repair commits; already requires a specific repair. |
| `we:../plateau-app/tools/drain-daemon/lib.mjs:1` | Delegates to WE landing/review tools; no PR title template found | Read-only sibling audit; shared WE formatter covers repository-tagged delivery. |
| `we:../frontierui/tools`, `we:../frontierui/scripts`, `we:../plateau-app/scripts` | No independent executable PR-create/title template found by git grep | No sibling edits needed or made. |

## Consumer coverage

`we:scripts/backlog-stranded-sweep.mjs:76` classifies the stable kind, not words in the card subject. `we:scripts/lib/open-pr-items.mjs:48` excludes the review provenance suffix from item-number discovery. Existing delivery/hash/duplicate grouping consumers are exercised by `we:scripts/operations/__tests__/machine-pr-title.test.mjs`. `we:scripts/operations/review-loop-cli.mjs:239` recognizes both old and new card headings, but still requires matching review provenance, reviewed head and guard coverage. The regression uses both headings and rejects another review/head.

All registered machine kinds are tested with two different subjects and with no subject. Adding a kind extends that test automatically; unknown kinds are rejected. The final GitHub create boundary also rejects missing/planning subjects.

## Before/after evidence

Historical subjects below were read from local Git history. After values are local replays against real card headings/findings, not claims that a PR was opened. Additional kinds use the same real cards as explicit template replays.

| Kind | Before (history) | After (replay) |
| --- | --- | --- |
| prevention | WE #xdulp5e: file the prevention guard(s) owed by an independent review | WE #xdulp5e: prevention — Add a required 'sandbox… (from #3187 review) |
| prepare | WE #4435: prepare item — Design/MVP/Test plan/Proof plan/Follow-ups | WE #4435: prepare — Add a deterministic daemon re… (from #2839 review) |
| build | WE #4361: delivery build | WE #4361: build — Specialist agent roles: a role registry with narrow… |
| gate-fix | WE #4369: gate-failure fix | WE #4369: gate-fix — Fix briefs' mid-work GATE_COMMAND is a bare veri… |
| prepare-stamp | WE #4544: complete prepare stamp | WE #4544: prepare-stamp — lane-worker-without-lease reads finished se… |
| findings | WE #4388: record standalone worker Findings | WE #4388: findings — Fix flaky fake-claude-sessions test: ETXTBSY spa… |

The remaining producer shapes, replayed using the real #4291 card (“Probation launcher for doc-fix builds”):

| Kind | Before template expanded for #4291 | After |
| --- | --- | --- |
| fix | WE #4291: converge round 2 revision | WE #4291: fix — Probation launcher for doc-fix builds |
| doc-fix-build | WE #4291: doc-fix build on probation (codex/gpt-6-astra) | WE #4291: doc-fix-build — Probation launcher for doc-fix builds |
| bugfix-build | WE #4291: bugfix build on probation (codex/gpt-6-astra) | WE #4291: bugfix-build — Probation launcher for doc-fix builds |
| test-fix-build | WE #4291: test-fix build on probation (codex/gpt-6-astra) | WE #4291: test-fix-build — Probation launcher for doc-fix builds |
| review-prep | review-prep: independent review of #4291 — confidence 5, no corrections owed | WE #4291: review-prep — Probation launcher for doc-fix builds |
| file | WE #4291: health daemon filing request — Probation launcher for doc-fix builds | WE #4291: file — Probation launcher for doc-fix builds |
| auto-resolve | WE #4291: auto-resolve — build-dispatch hold cited commit as already landing the spec | WE #4291: auto-resolve — Probation launcher for doc-fix builds |
| auto-route | WE #4291: auto-route to prepare — build-dispatch hold found the spec out of scope / superseded | WE #4291: auto-route — Probation launcher for doc-fix builds |
| ci-heal | WE #4473: CI-heal PR #2982 — rebase onto main + give the empty-commit test a git identity (history) | WE #4473: ci-heal — give empty-commit test a git identity (PR 2982) |
| release | backlog: release 1 orphaned claim(s) to open (#3913) (template replay) | WE #4291: release — orphaned claim 4291 (reopen) |

## Workflow producers

| Source | Before | Result |
| --- | --- | --- |
| `we:.github/workflows/update-visual-baselines.yml:132` and `we:scripts/operations/machine-pr-title.mjs:87` | `chore(visual): refresh linux baselines` | Shared bounded title names the first changed snapshot and additional count; the commit and PR use the same output. Empty snapshot diff skips publication. |
| `we:.github/workflows/release-please.yml:47`, `we:release-please-config.json:6` | Action-owned package/version title | Already specific: local history contains `chore(main): release contracts 0.1.0`. Retained unchanged. |

Baseline before/after, replayed by executing the actual workflow step against a temporary Git repository containing a changed home snapshot: `chore(visual): refresh linux baselines` → `WE #2238: baselines — linux home`. The test parses the workflow and verifies both publication fields consume the generated output. The baseline kind is bookkeeping, not delivery credit for #2238.

The audit also scanned the sibling workflow directories; no independent title templates were found there.


## Validation and remaining environment constraints

- The wider lane verifier ran its own selected set: **11,544 passed, seven failed** across three real-I/O suites. The seven failures exercise process inspection or a listening socket. Direct probes reproduce both restrictions: `ps` is denied and binding localhost returns `EPERM`. No tests were skipped, weakened or reclassified to conceal these failures.
- The required bare `node we:scripts/verify-lane.mjs` invocation fails when writing its marker into read-only Git metadata. Its supported `run` mode executes the same selected gate without a marker. A temporary `LANE_POOL_ROOT` supplies writable admission-lock storage; it does not change test selection.
- Full `npm run check:standards`: **zero errors**. Existing repository warnings remain. `git diff --check` is clean.
- Focused title/producer tests passed; the final publication subset passed **168 tests**, including executing the actual visual-baseline workflow step. Existing-PR landing does not read the new-title getter; only creation and its dry-run preview do.
- No live GitHub mutation was attempted. The earlier branch's merge status remains unverified, and its cached diff was applied without changing Git history. The human reviewer must reconcile that dependency before publishing.
