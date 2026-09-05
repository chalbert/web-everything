---
kind: task
status: active
scope: ["we:skills-src/conveyor/runner.mjs"]
relatedTo: ["3383"]
scaffoldedBy: "investigate-15-stuck-prs"
dateScaffolded: "2026-09-05"
dateOpened: "2026-09-05"
tags: [conveyor, review, dispatch]
---

# graduate the review-reconcile mechanization (reconcile-pass -> review-dispatch/review-round-tag) from lane/mechanical-dispatcher to main -- it never landed, so no live review is ever auto-dispatched

Commit 4093701178a09e1b1c4614f91e79fb0cb3a1803d (runner: wire reconcile-pass into the mechanical passes) plus its later evolution (we:scripts/conveyor/review-round-tag.mjs + we:scripts/conveyor/review-status-tag.mjs wiring) exist ONLY on origin/lane/mechanical-dispatcher, a long-lived side branch -- NOT an ancestor of main (confirmed: git merge-base --is-ancestor 4093701178a09e1b1c4614f91e79fb0cb3a1803d HEAD on main returns false). we:skills-src/conveyor/runner.mjs on main runs infra-blocked/lease-reaper/session-reaper/reconcile-fix-dispatch/branch-drift/parked-pr-conflict-watch every tick but NEVER shells we:scripts/conveyor/reconcile-pass.mjs or we:scripts/operations/review-dispatch.mjs -- so an independent review is NEVER automatically dispatched for a review:pending PR by any runner started against main (the documented, correct checkout). The only reason review dispatch has ever appeared to work at all is that the one long-lived runner process discovered live 2026-09-05 (pid 73312, lock record we:home/.claude/conveyor-runner-locks/21615d01a39a19b2/lock.json) happens to be rooted in a scratch checkout (we:home/workspace/wev-scratch-dispatcher-4) whose HEAD is a merge INTO lane/mechanical-dispatcher, not main -- a total accident of which checkout someone happened to start the runner from. we:scripts/conveyor/reconcile-pass.mjs, we:scripts/operations/review-dispatch.mjs, we:scripts/conveyor/review-round-tag.mjs and we:scripts/conveyor/review-status-tag.mjs all ALREADY EXIST on main (already tested, already landed standalone) -- only the WIRING that calls them each tick from we:skills-src/conveyor/runner.mjs is missing. Port that wiring block (we:scripts/conveyor/reconcile-pass.mjs --json -> filter kind:review -> we:scripts/operations/review-dispatch.mjs --pr=N, plus we:scripts/conveyor/review-round-tag.mjs and we:scripts/conveyor/review-status-tag.mjs informative tags) into main's makeCliMechanicalPasses in we:skills-src/conveyor/runner.mjs, alongside a fix for a second, independent bug found live in the SAME block: the informative review-status-tag refresh sweep (we:skills-src/conveyor/runner.mjs's statusCandidates filter) excludes EVERY refusal of kind owed-elsewhere, but that kind covers real conveyor PRs stuck needs-human/ci-red/conflicted (not just genuinely-unrelated hand-opened PRs, contrary to the exclusion's own comment) -- confirmed live on PR #1920 (review-status:reviewing label persists with ZERO matching claude agents --json session, because its needs-human refusal is always filtered out of the refresh sweep before we:scripts/conveyor/review-status-tag.mjs ever runs against it). Fix: only exclude nothing-owed from statusCandidates, not owed-elsewhere. OUT OF SCOPE, deliberately: the SEPARATE, larger we:scripts/conveyor/verify-dispatch.mjs mechanization (#3105/#3404) is ALSO only on lane/mechanical-dispatcher and ALSO unwired on main, but it changes the mechanicalPasses/runLoop heartbeat plumbing more invasively -- leave it for its own follow-on graduation item, do not fold it into this one.

## Done when

1. **Executable** — a new unit test in `we:skills-src/conveyor/__tests__/runner.test.mjs` (or sibling) proving
   `makeCliMechanicalPasses`'s status-candidate selection includes an `owed-elsewhere` refusal (e.g. phase
   `needs-human`) and excludes only `nothing-owed` — fails before this item's fix, passes after.
2. `we:skills-src/conveyor/runner.mjs`'s `makeCliMechanicalPasses` shells `we:scripts/conveyor/reconcile-pass.mjs --json` each tick and, for every `kind:'review'` entry in its `dispatch` array, shells
   `we:scripts/operations/review-dispatch.mjs --pr=<N>`, mirroring the wiring in commit
   `4093701178a09e1b1c4614f91e79fb0cb3a1803d` (best-effort, non-fatal on failure, same as every sibling pass).
3. The same block also shells `we:scripts/conveyor/review-round-tag.mjs` for each dispatched review and
   `we:scripts/conveyor/review-status-tag.mjs` for every PR with an opinion — EXCLUDING only `nothing-owed`
   refusals, not `owed-elsewhere` ones (the fix for the PR #1920 staleness case).
4. No regression in the existing `we:skills-src/conveyor/__tests__/runner.test.mjs` suite.
5. Explicitly OUT OF SCOPE (do not attempt in this item): graduating `we:scripts/conveyor/verify-dispatch.mjs`'s
   mechanization — file a separate follow-on for it if it isn't already tracked.
