# Research Report — Change Tracking as Observability: Strategy Catalog & Interop Design

**Date**: 2026-05-31
**Research page**: `/research/change-tracking-observability/`
**Scope**: An exhaustive catalog of client-side/JavaScript change-tracking strategies treated as a
facet of *observability in general* (not form dirty-state); a classification taxonomy; a
*provisional* canonical change-record + interop sketch; an attribution model; and a placement
recommendation for where a Change Tracking standard should live in Web Everything.
**Companion**: working plan `~we:/.claude/plans/i-think-change-tracking-recursive-wind.md` (Stage 1 of a
two-stage, research-first effort; Stage 2 designs the Protocol/Intent and is gated on review of this
report).
**Method**: `deep-research` harness — 5 search angles, 24 primary/secondary sources fetched, 118
claims extracted, top 25 adversarially verified (3-vote, 2/3-to-kill); **25 confirmed, 0 killed**.

> **Confidence legend.** Findings are tagged by evidentiary strength:
> - ✅ **Verified** — adversarially confirmed 3-0 from a primary source.
> - 📄 **Sourced** — drawn from a fetched primary/secondary source but *not* in the verified top-25
>   (single-pass; treat as solid-but-unaudited).
> - 🔶 **Synthesis** — our reasoned design extrapolation, *not* an external fact. All Stage-1 interop
>   and attribution design is 🔶 and explicitly provisional — to be revised as the specs progress.

---

## 1. The question, reframed

Change tracking is today modeled in this repo in exactly one place: the **dirty/pristine** model
inside the Validation Intent, with two DI concerns already named in `we:semantics.json`
(`customValidation:dirty-check`, `customValidation:change-detection`). The user's thesis — which this
research supports — is that change tracking is **not a form concern but a facet of observability**:
the general problem of *detecting, representing, and attributing a mutation to state over time*. That
problem recurs at every layer (form fields, stores/signals, documents, collections, the DOM, network
sync) and the field has solved it many incompatible ways.

The standard's goal is therefore **not to mandate one strategy** but to (1) catalog them, (2) name the
axes that distinguish them, and (3) design a layer that lets one app **configure a preferred strategy
and interoperate between several at once** (e.g. a signals graph feeding a JSON-Patch stream feeding a
CRDT document) — generalizing the existing `customValidation:change-detection` concern under the
repo's native-first + registry/adapter pattern.

---

## 2. Taxonomy — the classification axes

Every strategy in §3 is classified on these eight axes. ✅ The first four (granularity, eagerness,
representation, attribution) are the axes from which a **canonical change record** is derived (§5);
the verified findings repeatedly resolve strategies along exactly these dimensions.

1. **Granularity** — resolution of the observed change: whole-object · property/key · nested-path ·
   collection-delta · field-within-value.
2. **Eagerness / timing** — sync-on-mutation · microtask-batched · scheduled (frame) · lazy/pull-on-read · polled.
3. **Representation** — the change record's shape: boolean flag · old/new pair · path+op (JSON Patch) ·
   merge-doc (Merge Patch) · event/command · CRDT op · structural patch (+ inverse).
4. **Attribution** — none · binary (user/program) · typed-source (user · program · server-sync ·
   replay/undo) · full provenance (actor + cause + trace link).
5. **Reversibility** — none · inverse-patch · event-sourced replay · CRDT-convergent (commutative).
6. **Transport / serialization** — in-memory only · serializable · network-merge-safe · log-shippable.
7. **Soundness / coverage** — complete (Proxy/signals catch all writes) · partial (accessor tracking
   misses `delete`/array-index) · sampled (polling/diff can miss intermediate states).
8. **Cost** — interception overhead · snapshot memory · diff CPU · subscription bookkeeping.

---

## 3. Strategy catalog

### 3.1 Reactivity & interception family

**Signals / fine-grained observers** (TC39 Signals proposal, SolidJS, Preact Signals, Angular signals).
✅ Mechanism is the *observer pattern with automatic, dynamic, read-time dependency tracking*: a
computed/effect discovers at runtime which signals it read — the getter auto-registers the active
subscriber, the setter notifies subscribers *after an old-vs-new equality check* — keeping a precise
per-signal dependency set fresh in the graph [TC39; SolidJS]. ✅ Computed signals are **lazy/pull-based
and memoized** — evaluated only on explicit read, caching the last value to skip re-evaluation when
dependencies are unchanged [TC39]. ✅ Propagation is **synchronous and glitch-free**: a read triggers a
topological sort of potentially-dirty nodes to eliminate duplicate computation; *effect/watcher
scheduling is deliberately left to the framework*, not forced synchronous [TC39]. ✅ **Soundness limit**:
tracking is synchronous and linear (register → run → unregister), so signals read inside async
callbacks (e.g. `setTimeout`) are **not tracked** [SolidJS]. ✅ Cost is proportional to the actual
change, not the component tree (Solid updates the specific node; the component body runs once) [SolidJS].
- *Axes*: granularity = per-signal/property · eagerness = lazy-pull (computed) / sync (propagation) ·
  representation = old/new pair (no path) · attribution = none · reversibility = none · transport =
  in-memory · soundness = complete-within-sync-scope · cost = subscription bookkeeping.

**Proxy / Reflect interception** (Vue 3 `reactive()`, MobX 6, Valtio). ✅ Vue 3 is a Proxy-interception
strategy **with a getter/setter fallback**: an ES Proxy wraps reactive objects, while getter/setter
accessors back `ref()`s — the latter necessary because *a Proxy cannot target a primitive* [Vue]. ✅
Granularity is **property/key-level**: per-property dependency collection on access (`track(target,
key)`) and per-property triggering on mutation (`trigger(target, key)`), with subscribers in a
`WeakMap<target, Map<key, Set<effect>>>` [Vue — note: docs' simplified pedagogical model; production
`@vue/reactivity` uses a `Dep` class and extra keys like `ITERATE_KEY` for collections]. 📄 MobX and
Valtio likewise use Proxy traps; this gives **complete coverage** (adds/deletes/array-index all caught),
unlike accessor tracking.
- *Axes*: granularity = property/nested-path · eagerness = sync-on-mutation · representation =
  event/old-new · attribution = none · reversibility = none · transport = in-memory · soundness =
  complete · cost = interception overhead per access.

**Getter/setter accessor tracking** (Vue 2 `Object.defineProperty`). 📄 Vue 2 walked the object at init
and replaced each property with reactive getter/setters [Vue 2 docs]. **Partial coverage**: cannot
detect property *addition/deletion* or direct array-index assignment (the documented `Vue.set` caveat);
must recurse the object graph up-front. This is the soundness ceiling that motivated the Vue 3 Proxy
rewrite.
- *Axes*: granularity = property · eagerness = sync · soundness = **partial** · cost = up-front walk + memory.

**Dirty flags / dirty-checking** (Angular 1 digest, manual `isDirty`). 🔶 *No verified claim survived;
catalogued from general knowledge — flag as an open verification item.* Mechanism: compare watched
expressions against last-seen values on a digest tick; a flag or old/new pair results. Coverage is
**sampled** (only at digest boundaries) and cost scales with the number of watchers.
- *Axes*: granularity = expression/object · eagerness = scheduled/batched (digest) · representation =
  flag or old/new · soundness = sampled · cost = O(watchers) per tick.

**`Object.observe`** (removed from the spec). 📄 An ES7-era native object-change-observation API,
**withdrawn** (esdiscuss "An update on Object.observe", Nov 2015) [esdiscuss]. Its retraction is a
*design lesson*, not a live option: native deep object observation proved too costly/complex against
the rise of framework-level virtual-DOM and immutable approaches. The standard should treat "native
deep object observation" as a known dead end and lean on Proxy/signals instead.

### 3.2 Snapshot & patch family (serialization-friendly)

**Immutable snapshot + structural diff**. 🔶 *No verified claim survived* — catalogue and flag.
Mechanism: retain an immutable baseline, deep-compare to the current value, emit a derived diff. **Sampled**
coverage (intermediate states between snapshots are invisible) and diff CPU + snapshot memory cost, but
trivially correct and library-agnostic. The natural *fallback* default when no interception is available.

**JSON Patch (RFC 6902)**. ✅ A standardized, transport-friendly **path+op change document**: an ordered
array (media type `application/json-patch+json`) over **six operations** — `add`, `remove`, `replace`,
`move`, `copy`, `test` — each an object with exactly one `op` and one `path` (a JSON-Pointer string),
`value` for add/replace/test and `from` for move/copy; `test` asserts equality at a location; operations
apply sequentially [RFC 6902]. This is **the canonical shape for the path+op change record** and our
normalization target's spine. Stable 2013 standard, unsuperseded.
- *Axes*: granularity = nested-path · representation = path+op · reversibility = none *natively*
  (see below) · transport = **serializable** · attribution = none.

**JSON Merge Patch (RFC 7386)**. ✅ Expresses changes as a **document mirroring the target's structure**,
supplying only changed fields (not a path+op list); a **`null` value is overloaded to signal deletion**;
and it **cannot express partial modification of non-objects** such as arrays (an array must be replaced
wholesale) [RFC 7386]. The null-as-deletion overload means you *cannot set a member to literal JSON
`null`* — precisely why RFC 6902 coexists. Cheaper to author/read; coarser granularity (object-member).
- *Axes*: granularity = object-member · representation = merge-doc · transport = serializable ·
  soundness = cannot express array-internal or null-literal changes.

**Immer structural-sharing patches**. ✅ Produces **JSON-Patch-shaped patches** (similar but *not
identical* to RFC 6902 — `path` is an **array of keys**, not a JSON-Pointer string) and emits **inverse
patches** alongside forward ones (`produceWithPatches` → `[nextState, patches, inversePatches]`), giving
structural-sharing-based reversibility for undo/replay [Immer]. ✅ **Mutative** mirrors this API
(op/path/value over add/replace/remove, array-form paths, inverse patches for undo/redo) [Mutative].
- *Axes*: granularity = nested-path · representation = structural patch · reversibility = **inverse-patch**
  · transport = serializable (after path normalization) · cost = structural-sharing (cheap).

**RFC 6902 reversibility via libraries**. ✅ JSON Patch can be made reversible despite the spec not
defining inverse patches natively: `immutable-json-patch` implements the six-op format immutably *and*
provides `revertJSONPatch(document, operations)` — but **revert requires the original document** because
`remove`/`replace` ops do not store old values [immutable-json-patch; RFC 6902]. **Direct design
consequence**: a canonical change record that wants self-contained reversibility *must carry `oldValue`*
(see §5) — the RFC ops alone do not.

### 3.3 Distributed / convergent family

**CRDTs** (Yjs, Automerge). ✅ Guarantee **Strong Eventual Consistency** of replicas despite any number
of failures *without remote synchronization on updates*, in two formally-characterized styles:
**state-based / CvRDT** (replicas exchange and merge full local state) and **op-based / CmRDT** (an
update splits into a side-effect-free *prepare* and an *effect* that is broadcast) [Shapiro et al. 2011;
Weidner survey]. ✅ The **sufficient convergence conditions differ by style** — exactly the
ordering/merge-normalization rule for concurrent mutation: state-based converges when the payload forms
a **join-semilattice and merge computes the least upper bound** (state monotonically non-decreasing);
op-based converges when **all concurrent operations commute**, assuming **causal delivery** and method
termination [Shapiro et al. 2011, Thms 1–2]. 📄 Yjs is op-based with a document-internal causal
structure [Yjs internals].
- *Axes*: granularity = collection-delta / field · representation = CRDT op · reversibility =
  **convergent** (commutative, not "undo") · transport = **network-merge-safe** · cost = metadata/tombstone overhead.

**Operational Transformation** (Ellis & Gibbs). 🔶 *No verified claim survived* — catalogue and flag.
Transforms concurrent ops against each other to preserve intent under a typically central-server
ordering assumption; the historical alternative to CRDTs for collaborative editing. Compare-and-decide
vs op-based CRDTs is an explicit open question (§8).

**Event sourcing**. 🔶 *No verified claim survived* — catalogue and flag. State is the fold of an
append-only event/command log; "current value" is rebuilt by replay. Native **replay reversibility** and
**log-shippable transport**; cost is log growth + projection rebuild. Closely related to op-based CRDTs
and to Redux/NgRx action logs as an in-app realization.

### 3.4 DOM family

**MutationObserver** (WHATWG DOM). 📄 Observes DOM-tree mutations (childList / attributes /
characterData); callbacks are **delivered as a batched microtask** with an array of `MutationRecord`s —
i.e. eagerness = microtask-batched, representation = record list, scope = DOM subtree [MDN;
DOM spec]. The DOM-layer analog of the data-layer strategies; relevant if change tracking is scoped
broadly enough to include the rendered tree (a placement input — §7).

**Polling / equality checks**. 🔶 Last-resort fallback: interval-diff a value against its last-seen
copy. **Sampled** coverage (misses intermediate states), simplest possible mechanism, works on any value
with no interception. Belongs in the catalog as the universal lowest-common-denominator strategy.

---

## 4. Strategy × axis matrix

| Strategy | Granularity | Eagerness | Representation | Attribution | Reversibility | Transport | Soundness | Conf. |
|---|---|---|---|---|---|---|---|---|
| Signals / observers | per-signal/prop | lazy-pull + sync | old/new (no path) | none | none | in-memory | complete (sync scope) | ✅ |
| Proxy interception (Vue3/MobX/Valtio) | property/path | sync | event/old-new | none | none | in-memory | complete | ✅/📄 |
| Accessor tracking (Vue2) | property | sync | old/new | none | none | in-memory | **partial** | 📄 |
| Dirty-checking (Angular1) | expr/object | scheduled (digest) | flag/old-new | none | none | in-memory | sampled | 🔶 |
| Snapshot + structural diff | nested-path | sampled | structural patch | none | (derivable) | serializable | sampled | 🔶 |
| JSON Patch (RFC 6902) | nested-path | n/a (format) | **path+op** | none | none natively | **serializable** | exact | ✅ |
| JSON Merge Patch (RFC 7386) | object-member | n/a (format) | merge-doc | none | none | serializable | no arrays/null-literal | ✅ |
| Immer / Mutative patches | nested-path | sync (on produce) | structural patch | none | **inverse-patch** | serializable | complete | ✅ |
| CRDT (Yjs/Automerge) | collection-delta/field | sync/async | **CRDT op** | (replica id) | **convergent** | **network-merge-safe** | complete | ✅ |
| Operational Transformation | op | sync (server-ord.) | op | (site id) | transform | network | intent-preserving | 🔶 |
| Event sourcing | event/command | append | event/command | (in event) | **replay** | **log-shippable** | complete | 🔶 |
| MutationObserver (DOM) | node/subtree | microtask-batched | record list | none | none | in-memory | complete (DOM) | 📄 |
| `Object.observe` (removed) | object/property | — | record list | none | none | — | — (withdrawn) | 📄 |
| Polling / equality | value | polled | flag/old-new | none | none | in-memory | sampled | 🔶 |

---

## 5. The canonical change record (provisional 🔶)

The matrix shows heterogeneous outputs (flags, old/new pairs, path+op patches, merge docs, CRDT ops,
event records) that nonetheless share a recoverable core. A **normalization target** lets every strategy
map into one shape so downstream consumers (validation, traces, analytics, undo) are strategy-agnostic.
**This is a sketch, deliberately under-specified for Stage 1; it will be revised in Stage 2 as the
contract meets real adapters.**

```ts
// 🔶 PROVISIONAL — revise in Stage 2
interface ChangeRecord {
  path: JsonPointer;        // RFC 6901 pointer — the RFC 6902 spine (✅ for path+op strategies)
  op: 'add' | 'remove' | 'replace' | 'move' | 'copy';  // RFC 6902 op vocabulary, minus `test`
  oldValue?: unknown;       // REQUIRED for self-contained reversibility — RFC ops don't carry it (✅ §3.2)
  newValue?: unknown;
  source: ChangeSource;     // attribution — see §6
  timestamp: number;
  version?: string | number; // optimistic-concurrency / causal token (Lamport, vector clock, or doc version)
}
```

Design facts that constrain it (all ✅): RFC 6902's `{op, path, value/from}` is the proven serializable
spine; `oldValue` must be explicit because RFC ops are not self-inverting; Merge-Patch granularity is too
coarse (no arrays) to be the spine but is a fine *projection*; CRDT ops don't fit `{path, op}` cleanly and
need an **adapter** rather than a lossless mapping (their convergence lives in causal metadata, not the
record) — so the canonical record is a *lossy lingua franca for observation*, **not** a replacement for any
strategy's native form.

---

## 6. Attribution model (provisional 🔶)

Attribution — *who/what caused a change* — is the **biggest gap** today (no strategy in §3 carries it
natively; CRDT/OT carry only a replica/site id, event-sourcing only what the event author chose to log).
This is unverified by external sources and is **our design proposal**:

- `ChangeSource` as a **typed channel**: `user` · `program` · `server-sync` · `replay`/`undo` ·
  `external`. This generalizes the Validation Intent's existing `value-input` (user) vs `baseline-change`
  (program/server) distinction.
- **Cross-layer propagation**: the source rides on the `ChangeRecord` so a store mutation's origin
  survives into validation revalidation, into a trace span, and into an analytics event.
- 📄 **Trace linkage**: `source` may carry a W3C Trace Context `traceparent` (`trace-id` + `span-id`)
  [W3C Trace Context], so "what caused this mutation" resolves to the initiating span — connecting Change
  Tracking to Web Traces. 📄 The **CloudEvents** envelope (`source`, `id`, `time`, `subject`, `type`)
  [CloudEvents spec] is prior art for exactly this "attributed change/event" shape and is worth mirroring.

---

## 7. Interop & configuration (provisional 🔶)

Per the user: in Stage 1 the **exact mechanism is not critical** — sketch, then revise. The shape that
fits this repo's native-first + registry/adapter pattern:

- **`CustomChangeStrategy`** — the one contract every strategy satisfies, producing `ChangeRecord`s from a
  tracked target. Native store/signal subscriptions are the **default** strategy (zero-config, native-first).
- **`CustomChangeStrategyRegistry`** — registry + provider; **per-scope selection** through the injector
  chain lets two strategies coexist in one app (a form subtree on snapshot-diff, a collaborative doc
  subtree on a CRDT). Directly generalizes `customValidation:change-detection`.
- **Bridging** — because every registered strategy emits the same `ChangeRecord`, one strategy's output
  can feed another: a **signals graph → JSON-Patch stream → CRDT document** pipeline, with the record as
  the hand-off. The lossy mappings (§5) mean bridges are **adapters**, not identities — explicitly a
  Stage-2 problem.
- **Ordering / merge normalization** — when multiple concurrent sources mutate the same state, defer to
  the strongest participating model: CRDT convergence rules (LUB for state-based; commutativity + causal
  delivery for op-based) ✅, or an explicit version/causal token on the record. The Validation Intent
  already flags "concurrent source merge order must be normalized" — this is its general home.

---

## 8. Placement analysis & recommendation

**Recommendation: a Protocol owned by Web States, plus a thin Change Tracking Intent — with escalation to
a net-new Project held in reserve.**

- **Protocol under Web States** (favored). Change tracking is fundamentally *observing state mutation*;
  Web States owns the emit point (store/signal subscriptions fire on mutation) and its mission already
  reads "observability and state management," with a standing "Observation as a Web States Role" design
  note. It owns zero protocols today; this is a natural first. Lowest friction, highest coherence.
- **Thin Change Tracking Intent** — only if a genuine app-wide *UX-preference* axis exists (preferred
  strategy / granularity / eagerness / attribution / reversibility) distinct from the technical contract.
  The §2 axes suggest one plausibly does; decide in Stage 2.
- **Escalate to a new Project** ("Web Observability" / "Web Changes") **only if** the catalog's breadth
  proves decisive — MutationObserver (DOM), CRDT/OT (network sync), and trace/analytics linkage suggest a
  cross-cutting substrate that could attract its *own* plugs/blocks/registries (the Error-Recovery →
  Web Reliability precedent). The DOM + network-sync surface in §3.3–3.4 is the strongest argument for
  escalation; it is real but not yet decisive. Hold in reserve pending Stage 2 scoping.

**Integration touchpoints** (carry into the Stage-2 protocol body): **Web States** (primary emit source;
reconcile with the SSR serialized-baseline = diff baseline); **Validation Intent** (generalize
`customValidation:dirty-check` → baseline/structural-diff and `customValidation:change-detection` → the
registry; map `baseline-change`/`value-input`/`value-commit` onto the protocol's change events;
cross-reference, do not duplicate); **Web Traces** (`source.traceparent` span linkage); **Web Events**
(`change-detected` as a scoped typed event); **Web Analytics** (user-attributed changes feed
Track/Identify — downstream consumer only).

---

## 9. Open points register

- 🔶 **DECIDE (Stage 2): placement** — Protocol-under-Web-States vs new Project. Recommendation above; gated on scoping breadth.
- 🔶 **DECIDE: canonical change-record shape** — is `oldValue` always carried? Is `version` a Lamport clock, vector clock, or opaque token? CRDT-op adapter boundary.
- 🔶 **DECIDE: attribution vocabulary** — the `ChangeSource` channel set; whether to adopt CloudEvents envelope fields; mandatory vs optional trace linkage.
- 🔶 **DECIDE: batching semantics** — sync vs microtask-batched vs scheduled delivery of records (signals leave this to the framework ✅; the protocol must take a position or make it configurable).
- ❓ **VERIFY (unaudited in Stage 1):** Object.observe retraction rationale; MutationObserver eagerness/shape; Angular-1 digest; MobX/Valtio Proxy specifics; event sourcing; **OT vs op-based CRDT** tradeoffs; and crucially — *do any production systems implement a canonical-change-record normalization bridging signals → JSON Patch → CRDT?* (the interop core is entirely 🔶 synthesis). These are the first targets if Stage 2 wants firmer ground.

---

## 10. Files created / modified (Stage 1)

| File | Action | Purpose |
|---|---|---|
| `we:reports/2026-05-31-change-tracking-observability.md` | created | This report (not in 11ty build) |
| `we:src/_data/researchTopics.json` | modified | Added `change-tracking-observability` topic |
| `we:src/_includes/research-descriptions/change-tracking-observability.njk` | created | Renders `/research/change-tracking-observability/` |
| `we:src/_data/semantics.json` | modified | Added **Change Tracking**, **Change Record**, **Change Source** terms |

**Next**: Stage 2 (gated on review of this report) designs the `change-tracking` Protocol (+ optional
Intent), resolving the §9 register. See the working plan for the Stage-2 manifest.

---

## Sources

**Primary (✅ verified):** TC39 Signals proposal README; SolidJS fine-grained reactivity docs;
Vue 3 Reactivity in Depth; RFC 6902 (JSON Patch); RFC 7386 (JSON Merge Patch); Immer patches docs;
Mutative docs; `immutable-json-patch`; Shapiro et al. 2011 (*Conflict-free Replicated Data Types*);
Weidner CRDT survey.
**Primary/secondary (📄 sourced, unaudited):** W3C Trace Context; CloudEvents spec; Yjs INTERNALS;
esdiscuss "An update on Object.observe"; WHATWG DOM spec + MDN MutationObserver; Vue 2 reactivity docs.
