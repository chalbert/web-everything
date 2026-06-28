// @webeverything/contracts/webtheme — Web Theme's pure-contract surface (the #404 DTCG token-model schema +
// the #405 scheme/accent result types + the #1252/#1274 palette-source ingest parser contract). Type-only
// re-export (zero runtime emit) of the canonical contract module; the runtime impl — the token operations,
// the DTCG→CSS compile, the scheme/accent derivation, and the palette-source registry — is FUI's (statute
// #1282, relocated by the #1294 cascade, T2+). This is the FUI→WE arrow over which the standard resolves:
// the FUI engine imports these types, exactly like `./webcompliance` and `./webpolicy`.
export type * from '../webtheme/contract';
