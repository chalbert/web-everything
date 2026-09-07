---
kind: story
size: 3
parent: "3383"
status: resolved
scope: ["we:scripts/operations/file-item-io.mjs", "we:scripts/operations/__tests__/file-item-io.test.mjs"]
dateOpened: "2026-09-07"
dateStarted: "2026-09-07"
dateResolved: "2026-09-07"
tags: []
---

# file-item's queue-add effect writes to the caller's own script-location sidecar, not the live conveyor runner's checkout

we:scripts/operations/file-item-io.mjs's FILE_ITEM_QUEUE_EFFECT sink resolves its we:.conveyor/queue.json sidecar via we:scripts/conveyor/queue-store.mjs's resolveQueuePath, which is SCRIPT-LOCATION-based (this process's own checkout), never the live conveyor runner's actual checkout. WE #3478 (resolved, merged as PR #1950) already fixed this exact class of bug for we:scripts/conveyor/queue.mjs's CLI path, by adding we:scripts/conveyor/resolve-runner-checkout.mjs plus we:scripts/conveyor/queue-work.mjs (the runner-aware sibling of we:scripts/conveyor/queue.mjs). we:scripts/operations/file-item.mjs bypasses that fix entirely — it calls we:scripts/conveyor/queue-store.mjs's pure core directly from we:scripts/operations/file-item-io.mjs, never through we:scripts/conveyor/queue-work.mjs, so an item filed from any checkout OTHER than the live runner's own silently queues into that checkout's own throwaway we:.conveyor/queue.json, invisible to the runner, with no sweep-back. Confirmed live 2026-09-07: 14 items filed from a scratch dispatcher checkout queued into that checkout's own sidecar and were invisible to we:scripts/conveyor/queue.mjs's list action run from the live runner's real checkout until manually re-queued.

## Done when

1. **Executable** — `we:scripts/operations/file-item-io.mjs`'s `FILE_ITEM_QUEUE_EFFECT` sink resolves the live
   conveyor runner's checkout via `we:scripts/conveyor/resolve-runner-checkout.mjs#resolveRunnerCheckout`
   (the same function `we:scripts/conveyor/queue-work.mjs` already uses for the CLI path, per WE #3478/#1950
   — reused, not re-derived) BEFORE resolving its sidecar path, and writes into that resolved checkout's own
   `we:.conveyor/queue.json` via `we:scripts/conveyor/queue-store.mjs#queuePath(cwd)` — never the calling
   process's own script-location default — whenever the resolution succeeds (`status: 'resolved'`).
2. **Executable** — a new test in `we:scripts/operations/__tests__/file-item-io.test.mjs` proves the actual
   gap this item documents: with an injected `resolveRunner` stub reporting a *different* checkout than the
   sink's own `root`, the queue entry lands in the RESOLVED checkout's `we:.conveyor/queue.json`, never in
   `root`'s — i.e. a `file-item` call made from a non-runner checkout still lands the queue entry in the
   runner's real sidecar.
3. **Executable** — when the runner cannot be resolved (`no-live-lock` / `ambiguous` / `no-pid` /
   `cwd-unresolved` / `process-mismatch`, or any future refusal reason `resolveRunnerCheckout` returns), the
   sink does not error and does not halt the `file-item` run — the queueAdd effect stays "one effect or zero,
   never refused" per `we:scripts/operations/file-item.mjs`'s own header — falling back to today's
   script-location `resolveQueuePath()` behavior so a card filed with no live runner running still gets some
   sidecar entry rather than none.
4. Existing tests in `we:scripts/operations/__tests__/file-item-io.test.mjs` that pass an explicit `queuePath`
   override keep passing unchanged (the override still wins outright — only the unmodified default changes).
5. `npm run check:standards` shows no new errors and no new warnings against the observed baseline (disclose
   the baseline delta in the PR body per this repo's convention — do not hardcode a number here).
