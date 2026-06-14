/**
 * Conformance-evidence plane entry point (#599). Re-exports the standalone, dependency-free contract: the
 * `ConformanceEvidenceManifest` shape, the builder, the propose-and-verify success signal, and the
 * structural validator. The Plateau dev-browser (the consumer, #475/#091 split) imports this to render the
 * manifest into a PR body; a polyglot fix-loop emits the same shape via the forward adapter.
 */
export * from './provider.js';
