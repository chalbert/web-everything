---
kind: story
size: 3
status: open
scope: ["we:backlog/4397-salvagelane-aborts-forever-on-a-socket-fifo-device-file-unde.md"]
dateOpened: "2026-09-30"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3211's independent review

Filed mechanically by the unattended review loop (#2749) — every finding below reduced chalbert/web-everything#3211's review (reviewed head `e300ee2c54c5fab34bda1488f27e8e40519a5648`) to prevention-outstanding by naming a guard neither captured nor filed:

1. `we:backlog/4397-salvagelane-aborts-forever-on-a-socket-fifo-device-file-unde.md:46` — Add a prepare-card lint that rejects `we:`-prefixed tokens inside backticked shell commands in Proof plan or Done when sections.
2. `we:backlog/4397-salvagelane-aborts-forever-on-a-socket-fifo-device-file-unde.md:24` — Add a review-lens checklist item: a test plan guarding a special-file class must enumerate each type (socket, FIFO, device) and name a timeout for blocking opens.
3. `we:backlog/4397-salvagelane-aborts-forever-on-a-socket-fifo-device-file-unde.md:30` — Amend the card before build to: (1) write the placeholder with flag 'wx', or record skips in a single manifest entry outside the mirrored tree (e.g. `${litterDestRoot}we:.skipped.json`) so it cannot collide with mirrored names; (2) add a collision test. Longer term, add a lane-salvage test rule that every write under `.wt-litter` uses an exclusive-create flag.
4. `we:backlog/4397-salvagelane-aborts-forever-on-a-socket-fifo-device-file-unde.md:31` — Specify collision-safe skip recording and add a deterministic regression test containing both a socket and its would-be marker filename, asserting preservation of regular-file contents and the skip record.
5. `we:backlog/4397-salvagelane-aborts-forever-on-a-socket-fifo-device-file-unde.md:36` — A markdown lint rule or validation script that extracts shell commands from `Proof plan` blocks and stat-checks any argument that looks like a file path to ensure it exists on disk, failing the check if workspace prefixes leak into native CLI commands.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
