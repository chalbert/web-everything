# Builder launch misreads and the early death of #4620

On 2026-09-30, the builder rejected successful dispatch acknowledgements because its reader expected a persisted run record while the CLI returned a summary envelope. Separately, #4620's wrapper rejected an unsupported mixed-repo scope before acquiring its lane or launching Claude, outside its terminal-settlement catch. The false acknowledgement released the build claim; claim-only orphan adoption then skipped the surviving dead run record. These are three independently repairable defects, captured below. No delivery was retried, resumed, killed or repaired during this investigation.

## Evidence provenance

Times below are UTC; subtract four hours for the incident's Toronto/ET times. The tick logs timestamp completion of an entire tick, not each launch. The 17:45:24 tick therefore contains launches at 17:41–17:43.

External evidence root **C** is `~/workspace/.operations/coordination` (outside the repository). **D** is the read-only daemon clone `~/workspace/wev-control`. These source labels identify external evidence, not files authored in this lane. C paths and line numbers below refer to the existing JSON/JSONL files, not a reformatted export. Code citations refer to this checkout. Byte comparisons confirmed the builder, CLI adapter, wrapper and orphan-adoption modules matched D when inspected. The daemon clones were not edited.

Read-only probes performed: JSON extraction of today's tick failures and the three named run records; serialization of #4620's saved record through the real `outcomePayload`, followed by `readDispatchOutcome`; delivery-log inspection; lane-pool status; lane-15 reflog. No live dispatch operation was invoked. The user's historical process observations are distinguished from these probes: a current PID check cannot establish historical process liveness.

## Failure 1: a summary envelope is read as a full run record

### Evidence chain

1. C/build-dispatch-daemon.log:2136, timestamp `2026-09-30T17:45:24.296Z`, reports `dispatched: []` and the same failure for #4620, #4333 and #4386:

   ```json
   {"num":"4620","stage":"dispatch","reason":"dispatch launch not confirmed (missing effect; no running session)"}
   ```

   Extraction of all September 30 `failures` yields **20 occurrences across 18 distinct cards**, at log lines 1851–2136: #4331, #4332, #4333, #4335, #4336, #4338, #4339, #4341, #4357, #4363, #4369, #4373, #4381, #4386, #4407, #4457, #4480, #4620. #4341 appears three times. This count concerns the top-level build failures, not nested preparation failures.

2. The persisted records contain the effect the builder says is missing:

   | Run record (a JSON file under C/build-dispatch-runs) | Status line | Handle line | Start |
   | --- | --- | --- | --- |
   | run `dispatch-lane-426d63f5-ff46-420a-b2c3-ff28fdc3a290` | 1945: `in-flight` | 1955: `pid:93689` | 17:41:36.988Z |
   | run `dispatch-lane-f1ca2d24-e865-45e4-8d03-8cab6eebecba` | 1827: `in-flight` | 1837: `pid:99827` | 17:42:18.716Z |
   | run `dispatch-lane-da87a881-b261-4b7a-a7c8-f30c2d85d6b7` | 1797: `in-flight` | 1807: `pid:24477` | 17:43:09.497Z |

   Each effect is `conveyor.dispatch-delivery-agent`, with `payload.launchKind: build` and `dispatch.executor: claude`. These prove detached-wrapper dispatch, not successful completion or even an inner Claude spawn. The user observed #4333/#4386 wrappers still running ten minutes later; no new launch was needed to reproduce their acknowledgement defect.

3. `we:skills-src/conveyor/build-dispatch-daemon.mjs:851` executes the operation with `--json`; line 855 hands its stdout to `readDispatchOutcome`. At `we:skills-src/conveyor/build-dispatch-daemon.mjs:130`, the reader chooses `parsed.run ?? parsed`; line 138 searches `run.effects` for the dispatch effect.

4. The actual stdout contract is `we:scripts/operations/cli-adapter.mjs:1210` (`outcomePayload`), serialized by `renderOutcome` at line 1277. It emits `runId`, `op`, `stopped`, `applied`, `inFlight`, `pending`, `verdict`, `findings`, `telemetry`, `spend`. It emits **neither `run` nor `effects`**. `inFlight` contains effect keys, not rows or handles.

5. A read-only probe using the real saved record and real serializer produced:

   ```text
   inFlight = ["dispatch-lane-426d63f5-ff46-420a-b2c3-ff28fdc3a290#2#0"]
   readDispatchOutcome(JSON.stringify(outcomePayload(...)))
     => dispatching:false, reason:"dispatch launch not confirmed (missing effect; no running session)"
   readDispatchOutcome(JSON.stringify(savedRecord))
     => dispatching:true, handle:"pid:93689", lane:15, sessionSlug:"conveyor-4620"
   ```

This is a **deterministic producer/consumer schema mismatch**, not evidence of stdout printing before persistence and not a different run ID. `we:scripts/operations/effect-executor.mjs:366` persists the pre-sink state, and line 383 persists the returned handle before the drive returns to rendering. A distinct parent/child settlement race remains relevant to a future early-exit fix, but is unnecessary to explain the missing array.

### Consequences and fix design — #x34sep8

`we:skills-src/conveyor/build-dispatch-daemon.mjs:419` releases the build-dispatch claim on the false result and appends a failure. That branch does **not** place a build hold and does **not** release a lane lease. The build is omitted from `dispatched`; the successful-launch bookkeeping filter at line 120 can consequently drop its new guard.

The durable row still protects the next tick: the run-store scan at `we:skills-src/conveyor/build-dispatch-daemon.mjs:731` includes it, and C/build-dispatch-daemon.log:2138 (17:51:48.723Z) counts all three cards in flight. Thus the claim is freed, but the next tick's effective capacity is **not immediately freed** in this observed case. There is no evidence of a duplicate launch of these three attempts. Releasing ownership nevertheless creates a real risk: run-record protection is clock-bounded when liveness is unknown, and loss/expiry of that remaining protection can permit another attempt while an old worker survives. A lost guard/claim also removes independent crash protection.

Fix the consumer boundary: resolve the envelope's `runId` through the same configured store, validate item/op/effect identity and terminal versus accepted state, and retain ownership when confirmation is indeterminate. Do not accept a planning verdict or an unverified effect key as successful launch. Exercise the real serializer-to-reader boundary, not a hand-written full-run fixture. The card requires a real scheduled-tick soak break.

## Failure 2: #4620 exits before acquiring a lane, then survives as a ghost run

### Direct cause of process exit — #xp12azn

D's `we:.operations/delivery-dispatch-logs/conveyor-4620.log:1` identifies the exact wrapper:

```text
deliver-item-run: starting delivery of #4620 in lane 15 (session conveyor-4620, attempt 1, provider claude-restricted) — pid 93689
```

Line 2 supplies the actual failure (excerpt):

```text
#4620 FAILED (lane and claim released best-effort by the wrapper):
#4620's scope spans more than one non-we repo (we, plateau-app) — a multi-repo "couple" build ...
Do not dispatch this item mechanically until that decision is ratified.
```

The phrase “more than one non-we repo” is misleading: the check counts distinct repositories **including WE**. `we:scripts/operations/deliver-item-wrapper.mjs:737` derives keys from the scope; `keys.size > 1` sets `multiRepo`. #4620's stored scope includes WE contracts and plateau-app code, so the refusal is explained exactly. The intentional capability boundary is already tracked by open decision #4289, `we:backlog/4289-design-multi-repo-couple-locus-delivery-e-g-we-plateau-app-2.md`; the exception still cites that decision's old hash.

The wrapper throws at `we:scripts/operations/deliver-item-wrapper.mjs:374`. Its outer protected region starts only at line 400; lane acquisition is line 408 and the agent turn is later. Its settlement catch at line 612 is therefore never reached. `we:scripts/operations/deliver-item-run.mjs:184` catches the error, prints the generic cleanup claim and returns exit code 1, without settling the effect itself. Here **the log's cleanup claim is false**: execution never acquired resources and never reached that cleanup.

This establishes a preflight refusal, **not a Claude spawn error, trust prompt, or lane reclaimed under a running build**. No inner Claude session is expected. The log has no timestamp on the exit line, so it does not establish the exact exit second; it does identify the attempt and failure. The user-observed absence of PID 93689 by 17:55Z is consistent with it.

Fix design: enforce the existing locus capability boundary in dispatch admission before detaching; keep #4289 unresolved rather than inventing multi-repo delivery. Put all wrapper preflight inside a terminal reporting boundary, preserving the actual reason and tracking resource ownership before cleanup. A typed refusal must reach the run store even through older callers. Account for fast-child exit racing the parent's post-spawn write: `we:scripts/operations/deliver-item-settle.mjs:22` documents that independent race. Make terminal settlement monotonic rather than adding sleeps or retrying a refused build.

### Lane 15 was assigned in a plan, never leased by this attempt

The recorded `lane:15` is an assignment to the future wrapper, not an acquired lease. The failing branch precedes `acquireLane`. Therefore **there was no #4620 lease for a reaper or the builder to release** on this attempt. Likewise, after the false acknowledgement there was no continuing builder claim: the surviving ownership-looking object was the run record. Build-dispatch claims, item claims, lane leases and run records are distinct.

The read-only lane status probe confirmed lane 15 leased to `prevention-card-muoei2hk-dounw1`, purpose `prevention-card`, `acquiredAt: 2026-09-30T17:50:41.954Z`, PID 57421, clean, branch `main`, HEAD `f423141a2`. The lane's reflog records a reset at 17:48:25Z, another at 17:50:45Z and the prevention-card commit at 17:50:47Z. These observations corroborate reuse, **not destruction of #4620's work**. No historical lease audit was needed to infer absence of acquisition on this exact throwing execution path; this does not claim lane 15 had no other holders earlier that day.

### Why the builder did not notice — #xfmxjlr

1. C/build-dispatch-daemon.log:2138 has `inFlight` containing #4620, #4386, #4333 and `orphanAdoption: []` at 17:51:48.723Z.
2. `we:scripts/conveyor/build-dispatch-orphan-adopt.mjs:436` starts from `for (const claim of listClaims())`. Its kernel PID probe at line 442 is only reached for those claims. The false launch failure removed #4620's claim, making its dead run invisible to adoption. Reading past claim TTL does not help a deleted claim.
3. `we:skills-src/conveyor/build-dispatch-daemon.mjs:743` instead reads the durable in-flight build row and calls `dispatchStillHolds` without stamping PID liveness; stamping is restricted to preparation rows at line 752.
4. `we:scripts/operations/dispatch-lane.mjs:704` therefore takes the unknown-liveness clock path. #4620's record at line 1957 has `expectedBy: 2026-09-30T19:11:42.061Z`; the 30-minute grace at line 311 keeps it counting until **19:41:42.061Z**, absent other terminal evidence. That is about two hours after launch. Expiry stops occupancy; it does not itself persist the real failure.

The independent recovery defect is **claim-only reconciliation alongside run-based occupancy**. Fix it by enumerating the union of claims and durable build rows, correlating exact attempts and probing worker identity/liveness. A confirmed dead claimless row must become a durable terminal finding; a live or unknown worker must stay protected. Reconciliation must never release a replacement session's lease, nor interpret a missing claim as permission to respawn. The card includes a real exited-child/foreign-lease integration probe and a timed soak break.

## Filed work and validation

Three stories were filed through `we:scripts/operations/run.mjs` using `file-item`, with file-level `we:` scopes and 30-minute/three-tick soak breaks: #x34sep8 (acknowledgement schema), #xp12azn (preflight admission and settlement), #xfmxjlr (claimless reconciliation). They were filed with queueing disabled for human review; this diagnosis authorizes no retries or implementation. The existing #4289 decision retains ownership of whether and how mixed-repo delivery should work.

The real serializer/reader reproduction passed as a diagnostic: the same saved dispatch record is accepted directly and falsely rejected through the actual CLI envelope. Existing coverage at `we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs:997` supplies a synthetic full `run.effects` object, explaining why that test misses the production boundary. The shared build-dispatch claims directory was empty when inspected, corroborating the claimless state.

Required verification was attempted, but neither gate could run under this session's filesystem permissions:

- `node we:scripts/verify-lane.mjs` selected the four changed Markdown files, then failed with `EPERM` writing `we:.git/.lane-verify.67106.tmp`, before executing the selected tests or standards gate.
- `npm run check:standards` independently failed with `EPERM` creating its host-shared admission lock under the external lane pool, before running the checker.

These are observed permission failures, not passing tests or content failures. No permissions, gates or tests were weakened, and no alternate lock root or marker location was used. No shared agent documentation or runtime implementation was changed.

The repository requires `relatedReport` metadata to expose this report, but its loader and visibility checker accept an unqualified path rather than the job's required `we:` prefix (`we:src/_data/backlog.js:338`; `we:scripts/check-standards.mjs:1339`). A metadata-only exception was requested; pending that answer, the three stories carry qualified prose pointers and the machine-readable mirror is not yet authored. This remaining integration constraint is explicit rather than silently violating the job's prefix rule.
