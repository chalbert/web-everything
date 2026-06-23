---
kind: decision
parent: "142"
status: open
locus: plateau-app
dateOpened: "2026-06-23"
preparedDate: "2026-06-23"
relatedTo: ["1643"]
crossRef: { url: /backlog/141-dev-browser-vision/, label: "#141 dev browser — natural home surface" }
tags: [dev-browser, permissions, identity, ai-generated, validation, decision]
---

# Permission and identity simulator

## Digest

This validates an AI-generated candidate from the [#142 pool](/backlog/142-ai-generated-dev-experience-feature-candidates/): a dev-browser control that previews the live app as any role or permission set — flip the current identity to "anonymous", "viewer", "admin", a custom claim set — and watch the app re-render under that identity's *declared* permission contract. The difference from impersonation tooling: the roles and permissions offered come from the app's **declared webpermissions / webidentity contracts**, not a hand-curated impersonation list. The decision is a one-sided go / no / not-yet validation gate, not a merit fork.

**Recommended verdict: not-yet — accept the candidate, gate the build on the webpermissions/webidentity substrate. Confidence: Medium.** The declared-contract delta is real, but without webpermissions (#009) / webidentity (#012) shipping there are no declared roles to enumerate, and it degrades to a generic "view as user" toggle.

## What you're deciding

Whether Web Everything commits to a **permission / identity simulator** as a dev-browser feature, and on what trigger. Concretely the panel would:

- **Enumerate the app's declared roles and permission scopes** from the webpermissions (#009) contract, and the identity shapes from webidentity (#012).
- **Assume any identity / permission set live** — re-render the running app as that identity, with every permission-gated element, route, and action reflecting the assumed scope.
- **Surface what changed** — which components/affordances appeared or disappeared under this identity vs. the current one, so authorization gaps (a control visible to a role that shouldn't have it) surface in-app.

## Why this isn't a classic fork (and is still a decision)

There is no contested either/or — no rival "build shape A vs shape B" where one branch is flawed (the *fork-existence* test). It is a **one-sided validation gate** on an AI-generated idea: commit, defer-on-trigger, or drop. Per the user directive that is still a `decision` card resolving to a **go / no / not-yet verdict**. The genuine sub-question is the **trigger** (does it ride the permissions/identity contracts), handled below.

## Context & prior-art delta

The category exists; the delta is *driven by declared permission/identity contracts* vs. an impersonation feature:

| Prior art | What it shares | What it lacks (the WE delta) |
|---|---|---|
| **LaunchDarkly / feature-flag impersonation** | Override the targeting context to preview as another user | Flags only — not the app's *declared* permission scopes; no model of what each scope gates |
| **Salesforce / admin "view as user"** | See the app exactly as another user/role | Platform-specific, server-driven impersonation; not a portable, declared-contract-driven dev-browser flip |
| **RBAC test fixtures** | Exercise role-gated behavior in tests | Hand-built per test; not a live in-app identity flip, no in-context diff of what changed |
| **Auth0 / OIDC dev tokens** | Mint a token with chosen claims for local testing | Manual token assembly; no enumeration of the app's declared roles, no rendered diff |

The moat (per #142): a WE app **declares** its roles, scopes and identity shapes (webpermissions / webidentity), so the simulator enumerates the *real* roles and shows precisely which declared-gated affordances flip — impersonation tools assume an identity but can't tell you what each scope is *declared* to gate, nor diff the rendered surface against the contract.

## Dependencies & lineage

- **Rides webpermissions + webidentity.** The roles/scopes it enumerates are the [webpermissions (#009)](/backlog/009-gap-13-webpermissions-project/) contract; the identity shapes are [webidentity (#012)](/backlog/012-gap-5-webidentity-project/). It cannot enumerate declared roles before those contracts exist — the natural trigger.
- **Role axis is shared with [#1643](/backlog/1643-variant-simulator-for-locale-flag-role-viewport-motion/)** (variant simulator) — the variant simulator's "role" axis *is* this simulator's core. Implement the role/identity flip once here and have #1643 compose it, rather than two role-flippers.
- **Home:** `locus: plateau-app` — a dev-browser feature ([#141](/backlog/141-dev-browser-vision/)), local-first / zero-server per the cost-flat monetization rule.

## Recommendation

- **Verdict: not-yet (accept-and-gate), Confidence Medium.** The candidate is real and on-moat (clean delta vs. impersonation tools), so don't drop it — but its advantage is enumerating declared roles/scopes, which depend on webpermissions/webidentity that don't yet ship.
- **Un-gate trigger (concrete):** promote to a build story when the **webpermissions (#009) contract has shipped** (declared roles/scopes to enumerate) AND a flagship exercise-app declares a real role model with permission-gated affordances. webidentity (#012) deepens the identity axis but the permission scope alone unblocks a useful v1.
- **Skeptic:** "Every platform already has 'view as user' impersonation — this is solved." *Refuted on the delta, not on novelty:* impersonation assumes an identity but is blind to *what each scope is declared to gate*; this enumerates the declared roles and diffs the rendered surface against the permission contract, surfacing authorization gaps in-app — which impersonation structurally can't, lacking the declared model. The residual the skeptic is right about is **timing** — absent the contracts it really is just impersonation — hence not-yet, not no.

*If you'd rather decide go now or no (drop the candidate), say so — the verdict is the thing on the table.*
