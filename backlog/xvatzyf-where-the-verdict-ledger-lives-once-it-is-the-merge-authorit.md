---
kind: decision
parent: "2405"
status: open
dateOpened: "2026-08-20"
tags: []
---

# Where the verdict ledger lives once it is the merge authority

The verdict ledger is written to a machine-global path under the home directory, and the only writer that works on a credential-less host runs inside ephemeral CI, so every row it wrote today was discarded with the runner. Phase 2 makes that file the thing the drain merges on. The 2626 storage ruling names a third home, a shared durable store at product, and lists which sidecars migrate, but the verdict ledger is not on that list because it landed a week before the ruling. Classify it before the authority moves.



## What is actually true today

`verdictLedgerDir()` returns a **machine-global** path — `~/.claude/verdict-ledger/<owner>-<name>.jsonl`,
overridable only by `WE_VERDICT_LEDGER_DIR`. It is not in the repo and it is not shared.

That is fine while the ledger is an *observation*. Phase 2 of `#3007` makes it the thing the drain merges
on, and then the storage question becomes load-bearing:

- On a credential-less host the only writer that works is CI. `we:.github/workflows/apply-review-request.yml`
  runs the real `we:scripts/review-set-label.mjs` **on a GitHub runner**, with no `WE_VERDICT_LEDGER_DIR`, no
  cache and no artifact upload. Six verdicts were recorded that way in one session; every row went to the
  runner's home directory and was destroyed with it.
- The drain reads whichever copy is on **its** machine. If the clearing writer ran elsewhere, a ledger-based
  gate fails closed on everything.
- `npm run review:ledger-check` — the predicate `#3007` names as its evidence gate — needs `gh`, so it
  cannot be evaluated on the host that is doing the recording.

## Why this is a decision and not a build

`#2626` (ratified 2026-08-17) extended the two-home taxonomy with a **third home: a shared durable store at
product** (Durable Objects + D1 a settled lean), and was explicit that migration is **per-artifact by nature,
not lift-and-shift**. It names which sidecars migrate — the cleared-for-build queue, the jury ledger,
infra-blocked recovery — and which never do (advisory locks, lane-ports, the learnings drop-box).

**The verdict ledger is on neither list**, because `#3007`'s Phase 1 landed 2026-08-10, a week before that
ruling. So it was never classified, and the classification is exactly the open question.

The migration is also **gated on a tracked trigger** — the first session-free product surface needing
conveyor state with no main session present, concretely `#2703`. A merge authority that cannot be written
durably today cannot wait on that trigger, so this needs its own answer rather than inheriting one.

## The fork

- **(a) Classify it as a shared-truth sidecar and wait for the store.** Consistent with `#2626` as written;
  Phase 2 then blocks on `#2703`/`#2742`. Honest, and possibly a long wait for a gate we want sooner.
- **(b) Move it onto a git transport, like `ops/review-requests` already is.** Durable, shared, already
  proven on a credential-less host this very session, and readable by any checkout. Costs a push per verdict
  and puts operational state in a branch — which the `#2626` taxonomy did not contemplate.
- **(c) Keep it machine-local and constrain the authority.** Phase 2 flips only where the writer and the
  drain are co-located, and the credential-less path stays label-based. Smallest change; leaves the split
  brain that this whole item is about.

**(b) looks strongest** — the transport branch is the one durable, shared, vendor-free store this
constellation already operates, and `#2626`'s hard requirement is that vendor specifics stay in an io-shell,
which a git-backed shell satisfies trivially. But it is a genuine extension of a ruled taxonomy, so it is
the operator's call.

## Done when

The verdict ledger has a ruled home, `#2626`'s clause is amended to name it either way, and `#3007` Phase 2
is unblocked or explicitly re-gated behind `#2703`.
