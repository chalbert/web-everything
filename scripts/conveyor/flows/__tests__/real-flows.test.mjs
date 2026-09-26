// The CI gate for the conveyor flow descriptions (#4075 step 1): the real flows must parse, cover every
// named lifecycle, cite real code, and carry NO unacknowledged gap. A new gap is either fixed in the code
// (and the flow updated) or filed as a card and acknowledged with `ack: { <rule>: <card> }`.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadFlows, checkFlows, FLOWS_DIR, resolveBornAsCite } from '../flow-model.mjs';

const REPO = resolve(FLOWS_DIR, '../../..');
const BACKLOG_DIR = join(REPO, 'backlog');
const flows = loadFlows();

// Injected FS facts for resolveBornAsCite (#4075 — a JIT-renamed card's stale hash-name cite must still
// resolve via bornAs, not just fail as a dangling reference; see xmd4pfa).
const citeExists = (relPath) => existsSync(join(REPO, relPath));
const listBacklogFiles = () => readdirSync(BACKLOG_DIR);
const readBacklogFile = (name) => readFileSync(join(BACKLOG_DIR, name), 'utf8');

const EXPECTED = [
  'build-dispatch', 'ci-heal', 'conflict', 'daemon-rebuild', 'drain-land', 'fix', 'lane-lifecycle', 'review', 'session-cleanup',
];

/** Every `cite` string anywhere in a flow. */
function cites(node, out = []) {
  if (Array.isArray(node)) node.forEach((n) => cites(n, out));
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if ((k === 'cite' || k === 'ownerCite') && typeof v === 'string') out.push(v);
      else cites(v, out);
    }
  }
  return out;
}

describe('real conveyor flows', () => {
  it('covers every named lifecycle, one file per flow id', () => {
    expect(flows.map((f) => f.id)).toEqual(EXPECTED);
    for (const f of flows) expect(f._file).toBe(`${f.id}.flow.json`);
  });

  it('has no unacknowledged gap (fix it in code, or file a card and ack it)', () => {
    const open = checkFlows(flows).filter((f) => !f.acknowledged);
    expect(open.map((f) => `${f.flow} · ${f.rule} · ${f.where} — ${f.message}`)).toEqual([]);
  });

  it('every WE-repo cite names an existing file and a line inside it', () => {
    const bad = [];
    for (const f of flows) {
      for (const c of cites(f)) {
        for (const m of c.matchAll(/(?:^|[\s,;(])((?:scripts|skills-src|docs|backlog)\/[\w./-]+?):(\d+)/g)) {
          let [, path, line] = m;
          // A backlog/ cite may name a card by a hash the drain's JIT numbering has since renamed away
          // (#4075/xmd4pfa) — resolve it through the target's own `bornAs` frontmatter before declaring it
          // dangling, the same way a human would look the card up by its birth hash.
          path = resolveBornAsCite(path, { exists: citeExists, listBacklogFiles, readBacklogFile });
          const abs = join(REPO, path);
          if (!existsSync(abs)) { bad.push(`${f.id}: ${path} does not exist`); continue; }
          const n = readFileSync(abs, 'utf8').split('\n').length;
          if (Number(line) > n) bad.push(`${f.id}: ${path}:${line} is past the end (${n} lines)`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});
