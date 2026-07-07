---
kind: story
size: 5
status: resolved
dateOpened: "2026-07-04"
dateStarted: "2026-07-07"
dateResolved: "2026-07-07"
graduatedTo: none
tags: []
---

# Implement the (b-strong) prepare-hold local token + lane-run prepare-stamp verb (#2219)

Build arm of #2219 (ratified): re-home the prepare-window concurrency guarantee into a hard-excluding LOCAL prepare-hold token — the #2138-Fork-4 queued-token shape (selection skips it, claim refuses it, read offline per Rule #105), lease longer than a real prepare. Add lane-run we:scripts/backlog.mjs verbs prepare-hold/prepare-stamp/prepare-release (prepare-stamp writes status(open)+preparedDate into the lane tree) plus a we:scripts/guard-lane.mjs carve permitting the stamp inside a lane clone, and rewrite the /prepare, /next-backlog-item, /resolve close-out prose to the (b) flow: hard local prepare-hold, enter lane, author body+research+status+preparedDate in-lane, land one PR, release the hold. Until this lands, /prepare runs the weaker (b-plain) reserve hold as the named interim.

## Scope

- **Local prepare-hold token.** A `we:queued.json`-adjacent local signal file (never pushed; read offline per Rule #105 — *Claim Ignores Git State*) that records `{ num, holder, leaseUntil }`. Lease **outlasts a real prepare** (or refreshes across the session) — NOT the 120-min reservation TTL. Reuse the #2138-Fork-4 queued-token guard at [we:scripts/backlog.mjs:151](../scripts/backlog.mjs#L151) as the pattern.
- **HARD exclusion.** Selection (`we:scripts/readiness/engine.mjs`) **skips** a prepare-held item exactly as it skips a queued/non-`open` item ([we:scripts/readiness/engine.mjs:65](../scripts/readiness/engine.mjs#L65)), and `claim` **refuses** it — a hard lock, not the soft `reserve` deprioritize.
- **Three lane-run verbs** on `we:scripts/backlog.mjs`: `prepare-hold <NNN>` (write the token), `prepare-stamp <NNN>` (write `status: open` + `preparedDate` into the **lane** item file), `prepare-release <NNN>` (drop the token). No item-file `status` splice ever touches the primary tree.
- **guard-lane carve.** `we:scripts/guard-lane.mjs` must permit the `prepare-stamp` item-file write **inside a `.lanes/` clone** (it is authored in the lane, landed via the one PR — the (b) direction), while still blocking a primary-tree stamp.
- **Close-out prose rewrite.** `/prepare` (prepare-decision-item), `/next-backlog-item`, `/resolve` skills: replace the primary-checkout `claim → … → release` dance with the (b) flow (hard local prepare-hold → enter lane → author body + research + `status`/`preparedDate` in-lane → land one PR → release the hold). Drop the item-file `status` primary splice from the taught path.

## Acceptance

- A concurrent `/next`/`--select` cannot select a prepare-held item (hard exclusion proven, not merely deprioritized).
- No item-file `status`/`preparedDate` write reaches the primary tree; all land via the one lane→PR.
- `check:standards` green; the three skills' close-out prose matches the ruling.

Codification: [we:platform-decisions.md#pr-flow-rollout-mechanism](../docs/agent/platform-decisions.md#pr-flow-rollout-mechanism) (the #2219 rider). The bare-`reserve` (b-plain) fallback is the interim until this ships.

## Resolution (2026-07-07)

Shipped the (b-strong) prepare-hold. Mirrors the #2138-Fork-4 queued-token exactly, plus a lease.

- **Token + pure lib** — `we:scripts/readiness/prepare-hold-state.mjs`: `{num, holder, leaseUntil}` holds, `isHeld`/`heldBy`/`heldNums` gated on a LIVE lease (`DEFAULT_LEASE_MINUTES = 480` — 8h, strictly > the 120min `reserve` TTL), self-pruning on write. Local token at `we:.claude/skills/batch-backlog-items/prepare-hold.json` (gitignored beside queued/reservations); read offline (Rule #105). Unit-proved (`we:scripts/readiness/__tests__/prepare-hold-state.test.mjs`, 9 tests incl. lease-expiry/refresh/corrupt-degrade).
- **Three lane-run verbs** on `we:scripts/backlog.mjs`: `prepare-hold <NNN> [--session] [--lease]` (write/refresh), `prepare-stamp <NNN>` (splice `status: open` + `preparedDate: <today>` into the lane item file), `prepare-release <NNN>` (drop).
- **HARD exclusion** — `we:scripts/check-readiness.mjs` drops every live-held item from `--select` surfaces (tierA/batchable/sliceable/tierB/filler) + a note; `claim` **refuses** a held item (`--force` steals). This lives at the CLI boundary (lease/time-dependent) beside the reservation filter, not in the pure `computeSelection` — the codebase's own architecture rule; the exclusion is EXCLUDE, not the soft `reserve` deprioritize.
- **Guard carve — realized in `we:scripts/guard-bash.mjs`, not `we:scripts/guard-lane.mjs`.** The ruling named guard-lane, but that hook only sees the Edit/Write tools; a `we:scripts/backlog.mjs` CLI splice runs via Bash, so the actual gate is guard-bash's `BACKLOG_MUTATION` set. `prepare-stamp` (the item-file splice) joins it → blocked from a primary cwd, allowed in a `.lanes/` clone (the (b) direction). `prepare-hold`/`prepare-release` write only the local token → stay OUT of the set (allowed anywhere, like `reserve`). Covered in `we:scripts/__tests__/guard-bash.test.mjs`.
- **Close-out prose rewritten to the (b) flow** — `/prepare` (prepare-decision-item SKILL: lane-note + step-3 `prepare-hold` + Close-out `prepare-stamp`→PR→`prepare-release`), `next-backlog-item` + `we:.claude/commands/resolve.md` lane-notes (drop the "#2219 being reconciled" residual), `we:docs/agent/backlog-workflow.md` (§ prepared-fork stamps via `prepare-stamp` in-lane), and the #2219 rider flipped **interim → shipped**. (`.claude/skills` is a symlink to `skills-src`, so one edit serves source + mirror.)

**DoD met:** a concurrent `--select`/`claim` cannot take a prepare-held item (proven); no item-file splice reaches primary (guard-bash-blocked; lands via the one lane PR); gate green; 1274 tests pass. Smoke-tested end-to-end (hold → claim-refused → select-excluded → stamp → release). graduatedTo none (no new standard entity).
