---
kind: decision
parent: "3383"
status: open
scope: ["we:scripts/conveyor/branch-sync.mjs", "we:skills-src/conveyor/branch-sync-fix-brief.md"]
dateOpened: "2026-09-21"
preparedDate: "2026-09-21"
preparedAgainstSha: "8154ea239d1b07d02060f7c265ef59f1c66f40da"
tags: []
---

# Decision: how the reconcile agent is kept from pushing to the shared prototype branch

Security finding 7 of the advisory review on PR #2415 (the #3804 ruling): 'the agent pushes to the staging ref only, never the shared branch' is an instruction in the agent brief, not an enforced boundary; the agent reads content from main (prompt injection is possible) and runs with the operator's git credentials. Enforcing it is a real choice between a local push guard, a separate identity with a GitHub ruleset, or the brief alone. Relates #3804, #3607, #3797, we:docs/agent/platform-decisions.md#poc-branch-mechanical-sync.

This card does NOT reopen #3804. The ratified rule (point 2 of `#poc-branch-mechanical-sync`: the agent works "by merge commits only, never touching the shared branch", and the sync pass alone promotes) stands. The question is how that boundary is enforced rather than only instructed. Filed 2026-09-21 by the follow-up session to PR #2415 (session followup-3804), from the draft of the cancelled fix worker `fix-pr-2415`.

## FOUND (2026-09-21)

- **The boundary is an instruction.** "Push to the staging ref only, never the shared branch" is a step in the agent's brief (#3607 Done-when 4). #3607 Done-when 8 tests the pass's promotion, not that the agent cannot push to `lane/mechanical-dispatcher`.
- **The agent reads untrusted text.** Its conflicts come from `main`, including AI-lane pull-request text and file contents, so prompt injection is possible.
- **One identity pushes everything.** Every session and lane pushes to `chalbert/web-everything` with the operator's own git credentials (`git@github.com:`); there is no per-ref restriction. A misbehaving agent can push straight to the shared branch and skip the lock, the `autoSync` gate, the fast-forward check and the test gate.
- **Direct pushes to the prototype are ruled delivery.** `#poc-branch-declared-delivery-mode` lets work land inside a POC branch by a direct push or `we:scripts/operations/poc-land.mjs`, and #3804's freeze sub-fork keeps those pushes going while a conflict is open.
- **The promotion tests run the agent's tree.** The pass runs the tests at the staging tip, which the agent wrote, in an environment that holds the pass's push credentials.
- **The repository is public**, so a fetch needs no credential; only a push does.

## Fork 1 — How the "staging ref only" boundary is enforced

*Fork-existence:* either something other than the agent's own compliance stops a push to the shared branch, or nothing does; the two cannot both hold. Leaving it to the brief is one of the options, not a way to skip the fork.

- **(a) The brief only.** As ratified today. Rejected: the rule is enforced by the party it restrains, and the agent reads text that can instruct it otherwise. A breach moves the shared branch with no gate at all, and nothing tests that it cannot happen.
- **(b) A push guard in the agent's lane that rejects every ref but the staging ref, and promotion tests run with no push credential in their environment — recommended.** The dispatched agent's lane gets a pre-push guard (or a push wrapper the brief must use) that refuses any destination ref other than `lane/mechanical-dispatcher-catchup`, with a test that a push to the shared branch from the agent's lane fails. The pass runs the promotion test suite with push credentials removed from that process's environment (no `GH_TOKEN`/`GITHUB_TOKEN`, no SSH agent socket), so code in the agent-written tree cannot push while it runs. **Residual risk, named:** a deliberately hostile agent on the same user account can bypass a local hook (`--no-verify`, a direct `ssh` or `gh api` call). It stops a mistaken or casually injected push, not a determined one; the graduation review stays the cover for what reaches `main`.
- **(c) A GitHub ruleset on the shared branch plus a separate bot identity.** Only the pass's identity may push `lane/mechanical-dispatcher`. Rejected: every session pushes as one identity today, and `#poc-branch-declared-delivery-mode` delivers prototype work by direct push and `poc-land`. A ruleset that admits only the pass would block that ruled delivery path, unless every lane moves to the bot identity too, and then the agent has it as well. It also needs outward-facing repository settings and a second credential the operator manages.
- **(d) The agent runs with no push credential; the pass pushes the staging ref for it.** The agent commits locally and the pass fetches from its lane and pushes the staging ref. Rejected: on the same user account the SSH key and keychain stay readable, so it stops no more than (b) against a hostile agent. It also ties the pass to the lifetime of the agent's lane, which is released when the agent ends.

**Skeptic:** SURVIVES-WITH-AMENDMENT → applied. Merit attack on (b): a guard the agent can bypass is theatre. Partly lands: it does not stop a determined agent, which is now the named residual risk; it does stop the likely failures (a mistaken push, an injected instruction that uses the normal `git push` path), and it makes the boundary testable, which (a) is not. Attack on (c)'s rejection: a ruleset could admit the operator's identity too. Then it admits the agent, which runs as the operator, so it enforces nothing; the rejection holds. *Inline, this session's own attacks; no independent `judgePanel` run.*
**Screen:** clear. It sets who can move the shared branch, a trust boundary the operator owns; the hook-versus-wrapper choice inside (b) is the build's.

## Done when

1. **Executable** — `grep -l '^## Ruling' backlog/*how-the-reconcile-agent-is-kept-from-pushing*.md` lists this card (it fails until the operator has ruled and a `## Ruling` section names the chosen option for Fork 1).
2. The ruling is written into #3607 (a Done-when row with the named test) and into point 2 of `we:docs/agent/platform-decisions.md#poc-branch-mechanical-sync`.
