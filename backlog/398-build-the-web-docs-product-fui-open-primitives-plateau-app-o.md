---
kind: epic
parent: "089"
status: resolved
dateOpened: "2026-06-12"
dateResolved: "2026-06-15"
graduatedTo: none
tags: [monetization, webdocs, plateau, frontier-ui, open-core, conformance, product-build]
relatedProject: webdocs
relatedReport: reports/2026-06-12-backlog-split-analysis.md
crossRef: { url: /backlog/091-web-docs-as-a-service-plateau/, label: "Web Docs ruling (#091)" }
---

# Build the Web Docs product — FUI open primitives + plateau-app open-core service

> **Reclassified `story` → `epic` (2026-06-12).** Mis-filed as a batchable story·8; the body itself
> spans three repos and three deliverables (FUI primitives + ingestion adapters; plateau-app served
> site + per-customer conformance report; open-core tiering). That's a multi-deliverable constellation
> build, not one agent-ready slice.
>
> **Sliced 2026-06-12** (`/slice 398`, [report](../reports/2026-06-12-backlog-split-analysis.md)) into
> four buildable child stories + one decision: **#424** FUI `webdocs` generator impl · **#425** FUI
> self-host Web Docs UI primitives (the cancel-and-self-host floor) · **#426** FUI incumbent-ingestion
> adapters (Storybook/Mintlify → `webcases` pivot, blocked on #424) · **#427** plateau-app served site +
> per-customer conformance report (open-core free tier, blocked on #424+#425). The open-core *tiering
> mechanics* could not be sliced as a build — it buries an unresolved fork — so it's tracked as decision
> **#428** under #089. #424 and #425 are independent FUI roots, workable in parallel now.

Build the Web Docs product per the #091 ruling, decomposed across the constellation: FUI ships enough free, composable primitives to assemble a self-hostable Web Docs UI (the 'cancel and self-host always holds' floor) plus the incumbent-ingestion adapters (Storybook/Mintlify -> webcases pivot); plateau-app hosts the complete tested served site + per-customer conformance/coverage report, monetized open-core (free tier -> paid by usage). Consumes the existing webdocs standard (WE), reuses the /protocols/+capabilityMatrix pattern. Gates #336 (dev-guide migration) which needs the product, not just the decision.
