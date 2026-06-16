---
type: issue
workItem: story
size: 5
status: open
dateOpened: "2026-06-16"
tags: [adapters, polyglot, generation, emitters, conformance, webdocs]
---

# Verify/build the generation-adapter per-framework component emitters (React/Vue/Svelte/Angular/WC) the polyglot panel needs

The polyglot adapter panel (#753) generates a block across frameworks and live-tests each in a sandbox. That centrepiece needs **runnable per-framework component emitters** (React/Vue/Svelte/Angular/native WC) on top of the resolved IR→emit core (#547) — but #547/#506 deliver the deterministic IR + conformance suite, not necessarily executable per-target output. Verify whether those emitters exist; if not, build the missing subset so #753's sandbox has real output to run and badge. Surfaced 2026-06-16: #753 pre-flighted batchable (`blockedBy: 547` satisfied) but its real prerequisite was unconfirmed, so #753 now `blockedBy` this. Verify-then-build; size pending the verify.
