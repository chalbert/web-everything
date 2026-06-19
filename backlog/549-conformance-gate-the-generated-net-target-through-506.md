---
type: decision
workItem: story
size: 2
parent: "507"
status: resolved
blockedBy: []
dateOpened: "2026-06-14"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: none
codifiedIn: "one-off"
preparedDate: "2026-06-14"
relatedReport: reports/2026-06-14-maas-conformance-gate-policy.md
tags: [module-as-a-service, polyglot, conformance, dotnet, csharp, ci-gate, generation-adapter]
---

# Conformance-gate the generated .NET target through #506

Slice 3 of #507 (epic). Wire the generated .NET origin (#548) as a target the #506 conformance runner
drives against the golden vectors; enforce byte-identical / identity-stable fidelity as the release gate
for the generated origin. This is the proof #507 was chartered to ship. Per #463 fork a/c.

## Grounding — prepared 2026-06-14

This decision **ratifies mostly-shipped infrastructure** plus **one open fork**. No new design is
invented: the runner, the JS reference target, and the byte-locked C# origin all already exist; the
subprocess transport is settled in code. The one open dimension — **where the foreign-toolchain
conformance run is enforced** — is grounded in the published research topic
[**MaaS execution-conformance gate policy**](/research/) (session report
[we:reports/2026-06-14-maas-conformance-gate-policy.md](../reports/2026-06-14-maas-conformance-gate-policy.md)),
which surveyed Protobuf / Connect / OpenXR / IPFS-gateway conformance suites and this repo's own
Playwright precedent. **1 fork, carrying a bold recommended default.** (`blockedBy: ["548"]` dropped —
#548 resolved 2026-06-14.)

## The axis — what is settled vs. what is open

The concern decomposes into two orthogonal axes; only the second is a fork.

- **Transport (SETTLED, not a fork).** `we:runner.ts` defines a clean target seam —
  `interface ConformanceTarget { run(vector): Promise<ActualResponse> }` at
  [we:runner.ts:88](../blocks/renderers/module-service/conformance/runner.ts#L88-L91) — and its header
  pre-commits the mechanism: *"a generated origin is driven via a **subprocess target** that reads the
  very same `we:golden.json`"* ([we:runner.ts:17](../blocks/renderers/module-service/conformance/runner.ts#L17)).
  The JS reference is one such target ([we:referenceTarget.ts:59](../blocks/renderers/module-service/conformance/referenceTarget.ts#L59)),
  already driven in the default vitest gate via `runConformance(referenceTarget, committed)`. So #549's
  build is mechanical: a subprocess `ConformanceTarget` + a `dotnet` host harness around the #548
  `GeneratedMaaSOrigin` ([GeneratedMaaSOrigin.cs:1](../blocks/renderers/module-service/generation/__goldens__/csharp/GeneratedMaaSOrigin.cs#L1-L3)),
  with C# impls of the injected `identity` / `transform` / `resolveDefinition` seams (`identity` must
  reproduce the JS reference's `sha256-<base64url>` byte-for-byte for an identity-stable pass).

- **Gate policy (OPEN — Fork 1).** Driving the C# target compiles + executes C# via `dotnet`, a heavy
  toolchain that is not universally present. Today the C# origin's only drift gate is a **string-match
  snapshot** in the default vitest run — `expect(a.shell.source).toBe(readCsGolden('GeneratedMaaSOrigin.cs'))`
  ([we:generate.test.ts:91](../blocks/__tests__/unit/renderers/generation/generate.test.ts#L91)), whose own
  label says *"string-match — execution conformance is #549"*
  ([we:generate.test.ts:94](../blocks/__tests__/unit/renderers/generation/generate.test.ts#L94)). #549 adds
  the *executed-behaviour* layer; the only question is **where that layer is enforced**.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 — Gate policy** | **B. Separate opt-in suite** (`check:maas-conformance`, detect `dotnet` / skip-with-notice) | A. Fold into the default gate (every run compiles + drives C#) | **High** — matches the canonical protobuf/Connect pattern *and* the repo's Playwright precedent ([we:package.json:17-18](../package.json#L17-L18)); A stays available as a CI posture layered on B |

## Fork 1 — Gate policy: where is the foreign-toolchain conformance run enforced?

**Crux.** Running the C# target needs `dotnet` (compile + execute). The default fast loop — `vitest run`
([we:package.json:17](../package.json#L17)) and the structural `check:standards`
([we:package.json:24](../package.json#L24), a pure linter that runs no tests) — is `dotnet`-free today.
Adding the executed-behaviour layer forces a choice: make every run carry the toolchain, or gate the run
on the toolchain's presence. Note `dotnet` exists locally at `/usr/local/share/dotnet/dotnet` but is
**not on `PATH`** — so even here, the run needs explicit toolchain discovery, and a naive `dotnet` call
fails.

- **Option A — Fold into the default gate.** The default run (the vitest suite, or `verify`) compiles +
  drives the C# target on every invocation. *Strongest guarantee:* the generated origin can never drift
  unnoticed. *Cost:* a **hard `dotnet` dependency** in every dev/CI environment and a slow compile step in
  the inner loop; on a machine without `dotnet` on `PATH` (including this one by default) the default gate
  goes red for an environment reason, not a real failure.

- **Option B — Separate opt-in suite. ✅ recommended default.** A `check:maas-conformance`-style target
  (or a vitest project tagged out of the default run) that **detects `dotnet`, drives the C# target through
  the #506 runner when present, and skips-with-notice otherwise** — kept out of the default gate.
  *Portable + fast default;* the foreign-target gate is not enforced by the default run, so a project that
  wants hard enforcement opts in (see below). This is exactly how every mature cross-language suite ships:
  Protobuf conformance drives each impl as a sub-process over a pipe as a standalone gated job;
  connectrpc/conformance is a standalone `connectconformance` binary integrated as a *separate CI
  workflow*, not each library's default unit suite (research topic, finding 1). It is also how this repo
  already treats heavy toolchains — `test:integration` (Playwright) is a separate script from `test:unit`
  ([we:package.json:17-18](../package.json#L17-L18)).

**Recommended default: B (separate opt-in suite).** It is the industry-standard shape for
foreign-toolchain conformance and the shape this repo already uses for heavy toolchains, and it keeps the
inner loop portable. Crucially, **A is not rejected — it is a CI posture layered on B**: a project whose
CI guarantees `dotnet` promotes the same suite into a *required* gate (one line of CI config), getting A's
"can never drift" guarantee without B's runner being a different implementation. So B is the substrate
either way; choosing B as the default loses nothing that a strict project can't re-add.

*Independent of this fork:* the free byte-level **source** snapshot
([we:generate.test.ts:91](../blocks/__tests__/unit/renderers/generation/generate.test.ts#L91)) stays in the
default vitest run regardless — it needs no toolchain and catches the common case.

### Per-fork classification (the 7-question pass)

- **Which layer?** Devtools / build-gate tooling, not a shipped standard — this is *how the constellation
  verifies* the generated origin, never an artifact a project consumes.
- **Protocol or intent dimension?** Neither — it is a conformance-harness/CI policy, orthogonal to the
  serve-path IR contract (#505) and the generation mechanism (#507).
- **Expose the whole axis?** Yes, and B does: the gate strictness becomes a *configurable CI posture*
  (opt-in by default, promotable to required) rather than a baked mechanic — the most flexible framing.
- **Fixed mechanic or dimension?** A dimension (strictness vs. portability) with two legitimate ends — a
  real decision, not a snap call. B makes one end the default while keeping the other reachable.
- **DI-injectable?** The target already is (`ConformanceTarget` is injected into `runConformance`); this
  fork is purely *whether the default gate invokes the dotnet-backed target*, not a new injection seam.
- **Most-permissive default?** B — the least-restrictive default (no mandated toolchain in the inner
  loop); the restriction (required gate) is the strict project's opt-in. Honours most-flexible-default.
- **Seam between concerns?** Keeps the foreign-toolchain run *separated* from the portable default gate
  (the standing separate-and-decouple bias) — fold-in (A) couples them; B keeps two composable homes with
  A re-derivable by config.

## What #549 builds once the fork is ratified (mechanical)

1. A subprocess `ConformanceTarget` adapter that spawns a `dotnet`-hosted C# harness around
   `GeneratedMaaSOrigin`, feeding it `we:golden.json` vectors and normalizing its responses to
   `ActualResponse`.
2. The C# host harness: C# impls of the injected `identity` / `transform` / `resolveDefinition` seams,
   with `identity` reproducing the JS reference's `sha256-<base64url>` byte-for-byte.
3. The gate wiring per the ratified default (B): a `check:maas-conformance` target that detects `dotnet`,
   runs the suite when present, skips-with-notice otherwise — outside the default gate, promotable to
   required by CI config.

## Decision (ratified 2026-06-15)

**Fork 1 → Option B (separate opt-in suite).** The .NET execution-conformance run is a `check:maas-conformance`
target kept OUT of the default/inner loop: it detects a capable (`.NET 8+`) toolchain, drives the generated
origin through the #506 runner against the golden vectors when present, and **skips-with-notice** otherwise.
A `dotnet`-guaranteed CI promotes it to required with `-- --require` (option A as a CI posture layered on B —
not rejected, just not the default). The free byte-level **source** snapshot stays in the default vitest run.

### What shipped

- **Subprocess target** — [we:dotnetTarget.ts](../blocks/renderers/module-service/conformance/dotnetTarget.ts):
  the generated origin as a `ConformanceTarget`, spawned once over the whole vector set, held to the same
  byte-identical / identity-stable bar by the one neutral runner.
- **C# host harness** — [dotnet/Program.cs](../blocks/renderers/module-service/conformance/dotnet/Program.cs)
  + [MaasConformanceHost.csproj](../blocks/renderers/module-service/conformance/dotnet/MaasConformanceHost.csproj):
  compiles the byte-locked `OriginCore.cs` + `GeneratedMaaSOrigin.cs` **as-is** and injects the
  `identity` / `transform` / `resolveDefinition` seams. The `identity` impl reproduces the #088
  `sha256-<base64url>` id + `sha256-<base64>` SRI **byte-for-byte** (verified against the golden ETag/integrity).
  The form **catalog** 400 is host-supplied (it is impl, not neutral contract).
- **Gate** — [we:scripts/check-maas-conformance.mjs](../scripts/check-maas-conformance.mjs) +
  `check:maas-conformance` npm script, driving
  [we:vitest.maas-conformance.config.ts](../vitest.maas-conformance.config.ts) →
  [we:maasDotnetConformance.test.ts](../blocks/renderers/module-service/conformance/dotnet/maasDotnetConformance.test.ts)
  (outside the default `include`; self-skips without `MAAS_DOTNET`).

### First findings (the gate works) — filed as spin-offs

This repo's only `dotnet` is 2.1.4, so the gate **skips-with-notice here** (the ratified behaviour; default
gate stays green). Compiling the byte-locked goldens AS-IS surfaced two genuine #548 generation gaps that
would block a green execution run on a capable toolchain — captured, not silently absorbed:

- **#661** — generated origin won't compile: `NameValueCollection.TryGetValue` doesn't exist (one-line
  we:csharp.ts fix). Blocks any execution run.
- **#662** — generated origin needs an injected form-catalog seam (it can't mint the unknown-form 400 itself;
  the host supplies it). Blocked by #661.

## Progress

- **Status:** resolved (2026-06-15)
- **Done:** subprocess target + C# host harness + `check:maas-conformance` gate (skip-with-notice / `--require`)
  + opt-in vitest suite, all outside the default gate. Identity reproduction verified byte-for-byte against
  the goldens; skip path + `--require` exit codes verified; `check:standards` green; default suite unaffected.
- **Toolchain note:** a green *execution* run needs `.NET 8+` (absent here → gate skips) **and** #661/#662
  fixed; both filed against #507.
