---
kind: story
size: 3
status: open
locus: webeverything
dateOpened: "2026-06-22"
tags: []
---

# Cold-start bootstrap crash: a trait/behavior registers 'anchor' as a CustomAttribute without a hyphen (define throws, kills the whole demo bootstrap)

On a FRESH-process cold start (a 2nd Vite instance, fresh module graph), we:plugs/bootstrap.ts crashes during trait/behavior registration with: Failed to execute 'define' on 'CustomAttributeRegistry': 'anchor' is not a valid custom attribute name — it must contain a hyphen (or ':' namespace). The throw halts the ENTIRE bootstrap before text-node upgrade, so every interpolation/behavior demo renders empty on cold start (the warm :3000 hides it — singletons survive HMR). Proven pre-existing (reproduces with #1207's fix reverted) and SEPARATE from #1207. Likely the 'anchor' intent's trait/behavior (anchor-positioning) being registered under the bare name 'anchor' via the generated virtual:trait-manifest or an event-attribute/behavior register call — a CustomAttribute name MUST be hyphenated. Find the registration (grep the generated trait manifest + register* calls for 'anchor'), rename to a hyphenated trait name (e.g. anchor-position) or gate it. Blocks #1207's live verification + its real-browser regression test. Found in batch-2026-06-21-1429-1487 while verifying #1207 on a 2nd-port cold start.
