---
name: feedback_conventions_fold_into_compliance
description: "WE never mandates conventions (naming/casing/file-structure); it ships a default vocabulary projects customize, enforced via webcompliance"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 40662984-2774-4d46-a67a-3e13eb0e9cd5
---

WE is not in the business of *mandating* conventions, but it does need a **common language**. So a candidate "standard" that is really a customizable convention (nomenclature, file-structure, naming/casing, extensions) is NOT a standalone mandated standard — it folds into `webcompliance` (#436/#437) as a configurable ruleset: WE ships a **default vocabulary** (the common language), projects/companies **customize** it, and compliance enforces adherence to the resolved project/company/platform settings.

**Why:** mandating project-facing conventions contradicts WE's stance (native-first, minimize lock-in, "the protocol is the only lock"). Reframing as default-plus-override-plus-compliance preserves a shared vocabulary without locking anyone in.

**How to apply:** when triaging a "convention" candidate, don't drop it and don't author a mandate — home it in webcompliance as a customizable rule that extends a platform default. See [[feedback_config_extends_platform_default]] and [[feedback_minimize_lock_in_protocol_only_lock]]. Codified in the #111 triage.

**Codified:** the canonical rule is `docs/agent/platform-decisions.md#compliance-validation-home` (the statute is source-of-truth; any `#NNN` above is provenance, not the reference).
