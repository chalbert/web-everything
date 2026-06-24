---
kind: task
parent: "1684"
status: resolved
blockedBy: []
dateOpened: "2026-06-24"
dateStarted: "2026-06-24"
dateResolved: "2026-06-24"
graduatedTo: 1684
tags: []
---

# webrouting slice C — URL-as-state codec strategy-lock protocol

webrouting epic #1684 slice C: author the typed per-slice URL codec as a strategy-lock protocol we:src/_data/protocols/custom-url-codec-strategy.json + matching we:src/_data/plugs entry, mirroring CustomStorageStrategy (we:src/_data/protocols/storage.json). Native-first built-in codecs (number/boolean/enum/date/array) + raw-string escape hatch; Zod/nuqs plug in behind it. Rides resolved #1686 (codified we:docs/agent/platform-decisions.md#url-as-state-per-component-seam). Blocked by slice A (#1725).

## Progress (batch-2026-06-23-1725-1665) — DONE

Slice C landed — the URL-as-state codec as a strategy-lock protocol (#1686 ratification):
- `we:src/_data/protocols/custom-url-codec-strategy.json` — the `CustomUrlCodecStrategy` protocol (ownedByProject webrouting), mirroring `CustomStorageStrategy`/`CustomChangeStrategy`: a typed per-slice URL codec (encode/decode + native-first coercions number|boolean|enum|date|array + raw-string escape hatch); the contract is the only lock, so Zod/nuqs plug in behind it (WE ships the contract, never the parser).
- `we:src/_data/plugs/customurlcodecstrategy.json` — the matching plug entry (projects: webrouting).
- `we:src/_includes/project-webrouting.njk` — a `CustomUrlCodecStrategy Protocol` section (the `protocol-custom-url-codec-strategy` anchor the protocol requires) with the encode/decode interface highlight block; documents the per-component/router-agnostic seam + never-forced per-slice opt-in.
- `we:src/_data/semantics/custom-url-codec-strategy.json` — matching glossary term.

Native-first built-in codecs + raw-string escape hatch per #1686; the URL persistence facet is owned under webrouting (distinct from the durable-record storage protocol). Cleared the stale `blockedBy: 1725`. Gate 0 errors.
