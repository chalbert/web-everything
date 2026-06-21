---
kind: decision
size: 3
status: resolved
blockedBy: []
dateOpened: "2026-06-20"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#open-numbered-variants"
preparedDate: "2026-06-20"
tags: [webintents, action-intent, tone, destructive, level-overload, native-first]
relatedProject: webintents
relatedReport: reports/2026-06-20-action-tone-semantic-axis.md
---

# Revisit whether destructive belongs on level (prominence) or is a separate role

Carved out of #1324 (the disposition axis), itself the sibling of #1318 (the `variant` axis). Action
Intent (we:src/_data/intents/action.json:10-18) declares `level: primary | secondary | tertiary |
destructive` as *"the semantic weight determining visual prominence,"* but `destructive`
(we:src/_data/intents/action.json:16) is **not** a prominence value — `primary/secondary/tertiary` are an
*ordinal* loudness scale, while `destructive` is a *nominal* consequence semantic (danger / harm /
irreversibility). This decides whether `destructive` is relocated off `level` into its own axis. **No
design exists yet for that axis** — the forks below are grounded in a prior-art survey published as the
`/research/action-tone-semantic-axis/` topic (session report
we:reports/2026-06-20-action-tone-semantic-axis.md); each carries a recommended default in **bold**.
Exploratory / low-priority — the ruling is the end-state; the build (and migration of the shipped value)
is separately prioritized.

## Ruling (ratified 2026-06-21)

**Fork 1 → A (relocate).** `destructive` is removed from `level`; `level` becomes a clean ordinal scale
`primary | secondary | tertiary`. Danger moves to a new `tone` axis. Keep-on-`level` is structurally
broken — a single-select ordinal cannot express prominent-dangerous vs subtle-dangerous at once, and no
benchmark models danger as a prominence tier. *(~90%, forced; the residual is migration cost, which is
prioritization, not merit.)*

**Fork 2 → A, scoped to a `neutral | danger` action core (the option-(b) variant raised in discussion).**
The new slot is an **open-numbered `tone` dimension** on Action Intent (per the #1318
`open-numbered-variants` contract), but WE blesses **only `neutral | danger`** as the recommended core on
*action* — it does **not** bless `success | warning | info` here. Rationale surfaced in the red-team:
`success/warning/info` are weakly motivated on *actions* specifically (a green "Confirm" is unusual);
`danger` is the one consequence tone that clearly applies to a button. Authors may still mint
`success`/etc. via the open-numbered contract, but they are not standardized on action. **Whether a
shared cross-intent `tone` vocabulary should exist** (one tone axis consumed by badges / alerts / banners
*and* action, rather than per-intent tone) is a genuine placement question deliberately **not** decided
here — filed as a follow-up decision. *(~75%. Residual: that shared-axis call may later re-home this
dimension; if it does, action keeps consuming `neutral | danger` regardless, so the relocation stands.)*

**Fork 3 → `tone`.** `intent` excluded (collides with WE's first-class Intent concept); `status`
(connotes runtime state) and `severity` (connotes alert levels) are runner-ups. *(~60%, low/naming.)*

**Settled without a fork:** `primary | secondary | tertiary` stay an ordinal `level`; confirmation
behavior stays native (`type`/`value`/invoker `command`); the shipped `level=destructive` value migrates
via a deprecated alias → `tone=danger`, a separately-prioritized build.

**Follow-ups filed at resolution:** (1) build — remove `destructive` from `level` + add the open-numbered
`tone` dimension (core `neutral | danger`) to Action Intent, with the deprecated-alias migration; (2)
sweep block descriptions / themes off `level=destructive` onto `tone=danger`; (3) decision — should a
**shared cross-intent `tone` axis** exist (action / badge / alert / banner consume one tone vocabulary)
vs per-intent tone?

## Recommended path at a glance

| # | Decision | Recommended default | Main alternative | Confidence |
|---|----------|---------------------|------------------|------------|
| 1 | Relocate `destructive` off `level`? | **Yes — `destructive` is nominal danger, not ordinal prominence** (keep-on-level is broken) | No — leave `destructive` as a `level` member | ~90% (forced ratify) |
| 2 | A full semantic-tone axis, or a `danger`-only flag? | **A — a full open-numbered `tone` axis** (`neutral \| danger` core + `success \| warning \| info` recommended extended) | B — a narrow `danger`-only flag | ~70% |
| 3 | What is the axis named? | **`tone`** | `status` / `severity` (not `intent` — collides with WE's Intent concept) | ~60% (Low — naming judgment) |

**Settled without a fork** (see *Supported by default* + *Context*): `primary | secondary | tertiary` stay
a clean ordinal `level`; the **confirmation behavior** a danger action may trigger stays **native**
(`type`/`value`/invoker `command`, already in via `requiresCapabilities: ["invokers"]`); **migration** of
the shipped `level=destructive` value (deprecated alias → `tone=danger`) is a separately-prioritized
build, not a merit fork.

## Axis-framing

The concern is the **third application** of one move WE has already made twice on this intent: name an
orthogonal UX axis as a new dimension rather than overloading `level`. Pinned to the real tree:

- **Prominence** — `level: primary | secondary | tertiary | destructive`
  (we:src/_data/intents/action.json:10-18). An *ordinal* scale (how loud). `destructive`
  (we:src/_data/intents/action.json:16) is the one member that breaks the scale — it is not a loudness.
- **Emphasis** — `variant: fill | outline | ghost | link` (we:src/_data/intents/action.json:19-27).
  Added by #1318 as an orthogonal *presentation* axis (the precedent move).
- **Disposition** — `affirmative | dismissive | neutral` (we:src/_data/intents/action.json:28-35). Added
  by #1324 as an orthogonal *affirmative/dismissive* axis. Danger is orthogonal to this too — a
  destructive action is usually the *affirmative* one (Delete confirms the deletion).
- **Tone (proposed)** — the *nominal* danger/success/warning/info semantic. No native vocabulary exists
  (`<button>` has no `tone`/`severity`; `aria-invalid` is validation, not action-tone), so it is a pure
  design-system convention — borrow the convergent benchmark vocabulary, standardize the meta-axis + a
  recommended core (open-numbered per #1318).

The structural break: `level` is **single-select**, so seating `destructive` there makes prominence and
danger **mutually exclusive** — *"a prominent red Delete"* (`primary` + danger) and *"a quiet red Delete
link"* (`tertiary` + danger) are both inexpressible. That is exactly the orthogonality break #1318 found
for `variant` and #1324 found for `disposition`. Tone is structural/presentational (an authored per-action
property like `level`), so it resolves `explicit (per-element) ⊕ ambient project default ⊕ default`, with a
most-permissive **unspecified → neutral** default.

## Fork 1 — Relocate `destructive` off `level`?

**Why it's a fork:** the branches genuinely cannot coexist — `destructive` is either a `level` member or it
is not — and the alternative (keep it on `level`) is *broken*, so this resolves to a forced **ratify**. The
break: `level` is a single-select ordinal enum, so it **cannot express prominent-dangerous vs
subtle-dangerous** at once (you must drop either the prominence or the danger). And no benchmark models
danger as a prominence tier — every surveyed system (Bootstrap contextual, Material `error` role, Blueprint
`intent`, Chakra `colorScheme`, Ant `status`, Fluent severity, Radix `color`) gives danger a **separate**
nominal axis. SwiftUI's `ButtonRole={cancel, destructive}` is the apparent counter-example and confirms the
rule: that role drives confirmation/ordering, not prominence, and `destructive` is itself orthogonal to
`cancel` (disposition).

- **A — Relocate `destructive` to its own axis** *(recommended)*. `level` becomes a clean ordinal scale
  `primary | secondary | tertiary`; danger moves to the new tone axis (Fork 2). Makes prominent-dangerous
  and subtle-dangerous both expressible; mirrors #1318/#1324 (orthogonal UX axis → new dimension).
- **B — Leave `destructive` on `level`** *(Rejected — broken)*. Keeps prominence and danger mutually
  exclusive — the conflation that raised this item, and the lone outlier across all benchmark systems.

**Recommended: A.** *(~90%. Residual: pure migration cost on the shipped value — which is prioritization,
not merit; on merit the axis is nominal and orthogonal, so ratify A and prioritize the migration build
separately.)*

## Fork 2 — A full semantic-tone axis, or a `danger`-only flag?

**Why it's a fork:** two coherent vocabularies that cannot both occupy the new slot — a full multi-member
tone axis vs a single-purpose danger flag — and the narrow flag is *flawed*: every benchmark's tone axis
carries `success | warning | info` **alongside** danger, so a `danger`-only flag under-models a
universally-present axis and forces a **second relocation** (another breaking change) the moment success or
warning surfaces in a block.

- **A — A full open-numbered `tone` axis** *(recommended)*. Recommended core `neutral | danger`, with
  `success | warning | info` as recommended **extended** members; open-numbered per the #1318 contract
  (standardize the dimension + core, authors may extend). The block maps each member to the conventional
  treatment (danger → red + optional confirmation affordance, which stays native).
- **B — A narrow `danger`-only flag** *(Rejected — under-fits)*. Models only the value being relocated;
  reproduces the "we'll need another axis later" problem and forces a future breaking re-relocation when
  success/warning/info appear. Adds no simplicity the open-numbered core doesn't already give (a project
  that only needs danger simply uses `tone=danger`).

**Recommended: A.** *(~70%. Residual: whether WE should bless `success/warning/info` now or leave them to
author extension — the open-numbered contract absorbs it either way; the core need only be `neutral |
danger`.)*

## Fork 3 — What is the axis named?

**Why it's a fork:** the candidate names are rival labels for the same one slot — only one can be the
standardized dimension key — and one candidate (`intent`) is *excluded* outright because it collides with
WE's first-class **Intent** concept (Action Intent, the catalog), which would make `action.intent` an
incoherent name. Among the survivors it is a genuine low-divergence naming judgment.

- **`tone`** *(recommended)*. Neutral, connotes semantic color/character, no collision; reads cleanly as
  `tone: danger`.
- **`status`** *(alternative)*. Common in DS (Chakra/Ant) but connotes runtime *state* (loading/online),
  risking confusion with `busy`.
- **`severity`** *(alternative)*. Accurate for danger/warning but connotes alert/validation *levels*, an
  odd fit for a `neutral`/`success` member.
- **`intent`** *(Rejected — collides)*. Reuses WE's Intent term; excluded.

**Recommended: `tone`.** *(~60% — Low/naming. Residual: a genuine judgment call with no broken survivor;
flag for the deciding agent's skeptic pass.)*

---

## Supported by default (not decisions)

- **`primary | secondary | tertiary` stay a clean ordinal `level`.** Only `destructive` is relocated — the
  three prominence values are a legitimate ordinal scale and are not overloaded. After relocation `level`
  is purely prominence.
- **Confirmation behavior stays native.** A danger action's confirmation (a dialog, `request-close`, a
  `value`) is expressed by `type`/`value`/invoker `command`/`method=dialog`, already in via
  `requiresCapabilities: ["invokers"]` (we:src/_data/intents/action.json:4-6). WE never re-models behavior
  (intents-are-UX-only); the tone axis names only the UX "this action is dangerous."

## Context

**Classification (per-fork pass, recorded).** Layer = **Intent** (declarative UX "what"). Not a Protocol
(no engine-swap/interop). Exposed as a **dimension** (all tone values are legitimate simultaneous
end-states — a footer can hold a neutral "Cancel" and a danger "Delete"). **Explicit per-action**, not
DI/ambient (structural to the action, like `level`/`variant`). Default = **unspecified → neutral**
(most-permissive). Open-numbered per #1318. Seam = intent → native/theme color wiring.

**Blast radius — shipped consumers of `level=destructive`** (the migration the build must handle, *not* a
merit fork): we:src/_data/intents/action.json:16, we:src/_includes/block-descriptions/action-button.njk:164
and :199, we:src/_data/blocks/menu.json:18, plus block descriptions and any theme keying
`[data-action-intent="destructive"]`. **Recommended migration shape:** keep `level=destructive` as a
**deprecated alias** mapping to `tone=danger` (default prominence) during transition, then remove. This is
migration mechanics (prioritization), kept out of the forks per *fork-is-not-a-prioritization*.

**At graduation (when ratified):** the build is two small edits to we:src/_data/intents/action.json —
remove `destructive` from the `level` values, add the `tone` dimension — plus the deprecated-alias
migration; separately prioritized (the end-state is ratified here; the schedule is normal burndown). No
Technical Configurator card: tone is a UX dimension, not a technical strategy. Lineage (carried in prose,
not a `blockedBy` edge, since #1324 is resolved): this is the danger/tone sibling of the
prominence/variant/disposition separations #1318 → #1324 established.

**Follow-ups to file at resolution:** (1) build — remove `destructive` from `level` + add the `tone`
dimension to Action Intent, with the deprecated-alias migration; (2) sweep block descriptions / themes off
`level=destructive` onto `tone=danger`.
