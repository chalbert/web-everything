---
kind: task
status: open
dateOpened: "2026-08-05"
tags: []
---

# check:standards rule — every git argv position taking a caller-supplied value must be guarded by --end-of-options

PR #1031 review finding 1's owed prevention. A dash-leading refname is a LEGAL refname (git check-ref-format 'refs/heads/--output=/tmp/pwn' exits 0) and git parses it as an option — verified on git 2.50.1 that an unguarded 'git fetch origin <ref>' EXECUTES an injected --upload-pack=<script> while the --end-of-options form refuses with 'invalid refspec'. Both known instances (we:scripts/fetch-parked.mjs's resolveNetDiff, we:scripts/merge-ai-prs.mjs's resolveNetDiffBasis) are fixed by that PR; this is the CLASS guard so the next one cannot land. AST-decidable: for any execFileSync/exec-shaped call whose command literal is 'git', every non-string-literal argv element must be preceded by --end-of-options or --. Exploitability in a solo constellation is LOW today (all three remotes are ssh, where --upload-pack runs on GitHub's side and its endpoint accepts only git-upload-pack/git-receive-pack, and there is no fork or untrusted-contributor path) — the value is that the guard survives the day that stops being true.
