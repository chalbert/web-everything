---
kind: epic
size: 13
parent: "2527"
status: open
priority: low
dateOpened: "2026-07-16"
tags: [plateau-loop, builder, saas, cost-control, governance]
---

# SaaS cost & build-control governance for the autonomous builder

**Deferred (2026-07-16, operator call).** The phase-1 supervised builder (#2530) gates on **human curation**
— the operator manually clears each item for build (`buildQueued`) and there is no cost cap (the current cost
counter is unreliable and may be dropped). That is the right envelope for a single operator building their own
backlog. To become a **multi-tenant SaaS product**, the builder needs a much larger cost + build-control
envelope. This epic **collects those requirements now** so they are trackable; it is **not** built yet —
`priority: low`, out of auto-select. Split into the child slices below via `/slice` when the SaaS build is
prioritized.

## Why deferred, not built
The near-term builder spends on the operator's own subscription and is gated by their own manual clearance —
no tenant boundaries, no billing, no cross-customer fairness to enforce. Every requirement below only bites
once there are *multiple paying tenants* whose spend and build access must be isolated and metered. Building
them now would be speculative; capturing them now keeps the eventual SaaS turn fast.

## Prospective slices (the 6 requirement areas — split these out when un-deferred)

1. **Per-tenant/account build budgets.** Spend + build-count quotas per customer, enforced *before* a build
   starts (a build that would exceed the tenant's remaining budget is refused, not started). Depends on (2).
2. **Reliable cost metering & attribution.** A trustworthy per-build cost record (the current counter is
   unreliable — replace it), attributed to tenant + item + run. The foundation the budgets, billing, and
   audit slices all read. *Blocks 1, 4, 6.*
3. **Build-approval workflow & roles.** Who may clear an item for the builder in a multi-user account — roles
   (owner/admin/member), an approval step, and delegation. Generalizes the single-operator `buildQueued`
   clear (#2530) into a permissioned, multi-user gate.
4. **Model-tier cost policy.** Per-plan model + allowance policy — which models a tenant may spend on, and the
   per-model cost ceiling — wired to the runner's per-spawn `--model` (the platform-config hook the #2444
   contract already exposes). Depends on (2).
5. **Circuit-breakers at scale.** Global + per-tenant kill-switches, rate/quota limits, and runaway detection
   (a tenant whose builds loop or error-storm is auto-paused). Extends the single kill-switch the phase-1
   endpoint ships with to a multi-tenant safety net.
6. **Audit & billing of autonomous builds.** A durable, queryable log of every autonomous run (who cleared it,
   what it built, its metered cost, its PR) for customer billing, dispute resolution, and review. Depends on
   (2).

## Acceptance (epic-level)
Split into the 6 slices above (or a refined set) with each a batchable, independently-deliverable story;
readiness/ordering of the split respects the `2 → {1,4,6}` dependency (metering first). No slice is built
under this epic until it is un-deferred and prioritized.
