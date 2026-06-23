# Backlog split analysis — #718, #232 (2026-06-23)

Focused sweep triggered by #1623's two open residuals ("split the bundled #718 card; make #232's
`priority: low` real"). Rubric: size is volume not an unresolved decision · ≥2 nameable slices each
with a real home · each slice lands `size` ≤ 3 / `task` (deferred/parked slices exempt — they are not
batched) · clean DAG · every slice leaves a valid demoable state.

## #232 — Deferred `<component>` compiler strategy opt-ins — **NO ACTION (already sliced)**

The #1623 residual ("retype #232 to buildable, or split the 3-opt-in pool") is **stale**. A concurrent
session already converted #232 to a storied epic on 2026-06-23 with three `priority: low` children:

- **#1628** — `.component` dedicated-file surface (size 3, source-surface axis)
- **#1629** — per-bundler-native integration incl. Rust/WASM SWC plugin (size 5, toolchain-depth axis)
- **#1630** — `ts-patch`/`ttypescript` custom-transformer for `tsc`-only (size 3, `tsc`-support axis)

Nothing to split. The `priority: low` demote is now real (it sits on buildable child stories, not on the
inert epic). #232 needs no further action from #1623.

## #718 — SWC-native trait transform + Babel pre-step — **CAN SPLIT** (after decision→epic retype)

#718 is mis-typed `kind: decision` but carries **no merit fork**: it mirrors the #232 verdict (retyped
decision→epic same day). #127-class precedent settled toolchain reach as configurable strategy axes with
native-first defaults; the trait baseline (#717 Rollup/webpack/esbuild/Parcel, #722 conformance) shipped.
The two deferred mechanisms below each join a **different** axis, are additive, and break nothing —
*support-all, build-on-trigger*. "Which / when" is pure prioritisation, and a fork is never a
prioritisation tool. So #718 is an **epic of two deferred slices**, each with a **different hold-state**
— which is itself why one card can't hold both.

Note: no double-count with #232's #1629. #1629 is the `<component>` compiler's SWC plugin; #718 is the
**trait Enforcer's** SWC transform (against the #716 manifest contract) — a parallel, distinct subsystem
(#715 body is explicit: traits split a different artifact than `<component>`).

### Proposed slices (parent #718, which becomes a storied epic under #715)

| Slice | Disposition | Axis | Rationale |
|-------|-------------|------|-----------|
| **A — Babel transform pre-step for the trait Enforcer** | `size: 3`, `priority: low` | toolchain-reach | Specifiable now; documented-pre-step template already exists (#234 / #744 Parcel). Buildable whenever there's slack; just not worth doing now. |
| **B — SWC-native trait transform (Turbopack/rspack), Rust/WASM SWC plugin** | `size: 5`, `parkedReason: maturityGated`, `maturityTrigger: "adoptionSignal: a real SWC/Turbopack trait consumer"` | toolchain-depth | Building now produces a worse artifact — you'd tune the plugin against no real SWC/Turbopack integration to validate against. Flips ready on a named adoption signal. |

**DAG:** both children `blockedBy: []` — independent, additive on #715's resolved baseline (#717/#722).
No cross-edges. Each leaves a valid demoable state (the baseline four-bundler enforcer keeps working;
each slice only *adds* reach).

**Safety:** Slice A is agent-ready (`size 3`, buildable). Slice B is `size 5` but `maturityGated` —
parked, never auto-batched, so the ≤3 agent-ready bar doesn't apply (same as sibling #1629 size 5).
≥2 nameable slices ✓ · real home (#718/#715) ✓ · clean DAG ✓ · valid demoable state ✓.

## Could-not-split

None for #718. #232 was a no-op (already sliced upstream).

## Follow-up

On approval: retype #718 decision→epic, scaffold slices A/B, then #1623's last residual clears and
#1623 resolves.
