---
name: capture-learning
description: Capture a one-off observation into the cross-session learnings pool — the write side whose read side is /harvest. Use when the operator says "note this", "save this as feedback", "remember this friction", "log that", "add this to the pool", "capture that as a lesson", or runs /note. Shapes ONE sentence into the pool's four-field entry (kind/summary/area/suggestion) and shells the existing CLI (we:scripts/conveyor/learnings-drop.mjs) — never reimplements the append, the scrub, or the schema. Capture-only — NEVER routes to we:backlog/ or agent memory, and NEVER judges, dedups, or decides whether the observation matters. That adjudication happens exactly once, later, at harvest.
---

# Capture a learning — the pool's front door

The learnings pool has a well-marked exit (`/harvest`) and, until this skill, an unmarked entrance. This
skill is that entrance: turn whatever the operator or agent just said into one valid pool entry and append
it. Nothing more.

## The one hard rule: capture never adjudicates

**Accept everything. Route nothing.** Do not decide "this is really a bug → file it in `we:backlog/`" or
"this is really a durable rule → put it in agent memory." Every observation — however big, however small,
however clearly it looks like it belongs somewhere else — goes into the pool as a learnings entry and
nowhere else. The close-emits/harvest-judges split (`we:skills-src/harvest-learnings/SKILL.md`) exists
precisely so adjudication happens once, centrally, at harvest — not scattered across every capture moment.
If you route to `backlog/` or memory from here, you have broken that split.

## Steps

1. **Take the operator's sentence(s) as-is.** No back-and-forth needed to use this skill — one sentence is
   enough. If the input actually bundles two unrelated observations, split it: one observation per entry
   (a bundled entry clusters with neither at harvest time). Run steps 2–4 once per observation.

2. **Shape the one sentence into the CLI's four fields.** This is the only judgment this skill exercises —
   picking words, not picking a destination:
   - `kind` — pick the single best fit from `friction | missing-convention | doc-gap | skill-gap |
     improvement`. If genuinely ambiguous, default to `friction` (the loosest bucket — the harvest can
     re-read it either way).
   - `summary` — the observation itself, generalized to a lesson rather than the specific incident ("the
     lane gate reruns the full suite for a docs-only diff", not "PR #1064 took 9 minutes"). **One tight
     sentence, ≤240 chars** — the CLI rejects anything longer, so trim before you shell it, not after
     the CLI errors.
   - `area` — a coarse, stable label for what this is about (a subsystem or activity, e.g. "lane gating",
     "memory index", "backlog readiness") — **not** a file name or item number; those are too specific to
     ever cluster with anything else. ≤60 chars.
   - `suggestion` — what you'd do about it, in one short line. ≤400 chars. If the operator gave none, offer
     your own best short recommendation rather than leaving it thin — every surviving member suggestion
     matters at harvest even when another entry becomes the cluster's representative.

3. **Mint one session slug for this capture** (this shell session has no pre-existing slug to reuse, unlike
   a close or a delivery agent, which already have one):

   ```bash
   node scripts/conveyor/learnings-drop.mjs \
     --kind=<friction|missing-convention|doc-gap|skill-gap|improvement> \
     --summary="<the observation, one sentence, ≤240 chars>" \
     --area="<coarse label, ≤60 chars>" \
     --suggestion="<what you'd do about it, ≤400 chars>" \
     --session="note-$(date +%Y%m%d-%H%M%S)"
   ```

   Do not reimplement the append, the scrub, or the schema — this CLI (`we:scripts/conveyor/
   learnings-drop.mjs`) is the only writer of the pool; shell it, don't hand-roll a JSONL append. If two
   observations are captured in the same turn, mint a fresh timestamped slug for each — do not reuse one
   slug across unrelated entries (that fakes recurrence the same way a shared slug would at close).

4. **Report the result plainly.** On success, echo back the CLI's own confirmation line (kind + where it
   landed) so the operator knows it was captured, not silently dropped. On rejection (the CLI validates and
   refuses out-of-schema or over-length entries), shorten the offending field and retry once rather than
   asking the operator to re-author it from scratch.

## What this skill is not

- **Not a classifier.** It never decides backlog-vs-memory-vs-pool; everything it touches goes to the pool.
- **Not the harvest.** It never dedups, red-teams, or routes survivors — see `/harvest` for that half.
- **Not the product feedback channel.** #2610/#2774 is a different, client-side surface for end users of
  the product; this is the operator/agent-side entrance to the *internal* pool. They share the scrub core
  (`we:scripts/lib/secret-scrub.mjs`), not a UI.
