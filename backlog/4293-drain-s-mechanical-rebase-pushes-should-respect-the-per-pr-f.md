---
bornAs: xqy8cxu
kind: task
status: resolved
scope: ["we:scripts/lib/rebase-drop-content.mjs", "we:scripts/lib/rebase-drop-manifest.mjs", "we:scripts/lib/nnn-collision-heal.mjs", "we:scripts/operations/review-prep-io.mjs", "we:scripts/conveyor/fix-procedure.mjs", "we:scripts/lib/__tests__/rebase-drop-content.test.mjs", "we:scripts/lib/__tests__/rebase-drop-manifest.test.mjs", "we:scripts/lib/__tests__/nnn-collision-heal.test.mjs", "we:scripts/operations/__tests__/review-prep-io.test.mjs"]
dateOpened: "2026-09-27"
dateStarted: "2026-09-29"
dateResolved: "2026-09-29"
tags: []
---

# Drain's mechanical rebase pushes should respect the per-PR fix claim

PR #2821 (open) adds a per-PR fix claim (we:scripts/conveyor/fix-procedure.mjs, we:scripts/conveyor/fix-claim-store.mjs): while held, a push by anyone but the holder is refused in we:scripts/pr-land.mjs, the push helper, and we:scripts/guard-bash.mjs. Per that PR's own 'Not covered' note, the drain's own mechanical rebase/update pushes — we:scripts/merge-ai-prs.mjs's rebase-drop and nnn-collision-heal paths (we:scripts/lib/rebase-drop-content.mjs, we:scripts/lib/rebase-drop-manifest.mjs, we:scripts/lib/nnn-collision-heal.mjs) plus we:scripts/operations/review-prep-io.mjs — do not check the claim at all. Safe today only because the drain acts solely on ready-to-merge PRs and a claimed PR is held as a draft (fix-begin flips it via gh pr ready --undo); make the drain check and refuse a push on a held claim too, so the invariant holds by construction rather than by that draft-only coincidence. blockedBy: no numbered backlog item exists yet for PR #2821 itself (it was never filed as a card) — noting it here instead of a blockedBy reference; this item cannot land its scope check against we:scripts/conveyor/fix-claim-store.mjs until #2821 merges, since that module does not exist on main yet.

## Conveyor delivery-agent prep (#4293)

- **Premise check (against fresh `main`)** — PR #2821 merged (`109fd1b0d`, ancestor of this lane's `main`), so
  we:scripts/conveyor/fix-claim-store.mjs / we:scripts/conveyor/fix-procedure.mjs now exist and the item's own
  `blockedBy` note is resolved. Grepped every file this item names for `fix-claim`/`fixClaim`/`fix-procedure`/
  `pushRefusal` — zero hits — confirming the drain's mechanical rebase/heal/review-prep pushes still do not
  check the claim. Not already done, not superseded. Proceeding to build.
- **Scope check** — the originally-declared `scope:` named the claim-side files
  (we:scripts/conveyor/fix-procedure.mjs / we:scripts/conveyor/fix-claim-store.mjs) and the orchestrator
  (we:scripts/merge-ai-prs.mjs) as touched, but the actual fix belongs INSIDE the three shared plumbing libs
  that own every `git push` call (we:scripts/lib/rebase-drop-content.mjs, we:scripts/lib/rebase-drop-manifest.mjs,
  we:scripts/lib/nnn-collision-heal.mjs) plus we:scripts/operations/review-prep-io.mjs's own push-only path —
  checking there (not at each caller) is what makes the invariant hold "by construction": `rebaseDropManifest`
  alone has a second caller (we:scripts/lane-resume.mjs) that would otherwise stay unprotected.
  we:scripts/conveyor/fix-procedure.mjs gains one small new export (`refuseHeldPush`, wrapping `pushRefusal`/
  `callerIdentity`/`repoKeyFromRemoteUrl` for a caller with its own injected `run`) — its existing exports are
  untouched. we:scripts/conveyor/fix-claim-store.mjs stays a read-only import. we:scripts/merge-ai-prs.mjs
  needs no change since it only calls the now-guarded libs. Corrected `scope:` above to the 5 real source
  touches + their test files.

## Done when

1. **Executable** — `node we:scripts/readiness/heavy-admission.mjs run -- npx vitest run we:scripts/lib/__tests__/rebase-drop-content.test.mjs we:scripts/lib/__tests__/rebase-drop-manifest.test.mjs we:scripts/lib/__tests__/nnn-collision-heal.test.mjs we:scripts/operations/__tests__/review-prep-io.test.mjs` passes with this item's diff intact. Revert ONLY the 4 source files' push-refusal hunks (each `refuseHeldPush`/`pushRefusal` call site added ahead of a `git push`), keeping this item's new test cases in place, and the SAME command fails — the new tests prove the source change, not just their own presence.
