---
bornAs: xzlhqfi
kind: story
size: 3
status: open
tier: someday
blockedBy: ["2945"]
relatedTo: ["2895", "2439"]
scope:
  - we:scripts/review-console.mjs
  - we:scripts/review-set-label.mjs
tags: [review, gate-self, security, invariant, someday]
dateOpened: "2026-08-06"
---

# Human-presence gesture (WebAuthn) makes the gate-self clearance signal unforgeable

Gate a `clear-human` clearance behind a platform-authenticator assertion (Touch ID / a security key), so
clearing a gate-self PR requires a physical gesture against a private key in secure hardware. This is the only
option that makes the `review:human` tier's central claim TRUE rather than documented — an agent with full
shell access cannot produce the assertion. Filed `someday` on purpose: see the threat model below.

## The gap it closes

[#2895] ships the clearance as "the raw command with better manners" and defers the unforgeable actor signal,
having established that no local construct survives an agent with shell access: a CLI flag is trivially
passed, and a local console's token is scrapeable with `curl` from the same box. So today's record proves the
sanctioned path was followed, not that a human followed it. Every surface is required to say so.

WebAuthn is the one local mechanism that escapes this. `navigator.credentials.get()` against a platform
authenticator requires a physical gesture, and the private key never leaves the Secure Enclave — no amount of
shell access forges the assertion. The other two candidates are worse fits here: a second GitHub account whose
credentials never touch the machine is unavailable while the constellation is solo on one PAT (the same reason
login identity is already a useless independence signal, per `we:skills-src/review/SKILL.md`), and an
out-of-band code adds friction to every clearance for the same guarantee.

## Why SOMEDAY and not now

The threat it answers is an **adversarial** agent deliberately subverting the gate. The failure that actually
bites is a **careless** one taking the shortest available path — and [#2895] already fixes that by making the
sanctioned path exist and be the shortest. Operator call, 2026-08-06: "this level of security will be needed
at some point, but really in the future."

Build it when the threat model changes — a second operator, a non-solo constellation, an agent tier running
unattended against `main`, or any clearance whose blast radius outgrows what one person can review. Until
then the honest statement in [#2895] is the mitigation.

## Build

- Register a platform-authenticator credential once, stored locally; the console page calls
  `navigator.credentials.get()` before it will POST a clearance.
- `we:scripts/review-set-label.mjs`'s `clear-human` target accepts a verified-assertion signal and REFUSES
  without it once this lands — the deferral in [#2895] is what makes the target reachable today, and this item
  is what closes it.
- Server-side verification of the assertion (challenge freshness, origin, signature). A page that merely
  *calls* WebAuthn and trusts its own success is exactly the unwired-control failure PR #1046 hit three times;
  the verification must sit on the path that performs the write.
- The clearance comment records that a gesture was verified, so the record's strength is legible in the
  record itself rather than inferred from the date.

## Acceptance

- A `clear-human` clearance cannot be performed without a verified platform-authenticator assertion, and a
  test pins the refusal.
- The assertion is verified server-side on the write path, not client-side.
- Every surface that previously stated "this proves the sanctioned path was followed, not that a human
  followed it" is updated — that caveat is the thing this item retires, and leaving it in place would understate
  a guarantee that now holds.
