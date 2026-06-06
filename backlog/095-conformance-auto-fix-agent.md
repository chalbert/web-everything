---
type: idea
status: open
dateOpened: "2026-06-06"
tags: [monetization, business-model, ai-agnostic, conformance, auto-fix, agent, propose-and-verify, webcases, self-run-tool, provider-registry]
relatedProject: webcases
crossRef: { url: /backlog/089-monetization-product-ideas/, label: "Product ideas (#089)" }
---

# Conformance auto-fix agent — AI proposes, the suite verifies

A **self-run AI agent that closes a failing conformance check**: it reads the
verification failures from the open suite (the tool form of [#089](/backlog/089-monetization-product-ideas/)
idea 1), proposes a spec-conformant fix, re-runs `check:standards` / the protocol
cases, and **loops until green** — the *propose-and-verify* moat made literal.
This is the AI-tool white space that incumbents can't touch: Copilot/Cursor lint
and complete generically; none can fix against **your protocol contracts**,
because no one else has a machine-checkable conformance target.

## How it differs from neighbours

- vs. **upgrader tools ([#094](/backlog/094-ai-upgrader-tools/))** — upgraders move
  existing/legacy code *forward in place*; this agent is narrower and reactive:
  given a *specific failing check*, drive it to pass. It can be the fix-engine #094
  and the verifier (#089 idea 1) call.
- vs. **mockup→code ([#086](/backlog/086-mockup-to-standard-code-tool/))** — that
  *creates* from a design; this *repairs* code that already exists but fails.

## Why it fits the solo-founder lens

- **Tier-1 self-run tool** — runs on the customer's dev/CI; no uptime/support SLA.
- **AI is a swappable provider, BYO key** — same registry shape as #086/#094; no
  model-hosting cost on us.
- **Self-verifying by construction** — the agent never ships a fix the suite
  hasn't accepted, so output trustworthiness is structural, not promised. This is
  why the moat *grows* as models commoditise: everyone gets good models; only we
  have the verifiable target that turns a model into a reliable fixer.

## Open follow-ons

- The agent loop contract: failure report → candidate patch → re-verify → accept /
  retry / give-up-with-explanation. Bound the loop; surface diffs for human review.
- Shared engine with #094 (input adapter = "a failing check" vs "existing code").
- Needs the verification tool (#089 idea 1) to emit machine-readable failure
  descriptors the agent can target.
