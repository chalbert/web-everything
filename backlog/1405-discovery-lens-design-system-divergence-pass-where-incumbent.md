---
kind: story
size: 3
parent: "1399"
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: none
tags: [discovery, lens, divergence, meta, gap, book-candidate]
---

# Discovery lens — design-system divergence pass (where incumbents disagree)

Run the [discovery](/backlog/1399-latent-standard-discovery-lens-catalogue-each-lens-only-emit/)
discipline as a **meta-pass over the component data** the /gap-sweep already collects — but inverted. Where
design systems all solve a concern the *same* way, it's a candidate for native/Baseline. Where they
**disagree** (different APIs, models, names for the same job), that divergence marks an *un-abstracted
concern* — a strong candidate for a WE **intent** that abstracts the variants into one contract (the WE
move: standardize the concern, not the variant). Diff the divergence set against
[we:src/_data/intents/](../src/_data/intents/); every un-owned divergence → a card (placement-unsure →
`decision`).

## Do

- From the gap-sweep benchmark data, list concerns where ≥3 systems diverge in model/API.
- For each: does a WE intent already abstract it? covered / partial / ❌.
- File a `book-candidate` card per ❌ framing the divergence as the abstraction opportunity.

## Run 1 — 2026-06-21 (divergence meta-pass over the benchmark corpus)

Enumerated the concerns where ≥3 corpus systems
([we:reports/2026-06-12-benchmark-corpus.md](../reports/2026-06-12-benchmark-corpus.md): Material/Carbon/
Fluent/Spectrum/Polaris/Radix/React-Aria/MUI/Ant/Chakra/Shoelace/…) **diverge in model/API** for the same
job, then asked: does a WE intent already abstract it? The WE thesis *is* "standardize the concern, not the
variant," so most high-divergence axes are exactly what an intent already abstracts.

| Divergent concern (how systems disagree) | WE abstraction | Verdict |
|---|---|---|
| **Theming / design tokens** (Material token system vs Chakra theme-object vs Tailwind config vs CSS vars vs Carbon themes) | **webtheme** project (+ `density`, `typography`) | covered |
| **Color / dark mode** (class vs media-query vs data-attr vs context) | **webtheme** (color-mode) | covered |
| **Severity / tone / variant** (Material color-roles vs Chakra colorScheme vs Ant type vs Bootstrap variant) | the **unified severity/tone vocabulary** shared across `feedback`/`message`/`validation` + `action` levels (#1337 refines destructive) | covered |
| **Overlay layering / stacking** (Portal vs Layer vs z-index scale vs top-layer) | `surface` (z-depth) + `modal` (stacking) + `focus-containment` (trap/inert/return) + the `popover` capability | covered (distributed) |
| **Form validation** (Formik/RHF/native/zod, error-display models) | `validation` intent | covered |
| **Responsive / breakpoints** (responsive props vs utility classes vs container queries) | `breakpoint` intent | covered |
| **Motion / transitions** (Framer Motion vs CSS vs Material motion tokens vs Spring) | `motion` + `animation-orchestration` | covered |
| **Icon system** (icon font vs SVG sprite vs component-per-icon vs name prop) | `icon` + `expressive-symbol` | covered |
| **Density / sizing scale** (size props vs density tokens) | `density` intent | covered |
| **Drag & drop** (native HTML5 DnD vs dnd-kit vs react-dnd vs pragmatic-dnd) | `reorder` + `data-transfer` (+ #007) + `#1384` (2-D) | covered / filed |
| **Composition / polymorphism** (Radix `asChild` vs MUI slots vs polymorphic `as` vs render-props) | native `<slot>` + the `component` compile-time path — WE deliberately does **not** re-abstract a platform primitive (#1377 author-in-standard-form) | dismissed (by stance) |

**Conclusion:** 0 new cards. Every ≥3-system divergence maps to an existing abstracting intent/project (or
is deliberately left to a native primitive). This is the expected result — the divergence-abstraction move
is WE's founding thesis, so the corpus's disagreements were already the seed for today's intents. The one
non-covered axis (composition/polymorphism) is an intentional non-goal (native slots own it), dismissed with
reason rather than filed. Re-run when the benchmark corpus gains a source on a genuinely new axis.

## Done when

The divergence set is enumerated, each item verdicted against the intent registry, and each gap is a filed
card or dismissed-with-reason.
**Round 1 complete (2026-06-21) — 0 new cards (every divergence already abstracted; composition dismissed by stance).**
