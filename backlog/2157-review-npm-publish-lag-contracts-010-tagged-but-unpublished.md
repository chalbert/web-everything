---
kind: task
status: open
relatedTo: ["907", "2156", "2138", "2152"]
humanGate: { kind: credential, what: "Publishing the tagged 0.1.0 requires a credentialed npm publish (workflow_dispatch of we:.github/workflows/publish-contracts.yml with NPM_TOKEN) AND main reliably green via the operating PR-lane merge flow — neither agent-executable. The auto-lock-on-merge reassessment can follow once the publish itself is unblocked." }
dateOpened: "2026-07-02"
tags: [npm, publishing, ci, release-please, pr-flow]
---

# Review the npm-publish lag: @webeverything/contracts 0.1.0 tagged but not published

The first release ran but only half-completed and is now **lagging** — a GitHub Release + tag exist, but npm
does not have the package. Review and clear this once the blocker lifts.

## State (verified 2026-07-02)

- ✅ Release PR #2 merged → tag **`contracts-v0.1.0`** + GitHub Release created; manifest and
  `we:contracts/package.json` are at `0.1.0`.
- ❌ **npm publish never ran.** `npm view @webeverything/contracts` → E404. The publish job runs the
  **whole-repo** `npm run check:standards`, which was red with ~27 foreign errors (other items' `relatedReport`
  files missing on `main` + stale `we:AGENTS.md` inventory) — nothing about the contracts package.
- Side issue: a bot (`github-actions[bot]`) **auto-locks release PRs seconds after merge**, racing
  release-please's post-release comment and failing that job (release still gets created). Recurs every release.

## Why blocked

`npm publish` is coupled to the whole-repo health gate, so releasing is hostage to unrelated backlog debt on a
shared, concurrently-edited `main`. **Blocked by the PR-lane merge flow fully delivering** (#2138 / #2152):
once landing goes through PRs with required green CI + a merge queue, `main` can no longer sit red, and the
gate stops blocking releases. Owner decided (2026-07-02) NOT to decouple the publish gate for now.

**Review 2026-07-04 — the code blocker has LIFTED (stale `blockedBy` cleared).** #2138/#2152 are resolved and
the PR-lane merge flow is the operating reality: `main` moves only through CI-gated PRs (reinforced by the
#2203 strict lock + #2217 pre-push hook + #2216 green-reconcile drain landed this session), so `main` no longer
sits red from unrelated debt and the whole-repo gate stops holding releases hostage. **The one remaining gate
is the humanGate** — a credentialed `npm publish` of the already-tagged `0.1.0` (`workflow_dispatch` of
`we:.github/workflows/publish-contracts.yml`, `dry-run=false`, with `NPM_TOKEN`), which is **not
agent-executable**. So this stays `open` on the credential gate only, not on a backlog dependency.

## To do when unblocked

- Publish 0.1.0 once via the fallback (release-please won't re-publish it — its manifest already records 0.1.0
  as released): `we:.github/workflows/publish-contracts.yml` dispatched with `dry-run=false`. Confirm
  `npm view @webeverything/contracts` returns `0.1.0`. Future versions (0.1.1+) flow through release-please.
- Reassess the **auto-lock-on-merge** race (find/adjust the locking automation, or make release-please tolerant)
  so release jobs stop reporting failure.
- Revisit whether to decouple the publish gate or give it a package-scoped check (#2156 option C).

## Re-verified 2026-08-21 — still lagging, still credential-gated

Nothing has changed in the seven weeks since the 2026-07-04 review. Facts re-read off the tree and the
registry, not carried forward:

- `we:contracts/package.json` is `name: "@webeverything/contracts"`, `version: "0.1.0"`.
- `npm view @webeverything/contracts version` → **`npm error 404 '@webeverything/contracts@*' is not in this
  registry`**. Still unpublished.
- `we:.github/workflows/publish-contracts.yml` still carries the `workflow_dispatch` trigger with a `dry-run`
  input (`:24-27`) that defaults to a dry run, still runs `npm run check:standards` as a job step (`:49`), and
  still publishes with `npm publish --provenance --access public` under `NODE_AUTH_TOKEN: secrets.NPM_TOKEN`
  (`:67-69`). The dispatch route the card names is intact and unchanged.

The one gate remains the `humanGate: { kind: credential }` already on this card. There is no code change here
and nothing an agent can execute.

## Done when

- `npm view @webeverything/contracts version` prints `0.1.0`. That is the whole item, and it is a genuine
  fails-before / passes-after command: it returns E404 today (re-confirmed 2026-08-21) and returns `0.1.0`
  once the publish runs. **It is not agent-runnable** — reaching it needs the credentialed `workflow_dispatch`
  of `we:.github/workflows/publish-contracts.yml` with `dry-run=false` and `NPM_TOKEN`, which is exactly the
  `humanGate` on this card. So this item carries a tier-1 command with an explicit human-credential exemption
  on who can run it, rather than no criterion at all.
- The publish run is green end-to-end — i.e. the `npm run check:standards` job step (`:49`) passed rather than
  being bypassed. Visible in that workflow run's job log.
- The auto-lock-on-merge race gets a recorded outcome: after the publish, check whether the release job still
  reports failure from a `github-actions[bot]` lock applied seconds after merge, and write "fixed" or
  "accepted, because …" in one line on this card. A named look, not a judgment call.
- Whether to decouple the publish gate (#2156 option C) gets a stated answer on this card — reaffirm the
  2026-07-02 owner decision not to, or file the change as its own item.

## Independent review — 2026-08-21

Confidence: **Medium**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (NOT addressed; strategy: verify by mutation or reversion BEFORE building) — Most claims re-verify true against the live repo (npm E404, we:contracts/package.json at 0.1.0, we:.release-please-manifest.json recording contracts:0.1.0, #2138/#2152/#2203/#2217/#2216 all resolved, #2156 still open) — but the card's premise that the 'auto-lock-on-merge race' is still open, unaddressed future work is stale: we:.github/workflows/release-please.yml's own header comment documents that the functional consequence (publish getting skipped) was already fixed via the `always()` gate, a fact the card never cites despite discussing the same 2026-07-02 run.
- **unmeasured-impact** (NOT addressed; strategy: measure the constraint before sizing) — The card infers the whole-repo check:standards gate no longer blocks releases purely from the PR-lane merge flow now being 'the operating reality' (via #2138/#2152/#2203/#2217/#2216), rather than citing a direct re-run of `npm run check:standards`. I ran it independently just now and it does report 0 errors (1392 warnings) — so the inference holds — but the card's own text never cites that direct measurement for the specific constraint (whole-repo gate state) it says is now moot.
- **interface** (addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — #2156 (open) declares scope including we:.github/workflows/publish-contracts.yml, the same file 2157 discusses at length; the two cards are consistent — #2156 explicitly defers publish-lag tracking to #2157 and #2157's frontmatter lists #2156 in relatedTo — no disagreement found.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — The card's 'Done when' section requires the auto-lock outcome and the check:standards pass to be visible in the actual job log / recorded on the card, not inferred silently — matches the taxonomy's requirement that a failure (or its absence) surface rather than pass silently.

**Corrections applied by this review:**

- The card cites `we:.github/workflows/publish-contracts.yml:24-27` for the dry-run input 'that defaults to a dry run,' but the line establishing `default: true` is actually line 29, one line past the cited range.
- The card frames 'reassess the auto-lock-on-merge race... or make release-please tolerant' as open future work, but we:.github/workflows/release-please.yml's own header comment (the 'Publish resilience' note, referencing #907 and run 28606668569) documents that release-please's publish job already gates on `always() && releases_created == 'true'` specifically to stop the lock-race cosmetic failure from skipping publish — the tolerance half of that to-do is already landed; only the cosmetic red-job-status half remains open.

The card's core facts hold up against the live repo (npm still 404s, the workflow lines it cites are accurate, #2138/#2152/#2203/#2217/#2216 are resolved, #2156 stays open and cross-references this card, and GH Actions credentials are genuinely unavailable to this session, supporting the humanGate claim) — but the card's "auto-lock-on-merge race" section overlooks that we:.github/workflows/release-please.yml's own header comment already documents a landed fix for the functional half of that race (the `always()` gate), a fact directly adjacent to what the card investigates and missed across three review passes.

_Recorded through the declared `review-prep` operation._
