---
kind: story
size: 3
parent: "618"
status: resolved
blockedBy: ["628"]
dateOpened: "2026-06-14"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: "plug:customserializerregistry + plug:customserializer + plug:customsanitizerregistry + plug:customsanitizer (src/_data/plugs.json) — webediting serializer (HTML default) + webvalidation sanitizer (setHTML+DOMPurify), #590 Forks 6-7"
tags: []
---

# webediting plugs — CustomSerializerRegistry (HTML default) + CustomSanitizerRegistry (setHTML + DOMPurify)

Add two registry plugs to we:src/_data/plugs.json (mirror the CustomPositioningRegistry+contract pair): CustomSerializerRegistry (default-less core, HTML flavor default — the Config-Extends-Platform-Default shape, #590 Fork 6) and CustomSanitizerRegistry (native Element.setHTML default + DOMPurify adapter as the production floor, composed by the editor on the insertFromPaste path, #590 Fork 7). Sanitizer ownership: webvalidation (we:projects.json:168, ratified default). Blocked by #628 (sanitizer-api capability). Renders on the plugs index.

## Progress

- Added four plugs to [we:src/_data/plugs.json](/src/_data/plugs.json) (spliced) — mirroring the registry+contract pattern (CustomPositioningRegistry/CustomPositioner, CustomEditorEngineRegistry/CustomEditorEngine): each registry plus its base contract member so the registry has a typed thing to resolve.
  - **CustomSerializerRegistry** + **CustomSerializer** (`projects: [webediting]`) — default-less core; the HTML flavor is the platform default a project config extends (Config-Extends-Platform-Default, #590 Fork 6). Contract = `serialize(model)` / `deserialize(string)` round-trip.
  - **CustomSanitizerRegistry** + **CustomSanitizer** (`projects: [webvalidation]` — ratified ownership) — native `Element.setHTML()` default + DOMPurify production-floor adapter (#590 Fork 7), composed by the editor on the `insertFromPaste` path; webediting consumes as a no-leakage client.
- Authored the four matching description partials under [src/_includes/plug-descriptions/](/src/_includes/plug-descriptions/) (Overview / Standards Alignment / Interface / Design Decisions), cross-linking registry⇄contract and to the rich-text intent / webvalidation owner.
- `npm run check:standards` green (51 plugs); 11ty `--dryrun` build smoke green.
