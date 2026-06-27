---
name: index-infra
description: This repo’s gates, build, and tooling quirks: check:standards skips the 11ty build, blocks/ has no typecheck gate, build:plugs pollutes the tree, FrontierUI happy-dom test quirks, vite config plugin≠alias, dev ports, write-time enforcement hooks + hookable-vs-judgment, intents.json escaping footgun, bootstrap-patches inject footgun, blocks per-file virtual anchor, dev-panel duplication, explorer report inflation. Recall when running gates/tests/builds or touching repo tooling.
metadata:
  type: reference
---

Testing · Gates · Build Infra cluster — open a leaf with `node scripts/memory-resolve.mjs <N>` (or `--cat`):

- 34. Explorer Report Inflates Per-State — per-state re-counts same element; dedupe findings.json; #1575
- 43. Enforce Shared Gate At Write-Time — PreToolUse(Edit|Write) hook scans content + denies the write; #883
- 51. Hookable vs Judgment Rule — script-decidable→hook (deterministic); judgment stays in context; footguns first
- 65. webeverything Dev Ports — npm start = Eleventy docs :8080 (/backlog/) + Vite demo :3000
- 112. Dev-Panel Plugin Duplicated — backend DE-DUPED→Plateau (#1579); frontend dev-panel.html still copied/drifted
- 113. Vite Config Plugin ≠ Alias — resolve.alias never rewrites config's OWN plugin imports; share via sibling pkg; #1579
- 118. Bootstrap-Patches Inject Footgun — FUI Vite plugin skips bootstrap inject if a demo names literal /plugs/bootstrap.ts
- 120. intents.json Mixed-Escaping Footgun — never JSON.stringify-roundtrip the whole file; splice changed entries
- 121. Blocks Per-File Virtual Anchor — #882 split blocks.json→blocks/<id>.json; blocks.json#<id>=virtual graduatedTo anchor
- 124. check:standards Skips 11ty Build — gate skips docs build; `npm run verify` when touching templates/_includes/_data
- 125. Blocks/ Has No Typecheck Gate — WE never tsc-checks `blocks/`; type errors ride to FUI's stricter build; #658
- 126. FrontierUI happy-dom Test Quirks — happy-dom: instanceof lies, setters don't reflect; branch on a bool; #870
