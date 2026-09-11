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

## Amendment (2026-09-11) — LIVE test on this machine: the tool works and the cap is real, but it does NOT fix the Codex-isolation problem

Same discipline as the three amendments above — evidence addendum only, ratifying nothing, changing no
status, resolving no fork. Everything below was **run on this machine tonight**, replacing this item's
prior documentation-only research with measurement. It was commissioned to answer one operator question:
*"if the product needs containers anyway for #3621's reasons, should the Codex-isolation fix be built on
top of that now, instead of point-fixing it twice?"*

**The short answer, stated up front because the rest is detail: no — because containerizing does not fix
the Codex-isolation problem.** The two concerns barely overlap. See "the headline negative result" below.

### Is Apple's `container` actually usable here? Yes — confirmed live, not from docs

`command -v container` exited 1 (not preinstalled), matching the parallel probe's earlier check. It is a
plain Homebrew-core formula: `brew install container` installed **1.3.1** (400.8 MB), then
`container system start --enable-kernel-install` pulled the kata-containers 3.32.0 arm64 static kernel
(`vmlinux-6.18.35`). Host: macOS 26.6.2 (build 25G83), `uname -m` = **arm64**, 12 cores. Note for this
item's own record: the body above cites "1.0.0 shipped 2026-06-09" — the tool is now three minor versions
past that, so the desk research was current when written but the project is moving.

- First run (`alpine`, cold, incl. image pull): **6s**. Warm start, three consecutive runs: **0.86 / 0.86 / 0.88s**.
- `--memory 1g` → guest sees 1102 MB total. Enforced.
- `--cpus N` → guest `nproc` reports **N+1** (1→2, 2→3, 4→5). A real off-by-one; any sizing arithmetic
  built on these flags must account for it rather than assume `--cpus N` means N visible CPUs.

### The resource cap is REAL — measured against this item's own founding incident

The #3594 busy-spin shape, reproduced deliberately: **8 infinite `while :; do :; done` spinners** inside
one `--cpus 2 --memory 2g` container.

| observed | value |
| --- | --- |
| host `com.apple.Virtualization.VirtualMachine` process | **188.3% CPU** |
| `container stats` (guest's own view) | 214.66% CPU, 5.38 MiB / 2.00 GiB |
| unconstrained equivalent on this 12-core host | ~800% CPU |

The cap held: ~16% of the machine instead of ~two-thirds of it. **This is the first direct evidence for
this item's central claim** — that a hypervisor-enforced ceiling contains an *already-running* runaway,
which neither #3456/#3611's admission control nor #3593/#3594's static scanner can. The base proposal's
core premise is now measured, not inferred.

`--volume src:/ro:ro` also behaves as the 2026-09-07 amendment's mechanism 2 assumed: a write inside the
container failed with `Read-only file system`, reads succeeded. Mount-level scope enforcement works.

Outbound network works unmodified: `https://api.anthropic.com/v1/messages` → HTTP 405 (reachable; 405 is
the correct answer to a GET), `https://api.github.com` → HTTP 200.

### THE HEADLINE NEGATIVE RESULT — a container does not close the we:AGENTS.md leak

The decisive test for the operator's question. A full clone with root we:AGENTS.md deleted (exactly
#3371 Probe 11's technique, now shipped as `createMacosDeletionIsolationProvider` in
we:scripts/lib/isolation-provider.mjs), bind-mounted read-write into a real container:

```
== 1. AGENTS.md present on mount? ==   ls: AGENTS.md: No such file or directory
== 2. git show recovery INSIDE container ==
     $ git show HEAD:AGENTS.md
     # AGENTS.md — Web Everything …          ← RECOVERED, in full
== 3. tool-bearing write ==   hello
== 4. git status ==    D AGENTS.md / ?? container-write-proof.txt
== 5. git commit ==   bb45168b test
```

The file is absent from the mount and real tool-bearing work is unaffected — **but the `git show` above
printed the real doctrine text from inside the container, exactly as it does on the host.** The container
changes nothing here, and the reason is structural: the leak lives in the mounted git object database, not
in the process boundary, so putting a VM around the directory cannot touch it. #3371 Probe 13b's finding —
6/6 tool-bearing Codex runs shelled `cat` on the doctrine file unprompted — is not mitigated by
containerizing; such an agent would simply `git show` instead.

Closing that leak means changing **what goes into the directory** (a `git archive` export, or a
`file://`-URL `--depth 1` clone — measured tonight: a plain local `git clone --depth 1` is silently
ignored, `warning: --depth is ignored in local clones; use file:// instead`, so the naive shallow-clone
fix does not work). That change costs the same with or without a container around it.

#3371's Probe 14 landed independently while this test was running and reaches the same conclusion from the
other side, more strongly: given an *ordinary, non-adversarial* task, a tool-bearing Codex session ran a
`git show` of the doctrine file at HEAD on its own initiative and recovered all 16,480 bytes — because
`git status` advertises the deletion with a ` D` line that reads as a signpost. Two independent tests,
same gap.

### The one place the container IS structurally stronger — Probe 14's gap 3

Probe 14b found a gap neither deletion nor this item had named: `-s workspace-write` restricts *writes*
only, so a session read its way **out of its own clone** into a sibling directory (a `head` of the same
filename in a sibling clone one level up), and the primary checkout sits at a well-known absolute path.
Its conclusion: "no amount of clone-level hardening is isolation on its own."

Tested tonight, because that gap is exactly the kind a filesystem namespace closes. The same escape,
attempted from inside a container with only the clone mounted:

```
sibling dir (probe 14b route):            ../sibling-AGENTS.md: No such file or directory
host primary checkout by absolute path:   /Users/…/webeverything/AGENTS.md: No such file or directory
what IS visible above the mount:          bin dev etc home lib … usr var w
```

**Both routes are gone, structurally** — the sibling directory and the host path do not exist in the
guest's filesystem at all, so there is nothing to deny and no profile to get right. This is a real win the
container delivers that neither deletion nor a Seatbelt path-deny regex achieves as cleanly, and it should
be weighed in this item's favour. It is also not urgent: Probe 14c proved Seatbelt *does* compose with a
fully tool-bearing Codex session (under `-s danger-full-access`, letting the outer profile be the only
sandbox), so gap 3 has a working cheaper interim answer today.

**Net, and the answer to the operator's question.** The two problems are *mostly* disjoint, and the half
that matters most right now is the half the container does not touch: gap 1 (history recovery) has to be
fixed by changing what goes into the directory no matter what, at the same cost either way. The container
is the eventually-cleanest answer to gap 3 only, which already has an interim fix. So there is no
"point-fixing it twice" to avoid by waiting — building the Codex fix on containers would buy one gap's
worth of elegance while inheriting the whole container migration's cost and its unresolved billing
question. #3630's wiring of the deletion backend should proceed on its own terms.

### Two real costs this item's desk research missed

1. **The host lane's dependency tree is architecturally unusable inside a Linux container.** The body
   above proposes to "bind-mount the lane's git worktree read-write"; that does not work as written.
   This repo's installed tree carries an `@esbuild/darwin-arm64` build and a `rollup-darwin-arm64` build,
   and running the real suite over the host mount dies with `MODULE_NOT_FOUND` out of rollup's own
   native-binding loader. Every container needs its own linux-arm64 dependency tree. The cost is small
   once measured — in-container `npm ci` took **14s**, produced 18,850 files with an
   `@esbuild/linux-arm64` build, and bakes into an image once rather than per-lane — but a lane's on-disk
   cost roughly doubles (a darwin tree for host tooling plus a linux tree for container work) and the two
   cannot be shared.
2. **Mount-bound I/O is measurably slower, which is in tension with the prior amendment's premise.**
   With a correct linux tree in place, this repo's real
   we:scripts/lib/__tests__/isolation-provider.test.mjs ran **15/15 green inside a real container**
   (`--cpus 4 --memory 4g`, over a mounted lane-shaped clone) — the complete tool-bearing proof this
   amendment was asked for. But it took **2.80s vs 779ms on the host**, ~3.6x, concentrated in
   mount-bound file I/O (`environment 1.22s` vs `161ms`; `prepare 566ms` vs `110ms`). Bulk read of the
   real 18,834-file / 447 MB installed dependency tree: **5s over a container mount vs 3.39s on the
   host**, ~1.5x. This quantifies apple/container#948 for this repo rather than repeating its complaint.
   It cuts against the 2026-09-08 core-split amendment, which assumed a dedicated core pool would *raise*
   heavy-command throughput: containerizing heavy commands to protect host CPU makes those same heavy
   commands slower. Whether the net is positive is now an open, measurable question, not an assumption.

### Per-lane memory floor — a number for the core-split amendment's own open question

Six concurrent idle `--cpus 1 --memory 1g` alpine containers, each with its own IP (192.168.64.16–21):
**377–380 MB host RSS each, 2,270 MB across six.** At we:scripts/lib/lane-concurrency.mjs's current
`DEFAULT_MAX_CONCURRENT_LANES = 8` that is ~3 GB of host RAM for *empty* VMs, before any agent session or
dependency tree. This confirms the 2026-09-08 amendment's prediction that lane count would become bound by
memory rather than cores — with a concrete floor of **~378 MB/lane** to size against, including for the
second-machine hardware question that amendment flagged.

### Auth: confirmed, and it is a billing decision, not a config flag

The body above flags Keychain/OAuth as "the one real friction point." Confirmed and sharper than stated:
`ANTHROPIC_API_KEY` is **not set** on this machine — dispatched sessions authenticate through the CLI's
OAuth/keychain path — so the container route requires switching to API-key auth, which is a different
*billing model* (metered API credits vs. the subscription the CLI uses), not just a different env var.
`gh auth status` confirms the token lives in the macOS `(keyring)` with `Git operations protocol: ssh`, so
a containerized lane additionally needs `GH_TOKEN` in its environment and an ssh key mounted in.

**None of that applies to the heavy-command half.** `vitest` and `check:standards` need no credentials at
all — which is exactly why tonight's in-container suite ran green with zero auth work. This is the single
biggest asymmetry between the two halves of the core-split proposal.

Mitigating, checked rather than assumed: this repo's 11 registered we:.claude/settings.json hooks are all
repo-relative node scripts, so they follow the repo into a container and keep working — a containerized
session does not silently lose the write-time guards, provided node and the linux dependency tree are present.

### Grounded effort estimate, from reading the actual code

we:scripts/lane-pool.mjs is 1,687 lines (`cmdAcquire` alone is 287); 31 files reference the pool-path
module, 45 reference the acquire path. But two of the three seams this work needs **already exist as
ports**, which materially lowers the estimate the body above implies:

- we:scripts/lib/isolation-provider.mjs (landed via #3371 Probe 11 / PR #2118) — a backend-neutral
  *directory preparation* port.
- `defaultClaudeProvider` at we:scripts/operations/dispatch-lane-io.mjs:899 (#3579) — an already
  CLI-independent *spawn* port.
- The missing third piece is named by the isolation-provider's own header: *"process/container execution
  and stronger guarantees need a separate execution contract."*

**Per-lane containers (the base proposal): multiple days, and gated on a non-engineering decision.** A new
ExecutionProvider port plus container backend at the #3579 seam; a container image (node, git, gh, the
agent CLI, linux deps); the auth/billing migration above; and reconciling we:scripts/lane-pool.mjs's
host-path lease/reap/port-registry machinery (we:.claude/lane-ports.json, `gh pr list`-driven reaping,
`--reference` object sharing) against a guest filesystem.

**Heavy-command containers only: plausibly 1–2 days for a working first cut.**
we:scripts/readiness/heavy-admission.mjs already owns the invocation-time chokepoint, so the change is
to route the command it admits through `container run --cpus N --memory Ng` against a prebuilt image
instead of executing it on the host. No auth work, no spawn-seam change, no lane-pool surgery — and it is
the half that directly answers #3594, the incident that opened this item.

### Portability, restated plainly because it is permanent

This machine is `arm64`, so nothing here was blocked. But Apple's project supports **Apple Silicon only,
architecturally and permanently** — not a gap that closes. Adopting it means: an **Intel Mac cannot run
the conveyor at all**; a **Linux host** already has native cgroups and needs a completely different
backend (the tool is irrelevant there); a **Windows host** has neither. Full container-to-container
networking additionally requires macOS 26. Whatever gets built must therefore be a *backend behind a
platform-neutral execution port*, never a direct `container run` call sprinkled through the dispatcher —
the same shape we:scripts/lib/isolation-provider.mjs already chose, and the fork this item's tradeoff (4)
already names.

### Also checked, so it is not re-discovered

The 2026-09-08 git-manager idea (Idea 1 of the amendment above) is **not built**: no
we:scripts/lib/gh-throttle.mjs exists and nothing under we:scripts/, we:docs/ or we:backlog/ references a
git-manager or gh-throttle. It remains open as written.

### This amendment does NOT stamp `preparedDate`, deliberately

It closes real questions (is the tool usable; does the cap work; what does a lane cost; does the Codex
question compose) but **opens** others: whether containerized heavy commands are net-positive given the
~3.6x I/O penalty measured above, and whether the API-key billing change is acceptable. It also leaves this
item's two pre-existing forks unresearched — Docker Desktop/OrbStack as the simpler mature alternative
(tradeoff 3), and the platform-neutral-abstraction question (tradeoff 4). Stamping readiness now would be
exactly the false stamp we:docs/agent/backlog-workflow.md's G4 / "never trust the stamp" rules warn about.

**Recommended sequencing, as this research's own view rather than a ruling:** the operator's stated
preference — wait until Codex and Gemini are hooked up — is well supported by the evidence, because the
Codex work gains nothing from waiting for containers. If anything starts in parallel sooner, it should be
the **heavy-command container pool**, not per-lane containers: it is the cheap half, needs no auth or
billing change, answers this item's founding incident directly, and would produce the throughput
measurement the prior amendment's core-split premise still lacks.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
