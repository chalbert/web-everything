---
kind: story
size: 3
parent: "746"
status: open
blockedBy: ["912", "954"]
dateOpened: "2026-06-18"
locus: frontierui
relatedProject: webdocs
tags: [webdocs, block-explorer, adapters, polyglot, conformance]
---

# Polyglot panel — behavioral wrapper-conformance badge (FUI-side runner over a live subject)

Block Explorer polyglot-panel slice — split from #913 per #954 Fork 2 (the [constellation-placement](docs/agent/platform-decisions.md#constellation-placement) rule). Render a pass/fail BEHAVIORAL conformance badge per target by executing the #891 wrapper-conformance runner (we:wrapper-conformance/runner.ts — a WE-owned standard artifact, ~165 lines pure DOM, imports no FUI) FUI-SIDE against FUI's live WrapperSubject (genWrapper output). Per #954: vectors (we:wrapper-conformance/vectors.ts) cross as DATA; the runner executes in FUI. Runner packaging rides #872 (byte-replication interim per #694/#170). Needs a MOUNTED subject -> downstream of #912 (live-test sandbox). Home fui:workbench/. locus:frontierui.
