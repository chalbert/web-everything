---
kind: story
size: 2
status: open
dateOpened: "2026-07-11"
tags: []
---

# JIT renumbering leaves statute-layer hash refs dangling — extend the rewrite sweep beyond backlog/*.md

The #2288 JIT-numbering rewrite (numberPendingHashes/applyLedger in we:scripts/merge-ai-prs.mjs and we:scripts/lane-drain.mjs) walks only backlog/*.md (+ hash-stemmed report files), so a provisional #xNNNNNN cited from the cite-able statute layer dangles permanently once the item lands with a real NNN. Proven twice in we:docs/agent/platform-decisions.md: 'Build carried by #xua3eva' (landed as #2427) and 'agent-ready — #xqd7m2u' (landed as #2421) — both repaired by hand in the #407 post-merge review fix PR. Fix: include we:docs/agent/*.md (at minimum we:docs/agent/platform-decisions.md) in the hash-to-NNN rewrite scope at land, same blind textual rewrite the backlog files get; test: a statute doc citing a pending hash is rewritten in the same land that numbers the item.
