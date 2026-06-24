---
kind: story
size: 3
status: open
dateOpened: "2026-06-24"
tags: []
---

# Batch claim doesn't record the --scope baseline unless --session is passed (scope flag silently inert)

The batch loop in we:docs/agent/backlog-workflow.md (and the batch-backlog-items skill) runs claim <NNN> without --session, but we:scripts/backlog.mjs only records the #952 claim-time git baseline into we:claims.json when flag('session') is set. So a batch that follows the loop literally never records a baseline, and the --scope=<slug> gate flag (#952/#957) is silently inert — every concurrent finding is mis-classified and a session must diagnose externals manually (observed live in batch-2026-06-23-1689-1500: we:claims.json stayed empty across 16 items, so --scope demoted nothing and the #1661 record-touch hook found no session). Fix: have claim infer the session from the active reservation in we:reservations.json (the reserve step already records --session there), or fall back to the chat-rename slug, so the baseline records without a per-claim flag; alternatively document --session on the claim step. Keep it best-effort (no claim must fail on it).
