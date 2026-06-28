---
kind: story
size: 3
status: resolved
dateOpened: "2026-06-28"
dateStarted: "2026-06-28"
dateResolved: "2026-06-28"
graduatedTo: none
codifiedIn: "we:src/_data/intents/surface.json"
tags: []
---

# Extend the owning intent for the presentation residual — radius/border dimensions

Per #1884's ruling, the genuine residual not yet homed by any intent — corner radius (`rounded`) and border presence/weight (`bordered`) — is covered by EXTENDING the owning intent, not by a parallel vocabulary. Add a `radius` / `border` dimension to `surface` (or the appropriate owning intent) where these genuinely carry a semantic what/why. Apply the pure-decoration-edge test from #1884: values whose semantic story is thin stay raw theme tokens; only those that earn an intent get a dimension. Standardize the meta-schema, not the list (intents-open-design).

## Resolution

`surface` is the owning intent (it already declares `texture`/`interaction`; `elevation`/`variant` live in its protocol). Both residuals are homed there as new `dimensions` axes, using the same `{ description, values }` meta-schema as the existing axes — standardizing the meta-schema, not a flat list:

- **`radius`** — corner-radius *character*, not pixels: `sharp` (square/structural, data-dense surfaces), `soft` (default approachable container), `pill` (self-contained tokens — chips/tags/avatars). Arbitrary pixel radii whose story is thin stay raw theme tokens (pure-decoration-edge test).
- **`border`** — edge delineation *strength*, distinct from elevation/texture: `none` (reads from elevation alone), `hairline` (quiet 1px containment), `emphasis` (deliberate structural boundary). Specific stroke widths/colors stay raw theme tokens.

Each value earns its place by carrying a distinct semantic what/why; values with thin stories were deliberately left as raw tokens per #1884. No parallel vocabulary was minted (the rejected Branch A). The intent's `description` protocol and TS interface were extended to match.

Touched: `we:src/_data/intents/surface.json`. graduatedTo: none — this extends an existing entity rather than minting a new one.
