---
bornAs: x9mmdu2
kind: task
status: open
dateOpened: "2026-08-05"
tags: []
scope: ["we:scripts/lib/review-escalation.mjs", "we:scripts/lib/__tests__/review-escalation.test.mjs", "we:scripts/lib/review-policy.contract.json", "we:scripts/check-standards-rules.mjs", "we:scripts/__tests__/check-standards-rules.test.mjs"]
---

# Blast-radius must cover every file the required check's RESOLUTION depends on, not only the files that name it

`BLAST_RADIUS` in [`we:scripts/lib/review-escalation.mjs`](scripts/lib/review-escalation.mjs) registers surfaces the gate *reads*. It registers nothing that decides **what the required check resolves to when it runs**: the manifest declaring the scripts, the lockfile CI installs from, and the runner configs choosing which tests get collected. A diff to any of those can make the required check pass by running less, and merges today with no `review:*` label. Stated as a rule, not a path list — a path list is what produced four review rounds each finding one more surface.

## The framing — resolution, not naming

PR #1048's review found this class one file at a time: round 2 found a tree, round 3 found another, round 4 found the root manifest. Each fix was correct and none predicted the next, because each was written as "add this path". The generalisation that does predict them:

> A file belongs in `BLAST_RADIUS` if changing it alone can change **what the required check does**, whether or not the file mentions the check by name.

`we:package.json` names the scripts, so a path-list reviewer finds it. `we:package-lock.json` names nothing and is the surface with the *largest* leverage. That asymmetry is the whole point of stating the rule this way.

## The surfaces, each scored live against this PR's head

All four return `false` from `isBlastRadiusPath` — re-measured after the round-4 widening was carved back out, so these are the current, real scores:

| Path | Score | What it decides |
|---|---|---|
| `we:package.json` | `false` | Declares every npm script the workflows invoke by name. |
| `we:package-lock.json` | `false` | **The file CI actually resolves tooling from.** Every job installs with `npm ci`, which reads the lockfile strictly and ignores what the manifest's version ranges would resolve to. |
| `we:vitest.config.ts` | `false` | Declares which tests a `vitest run` collects — including whether the gate's own unit tests under [`we:scripts/lib/__tests__/`](scripts/lib/__tests__/) are in the set. |
| `we:playwright.config.ts` | `false` | Declares `testDir` and the `projects` the `test:interaction` and `check:visual` scripts select. |
| `we:vitest.workspace.ts` (and `.js` / `.mjs` / `.json`) | `false`, **and the file does not exist yet** | vitest 1.6.1 AUTO-DISCOVERS a root workspace file and lets it override the project/include set. Verified in the lane: the installed `vitest/dist` carries the `vitest.workspace` / `workspaceFiles` discovery strings, and `npx vitest --help` exposes `--workspace`. |

**A file that does not exist yet is the case a path list cannot reach.** The workspace entry above is the
sharpest illustration of why this item is framed as a rule. Every other surface here can be found by grepping
the repo; `we:vitest.workspace.ts` cannot, because **adding** it is the attack. A one-file PR creating
`export default ['./demos']` makes vitest honour the workspace instead of the config, so
`we:scripts/**/__tests__/**` — including the tests pinning `BLAST_RADIUS` itself — is no longer collected. The
required check goes green because it now runs less, and the PR scores `{escalate: false}`. Any registration
written under this item must therefore enumerate the RUNNER'S OWN discovery filenames, not the config files
present in the tree; a runner upgrade that adds a discovery name must fail a gate rather than silently widen
the hole.

**The lockfile is the sharpest one of the files that do exist.** A lockfile-only diff — no manifest change, no source change — can repoint `vitest` at a stub that exits `0`, or add a transitive dependency whose install script runs on the runner *before any gate does*. Lockfile-only dependency bumps are also the single most common shape of agent-authored PR, so this is the highest-traffic unreviewed path in the repo, not a theoretical one.

## Correcting round 4's justification — `npm test` is NOT what CI runs

Round 4 justified registering `we:package.json` on the claim that `"test": "vitest"` is "the script CI runs as the required check", and told the story that flipping it to `"exit 0"` silently stops the suite. **That story is false as CI is configured**, and the correction matters because it changes which paths are actually load-bearing.

Measured in [`we:.github/workflows/ci.yml`](.github/workflows/ci.yml): no workflow in the repo ever invokes `npm test`. The confusion is a name collision — the required check is the CI **job** named `test` ([`we:scripts/merge-ai-prs.mjs`](scripts/merge-ai-prs.mjs) defaults `requiredCheck = 'test'`), not the npm **script** named `test`. What that job and its dependency actually run:

- `test-shard` → `npm run test:coverage:shard` (`vitest run --coverage --shard=i/N`)
- `test` (needs `test-shard`) → `npm run coverage:merge -- … --threshold=80`, then `npm run check:standards`
- `smoke` → `npm run build:docs`, `npm run test:interaction`
- `visual` → `npm run check:visual` — **currently disabled** (`if: ${{ false }}`, #2232)

`npm test` is the **local / lane** gate command (the Definition of Done in [`we:AGENTS.md`](AGENTS.md), and the pre-PR run). Editing `"test": "exit 0"` leaves the sharded CI suite running in full and disables nothing on the runner. So the real CI-disable vectors are `test:coverage:shard`, `check:standards`, `coverage:merge`, `test:interaction` — and, upstream of all of them, the lockfile that decides what `vitest` and `playwright` even are. Any note written under this item must not repeat the `"test": "exit 0"` version.

## Why this was carved out of PR #1048

PR #1048 delivered #2909 (the agent-behaviour source trees). Its round 4 added a root-manifest pattern and a vitest-config pattern on the false justification above, and re-broke a citation defect round 3 had fixed. Four rounds each surfacing a different unregistered surface is a non-converging loop, so the whole gate-definition widening came out of that PR and landed here, framed by the resolution rule rather than by a file list. PR #1048 is confined to what rounds 1–3 reviewed.

## The prevention — make the false claim script-decidable

The round-4 error was a **contract description asserting a CI fact that no gate checks**. Both sides of that assertion are in-repo text, so it is fully script-decidable: add a `check:standards` rule (in [`we:scripts/check-standards-rules.mjs`](scripts/check-standards-rules.mjs)) that extracts every npm script name a [`we:scripts/lib/review-policy.contract.json`](scripts/lib/review-policy.contract.json) description claims CI runs, and errors unless that name appears in a `run:` line of some workflow under [`we:.github/workflows/`](.github/workflows/). Per the hookable-vs-judgment rule, a claim a script can falsify does not belong in a reviewer's memory.

## Done when

- `isBlastRadiusPath` returns `true` for `we:package.json`, `we:package-lock.json`, and the `vitest` / `playwright` config spellings **including the auto-discovered `vitest.workspace.*` names that no file currently occupies**, with the narrowness (root-only vs. any-directory) argued per path in the comment rather than asserted.
- The registration is derived from the RUNNER'S discovery filenames, not from the files present in the tree, and a test enumerates them — so a runner upgrade that adds a discovery name fails the gate instead of silently widening the hole.
- The comment justifying the entries states the **resolution** rule — a file scores because changing it alone changes what the required check does — so the next surface in this class is covered by the rule instead of needing a fifth review round.
- Positive **and** negative cases pin each pattern in [`we:scripts/lib/__tests__/review-escalation.test.mjs`](scripts/lib/__tests__/review-escalation.test.mjs), including a lockfile-only diff scoring a `review:*` label at PR-open.
- The `blast-radius` token description in [`we:scripts/lib/review-policy.contract.json`](scripts/lib/review-policy.contract.json) is re-derived from the **whole** `BLAST_RADIUS` array (the #2564/#2566 rule), and names only scripts CI genuinely runs.
- The `check:standards` rule above exists and fails on a contract description naming an npm script that no workflow `run:` line invokes — proven by a red case in [`we:scripts/__tests__/check-standards-rules.test.mjs`](scripts/__tests__/check-standards-rules.test.mjs).
