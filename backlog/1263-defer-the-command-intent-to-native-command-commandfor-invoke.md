---
kind: story
size: 2
parent: "1257"
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: src/_data/capabilities/invokers.json
tags: []
---

# Defer the command intent to native command/commandfor invoker buttons

Native invoker commands (command and commandfor attributes, paired with the Popover API) are shipping in Chromium. The command intent (#299, webcommands #016) should register native invokers as its resolver impl per native-first (#031), with the scripted path as fallback. Verify Baseline status. Surfaced by the 2026-06-20 platform-standards watch (#1257).

## Progress

Resolved 2026-06-20. **Baseline verified deterministically** against the installed `web-features`
package: invoker commands reached **Baseline newly-available on 2025-12-12** (web-features key
`invoker-commands`, `status.baseline: "low"`) — no longer Chromium-only.

Registered the native as the command intent's resolver in we:src/_data/capabilities/invokers.json:
- `baseline: false` → `"2025"` (the verified Baseline-low year).
- **Fixed a wrong `webFeaturesKey`** — it was `"command"`, which does not resolve in web-features; the
  correct key is `"invoker-commands"`. (The bogus key meant the capability's baseline could never have
  been auto-verified against the feature data.)
- `polyfill: "polyfillable"` retained = the scripted keybinding/handler path is the fallback (native-first
  with graceful degradation, #031). Summary notes the native-first resolver role.

The command intent def (we:src/_data/intents/command.json) already grounds on the Invoker Commands API in
prose (native-first; a keybinding engine is the opt-in adapter) — now consistent with the capability's
Baseline year. Flipped the front-A watch ledger (we:src/_data/nativeFirstWatch.json) `invokers` →
`registered: true` (registeredIn we:src/_data/capabilities/invokers.json), so the #1267 metric now reads 1/6. Gate green.
