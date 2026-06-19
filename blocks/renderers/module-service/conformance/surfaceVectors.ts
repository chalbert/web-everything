/**
 * @file blocks/renderers/module-service/conformance/surfaceVectors.ts
 * @description Surface-contract conformance vectors + verdict schema (backlog #975).
 *
 * The **surface-contract** tier of the graded-conformance model ratified by #913. It is the
 * DETERMINISTIC, no-live-sandbox check that a generated framework wrapper (React/Vue, emitted by FUI's
 * genWrapper from a block's CEM) exposes EXACTLY the surface — props/events/slots/rendered-tag — the CEM
 * contract declares. It is a *semantic surface-vs-contract* verdict, NOT a byte-for-byte source golden
 * (that would be mere regression): it catches "the generator dropped an event / forgot a prop" before
 * the behavioral tier (#967) or the live sandbox (#912) exist — a different, earlier failure class.
 *
 * Ownership (per #899 / constellation-placement): the **vectors + schema live here in WE** (the neutral
 * conformance source of truth, like the serve-path `vectors.ts` next door); the **runner lives in FUI**
 * (`frontierui/tools/gen-wrapper/surfaceContract.mjs`, adjacent to the genWrapper it exercises) and the
 * **badge** is the FUI-workbench consumer (labelled precisely `surface-contract` — the honesty rule:
 * never a bare `conformance` label). A WE→FUI runtime import is forbidden (#855/#817), so FUI consumes
 * these vectors via the contract-distribution seam (byte-replication interim / published-package
 * end-state, per #700/#239); the surface PROJECTION below is target-neutral so the runner maps each
 * member to its per-target manifestation (a React event → an `onXxx` handler prop; a Vue event → an
 * `emits` entry) without WE legislating framework specifics.
 */

/** The forward targets the surface-contract tier verifies a generated wrapper for. */
export type WrapperTargetName = 'react' | 'vue';

/**
 * One member of a custom element's declared surface, projected from its CEM — the unit the wrapper must
 * expose. Target-neutral: an `event` is "the wrapper must forward this DOM event" however the framework
 * spells it; `tag` is "the wrapper must render this custom-element tag" (consume-mode, never reimplement).
 */
export interface SurfaceMember {
  readonly kind: 'attribute' | 'property' | 'event' | 'slot' | 'tag';
  /** The CEM name (attribute/property/event/slot name, or the `tagName` for `kind:'tag'`). */
  readonly name: string;
}

/** The minimal CEM `custom-element` declaration shape the surface tier reads (a contract subset). */
export interface CemDeclarationLike {
  readonly name: string;
  readonly customElement: true;
  readonly tagName: string;
  readonly attributes?: ReadonlyArray<{ name: string; fieldName?: string }>;
  readonly members?: ReadonlyArray<{ kind: string; name: string; privacy?: string; static?: boolean }>;
  readonly events?: ReadonlyArray<{ name: string }>;
  readonly slots?: ReadonlyArray<{ name: string }>;
}

/**
 * A surface-contract vector: a CEM declaration paired with the surface it declares. The `surface` is the
 * neutral expectation the wrapper must meet for every target. It is written explicitly (not re-derived
 * from `cem` here) so this file is the reviewable source of truth for *what the contract requires* — a
 * generator change that drops a member fails against the frozen expectation, not against itself.
 */
export interface SurfaceVector {
  readonly name: string;
  readonly description: string;
  readonly cem: CemDeclarationLike;
  readonly surface: ReadonlyArray<SurfaceMember>;
}

/** One member's result within a verdict — present (the wrapper exposes it) or missing (a drop). */
export interface SurfaceCheckResult {
  readonly member: SurfaceMember;
  readonly present: boolean;
}

/**
 * The deterministic verdict the FUI runner produces for one (vector, target). `ok` iff every declared
 * member is present AND the wrapper exposes no surface the contract does not declare (`extra`). The
 * label is fixed to `surface-contract` so the workbench badge can never mislabel it a bare `conformance`.
 */
export interface SurfaceContractVerdict {
  readonly label: 'surface-contract';
  readonly vector: string;
  readonly tag: string;
  readonly target: WrapperTargetName;
  readonly ok: boolean;
  readonly checks: ReadonlyArray<SurfaceCheckResult>;
  /** Declared members the wrapper failed to expose (the generator dropped them). */
  readonly missing: ReadonlyArray<SurfaceMember>;
  /** Members the wrapper exposes that the contract does not declare (the generator invented them). */
  readonly extra: ReadonlyArray<SurfaceMember>;
}

/**
 * The canonical surface-contract vectors. Coverage spans every surface dimension so a generator regression
 * in any one fails loudly: a reflected attribute, a reactive property, a forwarded event, a slot, and the
 * rendered tag — plus a multi-member element that mixes all of them (`combo-box`).
 */
export const SURFACE_VECTORS: ReadonlyArray<SurfaceVector> = [
  {
    name: 'combo-box (mixed surface)',
    description: 'An element exercising every dimension at once — attribute, property, event, slot, tag.',
    cem: {
      name: 'ComboBox',
      customElement: true,
      tagName: 'fui-combo-box',
      attributes: [{ name: 'label', fieldName: 'label' }, { name: 'placeholder' }],
      members: [
        { kind: 'field', name: 'value' },
        { kind: 'field', name: 'open' },
        { kind: 'field', name: 'secret', privacy: 'private' },
        { kind: 'method', name: 'reset' },
      ],
      events: [{ name: 'change' }, { name: 'open-change' }],
      slots: [{ name: '' }],
    },
    surface: [
      { kind: 'tag', name: 'fui-combo-box' },
      { kind: 'attribute', name: 'label' },
      { kind: 'attribute', name: 'placeholder' },
      { kind: 'property', name: 'value' },
      { kind: 'property', name: 'open' },
      { kind: 'event', name: 'change' },
      { kind: 'event', name: 'open-change' },
      { kind: 'slot', name: '' },
    ],
  },
  {
    name: 'attributes-only',
    description: 'A presentational element with only reflected attributes (no props/events/slots).',
    cem: {
      name: 'StatusBadge',
      customElement: true,
      tagName: 'fui-status-badge',
      attributes: [{ name: 'tone' }, { name: 'count' }],
    },
    surface: [
      { kind: 'tag', name: 'fui-status-badge' },
      { kind: 'attribute', name: 'tone' },
      { kind: 'attribute', name: 'count' },
    ],
  },
  {
    name: 'events-only',
    description: 'An interactive element whose surface is its forwarded events — the easiest to drop.',
    cem: {
      name: 'Stepper',
      customElement: true,
      tagName: 'fui-stepper',
      events: [{ name: 'increment' }, { name: 'decrement' }],
    },
    surface: [
      { kind: 'tag', name: 'fui-stepper' },
      { kind: 'event', name: 'increment' },
      { kind: 'event', name: 'decrement' },
    ],
  },
];
