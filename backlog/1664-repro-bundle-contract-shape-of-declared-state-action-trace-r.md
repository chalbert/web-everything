---
kind: story
size: 5
parent: "1663"
status: resolved
locus: webeverything
dateOpened: "2026-06-23"
dateStarted: "2026-06-23"
dateResolved: "2026-06-23"
graduatedTo: "we:repro-bundle/"
tags: []
---

# Repro-bundle contract — shape of declared state, action trace, rules, ownership

Define the repro-bundle CONTRACT in Web Everything — the shape of data every layer agrees on. Specify the serializable schema for a bundle's four parts: the declared-state snapshot (which providers/contexts held what value), the ordered action trace (the semantic intents/transitions that produced it), the declared-rules reference (the page's conformance/visibility/validation rules in force), and ownership (who owns each node, so the bundle self-routes). Ships as a WE we:contract.ts plus conformance vectors and a JSON schema, with serialization and versioning. Foundational and agent-ready now — no dependency on the capture mechanism; it only fixes the shape the FUI viewer and plateau tool consume.

## Progress (resolved 2026-06-23, batch-2026-06-23-1689-1500)

Shipped as a new WE-owned contract slice `we:repro-bundle/`, the sibling of `we:conformance-vectors/`
(shape + structural verifier the FUI/plateau impl consumes), plus the published-package surface:

- **`we:repro-bundle/contract.ts`** — type-only (zero runtime emit): the four parts as `ReproStateSnapshot`
  / `ReproTraceEvent` (intent | transition, shared monotonic `seq`/`atMs`) / `ReproDeclaredRule`
  (`kind: conformance|visibility|validation` + `contract` + `vectorIds`) / `ReproOwnershipEntry`
  (node→owner, self-routing), and the `ReproBundle` envelope (`version` + `capturedAtMs` + the four arrays).
- **`we:repro-bundle/schema.ts`** — the build-agnostic runtime: `REPRO_BUNDLE_VERSION` (semver),
  `assertReproBundle` structural validator, `serializeReproBundle`/`deserializeReproBundle` (validate +
  major-version gate), `isCompatibleVersion`, and a draft-2020-12 `reproBundleJsonSchema` for non-TS
  readers (kept in lock-step with the validator).
- **`we:repro-bundle/repro-bundle.vectors.ts`** — the golden conformance corpus: `reproBundleGolden` (a
  canonical valid bundle exercising all four parts) + `invalidReproBundleCases` (the malformed shapes the
  validator must reject, each with its error substring).
- **`we:repro-bundle/index.ts`** barrel; **`we:contracts/repro-bundle.ts`** type-only re-export +
  `./repro-bundle` entry in `we:contracts/package.json` (the published-package surface, like
  `./reproduction-parity`); `we:vitest.config.ts` include glob added.
- **`we:repro-bundle/__tests__/repro-bundle.test.ts`** — 6 tests, all green (golden round-trips byte-stable,
  four parts present, every malformed case rejected, major-version gate, invalid-JSON rejection, JSON-schema
  parity).

Layer: WE owns the SHAPE + verifier only; the capture mechanism that produces a bundle is plateau (#1667,
landed this batch), the serializer that maps a `CaptureTrace` onto this shape is #1666, and the viewer is FUI.

**Gate note (not this changeset):** the WE gate shows two reds, both from concurrent sessions, neither
naming a `we:repro-bundle/` or `we:contracts/` file: a hidden `we:reports/2026-06-23-1704-split-analysis.md`
(another `/split` run) and a stale `we:AGENTS.md` inventory (research-topics 199→200, a concurrent
research-topic add). Stepped over per the batch stop-rule's external-red diagnosis.
