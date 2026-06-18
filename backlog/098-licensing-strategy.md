---
type: decision
workItem: story
size: 3
parent: "089"
status: resolved
codifiedIn: docs/agent/platform-decisions.md#monetization
dateOpened: "2026-06-06"
dateStarted: "2026-06-08"
dateResolved: "2026-06-08"
tags: [licensing, open-source, fair-source, source-available, business-model, apache, fsl, polyform, cla, monetization, constellation]
crossRef: { url: /backlog/097-roadmap-to-mvp/, label: "Roadmap to MVP (legal track)" }
---

# Licensing strategy — open standard, open reference impl, available platform, proprietary products

How the ecosystem is licensed so the **open / non-vendor-lock premise stays
literally true** while the commercial value is still protected. **Not being
resolved now and not critical for short-term progress** — the MVP tier-1 self-run
tools build on open primitives + a proprietary product layer regardless. But it
should be settled **before public launch / first sale**, and chosen *up front*
(greenfield) to avoid the open-washing backlash that hits projects which relicense
after building a community.

## The gradient (maps 1:1 onto the constellation)

The closer to the open standard, the more open; the closer to the managed product,
the more restricted:

| Layer | Repo | License tier | Concretely |
|---|---|---|---|
| Pure standard | **Web Everything** | maximally open | Apache-2.0 (spec text could be CC-BY). Protocols, intents, semantics, **conformance suite (`webcases`)** — the suite *must* stay open: it's the self-test/self-implement guarantee and the funnel. |
| Reference implementation | **Frontier UI** | open | Apache-2.0. An open reference impl makes the standard credible and learnable; it is not the threat. Adapters live here → adapters stay open (good for interop/adoption). |
| Platform | **Plateau** | "available" (fair source) | FSL or PolyForm Shield: free for all incl. enterprise internal use; only "don't fork into a competing platform" is restricted; auto-converts to Apache in ~2y. The operational leverage + enterprise-web-platform-manager value. |
| Products | **plateau-app + paid tools** | proprietary | EULA. The productized AI CLIs, hosted services, managed offerings. |

**Label honestly:** "open source (Apache)" for WE/FU; "fair source / source-available"
for Plateau — *not* "open source." Don't call the gated layer open.

## The bet being made (name it)

The moat is **not** the adapters or the implementation — those are open. The moat
is **the platform + the propose-and-verify products**. Adoption of the open
standard/impl is the funnel; Plateau is what you charge for. Keeping Frontier UI
fully open means someone *could* take WE+FU and build a rival platform — the bet is
that they won't out-operate you on Plateau. (Open question below: whether to add a
thin fair-source seam in FU as a hedge.)

## Consequence for code location

- **Leverage code belongs in/under Plateau** (available tier): MaaS *serve-time
  host*, the verification service ([#089](/backlog/089-monetization-product-ideas/)
  idea 1), the relationship graph ([#092](/backlog/092-provider-consumer-graph-platform-manager/)),
  the business-rule manager ([#093](/backlog/093-business-rule-manager-proof-of-compliance/)),
  productized AI CLIs ([#086](/backlog/086-mockup-to-standard-code-tool/)/[#094](/backlog/094-ai-upgrader-tools/)/[#095](/backlog/095-conformance-auto-fix-agent/)/[#096](/backlog/096-nl-to-technical-configurator/)),
  configurators-as-products.
- **Primitives stay open in WE/FU:** the `webadapters` transform core, the
  conformance suite.
- **MaaS splits cleanly:** open transform core (WE/FU) + available serve-time host
  (Plateau) — matches #081 already calling MaaS "a Plateau provider." The current
  WE-`blocks/renderers/module-service/` location is just the POC skeleton;
  productization moves the *host* to Plateau.
- **CLA** on Plateau (and on Frontier UI to keep relicensing optionality) before
  accepting outside contributions.

## Resolution (2026-06-08) — leans ratified as standing decision

The gradient (above) is the structure; these fill the four blanks. Ratified "for
now" — revisit only if a concrete pressure (first sale, a real FU-competitor,
contributor influx) contradicts a lean. None is short-term-critical; this just
removes the open forks so downstream work isn't blocked on legal ambiguity.

1. **Plateau license → FSL-1.1 with a 2-year Apache-2.0 conversion.** Encodes the
   exact "free for all incl. enterprise internal use; don't fork into a competing
   platform" intent out-of-the-box; the 2y auto-convert keeps "fair source, genuinely
   opens later" honest. PolyForm Shield rejected (no built-in conversion weakens the
   opens-later story); BSL rejected (custom Additional-Use-Grant = more rope, 4y too
   long for greenfield). Revisit → BSL only if per-feature custom grants ever needed.
2. **WE spec license → split: CC-BY-4.0 for prose + Apache-2.0 for code/schemas.**
   Mirrors WHATWG/W3C/OpenAPI; signals "real standard, copy the spec" while keeping
   the conformance suite + schemas under a patent-grant code license. Ships as a
   `LICENSE` + `LICENSE-DOCS` pair. Single-Apache rejected (reads as a company repo,
   not a standard).
3. **Frontier UI stays fully open — line drawn at Plateau.** No premium/exotic-adapter
   fair-source seam. The open reference impl *is* the credibility + adoption funnel;
   gating it undercuts the non-vendor-lock premise. A seam can be added later; a
   partly-gated launch can't be un-tainted. The bet remains: out-operate on Plateau,
   don't fence the adapters.
4. **Trademark/brand is the real enforcement lever.** Register the marks (Web
   Everything, Plateau, Frontier UI, webcases) + a trademark-use policy; gate a
   **conformance mark** on passing `webcases`. Anyone may fork the bits; nobody ships
   under the brand or claims "WE-conformant" without the mark. Coordinate with #097's
   brand-protection track.

### Also nailed down (were implied)

- **`webcases` conformance suite stays Apache-2.0 permanently — no conversion clause,
  never drifts toward Plateau's tier.** It's the self-implement guarantee and the
  funnel; it must stay maximally open for life.
- **CLA is a contribution *blocker*, not a defer.** Required on WE + FU + Plateau
  **before** accepting any external PR (cheap now, expensive retroactively). This is
  the one piece with a near-term trigger: the first outside contributor.

No new entity created — this is a strategy ruling kept as audit trail (no
`graduatedTo`). The CLA blocker is the only actionable spillover → captured as its
own item.
