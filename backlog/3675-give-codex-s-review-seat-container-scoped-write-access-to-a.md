---
bornAs: xmn1we6
kind: decision
parent: "3383"
status: open
scope: ["we:backlog/"]
dateOpened: "2026-09-14"
preparedDate: "2026-09-21"
preparedAgainstSha: "18798aec3835377c24a82133b5d87711dcfdb3e2"
relatedTo: ["3621", "3654", "3673", "3611", "3001", "3371", "3405", "3581", "3630"]
relatedReport: reports/2026-09-19-codex-review-seat-tool-surface.md
tags: [codex, review, container, isolation, tool-parity, calibration, operations, mcp]
---

# Give Codex's review seat container-scoped write access to a full lane checkout

No design exists yet for what tools a non-Claude review seat may hold, so this card is grounded in a [research topic](/research/codex-review-seat-tool-surface-and-isolation/) plus live probes on `codex-cli 0.155.1` and `claude 2.1.278`. An operator ruling (relayed 2026-09-19) makes the tool surface **the same for every reviewer**, so the central call is one surface for Claude and Codex alike. The recommended shape is narrower than the filing: **declared operations only**, reached as MCP tools, with four missing read/run operations named. Four forks, each with a bold default. Three premises in the filing are stale (probe 9, the seat's lens, #3673).

## Settled before the forks — operator steers, 2026-09-19

Both arrived through a peer Claude session, not typed into this preparation session; **the decider should confirm them in the operator's own words at ratification.**

1. **Same tool surface for every reviewer, whatever provider runs it** (Claude, Codex, Gemini, Antigravity, any future seat). This replaces the filing's open question about Codex-only versus all providers, and is grounded in the capability-parity principle (`we:agent-memory-src/agent-capability-parity-principle.md`). It is why Fork 1 now binds Claude's existing juror too.
2. **If a reviewer benefits from tools, allow some, but ideally only codified operations.** This is a preference, not a ruling: Fork 1 tests whether it can do the job.

## What the filing got wrong (facts, not forks)

- **Probe 9 was corrected.** [#3371](/backlog/3371-probe-one-alternate-provider-against-the-judge-contract/) probes 12–14 found `-c project_doc_max_bytes=0` keeps `we:AGENTS.md` out of a tool-bearing session's automatic context. It is a token saving, not isolation: 6 of 6 tool-bearing runs `cat` the file anyway, and a deleted copy is recovered with `git show`. The header of `we:scripts/lib/codex-judge-spawn.mjs` (lines 15–19, 305–314) still states the old conclusion.
- **The seat on `main` is on the wrong lens for tools to matter.** `we:scripts/operations/review-pr.mjs:305` seats Codex on `ADVISORY_LENSES[0]`, which is `simplicity` (`we:scripts/lib/jury-core.mjs:1141`), and the mutation rule (`we:scripts/lib/review-core.mjs:250`) says to say nothing about mutation for a simplicity finding. The correctness-lens Codex seat that produced the #2107 record exists only on `lane/mechanical-dispatcher`.
- **[#3673](/backlog/3673-define-what-clears-a-triggered-calibration-veto-so-a-role-ca/) is resolved**, codified at `#calibration-veto-clearing` in `we:docs/agent/platform-decisions.md`. Its clause 1: a tooling fix is not by itself a root-cause finding for the #2107 veto.
- **The five-PR experiment in the filing cannot be re-checked** (its directory no longer exists). The in-repo evidence is #3371 probe 13: six of six real mutation probes by tool-bearing Codex, verdict agreement with Claude on four of four shared scenarios.

## What "allow some tools" can and cannot mean for Codex

There is no `--tools ''`. The three `-s` modes bound damage, not tools: `read-only` blocks writes (live: an `apply_patch` write was rejected) but reads the whole filesystem; `workspace-write` writes the cwd and temp but also reads everything (a session read a sibling clone in #3371 probe 14b); `danger-full-access` bounds nothing and defeats the native deny profile. What does remove tools, all **live on 0.155.1**:

- `--disable shell_tool --disable unified_exec` removed the shell (one run, the model's own report). `apply_patch`, `web__run`, `image_gen`, the `spawn_agent` family and MCP resource tools remain; `apply_patch` cannot be disabled by flag, only sandbox-blocked.
- An MCP server declared with `-c mcp_servers.<id>.command=…` is callable once `default_tools_approval_mode="approve"` is set.
- **That server process runs outside Codex's sandbox.** It wrote a file outside the session's cwd while the sandbox was `read-only`. So with this recipe the operation server, not Codex's sandbox, is the security perimeter.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
| --- | --- | --- | --- |
| Fork 1 — tool ceiling for every reviewer | **Declared operations only**, as MCP tools; built-ins removed; four missing operations declared. Raw tools in a container stay the measured escalation | Raw shell and writes in a container, for every reviewer | Medium (regrounded on merit after the red team) |
| Fork 2 — where the review runs | **Container end state** for every tool-bearing seat, as a backend-neutral isolation provider; never a pooled lane | Host throwaway full clone, keyed to enforceability (host only where the tool list is preventively verified) | Medium-low |
| Fork 3 — evidence before the mandatory Claude seats move | **Replay parity gate**, then shadow, before correctness/security jurors move | Move every seat on ratification | High |
| Fork 4 — does the tool-bearing Codex seat carry the #2107 veto | **Inherits it**; replaying #2107 is the diagnostic | New role identity starting clean | Med-high |

Fork 2 depends on Fork 1 in one direction: if Fork 1 is not (a), Fork 2 must be a container, because a model with a shell cannot be confined on the host. The reverse does not hold. The feasible cells are (operations, host), (operations, container) and (raw, container); see the red-team round below.

**Merit-basis correction (2026-09-21).** The 2026-09-19 defaults for Forks 1 and 2 leaned partly on effort and resource cost ("nothing runs the Codex CLI in a container yet", about 3.6× mount I/O, about 378 MB per guest, a Linux dependency tree per image). The repo forbids that as a fork argument (`we:docs/agent/backlog-workflow.md`, "a fork is not a prioritization tool"). Those tells are stripped from the two forks below and the defaults re-derived with both branches free to build. A fresh-context red team then attacked the re-derivation; its verdicts are in the red-team round after Fork 4.

## Fork 1 — What is the tool ceiling for every reviewer?

**Fork-existence.** A seat has exactly one tool ceiling, and the ceilings nest (each wider one contains the narrower), so they cannot all be the ceiling. The wider ones give the model authority that never passes through the declared, audited catalog, and neither provider's native sandbox confines reads.

Crux, with refs. Claude's juror today: `--allowedTools Bash Read Grep Glob` (`we:scripts/operations/review-pr.mjs:547`, `we:scripts/lib/judge-spawn.mjs:569`), under `--safe-mode`, which also turns hooks off, so "a lane of its own" is its only isolation (`we:scripts/lib/judge-spawn.mjs:282-290`). Codex's seat: `-s read-only`, empty scratch cwd, refused any `allowedTools` (`we:scripts/lib/codex-judge-spawn.mjs:305-314,345`). Declared operations: `we:scripts/operations/run.mjs:95`.

- **(a) Declared operations only** — **recommended.** The model's only tools are typed calls into the operation catalog, delivered as MCP tools; built-in shell, read, write and edit tools are removed. One server serves both providers:

  ```sh
  # Codex (live on 0.155.1)
  codex exec --json --ephemeral -s read-only \
    --disable shell_tool --disable unified_exec \
    -c 'mcp_servers.ops.command="node"' -c 'mcp_servers.ops.args=["<operation-server>"]' \
    -c 'mcp_servers.ops.default_tools_approval_mode="approve"' -C <clone> < prompt

  # Claude (live on 2.1.278; init listed exactly ["mcp__ops__…"])
  claude -p --tools "" --restricted --mcp-config ops.json --strict-mcp-config \
    --allowedTools 'mcp__ops__*' --no-session-persistence
  ```

- **(b) Operations plus a writable scratch directory.** Rejected. A scratch dir the model can execute from needs a "run this script" operation, and `run(script, args)` is the exact shape #3001 rejected ("re-imports the entire enumeration problem behind a friendlier name"). If the scratch is data-only it adds nothing over `mutation-check`. It collapses to (a) or (c).
- **(c) Raw shell and writes in a container, for every reviewer** (the filing's ask, raised to the common surface). The maximum-capability branch. #3001 clause 1 permits writes inside an own clone but lists network calls and installs as operations-only, so a raw shell with open network is not legal under it. Loses on merit, with cost set aside: (1) a shell plus network plus any credential in the guest is an exfiltration and token-abuse path under prompt injection from PR text, and the interim auth path leaves the token inside the guest; (2) `mutation-check` returns a typed, unforgeable outcome, while a raw "I ran it and it reddened" claim cannot be machine-checked, and a raw writer can edit the PR's own tests; (3) it conflicts with `#dispatched-agent-never-runs-commands-directly` (#3405) and clause 3 of `#operations-declared-once-callers-generated`; (4) its only audit trail is a transcript. It remains the pre-declared escalation, run inside a container with a network policy and no token in the guest, if a replay shows operations-only missing findings the raw surface catches.
- **(d) Unchanged** (Codex read-only with an empty cwd; Claude on raw tools). Excluded by the operator's same-surface ruling, and it leaves the tooling asymmetry the parity principle says to rule out first.

### Enforceability — stated plainly

The operations-only surface **can be enforced for both providers with one mechanism**, but the guarantee differs in kind:

| | Claude | Codex |
| --- | --- | --- |
| Tools removed | `--tools ""` (already used by every tool-free juror) | shell via feature flags; `apply_patch` only sandbox-blocked; `web__run`, `spawn_agent`, `image_gen`, connectors **not yet closed or tested** |
| Only the server's tools remain | **verified live**: the `system/init` event listed one tool | **not machine-checkable before the run**: `codex debug prompt-input` lists no tools |
| Check | preventive, assertable in the run record | **detective**: every executed tool is an item in the `--json` stream; any item that is not a server call (`command_execution`, `file_change`) voids the run |
| Fragility | `--safe-mode` drops MCP, so the recipe must move to `--restricted`; whether `--restricted` keeps `we:CLAUDE.md` out of context is **unverified** and #2336's isolation depends on it | flags shift between releases (the tool list differs between 0.153.4 and 0.155.1), so a per-release canary is needed |

Mechanisms considered and not enforceable: a container PATH holding only an operation runner (Codex's own built-in tools and any absolute path bypass it, and `node` spawns anything); a checkout without raw entry points (the operations are wrappers over them); `-s read-only` plus a writable mount (real for writes, does nothing for reads or verbs); Codex `prefix_rule` exec policy (an approval-flow feature, not evaluated). **If the ruling requires every provider to be preventively machine-checkable, Codex fails that bar today.** Antigravity was not evaluated; #3633 found its 57 in-process tools ignore its own sandbox, so it may not be reducible to the operation server's tools at all, which would make the same-surface ruling unhonourable for that provider.

### What moves the trust boundary, and what must be built

The server is not sandboxed (live), so every argument it accepts is an unsandboxed action with the operator's privileges. `we:scripts/operations/mutation-check-io.mjs` has no path confinement on `--target` or `--checkout`, so it cannot be exposed to a model as it is. Ratification would spawn: (1) an operation server generated from the declarations (clause 1 of `#operations-declared-once-callers-generated` already names "the typed-tool caller"); (2) the four declarations below; (3) confinement in `mutation-check` — the server, never the model, pins the checkout, and `--target` must resolve inside it; (4) the launch recipes above, with a test that fails on a Codex or Claude release that changes the tool list; (5) a run-record assertion (Claude: init tools; Codex: item audit).

### What every reviewer would lose, and what replaces it

| Claude juror capability today | Under operations-only | Replacement |
| --- | --- | --- |
| See the diff, title, changed files | unchanged | prompt text; `stage-pr-view` and `review-pr`'s read step exist |
| `Read` any file | lost as a raw tool | **new `inspect-file`** (path-confined; can also hold the `we:AGENTS.md` denial) |
| `Grep`, `Glob` | lost | **new `inspect-search`** |
| `Bash` git reads (diff, show base version, log, blame) | lost | **new `inspect-git`**, typed subcommands only |
| `Bash` run one test file, by name, or at the base revision | lost | **new `run-suite`**: file, optional test name, revision (the server makes the second checkout) |
| `Bash` run the repo gate | unchanged | `verify --gate` exists |
| `Bash` mutation probe (break the line, run, restore) | replaced by a better tool | `mutation-check` exists: restore is in a `finally` and verified by re-read; outcome killed / survived / unrun. One target and one find/replace per call, so a multi-file mutant needs a typed `edits[]` extension |
| `Bash` network (`gh`, `curl`) | lost | not needed to review; PR data is staged |
| Reads outside the checkout (sibling repos, home dir) | lost, by design | cross-repo review (#3137) needs a typed `repo` parameter |
| **`Bash` throwaway repro script (`node`, `python`)** | **lost — no equivalent** | none proposed |

**The one capability with no operation equivalent is the bespoke repro script.** #3371 probe 13 scenarios C and D used it to prove impact (a real-git colour probe; a leaked-directory count). The same verdicts are reachable through `mutation-check`'s `survived` outcome ("no named test reddens"), which is all the mandate's mutation rule asks for, but a finding may arrive less confirmed when a behaviour claim needs a demonstration and no test exists. That is an argument from reading the transcripts against the operation's contract; **nobody has run a reviewer through these operations**, and Fork 3 is where it gets measured. If the replay shows operations-only missing findings the raw surface catches, the answer is (c) inside a container, not a wider operations list.

**Skeptic:** SURVIVES-WITH-AMENDMENT (self-run; see the note under Fork 4). Classification attack: is this a config dimension (`#config-extends-platform-default`) with a permissive default? No — that bias governs author-facing standards; this is the repo's own process authority, where least privilege is the reverse default. Precedent attack: `#agent-mutations-through-typed-operations` (#3001) says reads stay free *and sandboxed* and writes inside an own clone are legal, which favours (c). It lands in part: (a) is stricter than that statute. It is reconciled, not overridden: #3001's premise "reads free and sandboxed" fails for both providers today (Codex's sandboxes do not confine reads; Claude's `Read` is unconfined), so the operation catalog is how a reviewer's reads become sandboxed. Citation-scope: #3001 is downgraded from authority to supporting context; the authority is the live enforceability evidence. Clause 3 of `#operations-declared-once-callers-generated` says a judge step needs no tools, and today's tool-bearing jurors already sit outside it; (a) is the variant that fits clause 1's typed-tool caller. A capability gap follows `#dispatched-agent-never-runs-commands-directly`: a `missing-operation` finding, halt and surface, never a workaround. Amendments folded in: the server-confinement preconditions above; the escalation to (c) on a measured miss.

**Screen:** clear (self-run) — the ceiling is repo process policy, not a WE↔FUI boundary call, and with both branches free to build a merit difference remains (audit trail and confinement against capability).

## Fork 2 — Where does the review run?

**Fork-existence.** The suite runs, and the mutation writes, happen in exactly one place per review, and a pooled lane, a host throwaway clone and a container are different trust placements. The excluded branch is the pooled lane: `mutation-check` restores in a `finally` but a crash can leave a mutant behind, and a dirtied pooled lane is later leased to unrelated work.

Crux. Claude's juror runs in "a lane of its own" (`we:scripts/lib/judge-spawn.mjs:282`). A throwaway clone is the ratified pattern for replays (`#skill-memory-replay-substrate`). Its preparation exists: `createNativeDenyWithHistoryStripIsolationProvider` (`we:scripts/lib/isolation-provider.mjs:409`), unwired ([#3630](/backlog/3630-wire-the-isolationprovider-macos-deletion-backend-into-a-rea/)).

- **(a) Container, mounted throwaway clone** — **recommended as the end state**, for every tool-bearing seat, as a backend-neutral OS-level isolation provider behind the seam in `we:scripts/lib/isolation-provider.mjs`. It is the only preventive boundary that does not depend on enumerating a provider's tools: Codex's tool-removal flags are only checkable after the run, and Antigravity's in-process tools ignore its own sandbox (#3633). It also contains the operation server, which the live probe showed runs outside Codex's sandbox with the operator's privileges. It must not pre-empt the open [#3621](/backlog/3621-real-os-level-resource-isolation-per-dispatched-lane-is-appl/) choice of Apple `container` versus another backend. It is the required branch if Fork 1 is (c). Conditions, from the red team: a network policy for the guest; no auth token inside the guest (a host-side proxy, not the interim in-guest path); the mount is the history-stripped throwaway clone only.
- **(b) Host throwaway full clone** — the alternative, keyed to enforceability: acceptable only where the tool list is preventively verified (Claude's `--tools ""` plus `system/init` assertion), and not for Codex or Antigravity. A `git clone file://` of the PR head in the temp directory, history-stripped, with the Fork 1 server pinned to it and torn down after the run. "Full" means siblings too: the suite resolves `../frontierui` (`we:vitest.shared.ts`), so the clone's parent needs that sibling. The end state is ratified here; what exists until the container build lands is its own separately prioritized item, not a branch of this fork.
- **(c) Host pooled lane** (Claude's shape today). Rejected for the dirty-lane reason above.
- **(d) Empty scratch cwd, diff only** (Codex's shape today). Cannot verify anything; excluded by Fork 1.

**Skeptic:** SURVIVES-WITH-AMENDMENT (self-run 2026-09-19; re-derived on merit and red-teamed 2026-09-21, see the red-team round). The 2026-09-19 attack from the filing's own preference ("container, not bare-host"): under Fork 1 (a) the model has no shell or file tool, so container-versus-host only changes where a hostile PR's test code executes. That default rested partly on cost and is superseded: the merit case for a container is enforcement that does not depend on the provider's cooperation, and containing the operation server. "Contains the PR's own test code" does not favour it, because `we:scripts/readiness/heavy-admission.mjs run --container` already runs the suite in a container while the model stays on the host. Unverified: the native deny profile under a denied root that contains the lane (`~/workspace/.lanes/`); probe 14 used a temp-directory clone.

**Screen:** clear (self-run) — placement of execution is invisible across the WE↔FUI boundary; a merit difference (disposability, blast radius) remains.

## Fork 3 — What evidence must exist before the mandatory Claude seats move to the new surface?

**Fork-existence.** Moving the correctness and security jurors, which gate landing, onto a surface nobody has measured is a real risk of a false clear, so "move on ratification" and "move only after measurement" cannot both be the rule. The excluded branch is moving with no gate.

Crux. The seats are `MANDATORY_LENSES` (`we:scripts/lib/jury-core.mjs`); the Codex seat is advisory and never blocking. A replay substrate exists: `we:scripts/review-corpus/mine-review-corpus.mjs` turns recorded `review-pr` verdicts into fixtures (92 cases, 87 distinct revision ranges, counted 2026-08-26; the counts may have moved) whose findings are the labels, and it says a candidate reviewer can be scored against them. A juror-replay harness over it is **not confirmed to exist**.

- **(a) Replay parity gate, then shadow** — **recommended.** Replay the corpus through the operations-only surface and through today's surface; the new surface must not miss a confirmed label the old one caught. Then run it in shadow beside the live jurors, never blocking, before any mandatory seat moves. Codex's advisory seat moves first because it blocks nothing. The replay must include PR #2107 and a constructed severity-ambiguous case (Fork 4, and #3673 clause 2).
- **(b) Move every seat on ratification.** Rejected: an unmeasured reduction on the land gate; the loss table above names a capability with no equivalent.
- **(c) Never move Claude's seats** (permanent asymmetry). Excluded by the operator's ruling.

**Skeptic:** SURVIVES (self-run). Attack: this is sequencing wearing a fork's coat. It is not: what rests on it is a correctness claim about a land gate, and both branches are equally cheap to *state*. Attack: labels came from Claude's own juror, so the comparison is circular. Partly true; the labels are *confirmed* findings, and the old-versus-new comparison on the same juror removes the circularity for the Claude seats. For Codex the labels are the ground truth, which is the weaker basis and is stated as such.

**Screen:** clear (self-run) — an externally observable trust bar, not plumbing; merit remains with both branches free.

## Fork 4 — Does the tool-bearing Codex seat carry the #2107 calibration veto?

**Fork-existence.** A role either carries its veto or it does not. The excluded branch is a fresh identity: it would let a configuration change wipe a veto, which is the dilution `#calibration-veto-clearing` clause 3 already forecloses.

Crux. `#model-probation-graduation-criteria` keys trust on `{provider, model}` per role and never inherits it across a model upgrade; `#calibration-veto-clearing` says clearing needs a root-cause finding naming which of `introduced` / `worseThanBase` / `parallelizable` diverged, then similarity-matched trials. A tooling change is not in the key. The seat is advisory and never blocking, so carrying the veto blocks only promotion.

- **(a) Inherits the veto** — **recommended.** The same role, so [#3673](/backlog/3673-define-what-clears-a-triggered-calibration-veto-so-a-role-ca/)'s clauses govern. Replaying #2107 through the operations-only Codex seat *is* the diagnostic clause 1 asks for: record which sub-answer diverged and whether tools changed it. Trials before that finding do not count; trials after carry the tool surface, the pinned `-m` and `codex --version` (Codex reports no model id, #3371 probe 13e), and a tool-bearing trial gets no easier bar (`#model-probation-graduation-criteria` clause 4).
- **(b) New identity, starts clean.** Rejected as above.

**Skeptic:** SURVIVES (self-run). Attack: tools may fix exactly the calibration gap, so inheriting the veto punishes a repaired seat. Answer: the ruling already says plausible relevance is not a root-cause finding; the replay produces the finding cheaply, so the cost of inheriting is one diagnostic, not a wait.

**Screen:** clear (self-run) — an externally observable graduation rule; merit remains.

> **Skeptic and Screen were run by the preparing session itself, not by the fresh-context agents the prepare method specifies** — the task that dispatched this preparation forbade nested agent calls. The screen is exactly the check a same-session author is blind to. Re-run both in a fresh context at ratification.

## Red-team round — 2026-09-21 (fresh context, read-only)

Attacked the claim that, with effort stripped, a container with raw tools beats operations-only. Verdicts, checked against `origin/main`:

| Claim | Verdict | Evidence |
| --- | --- | --- |
| Container wins Fork 2 on merit | **Survives with amendment** | Only preventive, provider-agnostic boundary; contains the operation server. "Contains the PR's test code" does not count: the suite already runs containerised with the model on the host. Fork 2 conflates three placements (the model, the operation server, the PR's test code); only the first two are at stake |
| Raw tools in a container beat operations-only (Fork 1 (c) over (a)) | **Fails as a default** | (a) is detective for Codex and Antigravity may be unreducible, but (c) adds network exfiltration under prompt injection, an in-guest token on the interim auth path, an unverifiable "it reddened" claim, and conflicts with #3001 clause 1 (network, installs), #3405 and clause 3 of `#operations-declared-once-callers-generated`. Antigravity's auth is Keychain-only, so a container does not rescue it either |
| "A container doesn't confine reads" is weak | **Fails as an attack on the card; survives on substance** | The card never said it (it said host sandbox modes do not confine reads). The mount is still not clean: the history-stripped clone is needed either way (the doctrine-file leak lives in the object DB, #3621), `we:scripts/lib/container-exec.mjs` mounts the primary checkout read-only for git alternates, `../frontierui` carries its history, and auth material is reachable |
| Forks 1 and 2 are not true rivals | **Survives** | #3001: "Both are wanted; neither substitutes". Fork 2's dependency on Fork 1 is one-directional; a Seatbelt read-allowlist (#3371 probe 14c) can confine a host session |

**Amendments folded in above:** cost tells deleted from Forks 1 and 2; (c)'s loss regrounded on merit; Fork 2's default changed to the container end state, backend-neutral so it does not pre-empt #3621; the container's conditions stated (network policy, no token in the guest, mount only the stripped clone).

**Amendments not yet folded — for the ratifier:**

- Split Fork 1 into *surface* (operations versus raw) and *containment* (host versus container), and Fork 2 into placement of the model and server versus placement of suite execution. Not restructured here; the cell table above is the interim framing.
- **Internal contradiction to fix before build:** `inspect-git` (log, blame, base version) needs history, but the strip factory clones with `--depth 1` (`we:scripts/lib/isolation-provider.mjs:261`). Either the operation reads a pre-staged base, or the strip keeps enough history.
- Not verified: whether the Apple guest network can be restricted; whether host services are reachable from the guest gateway; darwin versus Linux verification fidelity; the Seatbelt read-allowlist beyond #3371 probe 14c.
- Fork 1 default confidence dropped from med-high to medium; Fork 2 is medium-low.

## Supported by default (not decisions)

- **Re-seat Codex on the `correctness` lens.** Forced: tools on the `simplicity` lens change nothing. A wider ceiling for another lens is the same catalog, subsetted per lens (for example read operations only for `claim-accuracy`).
- **One rule for all providers, gated by an enforceability proof.** Settled by the ruling above. A provider that cannot be reduced to the operation server's tools cannot seat a tool-bearing review, and the ruling then needs a decision about that provider.
- **Context isolation is composed, not chosen:** `-c project_doc_max_bytes=0`, a history-stripped clone, the native deny for the doctrine file, and a path denial inside `inspect-file`. With operations-only the last is enforceable in our own code rather than by a Codex setting.
- **Detective audit for Codex:** any stream item that is not a server call voids the run and fails closed.
- **Unchanged:** the Codex seat stays advisory; `--judge-provider=codex` stays refused, pointing at the per-request pin `REVIEW_PR_CODEX_ADVISORY=1` (`we:scripts/operations/review-pr.mjs:327`, refusal at `we:scripts/operations/review-dispatch.mjs:409-415`); the env allowlist and scratch home stay (`we:scripts/lib/codex-judge-spawn.mjs:245`).
- **Sequencing:** the container end state (Fork 2 (a)) is the branch that depends on the capacity work in [#3611](/backlog/3611-hardware-usage-aware-heavy-command-capacity-control-a-staged/) and [#3610](/backlog/3610-how-far-to-take-heavy-command-admission-control-beyond-stage/), and on the backend choice in #3621. That is build ordering, filed as its own prioritized items, not a reason to rule otherwise.

## Context

### What ratification would change in code (not filed here)

- `we:scripts/lib/codex-judge-spawn.mjs`: header 15–19; `assertNoCodexTools` (305–314) narrowed from "refuse any tool" to "refuse any tool that is not an operation-server tool"; `buildCodexJudgeArgv` (330–365) stops hard-coding `-s read-only` and gains the disable set and server config.
- `we:scripts/operations/cli-adapter.mjs` (the codex-plus-`allowedTools` refusal near line 642) and `we:scripts/operations/review-dispatch.mjs:167,409-415`: the whole-dispatch refusal exists because every `review-pr` judge step is tool-bearing; once Codex can take one, its premise goes.
- `we:scripts/operations/review-pr.mjs:547,955` and `we:scripts/lib/judge-spawn.mjs:282,569`: `REVIEW_JUROR_TOOLS`, the advisory request, `assertLaneCwd`, and `--safe-mode` becoming `--restricted`.
- New: the operation server, four declarations, `mutation-check` confinement, and a juror-replay harness.

Predicted slices if carved: operation server and declarations `we:scripts/operations/`; Codex provider `we:scripts/lib/codex-judge-spawn.mjs`, `we:scripts/operations/cli-adapter.mjs`, `we:scripts/operations/review-dispatch.mjs`; Claude recipe `we:scripts/lib/judge-spawn.mjs`, `we:scripts/operations/review-pr.mjs`, `we:scripts/lib/review-core.mjs`; replay `we:scripts/review-corpus/`.

### Container costs, measured on the container item

[#3621](/backlog/3621-real-os-level-resource-isolation-per-dispatched-lane-is-appl/) (still an open decision; the ruling here is backend-neutral and does not pre-empt it) measured, for a Linux guest on Apple's `container`: mount-bound I/O about 3.6× slower than the host, about 378 MB of host memory per idle guest, a Linux-built dependency tree needed per image, and subscription auth for Claude and Codex working from inside a container. Nothing yet runs the Codex CLI in one.

### Not verified

Every built-in Codex tool that is not the shell can be closed; the shell is unreachable by another route (one run); `--restricted` keeps `we:CLAUDE.md` out of context; Antigravity or Gemini can be reduced to the server's tools; a reviewer on operations-only holds current quality.

### The filing's own evidence, kept for the record

1. **A real diagnostic found Codex's review seat read-only by policy while Claude's equivalent juror has write tools and routinely mutation-verifies.** See [#3673](/backlog/3673-define-what-clears-a-triggered-calibration-veto-so-a-role-ca/) (PR #2107: Codex identified a bug but rated it non-blocking where Claude's juror rated it a blocker) and `we:agent-memory-src/agent-capability-parity-principle.md` (PR #2212).
2. **A bounded experiment** reran 5 historical PRs through Codex read-only and with write access to a scratch copy: 9 of 10 read-only findings could not mutation-verify; 7 of 9 write-mode findings ran a scratch test; write mode found a new bug on PR #1924. Not re-checkable; its directory no longer exists.
3. **[#3621](/backlog/3621-real-os-level-resource-isolation-per-dispatched-lane-is-appl/)'s live 2026-09-14 test** showed a container fully contains a provider's writes, including a planted `.git/hooks/post-commit`; `we:scripts/lib/container-exec.mjs` ran `check:standards` and `test:unit` in a container with identical results.
4. **The operator's framing:** the experiment's scratch-copy limit was a safety precaution, not a constraint.

Not decided here: whether [#3654](/backlog/3654-define-graduation-criteria-for-a-model-provider-to-exit-prob/)'s graduation bar treats tool-bearing trials differently. Fork 4 folds it in: it does not.

### Review jury (provisional — pre-registered #2638)

Care level: `elevated` (review seats, sandboxing and the trust boundary of a new server). This jury binds against the predicted scope and is re-checked against the real diff at PR open.

| juror | lens | grounding method | pre-registered expectation |
| --- | --- | --- | --- |
| correctness#1 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| security#1 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| simplicity#1 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| standards-conformance#1 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |
| claim-accuracy#1 | claim-accuracy | static-review | Every factual claim the change makes about the repo holds against the repo: a cited path:line names what is actually there, a quoted grep literal really matches, a stated count is the real count, a referenced id or link resolves, and anything the description says was changed appears in the diff. |

## Done when

1. **Executable** — `node we:scripts/backlog.mjs show <this item>` reports `status: resolved` with `codifiedIn:` set, and the ruling states the tool ceiling for every reviewer seat, where a review runs, the evidence bar before the mandatory seats move, and whether the Codex seat inherits the #2107 veto.
2. **Grounded** — the ruling addresses each fork above, names the operations that must exist, and states how "operations only" is enforced for each provider that seats a reviewer.
3. **Not decided here, by design** — this card records the proposal, the evidence and a bold default per fork; the call is the operator's.
