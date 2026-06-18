/**
 * demoBlockers — per-demo dependency/blocker view for the demo detail pages.
 *
 * Reads each demo's `conformance.json` manifest (the standards it commits to using) and resolves every
 * one against the live registry (blocks.json / intents.json): a required standard that is not yet
 * shipping (block not `active`, or intent with no active implementer) is a BLOCKER. This is the same
 * source of truth the `check:app-conformance` benchmark uses, surfaced statically for the docs site so a
 * demo page shows exactly which Web Everything surfaces it still needs built.
 */
const fs = require('fs');
const path = require('path');
const { loadBlocks } = require('../../scripts/lib/blocks-loader.cjs');

const ROOT = path.join(__dirname, '../..');
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

module.exports = () => {
  const blocks = loadBlocks(); // per-block specs src/_data/blocks/<id>.json, assembled (#882)
  const intents = readJson('src/_data/intents.json');
  const byId = (arr, id) => arr.find((x) => x.id === id);

  const resolve = (id) => {
    const b = byId(blocks, id);
    if (b) return { id, kind: 'block', status: b.status, ready: b.status === 'active', href: `/blocks/${id}/` };
    const i = byId(intents, id);
    if (i) {
      // An intent is conformable when an ACTIVE block implements/composes it.
      const via = blocks.find((x) => x.status === 'active' && (x.implementsIntent === id || (x.composesIntents || []).includes(id)));
      return { id, kind: 'intent', status: via ? `active via ${via.id}` : i.status, ready: !!via, href: `/intents/${id}/` };
    }
    return { id, kind: 'unknown', status: 'unknown', ready: false };
  };

  const out = {};
  const demosDir = path.join(ROOT, 'demos');
  for (const name of fs.readdirSync(demosDir)) {
    const cf = path.join(demosDir, name, 'conformance.json');
    if (!fs.existsSync(cf)) continue;
    let m;
    try { m = JSON.parse(fs.readFileSync(cf, 'utf8')); } catch { continue; }
    const requires = (m.standards || []).map((s) => ({ ...resolve(s.id), concept: s.concept }));
    out[m.app || name] = {
      requires,
      blockers: requires.filter((r) => !r.ready),
      candidates: m.candidateStandards || [],
    };
  }
  return out;
};
