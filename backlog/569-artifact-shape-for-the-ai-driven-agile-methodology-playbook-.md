---
kind: decision
size: 2
status: open
preparedDate: "2026-06-22"
parent: "563"
dateOpened: "2026-06-14"
tags: [methodology, agile, ai, ways-of-working, enablement, positioning, decision, deferred, pre-release]
crossRef: { url: /backlog/143-ai-approach-page/, label: "Public approach page (#143)" }
---

# Artifact shape for the AI-driven agile methodology (playbook / template repo / write-up / talk)

Decide the form [#563](/backlog/563-ai-driven-agile-methodology-as-a-shareable-approach/)'s methodology
takes. This gates #563's decomposition — its slices are downstream of the shape, so the epic cannot be
sliced until this lands.

## Grounding digest

- #563's central thesis is **"the practice IS the repo"** — the operating model lives as runnable
  `.claude/skills/`, the `backlog/` tracker-as-memory, `docs/agent/` workflow docs, and the mechanical
  backlog CLIs; git + backlog history is the case study.
- Hard guardrail (inherited from #563): **not a product** — knowledge/positioning value only (may feed the
  #089 monetization *narrative* as credibility, never as a paid offering).
- **Don't freeze early** — the practice is still maturing; *ratify* near release with real examples (the
  #143 caution). Prep brings the fork to DoR; it does **not** freeze it — the call stays open.
- No new `/research/` topic — the prior art is this repo's own operating model; the fork is *which artifact
  is canonical*, settled against #563's thesis, not against external libraries.

## Axis framing — which artifact is the *source*, which are downstream surfaces

The four candidate shapes are **not rival products** — they layer. So the real decision is *which is the
source of truth* and which are renderings of it. The original framing leaned toward **A · written
playbook/essay** as the source on lowest-build-cost grounds — but lowest-cost is a *prioritization*
argument, not a canonicity one, and a static essay as the *canonical* artifact contradicts the methodology's
own thesis (an AI-driven, runnable practice whose source-of-truth is prose *about* it, not the runnable
substance). The honest source is the **living repo itself**; among *authored* artifacts the one faithful to
"the practice is the repo" is **B · the extracted starter-kit**, with A as its narrative companion.

## Recommended path at a glance

| Fork | Recommended default | Main alternative (excluded) | Confidence |
|---|---|---|---|
| **Fork 1** — the canonical/source artifact | **the living repo is the source; the canonical *authored* artifact is (B) the extracted starter-kit, with (A) prose as its narrative companion** and (C)/(D) as further surfaces | (A)-as-source — excluded: prose *about* a runnable practice is a derivative, not the origin; "lowest cost" is prioritization, not canonicity | **med** — divergent (the #143 maturing caution means ratify near release) |

## Fork 1 — what is the source artifact, and what are downstream surfaces

**Fork-existence justification:** genuine either/or on *canonicity* — the shapes coexist as surfaces (so
"which to build" is support-all, not a fork), but exactly one can be the **source of truth**, and
"(A) prose is the source" vs "the repo/(B) starter-kit is the source" are mutually-exclusive origins that
route #563's slices differently. The excluded branch is *(A)-as-source*: it is flawed on the merits —
canonizing prose *about* a runnable practice as the origin contradicts #563's "the practice is the repo"
thesis (a derivative crowned as the source).

**Crux:** #563's whole claim is that the operating model is the *runnable* repo, not narrative about it. So
the source artifact must be the runnable substance; prose, talks, and guides *render* it.

**Options:** *(pick the **source**; the rest are downstream surfaces)*

- **The living repo as source → (B) extracted starter-kit as the canonical authored artifact**
  *(recommended default)* — the source of truth is the repo itself (`.claude/skills/`, `backlog/`,
  `docs/agent/`, the CLIs); the canonical *authored* deliverable is **(B)** — those skills + backlog CLIs +
  workflow docs extracted as a kit another team clones (the `create-react-app` shape: open knowledge you
  fork, *not* a product, so #563's guardrail is honoured). **(A)** written playbook/essay is its narrative
  companion (and feeds #143); **(C)** talk/article and **(D)** internal enablement guide are further
  presentations. Highest adoption fidelity and truest to the thesis.
- **(A) Written playbook/essay as the source** — *Rejected (flawed branch).* Lowest build cost and feeds
  #143 directly, but "lowest cost" is prioritization, not a canonicity argument, and prose *about* a
  runnable practice is a derivative — making it the *source* inverts #563's thesis. Excellent as the
  **narrative companion**, not as the origin.
- **(C) Talk/article**, **(D) internal enablement guide** — *downstream surfaces, not the source* (each
  presents/packages what the kit + prose capture). Not rejected — just not canonical.

**Recommended default: the repo is the source; (B) extracted starter-kit is the canonical authored
artifact, (A) prose its narrative companion.**

**Skeptic:** SURVIVES-WITH-AMENDMENT (default **flipped** from the original "(A) as source") → the skeptic
showed (A)-as-source betrays #563's "the practice is the repo" thesis (prose is a derivative, not the
origin), that "lowest build cost" is prioritization cosplaying as a canonicity merit, and that the
not-a-product guardrail was *mis-applied* to exclude (B) — an open clonable kit is forkable knowledge, not a
product. **Amendment folded in (now the default):** the **source is the living repo**; the canonical
*authored* artifact is **(B)** the extracted starter-kit, with **(A)** prose as its narrative companion and
(C)/(D) as further surfaces. (The #143 "don't freeze early" caution still governs *ratification timing* —
ratify near release with real examples — but the prepared default is now thesis-faithful.)

## Unblocks

- Re-run `/slice 563` against the chosen canonical artifact (B + companion surfaces) — the slices become
  nameable and `file:line`-citable only once the source is fixed.

## Held open — when this is ratified

Held open (decision lane): per the #143 caution, *ratify* near release once the practice has settled, with
real examples — don't freeze a maturing model. The fork is at DoR now (prepared, source ruled); the call is
a fast ratify when #563 is ready to decompose.
