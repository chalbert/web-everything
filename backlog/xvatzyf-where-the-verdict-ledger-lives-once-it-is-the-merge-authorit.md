---
kind: decision
parent: "2405"
codifiedIn: "docs/agent/platform-decisions.md#state-lives-where-its-nature-dictates"
ratifiedBy: "Nicolas Gilbert (operator)"
status: resolved
dateOpened: "2026-08-20"
dateResolved: "2026-08-20"
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

## THE CALL (operator, 2026-08-20): **(b) — the `ops/review-requests` git transport**

Ratified as **A′** — option (b) plus three requirements the red-team forced. The bare (b) is not what was
adopted; these are part of the deliverable, not follow-ups.

### A′ — what is actually ruled

1. **The ledger JSONL lives on the `ops/review-requests` branch.** Durable, shared, readable from any clone
   with no credential — which matters because the recording host routinely has none. Vendor specifics stay
   in a git-backed io-shell, so `#2626`'s hard requirement holds and the eventual DO/D1 swap touches one file.
2. **`#2626` is amended in the same act.** A git transport is a FOURTH home its taxonomy does not name.
   Ratifying this decision IS that amendment — same operator, same ruling — and the deliverable includes
   writing the clause into `we:docs/agent/platform-decisions.md` with the migration trigger (`#2703`) stated.
   It is not a downstream approval to go and seek.
3. **Fetch-append-retry is an acceptance criterion, not future work**, with bounded retries and a LOUD
   failure on exhaustion — never a silent drop. A two-writer concurrency test must pass before the store may
   be called append-only and before the authority may flip.
4. **The durable comment is demoted to a MIRROR** rendered from the ledger row, exactly the clause `#3007`
   already applies to labels. One authority, two renderings, neither independently authored.

### The red-team, and what it changed

Two skeptic rounds through `we:skills-src/jury/panel-fanout.mjs` ($0.20 total). **The attack landed both
times**; the default was amended rather than defended.

**Round 1** — three findings, two `worseThanBase`:
- (A) concedes it is a fourth home `#2626` does not contemplate and proceeds anyway → became requirement 2.
- (A) admitted its concurrency gap as future work, rated `broken`: two verdicts landing together could
  silently drop one, *"recreating exactly the failure class #3007 is meant to close"* → became requirement 3.
- (A) would leave the branch ledger AND the durable comment as two parallel records that can diverge — the
  sharpest finding, and one this card had missed → became requirement 4.

**Round 2** — three findings against the amended form. Its stated principle: *"the amendments substitute
stated intent for verified artifacts."* Fair for a decision card, whose artifacts do not exist yet by
definition, but two points were folded in anyway: the `#2626` amendment was made part of THIS ratification
rather than a conditional external approval, and retry-exhaustion behaviour was specified (loud, never
silent).

**One round-2 finding is REFUTED on the facts.** It argued the ledger/mirror split is unsafe because
*"#3007's pattern works because the ledger and the label live on the same surface (GitHub)"*. They do not:
Phase 1's ledger is `~/.claude/verdict-ledger/` — a local file — while the label is on GitHub. The
cross-system non-atomicity it flags **already exists today** and is inherited, not introduced by A′. The
concern is real and `#3007`'s own posture answers it: a mirror disagreeing with the ledger is a display bug,
not a gate bug. Recorded rather than silently dropped.

A third round was not run. The remaining round-2 findings reduce to "the artifacts do not exist yet", which
is inherent to ratifying a direction — saying so plainly rather than implying the attack converged.

### Why not (a), (c) or (d)

- **(b) over (a) "wait for DO/D1"** — gated on `#2703`, which has not fired; Phase 2 would block indefinitely.
- **(b) over (c) "keep it local"** — preserves exactly the split brain this decision exists to close.
- **(b) over deriving from PR comments** — that needs the API to read, so a lane cannot answer "is this
  cleared?" offline, and it keeps the authority inside the same mutable GitHub surface whose mutability
  motivated `#3007`. Under A′ the comment survives as a rendering, so its cheapness is kept where it is safe
  (human reading) and dropped where it is not (the gate).

## Done when

`#2626`'s clause names the git transport as the interim home with its migration trigger; the ledger's
io-shell writes to `ops/review-requests` behind the existing pure core; the fetch-append-retry loop exists
with a two-writer concurrency test and a loud-on-exhaustion contract; and the durable comment is rendered
from the ledger row rather than authored beside it.
