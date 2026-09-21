---
kind: story
size: 3
status: open
scope: ["plateau:worker.js", "plateau:wrangler.toml", "we:worker.js"]
dateOpened: "2026-09-21"
tags: []
---

# Harden the plateau-app deploy gate against brute force before any customer access

The plateau-app gate Worker (plateau:worker.js, PR chalbert/plateau-app#156) accepts unlimited POSTs to /__gate with no rate limit, and a valid cookie is one static 30-day HMAC with no nonce or revocation short of rotating GATE_COOKIE_SECRET. Fine as an interim private preview (found in #156 review); before real customers replace it with Cloudflare Access or add a WAF rate-limit rule on POST /__gate plus per-session cookies. Same gap exists in we:worker.js.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
