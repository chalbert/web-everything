/**
 * Behavioral wrapper conformance (#891, ratified #855 B2). WE owns the wrapper *contract* — a corpus of
 * generator-agnostic behavioral vectors plus a headless-DOM runner — so FUI's wrapper generator stays
 * swappable: its output is judged only against these. The #506 golden-vectors model, applied to wrapper
 * runtime behaviour instead of MaaS bytes.
 */
export * from './vectors.js';
export * from './runner.js';
