---
bornAs: x3gvcun
kind: story
size: 5
parent: "3029"
status: open
scope:
  - we:scripts/operations/dispatch-lane.mjs
  - we:scripts/operations/dispatch-lane-io.mjs
  - we:scripts/operations/wake.mjs
  - we:scripts/operations/__fixtures__/claude-agents-payload.json
  - we:scripts/operations/__tests__/
scopeRationale: "File-level for the three modules the five hardenings edit — stampLiveness and createDispatchObservers in we:scripts/operations/dispatch-lane-io.mjs, assertHandleNotLive in we:scripts/operations/wake.mjs, dispatchStillHolds and the two grace constants in we:scripts/operations/dispatch-lane.mjs — plus the one fixture they are checked against. The tests directory stays directory-level on purpose: the mutation tests land in the existing dispatch-lane and wake test files, but the non-empty-but-unmatchable case may want a new file whose name is not determined yet, and an under-scope there would breach the lease at build time. we:scripts/operations/explore-io.mjs is deliberately NOT in scope — see Not in scope."
dateOpened: "2026-08-26"
preparedDate: "2026-08-26"
relatedTo: ["3096", "3037", "3097", "3102", "3110", "3331", "3095"]
tags: [plateau-loop, delivery, operations, conveyor, dispatch]
---

# Harden the three claude-agents liveness readings, then make the first live dispatch

Land the five liveness-reading hardenings reassigned from PR #1211's round-3 review, and fire the FIRST real
dispatch through the declared `dispatch-lane` operation end to end.

## Where this came from — the `scripts/operations/` half of #3096

**Split off [#3096](3096-route-the-conveyor-s-build-dispatch-through-the-declared-dis.md) on 2026-08-26.**
#3096 absorbed #3147 and #3239 the day before (PR #1599) and came out at `size: 8`, sitting ON the split bar
while carrying two unrelated bodies of work behind its two `scope:` entries. This card takes the
`we:scripts/operations/` entry; #3096 keeps `we:skills-src/conveyor/` and its own title, number and slug.

**#3096 keeps the number on purpose, even though most of its 16 inbound citations point at THIS half.** Its
title *is* the skill rewiring ("Route the conveyor's build dispatch through the declared dispatch-lane
operation") and its slug is frozen in its filename, so making it the hardening card would have meant either a
misleading title on every `#3096` short-ref or a refile — and a refile is the move that manufactures dangling
links. #3096 instead carries a routing table naming which of its citers now want which half. Nothing was
repointed; every existing `#3096` still resolves to a live card that says where its half went.

## The risk, stated plainly

`stampLiveness` and its two siblings trust the *shape* of `claude agents --json` on a surface nothing in the
repo has ever observed. If the listing ever comes back in a shape the code does not expect, the guard reads it
as "the agent is dead" and dispatches a SECOND agent onto the same lane about two minutes later — while the
verdict still reports `dispatchLiveness: 'claude-agents'`, the label for "checked against a real listing and
found clear." **The failure looks like the strong guard, not like a degraded one.**

The round-3 independent review of #3037's PR (#1211) accepted with this as a named residual: it ruled the fix
could not be made honestly blind — a fourth guess at an unverified CLI surface — and reassigned it to wherever
the payload becomes real. That is here. Full finding: H1/H2 of the round-3 review on PR #1211.

## Every line below was RE-READ at `origin/main` `c8d92db7` on 2026-08-26

None of the five fixes has landed; that was checked by grepping for the identifiers each one would introduce.
The coordinates match #3096's (which were taken at `9f9cb310`) — these files did not move between the two
commits — except for **two claims of #3096's that were wrong and are corrected here**:

- **#3096 said "no `__fixtures__/` directory exists under `we:scripts/operations/`".** False, and it was false
  when written. `scripts/operations/__fixtures__/` has existed since `b1c154ee` (2026-08-14, #3095's PR) and
  holds `we:scripts/operations/__fixtures__/fixture-operation.mjs`, `we:scripts/operations/__fixtures__/observe-dispatch.mjs` and
  `we:scripts/operations/__fixtures__/resume-run.mjs`. It was present at `9f9cb310` too
  (`git cat-file -t 9f9cb310:scripts/operations/__fixtures__` → `tree`). The true form of the claim is that the
  **file** `we:scripts/operations/__fixtures__/claude-agents-payload.json` does not exist — which is what `we:audits/backlog-health-audit.md:571`
  has been reporting as a dangling citation against #3096 all along.
- **#3096 enumerated three call sites and then said "all four compare sites".** The fourth it meant was the
  `listed` Set path inside `stampLiveness`, which is a different shape (`listed.has(...)`, not `=== handle`).
  There is a genuine, unnoticed fourth *file*: **`we:scripts/operations/explore-io.mjs:822`** carries the
  identical hole — `sessions.some((s) => s && String(s.sessionId) === handle)` behind the same bare
  `!Array.isArray` guard, with no non-empty-but-unmatchable branch. It is **deliberately NOT fixed here** (see
  *Not in scope*).

## Prepared 2026-08-26 — everything below was re-run at `origin/main` `916dec98`

The split's coordinates were taken at `c8d92db7`. They were **re-run**, not re-read, at `916dec98` in lane
`.lanes/web-everything/lane-1`. Four things changed and one large thing was settled.

### All five counts still fail — none of the five hardenings has landed

| # | command | at `c8d92db7` | at `916dec98` | still fails |
| --- | --- | --- | --- | --- |
| 1 | `test -f we:scripts/operations/__fixtures__/claude-agents-payload.json` | MISSING | MISSING | yes |
| 2 | `grep -c "livenessSource: 'unreadable'" we:scripts/operations/dispatch-lane-io.mjs` | 2 | 2 | yes |
| 3 | `grep -rn '=== handle' we:scripts/operations/dispatch-lane-io.mjs we:scripts/operations/wake.mjs \| wc -l` | 2 | 2 | yes |
| 3 | `grep -c 'listed.has(String(' we:scripts/operations/dispatch-lane-io.mjs` | 1 | 1 | yes |
| 4 | `grep -rl lastSeenLiveAt scripts/operations/ \| wc -l` | 0 | 0 | yes |
| 5 | `grep -rl DISPATCH_GUARD_LISTING_GRACE_MINUTES scripts/operations/ \| wc -l` | 0 | 0 | yes |

Every line coordinate in the section above also still resolves: `stampLiveness` at
`we:scripts/operations/dispatch-lane-io.mjs:326`, its `unreadable` return at **338**, `listed` built at **340**,
`listed.has` at **342**; `createDispatchObservers` at **753** with its exact-match at **811**;
`assertHandleNotLive` at `we:scripts/operations/wake.mjs:319` with its `.some()` at **340**;
`DISPATCH_LISTING_GRACE_MINUTES` at `we:scripts/operations/dispatch-lane.mjs:131`, `dispatchStillHolds` at
**344** with its default at **347** and its in-body fallback at **360**. `we:scripts/operations/explore-io.mjs:822`
still carries the out-of-scope fourth site, exactly as described.

### The blocking edge to #3096 HOLDS — verified in the code, not from the card

`we:skills-src/conveyor/SKILL.md` steps 3 and 3b still say *"Spawn it as **one background `Agent`**"* — the
harness tool, not this operation. `grep -rn "dispatch-lane" skills-src/ scripts/conveyor/` returns only the
`@operation-home-ok` marker at `we:skills-src/conveyor/SKILL.md:77` and two unrelated `defaultListAgents` importers
(`we:scripts/conveyor/reconcile-pass.mjs:47`, `we:scripts/conveyor/lease-reaper.mjs:74`). **No production
caller routes through `dispatch-lane`**, so the un-hardened guard is unreachable today and #3096's safety
argument is intact. Keep `blockedBy: ["3353"]`.

*(One dangling hop, harmless and named so it is not mistaken for a break: resolved #3037's acceptance says the
live-dispatch clause is "REASSIGNED to #3096" at `we:backlog/3037-*.md:173`. The split moved that clause to
THIS card. It resolves in one extra hop through #3096's routing table, which is what that table is for —
nothing to repoint.)*

### The real payload was captured — at zero cost, and it moves three of the five

`claude agents --json` is a **read-only listing**. It needs no dispatch, starts nothing and spends no tokens. It
was run in this lane against **`claude` 2.1.246 (Claude Code)** and returned **19 elements**. That is the whole
of hardening 1's input, and it is available today:

- **`sessionId` is present on all 19 rows**, as a **lower-case v4 UUID**. The `#3030` spike's field name is
  CORRECT. H1's first way in — "the shape is asserted, never observed" — is now observed and is not a defect.
- **Three distinct element shapes appear in ONE listing.** 4 rows are
  `cwd+id+kind+name+sessionId+startedAt+state`; 3 add `pid+status+waitingFor`; **12 rows carry neither `state`
  nor `status` nor `id` at all** — just `cwd+kind+name+pid+sessionId+startedAt`. A fixture that pins one shape
  pins the wrong thing; pin all three.
- **`id` is optional and is NOT reliably the `sessionId` prefix.** It is absent on 12 of 19 rows. Nothing
  should read it.
- **The listing includes `kind: "interactive"` sessions**, not only backgrounded ones, even though
  `defaultListAgents` deliberately passes no `--all`.

**Two hardenings must be re-justified in light of this, not dropped:**

- **Hardening 3 (case tolerance) has no observed defect behind it.** Every id in the listing is already
  lower-case, so H1's case G is drift-defence, not a live bug. Land the normalization anyway — it is free and
  the failure it prevents is a double-dispatch — but the docblock must say *"the observed CLI emits lower-case;
  this normalizes so a future one that does not cannot turn every dispatch into a double-dispatch"*, NOT that a
  case mismatch was seen. Asserting an unobserved defect is the exact recurring flaw the round-3 review closed on.
- **Hardening 2's new branch is UNREACHABLE against CLI 2.1.246.** Every row has a usable `sessionId`, so
  `listed.size === 0` after the filter cannot happen with this CLI. That does not make the branch wrong — it is
  fail-closed cover for a shape nobody has seen — but it means **the mutation test of Done-when 6 is its only
  possible cover, and no live run can ever exercise it**. Say that in the test's own comment so a later reader
  does not go looking for the real listing that reddens it.

### The permission-prompt stall is NOT hypothetical — it is this host's steady state

The card names it as a class of defect only a live run can catch. The live listing already caught it. **Seven
conveyor background sessions on this host are stalled with `"waitingFor": "permission prompt"`**, `state:
"blocked"`, `cwd: /Users/nicolasgilbert/workspace/webeverything`. The oldest — `name: "conveyor-3154"` — has
been blocked for **13,476 minutes (9.4 days)**. Ages of the seven, in minutes: 13476, 13415, 13109, 13108,
13108, 13106, 1485.

That is verbatim the G1 failure this guard exists to prevent — *"a background session stalled on a permission
prompt is ALIVE, holds no lane lease and has claimed no item"* — running right now, at scale, on the machine
the live dispatch will run on. Two consequences, both binding on the live run:

1. **`WE_DISPATCH_AGENT_ARGS` MUST set a non-prompting permission mode before the dispatch.** Unset means no
   extra flags (`we:scripts/operations/run.mjs:150-155`, deliberate). A dispatch fired unset will, on this
   host's evidence, stall at its first `bash` — which is inside a `$( … )` in brief step 1, *before*
   `lane-pool acquire`. The scope-lease half of the acceptance would then be unreachable while the handle reads
   `live: true` forever.
2. **A stalled agent still satisfies four of the five observations** (started, handle recorded, handle found by
   `stampLiveness`, resumable after kill) and costs almost nothing, because it stops before it works. Only the
   scope-lease observation needs the agent to get past step 1.

*(Not fixed here and not this card's business: those seven stalled sessions are old conveyor spawns from the
hand-spawn path, not from this operation. Flagged for the operator.)*

### The gate baseline moved, and its one error is GONE

`npm run check:standards`, run plainly and **twice** in this lane at `916dec98`:

```
run 1: 0 error(s), 1447 warning(s)   exit 0
run 2: 0 error(s), 1447 warning(s)   exit 0
```

Byte-identical across both runs — **no loader non-determinism at this commit**, because the malformed card that
caused it is gone. `backlog/3350-*.md`'s stranded hash was healed at land by the drain's JIT-numbering
(`fad31663 drain: JIT-number 3350→#3350 at land (#2288)`). The *Not in scope* note about it and Done-when 8's
parenthetical are stale and are corrected below. **There is no longer a stranded-hash heal to accidentally
bundle.** Re-measure at build time anyway; the warning count moves most days (1438 → 1447 in one day).

### H3 landed, and hardening 5 falsifies its comment

The round-3 review's H3 (the `LISTING_GRACE_MS` derivation asserted by nothing) is **already satisfied** —
`we:scripts/operations/__tests__/dispatch-lane-defaults.test.mjs:188-197` pins
`expect(LISTING_GRACE_MS).toBe(DISPATCH_LISTING_GRACE_MINUTES * 60_000)`. It is correctly **not** one of the
five. But its comment at **:190-191** says the derivation exists *"so the pure guard's own copy of the same
window (`we:scripts/operations/dispatch-lane.mjs#dispatchStillHolds`'s default) cannot drift from it."* **Hardening 5 makes that
sentence false** — the guard stops sharing the window on purpose. The assertion itself still passes (it only
binds the observer's two constants), so nothing reddens to warn you. Update that comment in the same change.
`we:scripts/operations/__tests__/` is in scope, so this is not a lease breach.

*(Also noted, out of scope: `we:scripts/operations/explore-io.mjs:128` carries `LISTING_GRACE_MS = 2 * 60 * 1000`
as a bare literal — the drift H3 exists to prevent, in the file already named out of scope. Fold it into the
`we:scripts/operations/explore-io.mjs` follow-up card, not this one.)*

## The five hardenings

1. **Capture one real `claude agents --json` payload and pin the field name to a fixture. This does NOT need
   the live dispatch — do it FIRST, on its own.** *(Corrected 2026-08-26: the original text said "during this
   item's own live run", which over-constrained it and inverted the review's own ordering. `claude agents
   --json` is a read-only listing; it starts nothing and spends nothing. The prepare ran it and got 19 real
   elements — see* Prepared 2026-08-26 *for the shape. The review's instruction was "capture one real payload
   BEFORE dispatching anything", and this is what makes that possible.)* Pin **all three element shapes** the
   listing actually returns, not one. Everything below rests on `sessionId` being the right key — the `#3030` spike's account of it,
   per `stampLiveness`'s docblock at
   [we:scripts/operations/dispatch-lane-io.mjs:313](scripts/operations/dispatch-lane-io.mjs), was narrower than
   the CLI in the one place it mattered, and no code path in the repo has ever run
   `claude --bg --session-id …` and then listed it back. Land
   `we:scripts/operations/__fixtures__/claude-agents-payload.json` **before** touching the three functions
   below, so their fix is checked against something real rather than another guess.

2. **A non-empty listing that yields zero usable ids must read as `unreadable`, not as "everyone is gone."**
   Three call sites share the exact-match assumption and must all change together:
   - [we:scripts/operations/dispatch-lane-io.mjs:326-347](scripts/operations/dispatch-lane-io.mjs) —
     `stampLiveness`. Line **340** builds `listed` from
     `sessions.map((s) => String(s?.sessionId ?? '')).filter(Boolean)`; if `sessions` is a non-empty array but
     `listed.size === 0` after that filter (every element lacked a usable id), return the `unreadable` branch
     (currently line **338**) instead of falling through to line **342**'s `listed.has(...)` comparison, which
     stamps `live: false` on every row.
   - [we:scripts/operations/wake.mjs:333-344](scripts/operations/wake.mjs) — `assertHandleNotLive`. Same shape:
     `sessions` is checked for `Array.isArray` (lines **333-339**) but never for "parsed fine, yielded nothing
     matchable" before the `.some()` compare at line **340**. A non-empty-but-unmatchable listing must throw
     the same "could not be told" refusal as the not-an-array branch, not fall through to "not listed,
     therefore safe to close out."
   - [we:scripts/operations/dispatch-lane-io.mjs:806-825](scripts/operations/dispatch-lane-io.mjs) —
     `createDispatchObservers`. Line **811**'s `sessions.find((s) => s && String(s.sessionId) === handle)` has
     the same hole; a non-empty, no-match listing must report an observer error (like the `!Array.isArray`
     throw at lines **808-810**) rather than falling into the `unresolved` branch at lines **819-824**.

3. **Compare session ids case- and whitespace-tolerantly**, or state in each docblock why an exact match is
   deliberate. The sites above (`we:scripts/operations/dispatch-lane-io.mjs` lines **340**/**342**
   and **811**, `we:scripts/operations/wake.mjs` line **340**) all do `String(x) === handle`; normalize both sides (e.g. `.trim().toLowerCase()`) before
   comparing, since a CLI that echoes the id in a different case turns every dispatch into a double-dispatch
   under the current exact match. **State it as drift-defence, not as an observed bug** — CLI 2.1.246 emits
   every id lower-case (measured in the prepare), so no case mismatch has been seen. The fix is still worth
   landing; the docblock must not claim a defect nobody observed.

4. **Age `live: false` from `lastSeenLiveAt`, not `startedAt`.** `dispatchStillHolds`
   ([we:scripts/operations/dispatch-lane.mjs:344-374](scripts/operations/dispatch-lane.mjs), the
   `entry?.live === false` branch at lines **356-361**) currently has nothing but `startedAt` plus the listing
   grace to decide how long a `live: false` reading is trusted. Persist a `lastSeenLiveAt` timestamp on the
   run's effect entry the first time a listing read confirms `live: true` for it (the natural write point is
   wherever the observer or the guard read next stamps the entry back to the run store), and use that field —
   falling back to `startedAt` only when it was never set — as the anchor for the listing-grace comparison.
   A single bad read right after a real "seen alive" then cannot release the item; two consecutive bad reads,
   spaced by the grace window, can.

5. **Give the guard its own listing grace, larger than the observer's.** Today both readers share one
   constant: `DISPATCH_LISTING_GRACE_MINUTES = 2` at
   [we:scripts/operations/dispatch-lane.mjs:131](scripts/operations/dispatch-lane.mjs), consumed directly as
   the guard's default (`listingGraceMinutes = DISPATCH_LISTING_GRACE_MINUTES` at line **347**, re-read at line
   **360**) and re-derived as `LISTING_GRACE_MS` for the observer at
   [we:scripts/operations/dispatch-lane-io.mjs:115](scripts/operations/dispatch-lane-io.mjs). Their costs of
   being wrong differ by roughly 100x: the observer's wrong answer (`unresolved`) writes nothing, while the
   guard's wrong answer starts a second agent in the same lane clone. Add a distinct, larger constant
   (`DISPATCH_GUARD_LISTING_GRACE_MINUTES`) and pass it as `dispatchStillHolds`'s default for
   `listingGraceMinutes` instead of reusing the observer's constant, with a docblock stating why the two
   differ.

   **Change the in-body fallback at line 360 too, not only the default at 347.** `dispatchStillHolds` re-reads
   `DISPATCH_LISTING_GRACE_MINUTES` as its fallback when `listingGraceMinutes` is malformed or negative
   (`const listingGrace = Number(listingGraceMinutes) >= 0 ? Number(listingGraceMinutes) : DISPATCH_LISTING_GRACE_MINUTES;`).
   Leaving it would let a caller passing `listingGraceMinutes: -1` silently get the OBSERVER's two minutes back
   in the guard — Done-when 5 as first written would pass with that hole open, so it is pinned there now.

   *(**Which docblock goes false, corrected 2026-08-26.** The original text named lines **128-129** — the "ONE
   SOURCE OF TRUTH … the observer derives its `LISTING_GRACE_MS` from this constant" paragraph. That sentence is
   about the OBSERVER and stays **true** after this change; the observer keeps deriving. What actually goes
   false is one paragraph earlier, at **124-126**: *"The guard treats 'absent and young' as HOLDING — the
   fail-closed direction, and the exact seconds the double-dispatch guard exists to cover"* — a docblock on
   `DISPATCH_LISTING_GRACE_MINUTES` describing behaviour that constant will no longer drive. And so does the
   `{@link DISPATCH_LISTING_GRACE_MINUTES}` inside `dispatchStillHolds`'s own docblock at **line 324**, which
   the original text did not name at all. Fix 124-126 and 324; ADD the guard's exception to 128-129 rather than
   deleting a claim that is still correct.)*


## HOW THE LIVE DISPATCH IS ACCEPTED — ruled 2026-08-26, in the prepare

The question this card could not be built against: *is the live dispatch a Done-when criterion, or an
operator-run step the card names but does not gate on?* Both readings were argued. **It stays a gating
criterion — but split in two, because as written it is un-executable by its own builder and its evidence
does not survive.** Three facts decided it, each verified rather than reasoned about.

### Fact 1 — it CANNOT be run from the build lane. This is a hard refusal, not a preference.

`assertNotALaneCheckout` (`we:scripts/operations/dispatch-lane-io.mjs:556-563`) is the sink's **first**
statement, before the session id is even minted:

```js
if (/^lane-\d+$/.test(String(root).split('/').filter(Boolean).pop() || '')) {
  throw notApplied(`dispatch-lane: refusing to start a delivery agent from the lane checkout ${root} …`);
}
```

Every lane in the pool is `.lanes/web-everything/lane-N`. The delivery agent that builds THIS card works in
one. So Done-when 7 as first written — a bare `node we:scripts/operations/run.mjs dispatch-lane --num=<NNN>` — **throws for the
one agent whose criterion it is**. That is the "criterion nobody can execute" failure, and it was already
baked in.

### Fact 2 — the evidence it names is GITIGNORED. A later reader could never see it.

`we:.gitignore:97-98` — the comment names `we:scripts/operations/run-record.mjs` and says *"Never committed."*, over an `.operations/` entry. The run entry
under `we:.operations/runs/` that Done-when 7 points at is **local, ephemeral and untracked**
(`git ls-files .operations` → empty). A criterion whose whole product is an uncommitted file proves nothing
to anyone who was not in the room.

**So the evidence has to be transcribed, and this repo already has the shape for it:** #3331's Done-when 1
requires *"the exact command, the CLI version, the id passed, and the id `claude agents --json` reported
back"* written **into the card**. Cards are committed, greppable and reviewed. Do the same here.

### Fact 3 — the blast radius is a real lane, a real PR and real tokens, and the brief kind cannot be dialled down.

`briefPath` maps `build` → `we:skills-src/conveyor/delivery-agent-brief.md`, whose arc is: acquire a lane
(step 1) → claim the item (2) → build it (4) → run the gate (5) → **spawn an adversarial code-review
subagent** (6) → commit, push and **open a PR** (8). And `launchKind` is **not an operator flag** — it is
whichever of the tick core's three launch lists the num came out of
(`we:scripts/operations/dispatch-lane.mjs:415-427`), so you cannot ask for the cheaper `prepare` brief to
make the run small. A live dispatch consumes a pool lane, spends tokens across several agents, and lands a
PR against a real backlog item.

**But the five things Done-when 7 actually observes are all true within ~2 minutes of the spawn** — agent
started, handle recorded, handle found by `stampLiveness`, run resumable after the dispatcher is killed, and
the lane lease taken by the agent's own `acquire` (brief step 1, its first act). Everything after that is
cost with no evidentiary return. So the run is **deliberately terminated once the five observations are
recorded** — that is what makes this a bounded verification rather than a test that quietly spends money.

### The ruling

**Criterion 7 splits into 7a (gates the PR) and 7b (gates RESOLUTION, not the PR).**

- **7a is lane-executable and gates the code PR.** It is the fixture plus the mutation tests — everything the
  hardenings can be checked by without starting an agent. A builder in a lane can finish 7a alone.
- **7b is the live dispatch. It gates this card's RESOLUTION and nothing else.** It runs from the **primary
  checkout** by an operator (or by the session that owns it), after 7a's PR has landed, with the evidence
  transcribed back into this card in a follow-up commit.

**Why 7b is not simply dropped to "operator step, ungated".** Resolved #3037 took option (a) of the round-3
review's two — rewrite the acceptance so the clause is reassigned, rather than hold #3037 open — so the
clause *"a lane IS dispatched through the declared operation … verified against a real queue"* now lives
**only here**. Un-gating it would orphan an acceptance clause of an already-resolved card, with no card
holding it. That is worse than a criterion that is slow to execute.

**Why it does not gate the PR.** Because a code PR that cannot be reviewed until someone finds a spare lane,
a spare hour and a token budget is a PR that sits. The hardenings ship valid without the live run — the
review said so in as many words: *"a hardened guard, a real payload fixture and a proven live dispatch are
all wanted regardless."* Splitting is the only reading that keeps both the code moving and the clause owned.

### The live-run protocol — follow it exactly

Do not fire this before **#3331 answers** (see below), and do not fire it unset.

1. **From the PRIMARY checkout** (`/Users/nicolasgilbert/workspace/webeverything`), never a lane.
2. **Set `WE_DISPATCH_AGENT_ARGS` to a non-prompting permission mode.** Unset means no extra flags. On this
   host's own evidence — seven sessions blocked on a permission prompt, one for 9.4 days — an unset dispatch
   stalls at brief step 1's `$( … )` and never reaches `lane-pool acquire`, which is the one observation that
   needs the agent to make progress.
3. **Pick the target deliberately.** It must be a real, scoped, unblocked item the tick core will surface —
   the num is not free-choice, since the core decides `launchKind`. Name it in the evidence.
4. **Record, as it happens:** the exact command; `claude --version`; the minted handle; the run id under
   `we:.operations/runs/`; the `claude agents --json` row for that handle **verbatim**; the `stampLiveness`
   verdict; the lane the agent acquired; the `kill` of the dispatching process and the resumed run's output.
5. **Then STOP the agent** — `node we:scripts/operations/wake.mjs --resolve` on the entry, which will refuse
   while the handle is live (`assertHandleNotLive`; that refusal is itself evidence, so capture it), then
   `--force`. Release the lane it took.
6. **Transcribe 4 and 5 into this card and the PR body.** Redact nothing except unrelated sessions' ids.

**If the live run reveals the guard is wrong, that is a SUCCESS of this criterion, not a failure of the
card** — it is precisely what a first live run is for. File what it finds; do not patch it silently into the
same PR.

## The first live dispatch — the other half of #3037's acceptance

Ruled by the independent review of PR #1211 and written into #3037's own acceptance: the clause **"a lane IS
dispatched through the declared operation … with the same scope-lease arbitration … verified against a real
queue" is REASSIGNED to this half of #3096.** #3037 delivered the declaration, the structural holds and the
durable handle; nothing has ever been dispatched, and the lease is taken by the agent running
`lane-pool acquire` from the brief — a path that has not executed. **#3037 is not fully accepted until this
card lands.**

Named classes of defect only a live run can catch, from the same review, so they are checked here and not
rediscovered: a background session's permission mode (the agent's first act is `bash` inside a `$( … )`, and a
prompt there stalls it holding a handle that reads `running` forever); whether `--session-id` really pins the
id that `claude agents` reports back; whether `-n` is the session-name flag; what the child inherits from a
conveyor runner's environment (`spawnAgent` passes no `env`); and the agent's lane acquisition racing the
parent's assignment, which is the entire reason the in-flight guard exists. `WE_DISPATCH_AGENT_ARGS` is the
knob for permission mode and isolation default.

**Read #3331's answer before spending the live run.** [#3331](3331-probe-does-claude-bg-honour-session-id-dispatch-lane-s-obser.md)
asks whether `claude --bg` honours `--session-id` at all. If it does not, the minted handle can never match a
listing and every hardening above is guarding a comparison that structurally cannot succeed. That is a
different defect from these five (which assume the match CAN work and harden how a failed read is
interpreted), so #3331 is `relatedTo`, not a `blockedBy` — but do not fire the dispatch before it answers.

## Not in scope

- **`we:scripts/operations/explore-io.mjs:822`** — the fourth site with the identical hole, found while
  re-reading for this split and named so it is not lost. It is the `explore` operation's liveness read, not
  the dispatch guard's, and its wrong answer closes out an investigation rather than starting a second agent
  in an occupied lane — a materially different cost, on a different operation's surface. Fixing it here would
  widen this card past `size: 5` for work no citation asks of it. **File it as its own card once hardening 2's
  shape is settled**, so it copies a landed pattern instead of a second guess.
- **The skill-side rewiring** — steps 3 and 3b of `we:skills-src/conveyor/SKILL.md`. That is #3096.
- **The stranded-hash heal** (`backlog/3350-*.md`) — **already healed on `main`, so there is nothing here to
  bundle.** *(Corrected 2026-08-26.)* It was the one pre-existing `check:standards` error when this card was
  written; the drain's JIT-numbering healed it at land (`fad31663 drain: JIT-number 3350→#3350 at land
  (#2288)`), and the gate is now **0 errors** — see *Prepared 2026-08-26*. The original reason to keep it out
  still stands if a similar heal ever appears: it rewrites `we:docs/agent/platform-decisions.md` and turns any
  card that bundles it into a statute edit.

## Acceptance

The five liveness-reading hardenings are landed, each covered by a test that reddens when the fix is reverted;
a real `claude agents --json` payload is pinned as a fixture and the three readers are checked against it; and
one live dispatch has been observed end to end — agent started, handle recorded, handle found again by
`stampLiveness`, the run resumable after the dispatching process is killed, and the scope-lease arbitration
exercised by that live agent's own `acquire`.

**Accepted in TWO phases** (ruled in the prepare, 2026-08-26 — see *HOW THE LIVE DISPATCH IS ACCEPTED*). The
hardenings, the fixture and the mutation tests are all lane-executable and land as one PR. The live dispatch
cannot run from a lane at all (`assertNotALaneCheckout`) and its natural artifact is gitignored, so it runs
from the primary checkout afterwards and its evidence is transcribed back into this card. **This card is not
`resolved` until that transcript is here** — the clause was reassigned out of already-resolved #3037 and no
other card holds it.

## Done when

Every count below was RUN at `origin/main` `c8d92db7` on 2026-08-26 and **RE-RUN at `916dec98`** in the
prepare the same day. All five still fail — none of these is a criterion that already passes. The re-run
table is in *Prepared 2026-08-26*.

**Criteria 1-6 and 8 gate the PR. Criterion 7a gates the PR; 7b gates RESOLUTION only** — see
*HOW THE LIVE DISPATCH IS ACCEPTED* for why that split exists and how to execute 7b.

1. **Executable — the fixture exists.** Currently missing:

   ```
   $ test -f scripts/operations/__fixtures__/claude-agents-payload.json && echo EXISTS || echo MISSING
   MISSING
   ```

   Must read `EXISTS`, and its content must be a payload captured from a real `claude agents --json` run (not
   hand-authored), with the command and the `claude --version` recorded in the PR body. **No dispatch is
   needed to meet this** — the listing is read-only (see *Prepared 2026-08-26*). The fixture must contain
   **all three element shapes** the real listing returns, including the 12-of-19 minimal shape that carries
   no `state`, no `status` and no `id`; a fixture with one shape pins the wrong thing.

2. **Executable — a second `unreadable` return site appears in `stampLiveness`.** Currently 2 hits, of which
   **only one is code**: line **313** is inside a docblock and line **338** is the single `return`:

   ```
   $ grep -c "livenessSource: 'unreadable'" scripts/operations/dispatch-lane-io.mjs
   2
   ```

   Must rise to at least **3** — the docblock plus **two** return sites (the existing not-an-array branch and
   the new non-empty-but-unmatchable branch). A bare whole-file count without that breakdown would already be
   non-zero and prove nothing.

3. **Executable — the exact-match compares are gone from the two dispatch-guard readers.** Currently 2:

   ```
   $ grep -rn '=== handle' scripts/operations/dispatch-lane-io.mjs scripts/operations/wake.mjs | wc -l
   2
   $ grep -c 'listed.has(String(' scripts/operations/dispatch-lane-io.mjs
   1
   ```

   Both must fall to **0** (normalized on both sides per hardening 3). The docblock accompanying the
   normalization must say it is drift-defence — CLI 2.1.246 emits every id lower-case — and must not claim an
   observed case mismatch. `we:scripts/operations/explore-io.mjs`
   still holds **1** `=== handle` and that is correct — it is named out of scope above, so a repo-wide count
   would wrongly redden.

4. **Executable — `lastSeenLiveAt` is written and read.** Currently 0 files:

   ```
   $ grep -rl lastSeenLiveAt scripts/operations/ | wc -l
   0
   ```

   Must be at least **2** — a write site (where a confirmed `live: true` stamps the entry) and a read site
   (`dispatchStillHolds`'s `live: false` branch anchoring on it, falling back to `startedAt`).

5. **Executable — the guard has its own grace constant.** Currently 0 files:

   ```
   $ grep -rl DISPATCH_GUARD_LISTING_GRACE_MINUTES scripts/operations/ | wc -l
   0
   ```

   Must be at least **1**, its value must exceed `DISPATCH_LISTING_GRACE_MINUTES`, and it must appear in
   **both** of `dispatchStillHolds`'s reads of the window — the default for `listingGraceMinutes`
   (`we:scripts/operations/dispatch-lane.mjs:347`) **and the in-body fallback at line 360**, so a malformed
   `listingGraceMinutes` cannot hand the guard the observer's smaller number back. Verify with
   `grep -c DISPATCH_GUARD_LISTING_GRACE_MINUTES we:scripts/operations/dispatch-lane.mjs` → at least **3** (the
   declaration plus those two uses).

   **Docblocks, corrected 2026-08-26** — the original clause named the wrong lines. Lines **124-126** ("The
   guard treats 'absent and young' as HOLDING…") and the `{@link DISPATCH_LISTING_GRACE_MINUTES}` at line
   **324** inside `dispatchStillHolds` both go FALSE and must change. Lines **128-129** (the observer's
   derivation) stay TRUE — **add** the guard's exception there, do not delete a correct claim. And update the
   comment at `we:scripts/operations/__tests__/dispatch-lane-defaults.test.mjs:190-191`, which asserts the
   derivation exists so the guard's default cannot drift; that becomes false and nothing reddens to tell you.

6. **Mutation** — each of the five hardenings has a test that reddens by name when the fix is reverted,
   including the one that matters most: a non-empty `claude agents --json` listing yielding zero usable ids
   must read as `unreadable` and NOT release the guard. **That branch is unreachable against CLI 2.1.246** —
   every row of the real listing carries a usable `sessionId` — so this mutation test is its *only* possible
   cover and no live run can ever exercise it. Say so in the test's own comment, so a later reader does not
   go hunting for the real listing that reddens it.

7a. **Executable in the lane — GATES THE PR.** The three readers are exercised against the pinned fixture
   from criterion 1: `stampLiveness`, `assertHandleNotLive` and `createDispatchObservers` each read the real
   payload and each reddens when its hardening is reverted. No agent starts; nothing is spent. A builder
   working in a lane can finish the PR on 7a alone.

7b. **The live run — GATES RESOLUTION, NOT THE PR.** A dispatch through
   `node we:scripts/operations/run.mjs dispatch-lane --num=<NNN> --json`, **run from the PRIMARY checkout**
   (`assertNotALaneCheckout` at `we:scripts/operations/dispatch-lane-io.mjs:556-563` refuses any
   `.lanes/…/lane-N` root, so this can never be run by the lane agent that builds 7a), with
   `WE_DISPATCH_AGENT_ARGS` set to a non-prompting permission mode, records a run entry under
   `we:.operations/runs/` whose handle is found again by `stampLiveness`; the run resumes after the
   dispatching process is killed; and the dispatched agent's own `lane-pool acquire` takes a lease.

   **`we:.operations/` is GITIGNORED, so the run entry is NOT the evidence.** The evidence is the transcript
   of steps 4-5 of *The live-run protocol* written into THIS card and the PR body — the exact command, the
   `claude --version`, the minted handle, the verbatim `claude agents --json` row, the `stampLiveness`
   verdict, the lane acquired, the kill-and-resume output, and `wake --resolve`'s live-handle refusal. That
   is the shape #3331's probe criterion already uses, and it is the only form a later reader can check.

   **Stop the agent as soon as the five observations are recorded** (protocol step 5) — they are all true
   within ~2 minutes of the spawn, and the `build` brief runs for hours and opens a real PR if left alone.

   This is the clause reassigned from #3037 and it now lives only here. It cannot be met without actually
   starting an agent, and it must not be attempted before #3331's probe answers.

8. `npm run check:standards` — no new errors and no new warnings against the baseline measured at build time.
   Do not hard-code a number, and **never read it through a pipe** (`| tail` returns tail's exit code). Run it
   **twice**, plainly, and compare both — the loader is non-deterministic in the presence of any malformed card.

   **Baseline, re-measured 2026-08-26 at `916dec98`: 0 errors / 1447 warnings, identical on both runs.**
   *(The original text said "1 error / 1438 warnings … the one error is the pre-existing stranded-hash card
   `backlog/3350-*.md`". Both halves are stale: the warning count moved in one day, and that error is GONE —
   healed at land by `fad31663`. The gate is clean, and both runs matched byte for byte because the malformed
   card that caused the non-determinism no longer exists. **Start from a green gate; any error you see is
   yours.**)*
