---
name: no-work-ever-in-primary-all-repos
description: "NO work ever happens in the primary checkout — the EDIT itself runs in a lane clone, every repo (WE, plateau-app, FUI), no carve-out"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5a0c46cd-a2cf-4c9b-9cb4-2c2c916ea4eb
---

**No work ever happens in the primary checkout.** Not the commit, not even the *edit*. Every edit-action —
authoring, fixing, branding, everything — happens inside an isolated **lane clone**, and lands via a
`lane/*` ref → PR. This is uniform across the whole constellation (webeverything, plateau-app, frontierui);
there is no plateau-app/FUI carve-out just because those repos lack a lane-*edit* guard.

**Why:** 2026-07-03 the user restated this as a standing rule ("we were clear in latest instruction — no
work ever happens in primary"). I had violated it: I edited plateau-app `landing.ts` / `index.html` /
`pricing.ts` directly in the primary working tree and committed there, then pushed a lane ref — treating
"push via lane" as sufficient. It is not: the *editing* in primary is itself the violation (it collides
with concurrent sessions and the user's dev server, and risks a lane-refresh `reset --hard` wiping the
work). #2203 blocks the *push*; this rule is stricter — it blocks the *touch*.

**How to apply:** before ANY edit, provision/enter a lane clone (`node scripts/lane-pool.mjs` — repo-
parameterized with `--repo` for plateau-app/FUI), `reset --hard origin/main` there, do ALL authoring in
that clone, commit tight-pathspec, push `HEAD:refs/heads/lane/<slug>`, land via PR. Reading the primary
tree (grep/Read/diff) is fine — only writing/committing there is forbidden. If a fix already sits
uncommitted in primary (someone's WIP), capture its diff read-only and re-apply it in a lane; never commit
it from primary. See [[single-session-should-use-a-lane]], [[backlog-id-storm-buffer-and-lane-pr]],
[[lane-refresh-wipes-unmapped-lanes]].
