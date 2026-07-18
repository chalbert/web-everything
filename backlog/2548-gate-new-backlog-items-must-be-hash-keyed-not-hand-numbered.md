---
bornAs: xxhnbew
kind: story
size: 3
status: open
dateOpened: "2026-07-18"
tags: []
---

# Gate: new backlog items must be hash-keyed, not hand-numbered

A new backlog file added in an unlanded lane must carry a hash id (xNNNNNN), never a bare NNN — the drain assigns the real number at land (#2288). check:standards accepts NNN because it is valid for LANDED items; that hole let a hand-numbered batch (#558) collide with a concurrent session and trigger the collision-heal that blanked files. Add a deterministic pre-merge check that flags a new/unlanded backlog file with an NNN id as an error, so hand-numbering is a loud failure not a silent collision. Hookable per the hookable-vs-judgment rule.
