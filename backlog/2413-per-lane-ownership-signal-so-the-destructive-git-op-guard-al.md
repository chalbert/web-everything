---
kind: decision
size: 5
status: resolved
dateOpened: "2026-07-10"
dateStarted: "2026-07-11"
dateResolved: "2026-07-11"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#lane-ownership-minted-slug-per-op"
preparedDate: "2026-07-10"
crossRef: { url: /backlog/2367/, label: "#2367 — destructive-git-op guard" }
relatedReport: reports/2026-07-10-per-lane-ownership-signal-parallel-workflow-lanes.md
tags: [lane-pool, guard, workflow, orchestrator]
---

# Per-lane ownership signal so the destructive-git-op guard also protects parallel /workflow lanes

## Grounding digest

The #2367 guard (PR #342) denies a destructive git op — `git reset --hard`, `git clean -f[d]`,
discard-`checkout`/`restore`/`switch`, force-push — when the op's cwd is inside a `.lanes/<repo>/lane-N/`
clone whose **live lease** is held by *another* session (we:scripts/guard-bash.mjs:253, deciding via
`isForeignLease`, we:scripts/lib/lane-lease.mjs:96-100: foreign iff `lease.ownerSession !== mySessionId`,
both sides keyed on `CLAUDE_CODE_SESSION_ID`; degraded ⇒ fail-open). This protects the **serial** topology
(the 2026-07-09 incident) but not the **parallel `/workflow`** topology, for a primary and a secondary
reason, both re-verified 2026-07-10:

1. **Parallel lanes carry no lease at all.** The orchestrator
   (we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js:222,339-347) provisions pools and
   couples item↔lane **by position** — zero `acquire` call sites; `provision`/`refresh` write no marker
   (we:scripts/lane-pool.mjs:482-517). `isForeignLease` reads the absent lease as `null` ⇒ the guard
   fails open with nothing to check.
2. **No ambient signal distinguishes siblings** (empirically re-verified: a spawned subagent printed the
   parent's `CLAUDE_CODE_SESSION_ID` verbatim; `CLAUDE_CODE_CHILD_SESSION` is the constant `"1"`;
   ancestry over-matches by construction; shell exports don't survive across an agent's separate Bash
   calls — we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js:358-359). So a naive
   lane-agent `acquire` would stamp the *shared* session id as `ownerSession`, making **every sibling
   read as owner in every lane of the batch**.

**Framing correction over the original card:** the **command string** is the only per-op channel that
carries **holder (lane-coupling) identity with both ends in-repo** — the orchestrator authors it, and
only the guard reads it, already parsing per-op assertions out of it (`LANE_CLOBBER_OK=1`,
we:scripts/guard-bash.mjs:253; `STALE_LANE_OK=1`, we:scripts/guard-bash.mjs:238). (One ambient
per-*subagent process* channel also exists at the guard — the hook payload's `agent_id`, experimental,
Claude Code ≥ 2.1.196, payload-only, unprobed for this repo's workflow-spawned agents; it is named and
excluded as Fork 2 (c) below.) So the card's "a change to the lane-dispatch machinery, **not** to the
guard" and its acceptance "a **sibling**'s destructive op is **denied**" cannot both hold: sibling-level
denial requires a small guard-side comparison extension. Fork 2 makes that trade the explicit call.

Prior art (fencing tokens per Kleppmann; Kubernetes Lease `holderIdentity`; `git worktree lock` as the
unchecked negative case; pid-file/flock failure modes; GitHub Actions `concurrency` groups; GNU Make's
jobserver) converges: identity is a **minted string per logical holder**, carried **with each
operation**, checked **by the arbiter at the point of use** — never inferred from an inherited ambient
property. See [/research/](/research/) topic `per-lane-ownership-signal-parallel-workflow-lanes` and the
grounding report (frontmatter `relatedReport`).

## The axis

Everything below hangs on one axis: **where the per-lane identity is minted, stored, and checked.** The
mint can only be the dispatch (the orchestrator authors both the coupling and every lane prompt —
`laneKeyOf`/`laneRefFor` already mint a deterministic per-lane key,
we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js:202-208). The store can only be the
lease file (the one artifact the guard already reads, we:scripts/lane-pool.mjs:533-563 — note
`tryClaimLane` keys self-recognition on the **`session` slug**, we:scripts/lib/lane-lease.mjs:111-113, so
distinct per-lane slugs already give `acquire`-level mutual exclusion with no new code). What genuinely
forks is (1) **which mechanism stamps the lease** and (2) **what the guard compares when `ownerSession`
cannot tell siblings apart**.

## Recommended path at a glance

| Fork | Question | Recommended | Main alternative (excluded because) |
|---|---|---|---|
| 1 | Where does the per-lane lease-stamp live? | **(a) each lane's step-1 prep becomes `acquire --lane=N` with a per-lane `LANE_SESSION` slug** | (b) orchestrator-side stamp at provision/coupling — new lane-pool surface, duplicates coupling state, leaves the manual destructive prep in place |
| 2 | What does the guard compare when `ownerSession` can't distinguish siblings? | **(b) per-op slug assertion parsed from the command string, fail-closed in marked lanes** | (a) session-level only — guard untouched but sibling clobber stays open; fails this item's acceptance |

## Fork 1 — where the per-lane lease-stamp lives

*Fork-existence: exactly one mechanism must own the stamp — two writers collide on the `O_EXCL` marker
and split-brain the release; and "no stamp" is the named broken branch (the guard keeps failing open on
the absent lease — the hole this item exists to close).*

- **(a) In-lane acquire — each lane agent's step-1 prep becomes an explicit-lane `acquire` (default).**
  The lane prompt's manual `git fetch && git reset --hard origin/main && git clean -fd`
  (we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js:371-375) is replaced by:

  ```bash
  # step 1 of the lane prompt (authored by the orchestrator, per lane):
  LANE_SESSION=<batchSlug>-<laneKey> node scripts/lane-pool.mjs acquire \
    --lane=<idx> --purpose=workflow-lane --json
  ```

  `acquire --lane=N` already does the *entire* prep — claim, fetch, `reset --hard`, `clean -fd`,
  lane-env, deps (we:scripts/lane-pool.mjs:589-634) — and **fails loudly** if the lane is live-held (the
  base #2275 allocator refusal, we:scripts/lane-pool.mjs:594-604; #2337 (b) additionally guarantees
  `--force` can't bypass it), turning a mis-coupled or contended lane into a clean per-item carry instead
  of a clobber. The orchestrator's own modulo-wrap fallback makes this live today: when the pool is
  shorter than the item list, `pool[idx % pool.length]`
  (we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js:344) couples two siblings to the
  *same* lane by construction — under (a) the second `acquire` hard-fails into a carry instead of both
  resetting each other. The lease appears at exactly the moment the lane starts, and the distinct
  `session` slug gives `acquire`-level sibling exclusion for free. **Skeptic-forced riders (all part of
  this option's shape):**
  - **Short TTL.** The default 240-min lease (we:scripts/lib/lane-lease.mjs:27) has no heartbeat and no
    release on agent death — an *anticipated* outcome (the died→carried catch,
    we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js:493). A crashed batch re-run mints
    a new `batchSlug`, so its acquires deterministically hard-fail on the same lanes until the stale
    reclaim — up to 4 h of lockout where today's manual reset just proceeds. The workflow-lane acquire
    passes `--ttl-minutes` sized to a lane's realistic runtime (~60–90 min). (Compositional neighbor,
    not a collision: the #2138 Fork-3 rider rejects long-held leases for the same
    expires-or-wedges dilemma.)
  - **Explicit release in the template close-out** — a `release --lane=<idx>` step carrying the *same*
    slug inline (`LANE_SESSION=<slug>`), else `defaultSession()` falls back to `hostname:ppid`
    (we:scripts/lane-pool.mjs:398) and release refuses its own lease.
  - **Acquire per affected repo.** Step 1 today resets the impl-repo clones too
    (we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js:374-375); the acquire must run
    with `--repo=<sibling>` per impl repo (each with its own lane index), or
    frontierui/plateau-app lanes stay unprotected while WE lanes are — `laneRootFromCwd`
    (we:scripts/guard-bash.mjs:83) matches them all.
  - **Pinned invocation cwd.** Run the acquire from the primary (or with explicit `--repo=`), not from
    inside the lane — run in-lane, `resolveRepo` makes the lane its own reference path and `unmapLanes`
    writes the lane's own port registry instead of the primary's (we:scripts/lane-pool.mjs:299,631),
    and the lane's possibly-stale script copy executes.
- **(b) Orchestrator-side stamp at provision/coupling.** A new verb (e.g. `assign --lane=N
  --session=<slug>`) or a provision flag writes all coupled leases up-front. Excluded as default: it adds
  new allocator surface that duplicates the coupling state the workflow script already owns, and it
  leaves the manual destructive step-1 prep in place — the exact op class the guard watches. (An earlier
  draft also charged (b) with stranding leases on a crash between provision and dispatch; the skeptic
  struck that as asymmetric — (a)'s acquire→release window is wider — so (b)'s exclusion rests on the two
  grounds above.)
- **(c) No stamp (status quo).** Broken branch — named for the fork-existence test only.

`Skeptic:` SURVIVES-WITH-AMENDMENT — the attack it beat: "acquire fail-louds where the manual reset
succeeded" (explicit-lane acquire skips the dirty/ahead check, we:scripts/lane-pool.mjs:589-605 — parity
with the manual reset, not a regression; and acquire's internal reset is node-side, invisible to the
Bash-string guard, so Fork 2 (b) can never deny it). The attack it did not beat: crashed-batch lockout
under the 240-min TTL → the four riders above are now part of the default.

`Screen:` clear — fresh-context two-confusion screen (2026-07-10): the branches differ observably at the
template/CLI/guard contract (fail-loud carry vs mutual clobber on the real modulo-wrap collision), and
the merit gap survives with both branches free to build (option (a) removes the destructive op class
from the template; option (b) keeps it and adds a second writer of coupling state).

## Fork 2 — what the guard compares when `ownerSession` cannot distinguish siblings

*Fork-existence: the guard has exactly one posture for a lease the parallel dispatch stamped —
"`ownerSession` match suffices" and "`ownerSession` match does not suffice" are mutually exclusive
semantics for the same marker. The empirical constraint (siblings share every ambient **env/process**
id) rules out `isForeignLease` alone telling siblings apart; the one ambient third channel that does
exist mechanically — the hook payload's per-subagent `agent_id` — is named and excluded as option (c)
below, not ignored.*

- **(a) Session-level ownership only — guard untouched.** The Fork 1 lease's `ownerSession` is the
  shared top-level session id, so the guard denies **other top-level sessions** (the actual 2026-07-09
  incident class: a concurrent `/slice`, `/drain`, `/prepare`) but treats every sibling as owner in every
  lane. Sibling-vs-sibling protection remains prompt discipline. Honest scope: closes the cross-session
  hole only; **this item's acceptance bullet 1 must then be consciously downgraded** from "sibling op
  denied" to "foreign-session op denied".
- **(b) Per-op slug assertion, fail-closed in marked lanes (default).** The parallel lease marks itself
  as a workflow lane. For a destructive git op whose cwd is a lane holding a **live marked** lease, the
  guard requires the command string to assert the lease's own slug — parsed exactly like the existing
  escapes at we:scripts/guard-bash.mjs:253 — and denies on mismatch **or absence**:

  ```bash
  # sanctioned destructive op inside a marked lane — asserts the lane's own slug:
  cd <lane-3> && LANE_SESSION=<batchSlug>-<laneKey> git reset --hard origin/main
  # sibling pasting its own template asserts ITS slug → mismatch → DENIED
  # ad-hoc op with no assertion → DENIED (fail-closed; escape: LANE_CLOBBER_OK=1)
  ```

  This is the fencing-token pattern the prior art converges on (identity minted per holder, asserted per
  op, checked at the arbiter). Enumerated against the real template (steps 1–8): under Fork 1 (a) the
  lane prompt contains **zero** guard-visible destructive ops — the prep folds into `acquire` (node-side,
  invisible to the Bash-string match), `commit --amend` is not in the danger table
  (we:scripts/guard-bash.mjs:147-161), pr-land's pushes are node-internal, and the drain's auto-pick
  skips live-leased lanes (we:scripts/lib/lane-lease.mjs:45-61) — so fail-closed costs nothing on the
  sanctioned path. Costs, stated for the decider: a small guard extension (contradicting the card's
  original "not the guard" line — see the framing correction above), and fail-closed friction on a
  lane's own *ad-hoc* destructive ops (the owner re-asserts its slug, or uses the existing
  `LANE_CLOBBER_OK=1` escape). Trust model is unchanged: like `LANE_CLOBBER_OK=1`, this fences
  honest-mistake confusion, not an adversary. **Skeptic-forced riders (part of this option's shape):**
  - **Precedence over the degraded path.** The slug comparison needs no session id, so for a **marked**
    lease the guard fails closed even when `CLAUDE_CODE_SESSION_ID` is absent — the marked check runs
    *before* (and independent of) the `ownerSession` compare. The no-id fail-open guarantee is thereby
    rescoped to **unmarked** leases (see Acceptance).
  - **The marker is a contract field, not free text.** `purpose` is an informational flag today
    (we:scripts/lane-pool.mjs:543, rendered by `describeLease`); flipping guard posture on a typed string
    would turn a debug label into semantics. Add a dedicated lease field (one line in `leaseBody`,
    we:scripts/lib/lane-lease.mjs:71-76 — e.g. `workflowLane: true`), set by the workflow-lane acquire.
    This spends the "zero new lane-pool surface" claim honestly: one field, no new verb.
  - **The deny message teaches the recovery** — it names the expected slug (or at least the
    `LANE_SESSION=<this lane's slug>` re-assert idiom). In the honest-mistake threat model disclosing the
    token is fine: forcing the operator to read *which* lane they're in **is** the check.

  Citation note (skeptic): the acquire idiom comment (we:scripts/lane-pool.mjs:521-522) is **spelling
  precedent only** — it teaches a per-session `export`, which provably cannot survive a lane agent's
  separate Bash calls; (b) inverts it into per-op inline carriage, a new discipline the template must
  teach explicitly.
- **(c) Hook-payload `agent_id` ownership — named and excluded (probe-gated).** The Claude Code hooks
  docs ("Subagent Identification"; experimental, ≥ 2.1.196) give the PreToolUse payload a per-subagent
  `agent_id` on subagent tool calls — an ambient channel at the guard that *mechanically* distinguishes
  siblings with zero command-string discipline. Excluded on four grounds (round-2 skeptic, 2026-07-10):
  (1) **the mint/check split is unbridgeable** — the one process that can atomically stamp ownership
  (`acquire`, the O_EXCL write, we:scripts/lane-pool.mjs:533-545) is a Bash subprocess that cannot see
  the payload-only `agent_id`, while the one observer that can see it (the PreToolUse hook) fires
  *before* acquire's outcome exists — a sidecar recorded pre-outcome is poisoned by the live modulo-wrap
  collision (loser recorded as owner ⇒ the true owner denied in its own lane); (2) **retry lockout** — a
  replacement agent (the anticipated died→carried path) has a new `agent_id` and is denied in its own
  lane; (3) **silent degradation** — absent/renamed `agent_id` (experimental field, unprobed for
  workflow-spawned agents here) falls back to the shared `ownerSession` ⇒ sibling ops *allowed* while
  the item claims sibling denial — fail-open in the one place it matters, the exact r2 pid-ancestry
  pattern (we:scripts/lib/lane-lease.mjs:80-93), and the inversion of (b)'s hardest-won fail-closed
  rider; (4) **the guard becomes a state-writer** — a new failure class (a command that merely *mentions*
  acquire corrupting ownership state) plus a second ownership file duplicating the lease's TTL/cleanup
  machinery. **Collapse argument (recorded so re-litigation doesn't reopen it):** any repair that routes
  `agent_id` through the command string *is* option (b) with a harness-owned, experimental token instead
  of a repo-minted slug — strictly worse. Prior-art check: `agent_id` is process identity (pid-shaped:
  ambient, ephemeral, third-party-owned) — the branch the survey already closed in principle.

`Skeptic:` SURVIVES-WITH-AMENDMENT — the attack it beat: "fail-closed breaks the lane's legitimate
mid-work destructive ops" (enumeration of the real template found zero guard-visible destructive ops on
the sanctioned path, and the drain is never denied its own prep). Amendments folded: marked/no-id
precedence defined + acceptance bullet 3 rescoped, marker hardened to a dedicated lease field, deny
message teaches the re-assert.

`Skeptic (round 2):` FLIP-REFUTED — after landing, the hook-payload `agent_id` channel surfaced (via the
concurrent PR #402's `ev.session_id` hint + a docs check) and falsified the original "command string is
the *only* per-op channel" absolute; a proposed default-flip to a new option (c) built on it was
attacked and **refuted** (mint/check split unbridgeable; silent fail-open degradation = the r2 pattern).
Resolution: premise rescoped to "only channel carrying *lane-coupling* identity with both ends in-repo",
(c) added as a named, probe-gated excluded branch above, **default stays (b)**.

`Screen:` clear — fresh-context two-confusion screen (2026-07-10): the branches produce opposite guard
verdicts on the same sibling op (contract level, not an internal encoding), and option (a) is a
permanently different protection scope with its own merit (no fail-closed friction, simpler degraded
semantics), not "build (b) later" — the guard-extension cost appears only as a priced trade, not as the
deciding axis.

## Supported by default (not forks)

- **Release lifecycle** — the lane agent releases at its close-out (the explicit slug-carrying release
  rider under Fork 1 (a)); a crashed lane's lease expires via the shipped stale-reclaim
  (we:scripts/lib/lane-lease.mjs:33-39) at the shortened workflow TTL. No new mechanism; both Fork 1
  options inherit it.
- **Serial topology + degraded fail-open on unmarked leases** — unchanged under every combination above
  (acceptance bullets 2–3 are constraints on both forks, not forks).
- **Identity spelling** — `<batchSlug>-<laneKey>` (`laneKeyOf`,
  we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js:202-208): deterministic, already
  minted, unique per lane within a batch and across concurrent batches (the batch slug embeds the date
  and run).

## Ruling (ratified 2026-07-11)

Both defaults ratified as prepared, all skeptic riders included:

- **Fork 1 → (a) in-lane acquire.** Each parallel lane's step-1 prep becomes an explicit-lane
  `acquire --lane=N` with the per-lane `LANE_SESSION=<batchSlug>-<laneKey>` slug, replacing the manual
  destructive prep. Riders: short TTL (~60–90 min), explicit slug-carrying release in the close-out,
  acquire per affected impl repo, invocation pinned to the primary (or explicit `--repo=`).
- **Fork 2 → (b) per-op slug assertion, fail-closed in marked lanes.** The workflow acquire sets a
  dedicated `workflowLane` lease field; for a live marked lease the guard requires the command string to
  assert the lease's own slug and denies on mismatch or absence, with precedence over the degraded no-id
  path (rescoping fail-open to unmarked leases) and a deny message that teaches the re-assert idiom.
  Option (c) (hook-payload `agent_id`) stays excluded per the round-2 refutation.

Pre-ratification red-team (this session) re-attacked both defaults — Fork 2 (a)'s "the observed incident
was cross-session" fails against the by-construction modulo-wrap sibling collision; Fork 1 (b)'s
"orchestrator stamp is one atomic writer" fails on duplicated coupling state + retained destructive
prep. No new amendments. Successor build: #2427.

## Acceptance

- A destructive git op run in a **sibling** parallel lane's clone is **denied** by the guard
  (delivered by Fork 2 (b); under Fork 2 (a) this bullet is consciously downgraded to foreign-session
  denial — part of what ratification decides).
- The **owning** lane's own destructive ops still **pass** (Fork 2 (b): template-authored ops carry the
  lane's slug assertion; Fork 1 (a) removes most raw destructive ops from the template entirely by
  folding the prep into `acquire`).
- The serial-session case and the degraded no-id fail-open behavior are **unchanged for unmarked
  leases** (all of today's leases). For a **marked** workflow lease under Fork 2 (b), fail-closed
  deliberately supersedes the no-id fail-open — the slug check needs no session id (the skeptic-forced
  precedence rider).
