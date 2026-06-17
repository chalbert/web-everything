#!/usr/bin/env node
/**
 * gen-cem.mjs — emit a Custom Elements Manifest (custom-elements.json, schema 2.1.0)
 * from the WE block protocols in src/_data/blocks.json.
 *
 * #653 (ratified by #626 Fork 1): WE adopts CEM as a `protocol` — the machine-readable
 * structural contract a block's `blocks.json` entry already carries (events / exports,
 * paired with implementsIntent / traits / webStandards), now projected into the de-facto
 * multi-vendor manifest consumed by api-viewer / Storybook / VS Code custom-data /
 * JetBrains web-types. One seam, many consumers (props-table block, the Technical
 * Configurator args panel, autodocs — all downstream, #627).
 *
 * The emit is a *projection* of the block-protocol fields that already exist — it never
 * invents data. A block is emitted as a CEM `custom-element` declaration (customElement:
 * true + tagName) ONLY when the block carries an explicit `tagName` field; otherwise it is
 * a plain `class` declaration (no tag is ever fabricated — `registryName` is a DI registry
 * class name, NOT a custom-element tag). Events and exports map directly; WE-specific fields
 * (implementsIntent, traits, webStandards) are carried under a namespaced `x-webeverything`
 * extension so the core manifest stays spec-valid for external tooling.
 *
 * Output is DERIVED, deterministic data (sorted by block id, no timestamp), so the
 * committed file can't drift and a re-run over unchanged blocks is a no-op diff.
 *
 * Run: `npm run gen:cem`  (writes custom-elements.json at the repo root — the canonical
 * CEM location, discoverable via package.json "customElements").
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { resolvedComponentGroups, componentTokenGroups } from './lib/component-tokens.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'src/_data');
const OUT = join(ROOT, 'custom-elements.json');
const SCHEMA_VERSION = '2.1.0';

const blocks = JSON.parse(readFileSync(join(DATA, 'blocks.json'), 'utf8'));

/** The webtheme component-token tier, resolved once and shared across every block module (#802). */
const tokenGroups = await resolvedComponentGroups();

/**
 * Map a block's `events` to CEM event descriptors. blocks.json carries events in two
 * shapes: an ARRAY of `{ name, class, detail, ... }` and an OBJECT keyed by event name
 * `{ name: { class?, detail, ... } }`. Normalize both to the same CEM event list.
 */
const eventEntries = (events) => {
  if (!events) return [];
  if (Array.isArray(events)) return events.map((e) => [e.name, e]);
  return Object.entries(events);
};
const cemEvents = (events) =>
  eventEntries(events).map(([name, e]) => ({
    name,
    type: { text: e.class || 'CustomEvent' },
    ...(e.description ? { description: e.description } : {}),
  }));

/**
 * Project the block's authored **public-API surface** onto CEM member kinds (#801 Fork-1=B,
 * sharpened to the *public-API* line; #822 structural-surface ruling). A block author authors
 * only the surface they deliberately commit to as public — declarative API
 * (attributes/reflected-or-public properties/slots/cssProperties/cssParts); everything else is
 * assumed private and excluded by default (the #706 opt-in impl-scan adds private members later).
 *
 * Each authored array mirrors the CEM 2.1.0 member shape (no bespoke schema — #654
 * `consumesCemNotBespoke` / #801 I2): a string is sugar for `{ name }`; an object is passed
 * through with only the spec fields kept. Properties become CEM `members` of `kind: 'field'`
 * with `privacy: 'public'`; an attribute-reflected property carries `fieldName`/`reflects` so the
 * props-table can pair it with its attribute.
 */
const asEntries = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val.map((e) => (typeof e === 'string' ? { name: e } : e));
  // object keyed by member name → { name, ...rest }
  return Object.entries(val).map(([name, e]) => ({ name, ...(e && typeof e === 'object' ? e : {}) }));
};

const cemAttributes = (b) =>
  asEntries(b.attributes).map((a) => ({
    name: a.name,
    ...(a.type ? { type: { text: a.type } } : {}),
    ...(a.description ? { description: a.description } : {}),
    ...(a.default !== undefined ? { default: String(a.default) } : {}),
    ...(a.fieldName ? { fieldName: a.fieldName } : {}),
  }));

/** Authored public properties → CEM field members (privacy: public). */
const cemMembers = (b) =>
  asEntries(b.properties).map((p) => ({
    kind: 'field',
    name: p.name,
    privacy: 'public',
    ...(p.type ? { type: { text: p.type } } : {}),
    ...(p.description ? { description: p.description } : {}),
    ...(p.default !== undefined ? { default: String(p.default) } : {}),
    ...(p.reflects ? { reflects: true } : {}),
    ...(p.attribute ? { attribute: p.attribute } : {}),
  }));

const cemSlots = (b) =>
  asEntries(b.slots).map((s) => ({
    name: s.name,
    ...(s.description ? { description: s.description } : {}),
  }));

/** DTCG `$type` → CSS `syntax` for an emitted `@property`-style row (best-effort; omitted when unknown). */
const TYPE_SYNTAX = { dimension: '<length>', color: '<color>', number: '<number>', duration: '<time>' };

/** Authored styling API (the #801 public-API line) → CEM cssProperties. */
const cemAuthoredCssProperties = (b) =>
  asEntries(b.cssProperties).map((c) => ({
    name: c.name,
    ...(c.syntax ? { syntax: c.syntax } : {}),
    ...(c.default !== undefined ? { default: String(c.default) } : {}),
    ...(c.description ? { description: c.description } : {}),
  }));

/**
 * Token-tier cssProperties (#802): project each `componentTokens` group's resolved rows. The emitted
 * `default` is the alias-aware CSS value the component actually uses (`var(--radius-md)`, matching the
 * #403 compile), with the resolved literal carried in the description for external consumers.
 */
const cemTokenCssProperties = (b) =>
  componentTokenGroups(b.componentTokens).flatMap((g) => (tokenGroups[g] || []).map((row) => ({
    name: row.name,
    ...(row.type && TYPE_SYNTAX[row.type] ? { syntax: TYPE_SYNTAX[row.type] } : {}),
    default: row.reference || row.resolved,
    description: row.reference
      ? `Component token aliasing \`${row.reference}\` — resolves to \`${row.resolved}\`.`
      : `Component token — \`${row.resolved}\`.`,
  })));

/**
 * Union the authored styling API with the token-tier rows (#802 amendment: neither side owns
 * `cssProperties`; the build emits the union, a clobber on either is a defect). Authored wins on a
 * name collision (the deliberately-committed contract is authoritative over the derived default).
 */
const cemCssProperties = (b) => {
  const authored = cemAuthoredCssProperties(b);
  const names = new Set(authored.map((r) => r.name));
  return [...authored, ...cemTokenCssProperties(b).filter((r) => !names.has(r.name))];
};

const cemCssParts = (b) =>
  asEntries(b.cssParts).map((p) => ({
    name: p.name,
    ...(p.description ? { description: p.description } : {}),
  }));

/** WE-specific block-protocol fields, namespaced so the core CEM stays spec-valid. */
const weExtension = (b) => {
  const x = {};
  if (b.implementsIntent) x.implementsIntent = b.implementsIntent;
  if (b.composesIntents) x.composesIntents = b.composesIntents;
  if (b.traits) x.traits = b.traits;
  if (b.webStandards) x.webStandards = b.webStandards;
  if (b.type) x.blockType = b.type;
  if (b.status) x.status = b.status;
  return Object.keys(x).length ? { 'x-webeverything': x } : {};
};

/** One CEM module per block, keyed by its `implementedBy` impl path. */
const cemModule = (b) => {
  const path = b.implementedBy || `@frontierui/blocks/${b.id}/index.ts`;
  const declName = (b.exports && b.exports[0]) || b.name.replace(/\s+/g, '');
  const isCustomElement = Boolean(b.tagName);

  const declaration = {
    kind: 'class',
    name: declName,
    ...(b.summary ? { description: b.summary } : {}),
    ...(isCustomElement ? { customElement: true, tagName: b.tagName } : {}),
    ...(cemAttributes(b).length ? { attributes: cemAttributes(b) } : {}),
    ...(cemMembers(b).length ? { members: cemMembers(b) } : {}),
    ...(cemSlots(b).length ? { slots: cemSlots(b) } : {}),
    ...(cemEvents(b.events).length ? { events: cemEvents(b.events) } : {}),
    ...(cemCssProperties(b).length ? { cssProperties: cemCssProperties(b) } : {}),
    ...(cemCssParts(b).length ? { cssParts: cemCssParts(b) } : {}),
    ...weExtension(b),
  };

  const exportsDecl = [
    { kind: 'js', name: declName, declaration: { name: declName, module: path } },
    ...(b.exports || [])
      .filter((name) => name !== declName)
      .map((name) => ({ kind: 'js', name, declaration: { name, module: path } })),
  ];

  return {
    kind: 'javascript-module',
    path,
    declarations: [declaration],
    exports: exportsDecl,
  };
};

const manifest = {
  schemaVersion: SCHEMA_VERSION,
  readme: 'Generated from src/_data/blocks.json by scripts/gen-cem.mjs (WE block protocols → CEM). Do not edit by hand.',
  modules: [...blocks]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(cemModule),
};

writeFileSync(OUT, JSON.stringify(manifest, null, 2) + '\n');
console.log(`✓ gen:cem — wrote custom-elements.json (${manifest.modules.length} block module(s), schema ${SCHEMA_VERSION})`);
