---
kind: epic
status: open
dateOpened: "2026-06-16"
tags: []
---

# Rendered-site regression tooling — unified harness over the live docs site (a11y + content + visual)

Umbrella for guarding the RENDERED docs site (not source/unit level) against regressions, run as one harness rather than scattered specs. check:standards skips the 11ty build, so loader→template wiring bugs render silently green; the surface a human reads is only spot-checked. Consolidates the slices: a11y gating (#763/#770, shipped), content correctness (#796, e.g. tier badges match the loader), and a later visual-regression slice. The end-state home — WE specs vs a plateau-hosted service the WE CI calls — is the open call in #799; build slices portably until it resolves, each asserting the rendered surface against a stable extractable contract.
