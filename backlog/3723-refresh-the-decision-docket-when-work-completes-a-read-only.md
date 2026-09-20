---
bornAs: xc1u3pi
kind: story
size: 3
parent: "3718"
status: open
relatedTo: ["3562", "3277", "3720", "3719"]
scope: ["we:scripts/operations/docket-refresh.mjs", "we:scripts/operations/docket-refresh-io.mjs", "we:scripts/gen-decision-docket.mjs", "we:scripts/operations/__tests__/docket-refresh.test.mjs"]
dateOpened: "2026-09-19"
tags: []
---

# Refresh the Decision Docket when work completes: a read-only, capacity-free land-advance consumer that publishes only when the data changed

The Decision Docket's RECORD is already mechanical: `node we:scripts/gen-decision-docket.mjs all --ref=origin/main` picks a new decision up from `main` by itself. What is not mechanical is the REFRESH (nothing triggers it, there is no standing pass) and the PUBLISH (it still needs a session to run the `Artifact` tool by hand). This is "state changes only when something lands", the exact pattern the landing trigger (#3720) exists for, and it is the cheapest possible consumer of that trigger.

## Worked example (measured by the driving session on 2026-09-19; reported here, not re-run)

#3675 was prepared that day, but its `preparedDate` lived on PR #2339. Until #2339 merged (23:22Z) the docket rendered from `origin/main` showed #3675 with `preparedDate: null` and no forks. After fetching `main` and re-running the generator it showed `preparedDate: 2026-09-19` and 4 forks. The data pipeline was correct all along; the trigger and the publish were the only missing parts.

## Shape

A `docket-refresh` declared operation, called by the completion trigger like any other consumer (#3720):

1. Fetch `origin/main`, then run the generator's data step against it (`--ref=origin/main`; it already accepts `--out` and `--data`).
2. **Write outputs outside every checkout, and never commit them.** The generator's default paths are `we:reports/decision-docket-data.json` (git-tracked, with a history of "regenerate data" commits) and `we:reports/decision-docket.html` (untracked). Running it in place leaves both dirty. So the operation passes `--out` paths under the operations state root (resolved the way `we:scripts/operations/run-store.mjs` resolves it) and leaves the tree clean.
   - *Why not commit on every landing:* it makes a hot single file that every lane conflicts on, opens a PR per landing, and each such commit is itself a landing that re-fires the trigger, a self-loop. The tracked JSON stays a deliberate snapshot when a person wants an audit point (or is dropped from tracking; that is a separate small call, not this slice).
3. **Run it from a non-primary checkout.** The driving session reports a primary-cwd hook blocks generator scripts that write to the filesystem (#2749, #2788). This was not located by a text search of `we:scripts/guard-lane.mjs` and `we:scripts/guard-bash.mjs`, so confirm which guard fires; the rule for the operation is to run from the runner's checkout or a lane, never the primary.
4. **Publish only when the data changed.** Keep a content hash of the generated data (stable JSON) beside the outputs; an unchanged hash is a complete no-op.
5. **The publish half genuinely cannot be a Node call.** Publishing to the Artifact is done by the `Artifact` tool, which only a model session has (`we:skills-src/decision-docket/SKILL.md` says so). So a changed hash produces a "publish owed" hand-off: a record now, and a dispatched one-shot session through #3277's operation once that exists (#3277 declares the publish operation; reuse it, do not invent a second path).

## Capacity: the two halves are different

The refresh (steps 1 to 4) is read-only and needs no lane and no session, so it **does not count against `land-advance`'s worker budget** and can run on every trigger. The publish hand-off spends a real session, so it IS capacity-gated and only happens when the hash changed.

## Relationship to #3562 and #3277 (neither is edited by this slice)

- #3562 is the standing pass: rank the 5 highest-leverage open decisions, dispatch `prepare-decision` for the un-prepared ones, republish every tick (blocked by #3277). This slice is only #3562's "refresh and publish on change" half, fired by a completion event instead of a tick. Ranking and prepare dispatch stay #3562's.
- #3277 declares the publish operation. This slice consumes it when it exists and does not duplicate it.
- As the cheapest read-only consumer it is a good first proof that the trigger works at all, ahead of any consumer that spends a worker.

## Done when

1. **Executable** — `npx vitest run we:scripts/operations/__tests__/docket-refresh.test.mjs` passes; its cases fail before: an unchanged backlog state yields a no-op with no publish hand-off; a changed record (a `preparedDate` appearing) yields exactly one hand-off; the operation writes nothing inside any checkout (a temp-repo test asserts a clean `git status`); it refuses to run from the primary checkout.
2. **Probed live** — replaying the #3675 case (a `preparedDate` landing on `main`) changes the generated data for #3675 from no forks to its forks with no session involved.
