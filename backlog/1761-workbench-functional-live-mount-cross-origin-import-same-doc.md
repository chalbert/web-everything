---
kind: story
size: 5
parent: "912"
status: open
blockedBy: ["1760", "1030"]
dateOpened: "2026-06-24"
locus: frontierui
relatedProject: webdocs
tags: [webdocs, block-explorer, workbench, polyglot, functional-adapter]
---

# Workbench functional live-mount — cross-origin import + same-document mount of the functional form into the stage (analog of #1030, render-target ruled by #1594)

The consumer half of the #1746-GO chain: reuse the cross-origin-import + same-document mount harness #1030 builds in fui:workbench/mount.ts to import the #1760 functional-live module and mount() it into the STAGE — the single canonical introspection slot ruled by #1594 (codified #single-introspection-slot) — with window.onerror/unhandledrejection + ErrorBoundary runtime-error surfacing, reusing the inspector/event/anatomy panels. Known wrinkle to resolve at build: unlike the wrapper live form (#1518) which mounts the REAL custom element and forwards attrs+events, the functional render is the React/jsx lowering itself — NOT a custom element — so panel introspection of a non-CE tree may be degraded; surface it at build and file a follow-up only if it needs a call.
