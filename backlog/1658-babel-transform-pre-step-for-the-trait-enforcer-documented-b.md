---
kind: story
size: 3
parent: "718"
status: resolved
priority: low
locus: frontierui
graduatedTo: frontierui/tools/trait-enforcer/babel-prestep.ts
dateOpened: "2026-06-23"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
tags: [webtraits, trait-enforcer, build-tooling, babel, deferred]
---

# Babel transform pre-step for the trait Enforcer (documented, build-whenever)

Add a documented Babel transform pre-step for the trait Enforcer against the #716 manifest contract, mirroring the #234/#744 documented-pre-step template. Specifiable now, demoted to priority:low — built ahead of a concrete consumer when there's a slack window, not gated on adoption.

## Progress (batch-2026-06-26-1806-1825)

Built in FUI (the trait Enforcer's build adapters live in `fui:tools/trait-enforcer/`, relocated there under
the zero-impl rule; only the #716 contract stays WE-resident at `we:tools/trait-enforcer/traitManifestContract.ts`),
so `locus` was corrected `webeverything → frontierui`.

The Enforcer serves its manifest as a **virtual module** (`virtual:trait-manifest`) through each bundler's
module graph. Babel has no virtual-module resolver / module graph (it's a per-file JS-AST transform), so — as
with the `<component>` compiler's babel case (#234/#744) — a babel-only pipeline consumes the manifest through
a **documented pre-step that materializes the manifest to disk** ahead of babel, then imports that file
instead of the virtual id:

- `fui:tools/trait-enforcer/babel-prestep.ts` — `writeTraitManifest(options, outPath)`: calls the **shared**
  `buildTraitManifestSource()` core (the same one every bundler adapter uses), creates missing parent dirs,
  writes the source, returns it. Output is **byte-identical** to the virtual module the bundlers serve (#716
  realized once — ordering, not a babel-specific plugin). Rich doc-comment covers the why + the prebuild-script
  and bootstrap wiring snippets.
- Tests: `fui:tools/trait-enforcer/__tests__/babel-prestep.test.ts` — asserts the on-disk file is byte-identical
  to `buildTraitManifestSource()` and nested dirs auto-create. 1/1 green.

Sibling on the toolchain-*depth* axis: #1659 (SWC-native trait transform, Rust/WASM) stays `maturityGated`.
