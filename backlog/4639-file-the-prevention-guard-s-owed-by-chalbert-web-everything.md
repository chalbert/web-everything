---
bornAs: xq2sk5f
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/git-already-done.mjs", "we:scripts/lib/gh-spend.mjs", "we:scripts/lib/gh-throttle.mjs", "we:scripts/lib/pr-limit.mjs", "we:scripts/lib/__tests__/git-already-done.test.mjs", "we:scripts/lib/__tests__/gh-spend.test.mjs", "we:scripts/lib/__tests__/gh-throttle.test.mjs", "we:scripts/lib/__tests__/pr-limit.test.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3103's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/git-already-done.mjs:58` — Add a fixture test built from a real slice of main's first-parent log (including a JIT-number drain commit) that asserts git answers negatively; also exempt messages matching the drain JIT-number shape from the squash check.
2. `we:scripts/lib/git-already-done.mjs:29` — Cache the parsed first-parent log and alias map per fetchKey for the TTL, and negative-cache failed fetches; add a spawn-count test over N ids asserting one log scan per window.
3. `we:scripts/lib/gh-spend.mjs:185` — Add an invariant test that sums caller points against gap attributed for overlapping observations, or document the new non-reconciliation in the report header.
4. `we:scripts/lib/gh-throttle.mjs:319` — Require exactly one `query=` token in the argv, and run the mutation-keyword check over every field value rather than only the first match. Add a classifyGhWrite table test with duplicate and mixed `-f/-F/--raw-field` query fields.
5. `we:scripts/lib/git-already-done.mjs:50` — Add a deterministic equivalence test covering a matching PR title with nonmatching rebase commit messages, and require fallback whenever git cannot establish the PR metadata needed for a negative answer.
6. `we:scripts/lib/gh-throttle.mjs:322` — Add a table-driven classifier gate covering separate and equals-form value flags, requiring every hidden GraphQL payload form to remain classified as a write.
7. `we:scripts/lib/pr-limit.mjs` — A standard static analysis gate (e.g., ESLint `no-undef` or TypeScript typechecking) that prevents merging references to undeclared variables.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3103@db48eb4d75fd94d5c0b35b310e431b9710679415

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
