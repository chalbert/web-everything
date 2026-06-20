---
kind: story
size: 2
parent: "1257"
status: open
dateOpened: "2026-06-20"
tags: []
---

# Defer the command intent to native command/commandfor invoker buttons

Native invoker commands (command and commandfor attributes, paired with the Popover API) are shipping in Chromium. The command intent (#299, webcommands #016) should register native invokers as its resolver impl per native-first (#031), with the scripted path as fallback. Verify Baseline status. Surfaced by the 2026-06-20 platform-standards watch (#1257).
