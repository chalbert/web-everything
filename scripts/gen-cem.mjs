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

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'src/_data');
const OUT = join(ROOT, 'custom-elements.json');
const SCHEMA_VERSION = '2.1.0';

const blocks = JSON.parse(readFileSync(join(DATA, 'blocks.json'), 'utf8'));

/** Map a block's `events` array to CEM event descriptors. */
const cemEvents = (events) =>
  (events || []).map((e) => ({
    name: e.name,
    type: { text: e.class || 'CustomEvent' },
    ...(e.description ? { description: e.description } : {}),
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
    ...(b.events && b.events.length ? { events: cemEvents(b.events) } : {}),
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
