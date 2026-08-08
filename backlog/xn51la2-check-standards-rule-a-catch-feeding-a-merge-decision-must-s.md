---
kind: task
status: open
dateOpened: "2026-08-02"
tags: [review-integrity, check-standards, drain, gate]
scope: ["we:scripts/check-standards.mjs", "we:scripts/merge-ai-prs.mjs"]
---

# check-standards rule — a catch feeding a merge decision must set a degradation flag

review-integrity guard for the xc7p3q9 B1/B2/B3 fail-open-on-incomplete-context
class in `we:scripts/merge-ai-prs.mjs`.

## Why

The couple gate read a carrier's ABSENCE from the open-PR context as "landed →
let the impl land". But an empty/absent context is ALSO what you get when a
`gh pr list` threw and was swallowed to `[]` (B2), a per-PR read degraded (B1),
or the context was never collected (`RECONCILE` false, B3). So the "fail-closed"
gate failed OPEN on three independent paths — a coupled impl half landed alone
past a held/unreadable/uncollected carrier.

The behaviour half is now pinned by tests (`contextComplete` on
`collectOpenPrContext`; `carrierDeferDecision` defers on `health === null` unless
`contextComplete === true`; the degraded-carrier marker in `buildCarrierHealth`).
This item captures the missing DETERMINISTIC guard so the class cannot recur in a
new call site.

## The guard

R15 (round-2 review): the original phrasing — "a catch returning an empty
collection **for a value that feeds a merge decision**" — needs TAINT ANALYSIS
(does this return flow into a land decision?) and is NOT decidable as written.
Restate it as a FILE-SCOPED, grep/AST-decidable PATTERN so it can actually be
implemented:

> Within the context-collection region of `we:scripts/merge-ai-prs.mjs` — the
> functions `collectOpenPrContext`, `reduceOpenPrContext`, `readPrManifest`,
> `readRemoteManifestViaApi`, `readManifestFromPrBody`, and `fetchPrCommits` (an
> explicit, maintained ALLOW-LIST of function names, not a data-flow trace) — any
> `catch (…) { … }` whose body's `return` produces a bare empty collection
> (`[]`, `new Map()`, `new Set()`, `{ … prs: [] … }`, `[repo, []]`, or
> `{ manifest: null }` / `{ commits: [] }` with no sibling flag) MUST, in the SAME
> catch, set a degradation marker — one of the literal tokens `degraded`,
> `failed`, or `contextComplete` appearing as a `false`/`true` assignment or
> object key in the returned expression.

This is a syntactic check over a named function list — no reachability analysis.
The allow-list is the "file-scoped" boundary: adding a new context-reader means
adding its name to the rule (a deliberate, reviewed step), which is exactly the
signal we want. The intent is unchanged: an error path that erases data inside the
context collection must ANNOUNCE the erasure, never present it as a clean empty
result.

## Acceptance

- The rule fires on a reintroduced `catch { return { repo, prs: [] }; }` (no
  `failed` flag) inside `collectOpenPrContext`, and on a `readPrManifest` catch
  that drops the `degraded` key — and passes on the current code (every such catch
  sets its flag).
- The rule does NOT fire on catches OUTSIDE the named function list (no false
  positives from unrelated best-effort catches).
- 0 new errors on the `check:standards` gate for the existing tree.
