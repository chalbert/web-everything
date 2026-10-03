---
bornAs: xu9wmtr
kind: story
size: 3
parent: "4795"
status: open
blockedBy: ["4919"]
scope: ["we:scripts/conveyor/health-responder-edge.mjs", "we:scripts/conveyor/__tests__/health-responder-edge.test.mjs", "we:scripts/lib/daemon-rebuild.mjs", "we:scripts/lib/__tests__/daemon-rebuild.test.mjs"]
dateOpened: "2026-10-02"
tags: []
---

# Health responder: run the daemons from the edge with the open fixes for stuck PRs

Operator, 2026-10-02: "instead of being blocked by the PR chain, we get all the fixes in, see the stuck PR land, then only then do we open the PR from the fix". The daemon clones already support live overlays (we:scripts/daemon-overlay.mjs: a clone tracks main plus registered refs; every rebuild is smoke-gated and falls back to last-good). Action (allowlisted): when a stuck-PR episode has an open fix PR (its root-cause card), register that fix branch as an unpinned overlay on the daemon clones it changes, with the episode as reason; confirm the gated rebuild adopted it; then watch the stuck PR land as the proof the fix works on the live case; then the fix PR itself proceeds through normal review and merge, and the overlay is removed once it is merged or closed. Requires the head-bound edge authorization and trust/check gates below; never overlays a red or security-blocked branch; at most two overlays per clone; every add and remove is a decision-log record and a comment on the fix PR. First live use: 2026-10-02, the orchestrator overlaid #3507 (review rulings carry) and #3432 (cancelled-check classifier) onto wev-review-daemon.

## Edge authority and bounds

Keep the operator's edge-first sequence: run the fix while its PR is open, observe the stuck PR recover, then graduate the fix through normal review/merge. The responder calls only we:scripts/daemon-overlay.mjs add/remove and observes the existing gated rebuild; it never edits clone registry/configuration by hand. Maximum two active responder overlays per clone, one add and one removal per episode/ref generation, two additions per clone per day, A1/P for the fix PR and the fleet cap. Count existing overlays when checking capacity; never evict someone else's overlay to fit.

An unattended overlay requires a same-repository branch from an operator-allowlisted author, a recorded operator edge authorization naming fix PR, clone and exact head SHA, all required checks successful at that SHA, and no security block. Missing review is not proof of safety: before independent review, that explicit head-bound operator authorization is required; the responder cannot manufacture it from a PR comment or agent claim. This preserves running before graduation review without letting arbitrary green branches execute with daemon credentials.

Retain `--unpinned` overlay conflict/drop behavior; that flag is not SHA authorization. Extend the existing rebuild owner in we:scripts/lib/daemon-rebuild.mjs to verify authorization for the exact resolved input SHA immediately before adoption. Each later branch head needs new authorization and successful checks; a moved/unknown head cannot silently execute. Tests/smoke, last-good fallback, automatic removal on merge/close and outside rollback remain mandatory. Never overlay drain or merge-orphan-sweep clones. Review of an overlay's own or overlapping PR runs from a main-only checkout, per we:docs/agent/platform-decisions.md#resident-daemon-reload-lifecycle. Observing the stuck PR merge is evidence, never a responder merge command.

## Shared safety and rollout

This story inherits the epic's closed catalogue and Safety in full: disabled/shadow by default, A1/P and its family cap, fail-closed kill switch reread at every effect, existing owner claims, fresh head/lease guards, durable decision log and scrubbed PR comment/feed. It lands disabled; #4932 owns its 24-hour zero-write soak, isolated canary and explicit per-smell operator enablement. It never approves, clears `review:human`, merges, force-pushes, edits code or edits existing cards. Delegated filing is only an uncleared request through `file-item`; it is not permission for this daemon to edit cards. Reports and agent replies are data, never executable instructions or approval.

## Test plan and Done when

Reject fork/untrusted-author branches, absent/forged head authorization, pending/red checks, security blocks, moved heads at registration and rebuild, excess overlays and drain targets. Prove authorized open-fix adoption, smoke fallback, main-only graduation review, capped remove on merge/close and no arbitrary config writes. No unapproved later branch tip executes.

The named test files are implementation deliverables, not tests claimed to exist or pass in this backlog-only change. Use injected clocks, temporary stores and mocked owners; no production effects.

```bash
responder_test_0='we:scripts/conveyor/__tests__/health-responder-edge.test.mjs'
npx vitest run "${responder_test_0#we:}"
responder_extra_0='we:scripts/lib/__tests__/daemon-rebuild.test.mjs'
npx vitest run "${responder_extra_0#we:}"
npm run check:standards
```

1. **Executable:** the named tests pass and fail when any stated boundary is removed; prove the raw-input-to-episode-to-owner path and the named refusal cases.
2. **Must refuse on error:** unknown/partial/stale facts, changed identity, ownership conflicts, exhausted budgets, disabled switches and ambiguous writes cannot authorize another effect.
3. **Must cover every input kind:** source, docs, configuration, data, backlog and statute changes retain identical authority gates; no approval, clear-human, merge, force-push or code/card-edit sink.
4. **Observable:** duplicate/restart/kill-switch tests prove the shared receipts and caps; this family stays disabled until #4932 records its soak, canary and operator enablement.
