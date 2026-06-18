# MaaS execution-conformance gate policy — fold-into-default vs optional-toolchain suite

> Prep prior-art survey for decision **#549** (slice 3 of epic #507, ratified parent #463 fork a/c).
> Scope: the **gate policy** for executing the generated foreign-language MaaS origin (#548, C#)
> through the existing #506 conformance runner. The transport (a subprocess `ConformanceTarget`) is
> already settled in code; the only open dimension is *where the compile-and-run-the-foreign-target step
> is enforced* — inside the default gate every dev/CI run pays, or as a separate suite that runs when the
> foreign toolchain is present and skips-with-notice otherwise.
> Builds on the broader [polyglot MaaS origin survey](2026-06-13-polyglot-maas-origin.md).

## The narrow question

#506 ships a deterministic, language-neutral conformance runner
([`we:runner.ts`](../blocks/renderers/module-service/conformance/runner.ts)) that drives any origin —
expressed as a `ConformanceTarget` = `(vector) => Promise<ActualResponse>` — against frozen golden
vectors and asserts byte-identical / identity-stable fidelity. The JS reference target
([`we:referenceTarget.ts`](../blocks/renderers/module-service/conformance/referenceTarget.ts)) passes by
construction (the goldens are generated from it). #548 added the **first foreign target**: a
byte-locked C# origin ([`GeneratedMaaSOrigin.cs`](../blocks/renderers/module-service/generation/__goldens__/csharp/GeneratedMaaSOrigin.cs)),
whose generation is drift-gated today only by a **string-match** snapshot test
(`we:generate.test.ts`), *not* by compiling and running it. #549 is the slice that closes that gap:
wire the C# origin as a live `ConformanceTarget` (a `dotnet`-hosted subprocess) so divergence in
*executed behaviour*, not just source bytes, is caught.

The runner's own doc-comment already pre-commits the transport: *"a generated origin is driven via a
**subprocess target** that reads the very same `we:golden.json`."* So the wiring is mechanical. The one
real decision is **gate policy**: running the C# target requires a `dotnet` toolchain (compile + execute),
which is heavy and not universally present. Fold it into the default gate (maximum drift safety, hard
toolchain dependency everywhere) or run it as an opt-in suite (portable/fast default, drift can land if
the suite isn't run)?

## What the prior art says

**Every mature cross-language conformance suite uses a subprocess-over-pipe target model — and runs it
as a *separate*, toolchain-gated job, not inside each implementation's default unit suite.**

- **Protocol Buffers conformance** ([conformance.proto](https://github.com/protocolbuffers/protobuf/blob/main/conformance/conformance.proto),
  [bufbuild/protobuf-conformance](https://github.com/bufbuild/protobuf-conformance)) drives each
  implementation as a **sub-process communicating over a pipe** (`ConformanceRequest` →
  `ConformanceResponse`). The suite is a standalone runner, gated per-implementation in its own job;
  it is famously the lesson that *a shared spec guarantees nothing without a shared executable suite*
  (same spec, 0 vs 1,847 failures across libraries) — already cited in our `we:runner.ts` header.
- **Connect / gRPC / gRPC-Web conformance** ([connectrpc/conformance](https://github.com/connectrpc/conformance))
  ships `connectconformance`, a **standalone binary** that orchestrates the client/server under test as
  subprocesses over **stdin/stdout**, with all test-case data embedded in the binary (language-agnostic).
  Implementations integrate it as a **separate CI workflow** (e.g. connect-kotlin), explicitly *not* by
  modifying each library's default test suite. This is the closest analog to our setup: a neutral runner,
  a foreign target driven as a subprocess, gated in a dedicated job.
- **OpenXR CTS** ([usage guide](https://registry.khronos.org/OpenXR/conformance/cts_usage.html)) and the
  **IPFS Gateway conformance** suite ([gateway-conformance](https://github.com/galargh/gateway-conformance))
  follow the same shape: a vendor-agnostic runner invoked as its own step, with skip/timeout knobs for
  environments that can't run a given target.

**Takeaway for the fork.** The industry default is unambiguous: cross-language conformance is a
**separate, toolchain-gated job**, because the foreign runtime is heavy and not present in the
fast inner loop. None of these suites fold the foreign-target run into the host library's default unit
gate. The survey therefore *confirms* the fork (both ends are real engineering choices) but gives a
clear steer toward the **opt-in suite** as the default — reserving "fold into the default gate" for the
stricter posture a project picks when its CI is guaranteed to carry the toolchain.

## Local precedent in this repo points the same way

`test:integration` (Playwright — a heavy browser toolchain) is already a **separate npm script** from
`test:unit` (`vitest run`), *not* folded into the default fast gate. The `check:standards` gate
(`we:scripts/check-standards.mjs`) is a pure structural/standards linter that does **not** run vitest at
all; vitest is the unit gate and `verify` chains `vitest run && build:check`. So this repo already
expresses "heavy/optional toolchain ⇒ its own script" — the same shape option B proposes for the
`dotnet` conformance run.

Environment note: `dotnet` exists locally at `/usr/local/share/dotnet/dotnet` but is **not on `PATH`**
— so even on the author's machine, a default-gate fold (option A) would need explicit toolchain
discovery, and a naive `dotnet` invocation would fail. This makes the skip-with-notice detection of
option B load-bearing even locally, not just in foreign CI.

## Recommendation

- **Default to the opt-in suite (option B):** a `check:maas-conformance`-style target (or a vitest
  project tagged so it's excluded from the default run) that detects `dotnet`, runs the C# target
  through the #506 runner when present, and **skips with an explicit notice** otherwise. Matches the
  protobuf/Connect canonical pattern *and* the repo's own Playwright precedent; keeps the fast inner
  loop portable and `dotnet`-free.
- **Keep option A available as a posture, not the default:** a project whose CI guarantees the toolchain
  can promote the suite into its required gate (the strongest anti-drift guarantee). This is a CI-config
  choice layered on top of B's runner, not a different implementation — so B is the substrate either way.
- The byte-level **source** drift gate (the existing C# string-match snapshot) stays in the default
  vitest run regardless — it's free (no toolchain) and catches the common case; #549 only adds the
  *executed-behaviour* layer on top.

## Sources

- [Protocol Buffers conformance suite](https://github.com/protocolbuffers/protobuf/blob/main/conformance/conformance.proto) · [bufbuild/protobuf-conformance](https://github.com/bufbuild/protobuf-conformance) · [Protobuf-ES conformance writeup](https://buf.build/blog/protobuf-conformance)
- [connectrpc/conformance](https://github.com/connectrpc/conformance) — standalone subprocess runner, separate CI workflow
- [OpenXR CTS usage guide](https://registry.khronos.org/OpenXR/conformance/cts_usage.html) · [IPFS gateway-conformance](https://github.com/galargh/gateway-conformance)
