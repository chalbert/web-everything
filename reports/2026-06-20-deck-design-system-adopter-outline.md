# Design-system / enterprise-adopter deck — slide-by-slide outline

> Backlog: #1214 (parent epic #1209). The deck for design-system teams and enterprise adopters —
> competitive gap coverage, dogfood proof, and adapter-based migration off incumbents. **Content
> only** — rendering is the dogfood epic #1210. This outline *selects and re-orders* the shared spine
> ([we:reports/2026-06-20-deck-narrative-spine.md](2026-06-20-deck-narrative-spine.md)); it never
> re-derives the thesis or a proof number. Beat IDs (B1–B7) and proof IDs (P-*) resolve there.
>
> **Audience profile (spine §4):** lead beat **B1** (the hole); spend most on
> **B1 → B5 → B6 → B7** (the hole → it's real → dogfood → migration); **de-emphasize B2 philosophy**;
> headline proofs **P-GAP, P-DOGFOOD, P-ADAPT, P-DEMOS**; the ask is **migrate / pilot**.

---

## Arc at a glance

`B1 the hole → B1 the tax → B3 (one slide) → B5 it's real → B6 dogfood → B6 conformance → B7 migration → B7 reach → Ask`

The adopter deck leads with *their* pain (B1 — you re-build and re-lock the same widgets) and quickly
gets concrete: it's real (B5), we eat our own cooking (B6), and here's the off-ramp from your
incumbent (B7 reverse adapters). B2 philosophy is compressed — this room is evaluating *risk and
migration cost*, not buying a manifesto.

---

## Slides

### 1 — The hole, in their terms (B1)
- **Claim:** the web never standardized the application layer, so every design system (yours included)
  re-implements and re-locks the same ~80 widgets — and you maintain that forever.
- **Proof:** **P-GAP** (the hole is measurable — a re-runnable competitive gap sweep benchmarks the
  leading design systems and reports what's missing).
- **Adopter framing:** this is *your* maintenance bill, not an abstract gap.

### 2 — The recurring tax (B1 — the cost case)
- **Claim:** the cost isn't building widgets once — it's re-building, re-testing, and re-locking them on
  every framework migration and every design-system version bump.
- **Proof:** **P-GAP** (the gap sweep shows the breadth you'd otherwise own), **P-SCALE** (80 blocks ·
  57 intents · 33 protocols — the surface you're maintaining alone).
- **Why here:** the enterprise room buys on TCO and lock-in risk; quantify both up front.

### 3 — What WE is (B3, compressed)
- **Claim:** WE standardizes the *contract* a component must satisfy across five layers (intents →
  blocks → plugs → adapters → protocols) — implementations compete, your app outlives them.
- **Proof:** **P-SURFACE** (layered, first-class catalogs), **P-LOCK** (the only lock is an escapable
  protocol).
- **Depth:** one slide. Adopters need the *shape* and the lock-in answer; the layer internals are the
  developer deck (#1213).

### 4 — It's real, not a manifesto (B5)
- **Claim:** a working corpus with a governing decision record — you're not betting on a README.
- **Proof:** **P-SCALE** (40 projects · 80 blocks · 57 intents · 33 protocols · 21 capabilities · 197
  glossary terms), **P-STATUTE** (25 cite-able platform statutes + ~1200 tracked design items with a
  ratification workflow), **P-RESEARCH** (138 published research topics — grounded in cross-framework +
  native-platform surveys), **P-DEMOS** (120 live demos).
- **Risk-reduction slide:** maturity + governance = adoptable, not a science project.

### 5 — We eat our own cooking (B6 — dogfood)
- **Claim:** the WE site, and *this very deck*, render on FUI components conforming to WE contracts.
- **Proof:** **P-DOGFOOD** (the site-on-FUI dogfood epic #777 + this deck #1210), **P-DEMOS**.
- **Show, don't state:** the live moment — the deck running on the stack it's selling.

### 6 — Conformance you can audit (B6 — conformance)
- **Claim:** "does this conform?" is a mechanical test — a standards gate plus named conformance-vector
  sets — so an enterprise can *verify* a vendor's impl, not trust a checkbox.
- **Proof:** **P-CONFORM** (`check:standards` + the `deck` a11y/reduced-motion vector set #1195).
- **Adopter value:** procurement-grade — conformance is observable evidence, the thing your review board
  actually wants.

### 7 — The off-ramp: reverse adapters (B7 — migration, the lead payoff)
- **Claim:** you don't rip-and-replace. Reverse adapters ingest your existing design system bottom-up
  into a lossy internal pivot — and the *lossiness itself* is the report of where you diverge from the
  contract.
- **Proof:** **P-ADAPT** (headline — adapter-as-normalization-hub, lossiness = comparative-value
  signal).
- **Migration framing:** incremental, measurable, reversible — the lowest-risk adoption path on the
  slide.

### 8 — Reach across your stack (B7 — forward)
- **Claim:** contracts are runtime-agnostic — forward/generation adapters reach .NET/Java/Go, so a
  mixed-stack enterprise gets one contract surface across all of it.
- **Proof:** **P-POLYGLOT** (ratified #463, deterministic generation + conformance gate).
- **Enterprise hook:** one standard for a polyglot org, not one library per runtime.

### 9 — The ask (B7 close)
- **Audience-specific ask:** **migrate / pilot.** Start a bounded pilot — run a reverse adapter over one
  of your component families, measure the gap, adopt incrementally.
- **On slide:** close on the durability line — *your app outlives every implementation*, restated as
  the enterprise value: contracts are the asset, vendors are swappable.

---

## Selection deltas vs. the full spine arc

- **Promotes** B1 to a two-slide lead (the hole + the recurring tax) — the adopter room buys on
  TCO/lock-in risk, so quantify the pain first.
- **Centers** B7 migration (slides 7–8) as the payoff — reverse adapters are *the* differentiator for
  someone who already has a design system.
- **Compresses** B3 to one slide and **demotes** B2 philosophy (it's the developer deck's spine) — keep
  the room on risk + migration, not ideology.
- **Headline proofs** P-GAP (slides 1–2), P-DOGFOOD (slide 5), P-ADAPT (slide 7), P-DEMOS (slides 4–5).

## Status

Outline delivered against the spine (#1211); this closes the per-audience deck trio (#1212 strategic,
#1213 developer, #1214 design-system) — all three branch from one spine, one story to three rooms.
Slide *rendering* is epic #1210; this is the content selection + ordering for the adopter audience.
Numbers are spine-§3 references — re-pull the live census (spine liveness note) before the deck is shown.
