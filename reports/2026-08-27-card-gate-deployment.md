# Deploying the card-gate library — a measured sweep, and the two statutes that already govern it

**Date:** 2026-08-27 · **For:** [#3364](/backlog/3364/) (prep) · **Under:** the Review-efficacy watch (#3318)

[#3364](/backlog/3364/) records a fact: nothing outside the experiment imports
`we:scripts/review-corpus/gates.mjs`, so nine written gates guard no write, no card and no land. The card
says the remaining work is a decision, not a wiring task. This report is the research behind that decision —
a measured sweep of what each gate would say if it ran today, the per-write cost of the repo context each
one needs, and the ratified anchors that turn out to decide most of the question.

**Two corrections this report carries against its own first version**, both found by the skeptic pass and
verified before folding in. They are recorded rather than silently fixed because the subject of the report is
whether detectors of exactly this defect class should be deployed.

1. **The card's headline proof does not run as printed — but not for the reason first stated here either.**
   The `grep -rln` invocation it printed does find the gate module: run for real (bypassing this session's
   harness-level grep wrapper, which forces `-I` and was the actual source of the earlier zero-hit reading),
   it prints `we:scripts/review-corpus/gates.mjs` and **exits 0** — one hit, not zero, and not the two hits
   the card showed. §9's "plain grep skips it as binary" claim was also wrong and is corrected there: `grep
   -l` reports a filename match inside a binary file by default; only the explicit `-I` flag suppresses
   that. What was actually wrong with the printed proof is its **second** line — the harness does not
   contain the literal string at all, because it imports by a relative specifier. The real importer set is
   **three files, all inside the experiment**: `we:scripts/review-corpus/replay-gates.mjs:51`,
   `we:scripts/review-corpus/__tests__/gates.test.mjs:16`, and `we:scripts/review-corpus/stability.mjs:286`
   transitively. **The conclusion — no production caller — is unaffected and holds.**
2. **This report's first version claimed `#gate-rollout-ratchet` (#867) settles the severity question. It
   does not** — see §6, rewritten. A later anchor rules the other way for a `check:standards` gate, and the
   repo already ships the diff-scoped posture #867's baseline clause was read as forbidding.

---

## 1. What this report measured, and what it did not

Stated in #3362's form, so no completeness is implied.

**Scan.** Every git-tracked file matching `^(backlog|agent-memory-src|reports)/.*\.md$` in the lane clone at
`6b03a7bd` — **4046 files** (backlog 3339, agent-memory-src 252, reports 455). Each file was passed to every
entry of the frozen `GATES` registry (`we:scripts/review-corpus/gates.mjs:715`) through a working-tree
context: `read` = `readFileSync`, `list` = `git ls-files` filtered by prefix, `knownHashIds` = the same
filename + `bornAs` union the replay harness builds (`we:scripts/review-corpus/replay-gates.mjs:93`).

**Predicate.** A finding is one element of a gate's returned array. Nothing here adjudicates whether a
finding is *true*.

**Not measured.** Precision, for eight of the nine gates — the only adjudicated rate in existence is
#3341's, done by hand on its own card. Not measured: non-markdown files, the replay corpus, or any
revision other than `6b03a7bd`. A count below is a **fire rate on today's tree**, never a false-positive
rate, and the two are not interchangeable — see §3.

## 2. The sweep

| gate | `targets` | findings | ctx it needs | gate time over the corpus |
| --- | --- | ---: | --- | ---: |
| `resolved-with-todo` | backlog card | **5** | — (pure) | 10 ms |
| `stale-gate-count` | backlog card | **28** | — (pure) | 12 ms |
| `dangling-wikilink` | agent memory | **70** | `list` | 71 ms |
| `dangling-hash-id` | backlog card | **1** | `knownHashIds` | 124 ms |
| `grep-literal-mismatch` | backlog card | **5** | `read` | 289 ms |
| `vacuous-executable-criterion` | backlog card | **1** | `read` | 13 ms |
| `scope-omits-donewhen-file` | backlog card | **72** | — (pure) | 8 ms |
| `citation-line-content` | any prose | **577** | `read` | 381 ms |
| `uncited-mechanism-claim` | backlog card | **17** | `read` | 1292 ms |
| | | **776** | | 2.2 s |

Two independent confirmations that the harness is wired correctly: `uncited-mechanism-claim` returns
**17**, matching the 17-in-3336 sweep #3341 recorded by hand (the board is 3339 cards now); and
`vacuous-executable-criterion` returns nothing under its empty-selection predicate, matching #3340's zero.
Its single finding comes from the older absence predicate.

**Baseline for comparison.** `npm run check:standards` on this clone: **0 errors, 1451 warnings**
(81 blocks, 60 plugs, 42 protocols, 100 intents, 21 capabilities, 345 terms, 296 research topics,
3339 backlog items). Adding all nine gates as warnings would be **+776 on 1451 — a 53% increase**, and
`citation-line-content` alone is **+40%**.

## 3. The number the card's framing invites you to misread

#3341 measured **17 findings across 3336 cards** and adjudicated them **13 true · 1 arguable · 3 false**.
The 0.5% is the **fire rate on the board**. The **false-positive rate is 3/17 = 17.6%**, or 23.5% if the
arguable one is counted against it.

#3318 carries a stated false-positive contract — **under 10% effective-FP per category, probation at 10%,
auto-disable at 25%** — and this report's first version placed the gate in the probation band against it.
**That placement was withdrawn**, on three grounds the skeptic pass raised and I verified:

- **n = 17 does not support a band.** The 95% Wilson interval on 3/17 is roughly **[6.2%, 41.0%]** — it spans
  "clears 10%", "probation at 10%" and "auto-disable at 25%" together. #3318's own conformance front demands
  "four numbers, always together, **always with intervals**"; a bare point estimate in a band is what that
  discipline exists to prevent.
- **Different instrument.** #3318's **effective-FP** is a not-useful rate over *surfaced* findings with an
  action-rate denominator. 3/17 is a raw adjudicated-incorrect count. They are not the same measure.
- **Not a statute.** #3318 is an **open epic**, not an anchor in the statute doc, and its own goal-set row 8
  marks that contract **"blocked — no ledger"** — it has no instrument. Its numbers ship with the epic's own
  caveat: 10% is a product decision Google's footnote calls *"somewhat arbitrary"*, against Coverity's
  published 20% target and measured developer tolerance near 15%. At 17.6% the gate sits **inside** both
  external reference points and outside only WE's un-instrumented one.

What survives: 0.5% is a fire rate, not a false-positive rate, and the gate's precision is **not yet
established either way**. The honest deployment consequence is warn, and re-adjudication at a larger n.

## 4. Per-write cost of the repo context

Measured in this clone:

- `knownHashIds()` — **116 ms**, one `git grep` over 3339 backlog files, yielding 939 ids.
- `git ls-files` (whole tree) — **11 ms**, 7410 paths.
- Everything else is `readFileSync` plus regex. The slowest gate, `uncited-mechanism-claim`, spends
  **1292 ms over 3339 cards ≈ 0.39 ms per card**.

So the card's worry — "a hook that shells out to git on every write is a real cost" — resolves to exactly
**one** gate. `dangling-hash-id` is the only entry whose context is repo-wide git work; the other eight are
sub-millisecond per file. This is a per-gate property, and it is derivable, not a judgment call.

**A correction the card owes itself.** #3364 states that `vacuousExecutableCriterion` "must *run* a command
to know it is vacuous, which is not a write-time operation." It does not. Shape 1
(`we:scripts/review-corpus/gates.mjs:317-332`) calls `read(rel)` and tests `body.includes(needle)`; shape 2
(`we:scripts/review-corpus/gates.mjs:335-345`) is a regex over the criterion text (`NAME_FILTERED_RUN_RX`,
`we:scripts/review-corpus/gates.mjs:267`). No subprocess is spawned anywhere in the module. The gate is
write-time feasible. This is precisely the uncited-mechanism-claim defect #3341's gate exists to catch, in
the card proposing to deploy it.

## 5. The call site is not a choice — the repo already proved the branches compose

`we:scripts/lint-locus-prefix.mjs` runs **one pure detector** (`scanRepoLocusPrefixes`) from **five**
facades: `--pre` (a `PreToolUse(Edit|Write)` deny, registered in `we:.claude/settings.json`), a single-file
`PostToolUse` backstop registered in the same file, `--staged`, `--all`, and `--range=<gitrange>` — the
producer sweep pr-land runs before opening a PR (`we:scripts/pr-land.mjs:708`). The gate library already has
the same kernel: `runGates(text, ctx)` at `we:scripts/review-corpus/gates.mjs:728`.

So "write-time **or** `check:standards` **or** prepare close-out" fails the composability probe — they are
facades over one kernel and coexist, exactly as #756 found. The card's own list omits a fourth facade,
`--range=`. It also assumes `check:standards` must scan whole-corpus, which §6b shows is false: that gate
already resolves an `origin/main` merge-base internally and reports only added lines, so the changed-set
input path into the authoritative gate exists and is in production.

## 6. The statutes — and the one this report first got wrong

### 6a. Withdrawn: "#867 settles it, and its baseline clause rejects new-code-only scoping"

This report's first version argued that `#gate-rollout-ratchet` (#867, ratified 2026-07-09) settles the
severity question — warn-only is a stage you exit, a target enters the enforced set the moment it measures
green — and that #867's by-name rejection of a *violation-level baseline snapshot* ("churn-sensitive, and
snapshotted debt rots with no drain forcing-function") reaches new-code-only gating "verbatim".

**Three errors, all verified:**

1. **#867's scope is a drainable derived route set** — re-rendered a11y routes, with a `WARN_ROUTES` opt-out.
   An append-only card archive is not that shape, and the mapping "a gate is one target, measures-green is
   zero standing findings" was mine, not the anchor's.
2. **A merge-base diff scope stores no snapshot.** #867 rejected a *stored baseline* that rots because
   nothing drains it. A scope recomputed from `git merge-base` on every run has nothing to rot. The rejected
   mechanism and new-code-only scoping are different things, and conflating them is what made the citation
   look decisive.
3. **A later anchor rules the other way for this exact kind of gate.** `#small-file-preference` (#2678,
   ratified 2026-07-28 — 19 days after #867) makes soft-warn **permanent** for a `check:standards` rule:
   "warns (never errors, never denies the write)", with an inline escape-hatch comment, and hard-deny
   explicitly rejected as "a footgun on high-churn files". Add `#blast-radius-advisory-care-not-a-gate`
   (#2563 clause 1): where a repo tightens a signal to a gate, "`gate` means route-to-a-human, **never
   hard-block-with-no-reviewer**".

Related correction: this report called the citation-gate warn flag at `we:scripts/check-standards.mjs:1174`
an instance of #867 non-compliance. The sibling comment at `we:scripts/check-standards.mjs:1265` records that
posture as *ruled* — the "don't red the gate on a corpus nobody is touching" reason — so it is a decision,
not a rot.

### 6b. The precedent that actually decides corpus scope, already shipped over this material

`we:scripts/check-standards.mjs:1249-1270` — the #3026 provenance gate — runs **diff-scoped against the
`origin/main` merge-base, reporting only tokens on lines a change ADDED.** Its header gives the reason in
numbers: "corpus-wide this fires 1,808 times on overwhelmingly correct prose." It then **narrowed its own
scope to exclude `backlog/` on measurement** — the filed scope produced "503 findings on 22 merges", the
shipped scope "0 on 0" — and it runs at **WARN**, for three stated reasons including that an unresolvable
token "is a strong smell, not a proof", and "a gate that blocks every PR on a smell is worse than no gate".

That is the corner this report's first version never offered: **diff-scoped + warn + an escape hatch**,
already built, already measured, over this exact corpus. It settles scope without a ruling.

### 6c. The collision that is left, and is a real decision

`#claim-accuracy-advisory-blocks-on-impact` (#3314) was ratified **2026-08-26 — one day before #3364 was
filed, under #3364's own parent epic #3318.** It governs findings over "card bodies, Done-when criteria,
docs, agent-memory notes, code comments, PR descriptions" — **the population all nine gates target.** It
holds that such a population is "dominated by low-impact prose *by construction*"; that "the argument does
**not** depend on the lens's measured hit rate, and would not change if the lens got better: the objection is
structural"; and it closes: *"any future rule of this shape must name a typed field or take plain advisory
instead."*

Its typed field exists. The finding property is `impactIfUnfixed`, declared at
`we:scripts/lib/jury-core.mjs:57`. Its enum lives at `we:scripts/lib/jury-core.mjs:197`, held total by a
`check:standards` gate. A gloss table in the same module defines each level: the lowest is "nothing breaks; a
later reader might be mildly misled", and the level the fork turns on is "real work is lost, duplicated, or
silently skipped".

**And on the reach question the anchor answers itself — it does not reach.** Three findings, each verified:

- **Its subject is a lens's mandate inside the AI jury**, and its own scope note says so: *"The blocking set
  is an explicit one-member set, not `ADVISORY_LENSES`"*, with generalization deferred to `#3338`.
- **It presupposes deterministic gates as a separate thing.** Arguing its bar may not be built on
  `blocksAcceptance`, it names *"the already-existing `check:standards` locus gate"* as a **prevention** that
  a lens finding is measured against.
- **A card *validator* already blocks — not a card *gate* in this library's sense.**
  `we:scripts/check-standards.mjs:586` routes `validateBacklogItem`'s findings to `err`, which is
  deterministic structural validation, not the heuristic content detection `we:review-corpus/gates.mjs`
  performs. It shows a deterministic error on a backlog card is the status quo #3314 was ratified alongside;
  it is not evidence that a heuristic gate erroring is an accepted posture, which is what #3364's Fork 1
  rules on.

So the collision dissolves. What #3314 leaves behind is a **discipline worth adopting anyway** — its
forward-facing clause, *"any future rule of this shape must name a typed field or take plain advisory
instead"* — which the card adopts by declaring `impact` on each registry entry.

**What is genuinely left, and is #3364's one fork:** a card gate that ERRORs blocks a land with **no
reviewer**, and the repo has no rule for when a heuristic earns that. Impact says which gates are candidates;
precision says when a candidate crosses. Whether both must hold, or impact alone suffices, is the ruling —
and today it is the difference between four gates blocking immediately and none blocking until measured.

**`#gate-on-merged-tree-lane-fast-fail` (#1937) is cited for nothing.** It governs *location* — lane clone
versus central merged tree — not corpus scope, so it neither authorizes nor forbids anything here. This
report said so in its first version and the card then cited it as support anyway; both are corrected.

**Recorded because it is evidence, not decoration.** The gate library was run against this report and
against #3364's own body after every draft. It fired **three times**, always `citation-line-content`:

1. **True.** A draft of §6a cited one warn-flag's line while naming a *different* flag in the same sentence.
2. **True.** The paragraph above cited the enum's line while naming the finding property declared 140 lines
   earlier. Both were split into separate citations.
3. **Arguable — a limitation worth recording.** It fired on a `path:211-213` *range* citation whose named
   levels sit at either end of the range. The gate parses only the first number and looks ±4 lines from it,
   so a range citation is a form it does not model. Avoided by citing a single line.

Against that, the library was **silent on the invented `grep` proof** corrected at the top of this report — a
`grep-literal-mismatch`-class defect it cannot reach, because that gate iterates Done-when criteria only and
the false command sat in a card body.

**Running tally on a two-file sample: 2 true, 1 arguable, 1 miss.** Tiny, and stated as such. But it is the
only end-to-end evidence anyone has of these gates operating on live prose rather than on a replay, and it
points the same way as the recommendation: useful enough to run, not precise enough to block.

## 6d. The standing count is yield evidence, not only drain cost

A low standing count reads two ways, and the first version of this report read only one. It is a cheap
**drain**, and it is equally the best available estimate of how often the gate **ever catches anything**
across 3339 cards of history. `dangling-hash-id` (1), `vacuous-executable-criterion` (1),
`resolved-with-todo` (5) and `grep-literal-mismatch` (5) are **12 findings between them across the entire
board**. Any deployment order keyed on drain cost is therefore keyed on the inverse of evidence. The card's
band table was re-keyed on **impact** for this reason.

## 7. What the declared bar would do if applied

`we:scripts/review-corpus/gates.mjs:12-15` declares, before the experiment: *"a gate ships only if it
catches >=80% of its own labelled class in the corpus AND fires zero times where no reviewer found
anything."*

The harness's own docblock contradicts the second term.
`we:scripts/review-corpus/replay-gates.mjs:16-19` defines EXTRA as "NOT a false-positive count … either a
false positive or a real defect nobody looked for. It is reported as a number to ADJUDICATE, never as a
number to divide by."

The measured case settles it. #3341 replayed at **0 labels caught, 6 extras**, and all **6 extras were
adjudicated real**. Under the declared bar it fails twice — once on a catch rate that is **0/0**, because
none of the 39 confirmed labels is an instance of a class named after every mined case was recorded, and
once on extras that were correct behaviour. A bar that rejects a gate for finding six real defects is not a
bar; and 0/0 is undefined, not failed.

## 8. Known occurrences — the shape is not novel, and two of them are distinct mechanisms

Kept apart deliberately, because collapsing them is what produced §6a's error.

- **New-code-only gating** — SonarQube's "Clean as You Code": the quality gate is evaluated against the
  changed set, recomputed each run, with **nothing stored**. This is what `we:scripts/check-standards.mjs:1249-1270`
  already implements here.
- **Suppression baselines** — detekt/PMD baseline files, `# noqa`, `eslint-disable`: a **stored** list of
  grandfathered violations. This, and only this, is the mechanism #867 rejected by name.
- **Coverity's release-over-release churn cap**, already cited by this repo at
  `we:scripts/review-corpus/stability.mjs:372`.
- **`--max-warnings` ratchets** — ESLint's ratchet-to-zero, and TypeScript's per-file `strict` opt-in:
  warn-only entry with a declared exit, which is #867's shape and applies where a target set is drainable.

## 9. An incidental defect, recorded not fixed

`we:scripts/review-corpus/gates.mjs` contains **one literal NUL byte at offset 27761**, inside the masking
expression in `sentencesWithLines`. **Corrected again: plain `grep -l` does not skip the file as binary.**
This report's prior draft claimed it does; that was verified against a harness-level grep wrapper (this
session's tool sandbox forces `-I`, ignore-binary) rather than against real `grep`, whose default
`--binary-files=binary` reports a filename match without displaying the matched line — only the explicit
`-I` flag skips it, and the command as printed in #3364 does not pass one. Run directly, `grep -rln
"we:review-corpus/gates.mjs" scripts/` prints `we:scripts/review-corpus/gates.mjs` and exits 0. **`git grep`
is unaffected and lists the file correctly too**, so both tools agree the module is found; #3364's headline
proof was wrong only in printing a second, non-existent hit for the harness file. #3357's concern about a
plain-`grep` audit of this registry therefore does not apply to this file specifically — a real `grep -l`
does surface it. Not fixed here — the file is held by a sibling lane. Replacing the NUL byte with a printable
sentinel would still be worth doing, since a NUL byte is unusual in a source file regardless of how `grep`
handles it.

---

## Method notes

The sweep and the cost probe were throwaway scripts in a scratch directory, not repo code — #3364's prep is
explicitly not a build. Both are reproducible from §1's description in a few lines: import `GATES`, supply a
working-tree context, and count. Every count in this report was produced in one run against `6b03a7bd`;
none is carried over from another card.
