---
kind: story
size: 3
status: open
blockedBy: ["907"]
dateOpened: "2026-07-02"
tags: []
---

# Pilot consumption channel: publish the pilot-scoped artifact set (FUI blocks/plugs + a react/vue generated wrapper)

Ratified #2089 Gate A prerequisite (ratify-turn skeptic find): 'consuming only published artifacts' is satisfiable through no filed path — @frontierui/blocks is private:true, #907 publishes @webeverything/contracts only, gen-wrapper output is workbench-localhost-only, MaaS live-serve is parked (#1625). Publish/deliver the pilot-scoped set: the adopted FUI blocks/plugs plus at least one forward-generated framework wrapper for an EXISTING emit target (react or vue), consumable by an external team with no constellation-insider support. blockedBy #907 (blocks publish needs the pinned contracts dep). The pilot story is blockedBy this channel.
