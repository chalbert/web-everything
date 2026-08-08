---
kind: story
size: 5
parent: "2405"
status: open
dateOpened: "2026-08-08"
relatedTo: ["2771", "2785"]
scope: ["we:scripts/backlog.mjs", "we:scripts/lib/gate-config.mjs", "we:scripts/lib/review-escalation.mjs", "we:scripts/pr-land.mjs"]
tags: [codification, statute, review-human, escalation, provenance, governance]
---

# Codification shortcut: generate the statute edit, verify by regeneration (replaces #2771 Fork B detection)

**Ruled 2026-08-08 (operator, R5): only a diff a mechanised script produced may take the codification
shortcut.** Provenance replaces detection. The shortcut is no longer earned by a diff that *looks* like a
codification; it is earned by a diff a trusted generator *wrote*, verified by re-running the generator and
comparing. There is no document to parse, so there is no grammar to get wrong.

## Why the detector approach was retired

#2771 Fork B ratified the exemption and specified it be detected "script-decidably from the resolve+codify
diff shape". Five independent reviewers broke five successive implementations of that detection. Every
break was the same shape — a hand-rolled approximation of a grammar detail: a mid-rule splice, an untagged
second heading, eight more heading forms, counting lines instead of headings, and finally an
`HTML_COMMENT_RE` that is not the HTML comment grammar.

Rebuilding on `markdown-it` (the parser [`we:scripts/lib/rules-loader.cjs`](../scripts/lib/rules-loader.cjs)
already uses, `html: true`) fixes only the markdown half. Measured on markdown-it 13.0.2 with that exact
config:

| source | markdown-it | HTML parser |
| --- | --- | --- |
| `### Real rule` | 1 heading | 1 heading |
| a raw `h3` tag | **0 headings**, opaque `html_block` | a heading |
| a raw `h3` with a newline before its `>` | **0 headings**, opaque `html_block` | a heading |
| `<!-- x --!>` then `### Rule after` | **0 headings** — swallows the heading | comment ends at `--!>`; heading is real |

markdown-it does not parse HTML; it hands raw HTML back as an opaque string, which is where breaks 3 and 5
lived. And CommonMark ends an HTML block at `-->` only, while the HTML spec also ends a comment at `--!>`,
`<!-->` and `<!--->` — so the round-5 divergence reappears *inside* the library. Parsing the document is the
wrong instrument for this question.

## What ships

### Arm A — generate the statute edit

Extend [`we:scripts/backlog.mjs`](../scripts/backlog.mjs) `resolve <NNN> --codified-to=<doc#anchor>` so it
writes **both halves** of the codification edit, not just the frontmatter.

- The frontmatter half already exists and is already mandatory for a `kind:decision` (the #911 gate):
  `status: resolved`, `dateResolved`, `codifiedIn`. Unchanged.
- The new half: append the statute anchor to the target doc. Nothing writes
  `we:docs/agent/platform-decisions.md` today — those ~14 lines are hand-authored every time, and the
  tooling only validates them after the fact (that the anchor resolves; the G6/G7 audits in
  [`we:scripts/audit-backlog-health.mjs`](../scripts/audit-backlog-health.mjs)).
- **The prose is transported, not invented.** The generator takes the ruling text approved live at
  ratification and places it in the anchor; it does not compose it. This keeps the statute reading as it
  does now — the 447 existing anchors are dense hand-written cross-referenced prose, and a fully-templated
  anchor would fork the corpus into two formats. (Considered and rejected at ruling time: deriving the
  anchor from structured fields on the decision item. Genuinely mechanical, but formulaic and
  format-splitting. Revisit only if transport proves forgeable.)
- Emit a **manifest** alongside: the generator's inputs and a hash of exactly what it wrote.

### Arm B — verify by regeneration, not by parsing

In [`we:scripts/pr-land.mjs`](../scripts/pr-land.mjs) and the shared scorer in
[`we:scripts/lib/review-escalation.mjs`](../scripts/lib/review-escalation.mjs), replace `isCodificationOnly(diff)`
(the parser) with a provenance check:

- Re-run the generator against the item as it stands in **`base`**, and require the PR's diff to equal what
  the generator produces. Byte-comparison — no markdown parsing, no HTML parsing, no heading counting.
- Require the decision item to be **non-resolved in `base`**. This is what defeats the self-clearance
  attack: a PR cannot both invent a decision and resolve it, because the open item must already exist in
  the branch being merged into. Check against `base`, never against the PR.
- Mismatch, or an item already resolved in `base`, or any statute edit outside the generated anchor →
  `review:human`, exactly as today.

### Arm C — protect the generator

The generator is code, and agents can edit code. Unprotected, an agent edits it to emit an arbitrary rule
and the output is "mechanically produced" by construction. Add the generator's basename to
`POLICY_SPEC_BASENAMES` in [`we:scripts/lib/gate-config.mjs`](../scripts/lib/gate-config.mjs) — the
declarative-leash roster — so changes to it stay `review:human` per #2771 Fork A.

## Retained invariants (do not weaken)

- A codification PR still **escalates to the committee** (`review:pending`). #2771 clause 2 is explicit that
  it is *"NOT auto-merged and NOT human-gated"* — the panel still checks the anchor faithfully records the
  resolved decision's ruling. **Check whether the built Fork B auto-merges**; if it does, that exceeds the
  ratified scope and is a defect independent of the parsing bugs.
- A `we:docs/agent/platform-decisions.md` diff with no accompanying resolve + `codifiedIn` (an author
  writing a NEW rule) stays `review:human`.
- The final landed diff is signed off by an agent that did NOT author it (#2439); diversity-selection
  aggregation; non-convergence hard-escalates to `review:human`.

## Consequence to accept

Applied today, **zero** codification PRs qualify — the shortcut is dormant until Arm A ships. That is the
scope being bought, not an argument against the ruling.

The volume justifies it: **112 codification-shaped commits to the statute in the last 90 days** (~1.2/day),
447 decisions already carry `codifiedIn`, and 33 open decisions are still queued to codify.

## Acceptance

- [`we:scripts/backlog.mjs`](../scripts/backlog.mjs) `resolve <NNN> --codified-to=<doc#anchor>` writes the
  anchor and a manifest; re-running it on an unchanged item is byte-identical (deterministic, no timestamps
  in the hashed region beyond `dateResolved`).
- A generated codification PR scores `review:pending`; the same diff with one byte hand-edited in the anchor
  scores `review:human`; a raw new-rule statute diff scores `review:human`.
- A PR that adds a *new* `status: resolved` decision item and its anchor in one commit scores `review:human`
  (the base-non-resolved check).
- All five historical break cases are added as regression fixtures and score `review:human`.
- Editing the generator scores `review:human`.
- `npm run check:standards` and the review-escalation suite green.

## Follow-ups

- **Close PR #1103** (the parser approach) — superseded, not fixable.
- Red-team the shipped provenance check with an adversary who did not write it, using cases not derived
  from this item's list. The R8 lesson: a generator whose case list is the fix's own implementation can only
  re-prove what is already handled.
