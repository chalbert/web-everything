/**
 * Plug parity — the **type-only** schema for the per-plug unplugged-parity manifest (#1888, slice S5b of
 * epic #1836).
 *
 * Types and interfaces only: this module is fully **compile-erased** (no runtime emit) and is the
 * `@webeverything/contracts/plug-parity` entry (#872/#874) that FUI depends on (the FUI→WE arrow). Per
 * #1282 zero-impl + the #1839 ruling, WE holds **only this shape** — the measured verdict *values* are a
 * fact about the FUI runtime and live FUI-side (`fui:plugs/<plug>/parity.json`, seeded in #1887), never in
 * a WE data file (a measured impl verdict in a WE `src/_data/plugs/*.json` contract would be a FUI→WE
 * leak). The doc-site parity table (#1844) and the FUI manifest both type their data against this module.
 *
 * The marking vocabulary is the caniuse-shaped **3-state** ratified by #1839
 * (`docs/agent/platform-decisions.md#plugged-only-residue-bar`): `works` (≈ caniuse `y`),
 * `works-with-caveat` (≈ `a` / BCD `partial_implementation`, **mandatory note**), and `plugged-only`
 * (≈ `d`, gated — carries a **residue justification** naming the missing platform hook). A capability that
 * is merely **not-yet-ported** (portable to a WeakMap-keyed, plug-owned API — *not* genuine residue per the
 * strict bar) has no dedicated state in the 3-state enum, so it is recorded as `works-with-caveat` with a
 * `pendingPort` reference to the fix card that will move it to `works` (e.g. webexpressions interpolation
 * → #1856, webvalidation form-fields → #1857).
 */

/** The #1839 3-state parity vocabulary, applied per public-API member. */
export type PlugParityState =
  /** Proven unplugged by an automated test exercising the real capability (≈ caniuse `y`). */
  | 'works'
  /** Reachable unplugged but the surface is partial/plumbing-only — carries a mandatory `note` (≈ `a`). */
  | 'works-with-caveat'
  /** Genuine residue: contract requires interception the plug holds no handle to — carries `residue` (≈ `d`). */
  | 'plugged-only';

/** One public-API capability's measured unplugged-parity verdict. */
export interface PlugParityCapability {
  /** The public capability under audit (one matrix row). */
  capability: string;
  /** The 3-state verdict. */
  state: PlugParityState;
  /**
   * Mandatory when `state === 'works-with-caveat'`: what is and isn't proven unplugged. Also carries the
   * not-yet-ported explanation when `pendingPort` is set.
   */
  note?: string;
  /**
   * Mandatory when `state === 'plugged-only'`: the residue justification — which unowned global is patched,
   * why no handle reaches the node, and the **missing platform hook** the residue stands in for (#1839
   * discharge rule).
   */
  residue?: string;
  /**
   * A fix-card reference (e.g. `"#1856"`) when the capability is **not-yet-ported** rather than a settled
   * verdict — present only alongside `works-with-caveat`. Absent for genuine residue (`plugged-only`) and
   * for fully-working capabilities.
   */
  pendingPort?: string;
  /** Where the verdict is grounded — a `fui:` test/source ref proving (or measuring the absence of) the capability. */
  grounding: string;
}

/** One plug domain's parity manifest — the shape of each `fui:plugs/<plug>/parity.json`. */
export interface PlugParityManifest {
  /** The plug domain (e.g. `"webinjectors"`). */
  domain: string;
  /** The re-audit report the verdicts are transcribed from (a `we:reports/…` ref). */
  source: string;
  /** A human-readable note on the vocabulary used (cites the #1839 ruling). */
  vocab: string;
  /** When the parity was measured (ISO date). */
  auditedDate: string;
  /** The per-capability verdicts. */
  capabilities: PlugParityCapability[];
}
