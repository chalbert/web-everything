---
kind: story
size: 3
status: resolved
locus: webeverything
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: plugs/webbehaviors/traitManifest.ts
tags: []
---

# Cold-start bootstrap crash: a trait/behavior registers 'anchor' as a CustomAttribute without a hyphen (define throws, kills the whole demo bootstrap)

On a FRESH-process cold start (a 2nd Vite instance, fresh module graph), we:plugs/bootstrap.ts crashes during trait/behavior registration with: Failed to execute 'define' on 'CustomAttributeRegistry': 'anchor' is not a valid custom attribute name — it must contain a hyphen (or ':' namespace). The throw halts the ENTIRE bootstrap before text-node upgrade, so every interpolation/behavior demo renders empty on cold start (the warm :3000 hides it — singletons survive HMR). Proven pre-existing (reproduces with #1207's fix reverted) and SEPARATE from #1207. Likely the 'anchor' intent's trait/behavior (anchor-positioning) being registered under the bare name 'anchor' via the generated virtual:trait-manifest or an event-attribute/behavior register call — a CustomAttribute name MUST be hyphenated. Find the registration (grep the generated trait manifest + register* calls for 'anchor'), rename to a hyphenated trait name (e.g. anchor-position) or gate it. Blocks #1207's live verification + its real-browser regression test. Found in batch-2026-06-21-1429-1487 while verifying #1207 on a 2nd-port cold start.

## Progress — RESOLVED (root cause reproduced, gated)

**Root cause (proven by static reproduction).** The crash is in the FUI bootstrap's `fui:plugs/bootstrap.ts` → `registerTraits(traitManifest)` — NOT a WE-specific registration (WE's `traitManifest` is `{}`). The FUI trait-Enforcer scan (`we:tools/trait-enforcer/traitManifestContract.ts` `USED_TRAIT_PATTERN_TEMPLATE`) is **line-based** and false-positive matches a bare word in PROSE. `fui:demos/autocomplete-unplugged.html` had a hint line `filter + clearable + … + anchor + anchored` describing the composition; the scan tokenized `anchor`/`clearable`/`filter`/`selection` (all bare-named droplist traitMap entries, #275/#542) as "used" traits and emitted a manifest keyed by them. The manifest is **sorted ascending-lexicographic**, so `anchor` is first → `defineLazy('anchor')` → throws (no hyphen) → aborts the whole loop → kills bootstrap before text-node upgrade. The alphabetical-first detail matches the reported error precisely.

**Fix (gate, the bug's own suggested option).** Hardened `registerTraits` so an invalid (non-hyphenated, non-namespaced) manifest name is **skipped with a `console.warn`**, never thrown — one false-positive name can no longer kill the entire bootstrap. A bare name could never have been a valid CustomAttribute anyway, so skipping is loss-free; the warning surfaces a genuinely-misnamed trait for hyphenation at source.
- `we:plugs/webbehaviors/traitManifest.ts` — the canonical gate + a regression unit test (`we:plugs/webbehaviors/__tests__/unit/traitManifest.test.ts`, 15 green).
- `fui:plugs/webbehaviors/traitManifest.ts` — byte-mirrored gate (the copy FUI's bootstrap actually runs; #641/#700 replication), FUI traitManifest test 14 green.
- `fui:demos/autocomplete-unplugged.html` — reworded the prose so the trait words sit inside `<code>` (preceded by `>`, not whitespace) → no longer false-positive-scanned (removes the warning noise; the gate already prevents the crash).
- Both gates `check:standards` 0 errors. Unblocks #1207's live cold-start verification.
