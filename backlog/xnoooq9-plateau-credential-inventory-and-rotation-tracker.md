---
kind: story
size: 8
status: open
scope: ["we:scripts/conveyor/credential-inventory.mjs", "we:scripts/conveyor/health-smells/credential-inventory-stale.mjs", "we:scripts/lib/github-app-token.mjs", "we:scripts/conveyor/pr-events-worker/wrangler.toml", "plateau:.github/workflows/ci.yml", "we:.github/workflows/ci.yml"]
dateOpened: "2026-09-28"
tags: []
---

# Plateau: credential inventory and rotation tracker

Operator ask (2026-09-28 ~7:15pm ET): plateau-app's `FUI_READ_TOKEN` (a static fine-grained PAT,
`plateau:.github/workflows/ci.yml` line 65) expired silently and blocked every plateau-app PR until the
operator rotated it by hand. Nothing in the constellation's automation noticed the expiry before it broke a
running job — this card is the fix: know what's about to expire before it does.

## Design (full)

**Placement.** Per constellation-placement (we:docs/agent/platform-decisions.md, anchor
`#constellation-placement`): WE holds zero implementation, so this card's backlog *home* is WE (this repo,
locus-prefixed) regardless of where each piece of code lands. A read-only inventory/health-smell script that
drives WE's own delivery fleet (alongside `we:scripts/conveyor/health-smells/` siblings) is operational
tooling, not "the standard" — it stays `we:`. A served, credential-holding surface (a Plateau UI panel
reading live status) is a product concern → `plateau:`. Reminders that page a human are a product/
notification concern → `plateau:` (or the existing WIP relay) once the panel exists.

**Inventory scope — every credential the constellation's automation depends on:**
- **GitHub repo/org secrets** — names + `updated_at` only, via `gh api repos/<owner>/<repo>/actions/secrets`
  (and `orgs/<org>/actions/secrets` where the caller has org admin) across `chalbert/web-everything`,
  `chalbert/frontierui`, `chalbert/plateau-app`. Never the secret value — the API does not return it, but the
  inventory must not attempt to (e.g. never echo an actions-cache artifact that could carry it).
- **Fine-grained PAT expiry**, where observable — the `github-authentication-token-expiration` response
  header on any authenticated `api.github.com` call made with that PAT (metadata only; requires actually
  holding the PAT to probe with, so this entry is best-effort / operator-assisted for tokens the inventory
  script itself doesn't hold — `FUI_READ_TOKEN` itself is a plateau-app repo secret consumed only inside CI,
  so the inventory can name it and its declared owner/rotation steps without probing its header directly from
  outside that job).
- **The GitHub App private key** — path + file age (mtime) only, e.g.
  `~/.secrets/github-apps/web-everything.2026-09-22.private-key.pem`, referenced via
  `we:scripts/lib/github-app-token.mjs`'s `WE_GITHUB_APP_PRIVATE_KEY_PATH` env var (see also
  `we:scripts/lib/github-app-auth-env.mjs`'s `WE_GITHUB_APP_ID`/`WE_GITHUB_APP_INSTALLATION_ID`). The cached
  installation token (`~/.claude/github-app-token/<repo>.json`) already carries its own `expiresAt` — surface
  that directly rather than re-deriving it.
- **Local secret files under `~/.secrets`** — names + mtime only (e.g. `we-pr-events-read-token`,
  `we-pr-events-webhook-secret`, `github-apps/*.private-key.pem`) — never open/print contents.
- **The pr-events Worker secrets** — `GITHUB_WEBHOOK_SECRET`, `PR_EVENTS_READ_TOKEN` (declared in
  `we:scripts/conveyor/pr-events-worker/wrangler.toml`'s header comment) are Cloudflare Worker secrets, not
  locally readable; the inventory records them as a manually-tracked entry (owner, where used, last-rotated)
  since `wrangler secret list` reports names only, no timestamp — call it out as a known gap rather than fake
  a freshness signal.
- **Codex / Antigravity / Claude CLI logins** — logged-in or not, and which account, per CLI (a
  process/config probe, not a credential value read).
- **The WIP relay token** — owner, where it's used, last-verified-working.
- Each entry: owner, where it's used (file:line / workflow step), expiry or age, last-verified-working, and
  step-by-step rotation instructions (so a silent-expiry incident like this one's root cause has a documented
  fix path, not another ad hoc hand rotation).

**Health smells:**
1. "expires within N days" — any inventoried credential whose expiry/age crosses a configurable threshold.
2. "a CI job failed with Bad credentials" — pattern-match CI failure logs/status for the GitHub
   `Bad credentials` (401) signature, which is the actual failure mode that broke plateau-app's PRs on
   2026-09-28.

**Plateau view (follow-up):** a credentials panel on `/wip` or settings listing status + next-rotation date
per credential, reusing the inventory's output as data. **Reminders (follow-up):** notify before expiry
(reuses the existing WIP relay / notification path once it exists).

**Relationship to x8x0ris** (CI mints short-lived GitHub App tokens, in flight): that card's goal is
*eliminating* static tokens where possible; this card's inventory is how you'd know which credentials are
still static and therefore in x8x0ris's target list — this card does not block on x8x0ris, and x8x0ris does
not block on this card, but the inventory's "static vs. minted" column is the natural handoff between them.

## MVP cut

**Must (MVP, this card):**
- A read-only WE-side inventory script (`we:scripts/conveyor/credential-inventory.mjs`) covering **GitHub
  repo secrets only** (names + `updated_at`, via `gh api repos/<owner>/<repo>/actions/secrets`) across the
  three constellation repos. Output: structured JSON (one row per secret: repo, name, `updated_at`), no
  values, ever.
- A health smell (`we:scripts/conveyor/health-smells/credential-inventory-stale.mjs`, following the existing
  `we:scripts/conveyor/health-smells/pr-events-stale.mjs` shape) for exactly two conditions: (a) a repo
  secret's `updated_at` older than a configurable threshold ("expires within N days" specialized to "hasn't
  rotated in N days" for the secrets that carry no API-visible expiry), and (b) a CI run failing with the
  `Bad credentials` (401) signature — the literal failure mode that caused the 2026-09-28 incident.
- Unit tests for both (fixture-driven, matching the existing health-smell test shape).

**Could (follow-up, already designed above — not built now):**
- Fine-grained PAT expiry via the `github-authentication-token-expiration` response header.
- GitHub App private key path+age, local `~/.secrets` file names+mtimes, pr-events Worker secret tracking,
  CLI login status (Codex/Antigravity/Claude), and the WIP relay token — the fuller inventory rows.
- The Plateau `/wip`/settings credentials panel (`plateau:` — a served, credential-status-holding UI surface).
- Expiry reminders (notification delivery).
- Cross-reference into x8x0ris's static-token list.

**Size:** the MVP is one new script + one new health smell + tests, comparable to the existing
`we:scripts/conveyor/health-smells/pr-events-stale.mjs` precedent — within this card's own declared `size: 8`
(the fuller design's breadth is why the whole-design size is 8 rather than smaller; the MVP itself is closer
to a size-5 slice of it).

## Done when

1. **Must** — `we:scripts/conveyor/credential-inventory.mjs` runs read-only and reports GitHub repo secret
   names + `updated_at` (never values) across web-everything/frontierui/plateau-app;
   `we:scripts/conveyor/health-smells/credential-inventory-stale.mjs` flags a stale (un-rotated past
   threshold) secret and the `Bad credentials` CI-failure pattern; both have unit tests; `npm run
   check:standards` passes.
2. **Could** — the Plateau `/wip`/settings credentials panel, expiry reminders, PAT-header/App-key/local-file/
   Worker-secret/CLI-login inventory rows, and the x8x0ris cross-reference are filed as follow-up work when
   picked up, not required for this card to resolve.
