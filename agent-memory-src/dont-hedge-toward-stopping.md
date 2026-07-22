---
name: dont-hedge-toward-stopping
description: Don't try to convince the user to stop / wrap up when buildable work remains and there's no genuine blocker — keep going and decide the defaults yourself.
metadata:
  type: feedback
---

Do NOT hedge toward stopping — "this is a good stopping point", "want me to wrap here?", "this needs your
input first" — when there is buildable work and no genuine blocker. When the user says continue / go, keep
going.

**Why:** In the Plateau Loop console sessions I repeatedly offered to stop on items that were merely *big*
(a sz-8 standards+FUI slice, #2523) or *needed a default chosen* (which ready items to surface on the board, a
dimension name), and framed those as reasons to punt to the user. The user pushed back: "why do you want to
stop" → "stop trying to convince to stop without good reason." I make decisive engineering calls constantly
(the #2569 contract ambiguities, the #2582 slicing, the #2549 backfill scope) — big or ambiguous-but-decidable
work is exactly that, not a wall.

**How to apply:**
- A GOOD reason to pause/ask: genuinely UNBUILT foundations you can't conjure (#2587's L3 build-inspector,
  #2588's review-modal data + merge/bounce/take-over verbs), a real product/design decision the design-record
  reserves for a human, or a hard-to-reverse / outward-facing action.
- NOT a reason to stop: size (sz 8), a needed default (pick a sensible one), a cross-repo dance, "this is
  involved", or "the clean quick wins are done." Scope it, split off a first slice, decide the defaults, and
  build → sight → adversarial-review → land. Let sighting + review validate the calls, not a pre-emptive ask.
- If a real fork exists, surface it in ONE tight paragraph with a recommendation and keep moving on the
  recommended path unless redirected — don't stall. Inverse of [[never-take-an-unprepared-decision]] (don't
  *rule* without prep); this is about not *stalling on buildable work*.
