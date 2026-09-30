---
bornAs: xzseaif
kind: story
size: 1
status: active
scope: ["we:scripts/backlog.mjs"]
dateOpened: "2026-09-29"
dateStarted: "2026-09-30"
preparedDate: "2026-09-30"
preparedAgainstSha: "0f1ba0821f0edb2d05f7a0ff08fb7749b7cc951e"
tags: []
---

# prepare-stamp works on an actively claimed card without resetting it to open

Live 2026-09-29: workers preparing a card before building it (operator rule: prepare first) found that we:scripts/backlog.mjs prepare-stamp forces status: open, which undoes the active claim on a card mid-build; two workers had to set preparedDate/preparedAgainstSha by hand instead. MVP: prepare-stamp keeps an active status (only stamps preparedDate + preparedAgainstSha) when the card is claimed. Must: test for an active card.

## Design

Premise verified on current `main`: `prepareStamp()` at `we:scripts/backlog.mjs:584` unconditionally calls
`setFrontmatterField(before, 'status', 'open', { after: ['kind', 'size'] })` (line 589). On a card claimed
mid-build (`status: active`, or `preparing` from `claim --as=preparing`, see lines 398/459) that rewrites the
status to `open`, silently dropping the claim. No later commit touches this (`git log` shows only the item's
own JIT-numbering commit). The `preparedDate` (592) and `preparedAgainstSha` (594) splices are already
status-independent.

Fix: read the current status with `readField(before, 'status')` (already imported, line 39) and only splice
`status: open` when the status is absent or already `open` (first token only, since `readField` returns the raw
rest of the line including any trailing `# comment`). This inverted guard never rewrites `active`, `preparing`,
`parked`, `resolved` or `folded` — stamping must not reopen or unpark a card. The
success message (line 597) reports the status actually left in place instead of the hard-coded "status: open",
and the JSON payload gains `status`.

## MVP

Musts only:
- `prepare-stamp` on a card with any status other than absent/`open` (e.g. `active`, `preparing`, `parked`) leaves the status untouched and stamps only
  `preparedDate` + `preparedAgainstSha`.
- `prepare-stamp` on an `open` (or status-less) card behaves exactly as before.
- A test covering the active card (the item's stated Must), plus the preparing and open cases.

Out of scope (see Follow-ups): auditing other verbs for the same status-clobber pattern; the two workers'
hand-set stamps from 2026-09-29 (already landed, nothing to migrate).

## Test plan

New `we:scripts/__tests__/backlog-prepare-stamp-status.test.mjs`, spawning `node we:scripts/backlog.mjs prepare-stamp
NNN --backlog-dir=<tmp> --session=<nonexistent>` via `execFileSync` (pattern: `we:scripts/__tests__/number-stranded-locus.test.mjs`;
we:scripts/backlog.mjs exports no `main`). The temp dir is `git init`ed with one commit because `git rev-parse HEAD` runs
with `cwd: DIR`; the nonexistent `--session` keeps the touch-recording from writing the lane's real claims state.
Assert on `status` only for the RED signal:
1. **active card keeps `status: active`** and gains `preparedDate` + `preparedAgainstSha`. RED before the fix:
   status is rewritten to `open`.
2. **preparing card keeps `status: preparing`**. RED before the fix for the same reason.
3. **parked card keeps `status: parked`** (not reopened). RED before the fix for the same reason.
4. **open card, and `status: open  # comment`, stay open** and get both stamps (regression guard; passes before and after).
5. **Idempotent re-run** on the active card changes nothing further (dependent on case 1).

## Proof plan

Live before/after in this lane: copy a fixture card with `status: active`, run `prepare-stamp` with a copy of the pre-fix
`we:scripts/backlog.mjs` from `origin/main` (status flips to `open`), then with the fixed tree (status stays `active`, both
stamps present). Paste the actual before/after `status:` lines into the PR. Also run the new test file: 1-3 fail
on the pre-fix tree, all pass after.

## Follow-ups

- Audit other backlog verbs that splice `status` unconditionally for the same claim-clobbering pattern.
- Have `prepare-stamp` warn when the card is claimed by a different session than the caller.

## Done when

1. **Executable** — `npx vitest run we:scripts/__tests__/backlog-prepare-stamp-status.test.mjs` fails before this
   item lands and passes after.
2. **Live** — `prepare-stamp` on a fixture `status: active` card leaves `status: active` (before/after lines in the PR).
