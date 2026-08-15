---
kind: task
status: open
humanGate: { kind: deploy, what: "Registrar (Squarespace) DNS access + a Cloudflare dashboard zone-add are both human-only steps; nothing here is agent-executable." }
dateOpened: "2026-08-15"
tags: [deployment, dns, risk]
crossRef: { url: /backlog/1137-public-deploy-we-site-live-behind-a-splash-shared-entry-code/, label: "Blocks #1137's nameserver cutover" }
---

# Verify existing Squarespace DNS records (especially email/MX) survive the #1137 nameserver cutover to Cloudflare

#1137's remaining human step points the Squarespace domain's nameservers at Cloudflare. Repo-wide search found zero prior mention of DNS/email continuity risk for that cutover: Squarespace commonly also hosts the domain's email (MX/SPF/DKIM/TXT), and Cloudflare's auto-import of existing DNS records during zone add is not guaranteed complete. Before flipping nameservers, snapshot the current DNS zone (dig/nslookup ANY, MX, TXT, CNAME) and diff it against what Cloudflare imports, adding back anything missed, so the switch does not silently break the domain's existing email.

## Done when

- The domain's pre-cutover DNS zone is captured (`dig <domain> ANY`, `dig <domain> MX`, `dig <domain> TXT`, plus any `CNAME`s in use) and saved somewhere durable (not necessarily this repo — a password manager note or the Cloudflare zone's own record list is fine).
- Cloudflare's automatic zone-import (triggered when the domain is added to the Cloudflare account, before nameservers are switched) is diffed against that snapshot, record by record.
- Any record Cloudflare's import missed (most commonly `MX`, `SPF`/`TXT`, `DKIM` `TXT`, or a `CNAME` an email or other third-party service depends on) is added back manually in the Cloudflare DNS zone.
- Only then does #1137's nameserver switch proceed — so the domain's existing email (if any) keeps working through and after the cutover.

Purely a human execution step (registrar + Cloudflare dashboard access); not something an agent can carry out or verify from this repo.
