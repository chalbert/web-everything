---
bornAs: xpa89kw
kind: task
status: resolved
dateOpened: "2026-08-02"
dateStarted: "2026-08-08"
dateResolved: "2026-08-08"
tags: [governance, mechanization, review-escalation, diff-plumbing, precondition]
---

# Thread `diffHunks` (base-vs-head content) into `scoreEscalation` and the write path

Shared producer-side precondition for the #2839 and #2840 enforcement gates: thread a base-vs-head
diff-content signal (`diffHunks`) into `we:scripts/lib/review-escalation.mjs#scoreEscalation` /
`producerReviewLabel` and both call sites, so the content-reading principle-surface detectors can see hunk
text instead of only file names. Filed once (not duplicated per gate) because both follow-ons depend on it.

## Why this is its own item

`scoreEscalation` is declared today over `{ changedFiles, diffLines, humanBasisFiles, dismissedFindings,
crossRepo, thresholds }` — file **names** and a line **count**, never hunk content — and both call sites
(`we:scripts/pr-land.mjs`, `we:scripts/merge-ai-prs.mjs`) pass exactly that. Both #2839's
`assertNotPrincipleAndImpl(changedFiles, diffHunks)` and #2840's `isPrincipleSurface(changedFile,
diffHunks)` read hunk content (statute-anchor-body edits and pre-existing-marker edits are base-vs-head
facts). Until this plumbing lands, those detectors evaluate against undefined content and under-fire on
exactly the class they exist for. This is new plumbing, not a no-op signature change.

## Scope

- Extend `scoreEscalation` / `producerReviewLabel` (`we:scripts/lib/review-escalation.mjs`) to accept a
  `diffHunks` (or base-vs-head content) input.
- Thread the signal from both call sites: `we:scripts/pr-land.mjs`, `we:scripts/merge-ai-prs.mjs`.
- Thread the same base-vs-head signal into the `PreToolUse(Edit|Write)` write path so the shift-left gate
  and the whole-tree run read the same content (memory rule #43).

## Residual on resolve — Scope bullet 3 (the write path) is DEFERRED to #2891

Scope bullets 1 and 2 shipped in full. Bullet 3 — "thread the same base-vs-head signal into the
`PreToolUse(Edit|Write)` write path" — shipped only as far as the CAPABILITY:
`we:scripts/lib/diff-hunks.mjs#computeProposedFileDiffText` exists, is unit-tested, and returns the same
`{text, scored, reason}` shape as the PR-time `computeNetDiffText`, so both halves feed one contract. It is
**not wired into `we:.claude/settings.json`**, and nothing calls it in production today.

Why deferred, not dropped: no `PreToolUse(Edit|Write)` hook reads a review-escalation signal at all (the five
registered `Edit|Write` hooks — `we:scripts/guard-lane.mjs`, `we:scripts/lint-locus-prefix.mjs --pre`,
`we:scripts/check-memory.mjs --pre`, `we:scripts/backlog-guard.mjs --pre`,
`we:scripts/guard-backward-edge.mjs` — import neither `we:scripts/lib/review-escalation.mjs` nor
`we:scripts/lib/diff-hunks.mjs`), and the write-time deny logic those hooks would run (#2839's
`assertNotPrincipleAndImpl`, #2840's `isPrincipleSurface`) is explicitly out of this item's scope. Wiring a
hook entry now would register a hook with no gate behind it.

**Owner of the residual: #2891** (`blockedBy: 2890`), whose scope already reads "invoked from both the
`PreToolUse(Edit|Write)` deny path". If #2891 is dropped or re-scoped away from the hook wiring, this residual
comes back and must be re-filed — it does not disappear with this item's resolve.

Standing risk, recorded because shipping unwired is what creates it: nothing yet proves #2891 will adopt
`computeProposedFileDiffText`'s exact signature. The mitigation is the shared return shape above plus
`we:scripts/lib/review-escalation.mjs#diffHunksFrom`, the single mapping both halves must go through.

### Carried to #2891 — the loud throw is UNCONTAINED in the drain

Raised in review round 2 and deliberately NOT fixed here, because nothing reads `diffHunks` yet so there is no
live failure to contain. The `null` contract's backstop is that `.includes()` on `null` THROWS rather than
silently clearing — right for a gate. But there is no `try`/`catch` anywhere between `runCli()` and the
`scoreEscalation` call in `we:scripts/merge-ai-prs.mjs` (the enclosing blocks are `runCli` → `sweepOnce` →
`if (REVIEW_ESCALATION)` → `for (const v of verdicts)`), so a future detector's `null.includes(…)` would abort
the ENTIRE sweep and leave every remaining queued PR unprocessed — not park the one PR. Loud *and* contained
means a `try`/`catch` around the per-PR body that parks that PR with the error as its reason. **The item that
adds the first reader of `diffHunks` (#2891) owns adding that containment in the same change.**

### Correction — the over-cap TRUNCATION claim, narrowed to what is demonstrable

Round 2 of this item claimed that a real `git` can exit on its own with a TRUNCATED stdout and no `ENOBUFS`,
and used that to justify the byte-length check in `we:scripts/lib/diff-hunks.mjs#overCap`. Neither the author
nor the reviewer could force real `git` into that state — every over-cap run raised `ENOBUFS`. The claim is
**withdrawn**; the code comment now says so. What IS demonstrated, with a real subprocess, is the SHAPE: a
child that writes past the cap and exits 1 on its own surfaces as a plain non-zero exit with a short stdout,
which the exit-1 unwrap would otherwise return as a complete diff. The guard is kept on that basis (and
because `execFileSync`'s buffer behaviour is not part of Node's public contract), not on an unproven git
scenario.

## Preconditions / relationships

Precondition of #2839's gate (the `assertNotPrincipleAndImpl` item) and #2840's gate (the
`isPrincipleSurface` item). Enforces no principle itself — pure plumbing, committee-clearable under the
two-PR rule (`we:docs/agent/platform-decisions.md#principle-and-impl-two-pr`).
