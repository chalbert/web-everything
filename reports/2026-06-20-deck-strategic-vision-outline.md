# Strategic / vision deck — slide-by-slide outline

> Backlog: #1212 (parent epic #1209). The investor / partner / self-alignment deck. **Content only** —
> rendering is the dogfood epic #1210. This outline *selects and re-orders* the shared spine
> ([we:reports/2026-06-20-deck-narrative-spine.md](2026-06-20-deck-narrative-spine.md)); it never
> re-derives the thesis or a proof number. Beat IDs (B1–B7) and proof IDs (P-*) resolve there.
>
> **Audience profile (spine §4):** lead beat **B4** (the constellation); spend most on
> **B1 → B2 → B4** (the hole → the reframe → the constellation + open-core); **de-emphasize B3
> internals**; headline proofs **P-CONST, P-MONETIZE, P-SCALE**; the ask is **partner / fund / align**.

---

## Arc at a glance

`Open (B4 cold) → B1 hole → B2 reframe → B3 (compressed) → B4 constellation → B4 open-core → B5 it's real → B6 dogfood → B7 reach → Ask`

The strategic deck leads with the *business shape* (B4) as a one-line cold open, earns it by going back
to the hole (B1) and the reframe (B2), then lands the full constellation + monetization (B4) as the
center of gravity. B3 internals collapse to a single "how it's built" slide — this room buys the
*model*, not the API.

---

## Slides

### 1 — Cold open (B4 teaser)
- **Line:** *"Three repos, one bet: standardize the contract, not the code."*
- **On slide:** the constellation diagram, unlabeled — WE → Frontier UI → plateau-app, three boxes,
  three jobs. No detail yet; it's the shape we'll earn.
- **Proof:** none yet (it's the hook). Sets up B4 as the destination.

### 2 — The hole (B1)
- **Claim:** the web standardized documents, then layout/component primitives — but never the
  *application* layer. So every team rebuilds and re-locks the same ~80 widgets.
- **Proof:** **P-GAP** (the hole is measurable — a re-runnable competitive gap sweep), **P-SCALE**
  (the surface that *should* be standard: 80 blocks · 57 intents · 33 protocols).
- **Strategic framing:** this is a *recurring industry tax*, not a tooling gripe — every design system
  re-pays it. That's the market.

### 3 — The reframe (B2)
- **Claim:** stop shipping components; standardize the **contract** a component must satisfy. Code is
  disposable, the contract is the asset.
- **Proof:** **P-LOCK** (the only lock-in is an escapable protocol), **P-NATIVE** (native-first
  defaults, libraries are opt-in).
- **The differentiator line:** *escapable protocol vs. proprietary component lock-in* — this is the
  moat slide; say it explicitly.

### 4 — How it's built (B3, compressed)
- **Claim:** the contract surface is layered and coherent — intents → blocks → plugs → adapters →
  protocols — not a grab-bag.
- **Proof:** **P-SURFACE** (each layer a first-class entity with its own catalog).
- **Depth:** ONE slide only. Name the five layers, one line each; defer internals to the developer
  deck (#1213). Strategic room needs to know it's *systematic*, not how a directive resolves.

### 5 — The constellation (B4 — lead beat, full)
- **Claim:** three repos, three jobs — **WE** = the standard (`@webeverything`, never imports FUI),
  **Frontier UI** = a conforming implementation (`@frontierui`), **plateau-app** = the hosted product.
  Clean seams; npm scope mirrors the layer.
- **Proof:** **P-CONST** (headline). The diagram from slide 1, now labeled.
- **Why it matters here:** clean layer seams are what make the open-core split *enforceable*, not just
  aspirational — the architecture and the business model are the same boundary.

### 6 — Open-core by layer (B4 — the monetization slide)
- **Claim:** open = free (the standard + a conforming impl); paid = hosting/license at the product
  layer. Disciplined: **cost must scale ~linearly with revenue** — no uncapped per-call cost inside
  flat pricing; the line is drawn on a *structural* property (hosted / credential-holding), never an
  open-vs-proprietary distinction.
- **Proof:** **P-MONETIZE** (headline), **P-CONST** (the layer line *is* the pricing line).
- **Strategic note:** this is the slide the room scrutinizes. The linear-cost discipline is the answer
  to "how does this not become a money-losing SaaS" — lead with it, don't bury it.

### 7 — It's real (B5)
- **Claim:** not a manifesto — a working corpus with a ratification record.
- **Proof:** **P-SCALE** (40 projects · 80 blocks · 57 intents · 33 protocols · 21 capabilities · 197
  glossary terms), **P-STATUTE** (25 cite-able platform statutes + ~1200 tracked design items),
  **P-RESEARCH** (138 published research topics), **P-DEMOS** (120 live demos).
- **One slide, dense:** the census numbers as a maturity wall. Liveness note (spine §3) — re-pull the
  census before showing.

### 8 — The proof is self-applied (B6 — the dogfood moment)
- **Claim:** the WE site, and *this very deck*, render on FUI components conforming to WE contracts.
  Conformance is observable, not asserted.
- **Proof:** **P-DOGFOOD** (#777 site-on-FUI + #1210 deck-on-stack), **P-CONFORM** (`check:standards`
  + the `deck` conformance-vector set #1195).
- **Show, don't state:** the live B6 moment is the deck running on the stack — a gesture, not a bullet.

### 9 — The reach (B7)
- **Claim:** contracts are runtime-agnostic, so the standard reaches beyond JS — into .NET/Java/Go via
  forward adapters — and ingests incumbents via reverse adapters.
- **Proof:** **P-POLYGLOT** (forward/generation adapters, ratified #463), **P-ADAPT** (reverse adapters
  normalize incumbents; lossiness is the value signal).
- **Strategic framing:** TAM widener — the bet isn't a JS library's market, it's the whole front-end
  surface across runtimes.

### 10 — The ask (B7 close)
- **Audience-specific ask:** **partner / fund / align.** What we want from this room: a partnership, an
  investment, or strategic alignment behind a contracts-first web platform.
- **On slide:** the one-breath thesis as the closer — *"We standardize the contract, not the code. The
  contract is the only lock-in, and it's an escapable one."*

---

## Selection deltas vs. the full spine arc

- **Promotes** B4 to the lead (cold open + two full slides 5–6) — the constellation + open-core is the
  strategic center of gravity.
- **Compresses** B3 to a single slide (4) — internals belong to the developer deck (#1213).
- **Keeps** B5/B6/B7 as proof-of-realness + reach, in spine order.
- **Headline proofs** P-CONST / P-MONETIZE / P-SCALE carry slides 5–7; P-LOCK carries the moat (slide 3).

## Status

Outline delivered against the spine (#1211). Slide *rendering* is epic #1210; this is the content
selection + ordering for the strategic audience. Numbers are spine-§3 references — re-pull the live
census (spine liveness note) before the deck is shown.
