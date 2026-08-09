---
bornAs: xm5o1c3
kind: story
size: 5
parent: "2405"
status: open
dateOpened: "2026-08-08"
costTokens: "in:106 cw:235577 cr:8979804 out:34802"
costUsd: 7.72
costSessions: 1
relatedTo: ["2986", "2994", "2749", "2999", "3001"]
codifiedIn: docs/agent/platform-decisions.md#guard-unresolvable-reexecution-denies
scope: ["we:scripts/guard-bash.mjs", "we:scripts/__tests__/guard-bash.test.mjs"]
tags: [guard, security, shell, re-execution, fail-closed, governance]
---

# Command guard: deny unresolvable shell re-execution instead of enumerating positions

**Ruled 2026-08-08 (operator, R8): refuse what the guard cannot resolve.** Stop listing positions to recurse
into; deny at the primary checkout when a command contains shell re-execution the guard cannot fully resolve.
The guard holds an *unparseable means deny* doctrine for exactly **one** state — an unterminated quoted run,
which [`we:scripts/guard-bash.mjs`](../scripts/guard-bash.mjs) fails closed on through `unparseableReason`.
R8 extends that doctrine to nested execution, where the guard still fails **open** (the three cases below).
The same posture outside this guard: `we:scripts/lib/lane-verify.mjs` refuses a corrupt verification marker
rather than failing open.

Same instrument change as #2999 (R5, the codification shortcut): when a problem cannot be won by
enumeration, stop enumerating and change what the check asks.

## Why enumeration cannot finish

Six rounds have tried to list every way a command hands a hidden script to the shell. Each round's evidence
looked overwhelming; each next round found more holes. The sixth reviewer found the mechanism: **the fuzz
generator's wrapper list was literally the set of classes the previous fix had just implemented.** Three
million generated pairs could therefore only re-prove what was already handled. Enumeration cannot be
completed from inside the thing being enumerated.

Six positions remain unrecursed — `bash -o pipefail -c`, a pipe or here-string into a shell, `trap`,
process substitution, `find -exec`, and `nohup`/`exec`. Re-checked against `main` on 2026-08-08: each one
hides an `npm run build` that the guard allows at primary cwd, while the bare `npm run build` denies.

## The decisive detail: the caps fail OPEN

*(All three fail-opens are in the nested-command scanner #2986 / #2994 landed, and all three are on `main`.
Each is reproducible by importing the guard's pure `decide()` and calling it with `{ primaryCwd: true }` — do
that rather than trusting this paragraph.)*

Both recursion caps **fail open** — past depth 4 or 64 expansions the scanner stops and *allows*
(`NESTED_DEPTH_CAP` / `NESTED_NODE_CAP` in `we:scripts/guard-bash.mjs#NESTED_DEPTH_CAP`). Reproduced
2026-08-08: `npm run build` wrapped in four levels of `sh -c` denies, in five levels it is allowed; 80
sibling `sh -c "echo N"` segments ahead of a nested `npm run build` exhaust the expansion budget and it is
allowed. And there is a **third**: `withNestedCommands`
(`we:scripts/guard-bash.mjs#withNestedCommands`) states outright
that *"a nested string that does not parse is NOT escalated to the unparseable deny — its segments are
still handed to the arms"* — which is precisely the R8 case, the guard allowing text it could not read.
Reproduced the same way: `sh -c "echo 'oops"` is allowed at primary cwd, while the identical unterminated
quote at top level denies.
So even a complete enumeration is undone at the margin by machinery that permits. This is the real
argument for the ruling, and it is stronger
than the six missing positions: **deny-on-unresolvable makes all three fail closed by construction.** A
seventh round of enumeration leaves the fail-open behaviour intact.

## What ships

- In [`we:scripts/guard-bash.mjs`](../scripts/guard-bash.mjs), replace "recurse into the positions we know
  about" with "resolve the command fully, or deny at the primary cwd". Any construct containing shell
  re-execution the guard cannot fully resolve is denied rather than scanned-and-allowed.
- Both recursion caps become **deny** on exhaustion, not allow. Depth and node limits stay as resource
  bounds; hitting one is an unresolvable result, not a pass.
- **The third fail-open goes too:** nested text `withNestedCommands` cannot parse must escalate to the
  unparseable deny instead of having its segments handed to the arms. Converting only the two caps leaves the
  guard still allowing text it could not read — the exact case R8 rules on.
- **Do not regress what #2986 / #2994 landed:** the quote-aware splitter (it closed four confirmed holes),
  the runner work, the golden corpus under `we:scripts/golden-corpus/hook-guard-bash/`, and the thirteen
  false-deny fixes.

## What this ruling rejects, and why

- **A seventh round of enumeration.** The six positions and the fail-open caps are all named with small
  fixes. But the same reasoning justified rounds five and six, and the generator problem means the next
  round's evidence would again be built from the next round's list.
- **Keep only what is proven, drop the recursion.** Not a clean retreat: dropping it would have left the
  guard **worse than its pre-#2994 base** on `bash -c` and `eval`, which that base caught by accident
  through its sloppy quote-blind split.

## The honest cost — measure it, do not assume it

Some everyday shell-rc idioms will be denied at the primary cwd that are allowed today. **Re-run the
false-deny sweep to size this before landing — do not inherit a number.** The headroom this change spends
comes from the sweep #2986 / #2994 landed with (zero newly denied). That describes the tree *before*
the flip; it is the baseline to re-measure against, not evidence about the tree after it.

Known false-deny classes, each **re-checked against `main` on 2026-08-08** by calling `decide()` with
`{ primaryCwd: true }`:

- **A `>` inside a quoted string argument.** `node -e '…"<h3" + GT + ">"…'` was denied as a redirect with no
  redirect present. **Now clears** — the quote-aware split fixed it.
- **An fd-dup read as a write.** `node we:scripts/lane-pool.mjs status --json 2>&1 | …` was denied at primary
  cwd; `2>&1` duplicates a descriptor and writes no file. **Now clears.**
- **A JavaScript arrow in a quoted argument.** `node -e "…d => s += d…"` was denied as a redirect; the
  trigger is `=>`, not `>`. **Now clears** — the quote-aware split fixed it.
- **`sed -n` read as an in-place edit.** `sed -n '30,90p' backlog/<item>.md` is **still denied** by the
  backlog-append arm. `sed -n` prints; only `sed -i` edits. Open, and the one class of the four this sweep
  still has to carry.

The first three are the quote-blind class, and their clearing is what makes the deny-flip safe to ship: the
resolver the flip leans on no longer misreads them. The fourth is a separate arm and is unaffected by it.

### Sequencing: the deny-flip lands behind the quote-aware splitter, never in front of it

"Refuse what it cannot resolve" says nothing about **who decides it cannot be resolved**, and that — not how
often real re-execution happens — is what sets the cost. Making a **quote-blind** guard *more* eager to deny
amplifies exactly the false-deny problem #2986 / #2994 exist to fix. The splitter is not merely "kept" — it is
the **resolver this ruling depends on**, and the flip must ship with it or after it. That is the whole of the
sequencing argument, and it does not need a number.

**State the precondition as a capability, never as a pull request's status.** The condition is *"a
quote-aware splitter is on `main`"* — checkable by running the guard, and true or false about the tree rather
than about a review label that moves minute to minute. **It is satisfied:** #2986 / #2994 are resolved and
the splitter is on `main`, so the sequencing no longer holds this build back. Re-check it at build time the
same way (the assertion is in *Acceptance*); do not take this sentence's word for it either.

**Provenance of the sizing, stated honestly.** The cited
[command-surface report](../reports/2026-08-08-agent-command-surface-sizing.md) (#3001) sizes the corpus at
**64,752 `Bash` invocations across 4,485 transcripts** and puts shell re-entry at **74 quote-aware segments
(0.03%)**, ~**1.7% of calls** counting generously from raw text, and ~**120** genuinely unparseable forms
(<0.2%). Those are the only figures here with a source you can open.

An earlier revision of this item carried a quote-blind / quote-aware split of **1,093 / 596** (a 45%
over-flag) and a tree-write gap of **2,801**, footnoted to that report. **Those figures are withdrawn.** The
report does not contain them, no committed script recomputes them, and `596` / `2,801` appear nowhere in the
repository. An independent re-derivation (PR #1118 review, over 65,862 `Bash` calls in 4,473 transcripts) got
blind **1,011**, aware **625**, gap **386 = 38%**, and a tree-write gap of **4,697**; swapping token sets
brackets the over-flag ratio between **30% and 59%**. A third token set (PR #1118 round-2 review) landed at
**46.4%**, inside that bracket. Corpus scale and direction reproduce; the magnitude does not, because it is a
function of an undocumented token list. So the range is recorded **here, as unreplicated context** — it is
carried nowhere else, and above all **not in the statute**.

**The claim that survives, and the only one the ruling needs:** *a quote-blind re-entry scan over the session
corpus over-flags substantially — a large fraction of its own hits, somewhere in the 30–59% the token sets
bracket, is text that was never shell.* Direction, not magnitude. The exact cost is established by re-running
the false-deny sweep during this build **with the measuring script and its token list committed** (see
Acceptance), not by inheriting an estimate.

For the genuine-cost side, using the report's own numbers: genuinely unparseable forms are ~**120 calls in
64,752** (<0.2%). The arm fires at the **primary checkout only** and real edit work runs in lane clones, so
the everyday-idiom friction is real but small.

## Acceptance

- Every attack spelling in the existing corpus still denies; every false-deny class listed above that clears
  on `main` today still clears after the flip, and the one that does not (`sed -n`) is not made worse.
- Each of the six unrecursed positions denies at the primary cwd — not because it was enumerated, but
  because it is unresolvable.
- Exhausting either recursion cap **denies**. Add a test that drives depth past 4 and node count past 64
  and asserts denial.
- **Unparseable nested text denies.** A nested string `withNestedCommands` cannot parse escalates to the
  unparseable deny rather than being split into segments for the arms — the opposite of what
  `we:scripts/guard-bash.mjs#withNestedCommands` does by design. Add a test
  that asserts denial for nested text that does not parse.
- **The quote-aware splitter is in the same change or already landed.** The flip must not reach `main` on
  top of a quote-blind resolver — see *Sequencing* above. **This precondition is satisfied:** the
  quote-aware splitter is on `main` (#2986 / #2994, both resolved), so the criterion no longer blocks the
  build. It stays an acceptance criterion because it must be **re-asserted, not assumed**: a command whose
  only re-execution token sits inside a quoted string (`grep -n "bash -c 'npm run build'" we:scripts/guard-bash.mjs`)
  must still **clear**, and the paired unquoted control (`bash -c 'npm run build'`) must still **DENY** —
  before and after the flip, so the check has a negative half and cannot pass on a guard that denies nothing.
  Confirmed both against `main` on 2026-08-08.
- The false-deny sweep is re-run over the everyday-command corpus and the newly-denied set is reported, not
  merely counted. No size is asserted here: `145` was carried across from PR #1092's labelled-corpus score
  (`base 145/184`), which is a classification result and not a corpus count. The corpus the sweep runs over
  is whatever the committed script names — see the criterion below.
- **The measuring script is committed with its token list**, so every sizing figure this item or the statute
  quotes can be recomputed from the repo. **No unreproducible number returns to the statute**, and none is
  cited as authoritative here — the 30–59% bracket above is recorded as unreplicated context only. That is
  what withdrew the previous 1,093 / 596 / 45% / 2,801 set.
- Red-team by an adversary who did not write the change, using cases **not** derived from this item's list
  or from the fix's own implementation. This is the round-6 lesson and it is the acceptance criterion most
  likely to be skipped.

## Dependencies

**Nothing blocks this build.** The write hole it was once queued behind — a quoted pipe letting a redirect
through to the shared checkout — is closed: #2986 / #2994 landed the quote-aware splitter that closes it, and
the same change is the resolver this ruling depends on. What is left is the fail-closed flip itself, over the
three fail-opens named above.

Related: **#3020** already files the recursion-depth bound; reconcile with it rather than double-building.
