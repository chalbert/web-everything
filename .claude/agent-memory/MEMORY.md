<!-- Memory index = a TREE: each line → a category sub-index (recall-gated, loaded on demand). Open a leaf: node scripts/memory-resolve.mjs <N>. Add a rule via its sub-index, not here. -->

<!-- core-invariants: load-bearing rules kept always-loaded (each also lives in its sub-index). Open a leaf: node scripts/memory-resolve.mjs <N> -->
- 6. WE Holds ZERO Standard Implementation — FOUNDATIONAL; impl→FUI; OK in WE: definitions + validate scripts; #1282
- 96. Repo Constellation — WE (standard+plugs)→Frontier UI (impl)→plateau-app (product); legacy `plateau` ABANDONED
- 25. Platform Decisions = Statute Layer — platform-decisions.md = cite-able cluster rules; codifiedIn on resolve; #911
- 75. Native-First Default — built-in defaults align to web-platform standards; libraries are opt-in
- 95. Plug = Proposed Missing Standard — plugged=proposed standard; unplugged=safe-now; #1826/#1807
- 106. Backlog Is The Tracker — /backlog/ renders from backlog/*.md (one file per item); docs/agent/backlog-workflow.md
- 39. Never Take An Unprepared Decision — never rule w/o preparedDate; screen→/prepare or pick a prepared item; #1457
- 51. Hookable vs Judgment Rule — script-decidable→hook (deterministic); judgment stays in context; footguns first
- 9. Memory-Management Policy — index=TREE: always-loaded map+core-invariants; rules live in category sub-indexes; #1517/#1868
- 43. Enforce Shared Gate At Write-Time — PreToolUse(Edit|Write) hook scans content + denies the write; #883
- 104. Commit On Current Branch — commit on checked-out branch, never branch-first; `checkout -b` corrupts sessions; (never-push REMOVED 2026-06-29 → [[never-push-guard-removed]])
- 105. Claim Ignores Git State — backlog ownership=status:active NOT the working tree; uncommitted edits never a drop-reason
- [Parallel /workflow now works (WE-only)](parallel-workflow-blocked-by-git-guard.md) — clone model + lane/* push carve-out; proven 2026-06-29b 5/6; pass primaryRoot; cross-repo still serial
- [/workflow cross-repo false-drop FIXED](workflow-crossrepo-lanes-falsedrop.md) — cause: stale impl origin/main; sync origins first. NEW gap: unscoped impl gate blocks landing #1965
- [never-push guard removed](never-push-guard-removed.md) — push to main now allowed (user 2026-06-29); branch/broad-stage guards stay; FUI+plateau remotes →SSH
- [UI change needs before/after visual check](ui-change-needs-before-after-visual-check.md) — CSS/template edits → Playwright before+after on the running dev server; gate doesn't render (#1895)
- [AI runs regression after each change](ai-runs-regression-after-each-change.md) — agent runs the MATCHING lane (visual/unit/smoke/standards) after edits; git hook is the wrong fit

<!-- categories: everything else, recall-gated — open the sub-index whose keywords match the task -->
- **[Constellation & Placement](index-arch.md)** — placement · WE/FUI/Plateau · boundary · contract · impl · home · migration (21 rules)
- **[Standards · Intents · Protocols · Authoring](index-std.md)** — standard · intent · protocol · adapter · authoring · dimension · native-first (23 rules)
- **[Monetization](index-monetization.md)** — pricing · open-core · license · free/paid · cost↔revenue · on-device · assembler line (5 rules)
- **[Backlog Workflow & Item State](index-back.md)** — backlog · item state · resolve · slice · park · epic · NNN · locus (22 rules)
- **[Decisions & Forks](index-dec.md)** — decision · fork · ratify · prepare · merit · confidence · residual (24 rules)
- **[Verification & Proof](index-verif.md)** — verify · prove · probe · grounding · closure · evidence (8 rules)
- **[Batch · Commit · Git Hygiene](index-batch.md)** — batch · commit · git · stage · push · branch · claim (8 rules)
- **[Testing · Gates · Build Infra](index-infra.md)** — gate · check:standards · vitest · build · vite · hook · dev-port · footgun (12 rules)
- **[Agent Meta · Memory · Model Routing](index-meta.md)** — memory · agent · model routing · working style · context · orchestration (12 rules)
- **[Exercise Apps · Configurator · Governance](index-app.md)** — exercise app · conformance loop · configurator · governance · personas (4 rules)
- [Composition DX adoption gap](composition-dx-adoption-gap.md) — framework-parity composition is adoption-critical; per-case rubric = #1963; gap = stacked zero-DOM composition
- [Shared pool lane unsafe for manual work](shared-pool-lane-unsafe-for-manual-work.md) — a peer /workflow refresh does reset --hard + clean -fd; use a dedicated clone outside .lanes/ + commit-push early
- [Keep local main current after merge](keep-local-main-current-after-merge.md) — post-merge sync must be `git pull --ff-only --autostash`; dirty tree must never leave main behind (#2183)
