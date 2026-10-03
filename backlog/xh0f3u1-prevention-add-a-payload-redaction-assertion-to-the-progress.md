---
kind: story
size: 3
parent: "4075"
status: open
scope: ["plateau:src/wip/payload-leak-check.ts", "plateau:src/wip/payload-leak-check.test.ts", "plateau:src/wip/progress-read.test.ts", "plateau:src/wip/wip-publish.test.ts", "plateau:src/wip/wip-agent.test.ts"]
dateOpened: "2026-10-01"
preparedDate: "2026-10-03"
preparedAgainstSha: "6f5f01b8ebf6587390e4e87320b3a97b45fe90ee"
tags: []
---

# Prevention — Add a payload-redaction assertion to the progress-runs and wip-publish test list. Better, add a shared… (from chalbert/web-everything#3327 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4624-show-actual-executors-and-standalone-jobs-in-plateau-running.md:79` — Add a payload-redaction assertion to the progress-runs and wip-publish test list. Better, add a shared leak-check helper that every publisher fixture test runs against the serialized payload.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3327@c57098509c4ea43995028750603a59c912694ebf

## Progress

Preparation research on 2026-10-03 inspected Plateau checkout `2e9ae55b4460693ff54294cadf958e065de44e7e` (clean working tree). No runtime tests or live publication were performed; this is a card-only preparation.

- **Old premise/scope:** the approval points to line 79 of `we:backlog/4624-show-actual-executors-and-standalone-jobs-in-plateau-running.md` and scopes only that parent card, with a proposed progress-runs suite and publisher assertion. The parent has since become a split epic; its **Test plan** and **Proof plan**, rather than that stale line number, carry the relevant acceptance requirements.
- **Corrected premise:** `plateau:src/wip/progress-runs.ts` and `plateau:src/wip/progress-runs.test.ts` do not exist in the inspected checkout. Current run projection is `readMoving` in `plateau:src/wip/progress-read.ts:52-64`; it explicitly selects fields and omits transcriptPath. Its existing tests in `plateau:src/wip/progress-read.test.ts` use null transcript paths and check policy-history exclusion, but do not exercise a contaminated run against a shared payload guard.
- **Source evidence:** `plateau:src/wip/wip-publish.ts` serializes the supplied snapshot in `publishOnce`; `plateau:src/wip/wip-publish.test.ts` checks request equality and token-free error results, not secret-bearing source fixtures projected into outbound bodies. `plateau:scripts/wip-publish.ts` also uses `createAgent` for the normal WebSocket mode. `plateau:src/wip/wip-agent.ts:151-167` serializes snapshot frames; its fake socket in `plateau:src/wip/wip-agent.test.ts` currently parses sent frames before storing them. Testing only HTTP would miss this active path.
- **Corrected scope:** a Plateau test-only helper and its matching unit test, plus the existing projection, HTTP publisher and WebSocket publisher suites. Runtime modules above are read-only evidence, not planned edits. The helper is new; the other scoped tests already exist. This replaces a parent-card-only scope with executable prevention at the current seams. The future standalone adapter remains a follow-up, not an invented prerequisite or an implementation hidden in this item.
- **Existing requirement, not a new policy choice:** `we:docs/agent/plateau-progress-view.md:132` forbids credentials, absolute transcript paths and raw transcripts in the overview. The goal is not already delivered by the error-result assertions. This preparation does not claim that current production payloads leak.

## Design

Add a test-only `assertPayloadHasNoLeaks` helper (proposed) in `plateau:src/wip/payload-leak-check.ts`, accepting the actual serialized JSON string and an explicit list of forbidden synthetic values. Validate JSON and require a nonempty marker list; inspect decoded string values and keys recursively so JSON escaping cannot conceal a fixture marker. Return no transformed payload. Failure messages identify the marker category or index without echoing its value or the full payload.

Use distinct deterministic markers for a credential, raw prompt/tool transcript content, and absolute transcript paths (POSIX and Windows forms). This is a fixture regression oracle, not a universal secret detector: do not invent regex rules that reject legitimate URLs, public descriptions, or repository-qualified paths. Authentication headers remain required and are outside the snapshot-body assertion.

In `plateau:src/wip/progress-read.test.ts`, feed `readMoving` a populated row with a non-null private transcriptPath and extra private source fields, keeping legitimate public metadata populated. Check its serialized projection with the helper and assert the expected public fields and counts survive. Carry that real projection into populated publisher fixtures instead of constructing only an empty snapshot or passing raw source records straight to transport.

In `plateau:src/wip/wip-publish.test.ts`, inspect the captured fetch body before parsing or normalizing it. In `plateau:src/wip/wip-agent.test.ts`, retain raw fake-socket sends alongside the existing parsed representation and check snapshot frames before parsing. Apply the shared guard to every snapshot-publishing fixture in those suites, including HTTP fallback; exclude non-snapshot protocol messages. Preserve existing behavior assertions so an empty or dropped payload cannot satisfy the guard alone.

## MVP

One shared test helper, its own positive/negative tests, a contaminated-source projection regression and guard calls at both serialized transport boundaries. Cover credentials, raw transcript text and absolute transcript paths using synthetic fixtures only. No production sanitizer, schema change, live credential read, relay deployment or standalone run adapter is included. If a test exposes a real runtime leak, record the exact synthetic reproduction and prepare a separately scoped runtime fix rather than silently expanding this test-only item.

## Done when

1. Every snapshot-publishing fixture in the scoped HTTP and WebSocket suites invokes the common guard on its serialized payload; populated run metadata remains present.
2. Private source markers are absent after current run projection, and legitimate descriptions, identifiers, timestamps and counts remain correct.
3. The helper rejects each deliberately leaked marker, including nested arrays, keys and escaped string values; rejects invalid JSON and an empty marker set; accepts safe populated JSON.
4. The targeted test command passes with the guard installed. Reintroducing transcriptPath into the run projection or injecting a forbidden marker into either transport payload makes the corresponding test fail. A pre-change green suite alone is not proof of prevention.

## Test plan

- `plateau:src/wip/payload-leak-check.test.ts` is the matching test for the new `plateau:src/wip/payload-leak-check.ts`. Table-test each marker category, nesting, JSON escaping, safe payloads and invalid helper inputs. Assert diagnostics do not reproduce sensitive marker text.
- `plateau:src/wip/progress-read.test.ts` covers the current source-to-public-run boundary with populated hostile input and positive output assertions. Test unknown states as well as working rows so private extras cannot escape through alternate projections.
- `plateau:src/wip/wip-publish.test.ts` checks the real serialized HTTP body and preserves the bearer-header assertion separately. Keep existing error-result tests; they cover a different boundary.
- `plateau:src/wip/wip-agent.test.ts` checks raw serialized snapshot frames and the disconnected HTTP fallback fixture with the same marker inventory. Assert the expected snapshot is actually sent and contains the populated run.
- From the Plateau repository, run `npx vitest run` with these explicit arguments: `plateau:src/wip/payload-leak-check.test.ts`, `plateau:src/wip/progress-read.test.ts`, `plateau:src/wip/wip-publish.test.ts`, and `plateau:src/wip/wip-agent.test.ts` (strip the repository prefixes when passing filesystem arguments). Add the helper tests first: the missing helper should produce the initial red result. Existing runtime omission behavior may already pass; the mutation checks prove the new regression sensitivity.

## Proof plan

1. Record the tested Plateau revision and exact targeted command, exit status and test totals. Use only in-memory synthetic inputs and fake transports; no paid worker or authenticated relay call is necessary.
2. Capture that the same contaminated-source projection reaches the HTTP request body and WebSocket snapshot frame, with expected public metadata intact. Record assertion outcomes rather than copying private fixture values into logs.
3. Temporarily mutate each boundary independently: restore transcriptPath to `readMoving` output; append a marker to the HTTP body; append a marker to the WebSocket snapshot. Each mutation must fail its corresponding suite. Remove each mutation and rerun the targeted command to green.
4. Review all snapshot fixture publication sites in the two publisher suites for guard coverage, including fallback. Record any unexercised branch explicitly; do not infer transport coverage from the helper's unit tests.
5. The runner owns preparation stamping and repository checks. This preparation leaves no stamp, commit, push or PR and claims no completed implementation proof.

## Follow-ups

- When #xk7jz9n adds `plateau:src/wip/progress-runs.ts` and `plateau:src/wip/progress-runs.test.ts`, reuse the helper for every standalone producer fixture and pass its populated projection through the same transport assertions. Reconcile the landed interface before adding that scope.
- Broader secret discovery, scrubbing arbitrary public text, and error-log redaction are separate work. A marker oracle catches known fixture leakage, not every possible credential spelling.
- Preserve the original #4624 integration proof requirement: fixtures supplement, rather than establish, evidence about live overview payloads. This item requires no live-data collection during preparation.
