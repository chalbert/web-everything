/**
 * @file scripts/autofix/__tests__/modelFixer.test.mjs
 * @description Proof of the model-backed fixer provider (#196) — the BYO-key fixer for the
 *   content-generation `missing-description` class, gated by the same verify loop as the reference
 *   fixers (#095). Runs against an IN-MEMORY world so the CREATE path (a new `*-descriptions/*.njk`)
 *   and its revert-by-delete are exercised deterministically, with a scripted (no-key) ModelClient.
 */
import { describe, it, expect } from 'vitest';
import { CustomFixerRegistry, autofix } from '../engine.mjs';
import {
  missingDescriptionFixer,
  registerModelFixers,
  createScriptedClient,
  parseDescriptionDraft,
  buildDescriptionPrompt,
  DraftError,
} from '../modelFixer.mjs';

// A Block's spec is its own per-block file whose whole content IS the row (#882) — a single object,
// at src/_data/blocks/<id>.json, not a row in an array.
const BLOCKS = JSON.stringify({ id: 'gauge', name: 'Gauge', summary: 'A radial value gauge.', type: 'Component' });
const DESC_FILE = 'src/_includes/block-descriptions/gauge.njk';
const DATA_FILE = 'src/_data/blocks/gauge.json';

/** In-memory world: the per-block spec present, description file absent. `verify` flags the missing file. */
function makeWorld(extra = {}) {
  const fs = { [DATA_FILE]: BLOCKS, ...extra };
  const read = (file) => {
    if (!(file in fs)) throw new Error(`ENOENT ${file}`);
    return fs[file];
  };
  const write = (file, content) => { fs[file] = content; };
  const exists = (file) => file in fs;
  const remove = (file) => { delete fs[file]; };
  const verify = () => {
    const failures = [];
    if (!(DESC_FILE in fs)) {
      failures.push({
        message: `Block "gauge" has no ${DESC_FILE}`,
        descriptor: { kind: 'missing-description', fix: 'model', entity: 'Block', id: 'gauge', file: DESC_FILE },
      });
    }
    // A NEW-error rule: a description that contains the banned token is rejected by the gate.
    if (fs[DESC_FILE] && fs[DESC_FILE].includes('FORBIDDEN')) {
      failures.push({ message: 'description contains a forbidden token', descriptor: { kind: 'forbidden-token', file: DESC_FILE } });
    }
    return { ok: failures.length === 0, failures };
  };
  return { fs, read, write, exists, remove, verify };
}

describe('parseDescriptionDraft — validate before trusting (#196)', () => {
  it('accepts real markup and ensures a trailing newline', () => {
    expect(parseDescriptionDraft('<h3 id="overview">Overview</h3><p>Hi</p>')).toBe('<h3 id="overview">Overview</h3><p>Hi</p>\n');
  });
  it('strips a wrapping code fence', () => {
    expect(parseDescriptionDraft('```html\n<p>Hi</p>\n```')).toBe('<p>Hi</p>\n');
  });
  it('rejects empty, non-markup, leftover-fence, and prompt-echo drafts', () => {
    expect(() => parseDescriptionDraft('')).toThrow(DraftError);
    expect(() => parseDescriptionDraft('just words, no tags')).toThrow(DraftError);
    expect(() => parseDescriptionDraft('<p>ok</p> ``` leftover')).toThrow(DraftError);
    expect(() => parseDescriptionDraft('Output ONLY an HTML fragment\n<p>x</p>')).toThrow(DraftError);
  });
});

describe('buildDescriptionPrompt — grounded in the entity data (#196)', () => {
  it('includes the entity name + summary so the draft is grounded, not invented', () => {
    const prompt = buildDescriptionPrompt('Block', 'gauge', { name: 'Gauge', summary: 'A radial value gauge.', type: 'Component' });
    expect(prompt).toContain('Gauge');
    expect(prompt).toContain('A radial value gauge.');
    expect(prompt).toContain('gauge');
  });
});

describe('missing-description model fixer — verify-gated CREATE (#196)', () => {
  it('drafts the description, creates the file, and the gate accepts it', async () => {
    const world = makeWorld();
    const client = createScriptedClient(() => '<h3 id="overview">Overview</h3><p>A radial value gauge.</p>');
    const registry = registerModelFixers(new CustomFixerRegistry(), client);

    const result = await autofix({ verify: world.verify, read: world.read, write: world.write, exists: world.exists, remove: world.remove, registry });

    expect(result.ok).toBe(true);
    expect(result.applied).toHaveLength(1);
    expect(result.applied[0].fixerId).toBe('model:scripted:missing-description');
    expect(result.applied[0].before).toBe(''); // a CREATE — nothing existed before
    expect(world.fs[DESC_FILE]).toContain('<h3 id="overview">');
  });

  it('reverts by DELETION when the gate rejects the draft (introduces a new error)', async () => {
    const world = makeWorld();
    const client = createScriptedClient(() => '<p>FORBIDDEN</p>'); // trips the new-error rule
    const registry = registerModelFixers(new CustomFixerRegistry(), client);

    const result = await autofix({ verify: world.verify, read: world.read, write: world.write, exists: world.exists, remove: world.remove, registry });

    expect(result.ok).toBe(false);
    expect(result.applied).toHaveLength(0);
    expect(result.gaveUp).toHaveLength(1);
    // The rejected creation left NO trace — the file was deleted, not blanked.
    expect(DESC_FILE in world.fs).toBe(false);
  });

  it('gives up safely (no patch) when the model draft fails validation', async () => {
    const world = makeWorld();
    const client = createScriptedClient(() => ''); // empty → DraftError → null patch
    const registry = registerModelFixers(new CustomFixerRegistry(), client);

    const result = await autofix({ verify: world.verify, read: world.read, write: world.write, exists: world.exists, remove: world.remove, registry });

    expect(result.applied).toHaveLength(0);
    expect(result.gaveUp).toHaveLength(1);
    expect(result.gaveUp[0].reason).toMatch(/no patch/);
    expect(DESC_FILE in world.fs).toBe(false);
  });

  it('only handles the missing-description class — leaves other classes to other fixers', () => {
    const fixer = missingDescriptionFixer(createScriptedClient(() => '<p>x</p>'));
    expect(fixer.handles({ descriptor: { kind: 'missing-description' } })).toBe(true);
    expect(fixer.handles({ descriptor: { kind: 'deprecated-status' } })).toBe(false);
  });
});
