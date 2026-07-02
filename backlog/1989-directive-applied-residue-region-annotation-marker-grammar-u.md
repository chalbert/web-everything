---
kind: decision
status: resolved
blockedBy: [2074]
dateOpened: "2026-06-30"
dateStarted: "2026-07-02"
dateResolved: "2026-07-02"
graduatedTo: none
preparedDate: "2026-06-30"
codifiedIn: "docs/agent/block-standard.md#directive-registration-mechanism"
relatedReport: reports/2026-06-30-directive-residue-marker-grammar.md
tags: [webdirectives, naming, directive-residue, region-annotation, marker-grammar, block-standard, decision]
---

# Directive applied-residue / region-annotation marker grammar — one reserved, matcher-excluded residue sigil

**RATIFIED 2026-07-02 — the premise dissolved; one grammar, safe re-claim.** This item filled the
reserved-residue-sigil slot #1986's family invariant (rule 5) delegated: a disjoint, matcher-excluded grammar for
the annotations a directive *leaves when applied*. The ruling **dissolves that slot** instead of filling it: after
this item's prep, [#2063](2063-codify-webdirectives-ssr-wire-format-hydration-handshake-in-.md) (resolved
2026-07-02) codified the normative byte-exact SSR wire format — an applied region serializes with the
**authored-shaped** open-close grammar (`<!-- ns:name options -->` … `<!-- /ns:name -->`) and the client hydrates
by **re-claiming those markers** — and active [#2068](2068-reconcile-fui-runtime-directive-markers-to-the-standard-open.md)
is migrating the FUI runtime's legacy `:start`/`:end` residue to that same grammar so runtime output ≡ SSR output.
Applied output is *designed to be re-claimed*; a matcher-excluded residue grammar for it would break hydration.
Codified as the amended rule 5 at `we:docs/agent/block-standard.md#directive-registration-mechanism`.

## Ruling

1. **One region grammar.** An applied directive's region boundaries keep the authored open-close grammar
   (`ns:name` open, leading-`/` close) for their whole lifecycle — identical between the runtime DOM and the
   #2063 wire format. Serializing a live, applied tree reproduces valid wire format (the round-trip invariant).
2. **Re-upgrade safety is not a grammar property.** Within a document it is claim-state (a registry never
   re-claims a node it has claimed); across serialization boundaries directive application MUST be **idempotent
   under re-claim** (rows keyed via `data-key`) — a normative conformance requirement.
3. **No separate reserved residue sigil.** The matcher keeps the single exclusion rule already in force: closing
   markers (leading `/`) sit outside the opening-directive keyspace.
4. **#1986 rule 5 amended accordingly**; its stale delegation pointer (#1987, which punted back here) is resolved
   by this dissolution.
5. **Residual (not ratified):** if *anonymous* fragment boundaries ever need a marker, the bracket sigil
   (`<!--[-->`/`<!--]-->`, Vue 3 / Svelte 5 precedent) is the reserved slot — a
   [#2112](2112-reserved-delimiter-family-policy-which-opens-are-platform-re.md) reservation question.

Two grammar guarantees from the prep survive unchanged (they attach to the authored grammar #2063 pinned):
**expression on the open only, bare close** (an embedded `)`/quote can't fake a boundary) and **pairing is
name-keyed in document order, not bracket-balanced**.

## The rejected branch — the prepared bracket-sigil grammar (record)

The prep (grounded in the [`directive-residue-marker-grammar`](/research/directive-residue-marker-grammar/) topic)
defaulted to a reserved machine-residue grammar `<!--[for-each @users-->` … `<!--]for-each-->`: leading-char
exclusion (`[`/`]` disjoint from authored `ns:name` by construction), paired-by-brackets in raw DOM, a
best-fit synthesis of Vue/Svelte anonymous brackets + Angular's named payload. A sibling fork kept the authored
close as `/name` (native `</tag>` echo) with one unified exclusion predicate (leading `/`, `[`, `]`). Both were
sound **under the premise that applied residue must never be re-claimed** — the premise #2063's hydration model
inverted. The bracket analysis is preserved (via the research topic + `relatedReport`) as the reserved-slot design
should the anonymous-fragment residual ever activate. The reframing through
[#2074](2074-customnoderegistry-node-kind-extensibility-standard.md) (residue as the wire format of a would-be
region node kind, declared open/close, comment carrier for pre-JS invisibility) held, and pointed the same way:
the wire format is the grammar; there is no second one.

## Red-team (ratified default attacked, survived)

Strongest case against the dissolution: **(1)** it amends *ratified* statute (#1986 rule 5) — but #2063 is later,
normative, and conformance-vector-backed; the two conflicted and one had to yield, and grammar-disjointness loses
to the round-trip invariant that hydration already mandates. **(2)** Raw-DOM distinguishability (authored vs
applied read apart in devtools) is forfeited — bounded, not fatal: the wire format's normative padding and the
expanded content between markers distinguish applied regions in practice, and the #1973 inspector reconstructs
state non-invasively. **(3)** Non-hydration re-claim (a second registry, an `innerHTML` round-trip) could
double-apply a side-effectful directive — the attack that *shaped* the ruling: it surfaces idempotent-re-claim as
a **normative requirement** (ruling clause 2), not an implementation detail. Folded; the default stands.

## Relationships

- **Amends** #1986's family-invariant rule 5 (codified at
  `we:docs/agent/block-standard.md#directive-registration-mechanism`) and retires its delegated residue-sigil slot
  (delegation history: rule 5 → #1987 → #1989 → dissolved).
- **Conforms to** #2063 (normative SSR wire format — the grammar authority this ruling defers to).
- **Confirms** active #2068's migration target: legacy `:start`/`:end` → the standard authored grammar.
- **Unblocks** #2110 (region inert recipe) — its boundary markers follow the standard grammar, no new sigil.
- **Feeds** #2112 the anonymous-fragment bracket residual as a reservation candidate.
- Surfaced from the #1983/#1986 prep discussion (2026-06-30); prep survey in
  `we:reports/2026-06-30-directive-residue-marker-grammar.md`.
