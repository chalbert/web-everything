---
bornAs: xfmxjlr
kind: story
size: 3
tier: pinned
status: open
scope: ["we:scripts/conveyor/build-dispatch-orphan-adopt.mjs", "we:skills-src/conveyor/build-dispatch-daemon.mjs", "we:scripts/conveyor/__tests__/build-dispatch-orphan-adopt.test.mjs", "we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs"]
dateOpened: "2026-09-30"
preparedDate: "2026-10-01"
preparedAgainstSha: "936ada41bf7cb49f02c89674bbcee50ee79e4229"
tags: []
---

# Reconcile dead build run records even after their dispatch claim disappears

Recover confirmed-dead build attempts from durable run records even when their build-dispatch claim has disappeared. The incident narrative for #4620 is historical evidence, not a new live diagnosis: we:reports/2026-09-30-builder-launch-misread-root-causes.md:1. The current reconciliation/occupancy mismatch remains in the code below.

## Evidence

- Adoption enumerates only claims and looks up one latest row per item: we:scripts/conveyor/build-dispatch-orphan-adopt.mjs:432-443; the lookup collapses attempts by item and start time at we:scripts/conveyor/build-dispatch-orphan-adopt.mjs:115-126. With no claims, the lazy run-store scan is never reached.
- Build occupancy independently enumerates durable in-flight build effects at we:skills-src/conveyor/build-dispatch-daemon.mjs:734-752. Only preparation rows receive liveness stamping there (we:skills-src/conveyor/build-dispatch-daemon.mjs:755-761). Unknown liveness uses the deadline plus grace, without terminal persistence (we:scripts/operations/dispatch-lane.mjs:731-738).
- The tick invokes adoption before reading its injected occupancy source (we:skills-src/conveyor/build-dispatch-daemon.mjs:288-300), but the live shell has already cached that source before entering the tick (we:skills-src/conveyor/build-dispatch-daemon.mjs:1451-1458). A repaired row can otherwise remain in that tick's plan.
- Settlement already targets run ID/effect key and rereads status before writing a failed terminal result; it currently swallows write errors (we:scripts/conveyor/build-dispatch-orphan-adopt.mjs:355-368). Resume markers bind to run ID/effect key (we:scripts/conveyor/build-dispatch-orphan-adopt.mjs:149-152).
- Liveness currently coerces probe results through truthiness (we:scripts/conveyor/build-dispatch-orphan-adopt.mjs:185-214); the default PID probe treats EPERM as alive and every other thrown error as dead (we:scripts/operations/detached-dispatch.mjs:90-96). Neither is a sufficient unknown-preserving contract for the new sweep.
- Claims carry item, scope and claimed time, without an exact run/effect binding (we:scripts/conveyor/build-dispatch-claim.mjs:59-66); release is by item and explicitly documents the newer-attempt ownership gap (we:scripts/conveyor/build-dispatch-claim.mjs:70-85). Claim absence must not be turned into permission to mutate item-level ownership.

## Design

1. Extend the existing adoption entry point with a durable-row sweep. Read runs once even when claims are empty; enumerate all in-flight build dispatch effects, including older attempts hidden by the latest-item lookup. Deduplicate by `(runId, effect.key)`, never item number alone. Preserve existing claim-backed recovery behavior, but do not let a claimed item's newest row suppress reconciliation of a distinct older row. The enumeration and lookup seams are we:scripts/conveyor/build-dispatch-orphan-adopt.mjs:235-242 and we:scripts/conveyor/build-dispatch-orphan-adopt.mjs:419-443.
2. Validate dispatch type, build kind, item, run ID, effect key and recorded wrapper handle before probing. Use an explicit alive/dead/unknown result for the new sweep: a positive PID probe protects the row; ESRCH confirms absence; EPERM, other probe failures, malformed/missing handles and indeterminate identity preserve it. Do not infer death from deadline expiry. A bound resume marker takes precedence; live or pending/unknown resume evidence protects the original row. Never use another attempt's marker or clear it by item during the row-only sweep. Existing marker precedence is at we:scripts/conveyor/build-dispatch-orphan-adopt.mjs:194-201. A PID alone cannot prove process identity after PID reuse: ambiguous evidence stays protected rather than claiming stronger identity assurance.
3. For a confirmed-dead row lacking positively matched claim ownership, persist a failed terminal result with the existing `orphan-released` outcome, exact attempt identity and a diagnostic reason. Reuse the settlement seam at we:scripts/conveyor/build-dispatch-orphan-adopt.mjs:355-368, but report write failure rather than announcing successful reconciliation. Reread and validate the exact row/handle/status before settlement; preserve a terminal result written in the meantime. A subsequent pass must be idempotent. No claim release, marker deletion, hold mutation, resume, fresh spawn or lane mutation belongs to this row-only path; this avoids the item-keyed release hazard at we:scripts/conveyor/build-dispatch-claim.mjs:70-85.
4. Refresh build occupancy and settled evidence after reconciliation in the live shell/tick boundary, so the same ordinary tick consumes persisted results rather than its pre-pass cache (we:skills-src/conveyor/build-dispatch-daemon.mjs:299-300 and :1451-1458). Preserve read-only dry runs and freeze behavior (we:skills-src/conveyor/build-dispatch-daemon.mjs:286-291). Fresh scheduling remains a separate existing decision; reconciliation itself never interprets missing ownership as a restart request.

## MVP

One implementation slice in the four existing scope files, including both test suites. Add attempt enumeration and conservative liveness handling to the adoption module, observable exact-row settlement, and post-reconciliation occupancy refresh to the daemon. Keep existing claim-backed resume behavior covered. No new dispatch provider, lease-reaper behavior, multi-repo capability, ownership-token migration, or global deadline-policy change is needed for this card; the unsafe item-level release already has a documented separate gap (we:scripts/conveyor/build-dispatch-claim.mjs:70-80).

The implementation must satisfy the integration and soak acceptance below; this preparation changes only this card and does not perform either operational probe.

## Test plan

- Extend we:scripts/conveyor/__tests__/build-dispatch-orphan-adopt.test.mjs:301 with zero-claim runs, claim-plus-row deduplication, multiple attempts for one item, non-build/terminal exclusions, and malformed/unreadable records. Verify every eligible attempt is considered once and an older dead row cannot modify a newer claim, marker or live row. Existing synthetic row setup is at we:scripts/conveyor/__tests__/build-dispatch-orphan-adopt.test.mjs:317-320.
- Cover alive, ESRCH, EPERM, unavailable/throwing/null probes, malformed handles, bound live/pending resumes and foreign-attempt markers. Assert protected rows remain byte-for-byte unchanged. Verify terminal reread, write failure and repeated ticks; no false success on failed persistence. Keep the existing claim-backed classifier/resume regressions at we:scripts/conveyor/__tests__/build-dispatch-orphan-adopt.test.mjs:24 and :341.
- Extend we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs:368 through the real file-store reader boundary, using the temporary store/coordination pattern at we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs:1011-1030. Start a disposable child, persist its actual PID handle, wait for its exit, leave no claim, and seed an isolated lane lease for a different session. Run ordinary reconciliation with real persistence and read occupancy through the real reader. Assert terminal persistence and zero phantom occupancy in that same tick, zero dispatch/resume calls and unchanged replacement lease. Use an empty candidate queue to isolate bookkeeping from independent scheduling.
- Repeat with a live child and unavailable liveness, including a deadline already passed: reconciliation must not retire either row. Include a tick starting with cached occupancy to catch the shell-order defect, plus dry-run and freeze cases. Clean up children, temporary stores and environment overrides in finally/teardown; never use a production lane for automated tests. Run both scoped Vitest suites, then the required lane verifier and standards gate; test scope is already declared in frontmatter.

## Proof plan

1. In the implementing lane, run the real-store/exited-child/foreign-lease integration probe described above. Attach timestamped before/after run, claim and lease evidence, the actual child PID and observed exit, persisted terminal outcome, occupancy from the consumer, and spawn/mutation counts. Repeat for live and unknown controls. The production boundary under proof is we:skills-src/conveyor/build-dispatch-daemon.mjs:734-763, not just the classifier return value.
2. Soak break: after the controlled child exits, stop active changes for at least **30 minutes and at least three naturally scheduled observer ticks**. Observe zero phantom slots, duplicate spawns or replacement-lease changes; attach timestamped run/claim/lease evidence before and after. Use isolated fixture state and ordinary scheduled observation, with no eligible fresh work. Do not replace scheduled ticks with repeated manual invocations or claim the soak from unit tests. The ordinary loop and tick reporting are at we:skills-src/conveyor/build-dispatch-daemon.mjs:1466-1477.
3. Run `node we:scripts/verify-lane.mjs` and `npm run check:standards` in the implementing checkout; record actual results. Preparation checks establish card validity only, not implementation completion.

## Follow-ups

- Keep serializer-to-consumer and process-lifecycle probes at the real boundary. The existing claim suite injects synthetic rows (we:scripts/conveyor/__tests__/build-dispatch-orphan-adopt.test.mjs:317-328), while the daemon already demonstrates real temporary stores (we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs:1011-1030). Record testing lessons here, not in shared agent documentation.
- The diagnosis session's permission failures are historical, not a reason to skip new gates (we:reports/2026-09-30-builder-launch-misread-root-causes.md:103-111). Report any current failure separately without bypassing locks or weakening tests.
- Stronger process-generation identity and ownership-token migration remain separate work if needed; this slice must conservatively retain ambiguous rows and avoid item-level ownership mutation. Existing limitations are explicit at we:scripts/conveyor/build-dispatch-claim.mjs:70-80 and we:scripts/conveyor/build-dispatch-orphan-adopt.mjs:62-69, including lack of independently recorded inner-agent identity.

## Progress

- Preparation rechecked the original premise against current code: claim-only adoption and run-based occupancy still coexist (we:scripts/conveyor/build-dispatch-orphan-adopt.mjs:436; we:skills-src/conveyor/build-dispatch-daemon.mjs:745-757). The original daemon citation at line 731 was a comment; the reader now starts at line 734. “Unstamped” here means missing liveness observation, not a preparation stamp.
- Original scope was the adoption module, daemon and their two test suites; retain those four files. Corrected design adds the live-shell cache refresh inside the already-scoped daemon (we:skills-src/conveyor/build-dispatch-daemon.mjs:1451-1458), exact-attempt enumeration beyond latest-per-item (we:scripts/conveyor/build-dispatch-orphan-adopt.mjs:115-126), and unknown-preserving probing instead of boolean coercion (we:scripts/conveyor/build-dispatch-orphan-adopt.mjs:214). These refine the existing goal without changing policy or a ratified decision.
