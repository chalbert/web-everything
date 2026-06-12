/**
 * Capability-manifest plane entry point (#266). Re-exports the standalone, dependency-free model: the
 * `CapabilityManifest` schema, the ratified feature vocabulary (Core + optional), the static-export
 * convention, and the semver helpers over the validation vocabulary. The downstream slices (#267
 * build-time check, #268 runtime guard, #269 report format, #270 fixtures) consume this one module.
 */
export * from './provider.js';
// Partial-implementation conformance fixtures (#270) — the shared scenario base + the canonical
// `outOfCapability` diff that #267/#268/#269 run against.
export * from './fixtures.js';
// Runtime dev-mode capability guard (#268) — warns (dev-only) when a used validation feature is not
// declared by the active implementation's manifest. The runtime sibling of the build-time check.
export * from './guard.js';
// Adherence report format (#269) — the readable artifact (structured + plain-text) the build-time
// check and runtime guard emit: honoured / unused / out-of-capability buckets, not just pass/fail.
export * from './report.js';
// Build-time `check:validation-adherence` (#267) — the fail-the-build aggregation over shipped
// implementation manifests: malformed-manifest + out-of-capability findings, the static sibling of #268.
export * from './check.js';
