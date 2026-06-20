// @webeverything/contracts/webdocs — the Web Docs Doc Spec protocol's pure-contract surface (#1163).
// Type-only re-export (zero runtime emit) of the canonical contract module. The runtime impl — the
// generator, the resolver, the conformance driver — is FUI's (`fui:webdocs/generator.ts`); this is the
// FUI→WE arrow over which the standard resolves, exactly like `./positioning` and `./guard`. The golden
// conformance-vector data lives WE-side at `we:conformance-vectors/webdocs.vectors.ts` (#899/#1016).
export type * from '../webdocs/contract';
