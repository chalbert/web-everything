---
bornAs: x7nb9hn
kind: story
size: 3
status: open
scope: ["we:scripts/conveyor/duplicate-pr-watch.mjs", "we:scripts/lib/open-pr-items.mjs"]
dateOpened: "2026-09-14"
tags: []
---

# Duplicate-PR watch false-positives when an epic is never split into per-slice item numbers

we:scripts/conveyor/duplicate-pr-watch.mjs groups open PRs by the backlog item number their branch/title cites, via we:scripts/lib/open-pr-items.mjs#deliveredItemNumsFromPr, then flags 2+ PRs citing the same item number as duplicates. The pass's own docstring argues this is safe because 'this repo's own conventions' (we:docs/agent/backlog-workflow.md, Splitting a large story) give every legitimately-different slice of an epic its OWN item number, so two PRs building different slices of the same epic 'therefore deliver two DIFFERENT item numbers and never land in the same group here.' That assumption breaks whenever an epic is never actually split: every disjoint slice of its work still cites the SAME epic number in its branch/title, so the watcher groups them and flags false duplicates. Confirmed real 2026-09-14 against epic #3383 (we:backlog/3383-a-background-mechanical-dispatcher-replaces-the-interactive.md, kind: epic, status: active, never sliced into child item numbers): PR #2239 (registry autosync knob, we:scripts/lib/poc-branches.mjs and .json) was flagged as a duplicate of PR #2223 (heavy-admission pid-identity fix, we:scripts/readiness/file-locks.mjs + we:heavy-admission.mjs) and PR #2220 (host-process telemetry granularity, we:host-process-sample.mjs + we:telemetry.mjs + we:telemetry-cli.mjs). Direct diff inspection of all three PRs shows zero file or logical overlap between any pair. This will keep false-positiving on every future unsplit-epic slice until fixed. Likely fix direction for whoever picks this up (not prescriptive): duplicate detection needs to also compare actual file/path scope overlap (e.g. changedFiles) before flagging two PRs as duplicates, especially when the cited number resolves to kind: epic rather than a leaf item, rather than relying solely on the cited item number matching. Do not fix we:scripts/conveyor/duplicate-pr-watch.mjs as part of filing this — this card is scoping/evidence only.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
