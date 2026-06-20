// @webeverything/contracts/positioning — the Positioning protocol's pure-contract surface (#1018/#1048/#1049).
// Type-only re-export (zero runtime emit) of the canonical contract module; the runtime impl is FUI's
// (the native CSS-anchor strategy, the JS fallback, the feature-detected resolver, and the
// `customPositioning` swap registry all live in `fui:blocks/droplist/positioning/`). This is the FUI→WE
// arrow over which the standard resolves: an independent positioning engine (native anchor, JS loop,
// Floating-UI adapter) satisfies `PositioningStrategy` without any runtime crossing the seam, exactly
// like `./guard` and `./analytics`.
export type * from '../positioning/contract';
