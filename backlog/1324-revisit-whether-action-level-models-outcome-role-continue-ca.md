---
kind: decision
size: 3
status: resolved
blockedBy: ["1318"]
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: none
codifiedIn: one-off
preparedDate: "2026-06-20"
tags: [webintents, action-intent, disposition, native-first]
relatedProject: webintents
relatedReport: reports/2026-06-20-action-disposition-outcome-role.md
---

# Revisit whether Action `level` models outcome-role (continue/cancel/back) not just prominence

Raised during #1318 (the ratified `variant` axis). Action Intent
(we:src/_data/intents/action.json:10-18) documents `level` (`primary | secondary | tertiary |
destructive`) as *"semantic weight determining visual prominence,"* but primary/secondary buttons
routinely carry an **outcome-role** — primary = continue/confirm, secondary = back/cancel — that
prominence alone does not capture. This decides whether action **disposition** deserves its own
modelling, or whether `level` already adequately stands in. **Prepared** — forks below are grounded in a
prior-art survey published as the `/research/action-disposition-outcome-role/` topic (session report
we:reports/2026-06-20-action-disposition-outcome-role.md); each carries a recommended default in
**bold**. Exploratory / low-priority; the ruling is the end-state, the build is separately prioritized.

## Ruling (ratified 2026-06-20)

- **Fork 1 → A.** WE adds a thin **`disposition`** dimension to Action Intent (a 6th dimension:
  `level · variant · busy · groupOrdering · groupSizing · disposition`). `level` stays prominence-only.
- **Fork 2 → A, open-numbered.** Value set is the abstract triple **`affirmative | dismissive | neutral`**
  as the *recommended core* — explicitly **NOT a closed enum**. Per the user's ratification constraint, WE
  must not rely on a closed/finite disposition set: authors may mint additional members per the #1318
  open-numbered-variants contract (consistent with intents-open-design — standardize the meta-schema, not
  the list). The block maps each member to the native mechanism (`command`/`value`/default-button).
- **Settled:** behavioral outcome stays native; `destructive`-relocation off `level` carved to a follow-up.
- **Build is separately prioritized** (single edit to we:src/_data/intents/action.json) — filed as a
  follow-up, not done in this exploratory decision.

## Recommended path at a glance

| # | Decision | Recommended default | Main alternative | Confidence |
|---|----------|---------------------|------------------|------------|
| 1 | Does WE add a `disposition` dimension to Action Intent? | **A — add a thin `disposition` dimension** (affirmative/dismissive/neutral) to drive platform ordering + default-button | B — leave un-modeled, infer from native `type`/`command`/`value` | ~75% |
| 2 | What is the value set? | **A — minimal abstract triple `affirmative \| dismissive \| neutral`** (open-numbered per #1318 contract) | B — literal `continue \| confirm \| cancel \| back` enum | ~70% |

**Settled without a fork** (see *Supported by default* + *Context*): `level` stays prominence-only (the
item's null hypothesis, rejected); behavioral outcome stays **native** (`type`/`value`/invoker
`command`/`method=dialog`, already in via `requiresCapabilities: ["invokers"]`); `destructive`-relocation
is **carved out** (touches a shipped `level` value — its own follow-up).

## Axis-framing

The concern decomposes into one orthogonal axis WE might own — **disposition** — plus two things that are
*not* WE's to model. Pinned to the real tree:

- **Prominence** — `level: primary | secondary | tertiary | destructive`
  (we:src/_data/intents/action.json:10-18). Stays as-is; visual weight only.
- **Behavioral outcome** — submit / reset / dismiss / back. Already native:
  `button[type=submit|reset]`, `form[method=dialog]` + button `value` → `returnValue`, and the **Invoker
  Commands API** (`command="show-modal|close|request-close"` + `commandfor`). Action Intent already pulls
  this in: `requiresCapabilities: ["invokers"]` (we:src/_data/intents/action.json:4-6). Per
  *intents-are-UX-only* (we:docs/agent/platform-decisions.md#intents-ux-only) WE does **not** re-model
  behavior — the block maps disposition → the native mechanism.
- **Disposition** — the *abstract* affirmative/dismissive/neutral semantic, independent of which native
  mechanism enacts it. This is the UX "what" `level` is currently overloaded to imply, and the only axis
  in play. Its consumer already exists in-tree: `groupOrdering: dom | reverse | platform`
  (we:src/_data/intents/action.json:26-32) — `platform` ordering (macOS/iOS affirmative-last, Windows
  affirmative-first) and default-button emphasis **cannot be applied without a disposition signal**.

Disposition is structural/presentational (an authored per-action property like `level`), so it resolves
`explicit (per-element) ⊕ ambient project default ⊕ default`, with a most-permissive **unspecified**
default (absent → the block infers from the native signal, else neutral ordering). This is the same
move #1318 made for `variant`: name the orthogonal UX axis as a new dimension on the owning intent
rather than overloading `level`.

## Fork 1 — Does WE add a `disposition` dimension to Action Intent?

**Why it's a fork:** the branches genuinely cannot coexist — either Action Intent declares a
`disposition` dimension or it does not; and the alternative (infer from native, no dimension) is
*broken*, so this resolves to a forced **ratify**. The break: the abstract disposition is **not
recoverable** from a plain `button[type=button]` + JS-handler action (the common case) — it carries
no native `type`/`command`/`value` disposition signal at all — so `groupOrdering: platform`
(we:src/_data/intents/action.json:26-32) and default-button emphasis are unsatisfiable without it. DOM
order + `level` prominence do not say which action is affirmative (the affirmative can be any level — in
a destructive-confirm dialog the safe "Cancel" is often the most prominent). Prior art is unanimous that
disposition is a *separate* axis from prominence: SwiftUI `ButtonRole = {cancel, destructive}` (the
cancel role drives ordering, not weight), Material positive/negative/neutral, WinUI Primary/Secondary/
**Close** + `DefaultButton`.

- **A — Add a thin `disposition` dimension** *(recommended)*. A sixth dimension on Action Intent
  (`level · busy · groupOrdering · groupSizing · variant · disposition`) naming the affirmative/
  dismissive/neutral semantic. The block maps it to the native mechanism (`command="request-close"`,
  `value="cancel"`, default-button). Makes `groupOrdering: platform` and default-button implementable;
  mirrors #1318's `variant` precedent (orthogonal UX axis → new dimension on the owning intent).
- **B — Leave it un-modeled; infer from native** *(Rejected — broken)*. No dimension; the block reads
  disposition from `type`/`command`/`value`. Fails for the common `type="button"` + JS action which
  carries no native disposition signal, leaving `groupOrdering: platform` unsatisfiable — the gap that
  raised this item.

**Recommended: A.** *(~75%. Residual: whether to build the dimension now or leave it latent until a
block implements platform ordering — but that is prioritization, not merit; on merit the axis is real
and orthogonal, so rule A and prioritize the build separately.)*

## Fork 2 — What is the disposition value set?

**Why it's a fork:** two coherent vocabularies that cannot both be the standardized core set — a minimal
*abstract* triple vs a literal *outcome-label* enum — and the literal enum is *flawed*: it reproduces the
behavior-vs-disposition conflation Fork 1's invariant forbids. "continue" and "confirm" both **are**
affirmative; "back" and "cancel" both **are** dismissive — the finer label is a native
`command`/`value`/author-label concern, not a distinct disposition.

- **A — Minimal abstract triple `affirmative | dismissive | neutral`** *(recommended)*. The shared
  semantic across SwiftUI's cancel-role, Material's positive/negative/neutral, and WinUI's Primary/Close.
  Open-numbered per the #1318 contract (standardize the contract + recommended core; authors may extend).
  Multi-step "Back" maps to `dismissive` (regressive) by convention; finer wizard-step semantics are a
  navigation concern, not disposition.
- **B — Literal `continue | confirm | cancel | back` enum** *(Rejected)*. Mirrors the raised item's
  wording but over-fits: continue/confirm collapse to affirmative, back/cancel to dismissive, so the enum
  smuggles behavioral labels into the disposition axis — the exact conflation Fork 1 rules out.

**Recommended: A.** *(~70%. Residual: whether `neutral` earns a core slot or is left to author
extension — minor, the open-numbered contract absorbs it either way.)*

---

## Supported by default (not decisions)

- **`level` stays prominence-only.** The item's null hypothesis — "`level` already adequately stands in"
  — is **rejected** on the orthogonality + platform-ordering evidence (affirmative ≠ most-prominent;
  `groupOrdering: platform` needs a disposition signal `level` can't give). This is the forced answer to
  the item, not a fork.
- **Behavioral outcome stays native.** submit/reset/dismiss/back are expressed by
  `type`/`value`/invoker `command`/`method=dialog`, already in via `requiresCapabilities: ["invokers"]`.
  WE never re-models behavior (intents-are-UX-only); the block wires disposition → native.

## Context

**Carved out — `destructive` relocation.** SwiftUI models `destructive` as a `ButtonRole` (alongside
`cancel`), not a prominence — which suggests `destructive` is mis-placed on `level`
(we:src/_data/intents/action.json:16). But relocating it touches a **shipped** `level` value with its own
blast radius (every block + theme consuming `level="destructive"`), and it is orthogonal to
affirmative/dismissive (a destructive action is usually the *affirmative* one). It is a different
decision — the broader "`level` is overloaded" cleanup — deliberately **out of scope** here and filed as
a follow-up, not ratified in this exploratory item.

**Classification (per-fork pass, recorded).** Layer = **Intent** (declarative UX "what"). Not a Protocol
(no engine-swap/multi-vendor interop). Exposed as a **dimension** (all values are legitimate simultaneous
end-states — a footer has affirmative + dismissive + neutral at once). **Explicit per-action**, not
DI/ambient (structural to the action, like `level`). Default = **unspecified** (most-permissive). Seam =
consumed by Action's own `group` sub-axis (`groupOrdering: platform`, default-button) + intent→native
wiring.

**At graduation (when ratified):** the build is a single small edit — add the `disposition` dimension to
we:src/_data/intents/action.json — separately prioritized (the end-state is ratified here; the schedule
is normal burndown). No Technical Configurator card: disposition is a UX dimension, not a technical
strategy. `blockedBy: ["1318"]` (now resolved) records the lineage: this is the disposition sibling of
the prominence/variant separation #1318 established.

**Follow-ups to file at resolution:** (1) build — add `disposition` to Action Intent; (2) the
`destructive`-off-`level` cleanup (broader level-overload review).
