---
name: decision-default-mirrors-story-no-divergence
description: "A decision turn must mirror the story's bold default; if prepare and the decider diverge, a choice was left un-prepared (a prose residue) — not a judgment to reconcile."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: eb2b0a8e-8136-44bb-a1e9-d9e03bb0c5d3
---

When working a `kind: decision` item, the recommendation you VOICE must be the item's
own **bold default**, read off the story — never a stance you form in chat. If you catch
yourself recommending something the body doesn't say, that is the signal to **edit the
item first** (promote/flip the fork, re-run its red-team into the body), then present the
item's now-current default. The story is always the source of truth; chat never runs ahead
of it.

**Why:** `prepare` and the decision turn are one pipeline, not two reasoners. Prep does the
research and writes a default for every live choice; the decider only red-teams + ratifies
it. So they *cannot* legitimately reach different conclusions — if they do, the cause is
structural: a live choice was left **un-prepared**, almost always as a **prose "open
residue / decide-at-ratification / TBD" aside outside any `## Fork N`**. The fork-shape
walks scan headings, so a prose residue slips past every readiness check, and the decider
is forced to originate a cold call → divergence + a chat-only recommendation. (Caught live
on #1935: Fork 2 left "ship C full vs A-first" as an open-residue line, and I floated a
sequencing rec that diverged from the body's stated default of C.)

**How to apply:**
- Prep close-out: scan the WHOLE body, not just `## Fork N` headings, for deferred-choice
  phrasing. Promote each to its own fork with a bold default, fold it into an existing
  fork's default, or drop it as not-a-choice. No dangling residue → no divergence.
- Decision turn: present the item's default verbatim. A stale prep (tree moved since
  `preparedDate`) is rewritten + red-teamed INTO the item *after claim, before the first
  presentation* — so the decider's first read is already fresh and source-of-truth.
- Backstop now enforced: `check:standards` warns when a `kind: decision` that is resolved
  or carries `preparedDate` still has deferral phrasing in prose (lintBacklogItemRendering,
  #1935). Encoded in docs/agent/backlog-workflow.md ("no live choice may sit outside a Fork
  N" + "mirror the item's default" + "stale prep re-prepared before first presentation")
  and the prepare-decision-item skill close-out gate.
