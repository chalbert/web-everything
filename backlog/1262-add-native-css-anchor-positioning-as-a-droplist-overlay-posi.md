---
kind: story
size: 3
parent: "1257"
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: src/_data/capabilities/anchor-positioning.json
tags: []
---

# Add native CSS anchor positioning as a droplist/overlay positioning strategy

CSS anchor positioning now ships in all engines (Firefox 147 stable Jan 2026, Safari 26), approaching Baseline. Resolved #149 implemented positioning via a floating-ui DI strategy; native-first (#031) says add a native-anchor-positioning strategy as an additional and eventually default resolver, gated on cross-browser stability. Follows #149 and #136 (anchor trait behavior). Surfaced by the 2026-06-20 platform-standards watch (#1257).

## Progress

Resolved 2026-06-20. **Baseline verified** via web-features: `anchor-positioning` is `status.baseline:
false` — shipping across engines (the item's FF 147 / Safari 26) but NOT yet Baseline, so it registers as
an *additional* strategy now, default-promoted only when cross-browser-stable (exactly the item's gating).

WE-side registration is in the capability SoT (the anchor intent's `strategy` dimension is about stacking
inline/escape, not position computation — position is "delegated to a shared positioning provider," an
impl concern): updated we:src/_data/capabilities/anchor-positioning.json summary to record it as the
native-first positioning strategy registered alongside the #149 floating-ui provider, promoted to default
on Baseline, with the JS provider as fallback. `baseline: false` / `polyfill: polyfillable` kept (accurate
+ native-first-with-fallback). The actual floating-ui→native strategy swap is FUI impl (the #149 DI
provider lives in `@frontierui`), downstream of this WE standards registration. Flipped the front-A watch
ledger (we:src/_data/nativeFirstWatch.json) `anchor-positioning` → `registered: true` with a note that
default promotion is gated on Baseline (metric 3/6). Gate green.
