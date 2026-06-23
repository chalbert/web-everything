---
kind: decision
size: 2
parent: "099"
status: resolved
preparedDate: "2026-06-22"
dateOpened: "2026-06-16"
dateStarted: "2026-06-23"
dateResolved: "2026-06-23"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#config-extends-platform-default"
tags: [requirement-as-code, code-generation, ai, evergreen, vision]
crossRef: { url: /backlog/100-requirement-as-code/, label: "Requirement-as-code (#100)" }
relatedProject: webcases
---

# Code-from-requirement source-of-truth — requirement-only (codegen) vs AI-proposes/dev-validates

Capability 3 of requirement-as-code (#100), de-buried from its body: what **source-of-truth model** does
code-from-requirement target?

## Grounding digest

- **Placement is settled, not in scope** — the AI code-proposer is a Plateau-served swappable provider the
  tool consumes as a [no-leakage client](docs/agent/platform-decisions.md#no-leakage-client) (#475); only
  the requirement meta-schema (#100 slice A) and the webcases it compiles to
  ([#797](/backlog/797-requirement-to-webcase-compiler-deterministic-1-n-projection/)) are WE-resident.
- **The governing philosophy is ratified** — *AI is a dev-time layer over a **codified contract**; the
  disposable-artifact pattern (wandb/openui) is the anti-pattern*, and WE's stated moat is **"AI proposes,
  the standard verifies."** The codified contract here is the requirement meta-schema (#100) + the webcase
  conformance gate (#797).
- **The vision this serves** is the evergreen app (#099): *no hand-written code to drift* — the requirement
  is the single source of truth.
- No new `/research/` topic — this ratifies an end-state against already-ruled philosophy (#099/#100/#475)
  and the #797 verifier, a prior-art-settled call.

## Axis framing — SoT mode is a project-selectable dimension

**Reframed 2026-06-23 (discussion-born):** the original card treated this as "which SoT model is *the*
end-state" and pinned (a), demoting (b) to a transient bootstrap. The reframe: **drift is a defect only
relative to the #099 evergreen goal** — a project that doesn't hold that goal finds (b) perfectly
workable. So both (a) and (b) are **legitimate end-states for different project goals**, and per
support-all-coherent the fork dissolves into a **configurable strategy dimension** — a textbook instance
of the ratified [config-extends-platform-default](docs/agent/platform-decisions.md#config-extends-platform-default)
statute (precedents: `CustomRegistry.extends`, JSX render-strategy #080, auto-define strategy #227).

**WE does not set or require a mode.** The core tool/registry stays **default-less**; the SoT-mode value
lives in a **project config that *extends* a fully-defined platform-default flavor**, exactly as auto-define
and render-strategy already do. This is **not** a new intents/theme-style catalog surface — it is one more
**config key** in that existing project-config-extends-platform-flavor layering. The project selects its
source-of-truth mode (or inherits its flavor's value); WE never asks for a default.

- **(a) requirement-only** keeps the **requirement** as the single source of truth (codegen *from* the
  meta-schema — the contract IS the truth, the purest "AI over a codified contract", not the
  disposable-artifact anti-pattern). The #797 verifier is the **authoritative regeneration gate**.
- **(b) AI-proposes/dev-validates** lets a developer **edit the generated code**, accepting that edited
  code becomes a *co-source-of-truth*. The #797 verifier runs here too, as a **drift detector** that
  flags where code has diverged from the requirement — so (b) is verifier-as-warning, not verifier-absent.

A given platform-default *flavor* may recommend a value — the WE-authored **evergreen flavor** leans (a)
(#099) — but that is a *flavor's* recommendation a project freely overrides, **not** a WE mandate. The old
"gated bootstrap → forced cutover" is likewise a *project's own choice* to graduate (b)→(a) as its verifier
coverage matures.

## Recommended path at a glance

| Fork | Ruling | Both values | Confidence |
|---|---|---|---|
| **Fork 1** — source-of-truth mode | **Configurable dimension under [config-extends-platform-default](docs/agent/platform-decisions.md#config-extends-platform-default); WE/registry stays default-less, value lives in project config extending a platform-default flavor** (one config key, not a new catalog surface) | **(a) requirement-only** (verifier = authoritative gate) and **(b) AI-proposes/dev-validates** (verifier = drift detector; code is a co-SoT) are both legitimate end-states the project selects; the WE-authored evergreen flavor *recommends* (a) (#099) without mandating it | **high** — both legitimate for different project goals; WE never sets/requires a default |

## Fork 1 — source-of-truth mode (project-selectable)

**Fork-existence justification:** both branches are legitimate end-states *for different project goals*, so
this is **not** an a/b exclusion — it's a **configurable dimension** under
[config-extends-platform-default](docs/agent/platform-decisions.md#config-extends-platform-default). (b) is
"flawed" only relative to the #099 evergreen goal; a project that doesn't hold that goal legitimately
accepts code as a co-SoT. Per support-all-coherent + that statute, **WE/registry stays default-less** — the
mode value lives in a **project config extending a platform-default flavor** (one config key, not a new
surface), and WE never sets or requires the value. The #797 verifier runs in **both** modes (authoritative
gate in (a); drift detector in (b)), so the moat does not depend on which mode a project picks.

**Crux:** "AI proposes, the standard verifies" delivers the *no-drift evergreen* posture only when the
requirement stays authoritative (mode a). When a project opts into editable code (mode b) it trades the
no-drift guarantee for an escape-to-code hatch — a tradeoff WE surfaces and *detects* (verifier-as-warning)
rather than forbids.

**Options:**

- **(a) Requirement-only — the requirement is the single source of truth; code is generated from it.**
  *(recommended default)* The strongest form of the evergreen vision (no hand-written code to drift) and
  the purest expression of "AI over a codified contract" — the requirement meta-schema (#100) IS the
  contract, so codegen-from-it is *not* the disposable-artifact anti-pattern. Its one risk — "a wrong
  generation ships silently" — is exactly what the #797 requirement→webcase conformance gate catches as the
  authoritative regeneration gate.
- **(b) AI-proposes / dev-validates — the AI proposes a code change a developer validates/edits.**
  *(supported opt-in mode)* For a project that wants an escape-to-code hatch and accepts edited code as a
  co-source-of-truth. #100's body flagged it as the more-likely *near-term* shape, and it is also the
  natural starting mode while a generation class's verifier coverage is immature. The #797 verifier runs as
  a **drift detector** flagging where code diverged from the requirement; a project may choose to graduate
  (b)→(a) as coverage matures — its choice, not a forced cutover. **Not excluded.**

**Ruling: configurable dimension under config-extends-platform-default — WE/registry default-less; the mode
value lives in project config extending a platform-default flavor. (a) and (b) are both project-selectable;
the WE-authored evergreen flavor recommends (a) without mandating it.**

**Skeptic:** SURVIVES-WITH-AMENDMENT (default **flipped** from the original "(b)") → the original card
defaulted to (b), but the skeptic showed that answers a *sequencing* question with an *end-state* verdict
(R1) and re-introduces the drift #099 exists to kill (R4); it also mis-applied the "AI-over-contract"
principle to reject (a), when (a) — codegen from the requirement *contract* — is that principle's purest
form (R2); and (b)'s "wrong generation ships silently" risk assumes a weak #797 verifier WE is separately
building to be strong (R3). **Amendment folded in (now the default):** the end-state SoT is **(a)
requirement-only**; (b) is ratified **only as the bootstrap phase** with the two binding constraints above
(cutover gated on measured #797 coverage; dev edits captured as requirement amendments, never persisted
code). Without that reframe the as-written "(b)-as-end-state" default is **refuted**.

**Discussion reframe 2026-06-23 (supersedes the skeptic's bootstrap framing):** the skeptic correctly
flipped the default off "(b)-as-permanent-end-state", but still framed (a) as the *forced* end-state with
(b) a transient bootstrap. The live discussion went one step further: **drift is a defect only relative to
the #099 evergreen goal**, so a project not holding that goal may legitimately keep (b). Per
support-all-coherent + the [config-extends-platform-default](docs/agent/platform-decisions.md#config-extends-platform-default)
statute, the fork is recast as a **configurable dimension**: **WE/registry stays default-less**, the mode
value lives in a **project config extending a platform-default flavor** (one config key, not a new surface),
and WE never sets/requires the value — the WE-authored evergreen flavor merely *recommends* (a). The #797
verifier runs in both modes (authoritative gate / drift detector). The "gated bootstrap → forced cutover"
becomes a project's own (b)→(a) graduation choice. Red-team ("does offering (b) erode the moat?") fails: the
moat is the verifier, which runs in both modes. This is the framing to ratify.

## Held open — when this is built

Decision lane: the *fork is at DoR now* (prepared, dimension reframed, (a) default ruled) and ready to
ratify. What is held is the **build** — code-from-requirement is the furthest, hardest capability of the
evergreen-app vision (#099), gated on the Plateau-served codegen capability existing. Ratifying decides the
SoT-mode design; it does **not** trigger the build. **Un-park the build** when the Plateau-served codegen
capability is real and slice C (code-from-requirement) is picked up.

## Ratified 2026-06-23

**Ruling:** SoT-mode is a **configurable dimension** governed by
[config-extends-platform-default](docs/agent/platform-decisions.md#config-extends-platform-default) — WE/registry
stays **default-less**; the value lives in a **project config extending a platform-default flavor** (one config
key, not a new catalog surface). **(a) requirement-only** (verifier = authoritative gate) and **(b)
AI-proposes/dev-validates** (verifier = drift detector; code a co-SoT) are both project-selectable end-states;
the WE-authored **evergreen flavor recommends (a)** (#099) without WE mandating it. `codifiedIn` = that statute.

**Residual spun out:** [#1662](/backlog/1662-unified-project-config-surface-vs-per-dimension-flavors-wher/) —
whether a *single* materialized project-config surface holds all such dimension values or each carries its own
flavor config (the statute's open materialization end). Not baked here.
