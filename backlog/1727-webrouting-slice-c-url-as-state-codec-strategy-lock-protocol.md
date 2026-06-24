---
kind: task
parent: "1684"
status: open
blockedBy: ["1725"]
dateOpened: "2026-06-24"
tags: []
---

# webrouting slice C — URL-as-state codec strategy-lock protocol

webrouting epic #1684 slice C: author the typed per-slice URL codec as a strategy-lock protocol we:src/_data/protocols/custom-url-codec-strategy.json + matching we:src/_data/plugs entry, mirroring CustomStorageStrategy (we:src/_data/protocols/storage.json). Native-first built-in codecs (number/boolean/enum/date/array) + raw-string escape hatch; Zod/nuqs plug in behind it. Rides resolved #1686 (codified we:docs/agent/platform-decisions.md#url-as-state-per-component-seam). Blocked by slice A (#1725).
