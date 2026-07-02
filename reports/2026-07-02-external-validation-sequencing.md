# External-validation sequencing — prior-art survey + tree grounding (prep for #2089)

**Point:** How comparable open standards / framework projects sequence external validation (implementation
experience, pilot users) against scope widening — and where the WE constellation actually stands on each stage
of the review-recommended order (dogfood → gated deploy → pilot adopter → polyglot widening), grounded in the
real tree on 2026-07-02. Prep research for decision #2089; published as the
[/research/external-validation-sequencing](/research/external-validation-sequencing/) topic.

## Question

The 2026-07-01 external review (we:reports/2026-07-01-program-external-consultant-review.md:21) found the
sequencing drifted: *"polyglot generation (#463/#507) is ratified while zero external JS users exist and the
'we eat our own cooking' deck claim is aspirational"*, and recommended *"dogfood → gated deploy → one pilot
adopter with success criteria → only then the enterprise/polyglot story."* #2089 decides (1) the validation
order, (2) whether further polyglot build is hard-gated on the first external user, and (3) what the pilot's
success criteria concretely are.

## Tree grounding — what is actually true on 2026-07-02

The review ran 2026-07-01; two of its "not yet true" claims moved the same day, so the decision must rule over
the *current* state, not the review's snapshot:

- **Dogfood is now real-but-partial, not aspirational.** The SSR keystone #2016 is resolved with live code:
  the build-time component→HTML path exists (we:.eleventy.js:280 wires
  we:scripts/lib/component-render-build-hook.cjs; the render harness is
  fui:blocks/renderers/component-render/buildHarness.ts), the site chrome is migrated to FUI components
  (#865 resolved, #864 theme bundle resolved), and the home/index project grid renders SSR'd `we-card` tiles
  (#2019 resolved). Still open: the backlog index (#2018), governance cards (#2020), the detail-page sweep
  (#2021), page-level UI (#866), and the per-page ratchet (#867); the umbrella epic #777 is open. So "the site
  is dogfooded" is truthful for *chrome + one SSR surface* and false as a blanket claim.
- **The parity keystone shipped; zero parity targets are measured.** The manifest→ThemeSource loader (#2017)
  is resolved with real code + tests (fui:plugs/webtheme/manifestLoader.ts). But #1243 (shadcn reproduction)
  was formally superseded by #2022 after the 2026-07-01 reconciliation found it resolved-but-stubbed (zero
  rendered measurements); #2022–#2025 (shadcn / Material / harness / Fluent+Carbon) are all open. No external
  design system has been measurably reproduced.
- **The gated deploy is technology-ready and human-gated.** #1137 (splash + entry-code deploy) is open with a
  `humanGate: deploy` — the Cloudflare Pages artifacts are built (we:functions/_middleware.js implements the
  splash/cookie gate), the runbook exists (we:functions/README.md), analytics is decided (#1136 resolved).
  The residual is a credentialed human `wrangler pages deploy`. Epic #1104 (controlled rollout) is likewise
  `humanGate`d.
- **The polyglot mechanism is not hypothetical — its first increment is already built.** #463 was ratified
  2026-06-13 and codified
  (we:docs/agent/platform-decisions.md:1070 `#forward-generation-adapters`); the build epic #507 resolved
  2026-06-15 with all children resolved: the deterministic IR emit engine (#547), the first foreign
  native target — a .NET origin (#548, compile fix #661), the conformance gate through #506 (#549), and the
  adapter-dev regression corpus (#551). What remains *un-built* on the polyglot axis: additional language
  targets (Java/Go — never filed), the option-C emit-purpose IR widening (#1735 — `parked` under its own
  **ratified empirical trigger**, `#forward-emit-dedicated-ir`'s adoption signal, "not a backlog edge"), and the
  workbench polyglot live-test panel family (#912 epic, #967, #1030/#1031, #1761/#1762 — a validation
  *surface*, not new generation scope). So a gate can only govern the un-built widening; it cannot retroact.
- **Zero external users** is the review's assertion (we:reports/2026-07-01-program-external-consultant-review.md:11
  — "no external user, the site unshipped"); nothing in the tree contradicts it (the site has never deployed,
  #1104/#1137 open). No pilot-adopter item exists anywhere in we:backlog/ (grep 2026-07-02).

## Prior art — how standards bodies and platform projects gate widening on external evidence

The uniform pattern across every surveyed process: **an internal test suite is necessary but never sufficient;
graduation/widening requires independent implementation or operational experience.** WE currently has the
test-suite half at or above field norm (the #506 golden-vector conformance suite, the 2.5s standards gate,
2,003 unit tests) and the experience half at zero — exactly the review's "running open-loop."

| Precedent | The evidence gate | The WE analogue / delta |
|---|---|---|
| **TC39 process** | Stage 3 = "sent to implementers" for implementation experience; **Stage 4 requires ≥2 compatible shipped implementations + test262 tests + practical experience** before a proposal enters the standard | WE shipped the test262 analogue (#506 vectors) but advanced-and-built the polyglot widening with **zero** implementation-experience analogue — the inversion Stage 4 exists to forbid |
| **W3C Process / CSS WG** | CR exit criteria: "adequate implementation experience", customarily **two independent interoperable implementations** per feature, before Proposed Rec | The FUI impl is first-party; there is no independent second implementation or consumer of any WE standard |
| **IETF** | "Rough consensus and **running code**"; RFC 6410: Internet Standard requires "significant … implementations with **successful operational experience**" | The generated .NET origin passes the conformance suite (internal running code) but has never served an external operator |
| **Baseline (WebDX)** | A feature's status is an **evidence state derived from shipped availability** across engines, never a roadmap claim | The "we eat our own cooking" deck claim was roadmap-stated ahead of the evidence; the dogfood statute (`#first-party-dogfood`) is the internal Baseline analogue — claims must trail the tree |
| **semver 0.x norms** | "If your software is being used in production, it should probably already be 1.0.0" — production usage is the graduation trigger, and its absence the anti-claim | No WE/FUI package has a production consumer; polyglot enterprise reach is a post-1.0-shaped claim made at 0.x evidence |
| **Design-system pilot practice** (EightShapes/Curtis; Polaris, Lightning) | Pre-GA **pilot teams**: 1–3 real product teams, representative scope, a timed window, defined adoption + feedback success criteria; systems like Polaris were **extracted from a dogfooded product** before external release | The recommended pilot-adopter stage is the standard playbook; dogfood-before-external is the field norm, and pilots are *few, real, and criteria-bound* — never an open beta |
| **Kubernetes feature gates** | alpha → beta → GA graduation requires **real-world usage/feedback**, not just passing e2e; GA explicitly gates on production adoption evidence | The polyglot mechanism is "alpha shipped, conformance-green"; widening to more targets before any real-world usage is a beta→GA skip |
| **Rust stabilization** | Features ride nightly until **experience reports** from real users justify stabilization | The un-gate trigger shape: a named evidence artifact (the pilot retro) rather than a date |

**Synthesis → the fork-relevant deltas.** (1) Every process encodes the evidence gate **structurally** (a
stage machine, a CR exit test, a feature gate) — not as an advisory memo; advisory sequencing is exactly what
drifted in WE (#463 ratified + built in 48h while the dogfood epic sat gated). (2) The gate subject is always
**the next widening increment**, never the already-shipped one (test262/CR don't retract shipped engines).
(3) Pilot programs succeed when they are **singular and criteria-bound** — one real team, a timed window,
named adoption metrics and a written retro — and fail as open-ended "beta" invitations. (4) The dogfood norm
gates the **public claim**, not all internal progress: Polaris was extracted from the shipped admin, but
Shopify didn't halt admin work until extraction completed.

## Recommendation (feeds the #2089 forks)

*(Post-skeptic form — the prep skeptic landed five attacks; the recommendations below are the amended
survivors, matching the item.)*

- **Order:** a staged evidence ladder encoded as `blockedBy` edges — the gated deploy's bar is
  **claim-indexed, not inventory-indexed** (every externally visible dogfood claim true of the deployed
  artifact — met once a named **claims-truth audit** passes, sweeping the site *and* the resolved adopter
  deck #1214/#1360, which still carries the flagged claim); pilot recruitment is gated on the deploy being
  live; the **ungated** public stage is gated on the full dogfood ratchet (#867) + an audit re-run.
  Strict-serial "full dogfood before any deploy" is a stricter threshold on the same audience-indexed
  truthfulness axis, protecting an audience the splash gate already restricts; pilot-first burns the one
  high-cost external asset on an undeployed artifact.
- **Polyglot:** a **hard, prospective, per-target** gate — the codified rule is "every new target's start
  cites *current* external-adopter evidence" (the start-gate sibling of #463 fork (c)'s "the conformance
  suite gates every target's release"), **bootstrapped** by a `blockedBy` edge from the next widening item
  to the pilot-evidence story — never permanently satisfied by the first retro. Scope is a **predicate**
  (adds a new generation target/emit form), not an item list: maintenance of shipped artifacts
  (#547/#548/#549/#551, the #506 suite) and the #912 workbench family (consumes existing emit forms) stay
  ungated; **#1735 is exempt** — it already carries a ratified empirical trigger
  (we:docs/agent/platform-decisions.md `#forward-emit-dedicated-ir`, "not a backlog edge"), which composes
  with, and is not overridden by, this rule.
- **Pilot success criteria:** one external team, a real production-bound surface, ≥3 FUI blocks + ≥2 WE
  intents adopted, **plus ≥1 forward-generated artifact consumed** (a gen-wrapper wrapper or MaaS-served
  module — without this leg the retro produces no evidence about the forward-generation contract the
  polyglot gate turns on), a 6-week window, ≥5 filed issues or a written gap report, and a written retro
  with a continue/churn verdict — the retro artifact is the un-gate trigger; a failed pilot re-opens the
  decision rather than silently un-gating.

## Key findings

1. The review's two "not yet" premises (dogfood, parity keystone) partially landed the same day it ran; the
   decision must encode the order over the current tree, not re-litigate the snapshot.
2. The polyglot *mechanism* is already built through its first target; only the **widening** is gateable.
3. All eight surveyed processes gate widening on independent experience **structurally**; none rely on
   advisory sequencing; none retract shipped increments.
4. No pilot-adopter *story* exists in the backlog — the stage the review found missing is genuinely unfiled;
   but adopter-recruitment collateral (the deck, #1214/#1360, resolved) already ships the flagged
   "we eat our own cooking" claim, so recruitment must wait on a claims-truth audit.
5. The prep skeptic landed five attacks (instrument mismatch; a missed governing anchor
   `#forward-emit-dedicated-ir` already gating #1735 by a ratified empirical trigger; a false
   "advisory-already-failed" history; the one-shot-gate flaw in the #463 fork (c) analogy; the
   inventory-vs-claim contradiction in the deploy bar) — all folded into the item's amended defaults above.

## Files Created/Modified

- we:src/_data/researchTopics/external-validation-sequencing.json — the /research/ topic registry entry
- we:src/_includes/research-descriptions/external-validation-sequencing.njk — the topic write-up
- we:backlog/2089-external-validation-sequencing-pilot-adopter-before-the-poly.md — the prepared decision
