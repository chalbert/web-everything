---
name: workflow-cloud-vm-github-api-boundary
description: In a Claude Code cloud VM, git works but NO local process can reach the GitHub API — gh installs fine and still cannot authenticate; only the session connector has access
metadata:
  type: feedback
---

In a Claude Code cloud VM, **git works and the GitHub API does not** — and the split is not where it looks. Do not spend a session rediscovering this.

**What works:** `git fetch/push` against github.com, because the agent proxy injects credentials into git transport (`curl "$HTTPS_PROXY/__agentproxy/status"` reports `gitConfigInjection: true`). Also the session's own GitHub connector (the `mcp__github__*` tools) — PRs, comments, CI logs, workflow re-runs all work through it.

**What does not:** any GitHub API call from a local process.
- `gh` is **NOT missing** — `apt-get install -y gh` succeeds (v2.45.0). Installing it is not the fix, and reporting "gh is unavailable" is wrong.
- `gh auth status` → *"The token in GH_TOKEN is invalid."* — and that message MISLEADS. `GH_TOKEN` IS set, but it is a 14-character sentinel beginning `prox…`, not a credential (a real one is `ghp_`/`github_pat_`, 40+ chars). `gh` says "invalid" because it is not a token at all — not because a good token went stale.
- GraphQL (what `gh pr view` uses) → `HTTP 403: This GraphQL query is not enabled for this session — only the pinned set of PR-review operations is served. Use REST via gh api repos/{owner}/{repo}/... instead.` That message is misleading too: it names a fallback that also fails.
- REST → `403 {"message":"GitHub access is not enabled for this session..."}` **with or without** the env token, via `gh api` or plain `curl`.

**SUPPLYING YOUR OWN TOKEN DOES NOT HELP, and this is measured — do not spend an afternoon on it.** The proxy ignores the caller's `Authorization` header and answers with its own credential on the endpoints it allows. Probed three ways against `/rate_limit`: no header, the `prox…` sentinel, and a deliberately garbage `ghp_…` string all return the SAME `limit: 15000`; the same three against `/repos/{owner}/{repo}/pulls/{n}` all return `403`. A real PAT is ignored exactly like the garbage one, so provisioning one buys nothing and costs a live credential sitting beside an agent that reads untrusted diffs.

**AND `gh auth login` CANNOT START — the allowlist is PATH-SCOPED on github.com.** Measured: `github.com/login/device` and `github.com/login/oauth/access_token` both return **403**, while `github.com/<repo>.git/info/refs?service=git-upload-pack` returns **200**. So the git smart-HTTP endpoints are permitted and the AUTHENTICATION endpoints are not — deliberately, not incidentally. SSH is out too (port 22 unreachable; the proxy rewrites `git@github.com:` remotes to HTTPS). There is no login flow to run: device flow is blocked, and `--with-token` needs a PAT, which is ignored per the paragraph above.

**WHY, architecturally — the reason there is no clever way round it.** The GitHub connector does not run in the container. `/tmp/mcp-config-*.json` shows it as an HTTP MCP server hosted at `api.anthropic.com`, addressed by session headers (`X-MCP-Server-ID`, `X-Session-UUID`). The GitHub credential lives server-side and NEVER ENTERS THE VM. So there is no local secret to find, borrow, or point `gh` at, and the session's own system prompt says so outright: *"You do NOT have access to the `gh` CLI, `hub` CLI, or direct GitHub API access."*

That is also why "give a DAEMON access" is the impossible part specifically: access is bound to the SESSION identity. A daemon, a cron job, a subagent's subprocess — none of them are the session, so none can inherit it. Sound design (a runaway process cannot act as the operator on GitHub), and a hard ceiling on anything unattended in a VM.

So the boundary is per-SESSION, not per-process and not per-protocol: the connector holds the only working credential, `gh` cannot borrow it, and you cannot hand it one.

**How to apply:** reach GitHub through the connector tools, never by shelling `gh`. When an encoded operation shells `gh` internally, the fix is a transport seam at that call, not a credential hunt.

**Status — this note is only useful if it is honest about what has LANDED.** `review-pr` reaches the network exactly once, at the `gh pr view` in `we:scripts/operations/review-pr-io.mjs`. WE PR #1466 turns that one call into a swappable transport so a gh-less host can stage the same JSON on disk; until it lands, the call is a plain `execFileSync('gh', …)` and `review-pr`'s `read` step fails in a VM like everything else here. Check which shape is on `main` before relying on either — do not go looking for identifiers on the strength of this note.

The `record` half (`we:scripts/review-set-label.mjs`) shells `gh` regardless, and #1466 does not touch it. So even with that seam, a verdict can be COMPUTED in a VM but its label cannot be WRITTEN there.

**Two traps that cost time:**
1. A fresh cloud clone's fetch refspec is `+refs/heads/main:refs/remotes/origin/main` **only**, so `git fetch origin <lane>` populates `FETCH_HEAD` and no tracking ref. Anything resolving `origin/<branch>` (net-diff basis, `fetchExtraRefs`, `--force-with-lease`) fails until you widen it to `+refs/heads/*:refs/remotes/origin/*`.
2. Running an engine operation from a checkout whose CURRENT BRANCH lacks the seam you are relying on silently uses the default `gh` transport and refuses at `read`. Correct behaviour, confusing symptom — check `git branch --show-current` before blaming the environment.
