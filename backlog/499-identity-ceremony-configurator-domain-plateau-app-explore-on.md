---
kind: decision
status: resolved
blockedBy: []
relatedReport: reports/2026-06-22-identity-ceremony-authoring.md
dateOpened: "2026-06-13"
dateStarted: "2026-06-23"
dateResolved: "2026-06-23"
graduatedTo: "intent:credential-enrollment"
codifiedIn: "docs/agent/platform-decisions.md#intents-ux-only"
preparedDate: "2026-06-23"
tags: [webidentity, configurator, passkey, fedcm, authoring, research-gated]
---

# Identity ceremony Configurator domain (plateau-app) — explore on real authoring need

**RESOLVED (2026-06-23).** The prior-art survey this item was gated on
([report](../reports/2026-06-22-identity-ceremony-authoring.md), [`research topic`](/research/identity-ceremony-authoring/))
answered the shape questions, but its original recommendation — *hold the `plateau:` Configurator domain on a
concrete-consumer trigger* — was **rejected on review**: this is a private project with structurally **zero**
external consumers, so a consumer-trigger hold means *never*, which is the retired demand-gate, not a merit
call (judge-on-pure-merit; soft-deferred parks retired). Re-judged on
**pure merit** ("useful to a dev anywhere?"), the decision splits cleanly along the **UX-intent ↔
technical-config collaboration** the enrollment moment forces:

1. **The technical-axes Configurator domain is dissolved as redundant.** The policy slots
   (`userVerification`, `residentKey`, `authenticatorAttachment`, `attestation`, `timeout`) already ride the
   `CustomCredentialProvider` registry + #483 config-flavors. A `plateau:` domain re-homing them is genuine
   duplication of a `we:`-layer concept into a product surface — a cross-layer coupling against
   bias-toward-separation. The collaboration lives in **the intent referencing the config as a constraint**,
   not a product-layer veneer.
2. **The free UX layer is authored now as a standard intent** — the merit-go work. Enrollment (`create()`)
   has genuine authorial choices the ceremony does *not* determine, uncovered until now: when to prompt
   (`moment`), whether the user may defer (`skippability`), the motivational `tone`, and the `surface`. This
   shipped as the **[`credential-enrollment`](/intents/credential-enrollment/) intent**
   ([we:src/_data/intents/credential-enrollment.json](../src/_data/intents/credential-enrollment.json)) — the
   `create()` counterpart to the existing [`web-identity`](/intents/web-identity/) (`get()` / sign-in) intent,
   composing Loader + Feedback + web-identity. Confidence: **High**.

The author-facing axes are the policy slots of `PublicKeyCredentialCreationOptions` — `userVerification`,
`residentKey`/discoverable, `authenticatorAttachment`, `attestation` (enterprise tier only) — plus FedCM's
`mediation`; everything else is branding (`rp.name`/icon) or impl (`challenge`/`user.id`, the provider's
job). Adding a `plateau:` Technical Configurator domain is mechanically *one seed module + one provider
entry*: a `Domain` literal at `plateau:src/technical-configurator/seed-file-upload.ts:265-271` (axes
`{id,label,question,policy,values[]}` at `plateau:src/technical-configurator/seed-file-upload.ts:20-97`;
strategies' `capabilities: Record<axisId,valueId>` at `plateau:src/technical-configurator/seed-file-upload.ts:99-263`)
plus one import + array element in the `DOMAINS` registry at `plateau:src/technical-configurator/provider.ts:26-48`,
behind the `CapabilityProvider` seam at `plateau:src/technical-configurator/types.ts:82-85`. The technical
defaults these axes encode already ride the `CustomCredentialProvider` registry + config-flavors ruled by
#483 (`we:src/_data/protocols/credential-management.json`) — so a Configurator domain is a *decision-aid
veneer over the same axes*, never new machinery. The one identity surface WE ships,
`we:demos/webidentity-conformance-demo.ts`, hardcodes its own `DemoCredentialProvider` and asks no author to
tune anything.

### Recommended path at a glance

| Fork | Ruling (2026-06-23) | Why | Confidence |
|---|---|---|---|
| **1 · identity Configurator domain** | **dissolve the technical-axes domain; author the free UX layer as the `credential-enrollment` intent** | demand-gate "hold" rejected (zero-consumer private project ⇒ never); merit splits tech-axes (already on the registry) from free UX choice (uncovered ⇒ author it) | **High** |

> The original prepared analysis below (Fork 1 options a/b/c, framed around the *consumer-trigger hold*) is
> kept as the decision trail. Its (b) "hold" recommendation was **superseded** by the ruling above: the hold
> was a demand-gate, not a merit disposition, so the call was re-made on pure merit.

## Fork 1 — add the identity-ceremony Configurator domain now, hold on a consumer trigger, or dissolve

**Fork-existence:** genuine — there are three coherent end-states (a live `plateau:` domain, a held option,
or no domain at all with the registry+flavors carrying everything), and the survey doesn't make any of them
*wrong*, only ranks them; so this is a real merit call, not a prioritization tell.

**Crux:** does a non-coding author have a real need to tune passkey/FedCM enrollment *policy* without
writing a plug, and does that need exist *yet*? The axes are known and policy-shaped (survey Q1/Q2); the
home is a clean instance of the existing pattern (`plateau:src/technical-configurator/provider.ts:26-48`,
survey Q3); the standard-layer defaults already live on the `CustomCredentialProvider` registry +
config-flavors (`we:src/_data/protocols/credential-management.json`, #483). The only open variable is the
*consumer* (survey Q4) — and the constellation sweep finds none.

- **(a) Add the identity-ceremony domain to the `plateau:` Technical Configurator now** — seed the six
  author-facing axes (`userVerification`, `residentKey`, `authenticatorAttachment`, `attestation`,
  `mediation`, `timeout`) as a `Domain`, credential families as strategies. *Merit against:* ships a
  product-layer surface with **no author who can reach it** — it couples a `plateau:` Configurator concept to
  a standard-layer seam with zero pull, duplicating axes the registry + config-flavors already carry. That
  cuts against bias-toward-separation (build the second home only when a consumer forces it) and
  constellation-layering (don't pull a `we:` concept into a `plateau:` product with no consuming author).
  *Rejected for now* — a cross-layer coupling violation, not wrong-in-principle.
- **(b — recommended) Hold the domain on a concrete-consumer trigger.** Keep the option explicitly alive;
  do not build. *Merit for:* the survey de-risked the build (axes + shape + clean-instance all settled) so
  the eventual work is a ~1-day seed task, while the absence of a consumer means building now adds a
  reachable-by-nobody surface. This is the honest *specifiable-but-no-demand* disposition: ratify the
  end-state shape, defer the materialization to the trigger. **Un-park trigger:** the first flagship /
  exercise-app flow that needs an author to tune passkey/FedCM enrollment policy *without* writing a plug.
- **(c) Dissolve** — declare no identity Configurator domain will ever be built; the
  `CustomCredentialProvider` registry + config-flavors are the permanent authoring story. *Merit against:*
  the survey proves a clean, cheap domain is buildable the moment a consumer appears, so a hard dissolve
  discards real, now-cheap design work for no benefit over (b). *Rejected* — (b) keeps the same "nothing
  ships now" outcome without throwing away the prepared design.

**Default: (b) hold on a concrete-consumer trigger.** It is the most-flexible end-state: it costs nothing
now, preserves the cheap-build path, and binds the eventual build to a real author need rather than a guess.

*Skeptic:* "Hold is just deferral dressed up — and deferral is prioritization, not a merit fork." Tested
against the data: the fork is genuinely about *which end-state is correct on merit* (live domain vs no
domain vs preserved-option), and (a) is rejected on a **merit** ground — a `plateau:`→`we:` cross-layer
coupling violation against bias-toward-separation — not on effort/timing. The survey's Q4 (no consumer) is the load-bearing
*merit* fact: a Configurator domain whose entire value is *helping an author choose* is mis-built when there
is no author choosing. So the recommendation is a merit ruling on end-state, with the materialization
honestly gated on the trigger — not a cost dodge. Residual the skeptic is right to flag: if the un-park
trigger never fires, (b) and (c) converge in practice — but (b) loses nothing by keeping the prepared design
on the shelf.

## Context

Exploratory placeholder carved from #496 Fork 3 (the credential-acquisition build-design decision), which
ratified omitting a Configurator domain from the #483 build — technical defaults ride the
`CustomCredentialProvider` registry + config-flavors — and captured this as the non-blocking
explore-on-real-need item per the requester. The credential-acquisition *protocol* and the `webidentity`
*project* are their own resolved subjects (#483, graduated to `project:webidentity`); this item is
specifically the **authoring** seam — how a non-coder configures an enrollment ceremony. The survey that
brought this fork to readiness is recorded in
[`we:reports/2026-06-22-identity-ceremony-authoring.md`](../reports/2026-06-22-identity-ceremony-authoring.md)
and the [`identity-ceremony-authoring`](/research/identity-ceremony-authoring/) topic.
