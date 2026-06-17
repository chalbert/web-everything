/**
 * ingestComponent.mjs — the reverse/ingest half of the polyglot adapter story (#851).
 *
 * The forward direction generates framework wrappers FROM the neutral contract
 * (scripts/gen-wrapper, #821: CEM → React/Vue). gen-cem (#653) projects WE's own
 * blocks.json → CEM. This is the missing INGEST direction (#463 adapter-as-normalization-hub):
 * take an INCUMBENT component (e.g. a MUI button), parse its public API surface
 * (props / events / slots), normalize it bottom-up into WE's neutral CEM-shaped contract
 * — the lossy internal pivot the project never sees — then re-emit it as a WE block
 * (the blocks.json protocol shape gen-cem reads). The substrate #753 criterion 3
 * round-trips through.
 *
 * THREE pure stages, composable and independently testable:
 *   parseIncumbent(source, opts)  → { name, props[], events[], slots[], dropped[] }   (TS-AST)
 *   normalizeToCem(surface, opts) → a CEM `custom-element` declaration (the neutral pivot)
 *   emitWeBlock(cem, opts)        → a blocks.json-shaped WE block entry (project-facing)
 *   ingest(source, opts)          → { surface, cem, block } (the whole chain)
 *
 * Lossiness IS the value (the normalization-hub direction): React-isms with no neutral
 * meaning — render props, `sx`/`className`/`style` escape hatches, complex generics — are
 * dropped, each recorded in `surface.dropped[]` with a reason, never faked ("flag, don't
 * fake"). We parse the API *surface* (the props type), never the render body — the same
 * posture as react-docgen / vue-docgen / the CEM analyzer.
 */
import ts from 'typescript';

// ── name helpers ─────────────────────────────────────────────────────────────────────────
const pascal = (s) =>
  String(s)
    .replace(/(^|[-_\s]+)([a-zA-Z0-9])/g, (_, __, c) => c.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, '');
const camel = (s) => {
  const p = pascal(s);
  return p.charAt(0).toLowerCase() + p.slice(1);
};
const kebab = (s) =>
  String(s)
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase();
/** `onChange` → `change`, `onValueInput` → `value-input` (the DOM CustomEvent name). */
const eventName = (handlerProp) => kebab(handlerProp.replace(/^on/, ''));

// React-specific prop names that carry no neutral (cross-framework) meaning — dropped.
const STYLING_ESCAPE_HATCHES = new Set(['sx', 'classname', 'class', 'style', 'css']);
// Type texts that signal "this prop is projected content" → a slot, not an attribute.
const SLOT_TYPE = /\b(ReactNode|ReactElement|JSX\.Element|ReactChild|ReactChildren)\b/;
const FUNCTION_TYPE = /=>|\bFunction\b/;
// CEM-able primitive attribute types: a keyword or string/number-literal, or a union of them
// (e.g. `string`, `boolean`, `'text' | 'contained' | 'outlined'`). Objects/arrays are property-only.
const PRIM_MEMBER = `(string|number|boolean|'[^']*'|"[^"]*"|-?\\d+(?:\\.\\d+)?)`;
const PRIMITIVE_TYPE = new RegExp(`^${PRIM_MEMBER}(\\s*\\|\\s*${PRIM_MEMBER})*$`, 'i');

// ── stage 1: parse the incumbent API surface (TS AST over the props type) ──────────────────
/**
 * Parse a pasted incumbent component's source and extract its public API surface. We locate
 * the props type by convention (`interface <X>Props` / `type <X>Props = …`, the dominant
 * React idiom MUI and friends follow) and read its property signatures. Render bodies, hooks
 * and HOCs are irrelevant to the contract and ignored.
 *
 * @param {string} source  component source (TSX/TS).
 * @param {{ componentName?: string }} [opts]
 * @returns {{ name, props, events, slots, dropped }}
 */
export function parseIncumbent(source, opts = {}) {
  if (typeof source !== 'string' || !source.trim()) {
    throw new Error('parseIncumbent: empty source — nothing to ingest (flag, don\'t fake)');
  }
  const sf = ts.createSourceFile('incumbent.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  // Collect every props-shaped type declaration, keyed by its bare name (sans "Props").
  const propsTypes = new Map(); // baseName → ts.TypeLiteral|InterfaceDeclaration members
  ts.forEachChild(sf, function visit(node) {
    if (ts.isInterfaceDeclaration(node) && /Props$/.test(node.name.text)) {
      propsTypes.set(node.name.text.replace(/Props$/, ''), node.members);
    } else if (
      ts.isTypeAliasDeclaration(node) &&
      /Props$/.test(node.name.text) &&
      ts.isTypeLiteralNode(node.type)
    ) {
      propsTypes.set(node.name.text.replace(/Props$/, ''), node.type.members);
    }
    ts.forEachChild(node, visit);
  });

  if (propsTypes.size === 0) {
    throw new Error(
      'parseIncumbent: no `interface XxxProps` / `type XxxProps = {…}` found — ingest parses the ' +
        'declared API surface (props type), not the render body. Provide the component\'s props type. ' +
        '(flag, don\'t fake)',
    );
  }

  // Pick the requested component, else the first declared props type.
  const name = opts.componentName || [...propsTypes.keys()][0];
  const members = propsTypes.get(name) || [...propsTypes.values()][0];

  const props = [];
  const events = [];
  const slots = [];
  const dropped = [];

  for (const m of members) {
    if (!ts.isPropertySignature(m) || !m.name) continue;
    const propName = m.name.getText(sf);
    const optional = !!m.questionToken;
    const typeText = m.type ? m.type.getText(sf).replace(/\s+/g, ' ').trim() : 'unknown';
    const lname = propName.toLowerCase();

    if (STYLING_ESCAPE_HATCHES.has(lname)) {
      dropped.push({ name: propName, reason: 'framework styling escape-hatch (no neutral meaning)' });
      continue;
    }
    // Function-typed props resolve first (a render prop returns ReactNode but is NOT a slot):
    if (FUNCTION_TYPE.test(typeText)) {
      if (/^on[A-Z]/.test(propName)) {
        events.push({ name: eventName(propName), source: propName, type: typeText }); // DOM event
      } else {
        dropped.push({ name: propName, reason: 'render-prop / non-handler callback (not a DOM event)' });
      }
      continue;
    }
    // Slot: children, or any non-function prop typed as projected React content.
    if (propName === 'children' || SLOT_TYPE.test(typeText)) {
      slots.push({ name: propName === 'children' ? '' : kebab(propName), source: propName });
      continue;
    }
    // Otherwise a data prop → attribute (if primitive) + property.
    props.push({ name: propName, optional, type: typeText, primitive: PRIMITIVE_TYPE.test(typeText) });
  }

  return { name, props, events, slots, dropped };
}

// ── stage 2: normalize the surface → the neutral CEM declaration (the lossy pivot) ─────────
/**
 * @param {{name,props,events,slots}} surface  from parseIncumbent.
 * @param {{ tagPrefix?: string }} [opts]  custom-element tag prefix (default 'we').
 * @returns CEM `custom-element` declaration (schema 2.1.0) — the same shape genWrapper consumes.
 */
export function normalizeToCem(surface, opts = {}) {
  const prefix = (opts.tagPrefix || 'we').replace(/-+$/, '');
  const tagName = `${prefix}-${kebab(surface.name)}`;

  const attributes = surface.props
    .filter((p) => p.primitive)
    .map((p) => ({ name: kebab(p.name), fieldName: camel(p.name), type: { text: p.type } }));

  // Every data prop is also a reactive property (CEM field member); non-primitive props are
  // property-only (no attribute can carry an object/array).
  const members = surface.props.map((p) => ({
    kind: 'field',
    name: camel(p.name),
    privacy: 'public',
    type: { text: p.type },
  }));

  const events = surface.events.map((e) => ({ name: e.name, type: { text: 'CustomEvent' } }));
  const slots = surface.slots.map((s) => ({ name: s.name }));

  return {
    kind: 'class',
    name: pascal(surface.name),
    customElement: true,
    tagName,
    ...(attributes.length ? { attributes } : {}),
    ...(members.length ? { members } : {}),
    ...(events.length ? { events } : {}),
    ...(slots.length ? { slots } : {}),
  };
}

// ── stage 3: re-emit the neutral pivot as a project-facing WE block (blocks.json shape) ────
/**
 * @param {object} cem  a CEM custom-element declaration (from normalizeToCem).
 * @param {{ source?: string }} [opts]  provenance label for the incumbent (e.g. 'MUI Button').
 * @returns a blocks.json-shaped WE block protocol entry (gen-cem's input shape).
 */
export function emitWeBlock(cem, opts = {}) {
  if (!cem || !cem.customElement || !cem.tagName) {
    throw new Error('emitWeBlock: not a custom-element CEM declaration (needs customElement + tagName)');
  }
  const id = cem.tagName.replace(/^[a-z]+-/, '');
  const block = {
    id,
    name: cem.name,
    status: 'draft',
    type: 'Component',
    tagName: cem.tagName,
    summary: `Ingested from ${opts.source || 'an incumbent component'} via the #851 ingest adapter — ` +
      `normalized to the neutral CEM contract and re-emitted as a WE block draft. Review before publishing.`,
    ...(cem.attributes ? { attributes: cem.attributes.map((a) => ({ name: a.name, ...(a.fieldName ? { fieldName: a.fieldName } : {}), type: a.type })) } : {}),
    ...(cem.members ? { properties: cem.members.map((m) => ({ name: m.name, type: m.type })) } : {}),
    ...(cem.events ? { events: cem.events.map((e) => ({ name: e.name, class: e.type.text })) } : {}),
    ...(cem.slots ? { slots: cem.slots.map((s) => ({ name: s.name })) } : {}),
    // Provenance: ingest is a DRAFT seed, never an authored standard — keep the source visible.
    'x-ingest': { source: opts.source || 'incumbent', adapter: '#851' },
  };
  return block;
}

/** Convenience: run the whole incumbent → CEM → WE-block chain. */
export function ingest(source, opts = {}) {
  const surface = parseIncumbent(source, opts);
  const cem = normalizeToCem(surface, opts);
  const block = emitWeBlock(cem, opts);
  return { surface, cem, block };
}
