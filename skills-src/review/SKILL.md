---
name: review
description: Review a parked pull request and record the human verdict — pull the PR's diff + the drain's escalation reasons, run the shared review core (findings + verdict), present them, and on your OK swap the review label (review:human/review:pending → review:accepted, or review:changes to bounce the fix back to the author lane). Use when the user asks to "review PR #N", "clear the parked PR", "look at the review:human PR", or give a human verdict on a drain-parked PR. NOT for reviewing your own working diff (that is /code-review) and NOT for opening a PR (that is /pr).
---

# Review a parked PR — the human verdict (#2326)

The drain (`/drain`) **parks** a blast-radius or gate-self PR with a `review:*` label and waits for an
independent verdict before it may land (#2171/#2262/#2285). Two classes reach a human:
- **`review:pending`** — agent-reviewable but not yet cleared (or the drain's auto-review bounced it here);
- **`review:human`** — a **gate-self** edit (the diff touches the auto-review trust chain,
  `we:scripts/lib/review-escalation.mjs` / `we:scripts/merge-ai-prs.mjs`), which an agent may **never**
  self-clear (conflict of interest). Two shapes reach you here, and `deriveReviewDisposition` (#2285) tells them
  apart — read the drain's comment to see which:
  - a **sensitivity** park (`gate-self`, `{ mode: converge, autoLand: false }`) — the drain **ran the panel↔editor
    convergence and may have pushed an advisory FIX** to the PR branch, then posted an `🤖 advisory AI review /
    fix (non-clearing)` comment. The diff you review may already carry agent-authored trust-chain edits — scrutinize
    them, don't rubber-stamp.
  - a **deadlock** park (`non-convergence` / `mandate-conflict`, `{ mode: human }`) — the loop ran and could not
    agree, so no fix was pushed; the comment is the round history + verdict table. You break the tie.
  Either way only a **human** clears it.

`/review <PR>` is the one review flow with no skill until now (before, a human did it by hand — e.g. PR #206).
It renders through the **same engine** as the drain's auto-review and `/code-review`: the judge-only core in
**[scripts/lib/review-core.mjs](../../../scripts/lib/review-core.mjs)** (#2325). The core **judges**; you
**decide what the verdict does** (the `decideReviewGate` policy stays in the drain — *review-core.mjs* never
applies a label). The same module also renders the operator-facing notice for your clearance (`renderReviewNotice`,
#2433) — see step 6 below.

## Flow

1. **Pull the PR — on the NET basis vs CURRENT main, never `gh pr diff` alone (#2901).** Metadata first, so you
   have the head ref:
   ```
   gh pr view <PR> --repo <repo> --json headRefName,title,body,files,labels,comments
   ```
   Then take the diff from **`computeNetDiffText({ exec, rev: <headRefName>, fetchExtraRefs: [<headRefName>] })`**
   ([we:scripts/merge-ai-prs.mjs](../../../scripts/merge-ai-prs.mjs), #2450) — the two-tree
   `git diff <forkpoint> <head>` resolved off the SAME #2373/#2404 basis the drain's escalation SCORE uses, so
   what you review and what was scored cannot drift. Take the net changed-file list from
   **`computeNetDiffPaths(...)`** (same module, same basis) and carry it into step 2 — **not**
   `computeNetDiffChangedFiles`, which is the SCORING path and returns git's DISPLAY encoding (a rename renders
   as `a.txt => b.txt`, a non-ASCII path is C-quoted). Intersecting that with `gh`'s plain paths silently drops
   those entries, so a rename-only PR yields a ZERO-file list that reads as authoritative — and the list feeds
   `buildPanelMandate({ netChangedFiles })` as GROUND TRUTH, so a juror is told a real file is outside the net
   set.

   **`exec` is not a shell-exec — spell its shape exactly, or the call throws inside a swallowed `try` and looks
   like a degrade (#2952):**
   ```js
   const { execFileSync } = require('node:child_process'); // or `import` in an .mjs
   const exec = (cmd, args, opts) => execFileSync(cmd, args, opts);
   ```
   `resolveNetDiffBasis` (inside `computeNetDiffText` / `computeNetDiffPaths` / `computeNetDiffChangedFiles`)
   calls it as **`exec('git', ['diff', ...], { encoding: 'utf8', ... })`** — three positional args, `execFileSync`
   shaped. The natural-looking but WRONG shape is a shell-exec, `(cmd, opts) => execSync(cmd, opts)`: called
   3-arg, it receives the **args array** in its `opts` position and throws. Reproduced live in the review of WE PR
   #1063 (2026-08-06): the wrong shape byte-for-byte matched a foreign clone with no head ref —
   `{"paths": [], "base": null, "rev": null, "scored": false}` either way — until the `reason` field below made
   them distinguishable.

   This is **not** `gh pr diff <PR>`'s three-dot merge-base diff. That one still lists a sibling-lane file that
   has since landed on `main` as if this PR added it, and the phantom scope-creep is not harmless framing — it
   hides the findings that matter. Observed on PR #1009: `gh pr diff` presented 4 files / 42 lines where the net
   diff was 2 files / 2 lines, and the one real conflict only became visible on the net basis. Observed again on
   PR #1012, where `gh pr diff` reported three files the PR does not touch.

   The #2336 no-checkout constraint is intact: `computeNetDiffText` fetches tracking refs and diffs two trees in
   place — it never moves HEAD in this shared checkout. If it returns **`scored:false`**, check `reason` (#2952)
   before falling back:
   - **`reason: 'exec-contract'`** — the `exec` you passed in is not `(cmd, args, opts) =>
     execFileSync(cmd, args, opts)`-shaped. This is **a bug in YOUR wrapper to fix**, not license to fall back —
     fix the shape above and re-run step 1. Falling back here silently ships `gh pr diff`'s inflated three-dot
     list, the exact false positive #2450/#2901 exist to prevent.
   - **`reason: 'ref-unresolved'`** — neither `<remote>/<headRefName>` nor the bare ref resolved (a genuinely
     foreign/sibling clone). Unfixable from here — fall back to `gh pr diff <PR> --repo <repo>`, and **say so in
     your write-up**: the basis is degraded and the reader must know the file list may be inflated.
   - **`reason: 'diff-failed'`** — the basis resolved but the diff call itself then failed (rare; treat like
     `ref-unresolved` and fall back, but worth a note in your write-up since it is less expected).

   The escalation reasons ride the PR body's escalation block (and the `parked` entry in the drain's `--json`).
   Read the `🤖 advisory AI review (non-clearing)` comment if the drain already posted one.

2. **Run the shared core.** Seed a **fresh-context** review subagent (the `Agent` tool, e.g. `general-purpose`)
   with `buildMandate()` from `review-core.mjs` — it sees **ONLY the diff + PR description**, and per the mandate
   **never checks out the PR branch** in a shared tree (#2336; any test/repro runs in a throwaway clone). Running
   a multi-lens panel instead of one reviewer? Seed each with `buildPanelMandate({ lens, netChangedFiles })` and
   pass step 1's net changed-file list — it rides as GROUND TRUTH so a reviewer will not flag a diff-side file
   outside that set as scope creep (#2450). Shape each answer with `normalizeFindings()` and reduce it to a
   verdict with `deriveVerdict({ findings, humanRequired })`
   (`humanRequired: true` for a `review:human` PR → the verdict is always `needs-human`, never agent-clearable).

3. **Present** the findings + the escalation reason + the core's verdict to the operator. This is a **stop
   point** — the human reads and decides. Do not auto-proceed.

4. **Record the verdict** on the operator's OK (never inferred, always an explicit label — #2281) — **always
   through `we:scripts/review-set-label.mjs`, never a hand-rolled `gh pr edit`.** That module is the SINGLE HOME
   of the review-label swap (#2644): it posts the durable comment, stamps the `reviewed-sha` marker, and applies
   the label. The two writes are not atomic, so #2964 orders them so the half that can survive a blip alone is
   the harmless one — on an unaccepted PR the comment goes first (an orphan marker is never read), on an
   already-accepted one the swap does. **A non-zero exit means re-run the same command**; it is safe.
   Write your findings write-up to a file first, then:

   ```
   node scripts/review-set-label.mjs <PR> --repo=<owner/name> --to=accepted --actor="<operator>" --body-file=<findings.md>
   node scripts/review-set-label.mjs <PR> --repo=<owner/name> --to=changes  --actor="<operator>" --body-file=<findings.md>
   ```

   - **accept** — adds `review:accepted`, drops `review:pending`. Then `/drain` (a bare pass) lands it.
   - **changes** — adds `review:changes`, drops `review:pending` and any stale `review:accepted`, and routes the
     fix back to the **author lane** (the drain does no editing here — that convergence loop is v2, epic #2285).
   - The CLI **refuses** an `accepted` verdict on a `review:human` PR and changes nothing (INVARIANT 2). That
     refusal is the gate-self protection, and it only binds callers that come through this module — which is
     exactly why the swap must not be hand-rolled.

   **Clearing a `review:human` PR — `--to=clear-human` (#2895).** There IS a tool now; it is the fourth target,
   and the ONLY thing that removes `review:human`. Same invocation shape as the two lines above — one form for
   this tool everywhere, so `JSON.parse(stdout)` always works:

   ```
   node scripts/review-set-label.mjs <PR> --repo=<owner/name> --to=clear-human --actor="<operator>" --reason="<quoted instruction>" --body-file=<findings.md>
   ```

   (`npm run --silent review:clear -- <PR> --repo=<owner/name> …` is an equivalent alias: it supplies only
   `--to=clear-human`, so the target cannot be typo'd, and it deliberately bakes in NO repo — the first `--repo=`
   on the line wins, so a hardcoded one would silently override yours and clear a PR in the wrong repo. The
   `--silent` is **not** optional: without it `npm run` prints its two banner lines to *stdout* ahead of the
   payload, and `JSON.parse(stdout)` then throws on a clearance that in fact landed. Prefer the direct `node`
   line above — it is what every other caller in this repo uses.)

   **Nothing in the tool checks who ran it.** #2895 ruled the unforgeable actor signal DEFERRED — no local
   construct survives an agent with shell access on this machine, so a flag, a token, or a terminal check are
   all things you could satisfy. Do not go looking; there is nothing there. What binds you is this rule:

   > **You may run `clear-human` ONLY on an explicit in-conversation instruction from the operator naming that
   > PR, and you must pass that instruction verbatim as `--reason`.** No instruction, or an instruction about a
   > different PR: prepare the findings file, hand the operator the command line above, and stop. Clearing your
   > own review unbidden is the thing the whole gate exists to prevent, and doing it now takes a fabricated
   > quote — which is a lie, not an oversight.

   `--actor` and `--reason` are both mandatory; the tool refuses without either. Both land verbatim in the
   durable comment, which states in as many words what the record proves — that the sanctioned path was
   followed — and what it does NOT prove: that a human followed it. Do not describe it as proof of a human
   anywhere. Do not route around the tool with a raw `gh pr edit` either (`check:standards` errors when this
   file spells that): the tool carries the `review:accepted` label, the `reviewed-sha` stamp, and the attributed
   comment that the raw command loses. The durable fix for the missing signal is #2946 (a hardware
   human-presence gesture), filed `someday`; #2945 is the out-of-session console.

   **Why not a raw label edit.** Two things ride on the CLI that adding the label by hand silently drops.
   (a) The `reviewed-sha` marker: it is the ONLY record of which tree the acceptance covered, and at land the
   drain reads it with `parseReviewedSha` while `acceptanceCoversHead` (#2409) refuses an accept whose head has
   since advanced. Without it `parseReviewedSha` takes the LAST marker in ANY comment — typically the drain's own
   older advisory stamp — so your accept reads as stale and the PR is re-parked (observed on #983: five
   re-parks). Note the direction: the CLI puts its stamp **last** and neutralises any marker your body quotes,
   precisely because the reader is last-match-wins. (b) INVARIANT 2, above. `check:standards` errors when this
   file spells a hand-rolled review-label edit (#2882), so the raw path cannot come back.

   **What the clearance is durable against (#x9xqexm).** The CLI stamps three markers, not one: `reviewed-sha`
   (which commit), `reviewed-diff` (the exact net diff), and `reviewed-contribution` (only the lines the PR
   itself adds and removes). The third one is what makes a clearance survive the drain's own rebase-drop pass:
   that pass replays the lane onto a newer `main` within minutes of an accept, which moves context lines and
   hunk offsets and therefore changes `reviewed-diff` even though the author changed nothing. Before this the
   clearance was revoked on essentially every accepted PR (PR #1100, 3m07s after `--to=clear-human`; PR #984,
   the same pass). What still re-parks the PR — correctly — is a real change to the contribution: a commit that
   rides in after the clearance is not covered by it, and no marker makes it so. And a re-score **never removes
   `review:accepted`**: only your `--to=changes` retracts a verdict, so the record of a clearance outlives any
   automated pass that declines to land on it.

5. **The findings file you pass as `--body-file`** is the durable, readable record of the verdict on the PR —
   marked clearly as the human decision so it is never mistaken for the drain's `🤖 advisory AI review
   (non-clearing)` take. The CLI supplies the header line and the marker; your file supplies:
   - the core's findings + verdict that you presented, and
   - one line naming who accepted / requested changes (the operator).

   On the **changes** path this **is** the "summarize the required changes" record — one comment, not two.

   **Re-accepting after a rebase.** `acceptanceCoversHead` keys on head-SHA IDENTITY, so a benign
   rebase-onto-`main` invalidates an accept even when it adds no review-worthy content. Do not re-run the whole
   panel for that: prove the content is unchanged by diffing the two NET patches
   (`git diff <merge-base>..<head>` at the accepted sha vs now — an empty diff means the reviewed tree is
   byte-identical), then re-run the CLI (it re-reads the live head, so the fresh marker is automatic) with a body
   that states the net patch is identical and why the head moved.

6. **Report the clearance to the operator via `renderReviewNotice({ event: 'cleared', pr, repo, outcome, actor })`**
   (`we:scripts/lib/review-core.mjs`, #2433) — the in-chat notice, distinct from the PR comment step 5 just
   posted. Same renderer the drain uses for its `escalated` event, so both directions of a PR's review outcome
   are reported in the same words, never hand-typed per call.

## Invariant

A **`review:human` PR is never agent-cleared** — the core may render an *advisory* take (findings + verdict as a
non-clearing comment), but the `review:accepted` label on such a PR is applied **only** by a human via this
skill. That invariant is unchanged; this skill is the sanctioned place the human acts on it.

What DID change is which PRs get there. Since #2771/#2785 (statute
[`#review-human-declarative-leash-only`](../../docs/agent/platform-decisions.md#review-human-declarative-leash-only))
`humanRequired` fires on `isDeclarativeLeashPath` — the **declarative leash** (the policy contract, the
`we:gate-config.mjs` roster, the invariant / conformance suites) — plus any **statute** edit, exactly as before.
The gate's **derivation code** parks `review:pending` for the independent committee instead. Read the label and
the escalation reason; never infer "this needs me" from the fact that a PR touches gate machinery.

## Non-author-accepts (#2439) — independence is about the ACTOR, not the git login

The independence #2439 wants is between the **actor that produced the diff** and the actor that clears it — **not**
between GitHub identities. In a solo constellation every PR's git author / login is the same person's PAT (a human
commit and an AI-lane commit both show up as the same account), so login identity is a **useless** independence
signal — do NOT gate on it, and do NOT warn the operator that "this is your own PR" merely because the author login
matches. It always will.

What actually matters:
- **An agent must not clear a diff it produced.** If *you* (the agent running this skill) wrote the diff, or ran the
  lane that wrote it, then reviewing it with your own subagents and flipping `review:accepted` yourself is the
  author-self-accept seam #2439's `redteam:accepted` (an INDEPENDENT hardened validator) exists to close. Spawning
  your own review subagents does not make you independent. So: review your own working diff before you open the PR
  (that is `/code-review`), but never relabel a `review:*` PR **you** authored to `review:accepted` yourself.
- **A human clearing an AI-lane PR is exactly the independence — clear it without hesitation.** A parked PR produced
  by a `lane/*` clone (an AI actor) and cleared by the human via this skill has a diff-producer distinct from its
  clearer. That holds *regardless* of the shared git login. This is the sanctioned path — present the verdict and,
  on the operator's OK, swap the label. Raise no author-self-accept caveat.
