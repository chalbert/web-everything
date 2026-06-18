# Self-Driven Project Artefact Contract — first-cut spec

**Date**: 2026-06-15
**Point**: Register the binding everything-as-code Protocol for backlog [#672](/backlog/672-self-driven-project-tool-agnostic-artefact-contract-everythi/) and specify its Layer-1 surface — the discoverable file/metadata structure + the four composable meta-schemas (each with a default flavor) + one fully-defined default recipe. Owner node minted as **Web Process** (`webprocess`) per [#690](/backlog/690-is-the-self-driven-project-methodology-a-first-class-constel/), under epic [#666](/backlog/666-self-driven-project/), framing from [#665](/backlog/665-self-driven-project-ratify-the-framing-autonomy-taxonomy-mas/).
**Owning project**: [/projects/webprocess/](/projects/webprocess/) · **Protocol anchor**: [/projects/webprocess/#protocol-self-driven-project](/projects/webprocess/#protocol-self-driven-project)

---

## Thesis

A project's **self-driven SDLC** — how much an agent may do unattended at each step, under what tolerance,
behind which gates, leaving what evidence — should be **everything-as-code**: a discoverable set of
version-controlled, declarative files a *foreign* PM/CI tool could read and drive, not a process baked into
one vendor's runner. The contract standardizes the **shape**, not a fixed process (the Web Intents lesson):
composable meta-schemas, each with a default flavor, bound by **one default recipe** a project extends.

The contract is a **capstone made *of* WE standards**. The genuinely-new surface is three things — an
autonomy **vocabulary**, the value/risk-**ODD dial**, and this **binding contract** — and everything else is
*composition* (gates → webcompliance/webpolicy, steps → webworkflows, evidence → webaudit/webreporting,
human handoff → webdecisions, requirements → [#100](/backlog/100-requirement-as-code/)). The one new lock is
the binding contract, and it is **escapable**: the same files drive a third-party tool. Everything beneath it
is already-open WE standard.

> **Already dogfooded.** The WE backlog (`backlog/*.md` frontmatter — discoverable, metadata-bearing, driving
> our lifecycle) is *already* an instance of Layer 1 + a Layer-2 recipe. This spec **generalizes what we
> already run**; our usage stays a consumer, never the spec.

## Layer 1 — the discoverable file/metadata structure (the standard)

A self-driven project is a directory of declarative artefacts with stable, discoverable locations and
metadata. First-cut layout (a default flavor; a recipe may relocate via a manifest):

```
project/
  process.config.json        # the recipe: which flavors, the autonomy ceilings, the tolerance dials
  requirements/*.req.md       # requirement artefacts (conform to #100 requirement-as-code; referenced, not redefined)
  steps/*.step.json           # the SDLC step graph (composes webworkflows orchestration)
  gates/*.gate.json           # gate definitions (composes webcompliance + webpolicy)
  runs/<run-id>/evidence.json # append-only run evidence (composes webaudit AuditEvent + webreporting report model)
  runs/<run-id>/decisions/*   # human-handoff records (composes webdecisions DecisionRecord)
```

The contract fixes that these artefacts are **discoverable** (well-known locations / a manifest) and
**metadata-bearing** (each carries enough front-matter to be selected, ordered, and audited), and that they
**reference** the composed WE standards rather than re-defining them. Requirement structure stays **light** —
discoverable + metadata, most-flexible-default — connecting to #100.

## The four composable meta-schemas (each ships a default flavor)

### 1. Autonomy-level registry — NEW (a vocabulary)

How much an agent may do unattended, per step. Default flavor — an SAE-style ladder:

| Level | Name | Unattended action |
|---|---|---|
| `L0` | report-only | observe + report; never mutate |
| `L1` | propose | draft a change for human review; never apply |
| `L2` | live-verify | apply in a sandbox and verify; never land |
| `L3` | open-PR | land on a branch + open a PR for human merge |
| `L4` | auto-merge | merge once gates pass, no human in the loop |
| `L5` | live-patch | patch a running system within the tolerance envelope |

It is an **open registry** (a project adds levels); the ladder is the default flavor, not a closed list.

### 2. Value/risk-ODD dimension registry — NEW (the organizing model)

The **tolerance dial**: quality/risk dimensions whose per-step tolerance **throttles the autonomy ceiling**
(the operational-design-domain idea borrowed from autonomous driving — autonomy is permitted only inside the
domain the tolerance defines). Default flavor:

| Dimension | Question | Scale |
|---|---|---|
| `correctness` | how sure must the change be right? | low / medium / high |
| `security` | does it touch a security boundary? | low / medium / high |
| `blast-radius` | how much breaks if it's wrong? | low / medium / high |
| `reversibility` | how cheaply can it be undone? | low / medium / high |

The recipe maps a tolerance profile → an autonomy ceiling per step (e.g. `security: high` caps a ship step at
`L1` regardless of the step's nominal ceiling). Dimensions overlap webcompliance's "which criteria" but the
*dial* (tolerance → ceiling) is the new, unowned model (#665's novel flag).

### 3. Gate-definition schema — composed (webcompliance + webpolicy)

A machine-checkable gate. Default flavor composes the existing enforcement gate + DMN rule meta-schema:

```json
{ "id": "tests-green", "command": "npm test", "severity": "error",
  "scope": "code", "waiver": { "until": "2026-07-01", "reason": "…" } }
```

`severity` / scope / expiring waivers / audit are webcompliance + webpolicy concerns the schema *references*,
not re-invents.

### 4. Step schema — composed (webworkflows)

The directed progression `design → code → test → ship → monitor → upgrade`, with guards + completion. Default
flavor composes the **webworkflows** orchestration graph (the SDLC is another instance of the same
machinery, possibly with an extension; altitude note from #690):

```json
{ "id": "ship", "after": ["test"], "gates": ["tests-green", "a11y"],
  "autonomyCeiling": "L3", "final": false }
```

## The one default recipe (config-extends-platform-default)

The node ships **one fully-defined default recipe** so a project's recipe is a *flavor on top*, never authored
from nothing: every autonomy ceiling, tolerance dial, and gate selection is named. `we:process.config.json`
**extends** it:

```json
{ "extends": "webprocess/default",
  "ceilings": { "ship": "L3", "upgrade": "L1" },
  "tolerance": { "security": "high" },
  "gates": { "ship": ["tests-green", "a11y", "security-scan"] } }
```

**WE's own dev-lifecycle config is exactly such a flavor** — a dogfooded consumer, never part of the standard.
Layer 2 (recipes) is authored in **Plateau** (the Technical-Configurator pattern: pick a recipe, tweak,
emit the everything-as-code config); the *format* is the standard, the *authoring surface* is not.

## Prior art (the work-tracker white space)

- **GitOps** — declarative, version-controlled desired-state a controller reconciles. The artefact contract
  is GitOps for the *methodology*: the files are the source of truth a driver reconciles, not a UI's state.
- **OSCAL** (NIST) — machine-readable control/assessment catalogs. Closest analogue for the gate + evidence
  half: structured, tool-agnostic compliance-as-code. The contract reuses the *posture*, composing
  webcompliance/webpolicy/webaudit rather than adopting OSCAL's schema wholesale.
- **SPDX / CycloneDX** — portable, tool-agnostic SBOM manifests; the model for "a declaration many tools
  read." The contract aims for the same escapability for SDLC methodology.
- **Work-tracker white space** — Jira/Linear/Azure DevOps encode methodology as *product config behind an
  API*, not portable files; CI YAML encodes *steps* but not autonomy/tolerance/requirements as one binding
  declaration. The everything-as-code, no-lock-in **binding** of autonomy + ODD + gates + evidence + steps is
  the unfilled space this contract claims.

## Scope + status

- **Domain-general schema** (no hard-coded "web"), web apps as the first consumer — later generalization is
  free (#672 scope).
- **Concept** Protocol registered in `we:protocols.json` (`self-driven-project-artefact-contract`, owned by
  `webprocess`). Non-blocking consumers only (control plane, dev-browser) — never gates the running app.
- **Separately-prioritized builds** on top of this contract: the full meta-schema registries, the default
  recipe as shipped config, and the Plateau recipe configurator (Layer 2).
