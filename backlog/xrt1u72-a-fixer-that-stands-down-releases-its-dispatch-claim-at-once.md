---
kind: story
size: 2
status: open
scope: ["we:scripts/conveyor/stand-down.mjs", "we:scripts/conveyor/fix-dispatch-claim.mjs", "we:scripts/conveyor/fix-procedure.mjs", "we:scripts/conveyor/__tests__/fix-procedure.test.mjs", "we:scripts/conveyor/__tests__/stand-down.test.mjs", "we:scripts/conveyor/__tests__/fix-dispatch-claim.test.mjs", "we:skills-src/conveyor/fix-agent-brief.md"]
dateOpened: "2026-10-01"
preparedDate: "2026-10-03"
preparedAgainstSha: "e1f0523e0881357fc863f3e88da72e0164eb7091"
tags: []
---

# A fixer that stands down releases its dispatch claim at once, so the next repair or split can start

Live case 2026-10-01 PR #3311: fix-3311 stood down (needs-judgment) at ~19:55 UTC, but the daemon fix-dispatch claim it ran under stayed live until its 10-minute TTL ran out, so the operator-approved split job could not take the fix lock (fixBegin refuses dispatched-fixer via liveForeignDispatch in we:scripts/conveyor/fix-procedure.mjs). The refusal reason was also invisible: the CLI prints it only as JSON on stdout. Fix: stand-down (we:scripts/conveyor/stand-down.mjs) releases the session fix-dispatch claim (we:scripts/conveyor/fix-dispatch-claim.mjs) when it posts its marker; fix-begin prints the refusal reason and holder on stderr. Test: stand-down then fix-begin by another who succeeds immediately; replay the #3311 timeline.

## Progress

Premise checked against main `e1f0523e0`. Still true; not delivered (`git log -S` finds no dispatch-claim release in `we:scripts/conveyor/stand-down.mjs`).

- The block: `we:scripts/conveyor/fix-procedure.mjs:169 (liveForeignDispatch)` treats any un-expired `fix` / `ci-heal` dispatch claim whose session name is not `who` as foreign. `we:scripts/conveyor/fix-procedure.mjs:193-196 (acquireFixClaim)` then returns `{ ok:false, reason:'dispatched-fixer' }`.
- The TTL: `we:scripts/conveyor/fix-claim-store.mjs:20 (DEFAULT_FIX_DISPATCH_CLAIM_TTL_MINUTES = 10)`.
- Nobody releases on stand-down. The dispatcher keeps the claim on purpose after a spawn (`we:scripts/conveyor/reconcile-fix-dispatch.mjs:957-958 (dispatchFix)`). The only early release is the daemon sweep, and only once the session reads terminal in the agent listing (`we:scripts/conveyor/fix-dispatch-claim.mjs:248-261 (refreshLiveFixDispatchClaims)`). While the fixer is still alive after its stand-down, that sweep even re-heartbeats the claim.
- The silent refusal: `we:scripts/conveyor/fix-procedure.mjs:684-685` writes the refusal with `out(r, 3)` — JSON on stdout only.
- Drift 1 — the claim owner. The dispatch claim's owner is the DAEMON's `host:pid` (`we:scripts/conveyor/fix-dispatch-claim.mjs:99 (fixDispatchClaimOwner)`), not the fixer. So the fixer cannot release it with `releaseFixDispatchClaim` as-is. The only link from claim to fixer is the session name (`we:scripts/conveyor/fix-claim-store.mjs:65 (fixDispatchSessionName)`, e.g. `fix-3311`).
- Drift 2 — the stand-down CLI never learns who is calling. The brief calls it with `--repo` and `--reason` only (`we:skills-src/conveyor/fix-agent-brief.md:165`, `:283`, `:400`, `:438`). Old scope: 3 source files + 1 test. Corrected scope adds the brief (pass `--who={{SESSION_SLUG}}`) and `we:scripts/conveyor/__tests__/stand-down.test.mjs` (pin that the brief passes it).

## Design

Two small changes. No new state store; the claim store is reused.

1. **New helper `releaseSessionFixDispatchClaims({ repo, pr, who, lockRoot })`** in `we:scripts/conveyor/fix-dispatch-claim.mjs`.
   - For each kind in `['fix', 'ci-heal']`: read the claim (`readFixDispatchClaim`). Skip if absent.
   - Compute `fixDispatchSessionName({ repo, pr, kind })` (catch and skip on throw).
   - Release only when that name equals `who`. Use `releaseFixDispatchClaim({ repo, pr, kind, owner: entry.owner, lockRoot })`, so the existing owner re-check still guards a claim swapped in between.
   - Return `{ released: [{ kind, owner }], skipped: [{ kind, reason }] }`.
   - It uses only names this file already imports (from `we:scripts/conveyor/fix-claim-store.mjs` and `we:scripts/readiness/file-locks.mjs`).
2. **The `we:scripts/conveyor/stand-down.mjs` CLI** gets an optional `--who=<session slug>` flag.
   - After the comment posts OK (pause or terminal), it loads the helper with a dynamic `import()` of `we:scripts/conveyor/fix-dispatch-claim.mjs` (so the module's pure exports stay free of the dispatch graph) and calls it.
   - `repo` = `repoKeyForSlug(flags.repo)` from `we:scripts/lib/constellation-repos.mjs`.
   - It adds `dispatchClaimReleased: [...]` to the JSON line on stdout.
   - Both the terminal stand-down and the concurrent-author pause release. In both, the fixer is exiting, and the PR comment (not the claim) is what keeps the planner off the PR.
3. **Brief**: the four fixer stand-down calls (`we:skills-src/conveyor/fix-agent-brief.md:165`, `:283`, `:400`, `:438`) add `--who={{SESSION_SLUG}}`. The manual `/finish` call at `:551` stays as it is: a human holds no dispatch claim.
4. **`fix-begin` refusal on stderr**. New pure export `fixBeginRefusalMessage(result)` in `we:scripts/conveyor/fix-procedure.mjs`. It returns `✗ fix-begin refused on PR #<pr>: <reason> — held by <heldBy>`. For `dispatched-fixer` it adds: `(daemon <kind> dispatch claim; it frees on that session's stand-down/exit or its 10-minute TTL)`. `acquireFixClaim` adds `dispatchKind: foreign.kind` to the `dispatched-fixer` refusal, and `fixBegin` passes it through. The CLI branch (`:684-685`) writes the message to fd 2 before `out(r, 3)`. Stdout JSON is unchanged.

Must (this loosens a refusal):
- **Must refuse on error.** No release when the comment post failed (the CLI already exits at `fail(...)` first). No release without `--who`, or without a `--repo` that maps to a constellation repo key: print a one-line `⚠` on stderr and leave the claim alone. Never guess the repo from cwd.
- **Must stay narrow.** Release only the claim whose minted session name equals `--who`. Never a claim of the other kind, another PR, another repo, or one whose name does not match. The `fixing` claim (`kind:'fixing'`) is never touched here: `fix-end` owns it.

## MVP

- `releaseSessionFixDispatchClaims` and its export.
- Stand-down CLI: `--who` flag, release call, usage line, JSON field.
- `fixBeginRefusalMessage`, `dispatchKind`, and the stderr line in the `fix-begin` CLI branch.
- Brief: `--who={{SESSION_SLUG}}` on the four fixer calls.

## Test plan

`we:scripts/conveyor/__tests__/fix-dispatch-claim.test.mjs` gets one unit case for the new helper beside the existing claim tests: `releaseSessionFixDispatchClaims releases only the claim minted for that who` (a matching fix claim is removed; a ci-heal claim and a different PR's claim stay).

`we:scripts/conveyor/__tests__/fix-procedure.test.mjs` (vitest), new `describe('a stood-down fixer frees its dispatch claim at once (#3311)')`:
- `replays #3311: daemon claim fix-3311 blocks split-3311; after the stand-down release split-3311 takes the fix claim at once` — `acquireFixDispatchClaim({repo:'we', pr:3311, kind:'fix', owner:'daemon:1', nowMs:T0})`; `acquireFixClaim({who:'split-3311', nowMs:T0+MIN})` → `dispatched-fixer`, `dispatchKind:'fix'`; `releaseSessionFixDispatchClaims({repo:'we', pr:3311, who:'fix-3311'})` → `released:[{kind:'fix', owner:'daemon:1'}]`; `acquireFixClaim({who:'split-3311', nowMs:T0+2*MIN})` → `ok:true` (well inside the 10-minute TTL).
- `releases nothing for a who that does not match the minted session name` — `who:'fix-9999'`, `who:'split-3311'`, and `who:'fix-3311'` against a `ci-heal` claim: each leaves the claim in place.
- `releases only its own kind` — both a `fix` and a `ci-heal` claim on PR 3311; `who:'ci-heal-3311'` frees only `ci-heal`.
- `scopes by repo` — a `frontierui` claim for PR 3311 is untouched by `{repo:'we', who:'fix-3311'}`.
- `fixBeginRefusalMessage names the reason and the holder` — for `{ok:false, pr:3311, reason:'dispatched-fixer', heldBy:'fix-3311', dispatchKind:'fix'}` the text matches `/dispatched-fixer/`, `/fix-3311/`, `/TTL/`; for `reason:'held'` it names `heldBy`.

`we:scripts/conveyor/__tests__/stand-down.test.mjs`, in the brief describe:
- `every fixer stand-down call in the brief passes --who={{SESSION_SLUG}}` — the four `node "{{WE_ROOT}}/…"` stand-down command blocks (wrapped lines joined) carry `--who={{SESSION_SLUG}}`. The `/finish` call (the one after `If you stop instead`) is exempt.

## Proof plan

Live case: PR #3311 (already past). Proof on the recorded shape, then on the next live stand-down.

1. **Before/after replay, scratch claim root** (no live claim state touched). Set `WE_COORDINATION_ROOT` to a fresh temp dir. Pick any OPEN WE PR `<P>`. Seed a `fix` dispatch claim for `we` PR `<P>` owned by `daemon:1` with a one-line `node -e` call to `acquireFixDispatchClaim`. Run the `fix-begin <P> --repo=we --who=split-<P>` CLI with stderr captured to a file. It refuses before any write (only a read-only `gh pr view`).
   - Before: stderr is empty; stdout holds `dispatched-fixer`.
   - After: stderr holds `✗ fix-begin refused on PR #<P>: dispatched-fixer — held by fix-<P> …`.
   - Then call `releaseSessionFixDispatchClaims({repo:'we', pr:<P>, who:'fix-<P>'})`; show the `fix-dispatch-claims` dir under the temp root is empty, and that `acquireFixClaim({who:'split-<P>'})` now returns `ok:true`. Call `acquireFixClaim` directly, not the CLI, so nothing is labeled or commented on a real PR.
2. **Next live stand-down** after merge: the stand-down JSON line in the fixer transcript shows `dispatchClaimReleased` non-empty, and the claim entry for that PR is gone from the live `fix-dispatch-claims/` dir within seconds of the `🛑` comment, not 10 minutes later.

## Done when

1. **Executable** — `npx vitest run conveyor/__tests__/fix-procedure.test conveyor/__tests__/stand-down.test` passes (vitest name filter; it runs exactly these two files). The new cases in `we:scripts/conveyor/__tests__/fix-procedure.test.mjs` and `we:scripts/conveyor/__tests__/stand-down.test.mjs` fail before this change (helper and `fixBeginRefusalMessage` missing; brief lacks `--who`) and pass after.
2. The stand-down CLI with `--repo=<slug> --who=fix-<pr>` releases the matching dispatch claim right after the comment posts. Without `--who`, or with an unknown repo, it releases nothing and warns on stderr.
3. `fix-begin` refusals print one `✗` line with reason and holder on stderr; the stdout JSON is unchanged.
4. The four fixer stand-down calls in `we:skills-src/conveyor/fix-agent-brief.md` pass `--who={{SESSION_SLUG}}`.
5. Proof plan step 1 shows before/after evidence.

## Follow-ups

- `fix-end` could also release the session's dispatch claim on the normal success path. Not done here: this card is about stand-down only, and the success path has the re-arm ordering to think through.
- The daemon sweep could release a claim when the session's completion record says `done` (self-reported), not only when the listing reads terminal.
