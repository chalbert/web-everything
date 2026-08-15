---
kind: task
parent: "2505"
status: open
dateOpened: "2026-08-15"
tags: [plateau-loop, webcases, backlog-hygiene, bookkeeping]
---

# Resolve #2550 — its tracked deliverable (plateau-app PR #104) already merged

#2550's card says it resolves once plateau-app PR #104 merges; PR #104 merged 2026-07-22 and its scope (coalesced review-verdict persistence) shipped. The card's status frontmatter is still open, which leaves it counted as an unresolved blockedBy edge for #2662 (durable source registry) even though the actual dependency is satisfied. Mechanical status splice: verify PR #104's merge + scope against #2550's acceptance, then resolve #2550 (codifiedIn: one-off, since it is a shipped feature slice, not a statute rule).

## Found during

Preparation of [#2662](/backlog/2662-webcases-viewer-durable-source-registry-add-a-source-carved-.md)
(`blockedBy: ["2550"]`), 2026-08-15. `gh pr view 104 --repo chalbert/plateau-app` confirms `state: MERGED`,
`mergedAt: 2026-07-22T18:49:30Z`; the merged code (`plateau-app:src/backlog-view/webcases-review-write.ts`,
`plateau-app:src/backlog-view/webcases-reviews-ledger.ts`, `plateau-app:src/backlog-view/webcases-review.ts`
verdict persistence + the `webcase-review` write verb wired in `plateau-app:vite.config.mts`) matches
#2550's Part-2 acceptance (coalesced flush → committed ledger, standing verdicts survive reload, pending
verdicts survive via a local buffer). This is a pure bookkeeping gap, not a design or code question — the
work is done, the frontmatter status just never flipped.

## Done when

- [ ] `backlog/2550-*.md` frontmatter carries `status: resolved`, `dateResolved`, and `graduatedTo: none` /
      `codifiedTo: one-off` per the CLI's resolve requirements.
- [ ] `check:standards` passes.
