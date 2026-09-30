---
bornAs: x5hq3h1
kind: decision
status: resolved
dateOpened: "2026-09-30"
dateResolved: "2026-09-30"
relatedTo: ["3174", "4086"]
tags: [review-ledger, product-design]
---

# Choose the first multi-host review ledger adapter capability scope

Keep the ratified per-arc ports and choose product scope: GitHub-only identifiers, portable identities with GitHub first, or simultaneous GitLab and Bitbucket delivery. Recommend tenant and host-qualified opaque identities now, GitHub implementation first, and explicit capability refusals. Design: we:docs/agent/review-state-ledger-target.md.

## Decision to make

The architecture of the seam is already ruled: per-arc ports, operation-owned mutations and shared reads (we:docs/agent/platform-decisions.md#operations-declared-once-callers-generated). Decide the product's initial host coverage and identity scope; do not reopen a monolithic forge interface.

| Option | Benefit | Cost |
| --- | --- | --- |
| A. GitHub-shaped storage and GitHub only | Small initial mapping | Expensive identity/tenancy migration later |
| B. Portable tenant/connection/repository/change identity now, GitHub implementation first | Supports one company with several hosts without speculative provider implementations | Requires opaque IDs, aliases and explicit capabilities now |
| C. GitHub, GitLab and Bitbucket at launch | Immediate multiple-host coverage | Three live conformance/deployment efforts before the first spend reduction |

Recommend **B**. Include host-instance identity for enterprise/self-hosted connections; PR number and slug are display aliases. Do not equate companies with provider organizations. Unsupported capabilities refuse explicitly. Per-arc ports cover discovery, review projection, PR creation and land operations; no neutral mega-interface.

## Relationship to existing work

#3174 is resolved as a seam decision, not evidence of shipped GitLab/Bitbucket adapters. #4086 concerns daemon machines, a distinct meaning of multi-host. WE owns definitions/vectors, Frontier UI reusable adapters, Plateau connections/credentials and service policy. See we:docs/agent/review-state-ledger-target.md. A second provider gets its own evidence-backed implementation story when selected.

## Done when

Ratify initial provider coverage, tenant-qualified identity and required capability categories. Record portable conformance vectors for identical PR numbers across hosts, repo rename/transfer and unsupported head-conditional merge. Preserve the sole merge writer and live external checks; no provider support may be advertised from interface tests alone.

## Operator ruling (2026-09-30 ~9:15 AM ET)

**Ratified B:** GitHub only for now, behind a clean host-adapter boundary, with a small fake second host in the tests to keep the boundary honest. **"Facts derived from git"** (merges, commits, co-author trailers, conflict checks through git) is a standard capability every adapter gets. That is what keeps a second host cheap. GitLab or Bitbucket get built when a real customer needs them.
