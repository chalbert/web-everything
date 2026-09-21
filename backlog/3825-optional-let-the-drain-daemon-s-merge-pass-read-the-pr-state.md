---
bornAs: x34tegz
kind: story
size: 5
status: open
blockedBy: ["3824"]
scope: ["we:scripts/merge-ai-prs.mjs"]
dateOpened: "2026-09-21"
tags: []
---

# Optional: let the drain daemon's merge pass read the PR state feed for its lists

Optional follow-on to #3699 Fork 1(b): the drain daemon's merge pass (we:scripts/merge-ai-prs.mjs, run as a child by the daemon) makes its own per-repo list calls each pass. It could read the PR state feed for the list instead, but only if the snapshot carries every field the pass needs (PR bodies for manifests, labels) and the pass still confirms live state with a per-PR check before it merges. First step is a check that the snapshot fields cover the pass; if they do not, close this item as not worth doing. Not counted in the saving that #3699 ratified. Filed unqueued so the conveyor does not pick it up before that check is made.

## Done when

1. **Decision gate first** — a short written check, in this item, of every field the merge pass reads from its list calls against the fields the snapshot carries. If any is missing and cannot be added to the feed's one list call, the item is closed as not worth doing.
2. **Executable** — only if the check passes: `npx vitest run` on we:scripts/__tests__/merge-ai-prs.test.mjs passes with new cases that fail before this item lands: the pass builds its candidate list from a fresh snapshot with no list call of its own, still makes a live per-PR check before each merge, and falls back to its own list call when the snapshot is stale or missing.
