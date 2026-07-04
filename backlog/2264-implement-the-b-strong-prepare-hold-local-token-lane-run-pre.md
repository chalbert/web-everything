---
kind: story
size: 5
status: open
dateOpened: "2026-07-04"
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
