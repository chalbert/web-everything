// @webeverything/contracts/range-anchor — the Durable Range Anchor protocol's pure-contract surface
// (#1471, ratified #1408 Fork 2 split). Type-only re-export (zero runtime emit) of the canonical contract
// module; the runtime impl (the serializer/resolver + fuzzy matcher) is FUI's. This is the FUI→WE arrow
// over which the standard resolves, and the foundational slice the `annotation` intent + any FUI behavior
// block import (contract-ts-is-a-separate-slice). Adopts the W3C Web Annotation selector vocabulary
// (TextQuote / TextPosition / Range) wholesale at the wire layer; target-agnostic (annotation,
// deep-linking, citations, #:~:text= scroll-to-text, durable test selectors).
export type * from '../range-anchor/contract';
