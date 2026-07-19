---
name: "WE standards need a reviewed decision — no app business logic, no minting on the side"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 5135d7fd-82cd-4a09-af89-eeca10510a48
---

**WE contains only primitives shared across many apps, reviewed as general — never a single app's
business logic.** The plateau launch-review console's 37-state *card taxonomy* (lanes, leases, drain,
scope-breach, policies) is plateau business logic → it lives in **plateau-app**, not WE. This sharpens
the `[[6. WE Holds ZERO Standard Implementation]]` line ("OK in WE: definitions + validate scripts"):
that permission is ONLY for shared primitives, not for app-specific definitions.

**The enforcement mechanism is a human-reviewed decision — and the human confirmed opening decisions is
free.** A WE mint / standard / intent / extension is legitimate **when it rode a decision the human
ratified** — that is why #2534 (scale-ruler), #2535 (progress track), #2536 (semantic-zoom), #2537
(swimlane), #2538 (visual-diff) and #2569 (contracts/backlog, from #2558 Ruling B) are fine, NOT
violations. The failure mode is placing app content in WE **by assumption with no decision** — the
#2553 taxonomy-to-WE mis-scope and the Phase-0 design-doc placement into `we:docs/design/` (my calls,
no decision).

**Why:** WE is the zero-impl standard layer every constellation repo consumes; unreviewed app-driven
content erodes the boundary and pushes one app's logic onto all consumers. The boundary was already in
memory (rule 6 / repo-constellation / native-first / plug=proposed-standard) — the miss was not
applying it. The user's words: "WE must contain only the primitive concepts shared across all/many
apps, cannot have business logic from a specific app"; "any new standard in WE needs approval"; "you
can always open a decision if you think it's warranted / red-teamed, it has no consequence."

**How to apply:** any "should this be a WE standard?" or "does this app content belong in WE?" question
→ **OPEN A DECISION** (prepare it: options + a bold default) and let the human rule. Opening a decision
has NO consequence, so err toward opening when warranted or red-teamed — do NOT silently mint on the
side, and do NOT silently assume WE placement. App work builds in its own repo (plateau / FUI); a WE
primitive is proposed, reviewed, then built. A pattern with only one consumer waits for a second to
prove it general (plug-when-proven).
