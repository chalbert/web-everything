---
kind: story
size: 3
parent: "2301"
status: open
humanGate: { kind: review, short: "A human must supervise the live repoint of the running session's ~/.claude memory symlink and verify a memory round-trip — an agent must not silently repoint it.", what: "The core step is self-labelled SUPERVISED: the live repoint of the symlink the running session writes memory through carries a memory-wipe footgun (repointing under a live session can strand or clobber the active memory tree). An autonomous lane must not repoint the machine-global ~/.claude/…/memory symlink; a human runs the repoint and confirms with a before/after memory round-trip. Provisioning the dedicated persistent memory lane (we:scripts/lane-pool.mjs) is agent-doable; the live cutover is the human-gated half." }
dateOpened: "2026-07-09"
tags: []
---

# Provision a dedicated persistent memory-lane and repoint the machine-global memory symlink at it

Extend we:scripts/lane-pool.mjs's lease (#2275) into a PERMANENT reserved lane (no TTL, never released, off-limits to refresh/provision reset --hard), then repoint the live machine-global ~/.claude/…/memory symlink at that lane's agent-memory-src. Realpath becomes non-.claude (zero prompts) AND non-primary (clean tree). SUPERVISED — the live repoint of the symlink the running session writes through carries a memory-wipe footgun; verify with a memory round-trip. First slice of #2301; unblocks the guard-deny and auto-land slices.
