---
type: issue
workItem: story
size: 2
parent: "507"
status: open
blockedBy: ["548"]
dateOpened: "2026-06-14"
tags: []
---

# Conformance-gate the generated .NET target through #506

Slice 3 of #507 (epic). Wire the generated .NET origin (#548) as a target the #506 conformance runner drives against the golden vectors (blocks/renderers/module-service/conformance/runner.ts); enforce byte-identical / identity-stable fidelity as the release gate for the generated origin. This is the proof #507 was chartered to ship. Per #463 fork a/c.

## Surfaced fork (2026-06-14, batch pre-flight on #548 close-out) — breaks the cascade here

The transport is **settled**, not a fork: `runner.ts` already defines a clean `ConformanceTarget`
(`(vector) => Promise<ActualResponse>`) and its doc-comment states a generated origin "is driven via a
**subprocess target** that reads the very same `golden.json`." So #549 builds a subprocess `ConformanceTarget`
adapter + a C# host harness around the #548-generated `GeneratedMaaSOrigin` (C# impls of the injected
`identity`/`transform`/`resolveDefinition` seams — note `identity` must reproduce the JS reference's
`sha256-<base64url>` byte-for-byte for an identity-stable pass).

**The open fork is the GATE POLICY, not the wiring:** running the C# target compiles + executes C# via
`dotnet`, so —

- **A. Fold into the standard gate** — `check:standards` (or the vitest run) compiles + drives the C#
  target on every run. Strongest guarantee (the generated origin can never drift unnoticed), but takes a
  **hard `dotnet` toolchain dependency** in every dev/CI environment and adds a slow compile step.
- **B. Separate opt-in conformance suite** — a `check:maas-conformance`-style target that runs only when
  `dotnet` is present (skip-with-notice otherwise), kept out of the default gate. Portable + fast default;
  the cost is the foreign-target gate is not enforced by default (drift can land if the suite isn't run).

Both are legitimate end-states (gate strictness vs. portability/speed) — a real dimension, so it's a
decision, not a batch-tail snap call. Resolve this fork, then #549 is mechanical. `dotnet` **is** available
locally (`/usr/local/share/dotnet`), so A is feasible here; B is the portable default. Surfaced + parked by
the 2026-06-14 batch after #548 landed; successors (none) stay blocked on this call.
