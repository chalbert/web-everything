---
kind: story
size: 3
status: open
dateOpened: "2026-07-02"
tags: []
---

# Lane clones can't build cross-repo artifacts — FUI-dependent builds (e.g. visual baselines) fail in a lane

The #2123 lane model isolates each edit in a clone under `~/workspace/.lanes/<repo>/lane-N`, but a WE build that shells out to the pinned FUI CLI resolves it at `../frontierui` relative to the repo root (`we:scripts/lib/component-render-build-hook.cjs`). In a lane that path is `~/workspace/.lanes/web-everything/frontierui`, which does not exist — so anything that builds the home page (the SSR project grid) or regenerates a visual baseline cannot run in a lane; it has to run in the primary checkout where the FUI sibling resolves. Observed 2026-07-02 while regenerating `check:visual` baselines. Decide the fix: couple a FUI lane per WE lane (the cross-repo couple model), point/symlink `../frontierui` into the lane, or exempt generated cross-repo artifacts from lane isolation. Relates to the #1933 clone model and the #2123 single-session lane-isolation rule.
