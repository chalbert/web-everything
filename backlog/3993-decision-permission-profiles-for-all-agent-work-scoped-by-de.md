---
bornAs: xaa7c2w
kind: decision
parent: "3383"
status: open
dateOpened: "2026-09-23"
preparedDate: "2026-09-30"
preparedAgainstSha: "7e285f7519d5acf81b6b3042a12a6417f4f3c88b"
tags: []
---

# Decision: permission profiles for all agent work (scoped by default, wrapper-run requests)

## Prepared digest — recommendation, not a ruling

**Recommend preventive, wrapper-owned source-write scopes for agent jobs, with narrow scope requests granted only after an atomic reservation check.** Preserve broad sandboxed inspection, the existing stricter step/reviewer rules, and post-run checks. The operator's 2026-09-30 direction (strict file rights soon, full containers after builder stabilization) is compatible with this recommendation **only if “read-only” is enforced against every worker write channel**, not merely by prompts or reversible file modes. No implementation or backend has been approved by this preparation.

Two policy forks remain: the minimum guarantee a job profile promises, and who may expand its authority. Filesystem permissions, macOS sandboxing, and containers are interchangeable or composable enforcement mechanisms, not competing WE standards. The axes are grounded below in the actual post-run refusal, provider launch flags, scope matcher, and verification writes. Research is inline at the operator's explicit request; no separate report, research topic, hold file, build child, or shared-doc edit is created.

| Fork | Recommended default | Main alternative | Confidence |
| --- | --- | --- | --- |
| 1 — permission guarantee | **(a) Prevent edits outside the granted source scope before effect; fail closed if unsupported** | (b) Permit lane-wide edits and refuse the resulting diff afterward | High on guarantee; medium on first backend feasibility |
| 2 — widening authority | **(a) External wrapper grants within the operator ceiling; agent only requests** | (c) Agent self-authorizes an extension | High on authority; medium-high on automated-grant configuration |

## Fork 1 — is declared source scope an enforceable permission or a post-run acceptance rule?

**Fork-existence:** the same job cannot both be permitted to change an ungranted source path and be guaranteed unable to change it. A detector can compose with prevention, but cannot implement that guarantee: the current runner examines the diff only after the worker returns (we:scripts/operations/probation-build-run.mjs:401, we:scripts/operations/probation-build-run.mjs:441).

- **(a) Preventive profiles.** The wrapper derives a profile from the assigned role and approved work; source paths outside the grant are readable but unwritable. The grant covers create, replace, delete, rename, link, permission changes, native file tools, subprocesses, and delegated tools. A provider/backend that cannot demonstrate this profile cannot run under its name: reroute or park. Reads stay broad within the authorized sandbox; external mutations remain typed operations. This prevents accidental extra edits and scope-based concurrency drift, but requires genuine mediation and handles unsupported providers explicitly.
- **(b) Observational profiles.** Keep lane-wide editing, instructions and final diff refusal. This accommodates today's providers and arbitrary editor saves, but detects the error after effort has been spent and cannot undo effects outside the captured diff. *Rejected as the proposed default*, retained as the description of legacy behavior while migration is ungraduated.
- **(c) Prevent only planner-step writes; leave other jobs observational.** Respects the existing step boundary but leaves prepare, heal, whole-item build, and investigation-to-edit transitions with a different guarantee. *Rejected as the target policy*: role-specific permissions are useful; silent differences in whether permissions are enforced are not.

**Recommend Fork 1 (a): enforce the approved write set, retain post-hoc guards as independent evidence, and record actual enforcement capability per run.** Do not advertise all-provider prevention on ratification. Existing runners remain explicitly legacy until live canaries pass; new “scoped” dispatch must fail closed rather than falling back silently. This is an operational rule for WE's agent machinery, not a plug/block/protocol or a new WE↔FUI contract.

The amendment is deliberately narrow: extend the in-lane write boundary beyond planner steps. Do not turn the 72.2% read/inspection majority into an all-command allowlist. That measurement and the external-mutation rule live in we:docs/agent/platform-decisions.md:4691, anchor `#agent-mutations-through-typed-operations`. The step's no-free-shell rule remains a stricter exception (we:docs/agent/platform-decisions.md:5558). The tool-bearing reviewer keeps its separate operations-only/container requirements (we:docs/agent/platform-decisions.md:5234, anchor `#reviewer-tool-surface-and-containment`).

Skeptic: SURVIVES-WITH-AMENDMENT — the independent prep skeptic found the advisory-scope and Gemini-residual conflicts. This proposal explicitly amends those limits, separates permissions from clone ownership, and preserves stricter review rules.

Screen: clear — a separate fresh-context reviewer confirmed this is operational governance, not a WE standard or backend implementation choice; prevention versus observation remains a correctness difference even with zero implementation cost.

## Fork 2 — who may widen a grant?

**Fork-existence (forced invariant):** an agent cannot both enforce its own upper authority bound and unilaterally enlarge it. Agent-authored scope is input to external adjudication, not authorization. Automatic versus human approval is a supported configuration of that external authority, not a competing fork.

- **(a) Bounded mechanical grants.** The wrapper may grant an exact extension within an operator-approved profile ceiling, after fresh conflict checks and atomic reservation. Contention queues; policy exceptions escalate. Keeps ordinary omitted-test corrections flowing, at the cost of making the reservation service and its audit record authoritative.
- **(b) Human approval for every added path.** Gives the operator maximum per-request control and is a valid restrictive profile. It adds interruption even when authority and disjointness are mechanically established. Supported as a stricter profile setting; not an excluded architecture. The recommendation is to use it where judgment remains, rather than for every ordinary exact-file extension.
- **(c) Agent self-expansion or “edit now, justify later.”** Allows a model to mutate its own permission boundary and race other jobs. *Rejected*: an agent-authored card or manifest is a request, never proof that authority expanded.

**Recommend Fork 2 (a): the external wrapper alone activates rights within an explicit operator ceiling; Fork 2 (b) is its human-only configuration.** Existing per-program overlap policy already supports configurable wait/ask/force (we:scripts/readiness/scope-policy-config.mjs:10). An operator may preauthorize a narrowly described force policy; absent that authority, a worker request to force escalates. No worker can invent that ceiling. Use the existing scope normalization/overlap semantics (we:scripts/readiness/scope-lease.mjs:248; we:scripts/readiness/scope-lease-live.mjs:154), not a second string-prefix implementation. Existing `wait`, `ask`, and `force` outcomes are reusable vocabulary; their pure return value is not an atomic grant or permission change.

Proposed lifecycle, not an existing callable operation:

1. **Request:** submit job/step identity, expected grant revision, exact repo-qualified paths, requested actions, and reason through `request-scope`. Do not submit a shell command. Reject traversal, unresolved repo aliases, symlink escapes and ambiguous case aliases; check both rename endpoints and the nearest existing ancestor of a new file. Directory grants reserve their whole subtree.
2. **Evaluate:** wrapper authenticates the caller and live lease; tests the profile ceiling and task purpose; combines other running jobs' declared plus observed scopes with open PR changed-file scopes and pending reservations. Exclude only the caller's own identified lease/PR, not every job sharing its parent item. Missing/stale PR data or an unscoped active writer means unknown/held, never “no overlap.”
3. **Grant:** under one reservation lock/transaction, recheck revision and conflicts and reserve the extension before exposing write permission. Every dispatch/start, PR admission and scope extension must use that same authority. Snapshotting GitHub alone cannot lock out a human or external PR: reconcile at grant/start and drain, retain final overlap checks, and state that unmanaged actors are outside the scheduling guarantee.
4. **Activate:** stop/quiesce the worker and delegated tools, install the new policy, verify it, then resume with a new revision. A static sandbox may require restarting the process. Publish `granted` only after installation succeeds; failure leaves old rights in force and releases the pending reservation. Revocation must end old processes/open writable handles, not merely rewrite a settings file.
5. **Queue:** conflicts return blocker job/PR IDs and the exact intersection; writes to requested paths stay denied. Continue independent in-scope work only. Re-evaluate on release, merge, close or cancellation; use stable ordering and a bounded retry/time budget. Detect circular waits and replan/release one job's reservations instead of holding two jobs forever. A finished worker's paths remain reserved while its PR is open.
6. **Escalate:** protected policy/hooks, broad directory/repo grants, cross-repo expansion, profile changes, uncertain authority, exhausted waits or explicit force-overlap require an operator decision. No reply means pending. An authorized force records conflicting owners and drain reconciliation; it does not grant new external-operation authority or disable isolation. Release grants only after worker termination and final diff capture; quarantine a lane whose cleanup cannot be verified.

For #4389, the concrete request would name `we:scripts/__tests__/merge-ai-prs-merge-failure-isolation.test.mjs`, reason “required by the card's Test plan,” action create/write. A nonoverlapping, ordinary test addition within the job ceiling is granted before editing; if another running job or open PR owns it, the request queues. Shared agent docs are not incidental test outputs and need their own request. A request to expand scope must update the wrapper's accepted dispatch/card scope through an authorized operation too; otherwise today's final checker would still reject the newly allowed path.

Skeptic: SURVIVES-WITH-AMENDMENT — the independent prep skeptic dissolved automatic-versus-human approval into configuration; the actual invariant is external authority versus self-widening. Added task relevance, participating-actor limits and external-PR reconciliation.

Screen: clear — a separate fresh-context reviewer confirmed external versus self-authorized grants is a substantive authority difference; automatic versus human approval is correctly configuration.

## Context — observed evidence and limits

These are source observations at preparation time, not a claim that a new enforcement backend was executed successfully.

| Evidence | What it establishes |
| --- | --- |
| we:backlog/4389-drain-one-failed-merge-must-not-fail-the-whole-pass-and-keep.md:6 and :41 | Declared scope names only the merge implementation; the test plan requires a new test outside it. The operator reports probation discarded that run. The mismatch is verified in the card; the specific execution log was not independently recovered here. |
| we:scripts/operations/probation-build-run.mjs:146 and :441 | Exact paths/directory prefixes are checked against both item and lease scope after work. This is admission of a diff, not prevention of a write. |
| we:scripts/codex-direct-task.mjs:177, :211 and :825 | Build/fix uses `workspace-write`, adds network, real gitdir, admission directory and unique fixture temp root. Review gets `read-only` and no new roots. #4665 fixes execution prerequisites; it does not narrow the already-writable workspace to the job's file list. |
| we:scripts/gemini-direct-task.mjs:18, :137, :156 and :597 | agy edit runs skip permission prompts; `--add-dir` is bookkeeping and `--sandbox` confines its shell only. Native file tools can escape that boundary. A shell-only wrapper is not sufficient. |
| we:scripts/readiness/scope-lease.mjs:248 and we:scripts/readiness/scope-lease-live.mjs:154 | Existing pure overlap policy operates over scopes/effective leases, including wait/ask/force; neither function persists a reservation or changes OS rights. |
| we:scripts/lib/git-hook-surface.mjs:5 and :27; we:scripts/operations/probation-build-run.mjs:515 | Hook/config planting is already an identified launcher risk. Snapshot/refusal/reset protects a traditional hook surface after work; this is not general write confinement or protection from all Git executable configuration. |
| we:scripts/verify-lane.mjs:109 and :315 | Verification writes a temporary sibling of the marker and renames it in the real gitdir. Allowing just the final marker pathname is insufficient for the existing writer. |
| we:scripts/readiness/heavy-admission.mjs:532 and :962 | Verification needs a shared admission root and writable coordination state; treating all non-source writes as forbidden breaks the gate. |
| we:.githooks/pre-commit:12 and :28 | Hooks run locus lint and staged inventory generation, which can write the index. Trusted wrapper hook execution is different from giving the model mutable hooks/config/index. |
| we:scripts/lib/isolation-provider.mjs:96 | The current isolation seam describes preparation; its own contract says process/container execution and stronger guarantees need a separate execution contract. Its existence is not evidence that file confinement is implemented. |

### Backend alternatives and known occurrences

**Recommended implementation direction after ratification:** implement the grant/reservation contract once, then graduate one fully mediated host backend on the actual builder/provider pair. A whole-process macOS sandbox is a candidate on this host; it is not proven by an agy shell flag. If no host backend passes the canaries, move that provider to a container/VM or park it. Container delivery is separately scheduled, without deferring the policy contract or weakening the existing reviewer mandate.

| Approach | Guarantee and failure modes | Disposition |
| --- | --- | --- |
| Post-hoc refusal | Already shipped. Captures tracked/untracked diff problems after work; cannot prove that transient edits or writes outside the lane never happened. | Keep as backstop; insufficient for Fork 1 (a). |
| Same-user per-lane modes (`chmod`) | Denies straightforward writes but the owner can change modes back. Writable parent directories permit unlink/rename replacement; exact-file atomic saves need more than a file write bit. | Useful accidental-error signal, not a strict boundary. |
| Per-lane permissions with a distinct worker identity and wrapper-owned ACLs/parents | OS checks apply to native tools as well as shell. Must deny ownership/ACL changes and protect parent directory entries; creation/atomic replacement may need a broker. Separate identities must not share writable hardlinks or writable dependency/sibling trees. | Viable host adapter, conditional on save/create/rename and lifecycle proof; account/ownership management is real operational work. |
| macOS Seatbelt profile around the entire worker/tool process tree | Can constrain filesystem operations without changing the checkout's ownership. Escaping helper services, already-running native-tool daemons, symlinks, nested sandboxes, provider caches and exact-file saves need probes. Static-policy widening can require restart. | Candidate first host backend, never infer confinement from shell-only flags. Local `man sandbox-exec` marks the interface deprecated; avoid treating it as a portable long-term API. |
| Containers / VMs | Put workers and operation servers inside an OS boundary; support explicit mounts, resources and network policy. A fully writable lane mount still allows every lane file to change. Read-only checkout plus approved writable overlays/broker still needed; no broad host mounts, runtime socket, or publisher credentials. VM provides a separate guest kernel; a container's kernel boundary depends on its runtime. | Stronger isolation adapter; retain the same scope-request protocol. Do not pick Docker vs Apple vs another backend in this card. |

Primary prior art: the [OpenAI sandbox documentation](https://learn.chatgpt.com/docs/sandboxing) describes platform-native confinement and inherited limits for spawned commands, including Seatbelt on macOS. The [configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference) explicitly describes writable roots as **additional** roots, not a workspace subtraction mechanism. This supports the #4665 interpretation; it is not a live exact-file canary. [Docker's bind-mount documentation](https://docs.docker.com/engine/storage/bind-mounts/) provides read-only mounts and notes recursive-submount caveats. Inference: containers need an explicit source-write policy too. Local system manuals inspected read-only (`man 2 chmod`, `man 2 rename`, `man sandbox-exec`) establish owner mode changes, replacement semantics, and the deprecated launcher; no chmod/sandbox experiment was run because this preparation may create no probe files.

### Profiles — supported dimensions, not additional forks

Profile names below are proposed operational labels, not new standard vocabulary. The wrapper selects them; a job cannot claim a wider role in its prompt. All grants record role, backend/provider version, source paths, allowed operations, scratch roots, policy revision and expiry. A child receives an equal or narrower grant. Authority is separate from execution mechanism.

| Work | Source rights | Execution and widening |
| --- | --- | --- |
| Investigation | Broad authorized reads; no source writes. A genuinely unscoped investigation means broad reading, not whole-repo editing. | Sandbox scratch for experiments; transition to scoped-edit before producing repo changes. |
| Build/fix/heal | Declared item/lease source paths; include test paths at preparation. Missing scope means hold. | Existing typed external-mutation rule; in-lane executable work under declared test/build operations and their output grants. |
| Prepare | The selected card, or explicitly declared research outputs if authorized. | No automatic shared-doc/report writes. This job's card-only instruction takes precedence over generic skill outputs. |
| Planner step | Intersection of step `filesTouched`, parent approved scope, and assigned profile. | Pre-approved operations only, no free shell, per-step deny schedule. The wrapper may request parent expansion before granting the step. |
| Tool-bearing review | Source inspection; only controlled mutation-test scratch/throwaway copies. | Preserve operations-only tools and the existing container/verified-tool-list conditions. No generic investigation exemption. |
| Operator-approved broad edit | Explicit repo/prefix grant, treated as overlapping every contained path. | Human sets the ceiling, reason and expiry; no implication of permission to publish, mutate primary, or bypass hooks. |

### Source scope, Git control state, scratch and external authority

- **Git:** proposed scoped workers read the real gitdir but cannot alter `we:.git/config`, `we:.git/hooks/`, refs, index, verification attestations, or `we:.githooks/`. Resolve worktree gitdir/common-dir indirection; never recursively grant a shared common-dir because a worktree needs a log. Keep policy, operation definitions and evidence outside worker-writable control. A job legitimately editing hook source produces a candidate patch in its granted lane; the privileged wrapper must not execute that candidate as its own trusted hook.
- **Verification:** #4665 currently grants the whole real gitdir for practical verification/logging. The target profile must replace that with wrapper-owned logs and a trusted verifier writing the marker and its temporary sibling. Simply removing the grant regresses #4665; simply retaining it makes “protected Git state” false. The agent may request verification, but cannot mint green evidence. Trusted code computes results against the actual source tree; agent-written test code runs with no greater rights than the worker, not with the wrapper's credentials.
- **Scratch:** provide per-run temp, fixture Git repos, test reports, coverage, browser artifacts and build outputs as explicit non-source capabilities. Inventory actual writes before enabling a profile. A source test/snapshot change still needs source scope; an ignored directory is not automatically safe scratch. Symlink/rename from scratch into source stays subject to the source policy. Shared admission locks belong to a broker/trusted test operation; never expose the whole lane pool. Isolate or mediate package/provider caches and declared localhost test ports.
- **Reads/network:** broad reads mean authorized repo/reference inspection, not a promise of secret protection or unlimited host access. Network enablement in #4665 is not HTTP-method restriction. Confinement alone cannot stop credentialed publish/merge calls: the typed-operation authority and credential boundary remain necessary. Preserve the free-read principle, distinguish a command that inspects from a test that executes worker-editable code.
- **Lifecycle:** before lease reuse, terminate descendants, revoke grant revisions, remove mounts/ACLs and verify baseline permissions. Preserve quarantined evidence if cleanup fails. No worker may retain an old grant after a widening rollback or lane reassignment.

### Relation to #3994 and existing rules

The authoritative step requirement is already ratified in we:docs/agent/platform-decisions.md:5533, anchor `#planner-build-plan-and-execute`, especially clause 7 at :5558. #3994's current story explicitly implements in-lane operations, `request-run`, `request-scope`, per-step settings and the step deny table (we:backlog/3994-planner-build-step-operations-and-permissions-in-lane-ops-re.md:13).

#3993 generalizes the profile/authority model across job kinds; #3994 should consume that common grant service and supply step-specific intersection and scheduling. It does not create a parallel widening service. Its already-ratified no-free-shell and step constraints do not need this card to be re-ruled. Ratifying this card would require its eventual build to depend on the chosen common enforcement/reservation slice; no dependency or implementation changes are made here.

Explicit precedent amendments proposed, not yet made: we:docs/agent/platform-decisions.md:5577 accepts Gemini writing elsewhere as a residual until containers exist. Fork 1 (a) would retire that exception for any job advertised as preventively scoped: an equivalent proven host boundary may qualify; absent one, reroute or park. This does not rewrite history or pretend existing jobs already have that guarantee. Likewise we:scripts/readiness/scope-lease.mjs:10 states that file scope is advisory and the whole-clone lease is the real lock; we:scripts/lane-pool.mjs:2211 calls the current overlap check advisory/non-blocking. The new permission policy amends the advisory-only limit, while retaining whole-clone lane ownership. The local reservation transaction is new scheduler coordination using the existing matcher, not an existing file lock and not a replacement for lane leases. Historical scope-rule lineage is #2574/#2679; its non-WE codification home is not used here as an uninspected authority.

Standing-test/classification pass: (1) operational governance in WE tooling, not standards/runtime placement; (2) no protocol-versus-intent dimension; (3) expose role, source, scratch, operations and authority axes separately; (4) backend/profile choices are configurable, the preventive guarantee is the policy fork; (5) enforcement adapters are injectable behind a verified execution contract; (6) broad sandboxed reads within the role ceiling, never maximally broad mutation by analogy to UI defaults; (7) no intent seam. Review and planner-step precedents have narrower scopes and retain their stricter rules. No new glossary term or standard entity is proposed.

## Follow-ups — only after an operator ruling

- Reconcile the eventual rule into `we:docs/agent/platform-decisions.md#agent-mutations-through-typed-operations`, composing with `#planner-build-plan-and-execute` and the reviewer rule; do not rewrite those statutes during preparation.
- Predict build touch sets separately: reservation/normalization in we:scripts/readiness/scope-lease.mjs and we:scripts/readiness/scope-lease-live.mjs plus their tests; typed requests in we:scripts/operations/ plus operation tests; provider enforcement in we:scripts/codex-direct-task.mjs, we:scripts/gemini-direct-task.mjs and we:scripts/lib/isolation-provider.mjs plus their tests; Git/verification integration in we:scripts/lib/git-hook-surface.mjs and we:scripts/verify-lane.mjs plus their tests. These are estimates for future child scoping, not a build scope on this decision. Avoid giving all children the same broad shared prefix.
- Required live graduation proof per provider/backend: shell **and native tools** can edit an allowed file; cannot write/replace/delete/chmod an ungranted sibling, plant Git config/hooks, traverse symlinks/hardlinks, or reach another lane; exact new-file creation and editor atomic-save paths work without widening the whole parent. Verify external helpers and descendants share the restriction.
- Race two requests for the same path and prove only one grant activates; queue an overlap with an open PR after its worker exits; test stale/missing PR data, case aliases, grant replay, restart, rollback, expiry, deadlock and cleanup. Show a formerly refused #4389-shaped test addition succeeds only after grant, with no retrospective exemption.
- Re-run child-driven verification under the chosen backend: real marker plus atomic temporary sibling, admission coordination, Git temp fixtures, build/test artifacts and declared local servers. Preserve #4665's useful execution rights through trusted operations; demonstrate that the child cannot forge the result. Keep gate scope and tests intact when diagnosing permission failures. Testing lessons stay here, not in shared agent docs.
- Container graduation requires the same file-scope canaries, credential/network isolation and live builder completion; “builder stable” means recorded end-to-end completion through denied write → request → grant/queue → edit → test → trusted verification → cleanup, not unit tests alone.

## Done when

Preparation is complete when both policy forks have evidence, alternatives, tradeoffs, bold recommendations, independent skeptic/screen verdicts, and the prepared stamps; the card remains open. Ratification belongs to the operator. Implementation acceptance belongs to scoped follow-on work and its live canaries, not a fictitious command that turns this decision into code.

### Review jury (provisional — pre-registered #2638)

Care level: `high`. This jury binds against the item's predicted scope and is re-checked against the real diff at PR open.

| juror | lens | grounding method | pre-registered expectation |
| --- | --- | --- | --- |
| correctness#1 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| correctness#2 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| security#1 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| security#2 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| simplicity#1 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| simplicity#2 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| standards-conformance#1 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |
| standards-conformance#2 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |
| claim-accuracy#1 | claim-accuracy | static-review | Every factual claim the change makes about the repo holds against the repo: a cited path:line names what is actually there, a quoted grep literal really matches, a stated count is the real count, a referenced id or link resolves, and anything the description says was changed appears in the diff. |
| claim-accuracy#2 | claim-accuracy | static-review | Every factual claim the change makes about the repo holds against the repo: a cited path:line names what is actually there, a quoted grep literal really matches, a stated count is the real count, a referenced id or link resolves, and anything the description says was changed appears in the diff. |

## Preparation verification (2026-09-30)

The required `node we:scripts/verify-lane.mjs` completed green: its selector found one changed card, no related Vitest tests, and ran the standards gate successfully. The separate `npm run check:standards` also passed with zero errors (4,556 repository warnings). `npm run check:health` exited zero before and after stamping; its 2,006 repository-wide findings contain no #3993 entry. Locus-prefix lint and `git diff --check` passed. These checks validate the preparation artifact, not the proposed permission system; live backend canaries remain follow-on acceptance work.
