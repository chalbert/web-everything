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
The guard does **not** hold an *unparseable means deny* doctrine today — [`we:scripts/guard-bash.mjs`](../scripts/guard-bash.mjs)
states the opposite ("Fails open on unparseable input"). R8 introduces that doctrine for nested execution;
the nearest existing precedent is a different guard (`we:scripts/lib/lane-verify.mjs` refuses a corrupt
verification marker rather than failing open).

Same instrument change as #2999 (R5, the codification shortcut): when a problem cannot be won by
enumeration, stop enumerating and change what the check asks.

## Why enumeration cannot finish

Six rounds have tried to list every way a command hands a hidden script to the shell. Each round's evidence
looked overwhelming; each next round found more holes. The sixth reviewer found the mechanism: **the fuzz
generator's wrapper list was literally the set of classes the previous fix had just implemented.** Three
million generated pairs could therefore only re-prove what was already handled. Enumeration cannot be
completed from inside the thing being enumerated.

Six positions remain unrecursed — `bash -o pipefail -c`, a pipe or here-string into a shell, `trap`,
process substitution, `find -exec`, and `nohup`/`exec`.

## The decisive detail: the caps fail OPEN

*(All three fail-opens below are in the nested-command scanner that PR #1092 adds — none is on `main`, whose
guard does no re-entry recursion at all. They describe the tree this build lands on top of.)*

Both recursion caps **fail open** — past depth 4 or 64 nodes the scanner stops and *allows*
(`NESTED_DEPTH_CAP` / `NESTED_NODE_CAP`, `we:scripts/guard-bash.mjs#NESTED_DEPTH_CAP` on PR #1092's
`lane/guard-false-denies`). And there is a **third**: `withNestedCommands`
(`we:scripts/guard-bash.mjs#withNestedCommands` on PR #1092's `lane/guard-false-denies`) states outright
that *"a nested string that does not parse is NOT escalated to the unparseable deny — its segments are
still handed to the arms"* — which is precisely the R8 case, the guard allowing text it could not read.
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
- Keep everything PR #1092 already proved: the splitter (it closes four confirmed holes base has), the runner
  work, the golden corpus under `we:scripts/golden-corpus/hook-guard-bash/`, and the thirteen false-deny
  fixes.

## What this ruling rejects, and why

- **A seventh round of enumeration.** The six positions and the fail-open caps are all named with small
  fixes. But the same reasoning justified rounds five and six, and the generator problem means the next
  round's evidence would again be built from the next round's list.
- **Keep only what is proven, drop the recursion.** Not a clean retreat: it leaves head **worse than base**
  on `bash -c` and `eval`, because base catches those by accident through its sloppy quote-blind split.

## The honest cost — measure it, do not assume it

Some everyday shell-rc idioms will be denied at the primary cwd that are allowed today. **Re-run the
false-deny sweep to size this before landing.** Precision is currently not the problem — 145 everyday
commands swept with zero newly denied, 9/9 prior holes closed, 13/13 intended fixes hold, 33/33 attack
spellings deny — and this change deliberately spends some of that headroom.

Known false-deny classes to fold into the sweep, beyond the four already filed in #2986/#2994:

- **A `>` inside a quoted string argument.** Observed 2026-08-08: `node -e '…"<h3" + GT + ">"…'` was denied
  as a redirect at the primary cwd with no redirect present. Same quote-blind class #2994 covers; recorded
  here as a fifth instance so the sweep includes it.
- **An fd-dup read as a write.** Observed 2026-08-08: `node we:scripts/lane-pool.mjs status --json 2>&1 | …`
  denied at primary cwd. `2>&1` duplicates a descriptor and writes no file.
- **A JavaScript arrow in a quoted argument.** Observed 2026-08-08: `node -e "…d => s += d…"` denied as a
  redirect. Sixth instance of the quote-blind class; recorded because the trigger is `=>`, not `>`.
- **`sed -n` read as an in-place edit.** Observed 2026-08-08: `sed -n '30,90p' backlog/<item>.md` denied by
  the backlog-append arm. `sed -n` prints; only `sed -i` edits.

### Sequencing: the deny-flip lands behind the quote-aware splitter, never in front of it

"Refuse what it cannot resolve" says nothing about **who decides it cannot be resolved**, and that — not how
often real re-execution happens — is what sets the cost. Making a **quote-blind** guard *more* eager to deny
amplifies exactly the false-deny problem #2986 / #2994 exist to fix. The splitter is not merely "kept" — it is
the **resolver this ruling depends on**, and the flip must ship with it or after it. That is the whole of the
sequencing argument, and it does not need a number.

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
brackets the over-flag ratio between **30% and 59%**. Corpus scale and direction reproduce — the magnitude is
a function of an undocumented token list, so it is not carried anywhere and is **not** in the statute.

**The claim that survives, and the only one the ruling needs:** *a quote-blind re-entry scan over the session
corpus over-flags substantially — on the order of a third to a half of its own hits are text that was never
shell.* Direction, not magnitude. The exact cost is established by re-running the false-deny sweep during this
build **with the measuring script and its token list committed** (see Acceptance), not by inheriting an
estimate.

For the genuine-cost side, using the report's own numbers: genuinely unparseable forms are ~**120 calls in
64,752** (<0.2%). The arm fires at the **primary checkout only** and real edit work runs in lane clones, so
the everyday-idiom friction is real but small.

## Acceptance

- Every attack spelling in the existing corpus still denies; the four (now five) known false denies still
  clear.
- Each of the six unrecursed positions denies at the primary cwd — not because it was enumerated, but
  because it is unresolvable.
- Exhausting either recursion cap **denies**. Add a test that drives depth past 4 and node count past 64
  and asserts denial.
- **Unparseable nested text denies.** A nested string `withNestedCommands` cannot parse escalates to the
  unparseable deny rather than being split into segments for the arms — today it does the opposite by design
  (`we:scripts/guard-bash.mjs#withNestedCommands` on PR #1092's `lane/guard-false-denies`). Add a test
  that asserts denial for nested text that does not parse.
- **The quote-aware splitter is in the same change or already landed.** The flip must not reach `main` on
  top of a quote-blind resolver — see *Sequencing* above. The splitter ships in **PR #1092**, which is open
  and not yet on `main`, so this criterion is currently **unmet**. Assert it directly: a command whose only
  re-execution token sits inside a quoted string (`node -e "… d => s += d …"`) must still **clear**.
- The false-deny sweep is re-run over the 145-command corpus and the newly-denied set is reported, not
  merely counted.
- **The measuring script is committed with its token list**, so every sizing figure this item or the statute
  quotes can be recomputed from the repo. No unreproducible number goes back into either — that is what
  withdrew the previous 1,093 / 596 / 45% / 2,801 set.
- Red-team by an adversary who did not write the change, using cases **not** derived from this item's list
  or from the fix's own implementation. This is the round-6 lesson and it is the acceptance criterion most
  likely to be skipped.

## Unblocks

PR #1092 (`review:changes`, back with the author lane). Base currently keeps a confirmed write hole where a
quoted pipe lets a redirect through to the shared checkout, so landing this closes a live defect rather
than only hardening a hypothetical.

Related: **#3020** already files the recursion-depth bound; reconcile with it rather than double-building.
