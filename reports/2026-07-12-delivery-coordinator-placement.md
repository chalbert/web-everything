# Delivery-coordinator placement — prior-art survey for Plateau Loop (#2446)

**Date**: 2026-07-12
**Point**: Where multi-repo delivery coordinators live in the wild — the survey grounding #2446's own-repo default.
**Research page**: `/research/delivery-coordinator-placement/`

---

## Question

Where should Plateau Loop — the resident coordinator extracting the constellation's delivery machinery
(lane pool, drain, PR landing, backlog CLI, supervised Claude agents, #2445) — physically live: a
plateau-app module, its own fourth repo, or the core of the Plateau product?

## Recommendation

**Banked, not ruled — the 2026-07-11 operator defer on #2446 is honored** (the phase-1 daemon starts
provisionally in plateau-app, without prejudice). The corpus supports two readings the eventual prep
must weigh: the end-state reading (every mature multi-repo coordinator sits in its own repo; no
surveyed coordinator lives inside a product repo it coordinates) favors own-repo; the dynamics reading
(Prow ran ~8 years inside a coordinated infra repo, splitting only on external adoption) favors staged
placement — provisional in-constellation start, own-repo graduation on a concrete trigger. Self-hosting
circularity is solved under both (deployed-instance/source split). An eventual own-repo ruling needs
explicit amendments to `#devtools-placement`, `#constellation-placement`, and
`#pool-siblings-real-built-clones`, and must reconcile #1747 (whole engine relocated *into*
plateau-app), not just #1565/#1579. The product-line framing is severable and deferred to the #554
trigger.

## Key Findings

- **Merge-queue lineage (bors → homu → rust-lang/bors; bors-ng):** own repos run as deployed services
  from birth; one instance serves many repos; the hosted homu.io variant died with its operator.
- **Kubernetes Prow:** born in the dedicated test-infra tooling monorepo (never the product repo); split
  to kubernetes-sigs/prow in April 2024, driven by external adoption + release-management pain.
- **Zuul:** spun out of openstack-infra as an independent project (May 2018) when outside orgs wanted it.
- **Productized coordinators (GitHub merge queue, Mergify, Graphite):** all born standalone — the
  product branch is real but is a business commitment, not a code-placement choice.
- **AI-agent fleet coordinators (Devin, OpenHands, dagger/container-use, claude-squad, vibe-kanban):**
  uniformly separate tools; state held outside target repos; zero in-repo examples.
- **Self-hosting:** bors-ng, Prow/Tide, and Zuul all land PRs into their own source repos — the running
  instance is decoupled from the source tree, so breakage surfaces at redeploy, not at land.
- **Version-lock dividing line:** repo-local tools dirs are for glue that versions with one repo; a
  coordinator spanning N repos structurally cannot version-lock with any of them.

## Files Created/Modified

| File | Action |
|---|---|
| `we:src/_data/researchTopics/delivery-coordinator-placement.json` | created — registry entry |
| `we:src/_includes/research-descriptions/delivery-coordinator-placement.njk` | created — write-up |
| `we:backlog/2446-where-does-plateau-loop-live-plateau-app-module-own-repo-or-.md` | rewritten to prepared-fork shape |
| `we:reports/2026-07-12-delivery-coordinator-placement.md` | this report |
