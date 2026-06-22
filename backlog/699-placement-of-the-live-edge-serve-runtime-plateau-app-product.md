---
kind: decision
size: 2
parent: "479"
status: resolved
preparedDate: "2026-06-22"
dateOpened: "2026-06-15"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#constellation-placement"
tags: []
---

# Placement of the live edge serve runtime — plateau-app product vs WE reference demo

De-buried from #479's body (the live-serve placement fork). **Where does the live edge serve runtime
live, and does the WE repo take the HTTP-server + bundler deps?**

## Grounding digest

- `EdgeChunkCache.serve` today returns a `Resolution` (a plan), not bytes
  ([`we:capabilities/edge.ts:169`](../capabilities/edge.ts#L169)) — the runtime that bundles + serves real
  module bytes at `componentUrl` ([`we:capabilities/edge.ts:88`](../capabilities/edge.ts#L88)) over HTTP
  is unbuilt.
- The placement is governed by a **codified statute**, not an open design question: the constellation
  layering rule ([`we:docs/agent/platform-decisions.md:75`](docs/agent/platform-decisions.md#constellation-placement))
  — *"WE never hosts delivery runtime, not even as a 'reference implementation.' The former
  reference-implementation tier … is **withdrawn**."* A served, credential-holding product → Plateau; WE
  holds contract/protocol/interface only.
- No new `/research/` topic — this ratifies the existing constellation-placement + defer-live-serve
  stances against the real tree, a prior-art-settled call.

## Ruling (ratified 2026-06-22)

**Resolved (a) + the bundler-neutrality amendment.** The live edge serve runtime is a **plateau-app
product surface**; WE ships only the contract plus a **pure, bundler-neutral emit-build-plan** (capability-class,
cache-key, declarative `Vary`/`Accept-CH`/immutable header directives — no HTTP server, no bundler dep),
enforced bundler-neutral by a WE-side [`we:capabilities/check.ts`](../capabilities/check.ts) conformance vector.
Branch (b) (WE in-repo reference esbuild server) is **statute-foreclosed** by
[constellation-placement](docs/agent/platform-decisions.md#constellation-placement) — the reference-runtime tier is withdrawn.

Filed the two build slices of epic #479:
- [#1624](/backlog/1624-edge-venue-edgechunkcache-emits-a-bundler-neutral-build-plan/) — WE emit-build-plan + neutrality vector (agent-doable; `parent: 479`).
- [#1625](/backlog/1625-edge-venue-live-serve-plateau-app-consumes-the-we-emit-build/) — plateau-app serve-consumer (`relatedProject: plateau-app`, `blockedBy: 1624`); the actual live-serve product, deferred by defer-live-serve.

## Axis framing — where the bytes are built/served

Both candidate branches satisfy #479's DoD *behaviour* (a built chunk keyed by capability class, shared
across a class, degrades on a wrong guess); they differ only on **where the bytes are built/served**. That
"where" is not actually open — it is pinned by [`we:docs/agent/platform-decisions.md:75`](docs/agent/platform-decisions.md#constellation-placement):
a delivery runtime (HTTP server + bundler) is *impl that delivers a capability*, which the rule routes to
the Plateau/FUI layer and explicitly forbids in the WE repo, **withdrawing even the "reference
implementation" escape** that a dogfood demo might otherwise claim (a conformance demo is a *website*
artifact that surfaces FUI, never a WE-project runtime). So the live tension collapses to a forced
invariant plus one real design question: *what exactly does the WE-side "emit plan" contain so it stays
contract-only without leaking bundler impl?*

## Recommended path at a glance

| Fork | Recommended default | Main alternative (excluded) | Confidence |
|---|---|---|---|
| **Fork 1** — where the serve runtime lives | **(a) live-serve = plateau-app product; WE ships only the contract + a pure, bundler-neutral "emit plan"** (no HTTP server, no bundler dep), with a WE-side `we:check.ts` vector pinning the plan's neutrality | (b) WE hosts a reference edge server + bundler in-repo — **foreclosed by statute** ([the layering rule](docs/agent/platform-decisions.md#constellation-placement)) | **high** — B is statute-excluded; only the emit-plan shape is design work |

## Fork 1 — placement of the live edge serve runtime

**Fork-existence justification:** forced invariant — branch (b) is the *flawed/excluded* branch, foreclosed
by the codified constellation-placement rule ([`we:docs/agent/platform-decisions.md:75`](docs/agent/platform-decisions.md#constellation-placement)):
WE never hosts delivery runtime, *not even as a reference implementation* (that tier is withdrawn). So this
is a **ratify A**, with the substantive prep being the amendment that keeps the WE-side contract genuinely
impl-free.

**Crux:** a live serve runtime is HTTP-server + bundler impl. The rule routes *delivery* to Plateau/FUI and
keeps WE contract-only; the only way WE participates is by emitting a *plan* a downstream consumer serves.

**Options:**

- **(a) Live-serve is a plateau-app product surface; WE ships only the contract + a pure-logic "emit plan."**
  *(recommended default)* WE's `EdgeChunkCache` gains a deterministic **build-plan** output (what to bundle,
  the cache key, the response headers) with **no** HTTP server and **no** bundler dependency; plateau-app
  (or a thin demo) consumes that plan to bundle + serve. Honours defer-live-serve + the layering statute;
  keeps WE dependency-light. Resolving under (a) files two slices of epic #479: a **WE emit-build-plan**
  slice + a **plateau-app serve-consumer** slice.
- **(b) WE hosts a reference edge server + bundler (esbuild) in-repo as a dogfood demo.** *Rejected
  (statute-foreclosed).* Faster to a visible end-to-end DoD, but pulls a server + bundler into the standard
  repo, and [the layering rule](docs/agent/platform-decisions.md#constellation-placement)
  withdrew exactly this "reference runtime" tier — a conformance demo is a *website* artifact surfacing FUI,
  never a WE-project runtime. Not defensible even "as a throwaway demo."

**Recommended default: (a), with the bundler-neutrality amendment below.**

**Skeptic:** SURVIVES-WITH-AMENDMENT → the skeptic's protocol-bar attack ("a contract with zero in-repo
conforming impl can't be validated, so WE needs a reference server") is **foreclosed** by
[the layering rule](docs/agent/platform-decisions.md#constellation-placement) — the
reference-runtime tier is withdrawn by statute, so B is not an escape. The surviving hit is real and is
**folded into (a)**: the emit-plan could *leak* esbuild/chunk-naming + header impl into WE (coupling
without the dep). **Amendment:** the plan output must be **bundler-neutral and header-declarative** —
capability-class, cache-key, and `Vary`/`Accept-CH`/immutable directives (web-platform standards) only,
with **zero** esbuild/chunk-naming fields — enforced by a WE-side `we:check.ts` conformance vector on the
emit-build-plan slice, so the coupling cannot creep in.

## Held open — when this is ratified

Held open (decision lane): the open-core **defer-live-serve** stance defers *when* this is ratified — decide near a
real MaaS-distribution surface (#087/#088, the [constellation-placement](docs/agent/platform-decisions.md#constellation-placement)
rule) — not *whether* the fork is tracked. The fork is at DoR now (prepared); the un-park trigger is a real
live-serve distribution need surfacing on #479. Resolving it unblocks the live-serve build slices of epic
#479.
