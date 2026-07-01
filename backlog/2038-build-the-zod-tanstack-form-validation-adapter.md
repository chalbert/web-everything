---
kind: story
size: 3
parent: "1451"
status: resolved
dateOpened: "2026-07-01"
dateStarted: "2026-07-01"
dateResolved: "2026-07-01"
graduatedTo: frontierui:validation-generation/adapters/zodIngest.ts
tags: []
---

# Build the Zod / TanStack Form validation adapter

No validation-library adapter exists. Bridge Zod (and/or TanStack Form) to the Validation intent; coordinate with #306 (Zod schema emitter, the opposite direction).

## Progress

**Resolved 2026-07-01.** Shipped the **ingest** direction (the reverse of #306's emitter): read an
existing Zod schema **into** the neutral validation intents, so a WE component can carry an author's
existing library schema through the same vocabulary the emitters and Mode-2 service consume.

- **Contract (WE, definition-only):** `we:validation-generation/provider.ts` gains the
  `ValidationIngestAdapter` contract — the reverse of `CustomValidationAdapter` — plus `IngestResult`
  (recovered `declaration` + lossy-visible `unsupported[]`) and the `isValidationIngestAdapter` /
  `assertValidationIngestAdapter` guards. Pure definition; the impl lives in Frontier UI (#1282 zero-impl).
- **Impl (Frontier UI):** `frontierui:validation-generation/adapters/zodIngest.ts` — `zodIngestAdapter`
  (`key: 'zod'`), a **dependency-free structural read** of Zod v3's `_def` shape (never `import 'zod'`,
  mirroring the emitter emitting text without importing the target). Recovers required-vs-optional (the
  `ZodOptional`-wrapper inversion), base `type`, string length / `format` (email/url/uuid/date-time) /
  `pattern`, numeric `min`/`max`/`step`, `z.number().int()` → single `integer` type, array collection
  sizing, and `enum` membership. Lossy-is-visible (#085): a `.transform`/`.refine` (`ZodEffects`), an
  unknown check kind, or an unrecognized `typeName` is reported in `unsupported`, never dropped — and a
  `ZodEffects` wrapper still ingests its inner schema. Barrelled in
  `frontierui:validation-generation/adapters/ingest.ts` (`SHIPPED_VALIDATION_INGEST_ADAPTERS`).
- **Tests:** `frontierui:validation-generation/adapters/__tests__/zodIngest.test.ts` (contract + recovery
  + lossy paths), wired in via a new `validation-generation/**` vitest `include` line. 22 assertions green
  against the live provider contract.

**Scope note (TanStack Form):** the item's "and/or TanStack Form" is satisfied by the Zod bridge — TanStack
Form is schema-driven and consumes a Zod (or Standard-Schema) validator, so ingesting the Zod schema *is*
the TanStack Form path. A distinct TanStack-native field-config ingester (non-schema validators) is a
follow-up if a concrete case appears; the `ValidationIngestAdapter` contract already accommodates it
(`key: 'tanstack-form'`).

## Lineage
Surfaced 2026-07-01 in the first #1451 (Library-adapter watch) goal-completeness pass — a goal-set target-kind with no registry entry and no child. Report: [we:reports/2026-07-01-program-library-adapter-watch.md](../reports/2026-07-01-program-library-adapter-watch.md).
