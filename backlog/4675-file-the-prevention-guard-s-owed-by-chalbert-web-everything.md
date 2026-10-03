---
bornAs: xln1ya7
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/sweep-orphan-backlog-cards.mjs", "we:scripts/lib/open-pr-items.mjs", "we:scripts/operations/machine-pr-title.mjs", "we:scripts/lib/forge-land-provider.mjs", "we:scripts/operations/__tests__/sweep-orphan-backlog-cards.test.mjs", "we:scripts/lib/__tests__/open-pr-items.test.mjs", "we:scripts/operations/__tests__/machine-pr-title.test.mjs", "we:scripts/lib/__tests__/forge-land-provider.test.mjs"]
dateOpened: "2026-09-30"
preparedDate: "2026-10-02"
preparedAgainstSha: "a770bdad0ced4c8304349bd4476eeea4befd0f97"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3207's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/sweep-orphan-backlog-cards.mjs:119` — Hoist the prevention-card heading and its source-ref regex into one shared exported constant used by every producer and consumer. Add a check:standards rule that fails on the literal `owed by` heading string outside that module.
2. `we:scripts/lib/open-pr-items.mjs:48` — Add a cleanTitle/machinePrTitle rule that neutralizes `#\d` sequences in the subject slot (for example `#` followed by a zero-width-free substitute), or restrict itemNumsFromPr's title scan to the lead `<REPO> #id:` token. Back it with a property test over MACHINE_TITLE_KINDS asserting that itemNumsFromPr(title) equals only the lead id for a subject containing `#1234`.
3. `we:scripts/operations/machine-pr-title.mjs:75` — Add a table-driven regression gate covering every recognized legacy template and asserting that normalization preserves delivery-versus-annotation classification.
4. `we:scripts/lib/forge-land-provider.mjs:86` — Add parameterized create-boundary tests for omitted, undefined, null and empty titles, requiring refusal before constructing publish arguments.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3207@1b0dc6b662e73a26e6b426ae1159284dc0ea75a2

## Done when

1. **Executable** — `npx vitest run we:scripts/operations/__tests__/sweep-orphan-backlog-cards.test.mjs we:scripts/lib/__tests__/open-pr-items.test.mjs we:scripts/operations/__tests__/machine-pr-title.test.mjs we:scripts/lib/__tests__/forge-land-provider.test.mjs` and `npm run check:standards` pass; the new cases named in `## Test plan` fail on `origin/main` before this lands.

## Progress

- 2026-10-02 prepare pass. Premise check: `git log -S4675` finds no delivery; all four cited sites still exist unguarded on `origin/main`. No factual drift beyond line shifts (guard 1 regex at `we:sweep-orphan-backlog-cards.mjs:119`, grep pattern `:127`; guard 2 title scan `we:open-pr-items.mjs:48`; guard 3 `publicationTitle` at `we:machine-pr-title.mjs:75`; guard 4 `buildCreateArgs` `we:forge-land-provider.mjs:84`). Scope unchanged.

## Design

**Guard 1 — one shared heading constant.** The `owed by` heading is spelled out in five places: `we:sweep-orphan-backlog-cards.mjs:119` (`TITLE_SOURCE_RE`) and `:127` (`MAIN_GREP_PATTERN`), `we:machine-pr-title.mjs:47` (`guarded` regex) and the `file the prevention guard\(s\) owed` alternative in `assertMachineTitle`, `we:land-prevention-card.mjs:324`, and `we:review-loop-cli.mjs:250`. Add one module (new `we:scripts/lib/prevention-card-heading.mjs`) exporting the heading text plus builder/matcher helpers (`PREVENTION_HEADING`, `preventionHeadingRe`, `preventionHeadingLine(source)`), and make every producer/consumer above import it. Add a `check:standards` rule in `we:scripts/check-standards-rules.mjs` (pure, individually testable like its neighbours) that fails on the literal `guard(s) owed by` outside that module, tests, backlog cards and docs.

**Guard 2 — title scan cannot read `#\d` from the subject.** `itemNumsFromPr` (`we:open-pr-items.mjs:48`) scans the whole title for `#(\d{2,5})`, so a subject like `fix #1234 parse` credits item 1234. Restrict the title scan to the lead `<REPO> #id:` token (plus the existing `(from #N review)` strip, which is already removed first), AND neutralize `#\d` in `cleanTitle` (`we:machine-pr-title.mjs`) so machine titles never carry a scannable citation in the subject slot. Keep the existing "falls back to a #NNN in the title" behaviour for non-machine titles such as `Fix the drain (#2330)` (existing test `we:open-pr-items.test.mjs:19`): the lead-token restriction applies only when the title has a machine lead token; otherwise the loose scan stays.

**Guard 3 — legacy-template table.** `publicationTitle` (`we:machine-pr-title.mjs:~75`) maps legacy subjects to a kind by ordered regexes. Extract the mapping into an exported table (`LEGACY_TITLE_TEMPLATES`: pattern, kind, boilerplate flag) consumed by `publicationTitle`, so a test can iterate it and assert each normalized title keeps its delivery-vs-annotation classification (via `deliveredItemNumsFromPr` and `isAnnotationPr`: prepare/review-prep stay annotation, build/fix stay delivery).

**Guard 4 — create-boundary refusal.** `buildCreateArgs` (`we:forge-land-provider.mjs:84`) skips `assertMachineTitle` when `title == null` and falls to `--fill` (documented bare/dry-run fallback, pinned by `we:forge-land-provider.test.mjs:51-57`, so that pure builder stays unchanged). Add the refusal at the REAL create boundary, `createGhLandProvider().create(args)` (`:166`): when `args.title` is `undefined`, `null`, empty or whitespace-only, throw before `buildCreateArgs`/`exec` are reached.

## MVP

Musts: (1) shared heading module + all five sites migrated + the `check:standards` rule; (2) lead-token-restricted title scan + `#\d` neutralization in `cleanTitle`, with the property test; (3) exported legacy-template table + table-driven regression test; (4) `create()` refusal for omitted/undefined/null/empty titles with parameterized tests, exec never called.
OUT (Follow-ups): changing the dry-run `--fill` fallback of the pure `buildCreateArgs`; unifying `deliveredItemNumsFromPr`'s separate title rules.

## Test plan

- `we:sweep-orphan-backlog-cards.test.mjs` / new heading-module test: heading builder round-trips through the matcher and the grep pattern; RED before: no shared module exists.
- `check-standards` rule test: a fixture with the literal heading outside the module is flagged, inside the module/tests is not; RED before: no such rule.
- `we:open-pr-items.test.mjs` + `we:machine-pr-title.test.mjs` property test: for every `MACHINE_TITLE_KINDS` kind, a subject containing `#1234` yields `itemNumsFromPr(title)` equal to only the lead id; RED before: `1234` is included.
- `we:machine-pr-title.test.mjs` table test: for each `LEGACY_TITLE_TEMPLATES` entry the normalized title keeps its classification (annotation kinds stay annotation PRs, delivery kinds still deliver the lead id); RED before: no table to iterate, and a mis-mapped entry has no gate.
- `we:forge-land-provider.test.mjs`: `it.each` over omitted/`undefined`/`null`/`''`/`'  '` titles calling `create()` with a spy `exec`; asserts it throws and `exec` is never called; RED before: omitted/null reach `exec` with `--fill`.

## Proof plan

Live before/after on a real surface: (a) run `itemNumsFromPr('lane/xabc1234-foo', machinePrTitle({item:'4675', kind:'build', subject:'fix #1234 parse'}))` via `node -e` on `origin/main` (returns `4675`,`1234`) vs the branch (returns only `4675`); (b) `node we:scripts/operations/sweep-orphan-backlog-cards.mjs --dry-run` output identical before/after the heading refactor; (c) `node -e` calling the provider's `create({base,head})` with a stub exec before (exec called with `--fill`) vs after (throws, exec not called); (d) `npm run check:standards` green, with a scratch literal heading planted in a throwaway file shown red.

## Review amendments (adversarial review, converged)

- **Guard 1 sites.** Also migrate `we:scripts/review-set-label.mjs:794` (`Filed the prevention guard(s) owed by ${subject}…`). The `check:standards` rule must match BOTH the literal `guard(s) owed by` AND the regex-escaped `guard\(s\) owed` spelling (as at `we:scripts/operations/machine-pr-title.mjs:47`/`:61`, `we:scripts/operations/land-prevention-card.mjs:324`, `we:scripts/operations/sweep-orphan-backlog-cards.mjs:119`); its rule test includes an escaped-form fixture. "guard owed by" (no `(s)`) is not a hit.
- **Guard 2 scoping.** `#\d` neutralization applies ONLY to the subject inside `machinePrTitle`, never inside `cleanTitle` (which also runs on full titles and would corrupt the lead id and the `(from #N review)` suffix pinned by `we:machine-pr-title.test.mjs`). Lead-token extraction must also accept an alphanumeric lead id (`WE #xjhjcjn:`), yielding no number and NOT falling back to the loose scan. Verify `preventionCardTitle` output is unchanged.
- **Guard 3 honesty.** The table test is a characterization gate (classification already holds on main); it is RED only on the missing `LEGACY_TITLE_TEMPLATES` export. One extra case is added that is RED today: every table entry must be reachable (no entry shadowed by an earlier pattern).
- **Guard 4 test updates.** The two existing `create()` calls without a title in `we:scripts/lib/__tests__/forge-land-provider.test.mjs` (`:92`, `:125`) get a real machine title (`WE #2153: build — x`). Only omitted/`undefined`/`null` are RED today; `''`/whitespace already throw via `assertMachineTitle` and are kept as regression rows. `we:pr-land.mjs` real create path always passes a `publicationTitle` getter, so it is unaffected; read the title once into a local in `create()`.
- **Proof (a)/(c).** Use a plain branch name (`feature-x`) so only the title is exercised; (c) catches the throw.

## Follow-ups

- Make the pure `buildCreateArgs` itself refuse a missing title once the dry-run plan render passes a real title.
- Fold `deliveredItemNumsFromPr`'s title rules onto the same lead-token helper.
