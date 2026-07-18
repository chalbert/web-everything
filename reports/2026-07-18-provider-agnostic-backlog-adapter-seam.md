# Provider-agnostic backlog adapter seam — prep session report (#2558)

*Date: 2026-07-18. Prepared decision under the Plateau Loop program (#2527). Ratifies the shape of a seam that
already exists in embryo; does NOT build a second provider. Companion `/research/` topic:
[provider-agnostic-backlog-adapter-seam](/research/provider-agnostic-backlog-adapter-seam/).*

## What this decision is

An **interface-definition** decision: name and enforce the read port, the write port, and the domain
interlingua the backlog console codes against, so the north-star (support Jira/Linear/GitHub alongside the WE
backlog, and bridge between them — [design doc §6b](../docs/design/backlog-console-design.md)) becomes "add an
adapter," not "rewrite the console." The directive "do NOT build multi-provider now" is unenforceable without a
named boundary; this makes it a named boundary + a lint.

## Grounding — the seam is already half-built

The console is already a two-layer split, and the client is already clean:

- Browser views only `fetch('/api/backlog/*')`; a Node dev-middleware (`plateau:vite.config.mts` `backlogApi`,
  `:488-752`) is the *only* code touching disk / shelling the WE CLI / calling `gh`.
- The `?repo=` / REPOS registry already selects a data source: `RepoRegistry = Record<string,string>` +
  `resolveRepo` (`plateau:src/backlog-view/loader.ts:26-39`); one entry today
  (`plateau:vite.config.mts:489`).
- Reads: `loadBacklog` disk-parses the item files (`plateau:src/backlog-view/loader.ts:49-81`); the queue shells
  the WE CLI `we:scripts/backlog.mjs build-queue --json` (`plateau:src/backlog-view/queue-read.ts:58`); the
  overlay shells `gh` (`plateau:src/backlog-view/overlay.ts`).
- Writes already ride lane→PR: `runWriteFlow` (`plateau:src/backlog-view/write-action.ts:237-269`) acquires a
  lane via `we:scripts/lane-pool.mjs`, runs the lane's own `we:scripts/backlog.mjs <verb>`, gates on
  `check:standards`, and opens a ready-to-merge PR the drain merges.
- The wire contract already exists: `BacklogItemDTO` (`plateau:src/backlog-view/types.ts:10-39`).

What is missing: (a) a repo-registry entry richer than a bare path string; (b) a single named provider
interface behind the four ad-hoc read/write implementations. This decision names both and fences views to them.

## Prior art — the statute analog

WE already ratified this exact pattern for another surface:
[we:docs/agent/platform-decisions.md#ssr-external-io-standard-renderers-conform](../docs/agent/platform-decisions.md#ssr-external-io-standard-renderers-conform)
(#2030) — a rendering surface's *externally-observable I/O* is the WE standard; the *renderer* is a conforming,
swappable impl behind the wire-format seam. This decision is that black-box-conformance principle applied to
backlog data access: the DTO wire shape + write contract are the standard; the adapter is the swappable impl.
It composes with
[we:docs/agent/platform-decisions.md#primary-read-only-lanes-only](../docs/agent/platform-decisions.md#primary-read-only-lanes-only)
(writes ride lane→PR) and
[we:docs/agent/platform-decisions.md#constellation-placement](../docs/agent/platform-decisions.md#constellation-placement)
(contract/types → standard side; adapter impl → plateau-app). No same-turf statute collision was found — this
is a sibling instance, not a competing rule.

## No multi-branch fork survived — two rulings

The standing test dissolved both candidate forks; each became a classification ruling.

**Ruling A — seam form (support-both, high confidence).** Is the console-facing seam the **HTTP/DTO wire
contract** (`/api/backlog/*` + `BacklogItemDTO`) or a **typed in-process `BacklogProvider` TS interface**? The
composability probe passes — the TS interface is a `fetch()` facade over the wire contract — so they **coexist**;
this is support-both, not an either/or. **Ruling: the wire contract is the ratified primary seam** (language-
agnostic, provider-agnostic by construction, the zero-cost incumbent), with the `BacklogProvider` TS interface
supported *behind* it. JS-coupling a cross-system portability contract would add server-side coupling to an
already-clean client for no gain.

**Ruling B — interlingua = WE schema; mint the core `@webeverything/contracts/backlog` NOW (med-high).** The
prep first framed this as a fork (document-and-defer vs. mint-now) with a *defer* default. Both adversarial
passes dissolved it, and the skeptic **refuted the defer direction** by surfacing the governing anchor the prep
missed: the **interchange-schema temporal-rule clarification** (`we:docs/agent/platform-decisions.md:435`,
#1437). For an *interchange schema*, "a second independent impl" is satisfied by **external convergent prior
art** — N≥2 incumbents already emitting the same shape ⇒ **mint the core now + an open extension slot, don't
wait for WE to ship two impls.** Jira/Linear/GitHub/WE-backlog are N≥4 convergent incumbents on the core
(status lifecycle · epic/story ladder · parent · blocking-link). The precondition is already met; `#constellation-placement`
rule 3 already names `@webeverything/contracts` as the end-state; and `plateau:src/backlog-view/types.ts` is
*already* a cross-repo byte-replica, so a second consumer exists today and minting the package **reduces**
drift. **Ruling: mint the core WE contract package now + a `providerExt` extension slot; the mint is a spin-off
build `blockedBy` this decision — NOT deferred to a first foreign adapter** (that was the struck
"wait-for-a-WE-internal-2nd-impl" mis-read).

## Ratified invariants (not forks)

- **R1** — every write rides lane→PR; the primary tree is read-only (`#primary-read-only-lanes-only`).
- **R2** — view/client code depends only on the seam (DTO/HTTP), never a bare CLI/disk/`gh` source; the
  acceptance lint keeps this true and fences the Node-side view-adjacent code too.
- **R3** — the seam is a black-box conformance contract; adapters are swappable impls behind it (the
  backlog-data-access instance of the SSR-I/O anchor). Placement: contract/types → standard side; adapter impl
  → plateau-app.

## Adversarial passes

- **Two-confusion screen (fresh context):** seam-form `clear`; interlingua `flagged(prio)` → **dissolved** (not
  a ratifiable fork — merit conceded).
- **Skeptic (refute-only, 4 axes):** seam-form SURVIVES-WITH-AMENDMENT (reframed to support-both / ratify-the-frame;
  the merit attack failed because the wire seam is the zero-cost incumbent). Interlingua **REFUTED** — the
  authored *defer* default was flipped to **mint-core-now** on the interchange-schema temporal rule
  (`we:docs/agent/platform-decisions.md:435`) + `#constellation-placement` rule 3, which the prep had missed.
  Statute-collision guardrail folded in: do NOT mint a new anchor at resolve — cite `#ssr-external-io-standard-renderers-conform`
  + `#constellation-placement` + `#primary-read-only-lanes-only`.

## Cross-references (not ruled here)

- **#2561 Fork 3** (structured-spec-vs-prose): the item spec must be expressible through this read port (a
  field on `BacklogItemDTO`); this decision fixes the carrier, #2561 fixes the spec shape.
- **#2555** (board slices): the first consumer that codes against the seam; inherits the R2 lint.

## Net

No multi-branch fork survived the standing test. Two rulings (seam form = the HTTP/DTO wire contract,
support-both; interlingua = the WE schema minted as `@webeverything/contracts/backlog` core-now + extension
slot) and three ratified invariants (R1 lane→PR · R2 views-code-against-the-seam · R3 black-box conformance).
Ready to ratify.
