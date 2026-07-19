---
bornAs: xj495sr
kind: decision
size: 3
parent: "2527"
status: resolved
dateOpened: "2026-07-18"
dateResolved: "2026-07-19"
codifiedIn: one-off
preparedDate: "2026-07-18"
tags: [plateau-loop, console, adapter-seam, provider-agnostic, architecture]
relatedReport: reports/2026-07-18-provider-agnostic-backlog-adapter-seam.md
---

# Provider-agnostic backlog adapter seam

**This is an interface-*definition* decision, not a build, and — after the standing test — it carries no
multi-branch fork.** It names and enforces the read port, the write port, and the domain interlingua the
backlog console codes against, so the north-star (multiple backlog systems + bridging — [design doc
§6b](docs/design/backlog-console-design.md)) becomes "add an adapter," not "rewrite the console." It does
**not** build a second provider. Both candidate "forks" resolved by classification against statute: the
seam-form question is **support-both** (the two shapes compose), and the interlingua-home question is
**accept-on-merit** (an interchange-schema statute rule fires *now*). So what the decider ratifies is the
**frame** — the named seams + the rulings + three invariants — grounded in a prior-art check published as
[/research/provider-agnostic-backlog-adapter-seam/](/research/provider-agnostic-backlog-adapter-seam/) (session
report linked via `relatedReport`).

**Grounding digest — the seam is already half-built; this ratifies its shape.** The console is *already* a
two-layer split: browser views that only `fetch('/api/backlog/*')`, and a Node dev-middleware
(`plateau:vite.config.mts` `backlogApi`, `:488-752`) that is the *only* code touching disk / shelling the WE
CLI / calling `gh`. The client `.ts` view code is **already clean** — no view imports the CLI or the disk
loader (`plateau:src/backlog-view/backlog-view.ts:12-18` imports only types + client modules). What is missing
is (a) a repo-registry entry richer than a bare path string (today `RepoRegistry = Record<string,string>`,
`plateau:src/backlog-view/loader.ts:26`) and (b) a *single named provider interface* — today read-from-disk
(`plateau:src/backlog-view/loader.ts`), read-via-CLI (`plateau:src/backlog-view/queue-read.ts`), read-via-`gh`
(`plateau:src/backlog-view/overlay.ts`), and write-via-lane→PR (`plateau:src/backlog-view/write-action.ts`) are
four independent implementations the middleware calls by hand. This decision *names* the seam those four sit
behind and *fences* view code to it.

## What this decides — and what it does not

**Decides / defines:** the console-facing **read port** (list · detail · overlay · queue, over the `?repo=`
registry), the single **write port** (every mutation rides lane→PR), the **interlingua** (statuses · kind
ladder · connection graph) each foreign system maps into, and the **enforcement lint** (views never reach a
bare CLI/disk source). It also **rules** that the interlingua core is minted as a WE contract package now (a
spin-off build, below). **Does not:** build a Jira/Linear/GitHub adapter, change any view's behaviour, or
migrate the WE backlog off markdown.

## The seam today — axis-framing pinned to the real tree

Each seam element is pinned to the code that already embodies it (cross-repo `plateau:` refs are plain text;
in-repo `we:` refs link):

- **Registry / `?repo=` axis** — `RepoRegistry = Record<string,string>` + `resolveRepo(registry, requested, default)`
  (`plateau:src/backlog-view/loader.ts:26-39`); one entry today (`REPOS = { webeverything: weRoot }`,
  `plateau:vite.config.mts:489`, `DEFAULT_REPO`, `:492`). `?repo=` is read server-side
  (`plateau:vite.config.mts:571`) and client-side (`plateau:src/backlog-view/backlog-view.ts:48-54`); the
  picker lists `GET /api/backlog/repos` (`plateau:vite.config.mts:531-534`).
- **Read axis** — client `fetch('/api/backlog?repo=…')` (`plateau:src/backlog-view/backlog-view.ts:1058`),
  `/api/backlog/detail` (`:761`), `/api/backlog/overlay` (`:680`), `/api/backlog/queue`
  (`plateau:src/backlog-view/queue-view.ts:270`). Server resolves each to `loadBacklog`
  (`plateau:vite.config.mts:745` → `plateau:src/backlog-view/loader.ts:49-81`, disk-parse of the item files),
  `loadItemDetail`, `loadOverlay` (shells `gh`), `readBuildQueue` (shells the WE CLI
  `we:scripts/backlog.mjs build-queue --json`, `plateau:src/backlog-view/queue-read.ts:58`).
- **Wire contract axis** — `BacklogItemDTO` (`plateau:src/backlog-view/types.ts:10-39`: `id · num · slug ·
  title · summary · status · kind · size · tags[] · parent · blockedBy[] · priority`) — already a cross-repo
  byte-replica of the WE domain vocabulary; `BacklogResponse` (`:80-89`), `OverlayMap` (`:67-77`).
  Dependency-free; imported by both client and loader — the natural adapter output type.
- **Write axis** — client `POST /api/backlog/write { id, verb, value }`
  (`plateau:src/backlog-view/backlog-view.ts:843`) → server (`plateau:vite.config.mts:576-647`, verb-validated
  against `WRITE_VERBS`, `:497`) → `runWriteFlow` (`plateau:src/backlog-view/write-action.ts:237-269`):
  `we:scripts/lane-pool.mjs acquire` → reset to `origin/main` → the **lane's own**
  [we:scripts/backlog.mjs](scripts/backlog.mjs) `<verb>` → `npm run check:standards` → commit →
  `gh pr create --label ready-to-merge`. The external drain merges. (It opens a ready-to-merge PR; it does
  **not** call [we:scripts/pr-land.mjs](scripts/pr-land.mjs).)
- **Interlingua axis** — the canonical domain model already lives in the WE backlog schema
  ([we:src/_data/backlog.js](src/_data/backlog.js) + the frontmatter contract in
  [we:docs/agent/backlog-workflow.md](docs/agent/backlog-workflow.md)): statuses `open/active/resolved`
  (+ transient `preparing`/`parked`), kinds `epic/story/task/decision`, connections `parent` (single) +
  `blockedBy` (array), resolved-only `graduatedTo`/`codifiedIn`, provenance `bornAs`
  ([design doc §2c/§2d](docs/design/backlog-console-design.md)).

## Ratify at a glance

No multi-branch fork survived the standing test. Ratify the frame, or override a ruling.

| Ratify point | Ruling | Why it is not a fork | Confidence |
|---|---|---|---|
| **Seam form** | The **HTTP/DTO wire contract** (`/api/backlog/*` + `BacklogItemDTO`) is the ratified console-facing seam; a server-side `BacklogProvider` TS interface is **supported behind** it | **Support-both** — the composability probe passes (the TS interface is a facade over the wire contract), so they coexist; the only call is which is *primary*, and R3 + the already-clean client settle that | **High** |
| **Interlingua home** | The interlingua **is** the WE-backlog schema; **mint the core `@webeverything/contracts/backlog` package now** (WE type-only) + an **open extension slot** for per-provider divergences — a spin-off build | **Accept-on-merit** — the interchange-schema temporal rule fires *now* on N≥2 convergent public incumbents; not a ratifiable either/or (dissolves per #2092) | **Med-high** |
| **Invariants R1–R3** | writes ride lane→PR · views code only against the seam · the seam is black-box conformance | Forced by statute (cited below) | **High** |

## Ruling (2026-07-18)

Ruled by the human on 2026-07-18. This is a define+ratify decision — no multi-branch fork survived prep — so the ruling ratifies the frame: the two named rulings + the three invariants.

- **Ruling A — seam form → RATIFIED.** The HTTP/DTO wire contract is the **primary** console-facing seam: the read surface `/api/backlog/*` plus the write surface `POST /api/backlog/write { id, verb, value }`. The in-process TypeScript `BacklogProvider` interface is **supported behind it as a facade** — never the primary contract. A foreign adapter is an endpoint in any language; the client only ever sees DTOs.

- **Ruling B — interlingua home → RATIFIED (mint-now).** Mint the core `@webeverything/contracts/backlog` package **now** (type-only, from the vocabulary the WE backlog schema already fixes) plus an open `providerExt` extension slot for per-provider divergences. Mint-now is warranted by the interchange-schema temporal rule (`we:docs/agent/platform-decisions.md#constellation-placement`, the clarification at `:435`, `#1437`): for an interchange schema, "a second independent impl" is satisfied by external convergent prior art (Jira · Linear · GitHub Issues · WE backlog are N≥2 convergent incumbents on the core), so the core is minted now rather than deferred to a first foreign adapter. The spin-off package build is filed this session as a separate item (`blockedBy #2558`), slug `mint-webeverything-contracts-backlog` (a hash-id item the drain will number).

- **R1–R3 invariants → CONFIRMED (cite existing anchors; mint NO new one).**
  - **R1 — writes ride lane→PR; the primary tree is read-only.** Cite `we:docs/agent/platform-decisions.md#primary-read-only-lanes-only`.
  - **R2 — view/client code depends only on the seam (DTO/HTTP), never a bare CLI/disk/`gh` source.** The acceptance lint; already true client-side, kept true and extended to the Node-side view-adjacent code.
  - **R3 — the seam is a black-box conformance contract; adapters are swappable impls behind it.** Cite `we:docs/agent/platform-decisions.md#ssr-external-io-standard-renderers-conform`; placement follows `we:docs/agent/platform-decisions.md#constellation-placement` (contract/types → standard side, adapter impl → plateau-app).

No new anchor is minted — the ruling cites the existing governors above (`codifiedIn = one-off`).

## Definition — the three named seams (the deliverable)

The console codes against exactly three named surfaces. A foreign backlog system becomes a new *adapter*
implementing them — never a view rewrite.

### 1. The read port — the `/api/backlog/*` contract over the `?repo=` registry

The console-facing read surface is the set of `?repo=`-scoped endpoints returning the interlingua DTO. The
repo-registry entry gains a provider discriminator (the missing piece from the grounding digest):

```ts
// was: type RepoRegistry = Record<string, string>   (plateau:src/backlog-view/loader.ts:26 — bare path)
type RepoEntry =
  | { slug: string; kind: 'we-backlog'; root: string }             // v1 — reads the item files off disk
  | { slug: string; kind: 'jira';   baseUrl: string; project: string }   // future adapter (not built)
  | { slug: string; kind: 'github'; owner: string; repo: string };       // future adapter (not built)
type RepoRegistry = Record<string /*slug*/, RepoEntry>;

// The read port the console depends on — every method scoped to a resolved repo.
interface BacklogReadPort {
  list(repo: string, query?: BacklogQuery): Promise<BacklogItemDTO[]>;   // GET /api/backlog?repo=
  detail(repo: string, id: string): Promise<BacklogDetailDTO>;           // GET /api/backlog/detail
  overlay(repo: string): Promise<OverlayMap>;                            // GET /api/backlog/overlay (delivery state)
  queue(repo: string): Promise<QueueResult>;                             // GET /api/backlog/queue
  repos(): Promise<{ repos: string[]; default: string }>;               // GET /api/backlog/repos
}
// BacklogItemDTO is the EXISTING wire type, promoted to @webeverything/contracts/backlog (Ruling B).
```

The WE-CLI/`gh`/disk specifics stay entirely inside the `we-backlog` adapter that answers these endpoints.

### 2. The write port — one generic verb-dispatched mutation, riding lane→PR

Every mutation the composer/actions issue goes through **one** port. It is already this shape
(`POST /api/backlog/write`); this decision *names* it and pins its transport to the lane→PR seam:

```ts
// The single write port. `verb` is the closed (extensible) WRITE_VERBS set; `value` is the verb's payload.
interface BacklogWritePort {
  submitChange(repo: string, m: BacklogMutation): Promise<PullRequestRef>;  // POST /api/backlog/write → 202 + jobId
}
type BacklogMutation = { id: string; verb: WriteVerb; value?: unknown };
// we-backlog impl == the existing runWriteFlow: acquire a lane → run the lane's CLI verb
//   → check:standards gate → gh pr create --label ready-to-merge (the drain merges).
// A Jira adapter implements submitChange as a REST call — same port, different transport behind it.
```

The composer's create-item and edge-editing writes (design-doc §2c/§3i) are new `WriteVerb`s (`scaffold`,
`retype`, edit-`blockedBy`), added to the *existing* enum — not a second write path. **No write ever touches
`main` directly** (invariant R1 below).

### 3. The interlingua — the canonical model foreign systems map INTO

The provider-neutral domain model each adapter maps its native concepts onto (Jira status → `open/active/
resolved`; epic→story → the kind ladder; its links → `parent`/`blockedBy`). It **is** the WE backlog schema,
minted as the WE contract core per Ruling B:

- **Statuses:** `open · active · resolved` (+ transients `preparing`, `parked`); a foreign status maps onto one.
- **Kind / granularity ladder:** `epic → story → task` (+ `decision`); Program is the epic umbrella (§2b).
- **Connection graph:** forward edges `parent` (single) + `blockedBy` (array); derived inverses
  `children`/`blocks`/`unblocks`; resolved-only lineage `graduatedTo`/`codifiedIn`; provenance `bornAs`.
- **Extension slot:** per-provider fields that don't map onto the core (a Jira-only workflow state, a Linear
  label) ride a typed `providerExt?: Record<string, unknown>` rather than widening the core (the "open
  extension slot" the interchange-schema rule prescribes).
- **Rule the adapter inherits:** edit the forward edge, expose both directions (§2d) — an adapter never invents
  a reverse edge.

### The server-side adapter interface (what a future provider implements)

Behind the endpoints, the four ad-hoc implementations consolidate to one interface the `RepoEntry.kind`
selects — this is the "add an adapter" unit:

```ts
interface BacklogProvider {                       // one per RepoEntry.kind
  list(query?: BacklogQuery): Promise<BacklogItemDTO[]>;
  detail(id: string): Promise<BacklogDetailDTO>;
  overlay(): Promise<OverlayMap>;                 // delivery/PR state, may be a no-op for a foreign system
  submitChange(m: BacklogMutation): Promise<PullRequestRef>;
}
// v1: WeBacklogProvider wraps today's four direct implementations behind this one interface.
```

## Ratified rulings & invariants

Two rulings (each replacing a candidate fork the standing test dissolved) + three forced invariants. Each
carries the adversarial verdicts (a fresh-context skeptic attacked the default; a separate fresh-context screen
checked the framing).

### Ruling A — seam form = the HTTP/DTO wire contract (support-both, wire primary)

**Not a fork (composability probe passes).** The two candidate shapes — (a) the HTTP/DTO wire contract, (b) a
typed in-process `BacklogProvider` TS interface — **compose**: (b) is a thin `fetch()` facade over (a), so they
coexist rather than exclude. Per the standing test that makes it **support-both**, not an either/or; the only
question is which is *primary*, and that is settled by R3 + the already-clean client. **Ruling:** the wire
contract is the ratified console-facing seam (language-agnostic — a foreign adapter is an endpoint in any
language, exactly the SSR-renderer rule; provider-agnostic by construction — the client only ever sees DTOs;
and it is the zero-cost incumbent). The `BacklogProvider` TS interface is **supported behind** the endpoints
(it consolidates the four ad-hoc impls) — never the ratified contract, since JS-coupling a cross-system
portability contract would add server-side coupling to an already-clean client boundary for no gain.

```ts
// A foreign adapter is a new endpoint implementation (any language):
//   GET /api/backlog?repo=acme-jira  →  200 { items: BacklogItemDTO[] }
// The console view is unchanged — it already only does fetch('/api/backlog?repo=…').
// The in-process shape (supported behind):  class JiraProvider implements BacklogProvider { list() {…} }
```

**Skeptic:** SURVIVES-WITH-AMENDMENT → folded. The assigned merit attack ("wire contract is overkill / JS-coupling
is fine for a one-app dev-server console") failed: (a) is the zero-cost incumbent (the client already only
`fetch()`es, `plateau:src/backlog-view/backlog-view.ts:12-18`), and (b)'s only edge (test ergonomics) is kept
by retaining the TS interface behind (a). Classification attack accepted: this is **settled-by-R3 + support-both**,
so it is presented as ratify-the-frame, not a weighed fork (amendment applied — no `## Fork N`). Citation-scope:
`#ssr-external-io-standard-renderers-conform` is cited as an *analogous pattern*, not binding authority over a
data API — correct framing.

**Screen:** clear — the seam form is observable to every adapter author and is the R2 lint's target (not an impl
detail); and a permanent merit difference exists (JS-coupling a cross-language contract), so the classification
is support-both-with-a-primary, not prioritization.

### Ruling B — interlingua = the WE schema; mint the core `@webeverything/contracts/backlog` now + extension slot

**Not a fork (dissolves per #2092 + the interchange-schema temporal rule).** The candidate framing was
"document-and-defer vs. mint-now." Both a fresh-context screen (prioritization-in-disguise) and the skeptic
dissolved it — merit is conceded (a WE-owned interlingua should exist), so it is not a ratifiable either/or.
**But the deferral direction is wrong**, defeated by the governing anchor the prep first missed:
[we:docs/agent/platform-decisions.md#constellation-placement](docs/agent/platform-decisions.md#constellation-placement)'s
**interchange-schema temporal-rule clarification** (`we:docs/agent/platform-decisions.md:435`, #1437) — for an *interchange
schema* (which this interlingua is), "a second independent impl" is satisfied by **external convergent prior
art**: when N≥2 incumbents already emit the same shape, **mint the core schema now + an open extension slot,
don't wait for WE itself to ship two impls.** Jira · Linear · GitHub Issues · the WE backlog are N≥4 convergent
incumbents on the core (a status lifecycle, an epic/story ladder, a parent edge, a blocking-link edge). The
precondition is **already met**. And `#constellation-placement` rule 3 already names `@webeverything/contracts`
(one entry per subsystem) as the end-state, with byte-replication as the interim — and
`plateau:src/backlog-view/types.ts:10-39` is *already* a cross-repo byte-replica, so a second consumer exists
today and minting the package **reduces** drift rather than adding it. **Ruling:** the interlingua is the WE
backlog schema; **mint the core `@webeverything/contracts/backlog` (type-only) now** + an open `providerExt`
extension slot; wire the console DTO to import it. The mint is a **spin-off build item** `blockedBy` this
decision (the decision rules; the package is built next), *not* deferred to a first foreign adapter.

```ts
// Ruling B — mint the CORE now (from the vocabulary the WE schema already fixes) + an extension slot:
//   // @webeverything/contracts/backlog
//   export type BacklogStatus = 'open' | 'active' | 'resolved' | 'preparing' | 'parked';
//   export type BacklogKind   = 'epic' | 'story' | 'task' | 'decision';
//   export interface BacklogItem { id; status: BacklogStatus; kind: BacklogKind;
//     parent?: string; blockedBy: string[]; /* …core… */ providerExt?: Record<string, unknown>; }
// Both WeBacklogProvider and any future JiraProvider import + conform to this core.
```

**Skeptic:** REFUTED my authored "defer" default → **flipped to mint-core-now**. The attack: the deferral
mis-read the temporal rule as needing a WE-internal 2nd impl (the exact reading struck by #1437's own lineage
note), and the "divergences are unknowable until a mapping" premise is false — Jira/Linear/GitHub schemas are
public and surveyable today; #2533 Fork 5 is the on-point precedent ("pattern real, shape unshaped" →
*commission shaping research then mint*, not park). Flip applied; rationale rewritten around
`we:docs/agent/platform-decisions.md:435` + rule 3.

**Screen:** flagged(prio) → **dissolved**. The screen correctly caught that the original "defer vs mint" framing
was prioritization wearing a fork's clothes (merit conceded, only timing left). Dissolution applied; the skeptic
then fixed the *direction* (the trigger is already fired → mint core now, not defer).

### Invariants (forced by statute — not weighed)

- **R1 — every write rides lane→PR; the primary tree is read-only.** Forced by
  [we:docs/agent/platform-decisions.md#primary-read-only-lanes-only](docs/agent/platform-decisions.md#primary-read-only-lanes-only).
  Already true (the existing write flow). A foreign adapter still lands its mutation as a gated change.
- **R2 — view/client code depends only on the seam (DTO/HTTP), never a bare CLI/disk/`gh` source.** The
  acceptance criterion; already true client-side. The enforcement lint keeps it true *and* fences the Node side
  (a view module must not import the disk loader, the queue-read shell, the overlay shell, or the child-process
  module).
- **R3 — the seam is a black-box conformance contract; adapters are swappable impls behind it.** The
  backlog-data-access **instance** of
  [we:docs/agent/platform-decisions.md#ssr-external-io-standard-renderers-conform](docs/agent/platform-decisions.md#ssr-external-io-standard-renderers-conform):
  observable I/O (the DTO wire shape + write contract) is the standard; the adapter is a conforming, swappable
  impl. Placement follows
  [we:docs/agent/platform-decisions.md#constellation-placement](docs/agent/platform-decisions.md#constellation-placement):
  contract/types → standard side, adapter impl → plateau-app.

## Supported by default (not decisions)

These coexist or are impl-side; no call needed:

- **The R2 lint mechanism.** An ESLint `no-restricted-imports` rule fencing view modules from the disk loader /
  queue-read shell / overlay shell / child-process module, *or* a `check:standards`-style custom scan — both
  enforce the same boundary; pick per plateau-app convention at build time.
- **Read transports behind the seam.** Disk-parse now, WE-CLI for the queue, `gh` for the overlay, REST later
  — all conforming impls behind the read port; add any without touching a view.
- **Write-verb set growth.** `WRITE_VERBS` is a closed-but-extensible enum; adding `scaffold`/`retype`/edge
  verbs is routine, not a new write path.
- **Overlay for a foreign provider.** `overlay()` may be a no-op where a foreign system has no lane→PR delivery
  model — the port tolerates it.

## Cross-references (sibling decisions — do NOT rule here)

- **#2561 Fork 3 (structured-spec-vs-prose).** Whatever spec shape #2561 ratifies must be expressible through
  *this* read port — the item spec travels as a field on `BacklogItemDTO` (or its detail DTO). This decision
  fixes the *carrier*; #2561 fixes the *spec's shape*. Not ruled here.
- **#2555 (board slices).** The board slices code against this seam (R2). Their acceptance inherits the R2 lint;
  they are the first consumer that proves the seam. Not ruled here.

## Context

*(Framing + reconciliation, below the call.)*

**Statute reconciliation.** At resolve this decision sets `codifiedIn` toward *"the backlog console's read/write
**port** is the observable contract; data-source adapters conform behind the seam, selected by the `?repo=`
registry; the interlingua is a WE-owned interchange schema."* **Do not mint a new anchor** — cite the existing
governors:
[we:docs/agent/platform-decisions.md#ssr-external-io-standard-renderers-conform](docs/agent/platform-decisions.md#ssr-external-io-standard-renderers-conform)
(the black-box-conformance sibling pattern — itself already the SSR instance of constellation-placement rule 1;
minting a `{#backlog-port-conformance}` anchor would re-legislate turf it already owns),
[we:docs/agent/platform-decisions.md#primary-read-only-lanes-only](docs/agent/platform-decisions.md#primary-read-only-lanes-only)
(the write port routes through it, does not restate it), and
[we:docs/agent/platform-decisions.md#constellation-placement](docs/agent/platform-decisions.md#constellation-placement)
(rule 3 = the `@webeverything/contracts` end-state; the interchange-schema clarification at `:435` = the
mint-core-now warrant for Ruling B). No same-turf collision by a different test was found.

**Why the client is already compliant, and the lint still matters.** The view `.ts` already only `fetch()`es
(`plateau:src/backlog-view/backlog-view.ts:12-18`) — so R2 is satisfied *today* on the client. The lint's real
job is (1) keep it that way as the composer/actions grow, and (2) fence the *Node-side* view-adjacent code so a
future contributor doesn't call the disk loader / queue-read shell from a rendering path.
Enforce-at-write-time, like the repo's other boundary lints.

**Granularity / roles context** lives in the [design doc §2b/§2c/§2d](docs/design/backlog-console-design.md);
the north-star framing in [§6b](docs/design/backlog-console-design.md). This item is the "hold the constraint"
made enforceable — a named boundary + a lint — so "hold provider-agnosticism" stops being an unenforceable
wish.
