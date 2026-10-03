---
bornAs: xodzat3
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/operator-command.mjs", "we:scripts/lib/__tests__/operator-command.test.mjs", "we:scripts/conveyor/ci-auth-diagnosis.mjs", "we:scripts/conveyor/__tests__/ci-auth-diagnosis.test.mjs", "we:docs/agent/backlog-workflow.md"]
dateOpened: "2026-10-01"
preparedDate: "2026-10-03"
preparedAgainstSha: "a4687bea96bcde71038823a9ffeee3ff774c04f2"
tags: []
---

# Prevention — Add a spec checklist item and a test requirement that any value interpolated into an operator-facing co… (from chalbert/web-everything#3276 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4545-bad-credentials-smell-names-the-failing-secret-and-repo.md:35` — Add a spec checklist item and a test requirement that any value interpolated into an operator-facing command is allowlist-validated. A shared `renderOperatorCommand` helper that refuses non-matching tokens would enforce it deterministically.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3276@75925e5b83a1cb18f21174b5211c800f09985c08

## Progress

- **Old premise/scope:** scope pointed at the 4545 card file itself (the 4545 card at line 35), which is only the citation, not code. Cited line 35 no longer matches: 4545 is resolved and rewritten.
- **Premise check (main @ a4687bea9):** not delivered. `git log -S renderOperatorCommand` finds only this card's own filing; no `renderOperatorCommand` or equivalent exists in `scripts/`. The only render site in this MVP is `renderCiAuthDiagnosis` in `we:scripts/conveyor/ci-auth-diagnosis.mjs:214`, which validates inline with module-private `SLUG`/`SECRET` regexes (lines 5, 7) — correct today but unshared and unenforced for the next author. No checklist line in `we:docs/agent/backlog-workflow.md` covers it (nearest sibling checklist-style rule: "Removing an automatic actor", line 43).
- **Corrected scope:** new shared helper + test, refactor the one existing site onto it, one checklist line in the backlog workflow doc. Goal unchanged.

## Design

1. Add `we:scripts/lib/operator-command.mjs` exporting `renderOperatorCommand(template, values)`. `template` is a fixed argv-style array of literal strings and `{name}` slots, e.g. `['gh','secret','set','{secret}','--repo','{repo}']`; `values` maps each slot to a string. A built-in allowlist of token kinds (exactly two kinds, the ones the migrated site uses: `secret` = `/^[A-Za-z_][A-Za-z0-9_]*$/`, `repo` = `/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/`; exported as `TOKEN_KINDS` so the diagnosis module reuses the same regexes for its non-command checks) is keyed by slot name; values must be strings (non-strings refuse); every value must fully match its kind's regex or the call returns `{ ok: false, refused: '<slot>' }` (never throws, never echoes the bad value). Unknown slot names and missing values also refuse. On success it returns `{ ok: true, command }` with tokens joined by single spaces — allowlisted tokens contain no shell metacharacters, so no quoting is needed.
2. Move the `SLUG`/`SECRET` regexes in `we:scripts/conveyor/ci-auth-diagnosis.mjs:5-7` so the helper owns the token kinds (the diagnosis module imports them for its non-command uses), and replace the template string at `we:scripts/conveyor/ci-auth-diagnosis.mjs:214` with `renderOperatorCommand`; render the command line only when `ok`.
3. Add a checklist line to `we:docs/agent/backlog-workflow.md` next to the "Removing an automatic actor" rule: any card whose work interpolates a value into an operator-facing command (rotation, recovery, copy-paste instructions) must route it through `renderOperatorCommand` and carry a test that a hostile value (`;`, `$(…)`, backtick, newline, whitespace) is refused. Marked as a checklist line, not a lint.

## MVP

- Musts: the helper with the two token kinds (`secret`, `repo`), refusal on mismatch/missing/unknown, the one call-site migration, the checklist line, tests below.
- Out of scope (Follow-ups): a lint that detects ad-hoc `gh …${}` strings; operator commands in other modules; quoting support for free-form values (MVP refuses anything non-allowlisted rather than quoting it).

## Test plan

- `we:scripts/lib/__tests__/operator-command.test.mjs` (new): valid secret+repo renders `gh secret set FUI_READ_TOKEN --repo chalbert/web-everything` (RED: module missing). Each of `;`, `$(x)`, backtick, `\n`, space, `--flag`-shaped, empty and non-string values for each slot refuses and the result never contains the value. Unknown slot and missing value refuse. Result is never thrown.
- Also in the new file: `TOKEN_KINDS.secret`/`.repo` are the regexes the helper enforces (RED: export missing).
- Extend `we:scripts/conveyor/__tests__/ci-auth-diagnosis.test.mjs` with **preservation** cases (GREEN today and after; mutation proof: dropping the helper's regex check turns them red): hostile `secret` (`X; rm -rf ~`) and hostile `repo` render no rotation command, and the clean resolved case renders its command unchanged. The only RED source for this card is the new test file (module missing).

## Proof plan

- Before the refactor, capture `renderCiAuthDiagnosis` output for the incident-shaped resolved fixture (secret `FUI_READ_TOKEN`, repo `chalbert/web-everything`) to a file in the lane via a `node -e` import of we:scripts/conveyor/ci-auth-diagnosis.mjs; after, re-run and `diff` — must be byte-identical. Also run a hostile-secret variant: the rotation-command line is absent before and after. Record the new test file's RED (module missing) → GREEN output, then `npm run check:standards`.

## Follow-ups

- Lint/guard that flags template-literal operator commands outside the helper.
- Migrate other operator-facing command renderers; known candidates: `we:scripts/pr-land.mjs:785` (`--add-label ${LABEL}`), `we:scripts/workflows/review-parked-prs.mjs:607` and `:843` (`gh pr list --repo ${slug}`, `gh pr checkout ${pr}`). These need new token kinds (label, pr number, sha) — one card per module.
- Optional quoting mode for free-form values, only with a concrete need.

## Done when

1. **Executable** — `npx vitest run` on we:scripts/lib/__tests__/operator-command.test.mjs fails before this item lands (helper module missing) and passes after, with we:scripts/conveyor/__tests__/ci-auth-diagnosis.test.mjs staying green; a grep for renderOperatorCommand in we:docs/agent/backlog-workflow.md finds the checklist line.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
