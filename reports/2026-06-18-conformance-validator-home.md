# Home for a generic WE-conformance / schema-validation service — prior-art survey for decision #895

> Prep research for decision **#895**, surfaced by #779 (2026-06-17). Implementers building
> WE-compatible libraries will eventually need a generic service to validate their schema/manifest
> against the WE contract. The artifact forks by risk: the conformance **vectors** (declarative
> input → expected-behavior data) are a WE artifact — data, can't "fail to deliver"; the runnable
> **validator** that loads them and checks a library is **not** WE (a buggy runnable tool reads as
> "WE is broken") and **not** FUI (it's generic across implementers, FUI is one). This report grounds
> *where the runnable validator lives* against how comparable web-standards conformance tooling is
> owned and distributed.

## The question, restated against the tree

The item filed two sub-calls cold: **(a)** vectors → a WE `@webeverything/…` data package, and
**(b)** validator owner = a Plateau-suite open-core offering vs an independent open devtool repo. The
constellation precedents are already settled enough to make (a) an invariant — a standards body owning
neutral conformance *data* is exactly WE's job ([#855](/backlog/855-decide-the-we-fui-wrapper-handoff-mechanism-for-the-polyglot/)
B2 ratified "WE owns the conformance vectors, not the codegen"; #506 golden-vectors; #779's documented
consequence). The web survey's job was therefore to ground sub-call (b): across real conformance
tooling, is the runnable validator typically (i) independent/community OSS, (ii) a vendor open-core
product (open CLI floor + paid hosted SaaS), or (iii) hosted by the standards body itself — and which
model best contains the reputational risk the user flagged?

## What the survey found

**Dominant pattern: a two-layer split nobody violates — the body owns the *vectors/suite* as neutral
data and ships them in its own repo; the *runnable validator is decoupled from the body*, almost always
as OSS.** Where a runnable tool does ship, the field splits into two live shapes, both anchored on a
*complete open floor*; a third shape (body-hosted) re-attaches validator bugs to the standard and is the
one to avoid for a young standard.

| Precedent | Suite/spec owner | Validator owner & model | Reputational-decoupling note |
|---|---|---|---|
| [W3C Web Platform Tests](https://github.com/web-platform-tests/wpt) | `web-platform-tests/wpt` — cross-vendor neutral Core Team, no single owner | Each vendor **runs WPT in its own harness**; [wpt.fyi](https://github.com/web-platform-tests/wpt.fyi) is a *separate neutral aggregator* | Runner is the implementer's own; shared asset is just data + a reference harness. A failure reads as "my engine vs the shared tests." |
| [TC39 test262](https://github.com/tc39/test262) | Ecma / TC39 — the body owns the suite | **No official runner**; Ecma gives "no preference" to any runner — volunteer harnesses per engine | Purest split: body ships *only* data, never a blessed runner. A runner bug is the runner's. |
| [Nu Html Checker / validator.nu](https://validator.w3.org/nu/) | HTML spec = WHATWG/W3C | **Open-source code, hosted free by W3C** — the standards-body-hosted model | Body wears the validator's bugs by design; tolerable only because HTML is mature + the checker is one canonical, self-hostable artifact. **The model to avoid here.** |
| [JSON Schema](https://github.com/json-schema-org/JSON-Schema-Test-Suite) | `json-schema-org/JSON-Schema-Test-Suite` — spec org owns vectors | **Fully independent community OSS** ([Ajv](https://ajv.js.org/) + dozens); body ships *no* runner | Textbook decoupling. Ajv's bugs are Ajv's; the suite is the neutral benchmark all implementations measure against. |
| [Spectral (Stoplight)](https://stoplight.io/open-source/spectral) | OpenAPI spec = OAI; rulesets community-authored | **Vendor open-core:** Apache-2.0 CLI + JS API (complete, standalone) + hosted Stoplight platform | Direct analog of the "Plateau open-core" option. Works *because the CLI is a real floor* (runs with zero account); SaaS is convenience, not a gate. |
| [ESLint / Stylelint](https://nordicapis.com/8-openapi-linters/) | The "spec" (rules) is the tool's own | **Independent OSS**; commercial/hosted layers built *on top* by third parties | Tool is the floor; monetization is strictly additive and external. |
| [OpenAPI validators](https://tools.openapis.org/categories/description-validators.html) | Spec = OpenAPI Initiative | **Entirely third-party**: Spectral, IBM, Redocly, Vacuum, Zally… Initiative ships *no* official validator | Body owns the spec, stays out of validators; a market of independent + open-core validators competes. |
| [axe-core / Deque](https://www.deque.com/axe/axe-core/) | A11y rules derive from WCAG; axe rules are Deque's | **Vendor open-core:** MPL-2.0 engine (free, powers Lighthouse) + commercial [axe DevTools Pro / Monitor](https://www.deque.com/axe/devtools/) | Open *engine* is the reputational anchor (everyone embeds it); paid tier is reporting/workflow on top. |

## Synthesis

1. **Sub-call (a) is a forced invariant, not a fork.** Every precedent that owns conformance keeps the
   *vectors/suite* as neutral data in the body's own repo (test262, JSON-Schema, WPT). That is exactly
   WE's lane and reconfirms #855 B2 / #506. Vectors → a separate `@webeverything/…` data package.

2. **The runnable validator must be decoupled from WE — structurally, not just by npm scope.** The user's
   concern (a buggy runnable tool reads as "WE is broken") is the same risk the survey names: the
   standards-body-hosted model (Nu Html Checker) re-attaches validator bugs to the body and is safe only
   for a mature, single-canonical-artifact spec. So **WE-hosted is excluded.** FUI is excluded too — the
   validator is generic across *all* implementers, FUI is one (a #475-style "impl capability is a Plateau
   service, not pinned to one implementer" reading).

3. **Among the surviving homes, vendor open-core is the precedent-validated default for a young standard —
   conditioned on two structural firewall invariants.** Pure independent/community OSS (JSON-Schema/Ajv,
   OpenAPI) is the *strongest* reputational decoupling but presumes a community materializes to build a
   runner — which a pre-community standard won't get, leaving vectors with no runner. Vendor open-core
   (Spectral, axe-core) *guarantees a runner exists* without re-coupling reputation to the standard, **iff**
   (i) the open CLI is a complete standalone conformance floor (the Spectral/axe-core test: it runs with
   zero account/license; the SaaS adds hosting/reporting/collaboration only), and (ii) the vectors stay in
   the standards-body repo as the neutral SoT, so the validator is "a tool that reads the body's data,"
   never "the body's tool."

## Bottom line

**Recommended: the runnable validator is a Plateau-suite open-core offering — a complete open-source CLI
floor with an optional hosted Plateau service — while WE owns the conformance vectors as a separate
`@webeverything/…` data package. Confidence ~75%.** This matches the precedent shape that both guarantees a
runner exists for a young standard and keeps the reputational firewall intact, and it aligns with the
constellation's product layering (#091 served-product → plateau-app; #475 impl capability = Plateau service
WE consumes) and the open-core monetization model (#089–#093, #398), with the free/paid line drawn on the
*cost/hosting* axis (free local CLI vs hosted service), never on an open-vs-proprietary axis.

**Residual / counter-case (~25%):** the *purest* reputational decoupling is plain independent OSS with no
vendor at all. The specific risk to open-core in a single-constellation setup (WE↔Plateau): if Plateau is
perceived as the de-facto owner of the WE standard, the "independent tool reading neutral data" framing
weakens and a validator bug can still splash onto WE despite the formal split. The mitigation is exactly
the two invariants above — keep the CLI permissively-licensed, self-hostable, and forkable, and keep
vectors in the WE repo — applied *structurally*. If a genuine multi-implementer community ever forms, an
independent neutral-governance repo becomes the correct override; for a solo-dev pre-community standard,
"independent" today means *unowned* (no maintainer, no monetization), which is why open-core is the floor.

**Sources:** [WPT](https://github.com/web-platform-tests/wpt) · [wpt.fyi](https://github.com/web-platform-tests/wpt.fyi) · [WPT history (Bocoup)](https://www.bocoup.com/blog/wpt-an-overview-and-history) · [test262](https://github.com/tc39/test262) · [test262 CONTRIBUTING](https://github.com/tc39/test262/blob/main/CONTRIBUTING.md) · [Nu Html Checker (W3C)](https://validator.w3.org/nu/) · [About Nu](https://validator.github.io/validator/site/nu-about.html) · [JSON Schema Test Suite](https://github.com/json-schema-org/JSON-Schema-Test-Suite) · [Ajv](https://ajv.js.org/) · [Spectral](https://stoplight.io/open-source/spectral) · [Spectral GitHub](https://github.com/stoplightio/spectral) · [axe-core](https://www.deque.com/axe/axe-core/) · [axe DevTools](https://www.deque.com/axe/devtools/) · [OpenAPI validators](https://tools.openapis.org/categories/description-validators.html) · [openapi.tools](https://openapi.tools/) · [Nordic APIs: OpenAPI linters](https://nordicapis.com/8-openapi-linters/)
