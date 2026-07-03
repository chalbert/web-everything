---
name: declared-over-auto-derived-format
description: "Prefer author-declared formats over clever auto-derivation (fragile on edge cases); keep the derivation as a recommended convention / house style, never an enforced rule."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 2f08ed8f-7eb9-4c12-b5d2-9912dc9f8158
---

When a format/close/name/id *could* be produced by a clever mechanical rule (e.g. "reverse-mirror the open
delimiter to get the close"), prefer **author-declared** over auto-derived. A deriver that must disambiguate one part
from another (base delimiter vs sigil, prefix vs body) is fragile and breaks on real cases — the surveyed template
grammars themselves falsify naive reverse-mirror (`<%=`↔`%>`, `@{`↔`}`, `@if`↔`@endif`). Keep the elegant derivation
as a **recommended convention**, optionally adopted as a house style for our *own* artifacts, but never as an
enforced/authoritative rule imposed on users.

**Why:** auto-derivation looks like it removes a burden ("never memorize the close") but silently forecloses real
grammars and surprises authors. Declared is safe and unsurprising, and the convention still captures the
readability/consistency win wherever it actually applies. The user's framing: *"automatic close format is a recipe
for problems."*

**How to apply:** in any standard/API design, whenever tempted to *compute* a field from another, ask "can the
deriver be fooled by an edge case it can't reliably disambiguate?" If yes → declare it explicitly, and offer the
derivation as a convention (and maybe a WE house style), not a mandate. Surfaced in #2074 Fork 3 (custom-node close
grammar). Relates to [[impl-details-are-not-forks]] (declare the observable; keep mechanism out) and
[[propose-standard-in-platform-shape]].
