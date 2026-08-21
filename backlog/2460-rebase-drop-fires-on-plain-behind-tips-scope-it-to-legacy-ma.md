---
bornAs: xk3v7dq
kind: story
size: 3
status: open
dateOpened: "2026-07-12"
tags: []
scope:
  - we:scripts/merge-ai-prs.mjs
  - we:scripts/__tests__/merge-ai-prs.test.mjs
  - we:scripts/lib/rebase-drop-manifest.mjs
  - we:scripts/lib/__tests__/rebase-drop-manifest.test.mjs
---

# rebase-drop fires on plain BEHIND tips — scope it to legacy manifest conflicts, stop fabricating commits

The #2198 rebase-drop in we:scripts/merge-ai-prs.mjs rebuilds ANY certified BEHIND/CONFLICTING tip, but its reason to exist — the shared tree-committed we:.lane-manifest.json conflicting every lane — was removed by #2411 (manifest rides the PR body now). Today a plain-BEHIND tip needs no rebuild at all: GitHub's merge-commit strategy lands a BEHIND-but-CLEAN PR directly (proven live: PR #444 landed via `--no-rebase-drop` after ~10 rebuilds had churned it). Each rebuild fabricates a permanent two-parent commit ("drain: rebase … drop transient lane manifest"), resets the tip's checks (the #2391-adjacent livelock), and absorbs main's history into the branch ancestry — PR #444's commit tab showed 37 commits of which ~5 were authored content. Fix shape: (a) fire rebase-drop ONLY when the tip actually carries a tree-committed we:.lane-manifest.json conflict (the legacy pre-#2411 case); a plain BEHIND-but-mergeable tip goes straight to `gh pr merge`; (b) make the fabricated commit's message honest — name the manifest only when one was dropped; (c) never re-rebuild a tip whose prior rebuilt commit still has pending checks. Gate-self surface (edits the lander) — expect the human-clearance park. Interim default until the drain-strategy config item (2461) makes the strategy configurable.

## Design

**The gate is `isRebaseDropCandidate`, and the signal it needs does not exist yet.** `isRebaseDropCandidate(v)`
in `we:scripts/merge-ai-prs.mjs` is exported and pure; it fires on any certified, `test`-green, `skip` verdict
whose state is `CONFLICTING` / `BEHIND` / `DIRTY`. It has no way to ask "is a manifest committed to the
**tree**?", because the only manifest signal on a verdict is `v.hasManifest`, and
`attachManifestToVerdict` sets that from whatever `readPrManifest` returned — and `readPrManifest` reads
the **PR body first**, falling back to the tree only for legacy pre-#2411 lanes. So post-#2411 lanes have
`hasManifest === true` from a body manifest that is not in the tree at all.

Fix (a) therefore needs a **new** field, not a new predicate over the old one: carry the manifest's
**source** through `readPrManifest` → `attachManifestToVerdict` (e.g. `v.manifestSource` of
`'body' | 'tree' | null`), and let `isRebaseDropCandidate` require the tree source. `readPrManifest`
already knows which branch it took — `readManifestFromPrBody` succeeded, or `readLegacyLocalManifest` /
`readRemoteManifestViaApi` did — so the source is free at the read, and inventing it later is not possible.

**Threading it as a sibling field is the trap, and it would fail silently.** Between `readPrManifest` and
`attachManifestToVerdict` sit two caching closures — `fetchOne` inside the open-PR-context fan-out and
`fetchOne` inside the merge-candidate sweep — and **both hardcode their return to exactly
`{ manifest, commits, degraded }`**. A new sibling field on `readPrManifest`'s return is dropped there and
`v.manifestSource` is `undefined` for every real verdict, while every hand-built-verdict unit test still
passes. Widen BOTH closures (and `fetchPrReadsCached`'s cached value) in the same change, and prove it with
a round-trip case through the real `readPrManifest → fetchPrReadsCached → buildDrainVerdicts →
attachManifestToVerdict` path — not only over hand-built verdicts. (Raised by the independent review below.)

**Allowlist or denylist — decide it explicitly, because the existing fixtures decide it for you otherwise.**
The existing `isRebaseDropCandidate` cases build their verdicts as `classifyPr(aiPr(…))` with **no manifest
field at all**, so a literal allowlist (`manifestSource === 'tree'`) flips them from `true` to `false` and
the "pre-existing cases stay green unedited" promise breaks. A denylist (`manifestSource !== 'body'`) keeps
them green but leaves manifest-less BEHIND tips — every FUI/plateau impl PR — still minting the fabricated
commit this card exists to stop. **The right answer is the allowlist plus edited fixtures**: a manifest-less
BEHIND tip is precisely the population that should stop being rebuilt, so those two fixtures are asserting
the defect and must be updated deliberately, with the update called out in the PR rather than absorbed.

**A second caller of the same plumbing is out of scope and will keep fabricating commits.**
`we:scripts/lane-resume.mjs` calls `rebaseDropManifest` from its `land` path under its own `landDecision`
gate, which checks CONFLICTING/DIRTY/BEHIND with no manifest-source signal at all. So `/finish`-style manual
landing keeps minting the two-parent commit after this card ships. That is acceptable as a follow-up — but
say so, rather than claiming "stop fabricating commits" outright.

**Confirming the churn is real, not theoretical.** `rebaseDropManifest` returns `action: 'current'` (no
push) ONLY when the tip is already up-to-date on base AND manifest-free. A plain-BEHIND tip with no tree
manifest takes the other path: `merge-tree` reports `clean`, so it falls through to `commit-tree` +
fast-forward push — a fabricated two-parent commit and a reset check run, for a PR GitHub's merge-commit
strategy would have landed as-is. That is exactly the PR #444 pattern in the digest.

**The same `hasManifest` conflation reaches `needsManifestStripBeforeMerge`.** That predicate (the #2183
first-lander leak fix) also gates on `v.hasManifest` and is OR'd into the same loop, so a post-#2411
body-manifest PR is routed into the plumbing there too. In practice it usually lands on `current` (the tip
is on main and the tree is manifest-free) so nothing is pushed — but the moment such a PR is also BEHIND,
the strip path mints the same needless commit. **Whatever `manifestSource` field (a) adds, apply it to this
predicate as well**; leaving one of the two on the old signal re-opens the hole through the other door.

Fix (b) is local: the message is minted in `we:scripts/lib/rebase-drop-manifest.mjs` as
``drain: rebase <laneRef> onto <base>, drop transient <manifest>``, unconditionally, even when the
`disp === 'manifest-only'` branch was not taken (the function already computes `dropped` for the return
value — use the same condition for the message).

Fix (c) — "never re-rebuild a tip whose prior rebuilt commit still has pending checks" — is a NEW state
question the verdict does not carry today; the check rollup is on the PR (`statusCheckRollup`, already
fetched) and `classifyPr` already reduces it to `testGreen`. The cheap form is "a candidate whose required
check is PENDING (neither green nor failed) is not re-rebuilt this pass"; `isRequiredCheckGreen` /
`isRequiredCheckFailed` are both exported already, so pending is expressible without a new fetch.

## Done when

- `isRebaseDropCandidate` returns `false` for a certified, green, `BEHIND` verdict whose manifest came from
  the PR **body**, and `true` for the same verdict whose manifest is **tree**-committed. Both cases pinned
  in the existing suite — the first fails before and passes after:

  ```
  npx vitest run scripts/__tests__/merge-ai-prs.test.mjs
  ```

- `needsManifestStripBeforeMerge` uses the same tree-vs-body signal, with its own case pair in the same run
  — so a body-manifest PR is never routed into the rebuild plumbing by either door.
- `rebaseDropManifest` names the manifest in its commit message ONLY when one was actually dropped, pinned
  in `we:scripts/lib/__tests__/rebase-drop-manifest.test.mjs` (`npx vitest run scripts/lib/__tests__`).
- A candidate whose required check is still PENDING after a prior rebuild is skipped this pass rather than
  re-rebuilt — one unit case over the pure predicate, no network.
- A round-trip case through the REAL read path (`readPrManifest → fetchPrReadsCached → buildDrainVerdicts
  → attachManifestToVerdict`) proves `v.manifestSource` survives both caching closures. Hand-built-verdict
  cases alone do not satisfy this criterion — they pass whether or not the field is dropped in transit.
- No behaviour change for the legacy case: a tree-committed manifest conflict still rebuilds, still drops
  the manifest, still lands. The two manifest-less `isRebaseDropCandidate` fixtures DO change (they assert
  today's over-firing) — the PR names them as deliberate updates rather than absorbing them silently.
- Before wiring, the two populations are counted across the live open-PR corpus: how many open PRs still
  carry a legacy tree-committed manifest (must keep being rescued) versus how many are plain-BEHIND with
  none (must stop being rebuilt). One `gh` sweep; the numbers go in the PR body.

## Independent review — 2026-08-21

Confidence: **Medium**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: verify by mutation or reversion, ahead of implementation) — The core premise (manifest now rides the PR body post-#2411; readPrManifest tries body first, falls back to tree only for legacy lanes) is verified against we:scripts/merge-ai-prs.mjs:2602-2623 and backed by a concrete live observation (PR #444), not just asserted.
- **blast-radius** (NOT addressed; strategy: measure against the real corpus before wiring) — The card gives one anecdote (PR #444: 37 commits, ~5 authored, ~10 rebuilds) but never measures, across the current open-PR corpus, how many PRs still carry a legacy tree-committed manifest (the population fix (a) must keep rescuing) versus how many are plain-BEHIND with no manifest at all (the population it must stop rebuilding). Without that count the 'no behaviour change for the legacy case' promise is untested against real traffic.
- **consumer** (NOT addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — Design section traces manifestSource only from readPrManifest (we:scripts/merge-ai-prs.mjs:2602) to attachManifestToVerdict (we:scripts/merge-ai-prs.mjs:1194) to isRebaseDropCandidate, but misses two real consumers/producers in the same file's actual production wiring: the two caching closures that feed buildDrainVerdicts — fetchReads's fetchOne (we:scripts/merge-ai-prs.mjs:2690-2693) and the sweep's fetchOne (we:scripts/merge-ai-prs.mjs:2864-2866) — both hardcode their return to exactly {manifest, commits, degraded}, the same shape that already silently drops the existing sibling field `degraded` before it ever reaches attachManifestToVerdict (only read.manifest is passed at we:scripts/merge-ai-prs.mjs:1180). A manifestSource field added the same way (a sibling field on readPrManifest's return, as the design text implies) would be silently dropped there too, leaving v.manifestSource undefined for every real verdict. Separately, we:scripts/lib/rebase-drop-manifest.mjs's exported rebaseDropManifest (in the card's declared scope) has a second unconditional caller: we:scripts/lane-resume.mjs's land() (line 487), gated only by its own independent landDecision (we:scripts/lane-resume.mjs:426-434) which checks CONFLICTING/DIRTY/BEHIND with no manifest-source signal at all and is untouched by this card's declared scope. Failure scenario A (introduced by this card; worse than base if shipped with the naive sibling-field threading, since legacy tree-manifest PRs — explicitly required to keep working — would silently stop being rescued, reopening the #2198 manifest wall; not parallelizable, same threading work; impact broken): none of the Done-when unit tests would catch it since they hand-construct verdicts rather than exercising the real fetchReads/buildDrainVerdicts round trip. Failure scenario B (introduced by this card's scoping choice; not worse than base, `we:scripts/lane-resume.mjs`'s `land` already fabricates these commits today; independently fixable in a follow-up card, so parallelizable; impact degraded): `/finish`-style manual landing of a plain-BEHIND PR keeps minting the fabricated two-parent commit after this card ships, so the goal 'stop fabricating commits' is only partially achieved. No mutation probe applies to either — this is unimplemented code, there is no live line to break.
- **population** (NOT addressed; strategy: name the population each threshold guards) — Fix (a)'s phrase 'require the tree source' is ambiguous between an allowlist (manifestSource==='tree') and a denylist (manifestSource!=='body'), and the two choices diverge exactly on the un-pinned population of BEHIND PRs with no manifest at all (a real, already-tested category elsewhere in the suite, e.g. the manifest-less impl fixture at we:scripts/__tests__/merge-ai-prs.test.mjs:641). An allowlist directly contradicts the card's own claim that 'the pre-existing isRebaseDropCandidate cases stay green unedited': the existing walled/behind fixtures (we:scripts/__tests__/merge-ai-prs.test.mjs:1037,1043, built via classifyPr(aiPr(...)) alone, confirmed to carry no manifest field at all) would flip from true to false under an allowlist. A denylist avoids that self-contradiction but leaves manifest-less BEHIND tips (any frontierui/plateau-app impl PR going BEHIND) still triggering the exact fabricated-commit behaviour the card exists to eliminate, and no Done-when test pins which reading is intended. Introduced by this card (a self-contradiction within its own text); not worse than base under either reading (allowlist fails loudly at CI red, denylist just leaves base behaviour unchanged for that population); parallelizable — resolvable by clarifying the card's wording without blocking the rest of the declared scope. Impact: degraded — an implementer under time pressure will likely pick whichever reading keeps existing tests green (the denylist), silently leaving the stated goal only half-achieved for manifest-less PRs.
- **interface** (NOT addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — Every Done-when assertion for isRebaseDropCandidate/needsManifestStripBeforeMerge is a pure-predicate unit test over a hand-built verdict object, never a round-trip test through the real readPrManifest→fetchPrReadsCached→buildDrainVerdicts→attachManifestToVerdict seam that production actually uses. This is the same gap as the consumer finding above, viewed as a missing seam test rather than a missed call site: nothing in the acceptance criteria would catch the field being silently dropped in transit even though the predicate-level tests all pass.
- **decorative-guard** (NOT addressed; strategy: mutate the guarded line; require a NAMED test to redden) — Because the proposed tests operate only on hand-constructed verdicts, a broken real-world wiring (the consumer finding's caching-drop scenario) would pass every specified test while the actual drain silently stops rescuing legacy manifest conflicts in production — the guard the Done-when list describes is decorative with respect to that failure mode.
- **legibility** (NOT addressed; strategy: assert the failure SURFACES, not just that it occurs) — If the missed-consumer gap ships, isRebaseDropCandidate silently returns false for every real verdict going forward — no error, no log line, no ci-lifecycle label change flags it (checking/ci:failed/blocked/ready are all unrelated to this path). The only visible symptom is legacy CONFLICTING PRs quietly re-accumulating with no diagnostic pointing at the cause, which is exactly the kind of failure this codebase's own extensive stderr diagnostics (e.g. the 'needs rebase in a clone' message at we:scripts/merge-ai-prs.mjs:3027) otherwise take care to surface elsewhere.

**Corrections applied by this review:**

- Fix (a)'s instruction to 'let isRebaseDropCandidate require the tree source' (an allowlist on manifestSource==='tree') is inconsistent with the same card's Done-when claim that 'the pre-existing isRebaseDropCandidate cases in the suite stay green unedited' — the existing walled/behind fixtures at we:scripts/__tests__/merge-ai-prs.test.mjs:1037 and :1043 carry no manifest field at all (built via classifyPr(aiPr(...)) alone, bypassing attachManifestToVerdict), so a literal tree-source allowlist would flip both from true to false without any edit to those lines.

The card's diagnosis is accurate and well-cited against the live repo (isRebaseDropCandidate at we:scripts/merge-ai-prs.mjs:609 really does fire regardless of manifest source, needsManifestStripBeforeMerge shares the same hasManifest conflation, and fix (b) is a safe one-line change) — but the design section's own call-graph tracing is incomplete in ways that could let an implementation pass every literal Done-when check while shipping broken or only partially fixing the stated goal.

_Recorded through the declared `review-prep` operation._
