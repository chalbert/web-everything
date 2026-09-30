---
bornAs: xn3t4b4
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/critical-work.mjs", "we:scripts/lib/__tests__/critical-work.test.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3124's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/critical-work.mjs:172` — Normalise `tags` with `Array.isArray(work?.tags) ? work.tags : []` and add a malformed-input case to we:critical-work.test.mjs. A boundary-input fuzz test over criticalWorkVerdict would catch the whole class.
2. `we:scripts/lib/critical-work.mjs:163` — Add a table-driven test that feeds case, leading-slash and `./` variants of every statute and irreversible prefix through `criticalWorkVerdict`. Better, normalise `f` to lowercase/trimmed form once before every prefix test.
3. `we:scripts/lib/critical-work.mjs:163` — Add a parity test asserting that for every policy-tier basename, `we:`, sibling-alias and nested-directory variants stay critical. Alternatively keep `isPolicyCorePath` (basename-matched) in the verdict.
4. `we:scripts/lib/critical-work.mjs:75` — Add a `check:standards` rule requiring every `.github/` file that is not in the ordinary set to be classified as critical or not. Alternatively extend `MUST_BE_CRITICAL` to include CODEOWNERS.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3124@0e6f5731bd3e8a3c3d0d2ad1042236c48950d448

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
