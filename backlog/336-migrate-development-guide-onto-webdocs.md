---
type: idea
workItem: task
status: resolved
blockedBy: ["398"]
dateOpened: "2026-06-11"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: plateau-app/src/development-guide/learn-pathway.ts (rendered via @frontierui/webdocs-ui SSR from seedProvider) + learn-pathway.test.ts
tags: [development-guide, learn-pathway, webdocs, migration, docs]
---

# Migrate the development-guide surface onto webdocs

Migrate the development-guide / learn-pathway surface off its interim configurator-native render (#335) and onto `webdocs`, so the guide is generated from the single `CapabilityProvider` source rather than hand-kept — matching the essay's "updated often" cadence. Ratified in #109 (Fork 3): render via `webdocs` from the single source is the ratified end-state; the configurator-native browse page is only the interim fallback until `webdocs` matures. Blocked on #398 (the Web Docs product build) shipping — #091 ruled the layering (standard→WE, primitives/adapters→FUI, served product→plateau-app, open-core by usage); this migration targets the `plateau-app` served surface.

## Progress

- **2026-06-15 — migrated (plateau-app).** `plateau:src/development-guide/learn-pathway.ts` no longer hand-builds
  DOM imperatively; it now server-renders to complete static HTML through the `@frontierui/webdocs-ui`
  SSR primitives — the `Nav` landmark for the topic switcher + the `createElement`/`renderToString` from
  `@frontierui/jsx-runtime/server` for the content — the same static-first substrate the served Web Docs
  site (#427) uses (Fork 3 end-state). The in-page topic switch is now a progressive enhancement (one
  delegated listener over `#<domainId>` links) layered over the JS-off-complete HTML. Content still flows
  from the single `seedProvider` (drift-free by construction); the curated-path layer + localStorage
  last-topic are preserved. `.wd-nav` styled in `plateau:learn-pathway.css` (webdocs-ui ships no CSS), reusing the
  prior switcher tokens. New `plateau:learn-pathway.test.ts` locks the migration (Nav primitive renders,
  single-source content, `aria-current`, in-page switch). Full plateau-app suite green (142/142).
  graduatedTo: the webdocs-rendered `learn-pathway.ts`.
