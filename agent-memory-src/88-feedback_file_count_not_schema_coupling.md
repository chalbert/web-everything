---
name: feedback_file_count_not_schema_coupling
description: "separation is about schema/ownership, not file count; one keyed config file ≠ a god-schema;"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5795e7fe-286a-4b2b-8c78-7329c31804f9
---

On a combine-vs-split config/artifact decision, **file-count ≠ schema-coupling** — don't conflate "how
many files the author edits" with "how many schemas/owners are coupled."

**Why:** the real `bias-toward-separation` hazard is coupling unrelated concerns' **schema, ownership, and
release cadence** into one artifact — not the mere fact of sharing a file. A single file with one key per
concern (the `package.json` precedent: `dependencies`/`scripts`/`eslintConfig`/`browserslist`) keeps each
key its own independently-owned/versioned schema. So one shared *file* can give single-glance ergonomics
**without** the god-schema coupling that separation actually forbids. The broken branch is one *merged
schema*, not one file.

**How to apply:** split the decision into two axes — (1) **SoT/ownership** (per-concern, decoupled — the
invariant) and (2) **author surface** (file count — a DX default). Default the surface to *one keyed file,
any key extractable to its own file* (`most-flexible-default`: inline = low-friction default, split = opt-in).
Ground the separation in the type system where possible (e.g. a per-dimension `extends` chain typed to that
dimension's registries makes cross-concern merge a compile error — separation as a compiler invariant, not a
convention). Watch the prior-art trap: ESLint flat config / Vite plugin arrays are still **one file** with
composable entries — they argue *for* a keyed single surface, not against it; only separate-*tool* configs
(Browserslist/EditorConfig) are genuinely multi-file.

Surfaced settling [[feedback_config_extends_platform_default]] for #1662. Related:
[[feedback_bias_separation_decoupling]], [[feedback_dimension_vs_fixed_mechanic]], [[feedback_most_flexible_default]].

**Codified:** the canonical rule is `docs/agent/platform-decisions.md#config-extends-platform-default` (the statute is source-of-truth; the `#NNN` above is provenance, not the reference).
