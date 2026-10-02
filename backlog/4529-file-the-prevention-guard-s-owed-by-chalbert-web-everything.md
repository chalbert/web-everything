---
bornAs: xkvqtrc
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/merge-ai-prs.mjs", "we:scripts/__tests__/merge-ai-prs.test.mjs"]
dateOpened: "2026-09-29"
preparedDate: "2026-10-02"
preparedAgainstSha: "c9cddb03988f9433ee9beb96c21f91011dfc6a6e"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2974's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/merge-ai-prs.mjs:3851` — Add a before/after cost test that runs with a warm `WE_PR_SNAPSHOT_DIR` snapshot (snapshot enabled). Alternatively, when the snapshot is servable for a repo, prefer it over the live rows for the context and widen the candidate listing's `--json` only when it is not. A gh-call-count fixture running under both snapshot modes would catch this class.
2. `we:scripts/merge-ai-prs.mjs:4137` — Add a deterministic CLI regression test with more than OPEN_PR_LIST_LIMIT off-base PRs preceding an eligible requested-base PR, and require that candidate to remain discoverable; preserve candidate completeness through pagination or a filtered fallback when the raw listing is truncated.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2974@231c3429288e74c55e0a4b1bfd364a20f379218d

## Done when

1. **Executable** — `npx vitest run we:scripts/__tests__/merge-ai-prs-listing-dedupe.test.mjs` — the past-cap `--base` case fails before this item lands and passes after; the warm-snapshot case is a regression pin guarding future changes.

## Progress

- **Premise check (2026-10-02, prepare-item-4529):** goal NOT delivered. `git log --grep=4529` shows only the JIT-numbering commit `f8699a734`; no test exists for either guard. Citations drifted (card says `:3851` / `:4137`): the code is now `collectContext.listOpenPrs` (`we:scripts/merge-ai-prs.mjs:3898-3901`, snapshot via `readSharedOpenPrs` then live `gh pr list`) and `listOne` (`:4124-4155`: `run(sized)` → escalate to `OPEN_PR_LIST_LIMIT` (500, `we:scripts/lib/no-search-backed-pr-list.mjs:28`) → `filterOpenPrsByLabel` → client-side `filterOpenPrsByBase`). Scope (`we:scripts/merge-ai-prs.mjs` + its test) is accurate; the test lands in the existing `we:scripts/__tests__/merge-ai-prs-listing-dedupe.test.mjs` harness (fake `gh` on PATH, `GH_CALL_LOG`, `GH_FIXTURE_PRS_FILE`) — no new scope file needed beyond the declared test path family.

## Design

Two independent guards, both in the existing #4108 listing-dedupe harness (`we:scripts/__tests__/merge-ai-prs-listing-dedupe.test.mjs:122-250`).

1. **Warm-snapshot cost PIN (not a RED test).** A repo in `REPOS` is served from the pass's live rows (`liveByRepo.has(repo)` in `listOpenPrs`, ~`:3898`) and never reaches `readSharedOpenPrs`, so a warm snapshot changes nothing for it today — only the snapshot's `count` affects `candidateListLimit` (`:3672`). The guard therefore PINS the call count under both modes so a future change cannot add a live call. Harness recipe: the existing `runCli` uses `--this-repo` (`REPOS=[null]`, snapshot never consulted), so the pin uses `--repos=owner/name`, sets `WE_PR_SNAPSHOT_DIR` to a temp dir seeded with a per-repo snapshot file = `{v:1, repo, fetchedAtMs: Date.now(), fields ⊇ CONTEXT_LIST_FIELDS, count, prs}` (format per `we:scripts/lib/pr-snapshot-store.mjs`), with a raised the snapshot TTL env override and no `.dirty` marker so the fake `gh` is not hit by a refresh. Asserts exactly one live `gh pr list` per swept repo and `--json` equal to `SWEEP_LIST_FIELDS` in cold and warm modes, and equal `considered`/`toMerge`.
2. **Pagination-completeness test + fix.** `listOne` filters by `--base` client-side AFTER the raw page is cut at `OPEN_PR_LIST_LIMIT`. With >500 open PRs where the first 500 are off-base, an eligible requested-base PR at position 501+ is dropped; only a stderr `DEGRADED` warning is emitted (`:4153`). Test: a fixture of `OPEN_PR_LIST_LIMIT + 1` PRs — 500 `develop`-based first, one labeled `main`-based last — run with `--base=main`; assert `considered === 1`. This is RED today (`considered` is 0). Fix (minimal): when the raw listing is truncated AND `base` is set, issue one supplementary `gh pr list --base <base> --limit OPEN_PR_LIST_LIMIT` with the same `--json` as `run()` (so `labels`/`statusCheckRollup` are present; `--base` is NOT search-backed, unlike `--label`, so safe), de-duplicate by PR number against the first page, then run the merged rows through `filterOpenPrsByLabel` client-side (the supplementary call carries no `--label`). Compute the DEGRADED/`truncated` flag AFTER the merge, so a supplementary page that itself hits the cap is still surfaced. The test's `FAKE_GH` must be taught to honour `--base` (filter before slicing to `--limit`), otherwise it ignores `--base` and the fallback cannot go green; that change is in `we:scripts/__tests__/merge-ai-prs-listing-dedupe.test.mjs`. The base-blind `rows` handed to the RECONCILE context (`buildLiveListingsByRepo`) stay untouched, preserving the #4108 converge-round-1 invariant.

## MVP

Musts only:
- Test 1 (warm vs cold snapshot call count + field set).
- Test 2 (RED regression: >500 off-base PRs then an eligible requested-base PR is still discovered) plus the supplementary base-filtered fallback that turns it green.
- The existing `DEGRADED` warning stays.

Out of scope (→ Follow-ups): preferring the snapshot over live rows for the context; true cursor pagination of the raw listing; the same fallback for `--label` truncation.

## Test plan

- `warm snapshot pin: context is not re-listed live` (a PIN, passes today by design) — seeds `WE_PR_SNAPSHOT_DIR`, runs `--label=ready-to-merge`, asserts ≤1 live `gh pr list` and that its `--json` equals `SWEEP_LIST_FIELDS`. Fails if a future change issues a second live call when the snapshot is enabled (the unguarded class today).
- `cold vs warm parity` (pin) — same fixture under both modes yields identical `considered`/`toMerge`, so the snapshot mode cannot change the candidate set.
- `truncated listing + --base keeps a past-cap requested-base candidate` — 500 off-base PRs first, 1 eligible `main` PR last, `--base=main`; asserts `considered === 1`. RED before the fix (candidate dropped at the cap).
- `truncated listing without --base` — behavior unchanged (still exactly 2 `gh pr list` calls, DEGRADED warning), so the fallback is inert when no base is requested.
- `fallback never narrows the context rows` — the supplementary call carries `--base`, the primary call still does not (existing assertion at `:204` extended to the 2-call truncated case).

## Proof plan

Run the new tests against `origin/main`'s `we:scripts/merge-ai-prs.mjs` (RED on the pagination case) and against the lane's fix (GREEN), capturing both outputs. Live probe: `we:scripts/merge-ai-prs.mjs --this-repo --label=ready-to-merge --base=main --dry-run --json` on the real repo with `GH_CALL_LOG`-style counting via a shim, showing the call count and unchanged `considered` on a normal (<500 PR) repo.

## Follow-ups

- Prefer the warm snapshot over live rows for the context when servable; widen `--json` live only when it is not (card point 1's alternative).
- Real cursor pagination of the raw open-PR listing, retiring the 500 cap.
- Equivalent past-cap guard for `--label` truncation (cannot use server-side `--label`: search-backed, #no-label-search).
