---
bornAs: xs62gnh
kind: decision
size: 5
parent: "2527"
status: resolved
dateOpened: "2026-07-18"
dateStarted: "2026-07-19"
dateResolved: "2026-07-19"
codifiedIn: one-off
preparedDate: "2026-07-18"
tags: [plateau-loop, console, substrate, spec, constitution, design-forks]
---

# Console substrate & contract forks (F1–F4)

**Prepared for ratification.** These four substrate contracts are grounded in the landed console design record
(`we:docs/design/backlog-console-design.md` §3b/§3c/§3e/§3h) — the prior-art survey lives there, so this item
links it inline rather than re-surveying. Each fork carries a **bold recommended default**, an attacked
`Skeptic:` verdict, and a fresh-context `Screen:` verdict: F1 and F4 are forced-invariant forks (a clearly-
broken excluded branch), F2 a representation either/or, F3 aligns the item's requirement contract with the
same-day spec-based-programming direction ([#2564]). Ruling them unblocks the proof backend ([#2562]) and the
board ([#2555]). **Seams (not ruled here):** F1's launch *scheduling* stays [#2557]'s; F2/F3's schemas ride
[#2558]'s provider-agnostic seam; F3 realizes [#2564]'s *schema-not-prose* contract at the item layer.

## Ruling (2026-07-18)

Ruled by the human on 2026-07-18. All four forks resolved; the recommended default was ratified on each
(F3 with an amendment, F4 as a principle with its form delegated). The prepared analysis below stands as the
record of *why*; this section is the settled outcome.

- **F1 — review-unit vs build-unit → RATIFIED (a).** Decouple: the review/launch unit is the **cluster** (a
  derived view over the item set), the build unit is the **item** (one item per agent-run, WIP=1). "Launch a
  cluster" decomposes into ordered per-item builds. **Lane packaging + wave scheduling are NOT ruled here** —
  they stay `we:backlog/2557-*.md` / `we:backlog/2560-*.md`.

- **F2 — where `confidence` comes from → RATIFIED (a).** A stored, provenance-tagged `confidence` field
  (agent-seeded at prep → human-overridable → proof-refined) with **nearest-wins precedence** `human > derived
  > agent`. A proof recompute never silently overwrites a human override — it surfaces a disagreement flag
  instead.

- **F3 — structured spec vs prose → RATIFIED (a) + AMENDMENT.** Frozen, human-reviewed **structured
  requirement rows** are the machine-checkable contract, seeded from prose. **AMENDED:** the authoring FORMAT is
  **adapter-pluggable** — any spec language that DETERMINISTICALLY converts to the fields (e.g. Gherkin/BDD
  "Given-When-Then", if strictly codifiable) is valid input; a non-LLM round-trippable converter qualifies,
  while free-form prose stays a lossy seed. The format→fields converter is itself an **adapter** (a sibling of
  `we:backlog/2558-*.md`). The EXACT format is NOT locked — it is reviewed empirically as specs are written;
  tracks `we:backlog/2564-*.md`.

- **F4 — constitution: artifact vs index → PRINCIPLE RATIFIED, FORM DEFERRED.** RATIFIED **principle:** the
  constitution is the FEW big **core principles**; the specifics become **specs** (the §3b split), with **NO
  duplication**. The **FORM** (a — derived index vs b — standalone artifact; note (b) is now viable because the
  non-duplicating split defuses its drift objection) AND the **membership curation** are **DELEGATED** to a
  follow-up decision filed this session: the **`constitution-curation-form`** item (a hash-id decision,
  `blockedBy #2561`; the drain will assign its number). Reference it by that slug.

## Axis framing (the four contracts, pinned to the tree)

Each fork fixes one contract the console + runner code against, and each is grounded in a *real* place the code
is absent or a statute already rules:

- **F1 — the runner contract / what a lane holds.** The runner already spawns **one** agent building **one**
  item, WIP=1, non-preemptive (`we:backlog/2527-plateau-loop-autonomous-ai-build-queue.md` slice 4;
  `we:backlog/2444-plateau-loop-phase-1-agent-runner-shape-cli-spawn-contract-s.md`), and one lane = one
  throwaway work-stream clone = one PR (`we:docs/agent/platform-decisions.md#primary-read-only-lanes-only`). The
  cluster is the `blockedBy`/`parent` closure the review surface renders (design §3c).
- **F2 — the `confidence` source + representation.** The launch gate reads *"confidence ≥ threshold"* (design
  §3c) but **no such field exists**: `we:scripts/check-backlog-item.mjs:118-141` validates only `tier`/`rank`/
  `buildQueued`, and the readiness engine has no per-item confidence. The threshold itself is a config dimension
  (`we:docs/agent/platform-decisions.md#config-extends-platform-default`); F2 rules only the *source of the
  number the gate reads*.
- **F3 — the requirement (spec) data model.** The backlog is markdown-derived — *"completely dynamic … derived
  from markdown, never hand-typed into frontmatter"* (`we:docs/agent/backlog-workflow.md`), so acceptance is
  prose today. The proof rows R1..Rn (design §3e) need stable ids the proof backend ([#2562]) and review modal
  key on. The same-day sibling [#2564] ratified-in-discussion that *"the spec is a schema/executable contract,
  not prose"* (prose isn't machine-diffable); the governing statutes for a *derived* structured contract are
  `we:docs/agent/platform-decisions.md#faithful-derivation-exclude-not-fabricate` (the lossy prose→rows seed)
  and `we:docs/agent/platform-decisions.md#single-authoring-sot-derived-projection` (no second authoring home).
- **F4 — the constitution + its injection.** *"Maps to existing layers — elevate, don't reinvent:
  platform-decisions (statute), the WE standards, AGENTS"* (design §3b). `we:AGENTS.md` is the
  always-loaded router (`we:AGENTS.md:3-6`); `we:docs/agent/platform-decisions.md` is the single source of truth
  for settled orientation. `we:docs/agent/platform-decisions.md#config-extends-platform-default` already
  **rejects a unified authoritative artifact**, supporting only a *derived, non-authoritative discovery view*.

## Recommended path at a glance

| Fork | The call | Recommended default | Main alternative (excluded) | Confidence |
|---|---|---|---|---|
| 1 | review-unit vs build-unit | **(a) decouple: review-unit = cluster (derived view), build-unit = item (WIP=1)** | (b) cluster is the atomic build unit (one agent builds N items in one lane) | High |
| 2 | where `confidence` comes from | **(a) a stored, provenance-tagged `confidence` field: agent-seeded at prep, human-overridable, proof-refined** | (b) purely derived, never stored | Med |
| 3 | structured spec fields vs prose | **(a) frozen, human-reviewed structured requirement rows are the machine-checkable contract — seeded from prose (backlog stays markdown-authored), not a hand-authored second home** | (b) requirements stay prose the agent re-interprets per build (not machine-diffable) | High |
| 4 | constitution: artifact vs index | **(a) no new authoring home: a machine-readable index of inherited statute anchors, injected as a build-time derived compact projection (regenerated → drift-free)** | (b) author a standalone constitution artifact (a hand-maintained second home) | High |

## Fork 1 — review-unit vs build-unit

*Fork exists (forced invariant):* the excluded branch — **the launched cluster is itself the atomic build
unit**, i.e. **one agent-run builds the whole `blockedBy`/`parent` closure in a single turn** — is *broken*: it
contradicts the ratified WIP=1, non-preemptive runner (#2527 slice 4, #2444) and collapses per-item review +
per-item proof into one un-reviewable, un-bounceable mega-diff. The two coherent granularities do **not** have
to be the same number; the composability probe passes — "review the cluster" and "build one item" are facades
over the same item set (the cluster is a *derived view* over items) — so they compose rather than compete.
(The build-unit half — one item per agent-run, WIP=1 — is largely *settled by precedent* in #2527/#2444; F1's
live call is the **decoupling**: fixing that the review/launch unit is the cluster while the build unit is the
item, and naming the excluded atomic-cluster-build branch so it can't creep back at build time.)

- **(a) decouple them: the review/launch unit is the CLUSTER, the build unit is the ITEM (one item per
  agent-run, WIP=1).** The human reviews and clears the whole co-delivered `blockedBy`/`parent` closure as one
  thing (design §3c); "Launch" on a cluster **decomposes** into per-item builds in dependency order, each its
  own agent-run + PR. The runner keeps pulling a single `next-to-build` item
  (`we:scripts/backlog.mjs build-queue --next`). **DEFAULT.**
- (b) the cluster is the atomic build unit — one agent-run builds all ready items of the cluster in one turn.
  *Rejected:* breaks WIP=1 + per-item bounce + per-item proof; a stalled or wrong item can't be bounced without
  discarding the whole cluster's work.

**Default (a).** Review granularity (cluster) and build granularity (item) are *different by design*, and the
existing runner already builds the item, not the cluster — (a) is the contract that keeps the ratified WIP=1
invariant intact while still giving the operator a whole-cluster review. Decouple-and-compose is the standing
bias (`we:docs/agent/backlog-workflow.md` → *separate and decouple*). **Lane packaging is NOT ruled here:**
whether the per-item builds pour into *one* lane serialized as a tree (design §3i "a tree serializes into one
lane by construction") or spread across free lanes is #2444/#2557/#2560's call — F1 fixes only that the *agent
build-unit* is the item, never the whole cluster.

```ts
// Fork 1 (a) — review-unit = cluster (a derived view over the item set); build-unit = ONE item per agent-run, WIP=1.
// buildQueue already emits ordered SINGLE items — the runner pulls the head, never a set:
const next = buildQueue({ next: true });               // we:scripts/backlog.mjs build-queue --next → one item
runner.spawn({ item: next.num, prompt: specOf(next) });// WIP=1, non-preemptive (#2527 slice 4, #2444)
// "Launch" on a CLUSTER = enqueue its ready frontier as per-item builds in dependency order — never one agent-run over N items.
// LANE PACKAGING (1 item vs a serialized tree per lane) is #2444/#2557/#2560's call, NOT ruled here.
// (b) excluded: runner.spawn({ items: cluster.members })  // one agent-run over the whole closure → un-reviewable, un-bounceable
```

`Skeptic:` **SURVIVES-WITH-AMENDMENT.** Attacked as "atomic cluster-build delivers a coherent feature in one
shot, fewer lane spin-ups." Refuted on merit, not effort: coherence is a *review* property (satisfied by
cluster-level review in (a)), not a build property; and the "fewer lanes" argument is a cost/throughput claim,
not a merit one — stripped per the not-a-prioritization rule. The load-bearing merit is that (b) forfeits
per-item bounce + per-item proof, which WIP=1 was ratified to provide. **Amendment folded:** the skeptic showed
the original phrasing smuggled in a false "one lane = one item = one PR" identity — the statute
`#primary-read-only-lanes-only` says only *lane→PR*, and design §3i has a *tree* serialize into one lane, so a
lane may hold several sequential single-item builds. Rewritten to rule only the *agent build-unit* (= item) and
to explicitly defer lane packaging + the wave-vs-trickle *scheduling* ([#2557]) downstream. `Screen:` **clear.**
Rules on an operator-observable contract (what an agent-run builds, what a PR contains, what can be bounced),
not a hidden impl detail; and under free-build the branches differ on a real merit axis (reviewability +
recoverability), not timing.

## Fork 2 — where `confidence` comes from

*Fork exists (representation either/or):* the item names three "sources" (agent-estimated / human-set /
derived), but those **compose** — they are three provenances of one number, not rival branches (research R10:
a human readiness assertion coexists with a computed one; R6: cheap agent pre-scoring seeds it). The real
either/or is the one that *cannot* coexist: is `confidence` a **stored field** (authored/overridable, with a
provenance tag) or a **purely derived value** (never persisted, recomputed each render)? A single value cannot
be both a stored authoring input and a pure projection — that is the single-source-of-truth axis, and it has a
concrete code shape (a frontmatter field vs a computed getter).

- **(a) a STORED, provenance-tagged `confidence` field with an explicit precedence rule.** The agent seeds it
  at prep (R6, always-available), a human may override it (R10 — the human-curation thesis the console is built
  on), and the proof backend ([#2562]) recomputes/refines it from real signals; the field records
  `by ∈ agent|human|derived` as the trust tier. **The three provenances are ordered nearest-wins — `human` >
  `derived` > `agent`** (the ordered-`extends`-chain pattern from `#config-extends-platform-default`, not an
  ad-hoc last-writer-wins): a human override is authoritative and a later `derived` recompute never silently
  overwrites it (it surfaces a "proof disagrees with your override" flag instead). The gate and the
  ascending-confidence review sort (R6) both read the resolved value. **DEFAULT.**
- (b) purely derived — no stored field; the gate computes confidence live from signals on every render.
  *Rejected:* it cannot carry a human override (R10) or a stable prep-time estimate — so the human-curation
  thesis is unenforceable and the number is unauditable (no provenance, no "who set this").

**Default (a).** A stored provenance-tagged field *with a precedence rule* is the only representation that lets
all three named sources *compose without drift* (agent seeds → human overrides → proof refines, nearest-wins)
while keeping the gate's input auditable and human-authoritative. It also degrades honestly: before [#2562]
exists the field carries `by: agent` (visibly a self-estimate, not proof), which the review surface can render
at its true trust tier rather than as false certainty. #2562's "confidence source wiring" plugs straight into
the `derived` layer of this field.

```ts
// Fork 2 (a) — confidence is a STORED, provenance-tagged WE backlog-schema field the gate/sort READ.
// today NO such field exists: we:scripts/check-backlog-item.mjs:118-141 validates only tier/rank/buildQueued.
---
confidence: { agent: 0.7, human: 0.9, derived: null }   # nearest-wins precedence: human > derived > agent
---
// resolve(confidence) = human ?? derived ?? agent  → the value the gate/sort read (the trust tier = which layer won)
// agent seeds at prep (R6) → human may override (R10, authoritative) → #2562 fills `derived`; a derived value that
// disagrees with a set `human` flags "proof disagrees", it does NOT overwrite (R10 human-authority preserved).
// (b) excluded — a pure getter, never stored:
//   confidence(item) => compute(item.size, blockerDepth, proofCoverage)  // no override, no prep seed, no provenance
```

`Skeptic:` **SURVIVES-WITH-AMENDMENT.** Attacked on classification first: "this is a config dimension
(`config-extends-platform-default`), not a fork — decline vs throw in disguise." Refuted: the *threshold* is a
config dimension (correctly out of scope — see the axis framing), but the *representation of the value the gate
reads* is a genuine either/or with a broken branch (pure-derived can't hold a human override). **Two amendments
folded:** (1) the skeptic showed the original "three sources" framing was a false trichotomy — rewritten so (a)
*absorbs* all three provenances into one stored field and (b) is the real excluded branch; (2) the skeptic then
showed that "three writers, one field" with no arbiter is itself the drift single-SoT forbids — added an
explicit **nearest-wins precedence** (`human > derived > agent`, borrowing the ordered-`extends`-chain from
`#config-extends-platform-default`) so a proof recompute never silently overwrites a human override. **The
(b)-rejection's original "no signal until #2562" clause was struck** (a timing crutch the two-confusion screen
flagged — the fork stands on override + auditability alone). **Statute-overlap — reconciled:** the codified
claim would be *"a launch/prioritization signal a human can set is stored, not purely derived; provenance
layers resolve nearest-wins"*; grepped `we:docs/agent/platform-decisions.md` — the same-turf anchors are
`#single-authoring-sot-derived-projection` (one authoring home; a derived form never becomes a second authoring
home) and `#config-extends-platform-default` (the nearest-wins layering pattern). No collision — (a) *applies*
both: the stored field is the single authoring home, and the `derived`/`agent` seeds write *into* ordered layers
rather than standing up a rival value. `Screen:` **clear.** Consumer-observable (the operator sees the number,
its winning provenance tier, and can override it) and merit-bearing under free-build (auditability + human
authority + drift-free layering vs an unbacked computed number), not timing.

## Fork 3 — structured spec fields vs prose

*Fork exists (genuine either/or, sharpened by the same-day [#2564]):* the excluded branch — **requirements
stay prose the agent re-interprets on every build** — is *broken*: prose is not machine-diffable, so *"did this
build satisfy requirement R?"* reduces to a human eyeballing a text-diff — the exact non-determinism [#2564]
ratified-in-discussion (2026-07-18) we must not inherit (*"prose specs are not machine-diffable; schema-as-spec
is"*), and [#2562] would have no stable R-id to attach evidence to. So the coherent shape is a **structured,
machine-checkable requirement contract** — but authored *without* standing up a hand-maintained second home
beside the item's prose (the single-SoT trap that
`we:docs/agent/platform-decisions.md#single-authoring-sot-derived-projection` forbids).

- **(a) the requirement rows R1..Rn ARE the machine-checkable conformance contract — seeded by extraction from
  the item's acceptance prose, then human-reviewed and frozen at launch.** Authoring stays ergonomic (you draft
  the item in markdown prose, as the backlog always has — `we:docs/agent/backlog-workflow.md`); an extraction
  pass *seeds* structured rows from that prose; a human reviews/edits them (the new-spec-candidate accept/reject
  loop, design §3e — [#2564]'s *human-gates-spec*); at launch the rows **freeze with stable ids** and become
  the authoritative contract [#2562] attaches evidence to. Prose remains the human-readable rendering, kept in
  sync (**rows canonical**) by the round-trip invariant. Extraction is **exclude-never-fabricate** (an ambiguous
  passage yields no row — a surfaced gap — never a fabricated requirement). **DEFAULT.**
- (b) requirements stay prose the agent interprets per build; no frozen structured contract. *Rejected:* not
  machine-diffable ([#2564]) → non-deterministic proof, and [#2562] has no stable target, so the launch gate's
  "spec-proven R1..Rn" is unbacked.

**Default (a).** This is the synthesis of three grounds: [#2564]'s *schema-not-prose + human-gates-spec* (the
frozen, human-reviewed rows are the deterministic contract); single-SoT (the rows are *seeded/derived* from the
prose draft, never a hand-authored parallel home — prose stays a draft pre-freeze, a derived rendering
post-freeze, one canonical contract); and *faithful-derivation* (the lossy prose→rows seed *excludes* rather
than fabricates). The frozen rows give [#2562] the stable machine-checkable target its whole proof surface
needs. The row schema is a provider-agnostic shape (it must survive a Jira/Linear item mapping its acceptance
into the same rows — the [#2558] seam), so it carries no WE-CLI specifics.

```ts
// Fork 3 (a) — the FROZEN requirement rows ARE the machine-checkable conformance contract (#2564: schema-not-prose);
// SEEDED by extraction from the item's acceptance prose (backlog stays markdown-authored — we:docs/agent/backlog-workflow.md),
// human-reviewed (design §3e, #2564 human-gates-spec), then FROZEN with stable ids at launch so #2562 attaches proof.
requirements: [                                   // authoritative once frozen; prose is the derived human-readable rendering
  { id: "R1", text: "invalid input shows the inline error", source: "acceptance-p2", proof: null }, // #2562 fills proof + tier
  { id: "R2", text: "retry re-runs the submit",             source: "acceptance-p3", proof: null },
]
// exclude-never-fabricate (we:docs/agent/platform-decisions.md#faithful-derivation-exclude-not-fabricate): ambiguous prose → NO row (a gap), never invented.
// round-trip: a human edit to R1.text re-renders acceptance-p2 (ROWS canonical) — not a silent 2nd authoring home (single-SoT).
// (b) excluded — requirements stay prose the agent re-interprets each build: not machine-diffable → non-deterministic proof, no stable R-id.
```

`Skeptic:` **SURVIVES-WITH-AMENDMENT (reframed against the same-day [#2564]).** The original default made
*prose* the authoring SoT and the rows a lossy derivation; the skeptic's citation-scope hit **and** [#2564]'s
ratified-in-discussion *"schema-not-prose, human-authors-spec"* both showed that leaves the *conformance
contract* as non-machine-diffable prose — the non-determinism #2564 exists to remove. **Amendment folded:**
flipped so the **frozen, human-reviewed structured rows are the contract**, *seeded* from prose (backlog
ergonomics preserved) rather than hand-authored as a parallel home (single-SoT preserved). **Citation-scope —
corrected:** the lossy prose→rows extraction is governed by `#faithful-derivation-exclude-not-fabricate` (owns
the lossy boundary), with `#single-authoring-sot-derived-projection` **supporting** (one canonical home = the
frozen rows; prose is the derived rendering) — the original mis-cited single-SoT (authored for a *lossless*
structured→serialized case) as authority. **Round-trip invariant** keeps the human accept/**edit** loop from
re-opening a second home (rows canonical, prose re-renders). **Seam:** F3 delivers exactly the machine-checkable
requirement contract [#2564] wants *at the item layer*; [#2564]'s own open forks (which WE artifact is the
*central* contract; the mechanical contract-line granularity) operate at the durable-standard layer and are
**not** ruled here. `Screen:` **clear.** Rules on a WE-schema contract observable to every consumer (the row
shape + its ids), not an impl detail; merit difference under free-build is determinism + single-source-of-truth,
not effort.

## Fork 4 — constitution: single artifact vs index, and how it's injected

*Fork exists (forced invariant):* the excluded branch — **author a standalone constitution artifact (a new,
hand-maintained `CONSTITUTION` doc that copies rules)** — is *broken*: it stands up a **second authoring home**
for rules that already live in the statute layer (`we:docs/agent/platform-decisions.md`), the WE standards, and
`we:AGENTS.md` — the drift `we:docs/agent/platform-decisions.md#single-authoring-sot-derived-projection`
forbids, and a direct duplicate of the layer whose entire reason to exist was to stop rules living in two places
(`we:docs/agent/platform-decisions.md` intro: the 64%-case-law-only problem). This holds *regardless of sync
state* — a standalone constitution violates the ratified single-authoring-SoT precedent even if perfectly
maintained, so the rejection is precedent-consistency, not a drift-cost argument.

- **(a) no new authoring home + a build-time DERIVED COMPACT PROJECTION as the injected form.** The item's spec
  carries a machine-readable *index* of the specific anchors it inherits (a `we:docs/agent/platform-decisions.md`
  anchor, a standard id, a `we:AGENTS.md` section) — pointers, never copied text. The **injected** constitution
  is a *derived compact projection*: at build/launch the runner **generates a small floor** from exactly the
  indexed anchors (regenerated every build, so it never drifts from the statute) and injects that — rather than
  making the agent navigate the ~2,700-line statute on demand to honor a bare pointer. This is precisely the
  *"derived, non-authoritative discovery view"* shape (never a rival authoring home). The base repo context
  still arrives the way it always does — the #2444 runner spawns `claude -p` **inside the lane clone**, which
  auto-loads `we:CLAUDE.md` → `we:AGENTS.md` (the always-loaded router, `we:AGENTS.md:3-6`) → `docs/agent/*.md`
  on demand. **DEFAULT.**
- (b) author a curated standalone constitution artifact (a hand-maintained second home). *Rejected on
  precedent-consistency first:* a second authoring home for rules the statute already owns violates
  single-authoring-SoT even if kept in sync; and it forfeits the machine-readable "inherits N invariants" list
  a review surface needs (a hand-authored blob is opaque to the console).

**Default (a).** "Elevate, don't reinvent" (design §3b) is the statute's own promotion discipline: the rules are
*already* the constitution. F4's contribution is a **contract**, not a document: (i) no second authoring home;
(ii) an item carries a machine-readable **index** of inherited anchors (a WE-schema addition — so the review
surface shows "inherits N invariants" and the runner knows exactly what to project); (iii) the *injected* floor
is a **derived compact projection** generated from those anchors at build, regenerated so it can't drift. The
index field is the **inverse of `codifiedIn`** (already on resolved decisions): `codifiedIn` points *from* a
ruling *to* the anchor it wrote; `constitution:` points *from* a build item *to* the anchors it inherits — same
item↔anchor substrate, opposite direction, no collision. The exact prompt-wiring (how the projection is phrased
into the `-p` context) is a runner impl detail owned by #2444/#2530.

```ts
// Fork 4 (a) — no new authoring home: a machine-readable INDEX of inherited anchors (inverse of `codifiedIn`).
constitution: [                                     // pointers into the statute layer — never copied rule text
  "we:docs/agent/platform-decisions.md#native-first-baseline",
  "we:docs/agent/platform-decisions.md#primary-read-only-lanes-only",
  "we:AGENTS.md#hard-rules",
]
// INJECTED form = a build-time DERIVED COMPACT PROJECTION of exactly those anchors (regenerated each build → drift-free):
//   buildConstitutionFloor(item.constitution) => compactFloor   // the "derived, non-authoritative discovery view" shape
// base repo context still auto-loads: #2444 runner spawns `claude -p` IN the lane clone → we:CLAUDE.md → we:AGENTS.md → docs/agent/* on demand.
// (b) excluded — a hand-authored standalone constitution doc: a 2nd authoring home + opaque to the review surface.
```

`Skeptic:` **SURVIVES-WITH-AMENDMENT** (was borderline-refuted; three fixes folded). **(1) Citation-scope —
downgraded:** the original cited `#config-extends-platform-default` as *authority* ("already ruled the analogous
shape"), but that anchor's rejected "unified authoritative artifact" is specifically a *unified config FILE*
across multi-strategy config dimensions (god-schema + format lock-in) — a governance constitution is not a
config dimension, so it's a supporting *analogy*, not authority. The anchor that actually *reaches* is
`#single-authoring-sot-derived-projection` (a copied doc = a second authoring home), now the governing
citation. **(2) False binary closed:** the skeptic showed the cited clause authorizes a *third* option the
original excluded — a **derived, non-authoritative view**; folded it into (a) as the injected form (a build-time
compact projection), which also answers the "bare index into a ~2,700-line statute is not a *compact* floor"
objection (design §3b wants a small floor "so specs stay small"). **(3) Schema reconciled:** the new
`constitution:` field is the directional inverse of the existing `codifiedIn` — stated in the default so they
don't read as rival item↔anchor fields. **Statute-overlap — reconciled:** the codified claim is *"the build-time
constitution is the existing statute/standards/router cluster, referenced by a machine-readable index and
injected as a derived compact projection — never a new authoring home"*; no collision with
`#single-authoring-sot` or `#config-extends-platform-default` — (a) *applies* both. `Screen:` **flagged(impl) →
fixed.** The fresh-context screen caught the injection sub-question ruling on an implementation detail (the
precise prompt-prepend mechanism is invisible across the boundary); fixed by ruling on the observable contract
(no second authoring home; a machine-readable index; a derived compact projection as the injected floor) and
deferring the prompt-wiring mechanics to #2444/#2530. The screen also flagged the (b)-rejection resting on
drift-cost; re-led it with precedent-consistency + the machine-readable index.

## Context

### Supported by default (not decisions)
- **The confidence *threshold* is a config dimension**, not part of F2: per
  `we:docs/agent/platform-decisions.md#config-extends-platform-default` the launch gate's `confidence ≥ X` bar
  is a per-program platform-config value (default = most-permissive), not a ratifiable pick. F2 rules only the
  *source* of the number the threshold compares against.
- **The three confidence provenances compose** (agent seed · human override · proof-derived) — they are not
  rival branches; F2 (a) is the one field that carries all three via `by:`.
- **Auto-merge on green proof (design §3f F5) is explicitly out of scope here** — it stays open, gated on the
  #539 governance epic + trustworthy proof ([#2562]). F1–F4 settle the substrate; F5 is a separate call.

### Seams (do not resolve here)
- **[#2557] queue scale & ordering** owns the *wave-vs-whole-cluster launch* scheduling of the per-item builds
  F1 (a) produces, plus the DAG frontier + cleared-set ordering + lane namespace. F1 fixes only the *unit*.
- **[#2558] provider-agnostic adapter seam** owns the read/write interface; F2's `confidence` field and F3's
  requirement-row schema must be expressible in the provider-agnostic domain model it defines (no WE-CLI
  specifics), so a later Jira/Linear adapter maps into the same shapes.
- **[#2562] proof-production backend** consumes F3's frozen R1..Rn rows (attaches provenance-tiered evidence)
  and F2's `confidence` field (the "confidence source wiring" — feeds real signals into the `derived` layer). It
  is `blockedBy` this item.
- **[#2564] spec-based programming** is the durable-standard-layer direction F3 realizes at the item layer
  (schema-not-prose, human-gates-spec). Its own open forks — which WE artifact becomes the *central* contract,
  and the mechanical contract-line granularity — are **not** ruled here; F3 only fixes the per-item requirement
  contract the proof surface consumes. F4's "index into the statute cluster, no second home" likewise matches
  [#2564]'s central-contract-repository finding (contracts live in WE; downstream reference, never own).

## Acceptance
Each fork ruled with its downstream implication named (F1→runner contract = item build-unit + cluster review;
F2→launch-gate source = stored provenance-tagged field with nearest-wins precedence; F3→proof schema = frozen,
human-reviewed requirement rows seeded from prose; F4→agent-context = indexed statute cluster injected as a
derived compact projection); [#2562] (proof backend) and [#2555] (board) can then build against settled
contracts.
