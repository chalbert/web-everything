---
kind: story
size: 2
parent: "3621"
status: open
scope: ["we:scripts/lib/container-exec/Containerfile", "we:scripts/check-standards.mjs"]
dateOpened: "2026-09-14"
tags: []
---

# we:container-exec/Containerfile: pin base image by digest, not mutable tag (PR #2206 review)

Independent jury review of PR #2206 (heavy-command-pool container POC) marked a supply-chain finding OWED (owed = should become a tracked item, not just a review comment). we:scripts/lib/container-exec/Containerfile pulls its base image by a mutable tag (FROM node:22-alpine) with no @sha256 digest pin, so a later 'container build -f we:scripts/lib/container-exec/Containerfile -t we-heavy-admission:poc .' run -- weeks after this POC's own fidelity/CPU-cap evidence was measured -- can silently pull a different image if the node:22-alpine tag is repointed upstream (or compromised), with no signal that anything changed. Fix: pin the FROM line to a @sha256: digest instead of the bare tag, and add a check:standards rule (or lightweight lint) that flags any Containerfile/Dockerfile FROM line lacking a digest pin, so drift is caught mechanically rather than depending on a reviewer noticing by hand each time. PR #2206 is still OPEN (review:accepted, ready-to-merge) as of this filing, not yet drained onto main.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
