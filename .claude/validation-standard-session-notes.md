# Validation Standard Materialization — Session Notes

**Date:** 2026-05-30  
**Status:** Steps 1–7 complete. Validation standard materialized across reports, intents.json, semantics.json, blocks.json.

---

## Key Discoveries

### Meta-Intent Factoring (Foundational)
Validation's concerns are **not validation-specific**. They already exist in the repo:
- **Async lifecycle** → Loader Intent (add version token + aggregation)
- **Severity vocabulary** → Unified across Feedback/Message/Validation (one semantic axis)
- **Error handling** → Reliability Intent (mechanism-failure vs input-invalidity split)

**Pattern:** Validation **composes** shared metas rather than redefining them. Applies to any standard with optional features.

### Working Resolutions (Approved & Implemented)
- **OP-23:** Validate composes Loader's async lifecycle. Enhanced Loader with pending `{version}` token and hierarchy aggregation.
- **OP-24:** One severity/tone vocabulary across all three intents (error/caution/warning/info/success).
- **OP-25:** Two distinct error families: input-invalidity (validation owns) vs mechanism-failure (reliability owns).

### Conformance Model (OP-11, Finalized)
- **L0 — Intent-aware:** Honors UX intents. No state/event contract.
- **L1 — State & event conformant:** Observable states + stable-id events. Makes implementations **swappable**.
- **L2 — Shape & concern conformant:** Canonical shapes + DI concerns. Makes concerns **combinable** across creators.

---

## Materialization Strategy

**Big plans become unmanageable.** Better approach: extract to discrete real homes, refine in place.

**7-Step Roadmap (Executed):**
1. ✅ Assessment report (reports/2026-05-30-form-validation-standard-assessment.md)
2. ✅ Side-project brief (reports/2026-05-30-validation-spec-versioning-adherence.md)
3. ✅ Meta-intent factoring (intents.json + semantics.json)
4. ✅ Validation intent rewrite (intents.json: per-level vocab, tiers, features, research)
5. ✅ Glossary (semantics.json: 10 new terms + Input boundary)
6. ✅ Block reframing (blocks.json + validation.njk)
7. ✅ Verification (gen:inventory, check:standards, eleventy build)

---

## Open Points (Status)

### Resolved in This Session
- **OP-22:** Meta-intent factoring → completed (validation composes loader/feedback/message/reliability)
- **OP-23:** Pending/busy unification → completed (compose loader)
- **OP-24:** Messaging unification → completed (unified severity vocab)
- **OP-25:** Input-invalidity vs mechanism-failure → completed (split clarified)
- **OP-21:** Input status boundary (OP-21) → resolved (status renders Validation's DisplayDecision)

### Still Flagged (Next Agent's Focus)
- **OP-1:** Validity model (reduction vs flat flag). Drafted as reduction; awaits confirmation.
- **OP-11:** Conformance definition. Proposed 3-tier model (L0/L1/L2); awaits confirmation.
- **OP-2 through OP-20:** Implementation details (group visited rollup, cross-field error attachment, form submission UX, wizard gating, etc.). Refinable when building adapters/implementations.

---

## Rendered Pages
- `/intents/validation/` — Full vocabulary, tiers, features, decomposed concerns
- `/blocks/validation/` — Reframed as conformance reference; traits + webStandards + events
- `/semantics/` — Glossary expanded with 10 validation-specific terms

## Non-Rendered Documentation
- `reports/2026-05-30-form-validation-standard-assessment.md` — Exhaustive UX catalog, philosophy axes, research grounding (living document in repo)
- `reports/2026-05-30-validation-spec-versioning-adherence.md` — Side-project brief for spec versioning + adherence detection

---

## Next Session Considerations

1. **Adapters:** RHF, Angular, Zod/Standard Schema adapters demonstrating L1/L2 conformance (not started).
2. **Spec versioning tooling:** `check:validation-adherence` build-time check + runtime dev-mode guard (side-project, documented but not implemented).
3. **OP-1 & OP-11 confirmation:** Nail down validity model and conformance tier granularity before adapter work.
4. **Glossary reconciliation:** Input/Selection/Registry/DI terms may have overlaps; inventory collisions flagged by check:standards.

---

## Files Modified
- `src/_data/intents.json` — loader, feedback, message, validation, reliability
- `src/_data/blocks.json` — validation block
- `src/_data/semantics.json` — Input definition + 10 new terms
- `src/_includes/block-descriptions/validation.njk` — comprehensive rewrite
- `reports/2026-05-30-*.md` — two new research documents
