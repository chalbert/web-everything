// The CI gate for the conveyor flow descriptions (#4075 step 1): the real flows must parse, cover every
// named lifecycle, cite real code, and carry NO unacknowledged gap. A new gap is either fixed in the code
// (and the flow updated) or filed as a card and acknowledged with `ack: { <rule>: <card> }`.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadFlows, checkFlows, FLOWS_DIR } from '../flow-model.mjs';

const REPO = resolve(FLOWS_DIR, '../../..');
const flows = loadFlows();

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
          const [, path, line] = m;
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
