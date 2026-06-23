# #563 AI-driven agile methodology — slice analysis (2026-06-23)

Triggered by `/resolve` discovery: #563's only child (#569, the artifact-*shape* decision) is resolved,
so the gate nudged "all slices done." But the epic's scope — **capture the methodology as an artifact** —
is unbuilt (Status: "no build committed"). Resolving here would be the #1167/#1210 "resolved over uncarved
scope" trap. Reconcile by carving the next slices so the epic gains open children.

## What #569 settled (and what it did NOT)

#569 (ratified 2026-06-22) fixed the **artifact shape**: the *living repo is the source of truth*; the
canonical **authored** artifact is **(B) the extracted starter-kit** (`.claude/skills/` + backlog CLIs +
`docs/agent/`, cloned like a `create-react-app`); **(A) prose** is its narrative companion (feeds #143);
**(C) talk/article** and **(D) enablement guide** are further downstream surfaces.

Crucially #569 scoped itself **"canonicity, not content-freeze"**: *which* skills/docs/examples ship in (B)
— and the real-number case study — are **fixed near release**, and remain open under #563 (the #143
"don't freeze a maturing model" caution). So the slices are *nameable now* (shape ratified) but their
**contents are release-gated**.

## Could not split (into batchable-now slices) — and why

The whole authoring effort is **maturity-gated**, not just deferred:

- **Content-freeze (#569 / #143).** What ships in the kit + the case-study numbers are fixed near release,
  with real examples — building them now freezes a moving target.
- **Churn against a live source.** (B) *is* the live repo (skills/CLIs/docs that change weekly). Extracting
  a cloneable kit early means maintaining a divergent harness/copy in lock-step with the evolving
  source — pure recurring cost until there's a release to extract *for* ([Decouple Build From Release
  Timing]: the recurring cost is the solo-dev risk).

So no slice is safely *batchable now*; this is the [Separate Canonicity From Content-Freeze] case — the
**structural/canonicity** part is already ratified (#569), and the **content** part is held. The honest
reconciliation is to carve the held authoring work as **`maturityGated` parks** (the #1625 precedent: a
parked, trigger-stamped child is a legitimate carved slice), so #563 stops reading "all slices done"
without manufacturing premature work.

## Could split (as maturityGated parks) — proposed slices

Per #569's fixed shape, two primary authored artifacts; (C)/(D) surfaces file on pickup once (A)/(B) exist.

- **S1 (story, maturityGated park)** — *Extract the AI-driven agile starter-kit (B, canonical artifact).*
  Package `.claude/skills/` + backlog CLIs + `docs/agent/` as a cloneable kit, de-project-specified, with
  the real-number case study. Trigger: approaching first public release (aligned with #143) + the practice
  judged settled. The canonical authored deliverable.
- **S2 (story, maturityGated park, `blockedBy: S1`)** — *Author the narrative companion playbook/essay (A).*
  Renders the kit's runnable substance as prose; feeds the #143 public approach page. Depends on the kit
  (B) existing; same release trigger.

**DAG:** S1 → S2 (A renders B). Both parked on the same release/maturity trigger; neither mutates code now
(valid state). (C) talk/article and (D) enablement guide are further surfaces, filed on pickup once S1/S2
land.

## Related (not carved here)

- **#673** (under #666 §C) already authors the developer-role thesis as a positioning *section into* #563 —
  a content contribution to (A), tracked separately; not duplicated here.
- **#143** — the public approach page is the downstream surface (A) feeds; stays parked per its own caution.

## After this wave

#563 holds two open (parked) children → no longer "all slices done." It resolves when the kit + companion
land near release.
