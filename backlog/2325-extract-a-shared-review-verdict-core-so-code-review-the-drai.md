---
kind: story
size: 5
parent: "2285"
status: resolved
dateOpened: "2026-07-07"
dateStarted: "2026-07-08"
dateResolved: "2026-07-08"
graduatedTo: "we:scripts/lib/review-core.mjs"
tags: [review, drain, dry, agent]
---

# Extract a shared review-verdict core so /code-review, the drain, and /review share one engine

Today the "read a diff, judge it" logic exists in **two** hand-rolled copies: the `/code-review` engine, and
the drain's inline review subagent, which is described in prose in `we:skills-src/drain/SKILL.md` and spawned as
a raw `Agent` call (it sees only the diff + PR body and returns accept/changes). A future `/review` human-verdict
skill (child `#2326`) would be a third. This item removes the duplication by extracting **one** review core.

## The seam

A single core that, given `(diff, contextIsolation, mandate)`, returns:

```
{ findings: Finding[], verdict: 'accept' | 'changes' | 'needs-human' }
```

- **`findings`** — the same finding shape `/code-review` already produces.
- **`verdict`** — the accept/changes/needs-human disposition the drain needs (a superset of what
  `/code-review` computes today).

The core **judges only**. It never knows about labels, the merge-anyway window, `review:human`, or who is
allowed to clear what — that policy stays with each caller (the drain owns its leash; see `#2326`).

## Callers after this lands (no duplication)

- **`/code-review`** — thin caller over the working diff; renders `findings` for the human. Verdict optional.
  No behaviour change for the existing working-diff path.
- **the drain auto-review** (`#2326`) — core over the PR diff in a fresh subagent → maps `verdict` → label.
- **`/review`** (`#2326`) — core over the PR diff → shows findings + reason → operator sets the label.

## Acceptance

- One documented core module with the `{findings, verdict}` contract, unit-tested on fixtures.
- `/code-review` invokes the core (not its own inline engine); its output for a working diff is unchanged.
- The drain re-point + the duplicate prose removal ride the child `#2326`; this item lands the core + the
  `/code-review` re-point.

Blocks: `#2326`.

## Resolution note (2026-07-08)

Landed the canonical contract in `we:scripts/lib/review-core.mjs` (`Finding` shape, `VERDICTS`,
`normalizeFinding(s)`, `deriveVerdict`, `buildMandate`) — unit-tested on fixtures in
`we:scripts/lib/__tests__/review-core.test.mjs`. `deriveVerdict` is the accept/changes/needs-human
derivation the drain needs (superset of `/code-review`'s findings-only output today); `humanRequired` always
wins (mirrors the `#2285` conflict-of-interest invariant in `we:scripts/lib/review-escalation.mjs`, which is
otherwise untouched — policy stays with the caller).

Scope note on the `/code-review` re-point bullet: `/code-review` is Claude Code's own built-in review skill
with **no source in this repo** — there is nothing here to import the module into or "re-point." What's
wired instead: `we:docs/agent/platform-decisions.md`'s pre-PR-review rider (the in-repo seam that already
documents itself as "the `/code-review` model") now cites this module as the canonical shape every reviewer
here renders into, and `we:skills-src/drain/SKILL.md`'s auto-review section carries a cross-reference to it
(its actual re-point + prose deletion still rides `#2326`, unchanged from the original scope). `/review`
(`#2326`) and the drain re-point (`#2326`) are the first real callers.
