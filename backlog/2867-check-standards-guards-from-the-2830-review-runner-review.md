---
bornAs: xu1v0ek
kind: story
size: 3
parent: "2823"
status: open
dateOpened: "2026-08-02"
tags: [check-standards, gate, prevention-introspection, review]
scope:
  - we:scripts/check-standards-rules.mjs
  - we:scripts/lib/verdict-totality.mjs
---

# check:standards guards named by the #2830 review-runner review (prevention-introspection capture)

The #2830 review (shadow review runner) named five DETERMINISTIC, script-decidable prevention guards, none currently captured. Per the prevention-introspection discipline (#2823) each must be captured or filed before that PR's findings can be considered fully closed — this item FILES them (the code fixes landed on the PR; these are the standing gates that close each finding's CLASS so a future coordinator cannot reintroduce it). Each is a `check:standards` rule, script-decidable from source alone.

## The guards to add (each a `check:standards` rule over `scripts/**`)

- [ ] **Trust-chain registration (from B1).** Any file that imports `we:scripts/lib/auto-land-seam.mjs`, `we:scripts/lib/disposition-land-seam.mjs`, or `we:scripts/review-set-label.mjs`, OR references `LAND_MODES` / `REVIEW_LABELS.accepted` in a write/mode position, must have its basename present in `TRUST_CHAIN` (`we:scripts/lib/gate-config.mjs`). Closes the class for every future coordinator that joins the clear path — trust-chain membership is opt-in config a new file's author must currently remember.
- [ ] **Numeric verdict-rank literal (from M1).** Extend `we:scripts/lib/verdict-totality.mjs` (it already walks every `scripts/**` source under `check:standards`): any `@verdicts-total` object literal mapping verdict keys to NUMERIC values, declared OUTSIDE `we:scripts/lib/jury-core.mjs`, is an error — "strictness/rank tables are single-sourced; import `verdictStrictness`." A key-only totality check already passes such a literal (which is why the M1 hand-copy slipped the gate); this adds the rank check.
- [ ] **Hardcoded repo-key literal (from M3).** Single-source the slug↔key table (done: `we:scripts/lib/constellation-repos.mjs`), then a rule: a script that parses a `--repo` flag may not contain a hardcoded repo-key literal (`'we'` / `'frontierui'` / `'plateau-app'`) in a repo-assignment position — it must derive the key through `repoKeyForSlug`.
- [ ] **Import hygiene (from the dead/duplicate-imports minor).** Over `scripts/**`: flag a named import that is never referenced, and two `import` statements sharing one specifier (e.g. `node:path` imported twice).
- [ ] **CLI↔test pairing (from the missing-CLI-test minor).** A `scripts/*.mjs` CLI (has a shebang / `IS_CLI` main guard) must have a `we:scripts/__tests__/<name>.test.mjs` sibling, so an impure CLI half cannot ship untested while ~57 siblings carry one.

## Cross-references

- **#2830** — the review that named these; its code fixes are landed. This item captures the standing guards.
- **#2823** — the prevention-introspection discipline requiring each named guard to be captured or filed.
- The ledger-freshness binding (M4) is a distinct, larger design item filed separately (see the #2572 line).

## Acceptance

- Each of the five rules above is implemented in `check:standards` (or explicitly ruled out with a recorded reason), and the repo passes with the new rules enabled.
- Each rule ships with a focused unit test proving it fires on the exact defect the #2830 review found and passes on the fixed code.
