---
bornAs: xnb0gxj
kind: decision
parent: "3383"
status: open
relatedTo: ["3456", "3611", "3608", "3610", "3612", "3609", "3593", "3594", "3569", "xyp1wsl", "xfxt77w", "3427"]
dateOpened: "2026-09-07"
tags: [conveyor, capacity, isolation, container, apple-silicon, platform]
---

# Real OS-level resource isolation per dispatched lane — is Apple's container/Containerization framework (Apple Silicon-only, 1.0 June 2026) the right foundation?

Live incident 2026-09-07: a busy-spin bug in a dispatched agent's Monitor command (a while/until wait-loop with no sleep in its body, caught and manually killed after 3.5+ minutes at 95-98% CPU, we:backlog/3594) burned host CPU with nothing to contain it, and the same night 42 concurrent claude -p sessions launching in one tick drove 1-min load average to 34.95 on a 12-core host (we:backlog/3612-cap-concurrent-dispatched-lanes-with-a-max-concurrent-lanes.md, we:backlog/3609-a-manual-emergency-pause-new-dispatch-lever-distinct-from-th.md). Everything filed tonight in response — we:backlog/3456's heavy-command admission cap, we:backlog/3611-hardware-usage-aware-heavy-command-capacity-control-a-staged.md's staged self-learning admission project (epic, parent #3456, filed but not yet merged, PR #1998) with its own we:backlog/3608-stage-1-sample-real-cpu-memory-usage-per-heavy-command-run-a.md (Stage 1 sampling) and we:backlog/3610-how-far-to-take-heavy-command-admission-control-beyond-stage.md (the EWMA-vs-learned-policy fork), we:backlog/3612's MAX_CONCURRENT_LANES dispatch ceiling, we:backlog/3609's manual pause lever, and we:backlog/3593-catch-and-correct-agent-instruction-slips-mechanically-a-syn.md / we:backlog/3594's instruction-slip scanner — is either ADMISSION (deciding whether to let a lane or heavy command start at all) or DETECTION (statically flagging a badly-written Monitor loop after the fact, report-only). Confirmed by reading each in full: none of them CONTAIN what an already-admitted, already-running process actually does to host resources once it is running. A perfect admission policy plus a perfect static scanner still would not have capped the busy-spin loop's CPU draw once it started — only a hard ceiling enforced by the OS itself would. This item is that different, deeper axis, filed as a sibling of 3611 (parented directly under #3383, not under 3611 or #3456) because 3611 is scoped narrowly to we:scripts/readiness/heavy-admission.mjs's command-counting semaphore and never touches per-process resource caps, and 3612 is scoped to how many lanes get dispatched, not what a dispatched lane's process can consume once running.

Checked before filing: grepped this repo for any existing resource-capping primitive (ulimit/cgroup/nice/renice/cpulimit/rlimit) across we:scripts/ and we:skills-src/ — zero hits; genuinely new ground. Searched we:backlog/ for 'container'/'virtualization'/'resource isolation'/'sandbox' in a capacity/conveyor context — nothing exists; the one superficially similar hit, we:backlog/3141-safe-edit-sandbox-discard-or-emit-pr-orchestration.md, is an editor undo/discard buffer, unrelated to OS-level process isolation. Checked we:backlog/2445-plateau-loop-extract-the-delivery-machinery-into-a-coordinat.md, we:backlog/2505-plateau-loop-operable-backlog-console-built-fresh-in-plateau.md, we:docs/agent/platform-decisions.md, and we:skills-src/mechanical-delivery-doctrine/SKILL.md for any existing target-hardware/audience statement: none exists anywhere on record. So the operator's framing tonight (Apple Silicon is an acceptable hard requirement because Plateau Loop targets an early-adopter audience, not legacy-hardware breadth) is not contradicted by anything already written, but it is also not yet a codified platform decision — if this item is ratified toward building on Apple's tool, its own resolution should be the first place that gets stated explicitly in we:docs/agent/platform-decisions.md, not left as an assumed conversational premise.

Researched (cited, current as of 2026-09): Apple's container CLI plus the open-source Containerization framework (github.com/apple/container, 1.0.0 shipped 2026-06-09) runs each container as its own dedicated micro-VM via Virtualization.framework/vmnet, not a shared-kernel model like classic Docker. Apple-Silicon-only per the project's own README (no Intel Mac support, ever — architectural, not a temporary gap); full functionality (container-to-container networking specifically) needs macOS 26. container run --cpus N --memory NgB are real, documented flags (https://github.com/apple/container/blob/main/docs/command-reference.md); because each container is a separate VM rather than a cgroup inside a shared kernel, the cap is enforced at hypervisor/VM-allocation level, a materially harder boundary than Linux cgroup throttling (this is an architectural inference, not a directly-quoted Apple guarantee — flagged as such). Filesystem isolation is strong (a separate EXT4 disk per container, no shared namespace outside an explicit volume mount); networking gives each container its own IP plus outbound NAT, so reaching api.anthropic.com should work unmodified, though container-to-container networking and DNS-after-sleep/wake are documented rough edges even on macOS 26, and small-file-heavy I/O (relevant to mounting a large node_modules-bearing git worktree read-write) has an open upstream complaint about being slower than Docker Desktop/OrbStack's shared-VM model (apple/container#948). The one real friction point for running the claude CLI inside such a container: the guest is a separate Linux VM with no macOS Keychain at all, so Claude Code's normal interactive OAuth/browser login flow has nothing to complete against inside the container — the practical path is ANTHROPIC_API_KEY env-var auth with claude --print/non-interactive mode (Anthropic's own docs confirm the env var bypasses OAuth/login), a real change from however dispatched lanes authenticate today. Sources: https://github.com/apple/container (README, https://github.com/apple/container/blob/main/docs/technical-overview.md, https://github.com/apple/container/blob/main/docs/command-reference.md, https://github.com/apple/container/blob/main/docs/networking.md), https://github.com/apple/containerization, https://thenewstack.io/apple-containers-on-macos-a-technical-comparison-with-docker/, https://github.com/apple/container/issues/948 and /issues/282, https://code.claude.com/docs/en/authentication.

What adoption would change: we:scripts/lane-pool.mjs today provisions lanes as plain filesystem clones on the shared host (git clone --reference, per-lane node_modules, zero process/resource isolation between a lane's running claude session, the host, and every other lane) — adopting per-lane containers means acquire would need to spin up or reuse (via the 1.0 container machine persistent-VM feature) a container instead of a bare directory, bind-mount the lane's git worktree read-write, and switch dispatched sessions to API-key auth.

Real tradeoffs, not glossed over: (1) this becomes a hard Apple-Silicon-only platform requirement for running the mechanical conveyor at all — acceptable per the operator's explicit framing, but a real, stated consequence that should be recorded, not assumed; (2) real migration cost against we:scripts/lane-pool.mjs's existing lease/reap/sibling-clone/port-band machinery; (3) whether a simpler, already-mature alternative solves the actual incident better — Docker Desktop and OrbStack already offer per-container CPU/memory caps on Mac (Intel and Apple Silicon both) via a mature, widely-used VM layer today, against Apple's tool being roughly three months past its 1.0 with open filesystem-throughput and DNS/sleep-wake issues, which is a real is-this-even-the-right-pick fork distinct from is-containerization-the-right-approach; (4) the eventual cross-platform goal (Linux/Windows, much longer down the line per the operator) — a Linux host already has native cgroups and needs no such tool at all, so this could end up being a macOS-specific implementation of what should be a platform-neutral resource-isolation capability the dispatcher calls through, a real design question worth naming rather than building a macOS-only escape hatch that has to be re-abstracted later.

## Amendment (2026-09-07) — could the same container also enforce operations-only + file-scope boundaries?

Folded in per the operator's own follow-up the same night, captured here rather than as a separate item.
Expanded research question: beyond resource caps, could the SAME container also serve as the enforcement
boundary for two other things filed separately tonight — (a) restricting a dispatched agent to declared
operations only (no arbitrary shell commands), and (b) file-scope enforcement (blocking an edit outside an
item's declared scope, the concern behind we:backlog/xyp1wsl-epic-edit-time-scope-enforcement-with-a-request-extension-es.md
and its build-ready first slice we:backlog/xfxt77w-block-an-edit-write-outside-a-dispatched-lane-s-own-declared.md,
both filed but not yet merged, PR #2032). Checked before writing this in: xyp1wsl/xfxt77w cover ONLY the
file-scope half (b); no existing item covers (a) — searched for any "restrict to declared operations only"
enforcement mechanism and found only we:backlog/3427-design-an-operation-manager-a-real-execution-chokepoint-ever.md
(ratified, codified in we:docs/agent/platform-decisions.md#operations-declared-once-callers-generated), which
is a software CONVENTION (operations declared once, callers generated) with no technical restriction stopping
a dispatched agent from calling the Bash tool directly outside any declared operation — (a) is genuinely new
ground, not a rediscovery.

**The mechanism this would need, to sit alongside the resource-cap ask above:**
1. A minimal container image whose only reachable entrypoint is the declared-operations CLI (we:scripts/operations/run.mjs
   `<op>`) — no general shell exposed to the dispatched agent. Structurally stronger than a permission check: the
   capability to run an arbitrary command would not exist in the environment at all, so there is nothing to bypass.
2. Read-only filesystem mounts outside the item's own declared `scope:` paths — the same protection
   xyp1wsl/xfxt77w's guard-hook approach provides, but enforced by the mount itself rather than a PreToolUse
   hook that has to correctly intercept every Edit/Write call (and, as xyp1wsl's own epic body admits, we:scripts/guard-bash.mjs
   today has NO scope-vs-edit-target check at all — a dispatched agent writing a file via a raw Bash redirect
   or `sed -i` rather than the Edit/Write tool would sail past the planned we:scripts/guard-lane.mjs arm entirely;
   a read-only mount would block that write regardless of which tool or command performed it).
3. Resource caps (the original ask, above).

**The honest cost, stated plainly rather than glossed over:** this means the ENTIRE dispatched Claude session
runs inside the container, not just its individual Bash-tool subprocess calls — today we:scripts/operations/dispatch-lane.mjs
spawns `claude --bg` on the host directly. The container needs real outbound network to Anthropic's API (the
agent cannot function without it) plus git/npm/gh tooling reachable from inside it — "locked down" here means
"only the declared-operations entrypoint is reachable from the agent's own shell," not "no network." This is a
materially bigger architectural shift than either the resource-cap work above or the guard-hook work already
filed tonight (xyp1wsl/xfxt77w) — not a small addition riding along with either.

**Recommended priority ordering, stated as this research's own view, grounded in tonight's evidence:** hard
boundaries (this container approach) > scanners (we:backlog/3594's compliance scanner) > prose doctrine
(we:skills-src/mechanical-delivery-doctrine's rules), in terms of actual trustworthiness. Tonight produced
dozens of real instruction-slip violations (we:backlog/3593) despite explicit doctrine and direct
corrections; a structural boundary does not depend on an agent behaving correctly, a scanner catches a known
bad pattern only after the fact, and prose doctrine is what gets written down once something cannot be fully
enforced. Future hardening work on this axis should sequence in that order — hard boundary first where one is
buildable, scanner as the interim/cheaper catch, doctrine as the fallback for whatever neither yet covers.

**Supersede or complement xyp1wsl/xfxt77w? Judgment, with reasoning:** complement in the near term, likely
supersede for the scope-enforcement half specifically if this container work ever ships. xfxt77w is already a
build-ready, cheap, incremental win against the two tools (Edit/Write) it actually covers, and it does not
require the architectural shift above — it should land on its own timeline, not wait on this decision. But it
is structurally weaker than a read-only mount: it covers Edit/Write only, and by its own epic's admission
leaves every Bash-tool file mutation unguarded, which is exactly the class of gap a mount-level boundary
closes for free, regardless of which tool or command the agent used. If the container approach is eventually
built, its read-only mount would make the we:scripts/guard-lane.mjs scope arm redundant for every
dispatched-lane session running inside a container — at that point keeping both is unnecessary defense in
depth rather than a real second line of defense, since the container's boundary cannot be bypassed the way a
per-tool hook can. Net: build xfxt77w now for its own cheap, real interim value; treat it as scaffolding for
this container work, not as permanent belt-and-suspenders alongside it.

## Amendment (2026-09-08) — decouple lane count from CPU: low-cpu lane containers + a separate heavy-command core pool

Folded in per the operator's own follow-up tonight, captured here rather than as a separate item, same
discipline as the 2026-09-07 amendment above: a research/idea addendum only, ratifying nothing, changing no
status, resolving no fork.

**The idea:** a dispatched lane's own orchestration — the Claude/Codex CLI session itself, waiting on API
responses, doing git operations, editing files — runs through Node's async event loop and is mostly I/O-bound,
not CPU-bound: it spends the large majority of wall-clock time waiting on network I/O, during which it
consumes near-zero CPU. The CPU-hungry part is specifically HEAVY COMMANDS — `test:unit` spinning up vitest
workers, `check:standards`' static analysis, npm install/compile — a much smaller, distinct set of processes
from "how many lanes are open."

**Checked before writing this in:** we:scripts/lib/lane-concurrency.mjs's `DEFAULT_MAX_CONCURRENT_LANES = 8`
(env-overridable via `WE_MAX_CONCURRENT_LANES`) caps concurrency by lane count, with no distinction between an
idle-waiting-on-API lane and one mid-`test:unit`. we:scripts/readiness/heavy-admission.mjs already implements
the LOGICAL half of this split — a `DEFAULT_ADMISSION_CAP = 2` (env-overridable via `WE_HEAVY_ADMISSION_CAP`),
an in-process counting semaphore that heavy commands acquire "at invocation time, never at lane-acquire time"
(the module's own header comment, citing #3461/#3456) — but it shares the same core pool as every other
process on the host: it throttles how many heavy commands run at once, not how many CPU cores they get, and a
lane can still be acquired freely regardless of the semaphore's state. So it is a soft, cooperative limit
inside one shared pool, not a hard resource boundary between "lane orchestration" and "heavy command work."

**Why this belongs on #3621 specifically, not filed separately:** this item's own researched mechanism — the
`container` CLI plus Containerization framework, with `container run --cpus N --memory NgB` giving each
container real, hypervisor-enforced resource allocation (see the Researched paragraph above) — is the exact
tool that could implement this split, not merely a cooperative in-process semaphore. The refinement this
amendment adds on top of the base decision's framing: rather than (or in addition to) giving each LANE's own
container a resource cap, give lane containers a LOW cpu allocation (since orchestration is mostly idle/async)
and route heavy commands specifically into a SEPARATE, properly-cored container pool. That specific split is
not in this item's existing body above, which currently frames adoption as "each lane gets a container"
without distinguishing the lane-orchestration part from the heavy-command part. If this holds, lane count
could decouple from CPU almost entirely and scale much higher — limited by memory, disk, or provider API rate
limits instead of cores — while a smaller number of dedicated cores get reserved specifically for heavy-command
throughput. `we:scripts/readiness/heavy-admission.mjs`'s cap-of-2 semaphore is the natural sizing signal for
how many cores that dedicated pool would need, if this is ever built.

**Secondary implication, worth recording in the same amendment:** if this holds up, it could reshape how the
operator's in-progress second-machine hardware purchase decision (a separate, not-yet-filed conversation about
a Mac mini/Studio) gets sized — potentially one pool of machine(s)/cores for many cheap concurrent
lane-orchestration sessions, and a smaller dedicated core allocation specifically for heavy-command throughput,
rather than sizing hardware as if lane count and core count scale together 1:1. Not filing a new item for the
hardware decision itself — it lives in conversation, not yet in the backlog — just noting the connection here
so it isn't lost.

**Explicitly not decided by this amendment:** whether lane orchestration is ACTUALLY as idle as claimed under
real measurement (this is stated as a reasonable inference from Node's async I/O model, not a profiled claim
against this repo's actual dispatched-lane workload — an open verification question for whenever this decision
is prepared), how large the dedicated heavy-command pool should be, whether the split is even worth the added
container-topology complexity over the base per-lane-container proposal, and how this interacts with the
already-open tradeoffs above (Apple-Silicon-only requirement, migration cost against we:scripts/lane-pool.mjs,
Docker Desktop/OrbStack as a simpler alternative, eventual Linux/Windows portability). Left as an open question
for whoever prepares or ratifies this decision.

## Amendment (2026-09-08, later same day) — a single git-manager chokepoint for GitHub API calls, and push-notify execution instead of agent polling

Folded in per the operator's own follow-up tonight, later the same day as the lane-count/CPU amendment
above — same discipline as both prior amendments: a research/idea addendum only, ratifying nothing,
changing no status, resolving no fork. Two related but distinct ideas from tonight's conversation.

**Idea 1 — a single managed "git manager" bottleneck for GitHub API calls.** Tonight, GitHub's
*secondary* (burst) rate limit — not the primary 5,000/hr core quota tracked by we:backlog/3573 below —
got hit repeatedly because dozens of concurrent dispatched sessions each independently called `gh`
directly. Confirmed via fresh web research tonight (https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api):
GitHub's secondary limits cap concurrent requests at 100 (shared across REST and GraphQL together), 900
REST points/min, and 2,000 GraphQL points/min — a SHARED ceiling across the whole account, not raised by
any plan tier. Checked before writing this in: grepped this repo for every file invoking `gh` via a
subprocess call (execSync/spawnSync/execFile) — 84 files hit, confirming the decentralized-call pattern
the operator described is real, not assumed. The operator's proposed fix: route all
`gh`/GitHub-API-calling commands through a single managed chokepoint (a "git manager") that
gates/serializes them, the same pattern already built for heavy local commands via
we:scripts/readiness/heavy-admission.mjs's counting semaphore (`DEFAULT_ADMISSION_CAP`, overridable via
`WE_HEAVY_ADMISSION_CAP` — see the prior amendment above) — but gating GitHub API calls specifically
instead of CPU-heavy commands.

**Checked against we:backlog/3573 first, since it looked adjacent:** we:backlog/3573-gh-cli-rate-limits-stay-on-oauth-pat-or-migrate-to-a-github.md
is already `status: resolved` (ratified 2026-09-07, codified `one-off`) — it ratified fork (c),
instrument-first: log `gh api rate_limit`'s remaining/used on every we:scripts/conveyor/infra-blocked.mjs
retry trip, revisit a GitHub App migration only if usage data later shows sustained pressure. That
decision is about the PRIMARY 5,000/hr core quota and whether to change *auth method* (OAuth/PAT vs.
GitHub App installation token) to raise it — it does not touch the secondary burst limit at all, and a
GitHub App migration would not fix a secondary-limit hit anyway, since the secondary limits (concurrency,
points/min) are enforced per-account regardless of auth method and are not raised by any plan or app
type. So Idea 1 is adjacent to #3573 (both are "gh rate limit" concerns) but not overlapping in scope:
#3573 is about which credential to authenticate with against the primary quota; Idea 1 is about
serializing concurrent callers against the secondary burst limit. Stated plainly rather than treated as
fully novel ground, since the two are easy to conflate on a skim.

**Idea 2 — stop agents from polling; delegate execution to "the mechanic," which notifies on completion.**
A broader architectural shift: instead of each dispatched agent independently polling/waiting for a
result (a backgrounded `verify-lane` run, a PR status check, a `gh` call), delegate the actual execution
to a central mechanical authority (the conveyor/runner itself) which performs the work and pushes a
notification back when done — a push model instead of each agent running its own pull/poll loop.
Operator's stated reasoning: "more reliable and cheaper." Ties directly to two real, repeated problems
from tonight, both already on record: (a) the passive-wait/false-Monitor-claim anti-pattern documented in
we:agent-memory-src/subagent-must-not-end-turn-on-passive-wait.md and pinned at the top of this repo's
we:CLAUDE.md — a subagent kicking off a gating check via a backgrounded Bash call or untracked nested
child, then ending its turn assuming a notification will wake it, when no such notification exists
outside a harness-tracked Task/Agent job; and (b) redundant/wasteful polling itself consuming API calls
and contributing to the very rate-limit pressure Idea 1 addresses — every independent poll loop is itself
more `gh`/API traffic against the same shared secondary-limit ceiling.

**Why these belong on #3621 specifically, not filed separately:** the operator's own framing tying this
to "the prototype" suggests both ideas compose with #3621's already-recorded container/isolation work and
the heavy-task-runner/core-sharing idea in the amendment above. A central git-manager service (Idea 1) and
a push-notify execution model (Idea 2) are both instances of the same broader shift this item is already
tracking: centralize/gate shared-resource access through one managed authority, rather than many
independent dispatched agents each doing it themselves. Recorded here as the same underlying shift, not
merged into one idea — Idea 1 is specifically about GitHub API access; Idea 2 is the general
poll-vs-push execution model, which applies well beyond `gh` calls (test runs, PR checks, any
long-running gating step).

**Cross-reference, not expanded on here:** we:backlog/2660-conveyor-ui-surface-infra-blocked-lanes-distinctly-outage-ba.md
and the we:scripts/conveyor/infra-blocked.mjs/#2659 auto-retry mechanism discussed tonight are the CURRENT
reactive handling of rate-limit hits — retry after the fact, once already blocked. Both ideas in this
amendment are about PREVENTING the hits in the first place (serializing callers so the secondary limit is
never hit; reducing poll traffic so fewer redundant calls happen at all) — a different but related layer
sitting upstream of the existing reactive retry path. Noted for whoever prepares or ratifies this decision
to connect the two, not expanded on further here.

**Explicitly not decided by this amendment:** whether a single git-manager chokepoint should live inside
this item's eventual container/isolation work or ship independently of it; how a chokepoint process would
itself be dispatched/supervised without becoming a new single point of failure; what the push-notify
mechanism in Idea 2 would be built on (a long-poll, a filesystem watch, a socket, something else); how
either idea interacts with the still-open lane-orchestration/heavy-command core split from the prior
amendment. Left open for whoever prepares or ratifies this decision.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
