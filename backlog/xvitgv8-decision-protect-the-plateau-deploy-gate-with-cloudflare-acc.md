---
kind: decision
status: resolved
dateOpened: "2026-10-01"
dateResolved: "2026-10-01"
codifiedIn: one-off
tags: []
---

# Decision: protect the Plateau deploy gate with Cloudflare Access, or with rate limiting plus per-session cookies?

Split out of #3811 on 2026-10-01: a Codex prepare stopped because the card leaves this choice open and the prepare brief forbids choosing policy. Option A: put Cloudflare Access in front of the gate (no custom brute-force code; needs a Cloudflare Access setup and an identity provider). Option B: keep the custom gate in plateau:worker.js and add rate limiting on POST /__gate plus per-session cookies that can be revoked one by one. Verified drift from that prepare: Plateau already revokes all cookies when the gate code rotates; we:worker.js does not; neither has app-level throttling today. #3811 builds once this is ruled.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.

## Ruling

Operator, 2026-10-01 (via claude-code-chat): "Let’s keep code gate for now" — option B: keep the custom gate in plateau:worker.js and harden it (rate limiting on POST /__gate, per-session revocable cookies). Cloudflare Access stays a later option. #3811 is prepared against this ruling.
