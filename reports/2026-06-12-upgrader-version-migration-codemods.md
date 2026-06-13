# Upgrader version-migration codemods — prior-art survey & fork prep

**Date**: 2026-06-12
**Point**: #191's two named prerequisites both already shipped — the migration **descriptor format** is the resolved `changelog-manifest` protocol (#102) and the **verify gate + provider registry** is #094's `upgraderEngine`. So the decision reshapes from "build the descriptor + engine" into **two design forks**: (1) the version-migration upgrader is a *mode/input-adapter* of the existing engine, not a distinct tool; (2) migration transforms are **declarative-first with an imperative escape hatch** (the OpenRewrite principle), the descriptor referencing a codemod only when the change is too complex to declare. Both are grounded in Angular `ng update`/`migrations.json` (the version-gated runner) and OpenRewrite (the declarative/imperative recipe split).
**Research page**: `/research/version-migration-codemods/`
**Decision item**: `/backlog/191-upgrader-version-migration-codemods/`

---

## Question

#094's upgrader MVP built the "legacy → standard" upgrade kind. #191 is the **second kind** — "across
standard/dependency versions": apply breaking-change codemods when a protocol/adapter/provider contract
evolves, so "upgrade to the new version" doesn't mean hand-editing every call site. #191's body said this
was blocked on a machine-readable change/migration descriptor format (#005/#266) and could not be split
until that landed. This survey re-grounds the item now that the blockers are resolved, and asks how the
version-migration mode consumes the descriptor and applies transforms.

## Recommendation (forks in #191)

- **Fork 1 — mode, not a separate tool.** The version-migration upgrader is an **input adapter + mode of
  #094's `upgraderEngine`** (same `analyze → transform → verifyUpgrade` arc, same `CustomAnalyzerRegistry`
  provider seam), differing only in input: an *already-conformant* source + a `changelog-manifest` delta,
  rather than legacy code. Matches #094's own open follow-on ("shared core, different input adapter") and
  #190's input-adapter breadth. Rejected: a parallel tool (drift + a second verify gate). *Confidence:
  Medium-high.*
- **Fork 2 — declarative-first, imperative escape hatch.** A migration entry in the `changelog-manifest`
  describes the transform **declaratively** for mechanical changes (renamed attribute, moved intent
  dimension, retired provider id — the engine interprets the descriptor), and **references an imperative
  codemod** only when the change is too complex to declare. This is OpenRewrite's ruling principle ("if it
  can be declarative, make it declarative; imperative only when necessary"), and it's the most-permissive
  default (the descriptor's migration-script reference is optional). Rejected: imperative-only (forces a
  codemod module for every trivial rename) and declarative-only (can't express complex transforms).
  *Confidence: Medium.*
- **Ratify (not forks):** the descriptor *format* is the resolved `changelog-manifest` protocol (#102) —
  consume it, don't design a new one; the *safety gate* is #094's `verifyUpgrade` — a migrated call site
  is only offered if it still parses + round-trips + conforms.

## Key findings

1. **Both prerequisites #191 named already shipped.** (a) The "machine-readable change/migration
   descriptor per release" is the **`changelog-manifest` protocol** ([protocols.json:86](../src/_data/protocols.json#L86),
   #102, resolved): per-module entries keyed to semver severity + Keep-a-Changelog type, **plus a
   migration linkage** — a breaking entry references the codemod that applies it, with author +
   integrity-hash trust metadata. It is explicitly "consumed by upgraders (#094)." (b) The transform
   engine + provider registry + verify gate is **#094's `upgraderEngine`** (`verifyUpgrade`
   [upgraderEngine.ts:142](../blocks/renderers/upgrader/upgraderEngine.ts#L142), `upgrade()` orchestrator
   :216, `CustomAnalyzerRegistry` :72). #266 added the semver/availability axis (`compareSpecVersions`
   [capability-manifest/provider.ts:182](../capability-manifest/provider.ts#L182), `featureAvailableIn`
   :193, `FEATURE_SINCE` :94). So #191 is **wiring + two design calls**, not greenfield construction.
2. **Angular `ng update` is the canonical version-gated migration runner.** A library ships a
   `migrations.json` (registered under `package.json` `ng-update.migrations`); each entry is `{version,
   factory, description}` where `factory` points to a transform returning a `Rule`. `ng update` runs every
   migration whose `version` falls in `>installedVersion, <=targetVersion`, **in order, across intermediate
   versions**. This is exactly the shape #191 needs: `changelog-manifest` = `migrations.json` (per-release,
   per-module, migration reference); the version-gated, ordered, intermediate-spanning *run* is the mode's
   core loop. The semver-range gating maps onto #266's `compareSpecVersions`.
3. **OpenRewrite settles the declarative-vs-imperative axis.** It offers three recipe types — declarative
   (YAML, compose existing recipes + light config), refaster (templates), imperative (extend `Recipe`,
   full AST control) — under the explicit principle: **"if it can be declarative, make it declarative; use
   imperative only when necessary."** That is Fork 2's recommended default verbatim: declarative descriptor
   for mechanical changes, imperative codemod reference only for the complex tail.
4. **The verify gate is WE's differentiator over the incumbents.** Angular schematics and jscodeshift
   apply transforms but **don't verify** the result conforms — they trust the codemod. #094's `verifyUpgrade`
   (re-parse + round-trip fidelity + intent conformance) is the same moat #094 already built for the
   legacy→standard kind, reused here: a migrated call site is *offered* only if it still parses and
   conforms. This is the "propose-and-verify" moat #089 names, applied to version migration.
5. **The item splits cleanly once ratified.** With both forks decided, #191 (size 8) splits into agent-ready
   builds: (a) the `changelog-manifest` consumption + version-gated migration planner (range select +
   order), (b) the declarative transform interpreter + imperative-codemod escape hatch, (c) the
   version-migration input adapter/mode on `upgraderEngine` with `verifyUpgrade` wiring. These graduate via
   a `blockedBy` chain in that order.

## Files created/modified

| File | Action |
|---|---|
| `reports/2026-06-12-upgrader-version-migration-codemods.md` | created (this report) |
| `src/_data/researchTopics.json` | added `version-migration-codemods` entry |
| `src/_includes/research-descriptions/version-migration-codemods.njk` | created (write-up) |
| `backlog/191-upgrader-version-migration-codemods.md` | rewritten to prepared-fork shape; `preparedDate` set |
