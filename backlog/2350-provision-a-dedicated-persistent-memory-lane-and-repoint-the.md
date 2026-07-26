---
kind: story
size: 3
parent: "2301"
status: active
humanGate: { kind: review, short: "A human must supervise the live repoint of the running session's ~/.claude memory symlink and verify a memory round-trip — an agent must not silently repoint it.", what: "The core step is self-labelled SUPERVISED: the live repoint of the symlink the running session writes memory through carries a memory-wipe footgun (repointing under a live session can strand or clobber the active memory tree). An autonomous lane must not repoint the machine-global ~/.claude/…/memory symlink; a human runs the repoint and confirms with a before/after memory round-trip. Provisioning the dedicated persistent memory lane (we:scripts/lane-pool.mjs) is agent-doable; the live cutover is the human-gated half." }
dateOpened: "2026-07-09"
dateStarted: "2026-07-26"
tags: []
scope:
  - we:scripts/lane-pool.mjs
  - we:scripts/lib/lane-lease.mjs
  - we:scripts/__tests__/
---

# Provision a dedicated persistent memory-lane and repoint the machine-global memory symlink at it

Extend we:scripts/lane-pool.mjs's lease (#2275) into a PERMANENT reserved lane (no TTL, never released, off-limits to refresh/provision reset --hard), then repoint the live machine-global ~/.claude/…/memory symlink at that lane's agent-memory-src. Realpath becomes non-.claude (zero prompts) AND non-primary (clean tree). SUPERVISED — the live repoint of the symlink the running session writes through carries a memory-wipe footgun; verify with a memory round-trip. First slice of #2301; unblocks the guard-deny and auto-land slices.

## Progress

- **Agent-doable half — DONE (this PR).** The PERMANENT reserved-lane primitive lands in the lease core + pool CLI:
  - `we:scripts/lib/lane-lease.mjs`: a lease may carry `reserved: true` (omitted-when-false, so an ordinary
    acquire's marker stays byte-identical). `isLeaseStale` short-circuits a reserved lease to **never-stale**
    (no TTL); new `isReservedLease()` reader; `describeLease` renders it as `RESERVED (permanent)`.
  - `we:scripts/lane-pool.mjs`: `acquire --reserve --lane=N` mints the reserved hold (requires an explicit
    `--lane` — a reserved slot is never auto-picked). A reserved lane is then off-limits to the whole pool:
    auto-pick skips it, an explicit `acquire --lane=N` (even `--force`) hard-fails on it, `refresh`/`provision`
    (even `--force`) never reset it, and a plain `release` (even `--force`) refuses it. The ONE deliberate
    un-reserve is `release --lane=N --release-reserved`.
  - `we:scripts/__tests__/lane-pool-reserve.test.mjs`: full proof (CLI + pure decision core) — 11 cases.
- **Human-gated half — NOT done (SUPERVISED, see `humanGate`).** The live repoint of the machine-global
  `~/.claude/…/memory` symlink at the reserved lane's `agent-memory-src`, verified with a before/after memory
  round-trip, is deliberately left for a human — repointing under a live session carries a memory-wipe footgun.
  This PR is parked `review:human` for that cutover; the item stays `active` until the supervised repoint lands.
