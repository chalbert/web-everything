// One-file-per-term assembler (#1146, mirrors the #882 blocks / #1145 intents split). The semantics
// glossary was a single src/_data/semantics.json (194 entries); it now lives one-file-per-term in
// src/_data/semantics/<slug>.json, so two parallel-batch lanes adding different terms touch different
// files and merge clean.
//
// Unlike the id-keyed registries, a glossary entry's natural key is its human `term` ("Viewport
// Presence"), which is not a safe filename — so the on-disk file is named by `termSlug(term)` (a stable,
// collision-free slug across the 194 terms). The slug is just a file handle; the entry still carries its
// real `term`. Sorted by `term` for a deterministic order matching the former array.
//
// CJS so the single implementation is shared by both runtimes: the 11ty data loader (src/_data/semantics.js)
// requires it, and the ESM `.mjs` scripts/tests import it. The term field set (the contract) is unchanged.
const { readdirSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const SEMANTICS_DIR = join(__dirname, '../../src/_data/semantics');

/** Filesystem-safe handle for a glossary term — the per-entry file name (no extension). */
function termSlug(term) {
  return String(term).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Assemble the per-term spec files into the canonical `semantics` array, sorted by term. */
function loadSemantics(dir = SEMANTICS_DIR) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')))
    .sort((a, b) => String(a.term).localeCompare(String(b.term)));
}

module.exports = { loadSemantics, termSlug, SEMANTICS_DIR };
