---
type: issue
workItem: story
size: 2
status: resolved
dateOpened: "2026-06-08"
dateStarted: "2026-06-09"
dateResolved: "2026-06-09"
tags: [catalog, dx, vite, proxy, authoring-checklist, drift-guard]
---

# New catalog routes silently 404 on :3000 until added to the Vite proxy allowlist

Surfaced while landing [#204](/backlog/204-capability-vocabulary-provider-interface-matrix/): adding the
`/capabilities/` catalog page made it render on the 11ty server (`:8080`) but **404 on the Vite dev
server (`:3000`)** until `capabilities` was hand-added to the explicit proxy alternation in
`vite.config.mts` (the `^/(projects|intents|protocols|…)` regex). The 11ty `--serve` watcher picks up a
new `.njk` automatically; the Vite proxy does not — its catalog list is a hard-coded allowlist, so every
new discovery surface is one silent papercut away from a broken local URL.

The catalog-authoring checklist (memory: *Catalogs Auto-Render From JSON* → "page + nav + authoring note
+ validator") is **missing this step**, and a config edit only takes effect on a Vite restart, so the
miss isn't obvious mid-session.

## Options

- **A — Make the proxy a catch-all to 8080 with a Vite-route denylist.** Forward anything not owned by
  Vite (`/@`, `/node_modules`, `/src`, `.ts`/`.tsx`, HMR) to 11ty. Removes the allowlist entirely so no
  future catalog can miss it. Slightly riskier (must not swallow Vite's own asset/HMR routes).
- **B — Keep the allowlist, add the step to the authoring checklist + a `check:standards` guard.** A
  validator that cross-checks `src/*.njk` top-level catalog permalinks against the proxy regex and errors
  on a missing one. Cheap, explicit, keeps the denylist risk away — but still a manual edit per catalog.

Recommendation: **B** (low-risk, makes the drift fail loudly) unless the catch-all proves clean. Either
way, update the catalog-authoring note in `we:docs/agent/design-first.md` to list the proxy step.

## DoD

`check:standards` green; a new top-level catalog `.njk` either auto-proxies (A) or fails the build until
the proxy is updated (B); the authoring checklist names the step.

## Resolution

Chose **B** (keep the allowlist, fail the drift loudly) — the catch-all denylist (A) risked swallowing
Vite's own asset/HMR routes, and B is the low-risk recommendation. Landed:

- **Validator** — new section #9 in `we:scripts/check-standards.mjs` cross-checks every `src/*.njk`
  permalink's first path segment against the proxy keys parsed from `vite.config.mts`; errors on any
  segment Vite doesn't forward to 8080. Segment match is delimiter-bounded so `js` matches `|js)` but
  not a stray substring.
- **Latent bug fixed** — the validator immediately caught `adapters`: `/adapters/<id>/` was 200 on
  11ty `:8080` but **404 on Vite `:3000`** (confirmed by probe). Added `adapters` to the proxy
  alternation in `vite.config.mts`. `check:standards` now green (0 errors).
- **Checklist** — `we:docs/agent/design-first.md` → *Documentation Standards (11ty/Nunjucks)* now names
  the proxy step and notes the edit needs a **Vite restart** to take effect locally.

Note: the proxy regex change requires a Vite dev-server **restart** to apply on `:3000` (config edits
aren't hot-reloaded). The validator guard works without a restart.
