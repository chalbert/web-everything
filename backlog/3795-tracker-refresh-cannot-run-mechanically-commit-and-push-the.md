---
bornAs: x95nncl
kind: story
size: 3
parent: "3383"
status: open
relatedTo: ["3227", "3383", "3772"]
scope: ["we:scripts/operations/tracker-refresh.mjs", "we:scripts/operations/tracker-refresh-io.mjs", "we:scripts/guard-prototype-tracker.mjs"]
dateOpened: "2026-09-21"
tags: []
---

# tracker-refresh cannot run mechanically: commit and push the priority sync and trigger the publish

`tracker-refresh --apply` cannot run mechanically end to end: it edits the tracker card in the checkout it runs in but never commits or pushes, and the Artifact publish needs a Claude session. Add the missing committer step and the publish trigger so the Prototype Tracker page stays current with no one remembering to do it. Design-first and deliberately not cleared for the conveyor.

## FOUND (2026-09-21)

- **The operation stops at the working tree.** The header of we:scripts/operations/tracker-refresh.mjs (prototype branch only) lists its apply step: `git fetch` (best effort), `priority-sync --apply` ("leaves the tracker card edited and uncommitted"), `check-priority --strict`, render the compact page, hash it, and write a brief for the publish worker. A search of we:scripts/operations/tracker-refresh.mjs and we:scripts/operations/tracker-refresh-io.mjs finds no `git commit` and no `git push`, so each run leaves an uncommitted card edit in whatever checkout it ran in.
- **Only a session can publish.** The header names the `Artifact` tool call as the one step it cannot do; it writes `publish: needed` or `publish: current` and, when due, a fixed brief that the orchestrator hands to a small worker through `dispatch-task`. Without a session watching, nothing publishes.
- **Pushes to the prototype branch have rules.** The repo's pre-push hook (`we:scripts/guard-prototype-tracker.mjs`) blocks a push to a declared prototype branch whose tracker entry is stale and whose own diff does not touch the tracker file, so a tracker-only push is the allowed shape.
- **Nearby.** #3227 (open) declares commit and push as operations; the committer step should be one of those, not a raw `git`.

## DESIGN TO SETTLE

1. **Who commits.** A `--commit --push` pair on the operation, or a separate committer step the orchestrator runs after it. Message: `tracker: priority sync`.
2. **Where it pushes.** Only the prototype branch, fast-forward only, through the lock in we:scripts/readiness/drain-lock.mjs (`withPocLandLock`), never to main.
3. **A dirty checkout.** What happens if the run finds unrelated uncommitted changes: refuse, or commit only the tracker card by tight pathspec.
4. **The publish trigger.** After each landing on the prototype branch, or on a timer with the existing minimum interval, and which non-session actor can do it (or whether this stays a session step).
5. **Idempotence.** A run with nothing changed must commit nothing.

## Done when

1. **Executable** — `npx vitest run we:scripts/operations/__tests__/tracker-refresh.test.mjs` passes, with new cases that fail today: after `tracker-refresh --apply` changes the tracker card, the checkout holds one new commit "tracker: priority sync" touching only that card and the branch tip is pushed; a run that changes nothing commits nothing; a checkout with unrelated uncommitted changes is refused or committed by tight pathspec (per the design); and a push that would not be fast-forward is refused.
2. **Observable** — after one real landing on the prototype branch, the tracker page publishes without a person running any command (or the design records why a session step must remain).
