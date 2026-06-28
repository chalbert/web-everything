---
kind: story
size: 3
parent: "1836"
locus: frontierui
status: resolved
dateOpened: "2026-06-27"
dateStarted: "2026-06-28"
dateResolved: "2026-06-28"
tags: []
---

# Drift gate: the plug parity manifest must track the FUI runtime (FUI)

FUI. A drift gate ensuring the parity manifest (S5a/#1887) tracks the runtime, mirroring the #1309 plugs drift gate. Must target the FUI tree / the manifest, NOT a WE plugs dir — Gap A: WE has no plugs/ tree, so the dual-mode walk in we:scripts/check-standards.mjs:977-979 (existsSync(join(ROOT,'plugs'))) is a silent no-op in WE. Blocked by #1887 (gate needs a manifest to check).

## Progress (batch-2026-06-27)

Added the parity-manifest drift gate to `fui:scripts/check-standards.mjs` (after the #761/#1309 plugs catalog
gate, in the FUI tree — the WE-side dual-mode walk at `we:scripts/check-standards.mjs:977-979` is a silent
no-op since WE has no `plugs/` tree). Manifest-anchored over `fui:plugs/*/parity.json` (not
bidirectional — only the audited domains carry a manifest). Three checks per manifest:
1. **Domain ↔ directory** — `manifest.domain` must equal its directory name.
2. **3-state vocab + mandatory field** — each capability's `state` ∈ `works | works-with-caveat |
   plugged-only` (#1839), with `works-with-caveat` requiring a `note` and `plugged-only` requiring a
   `residue`.
3. **Grounding tracks the runtime** — every `fui:`-prefixed path in `grounding`/`residue` (line-ranges and
   trailing annotations stripped) must resolve to a file on disk, so a verdict can't claim evidence that has
   moved or been removed.

Verified: gate green on the 10 seeded manifests (17 verdicts, 19 grounding refs all resolve); proven to
**fire** by temporarily pointing a grounding at a non-existent test → `1 error` parity-drift, green again on
restore. `blockedBy: ["1887"]` cleared (resolved). No test harness exists for `check-standards` (walks the
real tree); the green run + the fire-proof are the verification. `locus` added (the card lacked it; the gate
lives in FUI).
