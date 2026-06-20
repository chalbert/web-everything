# Reproduction-conformance — prior-art survey for the #1225 program charter

**Date:** 2026-06-20 · **For:** [#1225](/backlog/1225-program-charter-reproduction-conformance-incumbent-design-sy/)
(decision, `preparing`) · **Research topic:** [/research/reproduction-conformance/](/research/reproduction-conformance/)

## The question

The program proposes rebuilding the top design systems (shadcn, Material, Ant, Carbon, Fluent…) so that
**only `theme tokens + intents` change** between them — all structure, animation, and behavior coming from
shared WE standards over FUI primitives. Three things needed grounding before the forks are at DoR:

1. Is the "theme + intents is the *only* difference" hypothesis architecturally sound, or naïve?
2. How do you *measure* pixel- and behavior-parity in a way that's a confirmed fact, not eyeballing?
3. Is "reproduce an existing implementation exactly, as a conformance test" an established method?

## Finding 1 — the hypothesis is the headless-library thesis, already market-proven

The separation the charter assumes — *behavior/state/a11y is shareable; look is a swappable layer* — is the
explicit architecture of the **headless / unstyled component** category, which has matured into the default
way serious design systems are built:

- **React Aria** ships **40+ component patterns as hooks** that own behavior, ARIA semantics, i18n, focus,
  and interaction — *with no styling at all*; you bring any styling method. ([React Aria / headless survey](https://www.greatfrontend.com/blog/top-headless-ui-libraries-for-react-in-2026))
- **Radix Primitives** are unstyled-by-default with an `asChild` composition prop; behavior is the product,
  style is the consumer's. **Ark UI** and **Base UI** are the same shape. ([LogRocket headless comparison](https://blog.logrocket.com/headless-ui-alternatives/))

So the hypothesis is *sound*: the market already factors components into (shared behavior) + (theme). **But
the survey also sharpens the residue** the charter calls "bucket 3": real shipped design systems (Material's
state-layer/ripple, Carbon's motion curves, Fluent's reveal) layer **proprietary look + motion** on top of
that behavior core. Reproducing those exactly is where you discover whether WE's intent + token vocabulary
is expressive enough — i.e. the gap list. The headless libs prove the *floor* is shareable; the program
tests whether the *ceiling* (the branded surface) is `theme+intents`-expressible or needs new standards.

## Finding 2 — parity must be a layered oracle; naïve pixel-diff is disqualified

A single pixel-by-pixel screenshot diff is **not** an acceptable parity oracle, and the industry has
converged on why:

- Pixel diffs generate **30–40% false positives** from anti-aliasing, sub-pixel rendering, and OS font
  smoothing — differences a human never sees. Semantic/ML visual tools (Applitools Eyes) cut that to
  **under ~2%** by understanding *what elements mean* rather than comparing raw pixels. ([Sauce Labs: 2026 visual tools](https://saucelabs.com/resources/blog/comparing-the-20-best-visual-testing-tools-of-2026), [Vision-AI vs pixel diff](https://dev.to/drizzdev/mobile-visual-regression-testing-in-2026-why-vision-ai-catches-what-script-based-tools-miss-2bfm))
- The **WPT reftest** model — the canonical cross-implementation rendering-conformance method — handles the
  same problem with **fuzzy matching**: a test declares a tolerance as *(max per-channel color delta, max
  number of differing pixels)*, so sub-pixel/anti-alias noise is absorbed while real divergence still fails.
  ([WPT reftests](https://web-platform-tests.org/writing-tests/reftests.html))

**Implication for the charter:** the parity oracle is *layered, not a single diff* — (a) **fuzzy-tolerance
pixel** for visual parity (WPT model), (b) **structural DOM/ARIA/focus-order diff** for behavioral parity
(deterministic, no judgment), (c) an **advisory VLM/semantic judge** for the "looks the same to a human"
verdict that pixels can't settle. This is *support-all-three layered*, not an either/or — it is recorded as
a "supported by default" design element, not a fork. It also reinforces that the VLM judgment layer is a
distinct capability from the diff engine (feeds Fork 2's ownership split).

## Finding 3 — reproduction-as-conformance is the WPT/reftest method, applied to a library

"Rebuild the thing on a different engine and assert the rendering matches a reference" is exactly how the
web platform proves cross-browser conformance. In WPT reftests the **reference page is written to *not* use
the technology under test** — it's an independent ground-truth rendering. ([WPT reftests](https://web-platform-tests.org/writing-tests/reftests.html))

Mapping to this program: the **incumbent library's own rendered output is the reference**; the
**FUI-themed reproduction is the test**; parity (within fuzz + structural + semantic layers) is the
assertion. The charter's "forcing function, not a product" framing is the reftest discipline — the artifact
that matters is the **pass/fail + the diff**, not the page. This is the same shape as the in-repo
exercise-app conformance loop and the gap-sweep diff-against-snapshot, now with an external ground truth.

## How the survey reshaped the forks

- **No new fork minted; one design element added below the divider** — the *layered parity oracle*
  (fuzzy-pixel + structural + advisory-VLM). It's support-all per the headless/WPT/VLM evidence (no branch
  is excluded), so it is a "supported by default" entry, not a `## Fork N`.
- **Fork 1 (validator sequencing) hardened** — the survey shows the validator is *non-trivial* (must be
  fuzzy + structural + semantic to be parity-grade), which strengthens the co-evolution default: a naïve
  pixel gate would be worse than none, so the validator must be specified by a concrete target, not stood up
  abstractly first.
- **Fork 2 (engine ownership) reinforced** — the survey cleanly separates the **diff engine** (deterministic,
  drives + captures + compares: FUI's explorer territory) from the **semantic VLM judgment** (the Applitools-
  class capability: Plateau's vision service per #475). The split falls out of the evidence.

## Sources

- [Top Headless UI libraries for React in 2026 — GreatFrontend](https://www.greatfrontend.com/blog/top-headless-ui-libraries-for-react-in-2026)
- [Headless UI alternatives: Radix vs React Aria vs Ark UI vs Base UI — LogRocket](https://blog.logrocket.com/headless-ui-alternatives/)
- [Comparing the 20 Best Visual Testing Tools of 2026 — Sauce Labs](https://saucelabs.com/resources/blog/comparing-the-20-best-visual-testing-tools-of-2026)
- [Why Vision AI Catches What Script-Based Tools Miss (2026)](https://dev.to/drizzdev/mobile-visual-regression-testing-in-2026-why-vision-ai-catches-what-script-based-tools-miss-2bfm)
- [Reftests — web-platform-tests documentation](https://web-platform-tests.org/writing-tests/reftests.html)
</content>
