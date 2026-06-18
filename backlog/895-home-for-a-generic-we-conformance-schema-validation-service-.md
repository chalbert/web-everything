---
type: decision
workItem: story
size: 3
status: open
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
preparedDate: "2026-06-18"
relatedReport: reports/2026-06-18-conformance-validator-home.md
relatedProject: webdocs
tags: [conformance, validator, monetization, open-core, plateau, boundary, decision]
---

# Home for a generic WE-conformance / schema-validation service (vectors vs runnable validator)

Surfaced in [#779](/backlog/779-temporal-trait-impl-locus-we-blocks-vs-frontierui-blocks/) (2026-06-17):
implementers building WE-compatible libraries will eventually need a generic service to validate their
schema/manifest against the WE contract. The artifact **forks by risk** — the declarative conformance
**vectors** are data (can't "fail to deliver"), the runnable **validator** is code that can slip and read as
"WE is broken." The prior-art survey ([research topic](/research/conformance-validator-home/),
[report](../reports/2026-06-18-conformance-validator-home.md)) collapses the two cold sub-calls to **a set of
forced invariants + one genuine fork**: the only open call is the runnable validator's *home*.

## Grounding digest

The survey covered how real web-standards conformance tooling is owned and distributed. The pattern is
**a two-layer split nobody violates**: the standards body owns the *vectors/suite* as neutral data in its own
repo (TC39 [test262](https://github.com/tc39/test262) — "no preference given by Ecma to any runner";
[JSON-Schema test suite](https://github.com/json-schema-org/JSON-Schema-Test-Suite);
[WPT](https://github.com/web-platform-tests/wpt)), and the *runnable validator is decoupled from the body*,
almost always OSS. Where a runnable tool ships, three shapes appear:

- **Independent/community OSS** ([Ajv](https://ajv.js.org/) for JSON-Schema; the
  [OpenAPI validator](https://tools.openapis.org/categories/description-validators.html) market) — strongest
  reputational decoupling, but presumes a community materializes to *build and maintain* the runner.
- **Vendor open-core** ([Spectral/Stoplight](https://stoplight.io/open-source/spectral),
  [axe-core/Deque](https://www.deque.com/axe/axe-core/)) — a complete open CLI/engine floor + an optional
  hosted SaaS. Keeps the firewall **iff** the OSS floor is a complete standalone check and the vectors stay in
  the body's repo.
- **Standards-body-hosted** ([Nu Html Checker / validator.nu](https://validator.w3.org/nu/)) — open code but a
  body-run instance; re-attaches the validator's bugs to the standard. Safe only for a mature,
  single-canonical-artifact spec. **The model to avoid for a young standard** — it restates the user's "not WE"
  concern from the survey side.

## The axis

The seam is *who owns the runnable validator*, not what conformance means. WE already owns conformance **data**
as its lane — this decision's vectors package is the same artifact kind as the #855-ratified wrapper
conformance vectors ([#891](/backlog/891-author-behavioral-wrapper-conformance-vectors-runner-cem-inp/) is
authoring those WE-owned) and the #506 golden-vectors model, and the #779 ruling already documented "vectors →
WE as a separate `@webeverything/…` data package (safe; a spec can't fail to deliver)". The runnable validator
is a *served capability* generic across all implementers — exactly the constellation's
[#475](/backlog/475-vision-is-a-plateau-service/) "impl capability is a Plateau service WE consumes, not
pinned to one implementer" reading, and the [#091](/backlog/091-managed-offering-constellation-layering/)
"served product → plateau-app, open-core by usage" layering. The only thing the survey leaves genuinely open
is whether that served capability lives in the Plateau suite (open-core) or stands as an independent
neutral-governance repo. The free/paid line, if Plateau, rides the **cost/hosting** axis (free local CLI vs
hosted service) per [#089](/backlog/089-monetization-product-ideas/)–#093/#398 — never an open-vs-proprietary
axis (`feedback_monetization_soft_accepted_revisitable`).

### Recommended path at a glance

| Element | Disposition | Confidence |
|---|---|---|
| Conformance **vectors** | **→ WE, as a separate `@webeverything/…` data package** (neutral SoT, in WE's repo) — *forced invariant* | High (~95%) |
| Validator is **WE-hosted** | **Excluded** (re-couples validator bugs to WE; the Nu-Html-Checker risk) — *forced invariant* | High (~90%) |
| Validator is **FUI** | **Excluded** (generic across implementers; FUI is one) — *forced invariant* | High (~90%) |
| Open CLI is a **complete standalone conformance floor** | **Required in either branch** (Spectral/axe-core test) — *forced invariant* | High (~90%) |
| **Validator home** (the one fork) | **Plateau-suite open-core** (free CLI floor + optional hosted service) | Med (~75%) |

### Supported by default (forced invariants — ratify, not decide)

These passed the standing test with **no coherent excluded branch**, so none is a `## Fork`:

1. **Conformance vectors → WE, as a separate `@webeverything/…` data package.** Declarative input→expected
   data; "a spec can't fail to deliver." Every precedent that owns conformance keeps the vectors as neutral
   body-owned data (test262, JSON-Schema, WPT). Same artifact kind as #891/#506. No coherent alternative
   (bundling vectors into the validator would forfeit the neutral-SoT firewall).
2. **The validator is not WE and not WE-hosted.** The user's reputational concern = the survey's
   standards-body-hosted (Nu) anti-pattern; a runnable tool that slips must not read as "WE is broken," and
   moving only the npm scope doesn't fix it (ownership carries the reputation).
3. **The validator is not FUI.** Generic across all implementers; FUI is one (#475 reading).
4. **The open CLI must be a complete, standalone conformance floor** (runs with zero account/license; any
   hosted tier adds hosting/reporting/collaboration only). This is the Spectral/axe-core invariant that keeps
   the reputational firewall intact in *either* fork branch — so it's not the thing being decided.

## Fork 1 — the runnable validator's home: Plateau-suite open-core vs independent open devtool repo

*Why it is a fork (case b — two coherent branches that genuinely cannot coexist as "the home"):* both
Plateau-suite-open-core and independent-OSS-repo are coherent, precedent-backed homes for the runnable
validator (the survey shows both shapes shipping in the wild), but the validator has exactly one canonical
home/owner — it can't simultaneously be a Plateau product and an independently-governed neutral repo. The
WE-hosted and FUI branches are *excluded* (invariants 2–3 above), which is what leaves these two as the real
either/or.

- **A — Plateau-suite open-core offering** *(recommended)*. The validator is a Plateau-owned product: a
  complete open-source CLI floor (free, self-hostable, forkable) with an optional hosted Plateau service
  (run-in-cloud, dashboards, history). *Pro:* guarantees a runner *exists and is maintained* for a young,
  solo-dev, pre-community standard; matches the constellation's served-product layering (#091) and
  impl-capability-is-a-Plateau-service rule (#475); gives a monetization path consistent with open-core
  (#089–#093/#398) on the cost/hosting axis; the open CLI floor keeps the reputational firewall (Spectral /
  axe-core precedent). *Con:* in a single-constellation setup, Plateau may be *perceived* as the de-facto WE
  owner, so a validator bug can still splash onto WE despite the formal split — mitigated, not eliminated, by
  invariants 1 & 4.
- **B — independent open devtool repo.** The validator stands as its own neutral-governance OSS project,
  unaffiliated with the Plateau product suite. *Pro:* the *purest* reputational decoupling — the JSON-Schema/
  Ajv and OpenAPI-validators pattern, maximally clear that it's "a tool that reads WE's data," never anyone's
  product. *Con:* presumes a community materializes to build and maintain it; for a solo-dev pre-community
  standard, "independent" today means *unowned* (no maintainer, no monetization, vectors left with no runner).

**Recommended default: A — Plateau-suite open-core (med, ~75%).** The decisive factor is the maintainer/
existence story: the survey's purest-decoupling option (B) only works once a community exists to own the
runner, which a pre-community standard does not have — so B risks shipping vectors with no validator at all.
A guarantees the runner exists and is maintained, while the *complete open CLI floor* + *vectors-in-WE-repo*
invariants deliver the same structural firewall the independent repo would, minus the unowned-orphan risk.
**The residual (~25%) is** the single-constellation perception risk — if Plateau reads as the de-facto WE
owner, a validator bug can splash onto WE despite the formal split. *Red-team seed for the decision turn:* the
strongest case for B is that the validator is generic across *all* implementers (not just Plateau's), so a
vendor home is a category error and an independent repo is the only home that's structurally neutral. The
default survives because (a) every successful open-core precedent (Spectral, axe-core) keeps the reputational
anchor on the *open floor*, not the vendor, and (b) a solo-dev standard cannot conjure an independent
maintainer community on demand — B's neutrality is theoretical until that community exists. **If a genuine
multi-implementer community forms, B becomes the correct override** — this is a
`feedback_monetization_soft_accepted_revisitable` placement: fix the structural firewall firmly, treat the
Plateau-vs-independent home as provisional and re-tune with data.

## Consequences (documented for the decision turn, NOT executed in prep)

On ratification of (A + invariants): file **(1)** a build item for the `@webeverything/…` conformance-vectors
data package (or fold into #891's vectors-package scope if that's where the first vectors land), and **(2)** a
Plateau-suite item to bootstrap the open-core validator CLI (complete standalone floor) + optional hosted
service. Neither is filed during prep — making the call is `/next decision`'s job.
