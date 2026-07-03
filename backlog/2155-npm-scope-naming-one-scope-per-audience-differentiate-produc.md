---
kind: decision
status: resolved
dateOpened: "2026-07-02"
dateStarted: "2026-07-03"
dateResolved: "2026-07-03"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#npm-scope-audience-layer"
preparedDate: "2026-07-02"
relatedTo: ["907", "2128", "2154", "2157"]
tags: [npm, publishing, naming, constellation, plateau]
relatedReport: reports/2026-07-02-npm-scope-audience-naming.md
---

# npm scope naming: one scope per audience, differentiate products by package name

Six npm orgs are registered (`@frontier-ui`, `@frontierui`, `@plateauapp`, `@plateaudev`, `@plateaujs`,
`@webeverything` — all verified existing with zero packages, registry probe 2026-07-02). Before the first
Plateau/FUI publish, ratify how scopes map to the constellation so the naming is a cite-able rule, not an
ad-hoc call per package. No Plateau-side design exists yet; the three forks below are grounded in a
prior-art survey published as the [/research/npm-scope-audience-naming/](/research/npm-scope-audience-naming/)
topic (session report via `relatedReport`), each with a recommended default in **bold**. npm has no scope
rename, so the lock-in axis dominates.

The concern decomposes into three orthogonal axes: **(1) canonical spelling** for the FUI scope — the code
already names 14 `@frontierui/*` packages (`fui:blocks/package.json`, `fui:plugs/package.json`, eleven more)
while the hyphenated org also exists; **(2) scope count** for Plateau — which of the three held orgs go
live, given zero `@plateau*` packages exist in code today (`plateau:package.json` is the deployed app,
`plateau-ide-bridge` ships to the VS Code marketplace, not npm); **(3) access posture** at first publish —
a public publish is irreversible where it matters (disclosure can't be undone, and npm's unpublish fencing
protects dependents; re-restricting is mechanically possible but un-discloses nothing) while
restricted → public is a one-flag flip, and #907 already
decided the WE side ([#907](/backlog/907-first-real-publish-of-webeverything-contracts-migrate-a-cons/):
`@webeverything/contracts` publishes public + provenance, delegating the rest of the boundary here).

Classification: these are **constellation-governance forks** (statute layer — the
[constellation-placement](docs/agent/platform-decisions.md#constellation-placement) /
npm-scope-mirrors-layer family), not WE-standard forks — no block/intent/protocol layer question applies.
The scope map is a **fixed convention**, not a config dimension (there is one npm registry reality; it
cannot vary per consumer). The most-permissive-default bias inverts here: on an irreversible shared
namespace, the *reversible* posture is the default (Fork 3).

## Ruling (ratified 2026-07-03)

Codified as a cite-able statute: [npm-scope-audience-layer](docs/agent/platform-decisions.md#npm-scope-audience-layer)
(one scope per audience/layer; product = package name; restricted-until-an-explicit-go). All three
recommended defaults ratified as-is:

- **Fork 1 → (a) `@frontierui`** canonical; `@frontier-ui` = permanent defensive hold. Skeptic SURVIVES vs
  the hyphenate-norm attack (norm is mixed; constellation's own shipped spelling governs).
- **Fork 2 → (b) one live scope `@plateaujs`**; `@plateauapp` + `@plateaudev` = holds. *Flips the item's
  original two-scope bold* — the second-scope rationale rested on per-scope access npm lacks (access is
  per-package); the lock-in asymmetry + `@angular-devkit` misclassification trap carry the reversal.
  `@plateaudev` re-opens only on a policy-channel or brand-on-distinctness structural earn.
- **Fork 3 → (a) restricted-until-an-explicit-go** for `@frontierui/*` + `@plateaujs/*`; public + provenance
  for `@webeverything/*` (#907). "Go" = per-package-set event; provenance-gap rule applies.

Ratify-turn re-check passed: #907's decision text (PUBLIC + provenance, decided 2026-07-02, delegates the
rest here) confirmed still live despite its publish being unexecuted (#2157). Unblocks naming the #2128
pilot set's packages.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| Fork 1 — FUI scope spelling | **(a) `@frontierui`**, `@frontier-ui` = defensive hold | (b) `@frontier-ui` (brand-matching hyphen) | High |
| Fork 2 — Plateau scope count | **(b) one live scope `@plateaujs`**; `@plateaudev` + `@plateauapp` = holds | (a) two scopes on an audience boundary | Med-high |
| Fork 3 — access posture | **(a) restricted-until-explicit-go** for `@frontierui/*` + `@plateaujs/*`; public for `@webeverything/*` (#907) | (b) public from day one | Med-high |

## Settled inputs (not forks)

- **`@webeverything` → WE standard artifacts only** — settled by
  [constellation-placement rule 3](docs/agent/platform-decisions.md#constellation-placement) (type-only
  distribution, never imports FUI) and #907's decided publish mode (public + provenance). The four existing
  packages: [we:contracts/package.json](contracts/package.json),
  [we:capability-manifest/package.json](capability-manifest/package.json),
  [we:webcases/package.json](webcases/package.json),
  [we:validation-generation/package.json](validation-generation/package.json).
- **The WE *website* never publishes to `@webeverything`.** "WE" names two artifacts — the zero-impl
  standard and the 11ty website app ([we:package.json](package.json) `web-everything`, private). Only the
  standard's artifacts ride the scope; the site is a deployed product surface (#2006 classifies it as a
  mis-homed product pending extraction) and, if ever packaged, takes a product-tier name — never a
  `@webeverything/*` slot.
- **Defensive holds publish nothing, ever** — a hold org exists solely to deny squatters/typo-confusion; the
  first package published into a hold converts it into a live scope, which only a ratified amendment here
  can do.

## Fork 1 — canonical Frontier UI scope: `@frontierui` vs `@frontier-ui`

Fork-existence: genuine either/or — a package has exactly one canonical publish identity; dual-publishing
under both scopes fails the composability probe (npm has no alias-publish, so two names = two diverging
artifacts, split lockfiles/docs/installs — proven drift, not a shared kernel).

Crux: both orgs are registered (self-collision); the code exclusively imports and names the no-hyphen form —
all 14 FUI packages (`fui:blocks/package.json` `@frontierui/blocks`, `fui:plugs/package.json`
`@frontierui/plugs`, `fui:packages/` workspaces) plus WE-side references
([we:docs/agent/platform-decisions.md](docs/agent/platform-decisions.md) cites `@frontierui/*` throughout,
e.g. the plug-distribution-unit statute).

- (a) **`@frontierui`** — merit: *identity consistency* (repo name `frontierui`, root package, every import
  specifier, every statute citation use one spelling — the published name equals the name the ecosystem
  already reads in code and docs); *precedent-consistency* (the plug-distribution-unit and
  we-fui-embed-boundary statutes are written against `@frontierui/*`). Con: marginally less readable than
  the hyphenated brand spelling "Frontier UI".
- (b) `@frontier-ui` — merit: matches the brand's two-word spelling. Con: contradicts every in-tree name and
  statute citation, so canonical docs/code would permanently disagree with the registry, or a cross-repo
  rename must land atomically before first publish — a correctness risk window with no offsetting merit
  beyond marginal readability (npm itself shows both conventions; there is no platform norm to align to).

**Default: (a) `@frontierui` is canonical; `@frontier-ui` is a permanent defensive hold that publishes
nothing.** *Rejected:* dual-publish (drift by construction, above).

Skeptic: SURVIVES — beat the strongest attack, the "multiword scopes hyphenate" ecosystem norm
(`@open-wc`, `@shoelace-style`, `@typescript-eslint`): the norm is mixed (`@webcomponents`, `@vitejs`
smash), so the governing precedent is the constellation's own shipped spelling — 14 packages plus every
statute citation — a merit case (precedent-consistency + permanent code/doc↔registry agreement), not a
migration-cost one. Also confirmed #1991's smash-not-hyphenate rule is cited nowhere as authority here (its
scope is HTML attribute names).
Screen: clear — the scope spelling is the most consumer-visible surface there is (every install/import), and a merit difference (identity/precedent consistency vs marginal readability) survives with both branches free to build.

## Fork 2 — how many live scopes for Plateau

Fork-existence: genuine either/or — the cite-able rule must name exactly one home for each package class
(the first internal/dev package publishes to exactly one scope); "two scopes on an audience boundary" and
"one scope, name-differentiated" are mutually exclusive as the standing rule. "Decide per package later" is
the ad-hoc state this item exists to end.

Crux: zero `@plateau*` packages exist or are planned in code (`plateau:package.json` deploys; no npm
artifact). The survey found scope splits track **public product identity** (`@vitejs`), **support policy**
(`@lit-labs`), or a **public tooling line** (`@angular-devkit` — which is public: "dev" ≠ internal); none
splits for privacy, because npm access is **per-package** (`--access restricted`), not per-scope.

- (a) two live scopes on an audience boundary — `@plateaujs` = customer-facing installables
  (`@plateaujs/compliance-suite`, siblings), `@plateaudev` = internal/dev-only. Merit pro: the scope name
  itself signals audience in lockfiles/dep-trees (an internal dep leaking into a customer product is visible
  at a glance); org-level credential blast-radius separation. Merit cons: the boundary is ambiguous for
  customer-facing dev tooling (a published CLI reads as "dev" yet is a customer product — the
  `@angular-devkit` precedent shows the name misleads); the "distinct access policy per scope" rationale
  overstates what a scope adds — org membership/2FA/teams are org-level, but equivalent separation is
  achievable within one org via teams + per-package access + granular tokens, so the scope buys a label, not
  an enforcement boundary; and it mints
  a second *permanent* identity (no rename path) whose promised benefit — name-level audience signaling — is
  hypothetical while the misclassification surface it creates is structural.
- (b) **one live scope `@plateaujs`** — all Plateau npm packages, customer-facing products differentiated by
  package name; an internal package, if one is ever npm-published, rides the same scope as
  `--access restricted` (invisible to non-members — restricted packages don't list publicly, so internal
  names don't pollute the customer-visible namespace). Merit pro: matches every surveyed precedent
  (companies keep restricted packages in the public org); no audience-boundary ambiguity to misclassify
  against; one identity to secure (2FA policy, trusted publishers). Merit con: forgoes name-level audience
  signaling and org-level blast-radius separation — mitigated per-package by access + granular tokens.
- (c) a scope per product line (app / compliance / …) — *Rejected*: an org is heavyweight (own membership,
  2FA/trusted-publisher surface) and gives no isolation a package name doesn't; no surveyed ecosystem does
  this; it multiplies permanent identities on a namespace with no rename path.

**Default: (b) one live scope `@plateaujs`; `@plateauapp` and `@plateaudev` are defensive holds.**
The `@plateaujs`-over-`@plateauapp` spelling is ruled, not inherited: the project-scope precedent
(`@vitejs`/`@vuejs` — a "js" scope names the *project* whose packages consumers install) fits a scope that
distributes installables, while `@plateauapp` names the SaaS app, which is deployed, never npm-published —
so `@plateauapp` = brand hold that distributes nothing. `@plateaudev` = hold with **two** named re-open
triggers, and only these: (i) a genuine *publish-policy channel* emerges (a `@lit-labs`-style experimental
tier with different stability guarantees); or (ii) the
[brand-on-distinctness](docs/agent/platform-decisions.md#brand-on-distinctness) structural event — a
sub-component gains ≥1 consumer that depends on it *without* depending on the parent product (the `@vitejs`
case), which *earns* a scope the way it earns a brand (default is fold, per that statute). Never merely to
hide internal packages — privacy is per-package access, not a scope. This flips the item's original bold
(two scopes): the audience-boundary rationale rested on a per-scope access mechanism npm doesn't have, and
its signaling benefit is hypothetical while its misclassification surface is structural.

Skeptic: SURVIVES-WITH-AMENDMENT — the flip from (a) to (b) held against the blast-radius and
audience-signal attacks (both real but per-package-mitigable via access + granular/OIDC tokens, and
outweighed by the misclassification risk the `@angular-devkit` precedent demonstrates); the lock-in
asymmetry also favors (b) — a wrong (b) moves a *restricted*, dependent-less package cheaply under the
re-open trigger, while a wrong (a) republishes a public package with external dependents. A "defer the
internal-home half until a member exists" re-route was beaten: the standing rule must be total before first
publish or the ad-hoc-call state persists. Amendments folded: (1) the `@plateaudev` re-open triggers made
explicit and doubled — policy channel *or* the
[brand-on-distinctness](docs/agent/platform-decisions.md#brand-on-distinctness) structural event — so (b)
forecloses neither the labs pattern nor an earned second identity; (2) the `@plateaujs`-over-`@plateauapp`
spelling was an assertion inherited from a passing line in #907 — now grounded in a ruled line
(project-scope precedent + the app distributes nothing); (3) the "not an npm mechanism" claim softened to
the accurate form (org-level controls exist; equivalent separation is achievable within one org).
Screen: flagged(prio) → fix applied: the (a) con "reserves structure for a zero-member family / speculative
scaffolding" was YAGNI (a timing argument) in merit's clothes — re-grounded on merit (a second permanent
identity with a structural misclassification surface vs a hypothetical signaling benefit). With that
stripped, both branches free to build still differ on merit (boundary-ambiguity correctness +
precedent-consistency + lock-in asymmetry vs name-level signaling + blast radius), and scope names are fully
consumer-observable — the fork stands.

## Fork 3 — access posture at first publish, per scope

Fork-existence: genuine either/or at each package's first publish — a public publish is irreversible where
it matters (disclosure cannot be undone; npm's unpublish fencing protects dependents; re-restricting is
mechanically possible but un-discloses nothing) while restricted → public is a one-flag flip; one package
cannot hold both postures. The branches are the two values of the *standing default* the rule sets, and the
default must be named before the first Plateau/FUI publish (imminent: #2128's pilot set).

Crux: the reversibility asymmetry, plus: provenance requires public; restricted requires the org's paid plan
and read tokens for every consumer/CI (the friction #907 dodged by publishing contracts public); and for the
`@plateaujs/*` half the posture is already ruled — the
[monetization statute rule 5 (#1590)](docs/agent/platform-decisions.md#monetization) commits the paid
flagship to a *licensed local product* with "build decoupled from release timing", so restricted is
compliance with an existing anchor, not caution.

- (a) **restricted-until-an-explicit-go for impl/product scopes** (`@frontierui/*`, `@plateaujs/*` publish
  `--access restricted`, no provenance until public); **public + provenance for the `@webeverything/*`
  standard surface** (settled by #907 — a standard's adoption requires tokenless install). "Go" is a
  **per-package-set event, not one launch date**: the first external consumer who cannot reasonably hold a
  read token flips that set public — #2128's pilot channel ("no constellation-insider support") is exactly
  such an event for the pilot-scoped FUI blocks/plugs. The rule is total: restricted is the standing default
  for every non-`@webeverything` package; a flip to public is always an explicit decision (so a paid
  `@plateaujs` product simply *never* gets flipped without its own ruling — no residue left open).
  **Provenance-gap rule:** versions published restricted never gain provenance retroactively and
  `npm access public` exposes the *entire* restricted history at once — so at each go event, ship a fresh
  provenance-attested version and treat pre-go versions as unattested (or flip before meaningful history
  accrues). Merit, per half: for `@plateaujs/*`, restricted **complies with the ruled monetization line**
  (licensed local paid flagship, #1590 — public npm code would contradict it); for `@frontierui/*` (whose
  end-state the open-core statute already commits to free/open), the merit is **reversibility** plus not
  freezing pre-1.0 surfaces into public dependents.
- (b) public from day one for everything — merit pro: provenance everywhere from version 1, zero token
  distribution, no paid plan dependency. Merit con: contradicts the ruled monetization line for the
  `@plateaujs/*` half (the paid flagship is licensed, not public npm); pre-1.0 churn lands on public
  dependents; disclosure is a one-way door.
- (c) everything restricted including `@webeverything/*` — *Rejected*: contradicts #907's decided
  public+provenance for contracts and the standard's role (adoption requires tokenless, provenance-attested
  install).

**Default: (a) restricted-until-an-explicit-go, public for the WE standard surface.** Consumer-pinning of
any restricted dep stays deferred to its go event, to avoid distributing read tokens across the
constellation (the #907 rationale, generalized).

Skeptic: SURVIVES-WITH-AMENDMENT — beat two re-routes: (i) the config-dimension re-route (`--access` is
literally a two-value knob, and Q6 most-permissive would then default *public*) fails on citation-scope —
[config-extends-platform-default](docs/agent/platform-decisions.md#config-extends-platform-default) governs
consumer-configurable *standard* dimensions, not one-publisher governance of a shared irreversible registry,
where the reversible value is the honest default; (ii) the "launch-timing in fork costume" re-route fails
because stripping timing leaves reversibility, statute compliance, and token friction as merit differences;
and the #2128 "no insider support" attack is absorbed by defining "go" per package-set (the pilot is served
by a public flip, never by read tokens). Amendments folded: (1) the rationale re-grounded per half — the
`@plateaujs` half rests on the [monetization statute (#1590)](docs/agent/platform-decisions.md#monetization)
(restricted = compliance, not caution) and the earlier "keeps the open-core boundary undecided" framing was
dropped for the `@frontierui` half (the statute already commits the reference impl free/open — reversibility
+ pre-1.0-churn carry that half alone); (2) the **provenance-gap rule** added (restricted versions never
gain provenance retroactively; each go ships a fresh attested version); (3) the irreversibility claim
tightened to disclosure + unpublish fencing (re-restricting is mechanically possible).
Screen: clear — access posture is directly consumer-observable (installability, provenance, tokens), and
after stripping timing a merit difference remains (disclosure irreversibility + monetization-statute
compliance vs provenance/token-freedom); the per-set "go" definition keeps the ordering half out of the
fork.

---

## Context

**Human actions (noted, not blockers to prep):** (1) authoritative confirmation that all six orgs are owned
by the same npm account (`npm org ls` / dashboard — the anonymous probe proves existence, not ownership);
(2) enabling the paid plan on whichever org first publishes restricted (Fork 3(a) needs it for
`@frontierui`/`@plateaujs`); (3) any org-level 2FA / trusted-publisher policy setting (#2154 pattern). All
defaults above are contingent on (1) — if a scope turns out not to be held by the owner, its slot falls back
to the nearest held spelling and this item re-opens for that scope only.

**Statute overlap checked:** the rule to codify ("scope = audience/layer; product = package name;
restricted-until-go") extends the [constellation-placement](docs/agent/platform-decisions.md#constellation-placement)
npm-scope-mirrors-layer family (WE↔FUI half already codified there; this adds the Plateau half + the access
posture) — compose, no collision. Two further anchors govern this turf and compose rather than collide:
the [monetization statute](docs/agent/platform-decisions.md#monetization) (rule 2 open-core + rule 5 #1590
licensed local flagship — Fork 3's restricted default for `@plateaujs/*` *implements* it) and
[brand-on-distinctness](docs/agent/platform-decisions.md#brand-on-distinctness) (default-fold + the
structural earn test — Fork 2's second re-open trigger *composes* it: a scope is earned the way a brand
is). The naming statutes #1987/#1991
([attribute-name-colon-namespacing](docs/agent/platform-decisions.md#attribute-name-colon-namespacing)) are
scoped to HTML attribute spelling and do not reach npm scopes (citation-scope: supporting context only).

**Lineage / edges:** #907 (first `@webeverything/contracts` publish; decided public+provenance; delegates
the boundary here) · #2128 (pilot channel — the first Fork 3 "go" event) · #2157 (publish lag) · #2154
(OIDC trusted publishing). Ratifying this item unblocks naming the pilot set's packages in #2128.
**Ratify-turn re-check:** the settled-input citation of #907's publish mode points at an *open story*
whose decision is recorded in its body but whose publish is still unexecuted (#2157: `contracts-v0.1.0`
tagged, npm E404) — per the verify-ratified-citation rule, confirm at the ratify turn that #907's decision
text is still live before leaning on it.

_Ratified 2026-07-03 — bold defaults are now rulings; see the Ruling block above and the codified statute
[npm-scope-audience-layer](docs/agent/platform-decisions.md#npm-scope-audience-layer)._
