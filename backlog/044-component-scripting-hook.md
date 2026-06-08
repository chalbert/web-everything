---
type: decision
workItem: story
size: 3
parent: "049"
status: resolved
dateOpened: '2026-06-03'
dateResolved: '2026-06-08'
tags:
  - webcomponents
  - component
  - security
relatedReport: reports/2026-06-03-declarative-component-element.md
relatedProject: webcomponents
crossRef: { url: /blocks/component/, label: Component block }
---

# DC-5 — Decide the scripting / enhancement hook

Can a declarative component be enhanced with script, and how (WICG #1009's core question)? Current recommendation: declarative-only in tier 1; a tier-2 `behavior`/`extends` attribute associates a *registered* class or trait for progressive enhancement — no inline `<script>` inside the definition. This answers the enhancement need without the script-gadget XSS surface that a parsed inline `<script>` would open. Alternative held open: allow an inline `<script>` in the definition for full power, accepting the security review burden.

**Ratified 2026-06-08 — recommendation adopted.** Declarative-only in tier-1. A tier-2 `behavior`/`extends` attribute associates a *registered* class or trait for progressive enhancement — no inline `<script>` inside the definition, keeping the script-gadget XSS surface closed.
