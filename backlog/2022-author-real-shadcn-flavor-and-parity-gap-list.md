---
kind: story
size: 8
parent: "1226"
status: active
blockedBy: ["2017"]
dateOpened: "2026-07-01"
dateStarted: "2026-07-02"
tags: [parity, flavor, shadcn, dtcg, gap-list]
---

# Author a real shadcn/ui flavor + produce the parity gap list

## Digest

#1243 is marked resolved but the code shows **no shadcn artifact**: no shadcn token file, no conformance harness,
no gap list — only a couple of aliases in `fui:webtheme/defaultTokens.ts:120-154` that *mention* shadcn `--ring` /
`--border` / `--muted` parity. This item delivers what #1243 claimed: a **real** shadcn flavor as a full DTCG token
override, loaded through the #2017 manifest loader, tested against representative shadcn components (button, input,
card), producing the **gap list** — the concrete set of things `theme tokens + intents` cannot express (the actual
deliverable of the reproduction-conformance program #1226 / #1225).

## Scope

- Author `we:design-systems/shadcn.designsystem.json` + `we:design-systems/shadcn.tokens.json` as a **full** DTCG
  override capturing shadcn's token names + values (color, radius, ring, border/input/muted roles) — not a stub.
- Load it via the #2017 manifest→ThemeSource loader; render FUI button/input/card under it.
- Diff against reference shadcn output (visual + behavioral); record every divergence.
- Publish the **gap list** as a `we:reports/…` topic: what tokens+intents reproduce cleanly, and what needs a new
  intent / trait / token role (feeds #1226's evolving standard).

## Acceptance

- shadcn flavor loads through the manifest loader and re-themes FUI button/input/card to shadcn's look, verified by
  Playwright screenshots vs a shadcn reference.
- A written gap list exists (report) enumerating non-reproducible aspects with proposed intents/tokens.
- ~~#1243 is reconciled — either superseded by this item or updated to point at the real artifact.~~
  **Done (#2032, 2026-07-01):** #1243 now carries `supersededBy: "2022"` and a reconciliation note recording that
  its "resolved" status covers only the declarative scaffold (zero readings ingested), and that the real
  rendered/measured shadcn flavor + proven gap list is THIS story. This story is the single source of truth for the
  measured-parity deliverable; complete it to discharge the reconciliation.

## Notes

- Depends on #2017 (loader). WE holds the manifest/tokens data; FUI holds the component impl.
- Reference note-of-caution: an alias merely *named* for shadcn is not proof of parity (see naming-fork
  precedent) — parity is proven by rendering real components and diffing, not by token-name lookalikes.
