---
kind: story
size: 8
status: parked
parkedReason: maturityGated
maturityTrigger: "adoptionSignal: a real host needs to embed the workbench stage for UNTRUSTED/third-party blocks (today only the FUI-owned fui:demos/workbench-host.html demo harness embeds it, with no postMessage sandbox need)"
parent: "1836"
blockedBy: ["1900"]
dateOpened: "2026-06-27"
tags: [plugs, unplugged, workbench, dev-experience, iframe]
---

# Iframe-isolated workbench stage as a consumer-distribution mode (sandboxed embedding)

Follow-up to #1845's (a): render the workbench block stage inside an iframe whose document boots the chosen plug mode, so a host can embed the stage for UNTRUSTED / third-party blocks behind a real sandbox (the iframe's load-bearing value is consumer distribution, NOT a live toggle). Requires converting the same-document synchronous inspector/trait/theme reads ('fui:workbench/mount.ts:6-11') into an async postMessage DOM bridge (precedent: the cross-origin creator bridge 'fui:workbench/manifestBridge.ts'), plus marshalling --token custom props and the CQ simulator across the frame and re-bridging the HMR refresh path. Reuses #1900's serialized '?plug' param as the per-iframe seed. Larger than size-3 by the bridge build; deferred until a sandboxed-embedding consumer is real.
