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
- `gh auth status` → *"The token in GH_TOKEN is invalid."*
- GraphQL (what `gh pr view` uses) → `HTTP 403: This GraphQL query is not enabled for this session — only the pinned set of PR-review operations is served. Use REST via gh api repos/{owner}/{repo}/... instead.` That message is misleading: it names a fallback that also fails.
- REST → `403 {"message":"GitHub access is not enabled for this session..."}` **with or without** the env token, via `gh api` or plain `curl`.

So the boundary is per-PROCESS, not per-protocol: the connector holds the only working credential and `gh` cannot borrow it.

**How to apply:** reach GitHub through the connector tools, never by shelling `gh`. When an encoded operation shells `gh` internally, the fix is a transport seam at that call, not a credential hunt.

**Status — this note is only useful if it is honest about what has LANDED.** `review-pr` reaches the network exactly once, at the `gh pr view` in `we:scripts/operations/review-pr-io.mjs`. WE PR #1466 turns that one call into a swappable transport so a gh-less host can stage the same JSON on disk; until it lands, the call is a plain `execFileSync('gh', …)` and `review-pr`'s `read` step fails in a VM like everything else here. Check which shape is on `main` before relying on either — do not go looking for identifiers on the strength of this note.

The `record` half (`we:scripts/review-set-label.mjs`) shells `gh` regardless, and #1466 does not touch it. So even with that seam, a verdict can be COMPUTED in a VM but its label cannot be WRITTEN there.

**Two traps that cost time:**
1. A fresh cloud clone's fetch refspec is `+refs/heads/main:refs/remotes/origin/main` **only**, so `git fetch origin <lane>` populates `FETCH_HEAD` and no tracking ref. Anything resolving `origin/<branch>` (net-diff basis, `fetchExtraRefs`, `--force-with-lease`) fails until you widen it to `+refs/heads/*:refs/remotes/origin/*`.
2. Running an engine operation from a checkout whose CURRENT BRANCH lacks the seam you are relying on silently uses the default `gh` transport and refuses at `read`. Correct behaviour, confusing symptom — check `git branch --show-current` before blaming the environment.
