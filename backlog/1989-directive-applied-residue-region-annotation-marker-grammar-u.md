---
kind: decision
status: open
blockedBy: []
dateOpened: "2026-06-30"
dateStarted: "2026-06-30"
preparedDate: "2026-06-30"
relatedReport: reports/2026-06-30-directive-residue-marker-grammar.md
tags: [webdirectives, naming, directive-residue, region-annotation, marker-grammar, block-standard, decision]
---

# Directive applied-residue / region-annotation marker grammar — unify the :start/:end vs /-close split into one reserved, matcher-excluded sigil

**Prepared, ready to ratify.** Raised by #1986's ratified family invariant (rule 5): authored directive nodes and
the region/residue annotations a directive *leaves when applied* must occupy **disjoint, matcher-excluded**
grammars, so every registry's `upgrade` walk claims **only authored nodes** (residue never re-upgraded) and the two
read apart in raw DOM/devtools. #1986 delegated the **exact reserved residue sigil** as a token-grammar question;
this item makes that one call. Grounded in a read of the real FUI tree + a prior-art survey published as the
[`directive-residue-marker-grammar`](/research/directive-residue-marker-grammar/) topic (report via
`relatedReport`). Sibling to #1987 (authoring names/values) but a **distinct surface** — machine-emitted markers,
not author-typed names.

## Grounding digest

The directive family emits **two** boundary conventions today, and the inspector (#1973) understands both:
**(1) machine residue** — paired `<!-- for-each:start (@users) -->` … `<!-- for-each:end -->`, written by the
runtime when a template directive applies (`fui:blocks/for-each/ForEachBehavior.ts:105-106`,
`fui:blocks/view/ViewIfDirective.ts:56-57`, `fui:blocks/view/ViewSwitchDirective.ts:62-63`); and **(2) authored** —
open/close `<!-- control:if cond -->` … `<!-- /control:if -->`, hand-written
(`fui:plugs/webdirectives/CustomCommentParser.ts:60-73`). The matcher-exclusion **seed** is leading-`/` *only*:
`directiveNameOf` returns `null` for a `/`-prefixed token (`fui:plugs/webdirectives/CustomCommentRegistry.ts:39-43`),
as do `DefaultCommentParser.parse` (`fui:plugs/webdirectives/CustomCommentParser.ts:71`) and
`multiTemplate.openingDirectiveName` (`fui:plugs/webdirectives/multiTemplate.ts:30-34`). The inspector reads both
conventions, reconstructs a nested region tree, and labels each region with its directive **name** + bound-state
**expression** (`fui:plugs/webdirectives/directiveInspector.ts:88-150`, the `start-end` vs `open-close`
`DirectiveBoundaryKind`).

**The latent disjointness gap (this is not cosmetic).** `multiTemplate.openingDirectiveName` claims any comment
whose leading token matches `/^[\w-]+:[\w-]+$/` (`fui:plugs/webdirectives/multiTemplate.ts:34`). A residue *open*
token `for-each:start` matches that shape (`for-each` : `start`) — and so does `for-each:end`. Neither starts with
`/`, so the leading-`/` seed does **not** exclude them. They are safe today only because **no registered directive
happens to be named `for-each:start`** — disjointness by *luck (absence of collision)*, not by *grammar*. The
invariant wants the guarantee structural: a residue marker must be un-claimable by construction, **both halves**, by
a cheap test.

**Prior art.** Native HTML reserves no comment grammar, so the platform shape is the cross-framework de-facto
convention (research topic, all source-confirmed): React `<!--$-->`/`<!--/$-->`, Vue 3 `<!--[-->`/`<!--]-->`,
Svelte 5 `<!--[-->`/`<!--]-->` (+ `[!`/`[?` state), lit `<!--?lit$NONCE$-->`, Solid `<!--$-->`/`<!--/-->`
(migrated `#`→`$` to dodge SSI collisions), Angular `<!--bindings={…}-->`. The pattern: a **non-alphanumeric
leading sigil** (O(1) `data[0]` test), **bracket-paired** block boundaries (Vue + Svelte independently), a
`/`-close that **echoes the HTML end-tag**, mostly **anonymous-positional** — *except* Angular, which carries a
readable label, the precedent for FUI's name+expr payload.

## Axis-framing

The forced invariant — disjoint + matcher-excluded + visually-distinct residue — is **already ratified** by #1986
rule 5 (`we:docs/agent/block-standard.md:433-439`); it bounds the forks, not re-opened. What is open is purely the
**token grammar** that realizes it. The current state is *two ad-hoc conventions plus a one-character seed*: residue
uses a `:start`/`:end` **suffix** (`fui:blocks/for-each/ForEachBehavior.ts:105-106`), authored close uses a `/`
**prefix** (`fui:plugs/webdirectives/CustomCommentRegistry.ts:41`), and the inspector carries a *two-branch*
`classify()` to read both (`fui:plugs/webdirectives/directiveInspector.ts:92-150`). Two real calls fall out:
**Fork 1** — the reserved **residue** grammar (bracket sigil vs keep the `:start`/`:end` suffix vs a single reserved
prefix char); and **Fork 2** — the **unification scope**: does the new sigil *subsume* the authored `/name` close
(one literal sigil), or does authored-close keep `/name` while the matcher unifies the two behind one exclusion
*predicate*? The name+expression payload is **not** a fork — the #1973 non-invasive inspector (#606) requires it.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **Fork 1** — reserved residue grammar | **bracket-sigil pair** `<!--[name expr-->` / `<!--]name-->` (O(1)-after-trim leading-char exclusion; collision-free vs `ns:name`; closes the `multiTemplate` gap) | keep `:start`/`:end` suffix · single reserved prefix char (`%`/`~`) | high |
| **Fork 2** — unification scope | **keep authored `/name` close; bracket only for residue; unify the matcher *predicate*** (one rule accepts `/`- and `[`/`]`-prefix) | fold `/name` into `]name` (one literal sigil) — *dominated, not broken* | med-high |

*The forced invariant (disjoint + matcher-excluded + visually-distinct residue) sits above both — it is #1986's,
already ratified, with no branch to pick, so it is not a glance-table row.*

## Forced invariant (ratify — not a fork)

**Authored opening directives are claimed by the `upgrade` matcher; every residue marker (both halves) and every
authored *closing* marker is excluded *by grammar*; residue reads visibly apart from authored directives in raw
DOM / devtools.**

Fork-existence: case (a), a forced invariant — the excluded branch ("let the matcher distinguish authored vs
residue by registry-lookup luck / absence of a name collision") is **broken**: the latent gap above shows a residue
`for-each:start` token is already `ns:name`-shaped and survives only because no directive is named that. #1986 rule
5 ratified the disjoint-by-grammar requirement (`we:docs/agent/block-standard.md:433-439`); this item only chooses
the grammar that satisfies it. No branch to pick here.

## Supported by default (not forks)

- **Residue carries the directive name + bound expression** — a **capability requirement**, not a choice. The
  #1973 inspector is **non-invasive** (#606): it patches nothing and reconstructs the region tree *purely from the
  DOM comment text* (`fui:plugs/webdirectives/directiveInspector.ts:88-150`), so the name+expression must live *in*
  the marker or the inspector loses its labels. Anonymous-positional markers (React/Vue/Svelte) presume a separate
  vdom side-channel FUI deliberately does without — so going anonymous would regress a shipped, ratified consumer.
  Mainstream precedent for a *named* payload: Angular's `<!--bindings={…}-->`. Required either way → not ratifiable.
- **Start marker carries the expression; end marker is bare** (`[for-each @users` … `]for-each`) — mirrors the
  inspector's existing read (`PAREN_TAIL` on the start, bare end, `fui:plugs/webdirectives/directiveInspector.ts:116-126`).
- **Residue name equals the authored directive name** so the inspector can correlate region to directive — already
  true today (`for-each:start` → name `for-each`).

## Fork 1 — the reserved residue grammar

**Fork-existence:** a genuine either/or — the catalog can carry **one** residue grammar (the inspector's
`classify()` and every `upgrade` matcher must recognise a single canonical residue form; supporting three defeats
the "one reserved sigil" goal and bloats the matcher). The excluded branches are *not broken* (the `:start`/`:end`
suffix ships and works), so this is a **merit weigh**, not a reaffirmation.

Crux: a residue marker must be **un-claimable by construction** and **cheaply paired**. The current `:start`/`:end`
is a *suffix* — detection means tokenize-then-`endsWith`, and the token `for-each:start` is itself `ns:name`-shaped
(the latent gap). A *leading* sigil flips both: O(1) `data[0]`, and collision-free against authored opens (which
start with a word char).

- **(a) Bracket-sigil pair** `<!--[name expr-->` / `<!--]name-->` *(recommended default, high)*:
  - **cheap leading-char exclusion** — a residue marker is excluded by its **first non-space char** (`[` or `]`),
    a single leading-char test, vs the current `:start`/`:end` *suffix* which needs tokenize-then-`endsWith`.
    Bracket markers are emitted **unpadded** (`createComment('[for-each …')`, no leading space) so the sigil is
    literally `data[0]`; the inspector's existing trim (`fui:plugs/webdirectives/directiveInspector.ts:99-103`)
    still absorbs the legacy padded `:start` forms during migration. This closes the `multiTemplate` mis-claim gap:
    the matcher's "is this an authored open to claim?" becomes "leading char is a word char," so `[for-each` can no
    longer match `/^[\w-]+:[\w-]+$/` the way `for-each:start` does.
  - **collision-free by construction** — `[`/`]` can never lead an authored `ns:name` opening token, so the
    disjoint invariant holds *grammatically*, both halves, not by absence of a name clash.
  - **paired + balanced** — `[`/`]` read as open/close in raw DOM and pair by document order, exactly the
    `surfaceDirectiveRegions` stack-walk the inspector already runs
    (`fui:plugs/webdirectives/directiveInspector.ts:152-210`).
  - **platform shape, honestly bounded** — the *bracket* is the dominant shape for paired zero-node boundaries
    (Vue + Svelte both chose `[`/`]`), and the *named-payload* is Angular's `<!--bindings={…}-->`. But those
    precedents are **separate**: Vue/Svelte brackets are **anonymous** (positional, no name); Angular's payload
    carrier is **bracketless**. FUI's `<!--[for-each @users-->` combines bracket shape + named payload — a
    **novel combination it owns**, not convergent prior art. The combination is sound (see the embedded-expression
    safety note below), but the claim is "best-fit synthesis," not "everyone already does this."
- **(b) Keep `:start`/`:end` suffix** — *Rejected:* it ships and the inspector already reads it, but it is a
  *suffix* (costlier detection), the token stays `ns:name`-shaped (the latent gap persists, so the invariant is
  satisfied only by luck), and it does not visually separate residue from authored directives — `for-each:start`
  reads like a directive name, `[for-each` does not.
- **(c) Single reserved prefix char** (`%`/`~`/`!` before the name, e.g. `<!--%for-each:start-->`) — *Rejected:*
  gets the O(1) leading-sigil win, but picks an arbitrary char with weaker precedent than brackets, still needs a
  separate `start`/`end` token (not paired-by-construction), and Solid's `#`→`$` migration warns that an
  arbitrary-looking char can collide with an upstream processor; `[`/`]` are claimed by none.

```ts
// (a) default — bracket sigil + FUI name/expr payload. Emit UNPADDED so data[0] is the sigil:
this.#startMarker = document.createComment(`[for-each ${this.#expression}`); // <!--[for-each @users-->
this.#endMarker   = document.createComment(`]for-each`);                     // <!--]for-each--> (bare close)

// Matcher exclusion is a leading-char test (replaces the tokenize+regex in multiTemplate):
const RESIDUE = (data: string) => { const c = data.trimStart()[0]; return c === '[' || c === ']'; };
function openingDirectiveName(comment: Comment): string | null {
  const text = comment.data.trim();
  if (!text || text.startsWith('/') || RESIDUE(text)) return null; // authored close OR machine residue → skip
  const token = text.split(/\s+/, 1)[0];
  return /^[\w-]+:[\w-]+$/.test(token) ? token : null;             // `[for-each` no longer matches — gap closed
}
// vs (b): `for-each:start` — leading word char, matches /^[\w-]+:[\w-]+$/, excluded only because unregistered.

// Embedded-expression safety: the expression rides ONLY the `[`-open; the close `]for-each` is BARE. So a `]`
// (or `[`, parens, quotes) inside an expression never trips `]`-leading close-detection, and pairing is
// name-keyed (surfaceDirectiveRegions pops nearest-open-of-same-name), NOT bracket-balanced — embedded brackets
// can't desync the stack. (The pre-existing `--`/`-->`-in-expression non-serializability hazard is unchanged
// from the `:start (expr)` form — neither added nor removed by brackets.)
```

**Inspector-side guard (amendment — a code-level gap the bracket grammar introduces):** the residue branch of
`classify()` must require the leading `[` to be **immediately followed by a directive-name token** (`[for-each`,
not `[ TODO`), and pair open↔close by name. Otherwise authored `[`-leading *prose* comments (`<!-- [TODO] -->`,
markdown `<!-- [x] -->`, dead `<!--[if IE]>` relics) would surface as **phantom regions** in devtools. The
*matcher* is already safe (it only ever **excludes** `[`-leading comments from upgrade, and no authored directive
is `[`-leading, so none is mis-excluded) — this guard is purely to stop the #1973 inspector false-positiving on
authored bracket-prose. No such comments exist in the FUI tree today (grepped), so it is a forward guard.

**Migration is atomic, not a tweak (amendment):** switching the grammar is a coordinated changeset — the three
emit sites (`ForEachBehavior`/`ViewIfDirective`/`ViewSwitchDirective`), `multiTemplate.openingDirectiveName`, **and**
the inspector's `classify()` (which today keys on `START_SUFFIX`/`END_SUFFIX`,
`fui:plugs/webdirectives/directiveInspector.ts:92-93,116-127`) must land **together**. A partial migration silently
blinds the #1973 inspector (a `[for-each` token has no `:start` suffix → `classify()` returns `null` → regions stop
surfacing). The build item that follows ratification owns this single-changeset constraint.

`Skeptic: SURVIVES-WITH-AMENDMENT — the prep skeptic (refute-only) found no fatal flaw: no matcher collision and no
pairing-stack break (the embedded-`]` attack fails because the close is bare and pairing is name-keyed, not
bracket-balanced). Four amendments folded: (1) the "O(1) data[0]" oversell → markers emit **unpadded** so data[0]
is the sigil, with the inspector trim absorbing legacy padded forms (leading-char test, not literal data[0] on the
padded form); (2) the Vue/Svelte precedent is for **anonymous** brackets — FUI's named-payload-in-bracket is a
**novel combination it owns** (Angular is the bracketless payload precedent), reworded from "convergent precedent";
(3) inspector-side guard added so authored `[`-prose doesn't become phantom devtools regions; (4) migration
flagged as one atomic changeset (emit sites + multiTemplate + classify()) or the inspector goes blind. The default
— bracket sigil over the `:start`/`:end` suffix — held on the core merit (leading-sigil beats suffix-tokenize, and
it closes the latent multiTemplate `ns:name`-shaped gap, both halves, by grammar).`

## Fork 2 — unification scope: subsume the authored `/name` close, or keep two surface forms behind one predicate?

**Fork-existence:** a genuine either/or — the authored comment-directive close is spelled *either* `/control:if`
*or* `]control:if`; one catalog convention, both coherent, cannot coexist. Neither is broken, so it is a merit
weigh. (The item title leans "one reserved sigil"; the open question is whether "one" means one literal char or one
exclusion *predicate*.)

Crux: the #1986 invariant requires authored-close and residue to be **disjoint from authored-opens and
matcher-excluded** — it does **not** require them to share one literal character. So the decider chooses between
*literal-sigil unity* and *predicate unity*.

- **(a) Keep authored `/name` close; bracket sigil only for machine residue; unify the matcher behind one exclusion
  *predicate*** *(recommended default, med-high)*:
  - the authored close is **hand-typed**, and `/name` mirrors the native HTML end-tag `</tag>` authors already
    know (`propose-standard-in-platform-shape` — take the closest native shape); machine residue is **never**
    hand-typed, so it takes the system bracket sigil. Matching each surface to its closest precedent is *more*
    native-first than forcing one char across two registers.
  - **the matcher still unifies** — one predicate `isReservedBoundaryMarker(data)` returns true for a leading
    `/` *or* `[`/`]`, so there is exactly one exclusion rule and one mental model; the inspector's two-branch
    `classify()` collapses to authored-`/`-close + bracket-residue, not three conventions.
  - prior art backs the *split with a shared family*: React/Svelte/Solid all use a `/`-style close echoing the
    HTML end-tag, distinct from their open sigil — a close that reads as a close.
- **(b) Fold `/name` into the bracket sigil** (authored close becomes `<!--]control:if-->`) — *Rejected:* gives one
  literal sigil and the simplest possible `classify()`, but forces hand-authors off the familiar `/close` onto an
  alien `]control:if` for **no extra guarantee** (predicate unity already delivers disjoint + O(1) exclusion), and
  `]` reads less obviously as "close" than `/` to a human author. The cost is author ergonomics; the benefit is
  cosmetic literal-uniformity.

```ts
// (a) default — ONE exclusion predicate over two surface forms (authored close keeps the native end-tag shape):
const isReservedBoundaryMarker = (data: string): boolean => {
  const c = data.trim()[0];
  return c === '/' || c === '[' || c === ']'; // authored close `/name` · residue open `[name` · residue close `]name`
};
// directiveNameOf / DefaultCommentParser.parse / multiTemplate all gate on this one predicate, replacing
// today's scattered `startsWith('/')` checks — predicate unified, `/`-close ergonomics preserved.
```

`Skeptic: SURVIVES — the pick (keep `/name`, predicate-unify) is right and beat both attacks: the
"violates the one-sigil spirit" attack FAILS because #1986 rule 5 says "non-overlapping grammars … residue never
re-upgraded," explicitly blessing the leading-`/` exclusion as precedent — it does **not** mandate one literal
char (the "one sigil" pressure is the item title's framing, not rule 5's text); and the pairing-confusion attack
(`/control:if` vs `]control:if` both name `control:if`) FAILS because a region is bounded by ONE convention, never
mixed. **Honest demotion the skeptic flagged:** option (b) is **dominated, not broken** — predicate-unity already
delivers disjoint + cheap exclusion, so folding `/name`→`]name` buys zero invariant value for an author-ergonomics
cost. So this is a near-forced call (native-first + the invariant), not a hard weigh — kept as a Fork only because
the item title explicitly asks the literal-vs-predicate-unity question and the decider should see it ruled.
Citation amendment folded into the statute-overlap section: `:672` downgraded from authority to principle.`

## Statute-overlap (reconciled here)

This decision sets `codifiedIn: we:docs/agent/block-standard.md#directive-registration-mechanism` (sharpening rule
5). Anchors on adjacent turf:

- **#1986 family invariant, rule 5** (`we:docs/agent/block-standard.md:433-439`) — the **ratifying authority** for
  the forced invariant; #1989 *fills its delegated slot* (the "exact reserved residue sigil") with the bracket
  grammar. Composes — this is the item rule 5 pointed forward to.
- **Pointer correction (a real defect this item fixes):** rule 5 currently delegates the residue sigil to
  **#1987** (`we:docs/agent/block-standard.md:437-439`), but #1987 (authoring names) explicitly punts it back —
  *"Adjacent, not in scope here … Tracked separately as #1989"*
  (`we:backlog/1987-attribute-naming-convention-review-colon-namespacing-view-if.md:84-88`). The residue sigil is
  **#1989**. Ratifying this item must **correct rule 5's delegation pointer #1987 → #1989** — otherwise the statute
  points at an item that disclaims the turf. No rule *conflict* (the two govern different surfaces), but an
  unreconciled cross-reference; fixed at codification.
- **The leading-`/` exclusion seed** (`fui:plugs/webdirectives/CustomCommentRegistry.ts:39-43`,
  `fui:plugs/webdirectives/CustomCommentParser.ts:71`, `fui:plugs/webdirectives/multiTemplate.ts:30-34`) — Fork
  2(a) *generalizes* this seed into the single `isReservedBoundaryMarker` predicate rather than overturning it; the
  `/`-close it already excludes stays valid.
- **#1987 separator discipline** (`we:docs/agent/platform-decisions.md:672`, *separators track per-namespace
  permission, not uniformity*) — **supporting principle, not authority** (citation-scope correction from the
  skeptic): `:672` governs **attribute-name** separators (`xml:lang`/`nav:list`), and `[`/`]` are paired
  *delimiters*, not separators — so `:672` does **not** *authorize* the bracket residue grammar and must not be
  cited as if it did. What composes is only the underlying **principle** — a *machine-only residue* namespace is
  distinct from the *author-typed* attribute namespace, so the two legitimately carry different grammars. The
  authority for the residue grammar is #1986 rule 5 (above), not `:672`; `:672` is house-idiom support that the
  "different namespace, different grammar" move is in-grain, no more.

## Relationships

- **Realizes** #1986's family-invariant rule 5 (the delegated residue-sigil slot) and **corrects** its stale
  delegation pointer (#1987 → #1989).
- **Sibling of** #1987 — same #1986-triggered token-grammar cluster, but a *distinct surface* (machine residue vs
  authored names); cross-referenced so the reserved grammars stay consistent.
- **Codifies into** `we:docs/agent/block-standard.md#directive-registration-mechanism` (rule 5); the inspector
  (`fui:plugs/webdirectives/directiveInspector.ts`) collapses its two-branch `classify()`, and the three emit sites
  (`ForEachBehavior` / `ViewIfDirective` / `ViewSwitchDirective`) switch to the bracket form.
- Surfaced from the #1983/#1986 prep discussion (2026-06-30); see
  `we:reports/2026-06-30-directive-residue-marker-grammar.md`.
