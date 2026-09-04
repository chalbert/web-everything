---
name: mechanical-delivery-doctrine
description: The ten standing operating rules for driving epic #3383's mechanical dispatcher — kanban-style fix-it-don't-ask, dispatch on the card + the generic brief never a bespoke prompt, the orchestrating session never edits/commits directly (always delegates to a subsession in a lane), a prototype-branch bug fix skips ceremony but a main-code fix takes the full pipeline, every review:human PR gets an independent AI review pass before the human ceremony, the operator's in-conversation "I approve <PR>" naming a PR IS the clearance instruction, resume the branch's continuous runner loop as the primary delivery mechanism, a reproducible tool failure is not proof of a genuine external limitation, a mechanism-bug fix found during delivery still delegates the FIX to a subsession, and the runner's normal operating mode is tracking `main` directly — a long-lived divergent branch is a temporary build tool, not the default steady state. Use when driving, orchestrating, or resuming work on #3383's dispatcher/runner/supervisor, or when the operator asks "what's the standing doctrine for the dispatcher" / "check the delivery doctrine" / "how should this session be operating right now". Read this BEFORE taking any action as the session driving that epic's machinery — it is meant to be followed immediately, not summarized further. NOT `/conveyor` (#2612/#2613) — that is a separate, older interim delivery mechanism (a swimlane-progression loop run live from an interactive session); the two have not been unified yet.
---

# Mechanical-delivery doctrine — epic #3383's standing operating rules

Ten rules accumulated while building and live-firing `#3383`'s own machinery (the background
mechanical dispatcher that replaces an interactive session as delivery supervisor). Each rule below
is enough to act on without reading further — the full evidence and reasoning for each sits in the
named section of `#3383`'s own card
([we:backlog/3383-a-background-mechanical-dispatcher-replaces-the-interactive.md](/backlog/3383-a-background-mechanical-dispatcher-replaces-the-interactive.md)):
read that section before you need to defend or extend a rule, not before you can follow it day to day.
This skill is the load-and-follow form; the card keeps the "why" plus the full session-update
history. If a rule itself changes, edit it here first, then note the change on the card.

1. **Kanban-style: fix it, don't ask.** When a session driving this epic's machinery hits an issue —
   a stuck session, a broken assumption, a mechanism doing the wrong thing — diagnose the root cause
   and apply the real fix on its own merits. Do not stop to surface a menu of options via a closed
   multiple-choice question tool. This changes *when* to ask, not whether the fix gets reviewed: a
   real mechanism-code fix still lands the normal way, in a lane, through the reviewed PR pipeline.
   Reserve actually asking the operator for genuine authorization gates (dispatching something live
   for the first time, a destructive/irreversible action) — not for "which workaround do you want."
   (Full rationale: `#3383`'s "Working doctrine (2026-09-01), the operator's own words: kanban-style,
   not stop-and-ask" section.)
2. **Mechanical dispatch runs on the card + the generic brief, never a bespoke prompt.** Any
   investigation, root-cause, or design work belongs written INTO the item's own card, never folded
   into a one-off prompt handed to a subagent. Dispatch a build, review, or anything else this epic
   mechanizes through the actual mechanism under test (`we:scripts/operations/dispatch-lane.mjs` /
   `we:scripts/operations/review-dispatch.mjs`), using the SAME generic brief every item gets, filled
   only with the small closed set of placeholders those briefs declare. A driving session's own
   hand-briefed `Agent`-tool subagent is not that mechanism — using one to "get the work done" proves
   nothing about whether the real dispatcher works. (Full rationale: `#3383`'s "Working doctrine
   (2026-09-01, continued): a mechanically-dispatched item runs on the card + the generic brief,
   never a bespoke prompt" section.)
3. **The orchestrating session never edits or commits directly.** The main/interactive session
   driving this epic must never itself run `Edit`/`Write` against repo files, or `git commit`/`git
   add`, in the primary checkout — not even for a small doc-only change. All edits, including
   backlog-card updates and agent-memory notes, go through a dispatched subagent working inside a
   lane clone, or the real conveyor. The orchestrating session's job is to acquire the lane, brief
   the delegate, and relay the result — never to hold the pen. (Full rationale: `#3383`'s "Working
   doctrine (2026-09-01, continued): the main/interactive session is the orchestrator only" section.)
4. **A bug found testing the prototype can be fixed ON the prototype directly — no story, no PR, no
   review ceremony; only graduating a piece TO `main` needs the full pipeline.**
   `origin/lane/mechanical-dispatcher` has no merge-PR history of its own — every commit was pushed
   straight to the branch — so a quick fix pushed straight there skips no ceremony the branch ever
   had. A lane clone is still required (the git-branch-mutation guard applies regardless of target
   branch), just not the story/PR/independent-review ceremony. **This does NOT cover fixing code that
   already lives on `main`**, even when the bug was noticed while running the prototype — that always
   takes the full pipeline (a real story, a lane, a PR, independent review). The branch itself is
   never dropped until the prototype's graduation is fully done, with the operator's explicit
   approval. (Full rationale: `#3383`'s "Working doctrine (2026-09-01, continued): a bug found
   testing the prototype branch can be fixed ON the prototype branch directly" section.)
5. **Every `review:human` PR gets an independent AI review pass before the human ceremony, not
   instead of it.** A PR labelled `review:human` (the conflict-of-interest gate for a diff touching
   gate machinery or the statute file) must be run through a genuinely independent `review-pr` pass —
   dispatched as a separate OS process with its own fresh session id, never the authoring session or
   the `Agent` tool (which inherits the parent's session id) — and any real, confirmed findings must
   be fixed and pushed before the PR reaches the operator. This does NOT change who may clear
   `review:human`: the human ceremony only, unconditionally; `--answer=accept` stays refused on a
   `review:human` PR by construction. (Full rationale: `#3383`'s "Working doctrine (2026-09-02): a
   `review:human` PR gets an independent AI review pass BEFORE the human ceremony" section.)
6. **The operator's in-conversation "I approve `<PR>`", naming the PR, IS the explicit instruction
   the clear-human ceremony already requires.** This states nothing new — it names, in one place,
   what already counts as the explicit in-conversation instruction `we:.claude/skills/review/SKILL.md`
   demands before the ceremony may run. On sight, run `we:scripts/review-set-label.mjs <PR>
   --repo=<owner/repo> --to=clear-human --actor="Nicolas Gilbert (operator)" --reason="<verbatim
   quote>" --body-file=<a small clearance note under /tmp>` — `--reason` carries the operator's own
   words verbatim, never a paraphrase. "Looks fine" or a batch approval that never names a PR number
   does not qualify. (Full rationale: `#3383`'s "Working doctrine (2026-09-02, continued): the
   operator's in-conversation 'I approve `<PR>`' naming a PR IS the explicit instruction" section.)
7. **Resume the prototype's own continuous runner loop as the primary delivery mechanism.** This is
   not a new plan; it is a return to the one this epic already states at the top, in its "How to
   build it" section: build/iterate quickly on `origin/lane/mechanical-dispatcher` (rule 4 above
   governs how a fix lands there), run it live, and when a piece is genuinely stable, file the real
   story and open the real PR to graduate it to `main` (rule 4's own graduation path) — "only once
   everything has transferred does the real system execute from `main` instead of the branch." A
   detour into heavy manual one-shot dispatcher calls and lease babysitting is sometimes needed to
   root-cause a specific live-safety bug, but it is a detour, not a new direction — the loop itself
   is the default way work gets done, with one-shot dispatcher calls as the FALLBACK for whatever the
   loop doesn't cover yet. Before leaning on the loop again after any long gap, sanity-check live that
   the most recent safety fix actually holds under the continuous tick loop, not just `--once` calls.
   (Full evidence: `#3383`'s "How to build it" section for the founding plan this restates, and its
   2026-09-01 close-out session update for why a detour happened and what unblocked resuming it.)
8. **A reproducible tool failure is not proof of a genuine external limitation.** A consistent,
   repeatable failure feels like proof of an absent capability; it is not. Before writing off a
   capability as absent — especially one this epic depends on for cleanup or control — check every
   field/parameter a working alternative uses differently. A real instance: `claude stop`/`claude rm`
   "No job matching" failures were diagnosed, repeatedly and at length, as an external CLI/daemon
   limitation until the operator explicitly pushed back ("stop saying this, assume there is a way you
   haven't found") and investigation found the real cause — every failing call passed the full
   session `sessionId` UUID instead of the short 8-char `id` field those two commands actually match
   on. (Full evidence: `#3383`'s 2026-09-02/03 session update. The durable, repo-wide form of this
   lesson is also captured as agent-memory note
   `question-a-concluded-external-limitation-before-accepting-it`, PR #1878.)
9. **A delivery pause caused by a mechanism bug delegates the FIX to a subsession too, same as any
   other edit; the orchestrating session relays, it does not hold the pen.** This is not new
   doctrine — rules 2 and 3 above already say it — restated because both were violated live once: the
   orchestrating session hand-spawned several `Agent`-tool delivery workers to "test a fix" (rule 2),
   and personally `Edit`ed and committed real mechanism fixes itself instead of dispatching a
   subagent to do it (rule 3). The corrected shape, restated for this specific case: when delivery
   stalls because of a genuine mechanism bug, the orchestrating session diagnoses ROOT CAUSE only
   (read-only), then delegates the fix itself to a dedicated subsession. Which pipeline that
   subsession's fix takes is rule 4's own distinguishing question, not a new fork: code that lives
   only on `lane/mechanical-dispatcher` gets the ceremony-free direct-push path; a fix to code
   already on `main` takes the FULL pipeline — a real story, a lane, a PR, independent review. Only
   once the subsession's fix is proven (measured before/after, not asserted) and landed does the
   orchestrating session resume delivery. (Full evidence: `#3383`'s "Working doctrine (2026-09-04):
   rule 9" section.)
10. **The runner's steady state is tracking `main` directly; a long-lived divergent branch is not the
    default operating mode.** When a mechanical bug in the delivery machinery itself needs fixing:
    (1) stop the runner (or otherwise take it off `main`), (2) cut a SHORT-LIVED branch/lane fresh off
    current `main` for the fix, iterate and test it live there, (3) once the fix is confirmed working
    and merged back to `main`, switch the runner back to tracking `main` directly. The fix branch is
    disposable — it does not linger as a standing parallel tree. Set after tonight's own prototype
    branch, `origin/lane/mechanical-dispatcher`, drifted 97 commits behind `main` behind a
    silently-failing auto-sync loop, costing a ~40-minute manual reconciliation (15 real conflicts)
    before delivery could resume at all — while the same quick-fix-via-fresh-scratch-lane pattern
    (`#1894`/`#1895`/`#1902`/`#1903`, all tonight) landed repeatedly without ever needing a standing
    branch. **Not yet fully in effect as of 2026-09-04**: `#3443` (the branch's own graduation to
    `main`) is still open, with real content still unique to the branch, so the runner currently still
    needs to run off `origin/lane/mechanical-dispatcher` (freshly reconciled tonight, not stale)
    rather than `main` directly — this rule states the TARGET steady state once graduation completes,
    not a claim about today's actual runner configuration; check `#3443`'s live status to know whether
    this rule is fully active yet. (Full rationale: `#3383`'s "Working doctrine (2026-09-04,
    continued): rule 10" section.)

## Not `/conveyor`, on purpose

This is a separate skill from `we:.claude/commands/conveyor.md` (`#2612`/`#2613`) — deliberately not
merged. `/conveyor` is a different, older delivery mechanism: an interim swimlane-progression loop run
live from an interactive session. This doctrine governs `#3383`'s resident background dispatcher
instead, and the two mechanisms are not unified yet. Once the mechanical dispatcher fully supersedes
`/conveyor` (part of what `#3096`/`#3353` are working toward), these two skills should probably merge
— but that merge is not done here.
