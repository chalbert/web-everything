---
type: decision
workItem: story
size: 3
status: open
blockedBy: []
dateOpened: "2026-06-16"
dateStarted: "2026-06-17"
preparedDate: "2026-06-16"
relatedReport: reports/2026-06-16-817-guard-merge-resolution-placement.md
tags: [constellation, plugs, port, frontierui, standard-impl-boundary]
---

# Constellation placement of guard / validity-merge / validator-resolution subsystems under the FUI plug port

The #725 plug port (`webguards`/`webvalidation` → FUI) has a five-subsystem import closure; #730 placed two
(`capability-manifest/`, `validation-generation/`, exported by #814). The remaining three — `guard/`
(#288/#289), `validity-merge/` (#212), `validator-resolution/` (#214) — are imported by the plugs yet
**unplaced**: #730's scope excluded them and #814 exported no `@webeverything` surface for them. **No design
exists yet for their placement**; the single fork below is grounded in a per-plane file-level verification
published as the prep report ([reports/2026-06-16-817-…-placement.md](../reports/2026-06-16-817-guard-merge-resolution-placement.md),
linked via `relatedReport`) — a placement-of-shipped-code call, so it classifies the real import closure
against #730's ratified axis rather than surveying web prior art. It carries a recommended default in **bold**.

The grounding **reshaped the fork**. The item was first drafted with a B1-*split* default (provider/registry
→ WE, "concrete strategy/runtime impl" → FUI). Verification flipped it: all three planes are
**capability-manifest-shaped, not validation-generation-shaped**, so the precedent-correct ruling is **A1 —
whole plane → WE, no split.** The axis is one test from #730 (*code that **defines** a contract → WE; code
that **implements/generates against** it → FUI*) applied to every file, pinned to the real tree:

- `guard/provider.ts:68-121` (the `CustomGuardProvider` contract + `assertGuardDecision` + the permissive
  `NativeGuardProvider` default), `guard/registry.ts:39-96` (swap point), `guard/accessControl.ts:115-132`
  (the #178 member intent, built *on* the seam) — imported by `plugs/webguards/index.ts:23-31`.
- `validity-merge/provider.ts:53-206` (`MergedValidity` surface + `assertMergedValidity` + the two
  native-default strategies), `validity-merge/registry.ts:34-120` (registry + `ValiditySourceOrchestrator`
  reference runtime) — imported by `plugs/webvalidation/index.ts:17-57`.
- `validator-resolution/provider.ts:52-161` (`ResolvedSource` cross-plane contract + `assertResolvedSource`
  + versioning/cancellation defaults), `validator-resolution/registry.ts:35-136` (registry +
  `AsyncValidationRunner` reference runtime) — imported by `plugs/webvalidation/index.ts:19-40`.

Decisive fact: **none of the three carries a `validation-generation`-style separable emitter** (the
per-language `adapters/*` that earned that subsystem its B1 split). What a split would push to FUI is the
**native-first default strategies** (interwoven with the contract inside each `provider.ts`) and the
**dependency-free reference runtimes** (`ValiditySourceOrchestrator` / `AsyncValidationRunner` — no
fs/net/host) — the structural twins of capability-manifest's `guard.ts`/`check.ts`, which #730 kept in WE as
"part of the spec, not the plug runtime." The impl that *does* port is the **plug** itself (already #725's job).

## Recommended path at a glance

| Fork | Recommended default | Main alternative (rejected) | Confidence |
|---|---|---|---|
| 1 — placement of all three planes | **A1 — each plane whole → WE; one `@webeverything/*` *barrel* export per plane; #725 ports none of them** | B1 — split each: contract → WE, native-default strategies + reference runtime → FUI | **Med-high** |

One fork, not three: the per-plane verification shows the three are structurally uniform (contract +
native-first defaults + dependency-free reference runtime, no separable emitter), so they rule together. The
table is the at-a-glance ratify; the `## Fork 1` section carries the options and the red-team to answer.

## Fork 1 — Do the three cohesive spec planes stay whole in WE (A1) or split (B1)?

**Crux.** Each plane is one dependency-free contract model (`provider.ts` self-describes as "a standalone,
dependency-free model of the contract", e.g. `validity-merge/provider.ts:1-19`). The question is whether the
native-first default strategies + the reference runtime ride *with* the contract in WE (A1), or cleave off to
FUI as impl (B1). #730 already answered the same question for the same shape: it ruled `capability-manifest`
**A1**, and grounded that ruling by pointing at *these two planes* (#212/#214) as the precedent it is
"structured exactly like."

- **A1 — whole plane → WE (recommended default).** `guard/`, `validity-merge/`, `validator-resolution/` each
  stay entirely in WE and gain **one `@webeverything/*` export — a single `.` barrel** (`"." : "./index.ts"`,
  like `capability-manifest/package.json`), *not* validation-generation's curated-subpath exclusion list,
  because nothing is excluded. #725 imports the three contracts and copies none of the three; only the plugs
  port.
  *Why it wins:* it is the only reading consistent with the #730 capability-manifest A1 ruling these planes
  anchor; with native-first (the shipped default *is* the standard, so the native-default strategy is a WE
  artifact); and with #730's own refusal to fork a cohesive plane mid-file (the `cel.ts` precedent). The
  contract half is the **bulk, not vestigial** — verified per file in the prep report.

- **B1 — split each plane (rejected).** Keep the contract interface + assert-guard in WE; port the
  native-default strategy classes + `ValiditySourceOrchestrator`/`AsyncValidationRunner` to FUI as impl.
  *Rejected:* there is no concrete third-party emitter here to cleave (the thing that legitimised
  validation-generation's split); the "impl" half is the native-first default + a dependency-free reference
  runtime, both WE-owned by the capability-manifest precedent; and the cut would fork each `provider.ts`
  mid-file (contract types and the default strategy class are interleaved) — the exact cost #730 declined for
  `cel.ts`. B1 re-introduces the precedent-break #730 explicitly warned against.

- **A2 — whole plane → FUI (rejected).** Treat each provider+registry as swappable runtime and port it
  wholesale. *Rejected:* leaks a strategy-plane *contract* into `@frontierui`, the exact drift #649/#170 exist
  to kill (npm-scope-mirrors-layer: `@webeverything` is standard-only).

**Red-team to answer at ratify (flagged for the skeptic pass).** The one defensible attack on A1 is
*impl-is-not-a-standard*: a decider could argue the native-default strategy classes (the merge math, the
versioning/cancellation logic) are "impls that satisfy the standard" and belong in FUI, leaving WE only the
interface + guard. Rebuttal, grounded above: (a) #730 already ruled the analogous capability-manifest
reference tooling stays WE; (b) native-first makes the shipped default part of the standard, not a swappable
impl; (c) the cut forks `provider.ts` mid-file for no separable artifact. If the decider finds that rebuttal
wanting for one specific class, the fallback is a *targeted* carve of that class only — not a wholesale B1.

**At graduation:** the ruling produces one small #814-style export follow-up (three `package.json` + `exports`
barrels), after which #725 resumes. No Technical Configurator card falls out — this is an internal placement
call, not a documented technical setting a project picks.

## Unblocks

#725 (`blockedBy: 817`). Once ruled, the export-surface delta (three `@webeverything/*` barrels) is a small
#814-style follow-up; #725 then resumes, importing the three WE-resident contracts and copying only the
genuinely-impl plug halves — the same shape it already has for capability-manifest/validation-generation.

## Context

### Evidence (verified 2026-06-16, batch-2026-06-16; re-verified at prep 2026-06-16)

Import closure traced from the plug sources, not the (stale, two-subsystem) #635 audit:
- `plugs/webguards/index.ts:23-31` → `../../guard/{provider,registry}`
- `plugs/webvalidation/index.ts` → `validity-merge/{provider,registry}` (`:17,:18,:19,:24,:25,:52,:57`),
  `validator-resolution/{provider,registry,index}` (`:19,:20,:23,:24,:34,:40`)
- #814 export surface (`capability-manifest/package.json`, `validation-generation/package.json`) covers only
  those two subsystems; `guard/`, `validity-merge/`, `validator-resolution/` have no `package.json` / exports
  map and no FUI tsconfig/vite alias.

Per-plane file → role → layer tables are in the prep report. Net: 10 files across the three planes, **all → WE**.

### Why one fork, not three (fork-existence test)

The original draft carried three forks (one per plane) because each *might* differ. Verification shows they
do not: identical shape, identical ruling (A1), no plane has the separable emitter that would force a
per-plane divergence. Per *support-all-coherent / crisp-beats-complete-but-undifferentiated*, they collapse to
one fork applied uniformly (cf. #088: five "forks" → one invariant). A2 is broken (contract leak); B1 is
coherent-but-precedent-breaking, so it stays a named-and-rejected alternative rather than a separate fork.
