---
kind: decision
status: open
blockedBy: [2074]
dateOpened: "2026-06-30"
dateStarted: "2026-07-01"
preparedDate: "2026-06-30"
relatedReport: reports/2026-06-30-directive-residue-marker-grammar.md
tags: [webdirectives, naming, directive-residue, region-annotation, marker-grammar, block-standard, decision]
---

# Directive applied-residue / region-annotation marker grammar — one reserved, matcher-excluded residue sigil

**BLOCKED pending #2074 (node-kind frame) — not ratifiable yet.** During the 2026-07-01 discussion the residue
grammar was reframed as the **serialized wire-format of a would-be region node-kind** ([#2074](2074-customnoderegistry-node-kind-extensibility-standard.md)),
so its shape is downstream of that decision: the leading discussion had moved from `[`/`]` to a React/Solid-style
`$`/`/$` residue-comment form, but under #2074 it may instead be a reflected-delimiter form (e.g. `{$ … $}`). Parked
until #2074 settles. The prepared analysis below (impl-neutral, residue example per fork) stands as input for when it
unblocks. This item fills the reserved-residue-sigil slot that #1986's family invariant (rule 5) delegated: authored directive nodes and the region/residue annotations a
directive *leaves when applied* must occupy **disjoint, matcher-excluded** grammars, so every registry's `upgrade`
walk claims **only authored nodes** and the two read apart in raw DOM / devtools. #1986 ratified that requirement;
#1989 chooses the grammar that satisfies it. Grounded in a read of the real FUI tree plus a prior-art survey
published as the [`directive-residue-marker-grammar`](/research/directive-residue-marker-grammar/) topic.

## Proposed ruling (pending ratification)

- **Fork 1 — reserved residue grammar → bracket-sigil pair.** A directive's applied residue is written as a paired
  bracket marker, expression on the **open** only and a **bare close**:

  ```
  <!--[for-each @users-->     region open  (sigil `[`, directive name, bound expression)
     …region content…
  <!--]for-each-->            region close (sigil `]`, directive name, no expression)
  ```

- **Fork 2 — unification scope → keep the authored `/name` close; brackets only for machine residue; unify behind
  one exclusion predicate.** An *author-typed* closing marker keeps the native-end-tag-echoing form, and a single
  rule excludes any marker whose first non-space character is `/`, `[`, or `]` from the `upgrade` keyspace:

  ```
  <!--control:if cond-->      authored OPEN   (claimed by upgrade)
  <!--/control:if-->          authored CLOSE  (excluded — leading `/`, mirrors </tag>)
  <!--[control:if …-->        machine residue (excluded — leading `[`)
  <!--]control:if-->          machine residue (excluded — leading `]`)
  ```

Two grammar guarantees are **part of the ruling**, not implementation trivia — a later build that dropped them
would silently reintroduce the hazard the grammar exists to remove:

1. **Expression on the open only; close is bare.** A `]` (or `[`, paren, quote) appearing inside an expression can
   never be mistaken for a close boundary.
2. **Pairing is name-keyed, not bracket-balanced.** Open↔close pair by matching directive name in document order, so
   embedded brackets inside an expression cannot desync region pairing.

## Fork 1 — the reserved residue grammar (merit weigh)

The catalog carries **one** canonical residue form. The default and the rejected branches, by the residue each
emits:

- **(a) Bracket-sigil pair** *(ratified)* — `<!--[for-each @users-->` … `<!--]for-each-->`.
  - **Leading-char exclusion.** A residue marker is recognised by its first non-space character (`[` or `]`) rather
    than by tokenising and inspecting a suffix, and a leading `[`/`]` can never lead an authored `ns:name` opening
    token — so the disjoint invariant holds by construction, both halves.
  - **Paired + balanced in raw DOM.** `[` and `]` read as open/close and pair by document order, matching the
    #1973 inspector's region reconstruction.
  - **Platform shape, honestly bounded.** The *bracket* is the dominant shape for paired zero-node boundaries (Vue
    3 and Svelte 5 independently chose `<!--[-->`/`<!--]-->`); a *named* payload is Angular's precedent
    (`<!--bindings={…}-->`). Those precedents are **separate** — Vue/Svelte brackets are anonymous, Angular's
    payload is bracketless. FUI's named-payload-in-a-bracket is a **best-fit synthesis it owns**, not convergent
    prior art. The name+expression payload itself is a **capability requirement**, not a fork: the #1973 inspector
    is non-invasive (#606) and reconstructs regions purely from comment text, so the name and expression must live
    *in* the marker.

- **(b) Keep the `:start`/`:end` suffix** — `<!--for-each:start (@users)-->` … `<!--for-each:end-->`. *Rejected:* it
  ships and works, but detection is suffix-based, the open token `for-each:start` is itself `ns:name`-shaped (so the
  disjoint invariant is satisfied only *by luck* — no directive happens to be named `for-each:start`), and it does
  not read visibly apart from an authored directive (`for-each:start` looks like a directive name; `[for-each` does
  not).

- **(c) Single reserved prefix char** — e.g. `<!--%for-each:start-->`. *Rejected:* gets the leading-sigil win but
  picks an arbitrary character with weaker precedent than brackets, still needs a separate `start`/`end` token
  (not paired-by-construction), and prior art warns an arbitrary sigil can collide with an upstream processor —
  where `[`/`]` are claimed by none.

## Fork 2 — unification scope: subsume the authored `/name` close, or keep two surface forms behind one predicate?

A genuine either/or — the authored comment-directive close is spelled *either* `/control:if` *or* `]control:if`; one
catalog convention, both coherent, cannot coexist. Neither is broken, so it is a merit weigh.

- **(a) Keep `/name` for the authored close; bracket only for residue; unify the matcher predicate** *(ratified)* —
  the authored close is hand-typed, and `/name` mirrors the native HTML end-tag `</tag>` authors already know
  (native-first: take the closest native shape); machine residue is never hand-typed, so it takes the system
  bracket sigil. The matcher still unifies behind **one** exclusion rule (leading `/`, `[`, or `]`), so there is a
  single mental model, not three conventions. Prior art backs the *split within a shared family*: frameworks that
  use a `/`-style close (React/Svelte/Solid) keep it distinct from their open sigil.

- **(b) Fold `/name` into the bracket sigil** (authored close becomes `<!--]control:if-->`) — *Rejected as
  dominated, not broken:* predicate-unity already delivers disjoint + leading-char exclusion, so folding the
  authored close into `]name` buys **zero** invariant value while forcing hand-authors off the familiar `/close`
  onto an alien `]control:if` that reads less obviously as a close. Cost is author ergonomics; benefit is cosmetic
  literal-uniformity.

## Red-team (default survived)

The strongest case for the status quo (`:start`/`:end`): the migration is an atomic, coordinated change across the
emit sites, the opening-directive matcher, and the #1973 inspector — a real cost for a gap that has **never fired**
(no directive is named `foo:start`). And the "platform shape" claim is weaker than it reads: the bracket+named-payload
combination is a synthesis, not something any framework actually ships. The attack **bounds** the default (folded as
amendments: markers are emitted so the sigil is the leading char; the prior-art claim is stated as "best-fit
synthesis," not "convergence") but does **not** break it: the named payload is forced by the non-invasive inspector,
leading-sigil exclusion genuinely beats suffix-tokenising, the latent `ns:name`-shaped gap is closed *by grammar*,
and the atomic-migration cost is unavoidable under **any** grammar change and is owned by the follow-on build item —
not this decision. Ratifying now is cheaper than re-encoding later because the active WebDirectives work (#2063 SSR
wire-format, #2068 reconcile runtime markers) is encoding these markers this session.

## Codification (on ratification)

On the ratify go, this codifies into `we:docs/agent/block-standard.md#directive-registration-mechanism` (rule 5) —
the grammar contract and its two guarantees (bare close; name-keyed pairing) stated **implementation-neutrally**; the
standard carries the shape, FUI carries the code. Two reconciliations to fold at codification:

- **Delegation-pointer correction.** Rule 5 previously delegated the reserved residue sigil to #1987, but #1987
  (authoring names/values) explicitly punts it back — *"tracked separately as #1989."* The pointer is corrected
  #1987 → #1989 in rule 5.
- **Citation scope.** #1987's separator discipline (`we:docs/agent/platform-decisions.md:672`) governs
  *attribute-name* separators, not paired *delimiters*, so it is supporting **principle** ("machine-only residue is
  a distinct namespace from author-typed attributes, so the two may carry different grammars"), **not** the
  authority for this grammar. The authority is #1986 rule 5.

## Relationships

- **Realizes** #1986's family-invariant rule 5 (the delegated residue-sigil slot) and **corrects** its stale
  delegation pointer (#1987 → #1989).
- **Sibling of** #1987 — same #1986-triggered token-grammar cluster, a *distinct surface* (machine residue vs
  authored names).
- **Enables** the follow-on FUI build item that migrates the residue emit + matcher + #1973 inspector to the bracket
  grammar as a single atomic changeset (partial migration would blind the inspector).
- Surfaced from the #1983/#1986 prep discussion (2026-06-30); see
  `we:reports/2026-06-30-directive-residue-marker-grammar.md`.
