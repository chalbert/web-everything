---
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

## The five hardenings

1. **Capture one real `claude agents --json` payload during this item's own live run and pin the field name to
   a fixture.** Everything below rests on `sessionId` being the right key — the `#3030` spike's account of it,
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
   under the current exact match.

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

   *(The docblock at [we:scripts/operations/dispatch-lane.mjs:128-129](scripts/operations/dispatch-lane.mjs)
   argues the opposite — that the observer should derive from this constant "rather than carrying a second
   number that could drift from it." That reasoning is sound for drift and wrong for asymmetric cost.
   Whichever way this lands, the docblock has to change with it; do not leave it asserting a rule the code no
   longer follows.)*

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
- **The stranded-hash heal** (`backlog/x10eju0-*.md`, the one pre-existing `check:standards` error). It
  rewrites `we:docs/agent/platform-decisions.md` and turns any card that bundles it into a statute edit.

## Acceptance

The five liveness-reading hardenings are landed, each covered by a test that reddens when the fix is reverted;
a real `claude agents --json` payload is pinned as a fixture and the three readers are checked against it; and
one live dispatch has been observed end to end — agent started, handle recorded, handle found again by
`stampLiveness`, the run resumable after the dispatching process is killed, and the scope-lease arbitration
exercised by that live agent's own `acquire`.

## Done when

Every count below was RUN at `origin/main` `c8d92db7` on 2026-08-26 and **fails today** — none of these is a
criterion that already passes.

1. **Executable — the fixture exists.** Currently missing:

   ```
   $ test -f scripts/operations/__fixtures__/claude-agents-payload.json && echo EXISTS || echo MISSING
   MISSING
   ```

   Must read `EXISTS`, and its content must be a payload captured from a real `claude agents --json` run (not
   hand-authored), with the run recorded in the PR body.

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

   Both must fall to **0** (normalized on both sides per hardening 3). `we:scripts/operations/explore-io.mjs`
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

   Must be at least **1**, its value must exceed `DISPATCH_LISTING_GRACE_MINUTES`, and it must appear as
   `dispatchStillHolds`'s default for `listingGraceMinutes` (today `DISPATCH_LISTING_GRACE_MINUTES` at
   `we:scripts/operations/dispatch-lane.mjs:347`). The docblock at lines **128-129** must no longer assert the
   one-source-of-truth rule the code has stopped following.

6. **Mutation** — each of the five hardenings has a test that reddens by name when the fix is reverted,
   including the one that matters most: a non-empty `claude agents --json` listing yielding zero usable ids
   must read as `unreadable` and NOT release the guard.

7. **Executable — the live run.** A dispatch through
   `node we:scripts/operations/run.mjs dispatch-lane --num=<NNN> --json` records a run entry under
   `we:.operations/runs/` whose handle is found again by `stampLiveness`, and the run resumes after the
   dispatching process is killed. This is the clause reassigned from #3037. It cannot be met without actually
   starting an agent, and it should not be attempted before #3331's probe answers.

8. `npm run check:standards` — no new errors and no new warnings against the baseline measured at build time.
   (Do not hard-code a number. It was **1 error / 1438 warnings** at `c8d92db7` on 2026-08-26 and it moves most
   days; the one error there is the pre-existing stranded-hash card `backlog/x10eju0-*.md`, unrelated to this
   item and named out of scope above. Run it **twice** and compare — the loader is non-deterministic in the
   presence of any malformed card.)
