---
type: idea
workItem: story
size: 3
parent: "181"
blockedBy: ["097"]
status: open
dateOpened: "2026-06-08"
tags: [monetization, marketing, landing-page, pricing, webdocs, distribution, infrastructure]
relatedProject: webdocs
crossRef: { url: /backlog/091-web-docs-as-a-service-plateau/, label: "Web docs as a service (#091)" }
---

# Marketing landing + pricing site — the conversion surface

A landing + pricing page is the conversion surface for whichever product ships.
**Reuse webdocs** ([#091](/backlog/091-web-docs-as-a-service-plateau/)) rather than
building a bespoke site — and the **standard's own site is the top of funnel**
("the website IS the spec" doubles as content marketing; the tool is the
conversion).

Scope: a landing page that leads with the *propose-and-verify* demo (foreign/legacy
code → provably-conformant output — the hook), a pricing page wired to checkout
([#183](/backlog/183-payments-merchant-of-record/)), and a download/`npx` CTA.
Product-agnostic: the demo and copy swap per whichever candidate is the emerging
MVP ([#097](/backlog/097-roadmap-to-mvp/)).

## Note (2026-06-11)
Re-flagged as **blocked on #097**, not agent-ready. The landing copy and pricing
are explicitly *"per whichever candidate is the emerging MVP (#097)"*, and the
pricing page is *"wired to checkout (#183/#297)"* — and #297 is itself now blocked
on #097's pricing shape. With no MVP/product or pricing chosen, there is no concrete
conversion surface to author. Unblocks when #097 picks the MVP + pricing.
