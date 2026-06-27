---
name: project_split_parent_unconverted_double_count
description: a /split that scaffolds slices but skips the parent story→epic conversion leaves a silent burndown double-count the gate misses
metadata: 
  node_type: memory
  type: project
  originSessionId: 82c92687-5a72-4e5f-ba59-10989f15defd
---

A `/split` execution that scaffolds + works the child slices but **skips step 1 (convert the parent
`story` → storied `epic`, drop its `size`)** leaves the parent as a `kind: story` that still carries
`size: N` *and* now has sized children — so the burndown counts that scope **twice** (N on the parent
plus N across the children).

**Why:** `check:standards` only errors on the sized-epic-with-sized-child case; it does **not** fire on a
`story` with sized children, so the double-count slips the gate silently and the parent keeps showing as
an oversized split-candidate. Found 2026-06-22: #1460 and #1485 had all their slices (#1532–#1535,
#1510–#1514) landed/resolved yet still read `kind: story, size: 13`.

**How to apply:** when sweeping `/split` candidates, before proposing a fresh split **check whether the
oversized story already has children** (`grep -l 'parent: "NNN"'`). If it does, it's already sliced — the
only action is to **finish the conversion** (story→epic + drop `size`), not re-slice. At close, treat an
oversized story with children as uncaptured state. Related: [[feedback_must_coland_size_can_be_double_count]],
[[feedback_misflagged_batchable_fix_real_state]].
