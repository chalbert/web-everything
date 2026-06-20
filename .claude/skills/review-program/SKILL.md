---
name: review-program
description: Run a standing program's watch — refresh its front-B discovery with later data, review what's been done against the program's goal, brainstorm what could be done, and file the newly-surfaced items under it. Use when the user wants to "review a program", "run the watch on <program>", "refresh <program> with new data", or check what's changed for an ongoing/standing program (e.g. the platform-standards watch #1257, framework-churn #1258, gap-sweep #315). A program NNN focuses one; bare lists the programs by staleness.
---

# Review-program — run a program's watch, review progress, brainstorm next

Trigger + pointer — the method lives in *docs/agent/backlog-workflow.md → Running a program review (the watch)*, which builds on *docs/agent/backlog-workflow.md → Programs (the Program Test)* and reuses the idempotency/dated-revision discipline of *.claude/skills/gap-sweep-rerun*. Don't restate the rubric here; if the method changes, edit that doc.

## The loop

1. **Orient — what's been done.** Load the item (`node scripts/backlog.mjs --json`); confirm `NNN` is a program (`childlessReason: program` or `ongoing: true`). Read its **two fronts** + DoD from the body, its **last review** (newest `reports/<date>-program-<slug>.md` and `## Review log` entry), and enumerate prior outputs — resolved children (`grep -l 'parent: "NNN"' backlog/`) + prior reviews. State maturity (**L0/L1/L2**) and the front-A read.
2. **Refresh — run the watch (front B).** Run the program's discovery against *later* data: a discovery **script** if it has one (gap-sweep → `node scripts/gap-sweep-status.mjs`; reference-liveness → `npm run sweep:references`), else **web-search / fetch** the domain per its lenses for changes since the last review. Capture the external delta (new / moved / obsoleted).
3. **Review + brainstorm — what could be done.** Cross the delta against current state: what conformance went **stale**, what gap **opened**, what is newly **adoptable**. Draft candidate items (the could-do), each tagged to the front it serves.
4. **Present, then file on `go`.** Show the delta + candidates. On approval, `node scripts/backlog.mjs scaffold --kind=<kind> --parent=NNN …` for **only the newly-appeared** items. Then stamp the run: append a dated `## Review log` entry to `NNN`, **append** the run detail to the single **living report** `reports/<first-run-date>-program-<slug>.md` (create on run 1), and set `NNN`'s **`relatedReport`** to it once — single-valued, so **one living report per program**, never per-run (else it reads as a hidden report). If `NNN` gains its first children this run, drop its `size`/`childlessReason: program` and set `ongoing: true` (childless → storied program).
5. **Gate.** `npm run check:item -- <NNN>` per touched item; `npm run check:standards` before done.

## Notes

- **Bare `/review-program`** lists the programs (`childlessReason: program` + `ongoing: true` epics) ranked by **staleness** (oldest last-review first). A `NNN` / `NNN-slug` focuses one and goes straight in.
- **Idempotent + dated** (the #315 rule): a re-run over an unchanged landscape opens **0** items yet is still a new dated revision. **Discovery proposes, the human disposes — never auto-file.**
- **#315 delegation:** the domain-specific corpus refresh stays owned by *gap-sweep-rerun*; for #315 this skill calls that, it does not duplicate the corpus steps.
- This is the **L0→L1 graduation** for a program (defined → skill-assisted). Scheduling it (L2) is a separately-prioritized follow-up (#367 pattern), never assumed.
