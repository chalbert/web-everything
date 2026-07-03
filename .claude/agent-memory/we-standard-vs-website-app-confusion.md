---
name: ""
metadata: 
  node_type: memory
  originSessionId: adc21aa1-f33e-4dd2-9560-692c59c6c343
---

The name "WE" (Web Everything) conflates two distinct things that live in the same repo:
1. **WE-the-standard** — the zero-impl authority: definitions, meta-schemas, validate scripts, the
   intent catalog, pure resolver logic (the `[[6. WE Holds ZERO Standard Implementation]]` line).
2. **WE-the-website** — a full 11ty **app** that merely *renders* WE content and carries its own
   build impl (e.g. `we:scripts/lib/intents-loader.cjs`, `we:src/_data/intents.js` glob-and-consume
   the catalog to render docs; the backlog renderer; `functions/`).

Because they sit indistinguishable under one name/repo, **placement forks keep inheriting the
ambiguity** — #1913's unresolved "FUI/product" and #1948's substrate-home fork were both symptoms.

**Why:** the user flagged this while ratifying #1948 — "there is often confusion; WE the website is
in fact a full app, it just happens to render WE content." Precedent already treats the website as a
product frontend, not WE/FUI (the `#identity-semantic-look-composable` statute: product components
"live in the product's own frontend (e.g. the WE website), not WE/FUI").

**How to apply:** when a placement question says "WE," disambiguate *which* WE first — standard
(zero-impl → the thing being defined) vs website-app (a product that consumes the standard, whose
build impl is app code, not standard authority). A reusable impl of a WE standard → FUI; app-unique
impl → the product (incl. the WE website). **#2006 RATIFIED it (2026-07-01):** the WE-website is a
mis-homed *product* — end-state = extract to its own product-tier surface (gated on #872), interim =
a `site/**` directory boundary + a fail-closed standard-vs-site classifier gate. The naming convention
now lives in `we:AGENTS.md` ("WE" = standard; "WE website / WE-docs" = product surface) and the statute
amends constellation rule 1. The test is **product-vs-render, not impl-vs-contract** — which is why FUI
gets the same question (#2053, FUI holds runtime so rule-1 zero-impl doesn't transfer). Related:
[[propose-standard-in-platform-shape]], [[internal-spelling-not-the-proposed-standard]].
