---
bornAs: xrghphg
kind: story
size: 3
status: open
dateOpened: "2026-08-14"
tags: [agent-memory, citation, backlog, gate, dead-link]
scope:
  - we:scripts/lane-drain.mjs
  - we:scripts/__tests__/lane-drain-numbering.test.mjs
  - we:scripts/lib/citation-check.mjs
  - we:scripts/lib/__tests__/citation-check.test.mjs
  - we:scripts/check-standards.mjs
  - we:agent-memory-src/51-feedback_hookable_vs_judgment_rule.md
  - we:agent-memory-src/index-verif.md
  - we:agent-memory-src/resolve-on-land-or-conveyor-redispatches.md
  - we:agent-memory-src/index-batch.md
  - we:agent-memory-src/plateau-loop-runs-on-dev-laptop-simple.md
  - we:agent-memory-src/story-preparation-checklist.md
  - we:agent-memory-src/grep-every-name-you-cite-in-prose.md
---

# agent-memory-src is missing from the at-land hash rewrite scope

## The defect

When the drain numbers a stranded hash (the `number-stranded` command of `we:scripts/backlog.mjs`, #2288/#2319),
it rewrites every hash cross-reference it finds in `we:backlog/` and `we:docs/agent/` — but `agent-memory-src/`
is not in that set, so a citation living there is left pointing at an id that no longer exists anywhere.

Today's real instance: `3098 → #3098` and `3099 → #3099` were numbered (commit `df8488e9`, "drain:
JIT-number 3098→#3098, 3099→#3099 at land"). Every reference in `we:backlog/` was rewritten. The
reference in `we:agent-memory-src/story-preparation-checklist.md:45` — `"epic \`3099\`, first slice = the
consumers check"` — was left pointing at `3099`, an id that resolves to nothing anywhere in the repo (its
own item landed as `we:backlog/3099-story-preparation-a-card-must-carry-what-its-delivery-needs.md`). A
human reviewer reading the sentence caught it; no gate flagged it.

**Why this outranks an ordinary dead link:** `we:agent-memory-src/` compiles into the agent-memory bundle
every future session loads into context. A dead pointer there is read and silently misdirects every session
from now on, where the same dead link in a backlog card is only found when someone opens that one card.

## Grounded findings

**1. The rewrite set is hardcoded, and not driven by the constant that documents it.**
`we:scripts/lib/citation-check.mjs:41` exports `HASH_REWRITE_DIRS = ['backlog/', 'docs/agent/']`, and its
comment (`we:scripts/lib/citation-check.mjs:38-40`) correctly documents "`numberPendingHashes` … rewrites
hash→NNN only in these two dirs." But `HASH_REWRITE_DIRS` is never imported anywhere (`grep -rn
"HASH_REWRITE_DIRS" --include=*.mjs .` returns only its own definition line) — it is a comment-grade
constant, not live wiring. The actual rewriter, `numberPendingHashes` in `we:scripts/lane-drain.mjs:575-650`,
hardcodes its own two roots independently: `const BL = join(CWD, 'backlog')` (line 576) and `const DOCS =
join(CWD, 'docs', 'agent')` (line 577), then builds its `files` array from `stems` (backlog) + `docsFiles`
(line ~601) and passes that to `applyLedger`. Widening the rewrite set means editing `numberPendingHashes`
itself (`we:scripts/lane-drain.mjs`), not just the documentary constant.

**2. `bornAs` exclusion is a per-line guard inside `applyLedger`, independent of which files are passed in —
safe to widen without touching it.** `we:scripts/backlog/id.mjs:144-189` (`applyLedger`): the rewrite is
`content.split('\n').map((line) => (BORN_AS_RE.test(line) ? line : swapHashes(line, entries)))` — every line
is blind-swapped EXCEPT one matching `BORN_AS_RE` (`^bornAs:\s*x[0-9a-z]{6}\s*$`, `we:scripts/backlog/id.mjs:28`).
This guard fires per-line on whatever `files` contains; it has no dependency on which directories fed that
array. Adding `agent-memory-src/*.md` to the `files` list passed to `applyLedger` cannot disturb `bornAs`
protection — confirmed by reading the function, not assumed. `we:docs/agent/backlog-workflow.md:656`
corroborates: `bornAs` is "excluded from the ledger's blind hash→NNN rewrite (a one-line guard)."
Also relevant: `pathFor` inside `we:scripts/lane-drain.mjs` already branches on `name.includes('/')` to
treat a full-path entry (like `we:docs/agent/foo.md`) as already repo-relative — an `we:agent-memory-src/foo.md`
entry would fall into that SAME existing branch, needing no new path-resolution case.

**3. Current blast radius, measured (not assumed).** `grep -rnoE '\bx[0-9a-z]{6}\b' we:agent-memory-src/`
(excluding `bornAs:` lines) finds **10 hash-shaped occurrences across 7 distinct hashes in 7 files**:
`xvwmwkx`, `3026` (×2), `2609`, `2666`, `2501` (×2), `3099`, `3027` — in
`we:agent-memory-src/51-feedback_hookable_vs_judgment_rule.md`, `we:agent-memory-src/index-verif.md`,
`we:agent-memory-src/resolve-on-land-or-conveyor-redispatches.md` (×2), `we:agent-memory-src/index-batch.md`,
`we:agent-memory-src/plateau-loop-runs-on-dev-laptop-simple.md` (×2),
`we:agent-memory-src/story-preparation-checklist.md`, `we:agent-memory-src/grep-every-name-you-cite-in-prose.md`
(×2). Checked against `we:backlog/`: **none of the 7 hashes exist as a backlog filename any more** — every
one already numbered and landed. Cross-checked via `bornAs` (`grep -rl "bornAs: <hash>" we:backlog/`), all 7
resolve cleanly to a real landed item: `xvwmwkx`→#2685, `3026`→#3026, `2609`→#2609, `2666`→#2666,
`2501`→#2501, `3099`→#3099, `3027`→#3027. So this is not a one-off: **all 7 hash references agent
memory currently carries are already dead**, not just the one caught today.

**4. The citation/provenance gate does not scan `agent-memory-src/` at all — confirmed at the file-list, not
just the rule.** The CITATION-VERIFICATION gate family (`we:scripts/check-standards.mjs:1082-1124`, "6f-ii")
builds its `scanFiles` from exactly five roots (`we:scripts/check-standards.mjs:1090-1096`):
`pushDir('backlog/', ['.md'])`, `pushDir('docs/agent/', ['.md'])`, `pushDir('reports/', ['.md'])`,
`pushDir('src/_data/researchTopics/', ['.json'])`, `pushDir('src/_includes/research-descriptions/',
['.njk'])`. `agent-memory-src/` is absent, so none of the three checks that run over `scanFiles` —
`findAnchorRulingMismatches`, `findDanglingLoci`, `findOutOfScopeHashSlugs` — ever see its content. Gate 3
specifically (`findOutOfScopeHashSlugs`, `we:scripts/lib/citation-check.mjs:249-258`) only inspects a path
that starts with an entry in `HASH_SLUG_OUT_OF_SCOPE_DIRS` (`we:scripts/lib/citation-check.mjs:46-50`:
`reports/`, `src/_data/researchTopics/`, `src/_includes/research-descriptions/`) — `agent-memory-src/` is in
neither that list nor `HASH_REWRITE_DIRS`, so it falls into a true gap: not rewritten, and not checked as
out-of-scope. This is the second half of why today's instance was caught only by a human reading the
sentence.

## Design — two fixes, both needed, not a fork

The two candidates named in triage are complementary, not alternatives, because they close different
failure modes:

- **Widen the rewrite set** (`numberPendingHashes` in `we:scripts/lane-drain.mjs`) fixes future renumbers —
  a hash numbered from now on self-heals in agent memory the same way it already does in
  `we:backlog/`/`we:docs/agent/`. It does **nothing** for the 7 already-dead references above (the ledger
  that could rewrite them is local/ephemeral and long gone).
- **Widen the citation gate** (`we:scripts/check-standards.mjs` `scanFiles` + `HASH_SLUG_OUT_OF_SCOPE_DIRS`
  in `we:scripts/lib/citation-check.mjs`) catches a dangling hash-slug in agent memory whenever one exists —
  including the 7 that already exist, and any future one an author types by hand rather than one a renumber
  stranded. It does not fix anything by itself; at `CITATION_GATES_ENFORCED = false`
  (`we:scripts/lib/citation-check.mjs:36`, still open per #2821) it only WARNs, so it does not block a build
  — but it is what would have caught today's instance without a human reading the sentence, which is the
  stated reason this defect outranks an ordinary dead link.

Doing only the rewrite-widen leaves the 7 known-dead references live in every session's context
indefinitely. Doing only the gate-widen leaves future renumbers producing new dead links that a
`check:standards` WARN calls out but nothing fixes. **Both ship in this item**, plus a manual one-time fix
of the 7 measured dead references (mechanical: replace each hash with its `bornAs`-derived `#NNN`, using the
mapping in finding 3 above) so turning the gate on does not immediately WARN about defects this same item
already knows the fix for.

**Size basis (3):** four small, well-isolated edits — (a) `numberPendingHashes` gains a third tracked-file
source (`agent-memory-src/*.md`, mirroring the existing `docsFiles` block almost verbatim, including staging
it in the commit's `toAdd`/`commitPaths`), (b) `we:scripts/check-standards.mjs` gains one
`pushDir('agent-memory-src/', ['.md'])` call plus `agent-memory-src/` added to the out-of-scope dir list so
gate 3 actually inspects it, (c) two existing test files each need one new case, (d) 7 files get a
mechanical hash→`#NNN` string swap already computed above. No unresolved design question, no new
abstraction — comparable in shape to #3098 (size 3, a small multi-file mechanical change with a grounding
writeup).

## Done when

- [ ] `numberPendingHashes` (`we:scripts/lane-drain.mjs`) reads tracked `agent-memory-src/*.md` files the
      same way it reads `docs/agent/*.md` (`docsFiles`, lines ~596-602), includes them in the `files` array
      passed to `applyLedger`, and includes any rewritten agent-memory-src path in the land commit's staged
      paths.
- [ ] A hash landed after this change, that is cited in an `agent-memory-src/*.md` file, is rewritten to its
      `#NNN` in the same land commit — proven by a new case in
      `we:scripts/__tests__/lane-drain-numbering.test.mjs` mirroring the existing docs/agent/ coverage.
- [ ] `bornAs:` lines are still protected from rewrite after this change (assert this explicitly in the new
      test — do not just assume finding 2 holds).
- [ ] The CITATION-VERIFICATION gate (`we:scripts/check-standards.mjs`, "6f-ii") scans `agent-memory-src/*.md`
      and gate 3 (`findOutOfScopeHashSlugs`) treats it as out-of-scope-relative-to-the-rewrite-set, so a
      hash-slug cited there and NOT in the (now-widened) rewrite set produces a WARN — proven by a new case
      in `we:scripts/lib/__tests__/citation-check.test.mjs`.
- [ ] The 7 measured dead hash references (10 occurrences, listed in finding 3) are replaced with their
      resolved `#NNN` in the 7 `we:agent-memory-src/*.md` files listed in `scope:`.
- [ ] `npm run check:standards` is 0 errors, and re-running
      `grep -rnoE '\bx[0-9a-z]{6}\b' we:agent-memory-src/ | grep -v bornAs` returns no result whose hash is
      absent from `we:backlog/` and has no `bornAs` match.

## Delivery shape

Lands in one PR — the four pieces are small and share one story (a rewrite-side fix, a gate-side fix, and
the one-time corpus cleanup that keeps the new gate quiet on landing). Could be sliced into rewrite-widen /
gate-widen / corpus-cleanup if a reviewer prefers three narrower diffs, but nothing here blocks on anything
else in the repo — no `blockedBy`.

## Independent review — 2026-08-14

Confidence: **Medium**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: verify by mutation or reversion BEFORE building) — Finding 3's blast-radius grep and bornAs cross-check are genuine and reproduce almost exactly against we:agent-memory-src/ (verified independently) — off by exactly the one file (we:agent-memory-src/story-preparation-checklist.md) fixed by commit 91072ddb after the card's numbers were taken, which the Done-when item 6 re-grep self-corrects for.
- **blast-radius** (addressed; strategy: measure against the real corpus before wiring) — Re-ran the equivalent of `grep -rnoE '\bx[0-9a-z]{6}\b' we:agent-memory-src/ | grep -v bornAs` and cross-checked every hash via `bornAs` in we:backlog/ — all 6 remaining hashes (xvwmwkx→#2685, x8918rc→#3026, x53zzf9→#2609, xppjnof→#2666, xeccleu→#2501, xonzpym→#3027) resolve exactly as the card's table claims, confirming the measurement was real, not assumed.
- **consumer** (addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — Card's finding 1 greps for all consumers of we:scripts/lib/citation-check.mjs's HASH_REWRITE_DIRS and correctly reports it has zero importers (decorative) — confirmed independently with the same grep.
- **interface** (NOT addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — The seam between the two proposed fixes was not round-tripped: mutating we:scripts/lib/citation-check.mjs's findOutOfScopeHashSlugs with 'agent-memory-src/' in outOfScopeDirs (as Size-basis (b) and Done-when item 4 instruct) fires a WARN on ANY in-flight hash-slug there, including one that fix #1 (widening HASH_REWRITE_DIRS) makes self-healing at land — the two lists are documented as mutually exclusive (rewrite-scope self-heals, out-of-scope-dirs get WARNed) and this card's literal instruction breaks that invariant. Verified by direct invocation of findOutOfScopeHashSlugs with both dirs applied.
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — Done-when item 3 explicitly commits to asserting the bornAs guard in a NEW test rather than assuming finding 2 holds, which is the right discipline; finding 2's own read of we:scripts/backlog/id.mjs:144-189 (applyLedger) is accurate — the guard is a per-line BORN_AS_RE check independent of which files feed it.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — Card is candid that gate 3 only WARNs (CITATION_GATES_ENFORCED=false, we:scripts/lib/citation-check.mjs:36) and does not block a build — it does not overclaim enforcement it can't deliver, and correctly frames the WARN as the mechanism that would have caught today's instance without a human catching it.

**Corrections applied by this review:**

- The card's 'Today's real instance' — we:agent-memory-src/story-preparation-checklist.md:45 citing bare '3099' — is now stale: commit 91072ddb ('point the memory entry at the numbered ids, not the dead hashes', same day, apparently the direct trigger for filing this card) already rewrote it to '#3099'/'#3098', so 1 of the 7 files in Done-when item 5's cleanup list no longer needs the fix.
- we:scripts/backlog/id.mjs's BORN_AS_RE is defined at line 31, not line 28 as the card's finding 2 cites.
- The card paraphrases commit df8488e9's message as '3098 → #3098, 3099 → #3099'; the actual commit message uses the hash form, 'x6cdlmu→#3098, xl2q1zt→#3099 at land'.

The core structural claims (HASH_REWRITE_DIRS decorative, docsFiles wiring, applyLedger's bornAs guard, the citation-gate scanFiles list) all check out against the live repo, but the card's own motivating example is now stale and its Done-when item 4 / Size-basis (b) instruction — add agent-memory-src to HASH_SLUG_OUT_OF_SCOPE_DIRS while also widening HASH_REWRITE_DIRS to cover it — is internally contradictory and mutation-confirmed to fire false-positive WARNs on ordinary in-flight citations.

_Recorded through the declared `review-prep` operation._
