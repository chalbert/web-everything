---
type: decision
workItem: story
size: 8
parent: "382"
status: resolved
dateOpened: "2026-06-13"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: none
preparedDate: "2026-06-13"
relatedReport: reports/2026-06-13-design-ref-vision-pipeline.md
tags: [design-reference, corpus, vision, vlm-as-judge, capture-gate, quality-control, swappable-provider, candidate-selection]
---

# Design-ref vision-gated capture QC — auto-judge candidate surface quality before corpus admission

## Digest

No vision exists in the capture pipeline yet — today's gate is a hand-authored `readySelector`
(`scripts/design-refs.mjs:149`) that can't tell an app surface from a marketing splash / modal /
error panel. **Prepared**: four forks grounded in the [`design-ref-vision`](/research/design-ref-vision/)
topic (survey of ScreenAI / Ferret-UI / Design2Code / VLM-as-judge / autoconsent), each with a
**bold** default. **Governing ruling (2026-06-13): vision is never a standard** — it's a *Plateau
service* the WE corpus pipeline consumes as a **no-leakage client** (only outputs reach the
standard; see invariant below). The load-bearing survey finding: *coarse classification is
reliable, full structure recovery is hard* — so the cheap admit/quarantine verdict is safe to
automate.

> **Decision status: RESOLVED — accepted in full (2026-06-13).** All four forks ruled at their
> recommended defaults (F1 Plateau-service client + no-leakage; F2 final-frame admission, pre-capture
> probe deferred; F3 6-verdict taxonomy + autoconsent remediation in v1; F4 selector fast-path +
> vision override + hash-cached verdict). The implementation is carried as the agent-ready build
> **#480**.

## Governing invariant — vision is a service, never a standard (ruling 2026-06-13)

Vision is implementation, not a WE standard, and it does **not** live in `scripts/design-refs.mjs`
as a permanent bespoke registry. It is a **Plateau service** (the #091 managed-offering layering —
served product = plateau-app), and the WE corpus pipeline (#475 + #396) is a **client** of it. The
one test that keeps this clean: **no leakage** — no `@webeverything` *published* artifact may import
or depend on the vision service; the standard receives only the *outputs* (corpus, tags, candidate
intents) as produced artifacts, and *how* they were produced is invisible to it. This is
**dogfooding**: the product accelerates the standard's own development. #086 (mockup→code product)
and #475 / #396 (corpus tooling) are **three consumers of one Plateau vision capability**, not three
providers.

**Interim:** the Plateau vision service doesn't exist yet (#086 open/blocked). So the pipeline ships
a **thin client seam** that today calls a vision model directly and is **repointed** at the Plateau
service when it lands — same swappable shape, the home migrates. No throwaway local provider is built.

## The axis being decided

The concern decomposes into four orthogonal axes, each pinned to the real pipeline:

- **Where the vision capability *lives*** (the provider seam) — **ruled:** a **Plateau service** the
  WE pipeline consumes as a no-leakage client, not a registry baked into the core
  (`scripts/design-refs.mjs`). *Fork 1.*
- **When the verdict is *taken*** (gate placement) — capture currently shoots once after an
  optional `enterAction` click-through (`scripts/design-refs.mjs:137-139`) then asserts a selector
  (`:149-156`). A vision verdict can run on that final frame, and/or on a cheap pre-capture probe.
  *Fork 2.*
- **What the verdict *says* and how a bad surface is *remediated*** — the existing machinery is a
  binary `reviewState ∈ {confirmed, ungated}` (`:148-152`) plus a `needsReview` quarantine map
  (`:155`, cleared on success at `:218`). A vision verdict needs a richer taxonomy and an
  obstructed→re-shoot path. *Fork 3.*
- **How vision *coexists* with the deterministic gate and stays idempotent** — re-runs skip by
  `ledger[url]` (`:126-128`) and dedupe by `sha256(webp)` (`:164-167`); a vision call must not
  re-fire on unchanged frames, and the cheap `readySelector` should stay a free fast-path. *Fork 4.*

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| 1 · Provider seam | **✅ RULED: Plateau vision service; WE pipeline = no-leakage client (interim thin seam → repoint)** | Local registry in scripts | High |
| 2 · Gate placement | **✅ RULED: Final-frame admission verdict first; pre-capture probe deferred as an opt-in optimisation** | Probe + final (two calls) now | Med-High |
| 3 · Verdict + remediation | **✅ RULED: 6-verdict taxonomy; `obstructed` → autoconsent dismiss + bounded re-shoot (cap 2) → else quarantine** | Binary app/not-app, no remediation | Med |
| 4 · Coexistence + idempotency | **✅ RULED: Keep `readySelector` as a fast-path; vision is the general gate and overrides a selector-pass that's actually an error page; cache verdict by `contentHash`** | Vision replaces selectors entirely | High |

## Fork 1 — Where the vision capability lives (the provider seam) ✅ *ruled 2026-06-13*

**Crux.** The model must be swappable, shared with #396's codification, and must **not leak into the
standard**. Where does it live? Both #475 (cheap gate) and #396 (rich codify) are *analysis* calls,
and #086's product wants the same capability.

- **A — A Plateau vision service; the WE pipeline is a no-leakage client (ruling).** Vision is a
  managed Plateau capability (#091 layering, served product = plateau-app). #475's gate
  (`classifyCandidate`) and #396's codification (`analyzeForCodification`) are two clients calling
  it; #086's product is a third. One service, swappable model behind it, **no provider name in the
  standard**. *Interim:* a thin client seam calls a model directly until the service exists, then
  repoints (see governing invariant).
- **B — A `customVisionProvider` registry inside `scripts/design-refs.mjs`.** *Superseded* (was the
  prepared default): keeps the provider repo-local and rebuilds in WE what Plateau should own. Still
  correct as the *interim thin-seam shape*, but the target home is the Plateau service, not a
  permanent WE registry.
- **C — Two registries (gate vs codify), or hardcode one model.** *Rejected:* over-separation (both
  are analysis) and lock-in respectively.

**Ruling: A.** Separate-and-decouple is satisfied at service-vs-client and at the swappable model
behind the service; the capability stays singular because all consumers want the same analysis. The
**no-leakage invariant is the governing lock boundary.** *(Sub-decision, build-time: exact contract
field names — `verdict`/`reasons`/`remediation` — settle when the first client is wired.)*

## Fork 2 — Gate placement ✅ *ruled 2026-06-13*

**Crux.** A pre-capture probe can reject a marketing homepage *before* paying for a full high-res
capture, but it doubles vision calls. Where does the verdict run?

- **A — Final-frame admission verdict first; pre-capture probe deferred (recommended).** Run
  `classifyCandidate` on the captured frame, just before admission (replacing the `:149` selector
  assertion as the general path). Simplest, one call per candidate, and the capture cost is already
  paid. Add the cheap pre-capture probe later *only if* full-capture spend on obvious marketing
  pages proves material.
- **B — Probe + final (two calls now).** *Rejected for v1:* optimises a cost we haven't measured;
  premature. Revisit if collect-time spend matters.
- **C — Probe-only (judge before capture, skip capture if not-app).** *Rejected:* a low-res probe
  can't reliably catch a modal that only appears on the settled full render; the admission verdict
  must see what actually gets committed.

**Ruling: A (accepted 2026-06-13).** The corpus is tens of targets, not millions — full-capture cost
is trivial, so the simpler one-call gate wins; promote the pre-capture probe only if spend ever bites.

## Fork 3 — Verdict taxonomy + obstructed remediation ✅ *ruled 2026-06-13*

**Crux.** Today's `reviewState` is binary (`confirmed`/`ungated`, `:148-152`). A vision gate wants
to distinguish *why* a surface failed — and an *obstructed* app (cookie/consent/modal over a real
UI) is recoverable, unlike marketing.

- **A — 6-verdict taxonomy + autoconsent remediation (recommended).**
  `verdict ∈ {app, obstructed, marketing, error, blank, non-app}`. `app` → admit
  (`reviewState: confirmed`); `obstructed` → run DuckDuckGo **autoconsent** (Playwright-native, per
  the survey) to dismiss the overlay, re-shoot, re-judge, **bounded to 2 attempts**, then admit or
  quarantine; everything else → `needsReview` quarantine (`:155`), nothing written to the corpus.
  The taxonomy is an open-growing keyed vocabulary (mirrors the taxonomy topic's controlled-vocab
  ruling), not a closed enum.
- **B — Binary app / not-app, no remediation.** *Rejected:* throws away recoverable obstructed
  surfaces (a dismissible cookie banner would quarantine a perfectly good app) and loses the
  *reason* that makes `needsReview` actionable.

**Ruling: A (accepted 2026-06-13).** Remediation ships in v1 — recovering a real app behind a
dismissible consent banner is worth the loop. *(Sub-decision: the re-shoot cap (2) and per-attempt
timeout are build-tunable; keep them config, not constants.)*

## Fork 4 — Coexistence with the deterministic gate + idempotency ✅ *ruled 2026-06-13*

**Crux.** Do hand-authored `readySelector`s survive, and how do we avoid re-paying vision on every
re-run when capture is already idempotent (`ledger[url]` skip `:126`, `sha256` dedupe `:164-167`)?

- **A — Selector as fast-path, vision as general gate + override; cache verdict by hash
  (recommended).** When a target has a `readySelector` and it matches, skip the vision call (free
  fast-path) — *unless* we want a confirm; when absent, vision is the gate. Critically, vision
  **overrides a selector-pass that is actually an error page** (the Grafana case: a shell selector
  matched but the surface was an error panel). Store the verdict keyed by `contentHash` (extend the
  `ledger`/`meta` the same way `reviewState` already rides along at `:199`) so an unchanged frame
  reuses its verdict — no vision spend on idempotent re-runs.
- **B — Vision replaces `readySelector` entirely.** *Rejected:* discards a free, deterministic
  signal where an author already encoded it, and pays vision on every target including ones already
  perfectly gated.

**Ruling: A (accepted 2026-06-13).**

## What this unblocks

All four forks ruled (accepted in full). The ruling **defines the shared Plateau vision capability
that #396 then consumes as a second client** — so codification starts from a clean corpus instead
of analysing marketing splashes. The implementation is now agent-ready against the shipped phase-1
pipeline (no hard `blockedBy`), tracked as **#480**.

## Relationships

- **parent #382** — enforces its *subject = app-only* filter generically; closes its named open QC gap.
- **#396** — a second **client** of the same Plateau vision service (Fork 1) for richer post-admission tagging; #475 is its upstream quality gate.
- **#086** — the **product** consumer of the *same* Plateau vision capability (#091 layering); not a separate provider. The mockup→code product and the corpus tooling share one service.
- **#091 / plateau-app** — the managed-offering layering that makes vision a served Plateau service the WE project consumes (dogfooding), governed by the no-leakage invariant.
- **#395** — phase-2 perceptual dedup runs after admission; orthogonal (dedup vs. quality).
- Refines **#382 Fork 2** (vision now runs at collect time, for gating not full tagging).
