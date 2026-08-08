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

**Ruled 2026-08-08 (operator, R8): refuse what the guard cannot resolve.** Apply the guard's own ratified
doctrine — *unparseable means deny* — to nested execution. Stop listing positions to recurse into; deny at
the primary checkout when a command contains shell re-execution the guard cannot fully resolve.

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

## The decisive detail: the caps already fail OPEN

Both recursion caps **fail open** — past depth 4 or 64 nodes the scanner stops and *allows*. So even a
complete enumeration is undone at the margin by a cap that permits. This is the real argument for the
ruling, and it is stronger than the six missing positions: **deny-on-unresolvable makes those caps
fail closed by construction.** A seventh round of enumeration leaves the fail-open behaviour intact.

## What ships

- In [`we:scripts/guard-bash.mjs`](../scripts/guard-bash.mjs), replace "recurse into the positions we know
  about" with "resolve the command fully, or deny at the primary cwd". Any construct containing shell
  re-execution the guard cannot fully resolve is denied rather than scanned-and-allowed.
- Both recursion caps become **deny** on exhaustion, not allow. Depth and node limits stay as resource
  bounds; hitting one is an unresolvable result, not a pass.
- Keep everything #1092 already proved: the splitter (it closes four confirmed holes base has), the runner
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
often real re-execution happens — is what sets the cost. Measured over 64,752 `Bash` invocations from 4,485
sessions ([report](../reports/2026-08-08-agent-command-surface-sizing.md), #3001):

| Scan for shell re-entry | Calls flagged | Share |
| --- | ---: | ---: |
| Quote-blind (the guard today) | 1,093 | 1.69% |
| Quote-aware | 596 | 0.92% |
| **Over-flagged by quote-blindness** | **497** | **45% of its own hits** |

On the tree-write arm the same gap is 2,801 calls. So making a **quote-blind** guard *more* eager to deny
amplifies exactly the false-deny problem #2986 / #2994 exist to fix. The splitter is not merely "kept" — it
is the **resolver this ruling depends on**, and the flip must ship with it or after it. (The 45% figure is an
upper bound: the measuring splitter handles heredoc bodies imperfectly. Directionally solid, magnitude soft —
which is why the sweep is re-run rather than this number reused.)

For the genuine-cost side: real shell re-entry is **596 calls of 64,752 (0.92%)**, and the genuinely
unparseable forms are ~120 (0.18%). The arm fires at the **primary checkout only** and real edit work runs in
lane clones, so the everyday-idiom friction is real but small.

## Acceptance

- Every attack spelling in the existing corpus still denies; the four (now five) known false denies still
  clear.
- Each of the six unrecursed positions denies at the primary cwd — not because it was enumerated, but
  because it is unresolvable.
- Exhausting either recursion cap **denies**. Add a test that drives depth past 4 and node count past 64
  and asserts denial.
- **The quote-aware splitter is in the same change or already landed.** The flip must not reach `main` on
  top of a quote-blind resolver — see *Sequencing* above. Assert it directly: a command whose only
  re-execution token sits inside a quoted string (`node -e "… d => s += d …"`) must still **clear**.
- The false-deny sweep is re-run over the 145-command corpus and the newly-denied set is reported, not
  merely counted.
- Red-team by an adversary who did not write the change, using cases **not** derived from this item's list
  or from the fix's own implementation. This is the round-6 lesson and it is the acceptance criterion most
  likely to be skipped.

## Unblocks

PR #1092 (`review:changes`, back with the author lane). Base currently keeps a confirmed write hole where a
quoted pipe lets a redirect through to the shared checkout, so landing this closes a live defect rather
than only hardening a hypothetical.

Related: `3020` already files the recursion-depth bound; reconcile with it rather than double-building.
