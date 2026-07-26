// Regression guard for guard-backward-edge.mjs — the PreToolUse(Edit|Write) hook that DENIES a static
// Frontier UI import in WE package source (the banned WE→FUI backward module edge, #6/#30/#932/#1282).
//
// Two layers: the PURE detector (hasBackwardEdge) pins what counts as a static edge vs an allowed runtime
// / commented / URL reference; the SPAWN cases pin the wiring — scope (src/ yes, demos/ no) and the
// deny-via-exit-2 protocol the hook contract depends on.

import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { hasBackwardEdge } from '../guard-backward-edge.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const HOOK = resolve(here, '../guard-backward-edge.mjs');

/** Spawn the hook with a synthetic PreToolUse event; return the exit code. */
function runHook(tool_name, file_path, extra = {}) {
  const ev = { tool_name, tool_input: { file_path, ...extra } };
  return spawnSync('node', [HOOK], { input: JSON.stringify(ev), encoding: 'utf8' }).status;
}

describe('hasBackwardEdge — pure detector', () => {
  it('DENIES real static edges', () => {
    expect(hasBackwardEdge(`import Foo from '@frontierui/embed';`)).toBe(true);
    expect(hasBackwardEdge(`import { c } from "@frontierui/embed/chrome";`)).toBe(true);
    expect(hasBackwardEdge(`import x from 'frontierui';`)).toBe(true);
    expect(hasBackwardEdge(`export { X } from '@frontierui/core';`)).toBe(true);
    expect(hasBackwardEdge(`const f = require('@frontierui/embed');`)).toBe(true);
    expect(hasBackwardEdge(`const m = await import('@frontierui/embed');`)).toBe(true);
    // multiline import — `from` on its own line
    expect(hasBackwardEdge(`import {\n  a,\n  b,\n} from '@frontierui/x';`)).toBe(true);
  });

  it('ALLOWS runtime / documentary / lookalike references', () => {
    // cross-origin dynamic import (mode-C runtime edge) — allowed
    expect(hasBackwardEdge(`const m = await import('https://frontierui.dev/embed.js');`)).toBe(false);
    expect(hasBackwardEdge(`const url = "https://frontierui.dev";`)).toBe(false);
    // the real chrome.js JSDoc + backlog.js locus regex literal (must never false-positive)
    expect(hasBackwardEdge(` * hands to the FUI chrome module (\`@frontierui/embed/chrome-in-document\`).`)).toBe(false);
    expect(hasBackwardEdge(`  [/frontier-?ui/i, 'frontierui'],`)).toBe(false);
    // commented-out import
    expect(hasBackwardEdge(`// do not import from '@frontierui/embed'`)).toBe(false);
    expect(hasBackwardEdge(`/* import x from '@frontierui/y'; */`)).toBe(false);
    // .import( method call, not a dynamic import
    expect(hasBackwardEdge(`const x = obj.import('@frontierui/x');`)).toBe(false);
    // similar-but-different package names
    expect(hasBackwardEdge(`import x from 'frontieruix';`)).toBe(false);
    expect(hasBackwardEdge(`import x from '@frontierui-legacy/x';`)).toBe(false);
  });
});

describe('guard-backward-edge.mjs — wiring (deny via exit 2)', () => {
  it('DENIES a static FUI import written into src/', () => {
    expect(runHook('Write', '/ws/lane-1/src/foo.ts', { content: `import x from '@frontierui/embed';` })).toBe(2);
  });
  it('DENIES an Edit that INTRODUCES a FUI import into a src file', () => {
    // old_string absent on disk → hook scans new_string (fail-safe path)
    expect(runHook('Edit', '/ws/lane-1/src/foo.ts',
      { old_string: 'export const y = 1;', new_string: `import x from '@frontierui/embed';` })).toBe(2);
  });
  it('ALLOWS a FUI import in demos/ (runtime pages, out of scope)', () => {
    expect(runHook('Write', '/ws/lane-1/demos/bar.ts', { content: `import x from '@frontierui/embed';` })).toBe(0);
  });
  it('ALLOWS a cross-origin dynamic import in src/', () => {
    expect(runHook('Write', '/ws/lane-1/src/foo.ts',
      { content: `const m = await import('https://frontierui.dev/embed.js');` })).toBe(0);
  });
  it('ALLOWS a non-src path', () => {
    expect(runHook('Write', '/ws/lane-1/scripts/x.mjs', { content: `import x from '@frontierui/embed';` })).toBe(0);
  });
});
