---
type: issue
workItem: story
size: 3
status: open
blockedBy: ["598"]
dateOpened: "2026-06-14"
tags: []
---

# Credential-source provider seam — bridge-auth (v1) + GitHub-App broker (hosted) for forge writes

Build the credential-source provider seam ruled by #578 (Fork 1, dissolved to support-all): the forge write authenticates via co-existing providers selected by runtime context — A = reuse the IDE-bridge's git auth (v1/local, zero new credential surface, user identity + signing), B = a GitHub-App backend broker (hosted/org tier, short-lived tokens, bot identity, auto-signed). Identity/signing ride the source. Security invariant: no long-lived credential in the browser → user PAT/OAuth is fallback-only. The per-context default + that rule are compliance-layer policy (#579), read by the bot. Layer: Plateau, no standard contract; couples to #410's authorization dial; consumed via the forge provider (#598).
