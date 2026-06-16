---
type: decision
workItem: story
size: 3
parent: "715"
status: open
dateOpened: "2026-06-16"
tags: []
---

# Parcel trait Enforcer adapter — resolve the plugin-config-delivery fork (factory options vs .parcelrc + config file)

The fifth bundler. #744 shipped the webpack adapter and found Parcel can't follow the shared `traitEnforcerX(options)` factory shape: Parcel's plugin model is declarative (a Resolver referenced by name in `.parcelrc`), so the trait Map can't be a JS factory argument. **Fork:** how the Parcel resolver receives the Map — (a) a project config file (`.trait-enforcerrc` / package.json key, the idiomatic way), or (b) a generated `.parcelrc`. Dep-scope note: a real Parcel build needs the full `@parcel/config-default` stack, not just `@parcel/core` as #744 assumed. Mechanism: a Resolver returning inline `{ filePath, code }` from `buildTraitManifestSource`; verify with a real-build chunk-isolation test like the webpack case in multi-bundler.test.ts. **DoD also includes adding the Parcel row to the #722 cross-bundler conformance suite** (`cross-bundler-conformance.test.ts` — both Part A manifest byte-identity and Part B chunk isolation), completing the five-bundler matrix.
