---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/reconcile-note-comment.mjs", "we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs", "we:scripts/conveyor/__tests__/reconcile-note-comment.test.mjs", "we:skills-src/conveyor/__tests__/reconcile-fix-dispatch-daemon.test.mjs"]
dateOpened: "2026-09-26"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2725's independent review

Filed mechanically by the unattended review loop (#2749) — every finding below reduced chalbert/web-everything#2725's review to prevention-outstanding by naming a guard neither captured nor filed:

1. `we:scripts/conveyor/reconcile-note-comment.mjs:106` — A unit test that builds the comment from a note shaped exactly as planReconcile actually produces it (text including the embedded phrase, plus lastFailureReason set) and asserts 'Last failure:' occurs exactly once in the output body - a deterministic, script-decidable assertion rather than a hand-crafted fixture that avoids the phrase.
2. `we:scripts/conveyor/reconcile-note-comment.mjs` — Anchor the episode-key match to its own line (e.g. a per-line ^<!-- conveyor-note-key: KEY -->$ regex, or only ever inspect the last line of the body) instead of a whole-body substring search, and/or strip `<!--`/`-->` sequences from any externally-sourced field (lastFailureReason) before interpolating it into a comment that also carries a machine-parsed marker — ideally as a shared helper in we:scripts/lib/marker-authorship.mjs so every future durable-marker feature gets it for free.
3. `we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs:277` — Add a deterministic test calling runReconcileNotesAllRepos with dryRun omitted, a fresh note, an injected postComment spy, and the environment variable unset; assert no post occurs. Also verify explicit environment opt-in reaches the spy.
4. `we:scripts/conveyor/reconcile-note-comment.mjs` — A unit test asserting the full string output of `buildNoteComment` when fed the actual shape of `note.text` returned by `planReconcile`, rather than a synthetic string that lacks the suffix.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
