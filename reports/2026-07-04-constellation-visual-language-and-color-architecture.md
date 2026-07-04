# Constellation visual language + brand-color architecture — prior-art survey

Session report grounding decisions **#2249** (system-wide visual language: flat-minimal vs
rich-dimensional) and **#2250** (WE mark system: multi-color umbrella vs strict monochrome), both
children of epic **#2256** and amendments to the prepared branding-system decision **#2209**. Published
as the `/research/` topic `constellation-visual-language-and-color-architecture`.

Companion to the earlier `we:reports/2026-07-03-constellation-branding-system.md` (the #2209 inventory).
Visual candidates render on the plateau app at `plateau:branding.html#journeys` and in
`plateau:branding-proposals/loop/` (probe SVGs). Exploration journal:
`plateau:branding-proposals/loop/LOOP-LOG.md`; handoff: `plateau:branding-proposals/TRANSITION.md`.

---

## Axis A — flat-minimal vs rich-dimensional (grounds #2249)

### The industry pendulum, with dates

- **2013** — iOS 7 (Ive) strips skeuomorphism; Material (2014) codifies flat-with-a-hint-of-shadow.
  The 2010s corporate logo "flattening" follows — gradients/depth dropped for bold single-color marks.
- **2016** — Instagram's gradient rebrand reintroduces dimensional color to a marquee mark; normalizes
  gradient identities.
- **~2020** — Neumorphism ("soft UI") spikes and **fails on accessibility**: the control *is* the
  background, so contrast is structurally below WCAG AA 4.5:1 and depth-only affordance is invisible to
  screen readers (Webflow; Axess Lab). This is the load-bearing cautionary tale.
- **2024** — Apple splits the app icon (iOS 18): light/dark/tinted variants; auto-generation works only
  "if the icon is simple enough… with clear contrast" (Sketch; Create with Swift).
- **2025** — Depth returns *officially*: Material 3 Expressive (Google I/O, May) adds blur depth +
  spatial elevation; Apple **Liquid Glass** (WWDC, June; iOS 26 / macOS Tahoe) reintroduces real-time
  lensing/specular highlights, "moving away from the flat design of iOS 7" (Apple Newsroom; Wikipedia).
- **2025–26** — Backlash tempers it: NN/g ("Liquid Glass Is Cracked") measures contrast as low as
  1.5:1 on busy backgrounds; iOS 26.1 adds a Clear/Tinted toggle + honors Reduce Transparency. Net
  consensus is **"skeuomorphic minimalism" — selective soft depth, not full skeuomorphism** (NN/g;
  Codexical; uiverse).

**Conflict flagged:** trend blogs say "flat design is dead"; usability research (NN/g) says the depth
revival is *measurably hurting* legibility even at Apple's scale. Both true at different altitudes —
fashion at the chrome layer, physics/a11y at the mark layer.

### By-size / by-medium tradeoffs (the decisive constraints)

- **Favicon (16px)** — icon guidance is blunt: at 16px use a solid-fill monogram, 1–3 colors, **avoid
  gradients (they muddy at small sizes)**, thick strokes (10Web; Premium Favicon). Inner-shadow/glass
  does not survive downscaling to a 16×16 grid.
- **Accessibility** — the neumorphism lesson generalizes; even Apple walked back transparency for
  legibility (NN/g).
- **Craft ceiling in hand-authored SVG** — a convincing glass effect needs stacked
  `feGaussianBlur` + `feDisplacementMap` + `feSpecularLighting` with almost no error feedback ("writing
  raw SVG filter code is hard" — CSS-Tricks; SVG Genie). It is a designer-plus-tooling job, not a
  team-of-one job. Flat marks are trivially hand-authorable.
- **Weight / theme-adaptability** — flat recolors instantly for light/dark at near-zero weight; a glass
  mark effectively needs the iOS-18-style per-theme variant set; backdrop/blur filters are
  GPU-intensive and hurt INP if overused.
- **Timelessness** — flat is no longer automatically "timeless" (reads slightly dated), but full
  3D/glass is the higher fad-risk given the live backlash.

### What the leaders do NOW

| Brand | Core mark today | Note |
|---|---|---|
| Apple (OS chrome) | Dimensional (Liquid Glass) | UI material, **not** the logo; already softened for contrast (26.1) |
| Apple (app icons) | Flat glyph + gradient ground | Light/dark/tinted variants required |
| Google / Material 3 Expressive | Restrained depth (blur, elevation) | Depth in motion/layering; flat components |
| Vercel, GitHub (Octicons), Linear | Flat | Minimal geometric / single-weight line |
| Stripe, Figma, Instagram | Flat + gradient/dual-tone | Gradient as brand color, **not** 3D depth |

Pattern: **leaders put depth in UI chrome + marketing, keep the core mark flat — often with a gradient
or dual-tone as the one concession to dimensionality, never inner-shadow/glass.**

### Recommendation (Axis A)

**Default flat-minimal for the marks**, with an optional *restrained* soft-light/subtle-shadow
treatment reserved for the **website + large app-icon** surfaces — not glass, not full 3D. The evidence
converges for a team-of-one hand-authoring SVG whose highest-frequency surface is a 16px favicon:
small-size physics rules out gradient-as-depth and glass; the SVG craft ceiling demands tooling we do
not have; flat recolors trivially across themes; and both depth revivals (neumorphism, Liquid Glass)
show depth-encoded meaning failing accessibility even at Apple/Google resource levels. Split the
decision **by surface**: flat marks (favicon-bound), restrained depth allowed on the website where size
permits. The `plateau:rich-a` probe (radial glow highlight + soft `feDropShadow` + edge-highlight
stroke — *not* full 3D) is exactly this restrained sweet spot, and is the version to apply *if* any
dimensionality is adopted.

**Strongest counter:** flat is now the *dated* look, and both platform owners we build inside (Apple,
Google) just bet their next decade on depth; a flat 2026 mark risks reading "2015 startup." Rebuttal:
that risk lives on website/large-icon surfaces (where restrained depth is cheap and applied), not on the
favicon, where 16px physics overrides fashion. (Note for #2249: the load-bearing case for flat *marks*
is best framed as brand-character fit — a standards layer reads *principled/bedrock/timeless*, where
glossy depth reads as consumer-product flashiness — with the 16px-physics + craft-ceiling arguments
demoted to a size-gating rule both branches honour; see the decision item.)

---

## Axis B — multi-color umbrella vs strict monochrome (grounds #2250)

### How real brand families handle master vs sub-brand color

| Brand | Parent color strategy | Children | Rule |
|---|---|---|---|
| **JetBrains** | Umbrella = 3-stop gradient square (orange→red→purple) spanning the family palette | Each product = its own 2-color gradient square from that palette | **Closest analog: parent = union of children's hues; child = a subset** |
| **NBCUniversal** | Polychrome 6-feather peacock; each feather historically = one division | Sub-networks vary | Explicit "collective contributions of the corporate family" — unity-of-divisions |
| **Google** | 4-color wordmark + 2015 4-color "G" (color order sequenced to aid eye movement) | Mostly single-form product icons | Parent = "full spectrum" / containment signal |
| **Adobe** | *Monochrome* single all-red corporate mark (2020) | Per-product colored tiles (color = category wayfinding) | **Inverse of the proposal — restrained parent, colorful children** |
| **Microsoft** | 4-color window = "diversity"/breadth | Products vary | Multicolor parent as breadth signal |

Two commonly-cited analogs (Adobe, Material/Google Cloud product icons) run the **opposite** rule —
restrained parent, color pushed *down* to products for wayfinding. But **JetBrains and NBC are direct
precedents** for "parent carries the union of the family's colors; children carry one." The proposed
pattern is **real and shipped — not a rationalization — just not the only convention.** Crucially,
JetBrains' umbrella is a *smooth multi-stop gradient*, not overlapping color regions — the precedent
authorizes a palette-spanning gradient, which the "one gradient" rule already permits.

### The Venn / union cliché & ownability

"Union of colors = we contain everything" is legitimate as *meaning* but dangerous as *form*.
Overlapping translucent circles are among the most worn stock-logo clichés — "Mastercard owns the
overlapping circles, and everyone else using them just looks like a subsidiary" (Inkbot). Fabrik's
ownability test: *"Would this logo work just as well for another company in our industry? If yes, you're
too generic."* Globes/circles are on the explicit generic list.

What separates an *ownable* union mark from generic overlapping circles is a **specific, asymmetric
structure the eye can memorize** — NBC's defined negative-space silhouette; JetBrains' bounded square
with a fixed gradient-stop sequence; Google's defined color order. A symmetric translucent 3-circle Venn
buys the *idea* of "everything" at the cost of the *ownership* of the mark — the worst trade.
Ehrenberg-Bass: distinctiveness (findable/recognizable), not symbolic differentiation, is what a mark
must buy.

**Confirmed against our own probes:** the current WE Venn candidates
(`plateau:branding-proposals/loop/we-venn-lumin.svg`, `plateau:branding-proposals/loop/weB-venn-constellation.svg`)
are built with `mix-blend-mode:screen` over translucent radial circles — i.e. exactly the muddy-blend +
floating-Venn form the prior art flags. `mix-blend-mode:screen` blends against everything underneath
(needs `isolation:isolate`) and still pushes overlaps toward white, muddying the "core" (MDN; Visual
Cinnamon). The reliable route is **hand-compositing** each overlap region as its own pre-blended path —
fiddly, brittle, multiplies path count, and fragile at 16px.

### Consistency: break the rule for the flagship?

The system's recognizability *is* its rule ("one gradient + one white glyph per project"). Breaking it
exactly once, for the parent, is coherent **only if the exception is itself rule-based** — a "Branded
House" where master and sub-brands share one visual identity with a legitimate variant (color count).
"Polychrome parent, monochrome children" *is* a legible hierarchy signal (JetBrains, NBC prove it) —
**provided the construction grammar is identical** (same glyph geometry, same gradient technique) and
only the color-count changes. If the parent also changes shape/technique it stops reading as "the union
of the family" and reads as an inconsistent one-off (The Drum; ebaqdesign).

### Recommendation (Axis B)

**Deliver the "everything unified" meaning within the one-gradient rule, via a constellation-spanning
multi-stop gradient — not a Venn.** A 3-stop gradient (indigo→cyan→violet) is still "one gradient," so
it does not break the rule, matches JetBrains' actual umbrella construction, downscales cleanly at 16px,
and stays compatible with #2209 Fork 2's mono-W favicon. The overlapping-color-region Venn — the form
the user's instinct reaches for — is the trap: it breaks the rule, fails the ownability cliché test,
renders muddy, and collides with #2209 Fork 2. Strict monochrome (WE's current single-hue gradient) is
the lower-risk fallback if the 3-stop span reads muddy/generic side-by-side.

**Strongest counter:** for a solo maintainer, strict monochrome is the safest — the rule is the
strongest asset, and the respected modern default is a restrained parent (Adobe/Material). Answered by
the multi-stop gradient staying *inside* the rule (it is not a rule break), giving WE a legible
umbrella-hierarchy read without the cliché or the execution risk of the Venn.

---

## Sources (load-bearing)

- NN/g, *Liquid Glass Is Cracked* — https://www.nngroup.com/articles/liquid-glass/
- Apple Newsroom, Liquid Glass — https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/
- Google, Material 3 Expressive — https://blog.google/products-and-platforms/platforms/android/material-3-expressive-android-wearos-launch/
- Sketch, iOS 18 tinted app icons — https://www.sketch.com/blog/tinted-app-icons/
- Webflow, *Neumorphism* — https://webflow.com/blog/neumorphism ; Axess Lab — https://axesslab.com/neumorphism/
- 10Web, 16px favicon guide — https://10web.io/blog/favicon-design/
- CSS-Tricks, realistic SVG glass — https://css-tricks.com/making-a-realistic-glass-effect-with-svg/
- Inkbot Design, logo clichés — https://inkbotdesign.com/logo-design-cliches/
- Fabrik, generic logos / ownability — https://fabrikbrands.com/branding-matters/logo-design/what-is-a-generic-logo-avoiding-overused-logo-designs/
- JetBrains brand assets — https://www.jetbrains.com/company/brand/
- NBC logo (family rationale) — https://en.wikipedia.org/wiki/NBC_logo
- Adobe, evolving brand identity (2020) — https://blog.adobe.com/en/publish/2020/05/28/evolving-our-brand-identity
- MDN, mix-blend-mode — https://developer.mozilla.org/en-US/docs/Web/CSS/mix-blend-mode
- ebaqdesign, brand architecture — https://www.ebaqdesign.com/blog/brand-architecture
