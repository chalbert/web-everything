# Backlog split analysis — 2026-06-17

Focused run: `/split 880`.

## Candidate

**#880 — Gate: code-path references in backlog & reports must indicate their repo locus**
(`workItem: story`, `size: 13`, `status: open`). Oversized story in the should-split band, already
self-described in its body as "three things in one (convention · gate-build · migration)".

## Work-investigation pass (real tree)

| Surface | Where | Note |
|---|---|---|
| Convention doc | `docs/agent/conventions.md` (6 KB, "Naming Conventions" §) | exists; slice A appends a clause here |
| Authoring note | `docs/agent/backlog-workflow.md` | new-item authoring guidance lives here |
| Gate machinery | `scripts/check-standards.mjs` (843 lines) | already raw-scans `backlog/*.md` (`:443`) **and** `reports/*.md` (`:591`); slice B adds a check block into these existing loops |
| Migration surface | `backlog/*.md` (867) + `reports/*.md` (150) = **1017 files**, only **5** already carry a `we:`/`fui:`/`plateau:` prefix | slice C's bulk rewrite |

Seams confirmed against real code — each slice's named files are citable, not guessed.

## Could split — #880 → 3 slices

| Slice | workItem / size | Scope | Home |
|---|---|---|---|
| **A — convention clause** | story · **2** | Add the `<repo>:` locus rule (alias table, in-repo `[we:path](path)` link form, cross-repo plain-text form) to `conventions.md`; add the authoring note to `backlog-workflow.md` so new items comply from creation. Ratifies the two bold-defaulted knobs (alias-vs-full → allow both, default alias; rollout → one-pass). | own story |
| **B — detection gate (warn-level)** | story · **5** | New `check:standards` check in the existing `backlog/`+`reports/` scan loops: regex for path-like tokens, with carve-outs (fenced code blocks, `@scope/pkg` specifiers, URLs, `relatedReport`/`graduatedTo`/`crossRef` frontmatter). Emits **warnings** only — build stays green on the un-migrated corpus. | own story |
| **C — migration + hard gate** | story · **5** | One-time regex+locus-inference rewrite of all 1017 files (path-in-WE-tree → `we:`, else resolve vs FUI/plateau; log cross-repo-ambiguous paths for manual pass); flip slice B's check **warn → error**; finishes #841. | own story |

**Slice DAG (incremental delivery, each ships valid):**

```
A (convention) ──▶ B (detect, warn) ──▶ C (migrate + flip to error)
```

- `B blockedBy A` — the gate enforces the form the convention defines.
- `C blockedBy B` — migration targets exactly what the gate flags, then hardens it to error.
- Not a "nothing usable until the last" chain: **A** ships a usable documented rule (authors comply by hand);
  **B** adds detection (warnings, green build); **C** completes the corpus + hard enforcement. Each is a valid,
  demoable state.

**Batchable:** A is immediately batchable (Tier-A on creation). B becomes batchable once A resolves; C once B
resolves. Run `/split 880` → approve → `/batch` to chain A then B then C.

## Rubric check (all five hold)

1. **Volume, not uncertainty** ✓ — the 13 pts are three real bodies of work, not a buried fork. The two open
   knobs are **bold-defaulted ratify-at-build micro-choices** (not a `type:decision` smell), settled inside
   slice A — no fork is scattered across children.
2. **≥2 nameable slices, real home** ✓ — three, each its own story.
3. **Slices land small** ✓ — 2 / 5 / 5, none an 8-lump; each `file:line`-grounded.
4. **Clean DAG** ✓ — acyclic; genuine incremental delivery (each slice ships a valid standalone state).
5. **No coherence loss** ✓ — the one hazard (a hard gate on an un-migrated corpus turning `check:standards`
   RED for everyone) is designed out by landing B warn-only and flipping to error inside C.

## Could not split

_None._ #880 is fully splittable.
