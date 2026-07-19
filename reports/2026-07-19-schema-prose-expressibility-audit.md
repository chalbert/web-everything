# How much of a spec is schema-expressible? — empirical audit for #2564

*Session report, 2026-07-19. Grounds the reframe of #2564's ratified "the spec is a SCHEMA, not prose"
invariant. Four parallel audits (three internal over our own specs, one external over prose-spec traditions),
each classifying real spec content as schema-expressible / partly / irreducibly prose.*

## Why

#2564 ratified "the spec is a machine-checkable **schema**, not prose" because only a schema makes *"did the
spec change?"* a deterministic diff. The open worry (operator, 2026-07-19): **schema has expressive limits**,
so the honest test is empirical — sample enough real specs and measure what fraction schema can actually
carry. If most of a spec is irreducibly prose, "schema not prose" is over-claimed and Fork 4 (which treated
prose as a ratcheted exception) is backwards.

## Method

Four parallel audits. Internal, over our own tree: (1) ~35 of 100 intents (`we:src/_data/intents/*.json`),
(2) ~23 of 42 protocols + 60 plugs (`we:src/_data/protocols/*.json`, `we:src/_data/plugs/*.json`), (3) ~25 of
99 statute anchors (`we:docs/agent/platform-decisions.md`) cross-checked against what
`we:scripts/check-standards.mjs` + the hooks already mechanize. External: (4) concrete prose-spec examples
from Spec Kit, Kiro/EARS, Tessl, WHATWG HTML, IETF RFC 2119, WAI-ARIA APG, Gherkin — each classified for
faithful schema-convertibility.

## Findings — pure-schema is ~0%; prose is a permanent, load-bearing layer

| Corpus | fully schema | partly (skeleton + prose) | irreducibly prose |
|---|---|---|---|
| Intents | ~0% | ~65% | ~35% |
| Protocols + plugs | 0% | ~87% | ~13% |
| Statute anchors (our decisions) | ~24% | ~36% | ~40% |
| External spec traditions | — | ~60–70% of *atomic-normative* content converts | ~30–40% residue |

- **Not one sampled spec is fully schema-expressible.** The structured skeleton (axis names, enumerated
  `values`, `requiresCapabilities`, event names, `composesContracts`) is real and mechanically checkable — but
  in every intent/protocol the *contract an implementer must satisfy* lives in the prose `summary`/`description`
  (semantic meaning of a value, defaults + default-*inference*, orthogonality, conditional cross-field gating,
  a11y/behavioral obligations, ordered-composition, trust boundaries). There is no separate prose file — the
  prose is **inside** the JSON, so our spec is already schema **and** prose in one artifact, prose being the
  larger half by contract-weight.
- **Protocols are more prose-bound than intents** — intents encode a *vocabulary* (enumerable → schema-friendly);
  protocols encode *runtime behavior over time* (negotiation, ordering, "never mutates", capability probing,
  cross-impl substitutability), exactly what schema cannot express.
- **We already practice the right split.** Of our governing rules, the schema-decidable ones are *already*
  hooked (`check-standards` + PreToolUse guards); what remains in the statute is disproportionately the
  irreducible-prose core (the most-cited rule, `#constellation-placement`, is judgment, cited 43×). The
  recurring pattern: **a prose principle spawns a thin mechanical "shadow" gate that guards its decidable part,
  while the principle itself stays interpretive.**
- **Every external tradition is a mix, none is schema-only.** When a spec is written as atomic trigger/response
  normative statements (EARS, Tessl bullets, ARIA role rules, protocol MUSTs), ~60–70% converts to a machine
  check without losing meaning; ~30–40% is a nameable residue that resists: scope/context conditions ("in such
  situations"), semantic intent/rationale, perceptual/a11y judgment, SHOULD-level norms with justification
  clauses, open-ended quality bars. Projects that *did* make prose checkable — Web Platform Tests, Gherkin
  step-glue, Specmatic (schema part only), Tessl `@test` — all did it by **binding a human-authored check to
  each faithful statement and leaving the rest as reviewed prose**, never by proving the prose away.

## Prose ambiguity is mitigable, not a fatality — the rigor spectrum

Prose is not a binary "flaky prose vs deterministic schema." Its interpretation gap is **reducible by
discipline** (operator, 2026-07-19): controlled/defined vocabulary, strong term definitions glossary-anchored
so a word means one thing, EARS-style structured phrasing (trigger → response), one-fact-per-statement, and an
explicit `[@test]` binding wherever a statement admits one. So spec content sits on a **rigor spectrum** —
machine-checked schema at one end, disciplined controlled-prose in the middle, raw prose at the other — and
the discipline is to push every statement as far toward the checkable end as it *faithfully* goes, never to
force it past where faithfulness breaks (the TLA+ 8.6%-semantic failure).

## Implication for #2564

1. **Reframe the ratified invariant.** Not "the spec is a schema, not prose," but: *a spec is a **schema
   skeleton + a first-class, permanent prose layer, in one artifact** — schema wherever it can faithfully
   express (vocabulary, shapes, enums, events), disciplined prose (human-gated, ambiguity-reduced) for
   scope/semantics/behavior/judgment.* The property we actually wanted — *"did the spec change?"* is a
   deterministic diff → human — **survives** (any contract-file change, prose included, trips the path test);
   only the over-claim that the *whole* contract is schema dies.
2. **Flip Fork 4.** Prose is the norm, not a ratcheted exception, so "executable-by-default, prose-only-with-
   warrant" is backwards. The rule becomes **per-statement check-binding** (the Tessl `@test` / WPT / Gherkin
   model): attach a machine check to each statement that admits one; hold the rest to the prose-rigor
   discipline above. The nudge is "*attach a check + tighten the definition where faithful*," not "*justify
   prose*."

Everything else in #2564 (Forks 1, 2, 3, 5, the dissolved 6, the layered model) survives and is consistent —
Fork 1 already routes behavioral conformance to Plateau/FUI + a human, which is exactly the prose layer's
home.

## Sources (external strand)

Spec Kit (github.com/github/spec-kit); Kiro / EARS (kiro.dev/docs/specs, alistairmavin.com/ears);
Tessl (docs.tessl.io, martinfowler.com sdd-3-tools article); WHATWG HTML (html.spec.whatwg.org); WAI-ARIA
APG Combobox (w3.org/WAI/ARIA/apg/patterns/combobox); RFC 2119 (rfc-editor.org/rfc/rfc2119); Gherkin
(cucumber.io/docs/gherkin); OpenAPI contract testing (specmatic.io). Web Platform Tests as the canonical
"one hand-written test per normative assertion" proof.
