# Backlog split analysis — 2026-07-02

Focused run: `/slice 2079`.

---

# `/slice 2079` — Author W3C-spec-shaped normative standards for every WE standard

Unsliced epic (`kind: epic`, `size: 13`, no children). Rubric (1) settled at the parent level; the body's
seed decomposition is "skeleton first, then one slice per standard".

## Work-investigation pass

The body's "every current standard" was verified against the real registry surface — and its seed
decomposition ("one slice per standard") does not survive contact with it:

- **"Every current standard" enumerates to 279 registry entries** across four one-file-per-standard
  registries: **81 blocks** (`we:src/_data/blocks/`, loader `we:src/_data/blocks.js:1-18`), **98 intents**
  (`we:src/_data/intents/`, `we:src/_data/intents.js:1-15`), **59 plugs** (`we:src/_data/plugs/`,
  `we:src/_data/plugs.js:1-12`), **41 protocols** (`we:src/_data/protocols/`,
  `we:src/_data/protocols.js:1-12`). "One slice per standard" would author ~279 stories at once — the
  explosion the conservative instinct refuses.
- **Current write-up depth is wildly uneven, and mostly too thin to spec.** A block has a JSON descriptor
  + njk prose (`we:src/_data/blocks/button.json:1-28` + `we:src/_includes/block-descriptions/button.njk:1-36`);
  an intent is JSON-only with an inline HTML description (`we:src/_data/intents/action.json:1-68`); a plug is
  a **10-line bare registry entry** (`we:src/_data/plugs/customattribute.json:1-10`); a protocol is an
  8-line JSON pointing at a section of its owning project page
  (`we:src/_data/protocols/analytics-vocabulary.json:1-8`). Project-level statuses are 17 `concept` / 4
  `draft` / 23 `poc` (`we:src/_data/projects/*.json`). A normative MUST/MUST-NOT spec for a 10-line `poc`
  stub is not authoring — it's undone design work in disguise.
- **Zero RFC-2119 language exists in any standard today.** Grep across all four registry dirs: no
  MUST/SHALL/SHOULD. Normative rules exist only in the governance layer
  (`we:docs/agent/block-standard.md:96-129`, gate `we:scripts/check-standards.mjs`) — centralized, not
  per-standard.
- **The shape template is real and citable.** The #2074 conformance table — enumerated well-formed
  natures + typed `define()` errors (`AmbiguousPayloadError`, `MissingRegionCloseError`,
  `DelimiterCollisionError`, warn-cases) — lives at
  [we:backlog/2074-customnoderegistry-node-kind-extensibility-standard.md:145-162](../backlog/2074-customnoderegistry-node-kind-extensibility-standard.md),
  codified rules at `we:docs/agent/block-standard.md:554-576`. It self-describes as "the conformance spine a
  spec-shaped write-up (epic #2079) turns into normative MUST/MUST-NOT prose".
- **No skeleton, no house style, no home exists.** There is no spec-skeleton template anywhere
  (`we:docs/agent/` is schema reference, not authoring template), and no decided surface for where a
  per-standard normative spec would live (njk description section? new markdown collection? JSON field?).
  #1792 (resolved) built a read path for `we:docs/agent/*` governance prose, not per-standard specs — the
  closest catalog precedents are the protocols index-only shape (`we:src/protocols.njk:50-75`) vs. the
  research-topic detail-page shape (`we:src/research-topic-pages.njk:1-11`).

## Verdict — partial split (roadmap epic; most mass is design-gated)

The epic buries **two real forks** the seed decomposition skips over:

1. **Home + form** — where a normative spec lives and in what format (per-standard file? njk section? a
   new collection with a gate?), plus the skeleton house style itself (section order, RFC-2119
   boilerplate, conformance-class + error-model convention, IDL convention).
2. **Scope + maturity policy** — which of the 279 owe a spec at which status tier. Speccing `concept`/`poc`
   stubs normatively is premature; a maturity ladder (e.g. `active` blocks first, stubs exempt until
   designed) decides the actual work-list — and therefore the contents of every downstream slice.

Per rubric (1) these cannot be split away — they are carved into a `kind: decision` card, and everything
downstream of them stays could-not-split-here.

## Could split — #2079 (executed 2026-07-02: D = #2096, P = #2097)

| slice | kind | size | home | scope |
|-------|------|------|------|-------|
| **D = #2096** Spec register — home, skeleton house style, scope policy | decision | 3 | webeverything backlog | The two forks above (+ pilot choice). Goes through `/prepare` → ratify; codify step authors the skeleton doc + RFC-2119 boilerplate. |
| **P = #2097** Pilot spec — CustomNodeRegistry (#2074) | story | 3 | per D's home ruling | Apply the ratified skeleton to the one standard whose conformance spine already exists (`we:backlog/2074-customnoderegistry-node-kind-extensibility-standard.md:145-162`). Demoable: a rendered spec-shaped write-up + gate green; becomes the worked example every wave copies. `blockedBy #2096`. |

### DAG

```
#2096 → #2097 → (future per-category waves — not carved yet, see below)
```

A 2-chain, but incremental delivery is genuine: D resolves as statute value on its own (the skeleton +
scope policy), P ships a demoable worked example. Both are agent-ready-able (D via `/prepare`, P batchable
once D lands).

## Could not split (here) — the authoring waves

| scope | rubric condition failed | unblocking action |
|-------|-------------------------|-------------------|
| Per-category authoring waves — blocks (81) · intents (98) · plugs (59) · protocols (41) | **(1) design-gated** — their work-list (which entries owe a spec) and their unit shape (per-standard? per-cluster?) are both decided by D's scope policy; carving sub-epics now would scaffold shells whose contents an open decision still controls. Also (3): per-slice sizes unknowable until the pilot calibrates effort-per-spec. | **Resolve D, land pilot P, then re-run `/slice 2079`** — it then carves per-category sub-epics (roadmap mode, each a future `/slice` candidate) sized against the pilot's measured effort and D's maturity ladder. |

The gating is encoded in the DAG, not left buried: on execution the epic's body is refreshed to umbrella
framing with a pointer to D, and D's card carries the forks.

## Execution notes (executed 2026-07-02)

- #2079 is already an epic — no story→epic conversion; its residual `size: 13` dropped (sized
  children would double-count; `check:standards` errors).
- Scaffolded D → **#2096** (`--kind=decision --size=3`) and P → **#2097** (`--kind=story --size=3
  --blocked-by=2096`), both `--parent=2079`.
- #2079's digest refreshed to umbrella framing; gate green; backlog count +2.
