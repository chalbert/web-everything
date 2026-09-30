---
bornAs: xaa7c2w
kind: decision
parent: "3383"
status: open
preparedDate: "2026-09-30"
dateOpened: "2026-09-23"
tags: []
---

# Decision: permission profiles for all agent work (scoped by default, wrapper-run requests)

Follow-up of #3922. Amend #agent-mutations-through-typed-operations so every agent session runs under a permission profile chosen by its kind of work. Default scoped: reserved files, declared operations only, request-run and request-scope handled by the wrapper, every call tracked. Some kinds get wider profiles (for example an unscoped investigation). Rules the profile list, who gets which, who may widen. Must weigh that 72.2% of agent commands are low-risk reads.

## Done when

1. **Executable** — A unit test verifies the wrapper rejects an agy or codex job attempting to write to a file outside its declared scope, unless a `request-scope` operation was granted.

## Fork 1: The enforcement model (How to confine the agent's file access)

Today, scope is only checked after the work. The probation runner discarded #4389 because of one out-of-scope test file being modified, and concurrent jobs repeatedly conflict on shared files. We need a mechanism to enforce scope bounds during the job.

- **(a) Read-only lane file ownership (Orchestrator's Proposal):** Files outside a job's declared scope are read-only at the filesystem level in its lane.
- **(b) macOS sandbox profiles / seccomp:** Wrap the agent's process in a strict system-level sandbox.
- **(c) Containers / VMs:** Run the job inside an ephemeral Docker container or VM with mounts specifically constructed for the allowed scope.
- **(d) Post-hoc refusal (Status Quo):** Continue to allow writes, but reject the PR upon completion if the diff contains out-of-scope files.

**Tradeoffs & Evidence:**
- Provider tooling limits enforcement: Codex has explicit support for `sandbox_workspace_write.writable_roots` (`we:backlog/4665-codex-build-fix-jobs-run-in-a-sandbox-that-cannot-verify-or.md`), but agy has **no real write confinement** (`--sandbox` confines only its shell, not its native file tools; `we:scripts/gemini-direct-task.mjs#L67`). Thus, trusting the provider's sandbox flag is insufficient.
- Relying on OS sandboxing (b) or containers (c) provides strong guarantees but is heavy to implement before the builder is stable, potentially hurting the fast iteration loop.
- Modifying filesystem permissions (a) in the lane is lightweight but can be tricky with tools like git that manipulate file metadata or need to write lock files.
- The status quo (d) wastes agent time, as seen with #4389, and fails to prevent concurrent conflicts.

**Recommendation:** **(a) Read-only lane file ownership**, moving to (c) full containers later once the builder is stable. It's the most practical first step for preventing wasted work.
**Skeptic:** Changing file ownership dynamically per-job is brittle; git operations on read-only files might fail unexpectedly, and tools that recreate files (like Prettier) will crash.
**Screen:** Confirmed that the recommendation acknowledges the transition to containers later; the orchestrator's proposed first step is sound.

## Fork 2: Scope widening (How an agent requests to edit more files)

Agents often discover they need to touch a file outside their initial scope (e.g., updating a shared utility to fix a bug). This relates directly to the `request-scope` operation proposed in `we:backlog/3994-planner-build-step-operations-and-permissions-in-lane-ops-re.md`.

- **(a) Scope-request operation with overlap check (Orchestrator's Proposal):** Agent calls a `request-scope` operation. The wrapper checks for overlap against open PRs and running jobs. If no overlap, the wrapper widens the scope dynamically. If there's overlap, it queues the job or escalates to a human.
- **(b) Hard deny:** No dynamic scope widening. If an agent needs more scope, it must abort and explicitly request a human to spawn a new job with a wider scope.
- **(c) Auto-grant on open PRs only:** Like (a), but ignores running jobs to simplify the overlap check.

**Tradeoffs & Evidence:**
- (a) prevents concurrent jobs from colliding on the same files, which is a stated problem ("concurrent jobs repeatedly conflicted on shared files").
- Implementing the overlap check for (a) requires a central state of what jobs are running and what PRs are open.
- (b) is the safest but highly frustrating for agents making legitimate, small boundary expansions.

**Recommendation:** **(a) Scope-request operation with overlap check**. It aligns with #3994 and solves the concurrent conflict issue directly.
**Skeptic:** The overlap check could lead to deadlocks or long queues if jobs frequently expand into common shared files.
**Screen:** Confirmed that overlap check against both open PRs and running jobs is necessary to actually prevent the conflicts mentioned in the prompt.
```javascript
// Concrete code example for the scope request
const result = await operations.requestScope({
  files: ['we:src/shared/utils.ts'],
  reason: 'Updating utility to support new parameter added in main scope'
});
// result.granted === true
```

## Fork 3: Provider limitations & escapes (.git, test/tmp)

Tools require access to certain directories to function properly, even if those directories aren't in the explicit work scope.

- **(a) Strict explicit allowance (Codex model):** Only the specific `.git` directory, the lane-pool admission root, and a unique per-run temp directory are writable (as done for Codex in `we:backlog/4665-codex-build-fix-jobs-run-in-a-sandbox-that-cannot-verify-or.md`).
- **(b) Blanket allow `.git` and `/tmp`:** Give all jobs write access to any `.git` folder in the lane and the system `/tmp`.

**Tradeoffs & Evidence:**
- (a) ensures jobs don't interfere with each other's temp files or break shared admission locks. We saw soak fixture temp failures (ENOTEMPTY) before this was fixed in #4665.
- (b) is easier to implement but risks exactly the fixture and git lock collisions #4665 solved.

**Recommendation:** **(a) Strict explicit allowance (Codex model)**.
**Skeptic:** This requires the wrapper to inject specific `TMPDIR` paths into every agent session and ensure the `.git` directory is explicitly whitelisted in the read-only lane enforcement.
**Screen:** Confirmed that #4665 already provides the pattern for this; applying it universally is the right move.
