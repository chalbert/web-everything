---
kind: decision
parent: "3383"
status: open
scope: ["we:docs/agent/platform-decisions.md", "we:scripts/lib/model-probation.mjs"]
dateOpened: "2026-09-14"
relatedTo: ["3654"]
tags: [probation, model-routing, review, graduation, calibration-veto]
---

# Define what clears a triggered calibration veto so a role can graduate

#3654's ratified graduation rule (we:docs/agent/platform-decisions.md#model-probation-graduation-criteria, merged commit 5b50856a1) makes a confirmed calibration miss an independent veto on promotion out of probation, but never says how a triggered veto is ever cleared. This is not hypothetical: Codex's advisory-review role carries a live, unresolved veto today, from PR #2107, where Codex rated a real bug non-blocking while Claude's correctness juror rated the same bug a blocker (cited on #3654's own Grounding section). Open question, not a snap answer: candidates worth weighing include a documented root-cause finding plus a fix to the reviewer's mandate/prompt followed by a fresh clean trial on a similar case, or some other remediation mechanism (a cooling-off period, a fixed run of subsequent clean trials, a human override) -- none decided here.

## Grounding — read before ruling

- **The gap, precisely.** #3654 Fork 2 (ratified, we:docs/agent/platform-decisions.md#model-probation-graduation-criteria
  clause 2) rules that "a confirmed calibration miss is an INDEPENDENT VETO, never diluted into a blended
  score" — but the ratified text and the card behind it stop at the veto firing. Neither says what, if
  anything, ever lifts it. #3654's own "Done when" #3 explicitly scoped wiring/threshold work as
  out-of-scope follow-on, and this is that kind of follow-on: a mechanism question the ratification
  deliberately left open, not a re-litigation of the veto itself.
- **The live incident.** we:backlog/3654-define-graduation-criteria-for-a-model-provider-to-exit-prob.md's
  Grounding section records: "a known, unresolved calibration gap: in the one case tested in depth, Codex
  correctly identified a real bug but rated its severity as non-blocking/carve-out where Claude rated the
  same bug a blocker." That case is PR #2107 (`WE #3627: replace --bare/--safe-mode with --restricted for
  the delivery-agent provider`). Per PR #2182's own record (cited on #3654), this sits inside Codex's
  4/4 `advisory-review` trial history — meaning today, by #3654's own Fork 2 clause, Codex's
  `advisory-review` role carries a standing veto on graduation with no defined path off it.
- **What this card does NOT decide.** It does not reopen whether a calibration miss should veto (settled,
  #3654 Fork 2), whether the bar is per-role (settled, Fork 3), or whether any identity gets an easier bar
  (settled, Fork 4 — no vendor-reputation discount, so "just trust Codex more" is not an available answer
  here either). It asks only: once tripped, what clears the veto?

## Candidates to weigh (not a ruling — open for /prepare)

- A documented root-cause finding for the miss, plus a fix to the reviewer's mandate/prompt/rubric, followed
  by a fresh clean trial on a similar (or the same) case class.
- A fixed number of subsequent clean trials after the miss, with no prompt/mandate change required.
- A cooling-off/decay window (the veto ages out after N trials or T time with no repeat).
- A human override — an explicit operator judgment call that the miss is understood and non-recurring.
- Some other mechanism not listed here.

## Done when

1. **Executable** — `node we:scripts/backlog.mjs show <this item>` reports `status: resolved` with
   `codifiedIn:` set, and the ruling states which remediation mechanism (or combination) clears a triggered
   calibration veto.
2. **Grounded** — the ruling explicitly addresses the live PR #2107 veto on Codex's `advisory-review` role:
   whether/how it clears under the new rule, or what remains to be done before it can.
3. **Not decided here, by design** — this card only opens the question with candidates to weigh; a full
   fork breakdown with a recommended default is authored by `/prepare` before ratification, the same shape
   #3654 itself went through.
