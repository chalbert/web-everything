---
type: idea
workItem: story
size: 5
status: resolved
blockedBy: []
dateOpened: "2026-06-13"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: webidentity
tags: []
---

## Progress

Delivered (2026-06-13) — three authoring artifacts, gate green:
- `webidentity` project entry in [projects.json](../src/_data/projects.json) (+ `webidentity.svg` icon).
- `credential-management` protocol in [protocols.json](../src/_data/protocols.json) (`ownedByProject: webidentity`, `realizesIntent: web-identity`, `anchor: protocol-credential-management`).
- [project-webidentity.njk](../src/_includes/project-webidentity.njk) spec partial — mission · feature-surface table · `CustomCredentialProvider` interface · 3 members · 2-D family×member dispatch · trust boundary · composition · status.

Ratified per #496 (one provider per family, 3 open members, `credential-acquisition`→`credential-management` rename, Configurator omitted → #499). `check:standards` green (25 protocols), 11ty dry-run clean.

# webidentity project + credential-management protocol

Deferred build graduated from #012's Fork 2-A: the full `webidentity` project owning one credential protocol — the `navigator.credentials` dispatcher as the normalized contract, with passkey/WebAuthn, FedCM, digital-credential, and password as swappable providers behind a `CustomCredentialProvider` seam (mirrors webvalidation→Validation, webguards→Guard); one protocol with a `credentials:[…]` request dimension; identity feeds Guard's gate. The thin intent (#482) shipped; build-design **#496 is ratified** — one registry-resolved `CustomCredentialProvider`, default = native `navigator.credentials` passthrough + a mock in-memory conformance provider; three members (`credential-request`/`credential-enrollment`/`session-mediation`); Configurator omitted → non-blocking #499. **#496 renamed the protocol `credential-acquisition` → `credential-management`**; this item inherits that id.

**Scope (`/slice 483` re-run, [report](../reports/2026-06-13-backlog-split-analysis.md)): a single agent-ready build, not an epic.** Twin = Guard. Three authoring artifacts: (1) `webidentity` entry in [projects.json](../src/_data/projects.json) (twin `webguards` 235–242); (2) `credential-management` entry in [protocols.json](../src/_data/protocols.json) (twin `guard` 102–108; `ownedByProject: webidentity`, `realizesIntent: web-identity`, `anchor`); (3) `src/_includes/project-webidentity.njk` — the spec partial (twin [project-webguards.njk](../src/_includes/project-webguards.njk), 166 lines): mission · feature-surface table · `CustomCredentialProvider` TS interface · the 3 members · 2-D family×member dispatch · trust boundary (async/server-authoritative/revocable, Guard's) · composition · status. The protocol entry + partial must land together (`check:standards` probes `id="<anchor>"`). Research + the `web-identity` intent already authored — not in scope. **Could-not-split: the only seam (by member) is additive edits to one file (no independence) and a request-only first slice recreates the acquisition-only shape #496 rejected — so it's one coherent `story·5`, work whole via `/next`.**
