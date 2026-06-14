---
type: decision
workItem: story
size: 2
status: resolved
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: none
preparedDate: "2026-06-14"
relatedReport: reports/2026-06-14-cross-cutting-accessible-name-intent.md
tags: []
---

# Candidate cross-cutting accessible-name intent

**Resolved 2026-06-14 — both forks ratified as written.** Fork 1 = **A** (mint a cross-cutting `accessible-name` intent; icon/glyph/media/image/avatar compose it). Fork 2 = **A** (own policy axes `naming` + `labelSource` only; defer name *computation* to the platform AccName 1.2 algorithm; not a protocol). The intent build is spun off as [#605](/backlog/605-mint-the-accessible-name-cross-cutting-intent/), which also carries the #587 migration note (its interim accessible-name dimension graduates to composing this intent). No Technical Configurator card.

**Prepared — ready to ratify.** No design exists yet; the two forks below are grounded in a prior-art survey published as `/research/accessible-name-intent/` (session report linked via `relatedReport`), and each carries a **bold** recommended default. Surfaced by [#370](/backlog/370-candidate-standard-expressive-symbols-reactions-emoji-sticke/) Fork 3: WE has one a11y intent — `live-region-status` ([intents.json:155](../src/_data/intents.json#L155)) — but it owns *announcement* (`aria-live`), not *naming*. There is no accessible-name intent. This decides whether a reusable `role=img`/`aria-label`/`aria-labelledby` naming policy should be **its own cross-cutting intent** (composed by icon/glyph/media/image/avatar) or stay a **per-intent dimension** each intent owns itself. Independent — **not** a blocker on the #370 chain.

## Axis framing

The concern splits into two orthogonal axes the research surfaced — *home* and *scope* — and one thing the platform already settles:

- **Home (Fork 1)** — does the naming policy get its own composable intent, or stay per-intent? The expressive-symbol intent ([#587](/backlog/587-author-the-expressive-symbol-rendering-intent-substrate/)) currently owns its *own* accessible-name dimension; `validation` ([intents.json:616](../src/_data/intents.json#L616)) is the precedent for an intent owning its aria surface (`aria-invalid`/`aria-describedby`) in-place. But `icon` ([intents.json:899](../src/_data/intents.json#L899)) has *no* naming axis (size/weight/style only), and naming recurs identically across icon/glyph/media/image/avatar — the separate-and-decouple case.
- **Scope (Fork 2)** — *if* minted, what does it own? The platform already standardizes name **computation**: W3C AccName 1.2 fixes the precedence `aria-labelledby > aria-label > native (img alt/label/text) > title`. The accessible name is read-only computed state — you provide inputs, the browser computes. So the intent's scope is the declarative *policy*, not the *computation*.
- **Settled by the platform (not a fork)** — the precedence order itself. Re-specifying AccName as a WE protocol is lock-in for zero interop gain (no swappable-vendor story) → **not a protocol**.

### Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
| --- | --- | --- | --- |
| 1 · Home | **Mint a cross-cutting `accessible-name` intent** | Keep naming a per-intent dimension | Med-high |
| 2 · Scope (if minted) | **Own policy axes only (`naming`, `labelSource`); defer computation to AccName** | Re-specify AccName precedence as a WE contract | High |

## Fork 1 — Cross-cutting intent, or per-intent dimension?

**Crux:** naming policy (meaningful↔decorative + label source/fallback) recurs unchanged across icon ([intents.json:899](../src/_data/intents.json#L899)), expressive-symbol (#587), media, image and avatar. There is no shared home for it today — each intent reinvents it, and ad-hoc `aria-label`/`aria-labelledby` wiring already scatters across the impl ([frontierui/blocks/droplist/Clearable.ts:33](../../frontierui/blocks/droplist/Clearable.ts#L33), [frontierui/blocks/tabs/TabGroupBehavior.ts:177](../../frontierui/blocks/tabs/TabGroupBehavior.ts#L177)).

- **A — Mint a cross-cutting `accessible-name` intent (recommended).** A concept that recurs without its neighbour earns its own home (standing separate-and-decouple bias); icon/glyph/media/image/avatar *compose* it instead of each redefining the policy. Prior art confirms the recurrence — every benchmark system names icons/images — and that the field's solution is a *thin* policy (Radix `AccessibleIcon`: label + visually-hidden text + `aria-hidden`), not a heavyweight mechanism, so a small composable intent is the right size.
- **B — Keep naming a per-intent dimension.** Each intent owns its aria surface in-place, like `validation`. *Rejected as the default:* this is the right call for *intent-specific* aria (validation's error wiring is unique to validation), but naming is **identical** across glyph/icon/media/image — duplicating it in each intent is the exact recurrence the separate-and-decouple bias says to factor out. Kept as the live alternative because the "too thin to be its own intent" worry is real (see confidence: med-high).

**Default: A — mint a cross-cutting `accessible-name` intent.**

## Fork 2 — If minted, what does it own?

**Crux:** the platform already computes the name (AccName 1.2 precedence). The only thing left to standardize is the *declarative policy* — and over-reaching into computation would re-specify the browser.

- **A — Own the declarative policy axes only; defer computation to AccName (recommended).** Two dimensions: `naming` (**meaningful** | decorative) and `labelSource` (**explicit** | referenced | derived-fallback). Derived fallback is *never empty* (CLDR short name for emoji per #587; `alt` for images; never a raw codepoint/filename); custom-image/sticker has no fallback so the label is *required*, not defaulted. Most-permissive default (Q6): **meaningful + derived fallback**; decorative (`aria-hidden`) is the author's opt-in. The intent does **not** restate the `aria-labelledby > aria-label > native > title` precedence — that's the browser's job (native-first).
- **B — Re-specify AccName precedence as a WE contract/protocol.** *Rejected:* AccName is implemented by every browser; there is no swappable-vendor interop story, so making it a protocol is lock-in for zero gain (minimize-lock-in) and risks drifting from WCAG 2.5.3 "Label in Name". A protocol is the single escapable lock — never reached for casually.

**Default: A — policy axes only; defer computation to the platform AccName algorithm.**

---

## Context (not part of the call)

**Per-fork classification.** Layer = **Intent** (declarative "what": name this element / mark decorative; no runnable behavior beyond attributes the browser reads). Q2 = **not a protocol** (AccName is the platform standard; no vendor-swap). Q3 = expose the whole axis (`naming` + `labelSource` both configurable). Q4 = "meaningful content must be named" is a fixed a11y invariant; meaningful↔decorative and label-source are legitimate dimensions. Q5 = local/structural (the label is content-specific), not DI. Q6 = most-permissive: meaningful + derived fallback. Q7 = sits at the seam of icon/expressive-symbol/media/image/avatar → put the dimension on `accessible-name`, the others compose it. The full classification lives in the `/research/accessible-name-intent/` write-up.

**Supported by default (not decisions).**
- **Orthogonal to `live-region-status`** — naming ≠ announcement; they compose where both apply (e.g. a reaction toggle that is named *and* announced) but neither owns the other.
- **#587 keeps its interim dimension.** If Fork 1 = A, #587's accessible-name axis *graduates to composing* this intent once minted — a migration note, not a blocker. #596 is independent of the #370 chain either way.

**On resolution** (when ratified): if Fork 1 = A, graduate to an `accessible-name` entry in `intents.json` (the intent build) and a migration note on #587 to compose it. No Technical Configurator card — naming is a UX/a11y dimension, not an impl/technical setting.
