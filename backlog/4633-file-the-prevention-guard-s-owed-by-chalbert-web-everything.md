---
bornAs: xn3t4b4
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/critical-work.mjs", "we:scripts/lib/__tests__/critical-work.test.mjs"]
dateOpened: "2026-09-30"
preparedDate: "2026-10-02"
preparedAgainstSha: "db98be3296929218431ced01a9ca0982b5f8f5c5"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3124's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/critical-work.mjs:172` — Normalise `tags` with `Array.isArray(work?.tags) ? work.tags : []` and add a malformed-input case to we:critical-work.test.mjs. A boundary-input fuzz test over criticalWorkVerdict would catch the whole class.
2. `we:scripts/lib/critical-work.mjs:163` — Add a table-driven test that feeds case, leading-slash and `./` variants of every statute and irreversible prefix through `criticalWorkVerdict`. Better, normalise `f` to lowercase/trimmed form once before every prefix test.
3. `we:scripts/lib/critical-work.mjs:163` — Add a parity test asserting that for every policy-tier basename, `we:`, sibling-alias and nested-directory variants stay critical. Alternatively keep `isPolicyCorePath` (basename-matched) in the verdict.
4. `we:scripts/lib/critical-work.mjs:75` — Add a `check:standards` rule requiring every `.github/` file that is not in the ordinary set to be classified as critical or not. Alternatively extend `MUST_BE_CRITICAL` to include CODEOWNERS.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3124@0e6f5731bd3e8a3c3d0d2ad1042236c48950d448

## Design

Premise check (2026-10-02, main `db98be329`): nothing in `git log` delivers these guards; all four gaps are still present. The cited line numbers drifted (the file grew); current locations are below.

- **Guard 1 — `tags` shape.** `we:scripts/lib/critical-work.mjs` (`criticalWorkVerdict`, the security arm) calls `work?.tags?.includes('security')`. Today `{}` and `5` throw, and a string does substring matching (`'insecurity'` and `'security'` both trip). Fix, FAIL CLOSED: `tags` that is an array is used as is; `null`/`undefined` means no tags; any OTHER shape (string, object, number) is malformed and adds the `security` proxy with detail `malformed tags`, never a throw and never a silent pass. `isCriticalMiss` forwards `tags` raw, so it inherits this.
- **Guard 2 — one normaliser.** `normalizePath` strips `we:`, alias colons and a leading `./` only, case-sensitively. Fix, in this order: trim, lower-case, strip the alias prefix, then strip leading `./` and `/` repeatedly (so `/./x` and `we:/x` both reduce). The prefix tests must then compare case-insensitively: lower-case the prefix lists once at module load, because the statute prefixes include `we:AGENTS.md` and `we:CLAUDE.md` (we:scripts/lib/dispatch-thresholds.mjs), which a lower-cased path would otherwise stop matching, a fail-open regression. Verify `isPrincipleSurface`/`isPolicySpecPath` in we:scripts/lib/gate-config.mjs have no case-sensitive patterns that the lower-cased path would break. The `human-required`/`security` detail strings come back lower-cased (cosmetic).
- **Guard 3 — policy-tier parity.** `POLICY_TIER_HOMES.has(f)` is an exact match on the normalised path. The bare and `we:` forms are already tested; guard 2 makes the dot-slash, leading-slash and upper-case forms collapse to the same string, so the new parity test covers just those. A sibling-repo-prefixed home is NOT critical via `gateSelf` (only `irreversible` uses `repoRelativeForm`); the test asserts that explicitly so nobody expects otherwise.
- **Guard 4 — `.github/` classification.** `CRITICAL_PATH_PREFIXES.irreversible` lists `we:.github/workflows/`, `we:.github/branch-protection`, `we:.github/required-check`; `we:.github/CODEOWNERS` (review-ownership surface, absent today) and other `.github/` files are unclassified. Fix within this card's scope: add `we:.github/codeowners` to the irreversible prefixes (lowercase after guard 2) and extend the independent `MUST_BE_CRITICAL` fixture in `we:scripts/lib/__tests__/critical-work.test.mjs`. The `check:standards` rule is out of scope (scope here is the two critical-work files) — see Follow-ups.

## MVP

**Must**

1. Normalise `tags` to an array in `criticalWorkVerdict` (guard 1), with a malformed-input fuzz test over the whole verdict (`tags`, `filesTouched`, `taskType`, `risk` as wrong types never throw, and stay fail-closed where scope is unknown).
2. Single canonical path form: `normalizePath` also strips leading `/` and lower-cases (guard 2), with a table-driven test of case / leading-slash / `./` / `we:` variants of one path per statute and irreversible prefix.
3. Policy-tier parity test (guard 3): for every `POLICY_TIER_HOMES` entry, the bare, `we:`, `./`, `/` and upper-case variants are all critical.
4. Classify `we:.github/CODEOWNERS` as critical (guard 4, "alternatively" form) and add it to `MUST_BE_CRITICAL`.

Deliberately OUT: a `check:standards` rule that every `.github/` file is classified (Follow-up A); fuzzing other modules (Follow-up B).

## Test plan

All in `we:scripts/lib/__tests__/critical-work.test.mjs`.

- `tags` malformed table (`'security'`, `'insecurity'`, `{}`, `5`): each returns without throwing and carries the `security` proxy (fail closed); `null`, `undefined`, `[]` and `[null]` do not. RED before: `{}` and `5` throw `TypeError`; `'insecurity'` is not flagged as malformed.
- Boundary fuzz: `filesTouched` of non-strings, `taskType` as a number, `risk` as an object: never throws; empty/garbage scope still `unknown-scope`. RED before only for the `tags` rows; the rest pins current behaviour so it stays.
- Variant table: for one path under each statute / gateSelf / irreversible prefix, the upper-case, leading-slash, dot-slash and upper-case-alias forms are all critical, including `we:CLAUDE.md` and `we:AGENTS.md` in their original case (guards the lower-casing regression), plus `/./x`-style and `we:/x`-style double prefixes. RED before: upper-case and leading-slash variants return `critical: false` (no prefix matches).
- Policy-home parity: `it.each([...POLICY_TIER_HOMES-derived list])` for the five variants. Needs the homes list, so export it from we:scripts/lib/critical-work.mjs as a test-only export or derive from `TRUST_CHAIN` in the test (preferred: derive, no new export). RED before for the upper-case / `/` variants.
- `we:.github/CODEOWNERS` (bare, `we:` and sibling-repo-prefixed forms such as the plateau-app alias) critical; RED before: not matched by any prefix. `we:.github/copilot-instructions.md` stays non-critical (guards against over-broad matching).

## Proof plan

Before/after on the real function, from the lane: a short `node --input-type=module -e` probe imports `criticalWorkVerdict` from we:scripts/lib/critical-work.mjs and prints the verdict (or the thrown message) for three inputs: an upper-case, leading-slash variant of a land-script path; an ordinary script path with `tags` set to an object; and the we:.github/CODEOWNERS path. Run it on `origin/main` via a throwaway `git worktree add` of that ref (expect `critical:false`, a thrown TypeError, `critical:false`) and on the branch (expect critical, no throw, critical); remove the worktree after. Paste both outputs into the PR body. Plus the vitest file for we:scripts/lib/__tests__/critical-work.test.mjs and `npm run check:standards`.

## Follow-ups

- A. (builder files this as a backlog item; also CODEOWNERS at repo root or docs/, dependabot, rulesets) `check:standards` rule: every tracked `.github/` file outside the ordinary set must be classified critical or not-critical (guard 4, primary form).
- B. Boundary-input fuzz harness reusable across the other gate predicates (`isPrincipleSurface`, `selectProvider`).
- C. Decide whether nested-directory variants of policy homes should be critical (policy question; not assumed here).

## Done when

1. **Executable** — `npx vitest run` on the critical-work test file under scripts/lib/__tests__ fails on `origin/main` and passes on the branch. Must 1: malformed `tags` never throws and `'insecurity'` is not security. Must 2: case / leading-slash / `./` / `we:` variants are critical. Must 3: every policy-tier home passes the variant parity test. Must 4: `we:.github/CODEOWNERS` is critical and in `MUST_BE_CRITICAL`.
