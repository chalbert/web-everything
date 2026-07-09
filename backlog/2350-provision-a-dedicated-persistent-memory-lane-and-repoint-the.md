---
kind: story
size: 3
parent: "2301"
status: open
dateOpened: "2026-07-09"
tags: []
---

# Provision a dedicated persistent memory-lane and repoint the machine-global memory symlink at it

Extend we:scripts/lane-pool.mjs's lease (#2275) into a PERMANENT reserved lane (no TTL, never released, off-limits to refresh/provision reset --hard), then repoint the live machine-global ~/.claude/…/memory symlink at that lane's agent-memory-src. Realpath becomes non-.claude (zero prompts) AND non-primary (clean tree). SUPERVISED — the live repoint of the symlink the running session writes through carries a memory-wipe footgun; verify with a memory round-trip. First slice of #2301; unblocks the guard-deny and auto-land slices.
