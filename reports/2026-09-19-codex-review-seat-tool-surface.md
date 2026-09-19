# Codex review seat: tool surface, enforcement and isolation — grounding for #3675

**Date**: 2026-09-19
**Point**: Live evidence on `codex-cli 0.155.1` that an operations-only tool surface is enforceable for Codex through a shell-disabled, read-only-sandbox session whose only working tool is an MCP server, plus three stale premises in #3675 and in `we:scripts/lib/codex-judge-spawn.mjs`.
**Research page**: `/research/codex-review-seat-tool-surface-and-isolation/`
**Decision item**: `we:backlog/3675-give-codex-s-review-seat-container-scoped-write-access-to-a.md`

---

## Question

Should Codex's review seat get write access to a real checkout, and if some tools are allowed, can they be limited to the repo's declared operations? An operator steer relayed by a peer session on 2026-09-19 asked for "only codified operations" where possible. The steer's own worry: `codex exec` has no `--tools ''`, so how would that be enforced?

## Recommendation (as authored on the card)

An operator ruling relayed 2026-09-19 makes the tool surface identical for every reviewer. Fork 1 (a): declared operations only, reached as MCP tools, for Claude and Codex alike. Fork 2 (b): a host throwaway full clone. Fork 3 (a): a replay parity gate, then shadow, before the mandatory Claude seats move. Fork 4 (a): the tool-bearing Codex seat inherits the #2107 calibration veto and replaying #2107 is the diagnostic.

## Key findings

1. **Stale premises.** Probe 9 was corrected by #3371 probes 12–14. The seat on `main` runs `simplicity` (`we:scripts/lib/jury-core.mjs:1141`), where the mutation rule says nothing about mutation. #3673 resolved 2026-09-14.
2. **No allow-list, but real removal levers.** `--disable shell_tool --disable unified_exec` removed the shell. `-s read-only` rejected an `apply_patch` write. Both observed live; the shell-absence result is one run, self-reported.
3. **An MCP tool is reachable with the shell off** (`-c mcp_servers.<id>.command`, `default_tools_approval_mode="approve"`).
4. **The MCP server runs outside the sandbox.** It wrote a file outside the session's cwd while the sandbox was read-only. The operation server, not Codex's sandbox, becomes the perimeter.
5. **`we:scripts/operations/mutation-check-io.mjs` has no path confinement.** It must gain some before a model can supply its arguments.
6. **Four operations are missing** for parity with Claude's `Read`/`Grep`/`Glob`/`Bash`: read a file, search/list, read git, run one test file.
7. **Statutes.** `#agent-mutations-through-typed-operations` (#3001), `#dispatched-agent-never-runs-commands-directly` (#3405), `#operations-declared-once-callers-generated` clause 1 and 3, `#skill-memory-replay-substrate`, `#model-probation-graduation-criteria`, `#calibration-veto-clearing`.

## Live probe log (2026-09-19, `codex-cli 0.155.1`, scratch git repo, no repo checkout touched)

All runs used `--json --ephemeral --skip-git-repo-check -c project_doc_max_bytes=0 -C <scratch>`.

| # | Flags added | Ask | Result |
| --- | --- | --- | --- |
| 1 | `-s read-only --disable shell_tool` | list tools, create `proof.txt` | tool list still had `functions.exec`, `apply_patch`, `web__run`, `spawn_agent` family, `image_gen`, MCP resource tools; `apply_patch` write rejected: "writing is blocked by read-only sandbox" |
| 2 | `-s read-only --disable shell_tool --disable unified_exec` | run `echo SHELL-RAN` by any tool | "no shell execution tool was available" (self-report) |
| 3 | 2 + `-c mcp_servers.ops.command/args` | call `run_declared_operation` | failed: "MCP tool call requires approval, but approval policy is never"; shell attempt `tools.exec_command is not a function`; write rejected |
| 4 | 3 + `-c mcp_servers.ops.default_tools_approval_mode="approve"` | call the tool | completed; server result returned |
| 5 | 4 | call with `operation='write-outside'` (server writes a file outside the cwd) | file written; server process is not sandboxed |

The MCP server was a 20-line stdio JSON-RPC script (initialize, tools/list, tools/call) written for the probe and kept in the job's scratch directory, not committed.

Claude probes (`claude 2.1.278`, same server, `--no-session-persistence`, stream-json trace so the `system/init` tool list is machine-read):

| # | Flags | Init `tools` / `mcp` | Result |
| --- | --- | --- | --- |
| 6 | `--tools "" --mcp-config <f> --strict-mcp-config --allowedTools mcp__ops__run_declared_operation --safe-mode` | `[]` / `[]` | no tools at all: `--safe-mode` drops MCP |
| 7 | same without `--safe-mode` | `["mcp__ops__run_declared_operation"]` / connected | server tool called; model reported no shell |
| 8 | same with `--restricted` | `["mcp__ops__run_declared_operation"]` / connected | same as 7 |

A first attempt on `--model haiku` used `--output-format json` and the model described tools it did not have (one turn, no tool calls); it is discarded as unreliable and the stream-json runs above replace it. `codex debug prompt-input` was also checked: its output names no tools, so it cannot audit a Codex run's tool list.

## Not verified

- Whether every remaining built-in tool (`web__run`, `spawn_agent`, `image_gen`, connectors) can be closed.
- Whether the shell is unreachable by another route (one run).
- Flag stability across Codex releases.
- The native-deny profile under a denied root that contains the checkout (`~/workspace/.lanes/`).
- Codex driven through `mutation-check` — the Fork 5 replay is the test.
- The card's five-PR experiment (its directory no longer exists).

## Files Created/Modified

| File | Action |
| --- | --- |
| `we:src/_data/researchTopics/codex-review-seat-tool-surface-and-isolation.json` | created |
| `we:src/_includes/research-descriptions/codex-review-seat-tool-surface-and-isolation.njk` | created |
| `we:backlog/3675-give-codex-s-review-seat-container-scoped-write-access-to-a.md` | rewritten to prepared-fork shape |
| `we:reports/2026-09-19-codex-review-seat-tool-surface.md` | created (this file) |
