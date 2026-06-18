/**
 * genWrapper.mjs — consume-mode per-framework wrapper generator (#821).
 *
 * ⚠ REFERENCE FIXTURE, NOT A STANDARD (#855 B2 / #892). The canonical generator was re-homed to
 * Frontier UI (`frontierui/tools/gen-wrapper/`) — codegen is impl/tooling, never a `@webeverything`
 * standard; only the CEM *contract* crosses the WE→FUI seam, code never does. This WE copy is kept
 * solely as a CEM-subordinate reference (the #461 "reference impl, not the definition" pattern) that
 * lets WE materialize + diff sample wrappers; the WE-owned conformance is the generator-agnostic
 * behavioral vectors + runner (`wrapper-conformance/`, #891), which judge ANY generator's output.
 *
 * Pure: `(declaration, target) => wrapperSource` (a string). No DOM, no FUI import — the
 * output is a code artifact that crosses the layer seam to the FUI Block Explorer panel
 * (#753, locus:frontierui) and the #506 conformance gate.
 *
 * Input is a Custom Elements Manifest `custom-element` declaration (schema 2.1.0, the WE
 * `custom-elements-manifest` protocol derived by scripts/gen-cem.mjs): `tagName` +
 * `attributes` + `members` (kind:'field' = reactive properties) + `events` + `slots`.
 *
 * CONSUME MODE (per #811's ruling): the wrapper *renders the existing custom element* and
 * forwards props → attributes/properties and wires events. It does NOT reimplement the
 * component — full idiomatic native source is the separate, deferred author mode (#818).
 * Precedent: Lit-Labs `gen-wrapper-*` / Stencil output-targets / `@lit/react`.
 *
 * "Flag, don't fake": a declaration that is not a custom element (no `tagName`) has no tag
 * to wrap — the generator throws rather than fabricate one.
 */

export const TARGETS = ['react', 'vue'];

// ── name helpers ───────────────────────────────────────────────────────────────────────
const pascal = (s) =>
  String(s)
    .replace(/(^|[-_\s]+)([a-zA-Z0-9])/g, (_, __, c) => c.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, '');
const camel = (s) => {
  const p = pascal(s);
  return p.charAt(0).toLowerCase() + p.slice(1);
};
/** DOM event name → React-style handler prop, e.g. `change` → `onChange`. */
const eventHandlerName = (name) => 'on' + pascal(name);

// ── CEM declaration projections ──────────────────────────────────────────────────────────
/** Reactive properties = public field members (CEM `members` with kind 'field'). */
const propertyMembers = (decl) =>
  (decl.members || []).filter((m) => m.kind === 'field' && m.privacy !== 'private' && m.static !== true);
const attributesOf = (decl) => decl.attributes || [];
const eventsOf = (decl) => decl.events || [];
const slotsOf = (decl) => decl.slots || [];
/** Property name an attribute reflects to (CEM `fieldName`), used to avoid double-emitting. */
const attrFieldName = (a) => a.fieldName || camel(a.name);

function assertCustomElement(decl) {
  if (!decl || !decl.customElement || !decl.tagName) {
    throw new Error(
      `genWrapper: declaration "${decl?.name ?? '?'}" is not a custom-element declaration ` +
        `(needs customElement:true + tagName). Consume mode wraps an existing tag — nothing to wrap. ` +
        `(flag, don't fake)`,
    );
  }
}

/** CEM type ({ text }) → a TS type annotation string. */
const tsType = (type) => (type && type.text ? type.text : 'unknown');

/** CEM type text → a Vue runtime prop constructor (best-effort; defaults to String). */
const vuePropCtor = (type) => {
  const t = (type && type.text ? type.text : '').toLowerCase();
  if (/boolean/.test(t)) return 'Boolean';
  if (/number/.test(t)) return 'Number';
  if (/\[\]|array/.test(t)) return 'Array';
  if (/object|record|\{/.test(t)) return 'Object';
  return 'String';
};

// ── React emitter ────────────────────────────────────────────────────────────────────────
function reactWrapper(decl) {
  const tag = decl.tagName;
  const comp = pascal(decl.name);
  const attrs = attributesOf(decl);
  // Properties not already covered by a reflected attribute (avoid emitting both).
  const attrFields = new Set(attrs.map(attrFieldName));
  const props = propertyMembers(decl).filter((m) => !attrFields.has(m.name));
  const evs = eventsOf(decl);

  const propTypeLines = [
    ...attrs.map((a) => `  /** attribute */ ${attrFieldName(a)}?: ${tsType(a.type)};`),
    ...props.map((p) => `  /** property */ ${camel(p.name)}?: ${tsType(p.type)};`),
    ...evs.map((e) => `  ${eventHandlerName(e.name)}?: (event: ${e.type?.text || 'Event'}) => void;`),
    '  children?: React.ReactNode;',
  ];

  const destructure = [
    ...attrs.map((a) => attrFieldName(a)),
    ...props.map((p) => camel(p.name)),
    ...evs.map((e) => eventHandlerName(e.name)),
    'children',
  ].join(', ');

  // Reactive properties: assigned on the element instance, never serialized to attributes.
  const propEffects = props
    .map(
      (p) =>
        `    if (${camel(p.name)} !== undefined) (el as unknown as Record<string, unknown>).${p.name} = ${camel(p.name)};`,
    )
    .join('\n');

  // Events: bridge DOM events to React-style handler props.
  const eventEffects = evs
    .map(
      (e) => `    if (${eventHandlerName(e.name)}) {
      const h = (event: Event) => ${eventHandlerName(e.name)}!(event as ${e.type?.text || 'Event'});
      el.addEventListener('${e.name}', h);
      cleanups.push(() => el.removeEventListener('${e.name}', h));
    }`,
    )
    .join('\n');

  // Attributes render inline on the element.
  const attrProps = attrs.map((a) => `${attrFieldName(a)}`).join(', ');

  return `import React, { useEffect, useRef } from 'react';

export interface ${comp}Props {
${propTypeLines.join('\n')}
}

/**
 * Consume-mode React wrapper for <${tag}> — GENERATED from its CEM by #821 (do not edit).
 * Renders the existing custom element and forwards props/events; it does not reimplement it.
 */
export function ${comp}({ ${destructure} }: ${comp}Props) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const cleanups: Array<() => void> = [];
${propEffects ? propEffects + '\n' : ''}${eventEffects ? eventEffects + '\n' : ''}    return () => cleanups.forEach((c) => c());
  });

  return React.createElement('${tag}', { ref${attrProps ? ', ' + attrProps : ''} }, children);
}

export default ${comp};
`;
}

// ── Vue emitter ──────────────────────────────────────────────────────────────────────────
function vueWrapper(decl) {
  const tag = decl.tagName;
  const comp = pascal(decl.name);
  const attrs = attributesOf(decl);
  const attrFields = new Set(attrs.map(attrFieldName));
  const props = propertyMembers(decl).filter((m) => !attrFields.has(m.name));
  const evs = eventsOf(decl);

  const propDefs = [
    ...attrs.map((a) => `    ${attrFieldName(a)}: { type: ${vuePropCtor(a.type)}, required: false },`),
    ...props.map((p) => `    ${camel(p.name)}: { type: ${vuePropCtor(p.type)}, required: false },`),
  ].join('\n');

  const emits = evs.map((e) => `'${e.name}'`).join(', ');

  // Attributes are passed as plain bindings; properties via `.prop` to set the DOM property;
  // events via `onXxx` listeners that re-emit through Vue's emit.
  const renderBindings = [
    ...attrs.map((a) => `        '${a.name}': props.${attrFieldName(a)},`),
    ...props.map((p) => `        '.${p.name}': props.${camel(p.name)},`),
    ...evs.map((e) => `        '${eventHandlerName(e.name)}': (event: Event) => emit('${e.name}', event),`),
  ].join('\n');

  return `import { defineComponent, h } from 'vue';

/**
 * Consume-mode Vue wrapper for <${tag}> — GENERATED from its CEM by #821 (do not edit).
 * Renders the existing custom element and forwards props/events; it does not reimplement it.
 */
export default defineComponent({
  name: '${comp}',
  props: {
${propDefs}
  },
  emits: [${emits}],
  setup(props, { slots, emit }) {
    return () =>
      h(
        '${tag}',
        {
${renderBindings}
        },
        slots.default ? slots.default() : undefined,
      );
  },
});
`;
}

const EMITTERS = { react: reactWrapper, vue: vueWrapper };

/** File extension for a target's wrapper source. */
export const wrapperExtension = (target) => (target === 'vue' ? 'ts' : 'tsx');

/**
 * Generate consume-mode wrapper source for one CEM custom-element declaration + target.
 * @param {object} declaration A CEM `custom-element` declaration (customElement:true + tagName).
 * @param {('react'|'vue')} target
 * @returns {string} wrapper source
 */
export function generateWrapper(declaration, target) {
  assertCustomElement(declaration);
  const emit = EMITTERS[target];
  if (!emit) throw new Error(`genWrapper: unknown target "${target}" (supported: ${TARGETS.join(', ')})`);
  return emit(declaration);
}

/**
 * Pull the custom-element declarations out of a CEM manifest ({ modules: [...] }).
 * @returns {Array<{ declaration: object, module: string }>}
 */
export function customElementDeclarations(manifest) {
  const out = [];
  for (const mod of manifest?.modules || []) {
    for (const decl of mod.declarations || []) {
      if (decl.customElement && decl.tagName) out.push({ declaration: decl, module: mod.path });
    }
  }
  return out;
}
