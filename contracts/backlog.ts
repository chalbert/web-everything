// @webeverything/contracts/backlog — the provider-agnostic BACKLOG domain interlingua (#2569, type-only).
//
// Minted per #2558 Ruling B (mint-now, 2026-07-18): with N≥2 convergent public incumbents (Jira / Linear /
// GitHub / the WE backlog), the shared domain schema is minted NOW as the cite-able interlingua that the
// console read/write ports and every future provider adapter map INTO. Per #1282 (WE holds ZERO impl) this
// is a TYPE-ONLY contract — no runtime code ever ships from here; the plateau console + FUI consume it and
// hold the runtime. A foreign adapter (Jira/Linear/GitHub) maps into this core and parks divergences on the
// {@link BacklogItemDTO.providerExt} slot — the north-star (design-doc §6b) is "add an adapter", not a rewrite.

// ── vocabulary ───────────────────────────────────────────────────────────────────────────────────────────

/** The lifecycle a backlog item moves through. `open → active → resolved` are durable; `preparing` / `parked`
 *  are transients. A read port MAY surface a value outside this set (a foreign provider's state before it is
 *  mapped in), so DTO `status` stays a loose `string` — this union is the canonical vocabulary adapters map to. */
export type Status = 'open' | 'active' | 'preparing' | 'parked' | 'resolved';

/** The granularity ladder. A `program` is an umbrella epic; `decision` is a fork awaiting a ruling. */
export type Kind = 'program' | 'epic' | 'story' | 'task' | 'decision';

/** The kinds a NEW item may be scaffolded as through the write port (#2587) — a subset of {@link Kind}. */
export type ScaffoldKind = 'story' | 'epic' | 'decision';

/** The build-queue tier vocabulary an item may be pinned to (#2528). Order = priority (pinned first). */
export type Tier = 'pinned' | 'normal' | 'someday' | "won't";

// ── the domain item + the `GET /api/backlog` read port ───────────────────────────────────────────────────

/** One backlog item, provider-agnostic. The console read port (`GET /api/backlog`) returns these; a foreign
 *  adapter maps its own item shape onto this core. Optional fields are absent when the source has no value. */
export interface BacklogItemDTO {
  /** Full filename stem (the route key), e.g. `2507-backlog-view-v1-…`. */
  id: string;
  /** Leading id token — a landed `NNN` or a provisional `xNNNNNN` hash. `undefined` if the name has none. */
  num?: string;
  /** Human slug (the stem with the leading id token stripped). */
  slug: string;
  /** Title = the body's H1 (never the filename). Falls back to `id` when the body has no H1. */
  title: string;
  /** #2549: a human-glanceable 3–5 word short title for the console's scanning surfaces (cards, lanes,
   *  inbox). Optional — a surface renders `shortTitle ?? title`, so an un-backfilled item degrades to the
   *  full title. Bounded to ≤ 42 chars (validated); agent titles are precise but unscannable at a glance. */
  shortTitle?: string;
  /** One-line summary = the body's first real paragraph (inline markdown stripped). */
  summary?: string;
  /** Lifecycle state — one of {@link Status}; typed loose so a read port never crashes on an unknown value. */
  status?: string;
  /** Granularity — one of {@link Kind}. */
  kind?: string;
  /** Story-point size, when present. */
  size?: number;
  /** Tags, always an array (empty when absent). */
  tags: string[];
  /** The num of the epic/story this item hangs under (the `parent` edge), when present. */
  parent?: string;
  /** The nums this item is blocked by (the `blockedBy` DAG edge), always an array (empty when absent). */
  blockedBy: string[];
  /** The field readiness/batch ranks by (e.g. `low`) — editable from the UI (#2521). */
  priority?: string;
  /** #2582: set only on a `kind:decision` whose declared codification target amends a `docs/agent/*` governor
   *  (the pre-ruling statute-touching signal). Omitted when false. */
  readonly statuteTouching?: boolean;
  /** #2582: the declared governor-doc target(s) the statute-touching decision would amend. Omitted when empty. */
  readonly statuteTargets?: string[];
  /** Per-provider fields that don't map onto the core (a Jira workflow state, a Linear label). A foreign adapter
   *  maps INTO the core and parks its divergences here — the core never reads it. Never widen the core; add here. */
  providerExt?: Record<string, unknown>;
}

/** A file that failed to parse — surfaced as a degraded row, never a crash (skip-and-report). */
export interface MalformedItemDTO {
  /** Full filename stem. */
  id: string;
  /** The raw filename, e.g. `2513-broken.md`. */
  file: string;
  /** Why it failed (the parse error reason), shown on the degraded row. */
  reason: string;
}

/** The whole `GET /api/backlog` read-port payload for one repo. */
export interface BacklogResponse {
  /** The repo slug this payload was read from (the configurable seam). */
  repo: string;
  /** Well-formed items, already ordered by the loader (newest item number first). */
  items: BacklogItemDTO[];
  /** Files that could not be parsed — rendered as degraded rows. */
  malformed: MalformedItemDTO[];
  /** True when the target repo has no `backlog/` directory at all (honest empty state). */
  missing: boolean;
}

/** The rendered-markdown detail for ONE item (`GET /api/backlog/detail`), loaded lazily on selection. */
export interface BacklogDetailDTO {
  /** The item's full filename stem (the list row's `id`). */
  id: string;
  /** Rendered markdown detail (H1 removed — the title is shown separately). Empty string when no body. */
  detailHtml: string;
}

// ── the live-pipeline overlay read port (`GET /api/backlog/overlay`) ─────────────────────────────────────

/** Required-check rollup verdict for an item's PR. */
export type CiVerdict = 'passing' | 'failing' | 'pending' | 'none';

/** One item's LIVE pipeline position — every field optional; an item with no live state is `{}`. */
export interface OverlayState {
  /** A live session holds the `open → active` lock. */
  claimed?: { session: string };
  /** A lane pushed the work + marked it ready-to-merge; carries the lane branch. */
  queued?: { lane: string };
  /** The item's pull request, joined by lane branch. `headRefName` is the PR's head branch (`lane/<num>-…`);
   *  the board reads it to tell a terminal *resolve* lane (`lane/<num>-resolve`) — genuinely "resolving"
   *  (UC-D1) — from a merged slice/note/fix PR that is landed history, so an open item is never stuck
   *  "resolving". Optional so older overlay data / fixtures without it degrade to non-resolve (fail safe). */
  pr?: { repo: string; number: number; url: string; state: 'open' | 'merged' | 'closed'; ci: CiVerdict; headRefName?: string };
}

/** num → live state. Keyed by the item's leading num token, matching the list rows' `num`. */
export type OverlayMap = Record<string, OverlayState>;

// ── the `POST /api/backlog/write` write port ─────────────────────────────────────────────────────────────

/** The closed set of mutations the write port accepts (each rides a lane → PR, never a direct write to main). */
export type WriteVerb =
  | 'claim' | 'release' | 'resolve' | 'prioritize' | 'tier' | 'rank'
  | 'weights' | 'build-queue' | 'scaffold' | 'waiver';

/** One criterion weight edit (the `weights` verb). */
export interface WeightEdit {
  key: string;
  weight: number;
}

/** The `POST /api/backlog/write` request body. Fields are per-verb (see each write handler); a foreign write
 *  adapter maps its own mutation onto this shape. */
export interface WriteRequest {
  id?: string;
  verb: WriteVerb;
  value?: string;
  after?: string;
  before?: string;
  weights?: WeightEdit[];
  /** For a decision `resolve` (#2581): the codified-in target — `'one-off'` or a `docs/*.md#anchor` path. */
  codifiedTo?: string;
  /** For a `resolve` ruling (#2581): the operator's one-line override rationale (rides the PR/commit body). */
  note?: string;
  /** For `scaffold` (#2587): the new item's fields (born OPEN). */
  kind?: ScaffoldKind;
  title?: string;
  size?: number;
  parent?: string;
  blockedBy?: string;
  digest?: string;
}

/** Terminal + in-flight states of a write job (the mutation transport = a lane → PR). */
export type WriteStatus = 'pending' | 'opened' | 'failed';

/** One write job's state, returned by the POST (202) and polled via `GET /api/backlog/write/:jobId`. */
export interface WriteJobDTO {
  id: string;
  num: string;
  verb: WriteVerb;
  /** For `prioritize`: the priority this job sets (`''` clears) — so a coalesced duplicate adopts the truth. */
  value?: string;
  status: WriteStatus;
  /** Present once the lane's PR is open. */
  pr?: { number: number; url: string };
  /** Present when the job failed — an honest, human-readable reason. */
  error?: string;
}
