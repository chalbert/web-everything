---
bornAs: xvnwljh
kind: story
size: 2
status: open
scope: ["we:scripts/lib/daemon-rebuild.mjs", "we:scripts/lib/__tests__/daemon-rebuild.test.mjs"]
dateOpened: "2026-09-29"
preparedDate: "2026-09-30"
preparedAgainstSha: "940b7dd328d118b0c398a2f1fcef96608629ce01"
tags: []
---

# Daemon rebuild prunes untracked backlog sidecars already landed on main

Follow-up to the orphan prevention-card sweep (PR #2901/#2904, 2026-09-29): daemon clones such as wev-review-daemon retain provisional, untracked cards under we:backlog/ after their numbered counterparts land. Add narrowly bounded cleanup in we:scripts/lib/daemon-rebuild.mjs: after a successful main fetch, remove only untracked provisional card files whose hash has a matching `bornAs` in a numbered card on the fetched main commit. Preserve every other path and existing rebuild safety checks.

## Progress

- **Original premise/scope:** the dirty check ignores untracked we:backlog/x*.md sidecars, no sanctioned cleanup exists, and the next rebuild should remove 22 already-landed copies. Scope named only we:scripts/lib/daemon-rebuild.mjs, with no test file.
- **Verified current premise:** we:scripts/lib/daemon-rebuild.mjs:395 collects untracked, non-ignored paths; `findUnsafeLocalState` at line 426 checks tracked dirt separately. `prepareRebuild` reports `untracked-kept` at line 1365, fetches at line 1382, and returns `up-to-date` at line 1437. There is no `bornAs` lookup or backlog-sidecar deletion in the current module. Existing preservation/collision tests live in we:scripts/lib/__tests__/daemon-rebuild.test.mjs:314 and the no-op reporting test at line 488. The goal remains undelivered in this checkout.
- **Corrected scope:** retain the existing source home and add its matching test, we:scripts/lib/__tests__/daemon-rebuild.test.mjs. Cleanup must run on successful-fetch no-op ticks as well as adopting ticks, within the existing write lock (we:scripts/lib/daemon-rebuild.mjs:1741). Only direct, non-ignored, untracked regular provisional card files qualify; the broad we:backlog/x*.md description is not a deletion predicate. The historical count of 22 is not a measured current inventory and must be re-established during live proof.
- **Identity evidence:** we:scripts/backlog/id.mjs:23 defines a provisional ID as `x` plus exactly six lowercase base36 characters. `landedNumberFor` in we:scripts/lane-drain.mjs:1022 establishes the numbered-card/`bornAs` proof-of-land convention, but its whole-file grep is not sufficient by itself for destructive cleanup: a body example must not authorize deletion. Read the actual leading frontmatter from the pinned main tree. These are read-only reference dependencies, not additional edit scope.

## Design

1. Add a small cleanup helper in we:scripts/lib/daemon-rebuild.mjs, using the existing injected Git runner and alert channel. Call it inside `prepareRebuild` after successful fetch and before planning/early returns. Resolve the fetched main commit once and use that immutable SHA for every proof lookup; never use the working tree, an overlay, or local numbering bookkeeping as landing evidence.
2. Enumerate candidates through `collectUntrackedPaths`. Accept only direct Markdown card paths under we:backlog/ whose filename stem yields a hash through `idFromName` and `isHash` from we:scripts/backlog/id.mjs. Require the parent directory and candidate to be real directory/regular file entries, not symlinks; do not traverse nested directories. Ignored files, tracked files, numbered cards, malformed IDs and non-card paths remain untouched.
3. Read numbered Markdown card blobs under we:backlog/ at the pinned main SHA. Use the leading frontmatter only, requiring a single valid top-level `bornAs` scalar exactly equal to the candidate hash; accept the normal plain and quoted scalar forms. Missing, ambiguous or malformed evidence never authorizes deletion. Reuse the scalar-reading convention in we:scripts/backlog/frontmatter.mjs without changing that module. Do not equate a grep match in prose with frontmatter evidence.
4. Recheck candidate untracked membership and filesystem type immediately before unlinking each eligible file under the write lock. Unlink that exact file only; never invoke broad cleanup, recursive deletion or deletion of the containing directory. An absent file is an idempotent no-op. On evidence/read/delete errors, retain the affected file and emit an actionable alert; unrelated rebuild work may continue through its existing safety gates.
5. Report successful removals with candidate path, hash, landed card path and main SHA through the existing alert mechanism. Refresh `unsafe.untracked` after cleanup so cached-ready and normal collision checks see the remaining paths; a failed refresh refuses through the existing status-failure behavior. Move normal `untracked-kept` reporting after cleanup, preserving it on fetch-failure returns. Keep finalization's independent safety recheck. Update the module comments that currently promise every untracked path is preserved to name this narrow exception.
6. `dryRunRebuild` remains read-only and never calls the deletion helper. No additional maintenance command, state file or cross-repository implementation is needed. Preserve the lock/refusal boundaries in [we:docs/agent/platform-decisions.md#resident-daemon-reload-lifecycle](../docs/agent/platform-decisions.md#resident-daemon-reload-lifecycle).

## MVP

- Implement the helper and locked post-fetch integration in we:scripts/lib/daemon-rebuild.mjs, including fail-closed evidence, precise unlinking and audit output.
- Add real temporary Git repository cases in we:scripts/lib/__tests__/daemon-rebuild.test.mjs, using its existing bare-origin/author-clone fixtures and injected smoke function.
- Deliver the source and regression cases together. Cleanup is keyed by durable birth identity, not byte equality with the renumbered card: numbering legitimately changes its contents. No changes to filing, numbering, overlays or daemon scheduling are part of this item.

## Test plan

Extend we:scripts/lib/__tests__/daemon-rebuild.test.mjs with these assertions:

- A numbered main card with matching `bornAs` removes its untracked provisional copy after fetch, including when HEAD is already current. Repeat the rebuild: no second removal event and no error.
- Main has advanced but the clone has not adopted it yet: the freshly fetched numbered card is sufficient evidence. Conversely, a match present only in an overlay or local working-tree card does not qualify.
- Unlanded hashes, prefix-only hash matches, body-only `bornAs` examples, malformed/duplicate frontmatter and non-numbered proof files retain the candidate. Exercise plain and quoted valid values.
- Non-card paths, numbered local cards, tracked provisional cards, ignored files, nested paths, directories and symlinks remain intact. Include an untracked collision sentinel and verify the existing refusal still protects it.
- Fetch/proof-read failures remove nothing dependent on the failed evidence; an unlink error retains the file and reports failure without inventing success. Simulate a candidate becoming tracked before unlink and a failed post-cleanup inventory read.
- Dry run preserves candidate bytes, index and refs. Successful cleanup reports only actual deletions; `untracked-kept` contains surviving paths, and a cached-ready adoption does not consume a stale pre-cleanup list.

Run the affected Vitest file, then the existing we:scripts/lib/__tests__/daemon-rebuild-ready.test.mjs and we:scripts/lib/__tests__/daemon-rebuild-fallback.test.mjs regression suites, followed by `npm run check:standards`. Run commands from the WE root, stripping the `we:` citation prefix when supplying file arguments.

## Proof plan

First demonstrate the new landed-sidecar regression failing on the pre-change source and passing with the implementation in the same temporary-repository fixture. This must exercise `rebuildClone`, not only a helper.

For live proof after delivery, inventory the designated wev-review-daemon clone before a normal rebuild tick: record HEAD, the fetched main SHA, exact untracked candidates, corresponding numbered cards and survivor file digests. Observe one successful-fetch rebuild using the new code and capture its deletion alerts and post-tick inventory. Every removed path must have recorded main-tree `bornAs` evidence; every non-eligible sentinel must survive unchanged. Observe a second tick to prove idempotence. Do not manually delete files to manufacture the result. If 22 eligible copies still exist, all 22 must disappear; otherwise report the actual before/after counts. An inaccessible clone or zero eligible candidates leaves live cleanup unproven, even with passing fixture tests.

## Done when

1. The landed-sidecar `rebuildClone` regression in we:scripts/lib/__tests__/daemon-rebuild.test.mjs fails before implementation and passes afterward; preservation, failure and dry-run cases pass alongside the existing rebuild suites.
2. A successful-fetch no-op tick can prune proven landed sidecars without changing HEAD or relaxing tracked-dirt/collision refusals.
3. The live proof records the actual removed set, landing evidence and unchanged survivors; the standards gate passes.

## Follow-ups

No prerequisite design fork remains: the card already supplies the deletion policy, and this preparation bounds its implementation to provable landed identities. Preventing new approval-time sidecars or expanding cleanup to other artifacts is separate work. Do not delete an unproven leftover; record its path and reason during proof for later investigation.
