---
kind: decision
status: open
dateOpened: "2026-07-03"
relatedTo: ["2123", "2138", "2200"]
tags: [lane, isolation, prepare, claim, release, session-tooling, pr-flow, decision]
---

# Reconcile the claim / release / preparedDate lifecycle with lane isolation (solo `/prepare`, `/next`, `resolve`)

**Residual of [#2123](/backlog/2123-should-a-solo-session-non-workflow-also-run-in-an-isolated-w/)** (ratified
2026-07-02: *every* edit-action session — solo `/prepare`, `/next`, `resolve`, `/workflow` alike — runs in an
isolated lane clone and lands via the PR/merge-queue flow, no content-session carve-out). #2123 ruled *that*
the work lanes; it did **not** reconcile the solo skills' **frontmatter lifecycle** with that isolation. The
close-out flows still describe the primary-checkout-era dance, and that dance now straddles two trees.

## The tension (concrete)

`/prepare`'s close-out (see `we:.claude/skills/prepare-decision-item/SKILL.md`, *Close out*) is:

1. `node we:scripts/backlog.mjs claim <NNN> --as=preparing` — a **sanctioned primary-tree frontmatter splice**
   (`we:scripts/backlog.mjs` is exempt from `guard-lane`; its `retype` docstring calls the CLI the explicit
   alternative to "a raw primary-tree Edit (no `LANE_GUARD_OFF`)").
2. Author the item **body** + write the `/research/` topic files — direct `Edit`/`Write` → **`we:scripts/guard-lane.mjs`
   blocks these on primary**, so they must happen in the **lane clone → PR**.
3. Stamp `preparedDate` via a raw frontmatter `Edit` — also `guard-lane`-blocked on primary → **lane/PR**.
4. `node we:scripts/backlog.mjs release <NNN>` (`preparing → open`) — sanctioned **primary** splice again.

So a single prepare session splits its durable output across **two trees**: `claim`/`release`/status live on
**primary** (via the CLI), while **body + research topic + `preparedDate`** can only land via the **lane PR**.
Two failure modes follow:

- **Divergence.** After the lane PR lands on `main`, the **primary** item file still carries the old body and no
  `preparedDate` (primary is never `git pull`ed — memory: *never git pull in the primary*). The primary working
  tree now disagrees with `main` on the very item just prepared.
- **Vestigial bracket.** `claim(preparing)` + `release(open)` **cancel** to a net-zero status delta; the only real
  durable change is *body + research topic + `preparedDate`* — all atomically landable in **one lane PR**. So the
  primary-side claim/release bracket may be doing nothing that the lane + a reservation side-file
  (`we:.claude/skills/batch-backlog-items/claims.json` / `we:.claude/skills/batch-backlog-items/reservations.json`,
  which already carry ownership per Rule #105 *claim ignores git state*) doesn't already do.

The same straddle exists, more weakly, for a solo `/next` build (claim → body in lane → `resolve`) and for
`resolve` itself (a `decision`'s `resolve` also splices frontmatter + writes `codifiedIn`).

## Axis to decide

Where does the frontmatter **lifecycle** live for a lane-isolated solo session — and does the CLI claim/release
bracket survive at all?

- **Option (a) — keep the split, reconcile it.** `claim`/`release` stay CLI-on-primary as an *early concurrency
  signal* (visible before the lane exists); body + `preparedDate` ride the lane PR; define who reconciles the
  primary divergence (drain re-splices? a post-land `we:scripts/backlog.mjs sync <NNN>`? the guard tolerates it?).
- **Option (b) — vestigial bracket; everything rides the PR.** The lane + reservation side-file *is* the
  concurrency signal; **all** frontmatter transitions (status *and* `preparedDate`) are authored in the lane and
  land in the one PR. `claim`/`release` on the item's own frontmatter drop out of the solo-lane flow (they remain
  for the pre-lane reservation only). Cleanest net state on `main`, no primary divergence — at the cost of losing
  the on-primary "someone is preparing this" cue during the (short) prepare window.
- **Option (c) — hybrid / new CLI verb.** e.g. a `we:scripts/backlog.mjs prepare-stamp` that the *lane* runs so the
  whole lifecycle is one code path regardless of tree, with the reservation carrying concurrency.

## Downstream (whichever way it rules)

The `/prepare`, `/next-backlog-item`, and `/resolve` skills' close-out prose must be **rewritten to match** — they
currently teach the primary-checkout dance with no mention of the lane split. (A separate, already-made cheap edit
adds a *front-load* "enter a lane first (#2123)" pointer to the top of those skills; it does **not** resolve this
lifecycle seam.)

**Not yet prepared** — `/prepare 2219` should survey how the `/workflow` parallel path already handles item-status
transitions (it lands status changes *in* the lane commit via `we:.claude/skills/batch-backlog-items/claims.json` +
the WE-lane resolve, per #2138), then shape the fork with a bold default before the call.
