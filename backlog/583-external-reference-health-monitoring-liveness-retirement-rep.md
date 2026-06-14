---
type: idea
workItem: epic
status: open
dateOpened: "2026-06-14"
relatedProject: webdocs
tags: [monitoring, references, liveness, retirement, currency, freshness, link-rot, constellation, plateau-saas]
---

# External reference health monitoring (liveness, retirement, replacement) — dogfood → platform setting → Plateau service

The project cites hundreds of external references — corpus `docsUrl`s, report and `/research/` citations,
`crossRef` URLs, adapter/protocol spec links — and nothing detects when one dies, moves, or drifts. Two
adjacent systems miss this: [#099](/backlog/099-evergreen-app-vision/) /
[#101](/backlog/101-auto-update-pipeline/) / [#558](/backlog/558-auto-update-pre-merge-orchestrator-engine-driver-frontier-ui/)
keep the app's deps current (code currency), and
[#192](/backlog/192-longitudinal-research-freshness-system/) keeps research topics fresh by **calendar
age** (not liveness). This epic is the missing **third family: reference health** — the liveness and
provenance of the external sources the project *cites*. Seeded by
[#546](/backlog/546-corpus-source-fast-has-a-dead-docsurl-fast-docs-decommission/)'s corpus `retired`
convention (FAST docs decommissioned, caught only by tripping over a 404).

## Why this is a distinct system (not foldable into #099 or #192)

| Family | What it keeps current | Mechanism | Item |
|---|---|---|---|
| Dependency/standard currency | the running app's deps & platform standards | Renovate-style auto-update, codemods, gated merge | #099 / #101 / #558 |
| Research content freshness | research topics | calendar age (`lastReviewed` / `reviewHorizon`), supersedes chains | #192 (resolved) |
| **Reference health (this epic)** | **external references the project cites** | **active liveness sweep + classification + remediation** | **#583** |

A reference can be **fresh by date but dead by link** (the `fast` case: recently checked, yet 404) — which
is exactly why #192's age-timer cannot catch it.

## Constellation layering (mirrors #099 → #558, per the managed-offering constellation-layering ruling #091)

The same three-layer decomposition the auto-update cluster already uses — no new runner philosophy, reuse
the **policy-declaration-vs-swappable-runner** protocol shape #101 ratified:

1. **Dogfood in webdocs (now).** A self-run sweep over *this* repo's references; results feed the backlog
   the way #192's new-axis sweep does. This is where #584/#585 land.
2. **Platform-strategy setting (WE standard).** A project declares its reference-health policy as a
   committed, swappable-runner protocol: gate-strict vs advisory, archive-on-cite on/off, review horizons,
   replacement-N thresholds. Surfaces in the Technical Configurator. WE stays protocol-only (no-leakage).
3. **Plateau SaaS offering (later).** Managed reference/link-health monitoring — crawl, alert, dashboard.
   Bound by the Plateau linear-cost-with-revenue rule: an owned on-device crawler is fixed-cost; heavy/BYO
   crawling is a tier, not the floor.

## Candidate slices (brainstorm — un-carved; carve as they become ready)

Two are already carved as children (#584, #585). The rest are captured here for later:

1. **General retirement convention** → **#584** (carved). Generalize #546's `retired` shape beyond the corpus.
2. **Active liveness sweep** → **#585** (carved). Fetch every reference; don't wait to trip over a 404.
3. **Multi-modal classification** (folded into #585's scope): retirement isn't binary — `404` gone ·
   `301/302` moved→repoint · archived/frozen (Wayback) · **content-drift** (URL alive but no longer says
   what we cited — the silent killer) · paywall/auth · **superseded-by-newer-canonical** (FAST→Fluent).
4. **Remediation routing.** Each class → an action (repoint / snapshot-pin / retire+reason / supersede /
   re-research) that *spawns a backlog item*. Bridges detection (#585) → convention (#584).
5. **Archive-on-cite.** Proactively pin a snapshot when citing a volatile source so provenance survives
   the URL's death (the rejected #546 Fork-1-B path, done right: at citation time, not retroactively).
6. **Axis-vacancy alerting.** When a retirement drops a corpus category below N live sources, flag "find a
   replacement" (feeds the backlog like #192's new-axis sweep). #546 does this check *manually* today.
7. **Reference-registry substrate.** One index of "external references this project depends on" (corpus
   `docsUrl`s + report/`/research/` citations + `crossRef`s + adapter/protocol spec links). The foundation
   #585 stands on — likely the first slice to build.
8. **Cadence / trigger.** On-demand / scheduled / pre-merge gate — reuse #101/#558's orchestrator
   philosophy, don't build a new runner.
9. **Platform-strategy setting.** Layer 2 above — the configurable policy as a protocol.
10. **Plateau SaaS offering.** Layer 3 above — managed monitoring as a service.

## Relations

- **Seeded by** [#546](/backlog/546-corpus-source-fast-has-a-dead-docsurl-fast-docs-decommission/) — the
  corpus `retired` shape this epic generalizes.
- **Sibling of** [#192](/backlog/192-longitudinal-research-freshness-system/) (research-content freshness)
  and the [#099](/backlog/099-evergreen-app-vision/) auto-update cluster (dependency currency); reuses
  their patterns, covers a gap neither does.
