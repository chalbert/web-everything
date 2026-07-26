// Regression guard for guard-backward-edge.mjs — the PreToolUse(Edit|Write) hook that DENIES a static
// Frontier UI import in WE package source (the banned WE→FUI backward module edge, #6/#30/#932/#1282).
//
// Three layers: the PURE detector (hasBackwardEdge) pins what counts as a static edge vs an allowed runtime
// / commented / URL reference; the SCOPE gate (isWeSource / repoNameFor) pins that only WE's OWN src/ is in
// scope, keyed on repo identity not the bare /src/ segment (#2673); the SPAWN cases pin the end-to-end wiring
// — the deny-via-exit-2 protocol the hook contract depends on — against real repo-rooted fixtures.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { dirname, resolve, join } from 'node:path';
import { hasBackwardEdge, isWeSource, repoNameFor } from '../guard-backward-edge.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const HOOK = resolve(here, '../guard-backward-edge.mjs');

// Real repo-rooted fixtures so repoNameFor's package.json walk-up resolves (#2673). The target files
// themselves need not exist — only the repo-root package.json above them does.
let weRoot, plateauRoot;
beforeAll(() => {
  weRoot = mkdtempSync(join(tmpdir(), 'gbe-we-'));
  writeFileSync(join(weRoot, 'package.json'), JSON.stringify({ name: 'web-everything' }));
  plateauRoot = mkdtempSync(join(tmpdir(), 'gbe-pa-'));
  writeFileSync(join(plateauRoot, 'package.json'), JSON.stringify({ name: 'plateau-app' }));
});
afterAll(() => {
  rmSync(weRoot, { recursive: true, force: true });
  rmSync(plateauRoot, { recursive: true, force: true });
});

/** Spawn the hook with a synthetic PreToolUse event; return the exit code. */
function runHook(tool_name, file_path, extra = {}) {
  const ev = { tool_name, tool_input: { file_path, ...extra } };
  return spawnSync('node', [HOOK], { input: JSON.stringify(ev), encoding: 'utf8' }).status;
}

describe('hasBackwardEdge — pure detector', () => {
  it('DENIES real static edges (all import shapes)', () => {
    expect(hasBackwardEdge(`import Foo from '@frontierui/embed';`)).toBe(true);
    expect(hasBackwardEdge(`import { c } from "@frontierui/embed/chrome";`)).toBe(true);
    expect(hasBackwardEdge(`import * as F from '@frontierui/x';`)).toBe(true);
    expect(hasBackwardEdge(`import x from 'frontierui';`)).toBe(true);
    expect(hasBackwardEdge(`export { X } from '@frontierui/core';`)).toBe(true);
    expect(hasBackwardEdge(`const f = require('@frontierui/embed');`)).toBe(true);
    expect(hasBackwardEdge(`const m = await import('@frontierui/embed');`)).toBe(true);
    // multiline import — `from` on its own line
    expect(hasBackwardEdge(`import {\n  a,\n  b,\n} from '@frontierui/x';`)).toBe(true);
    // F1 regression — a bare SIDE-EFFECT import (no `from`, no parens) is still a static edge
    expect(hasBackwardEdge(`import '@frontierui/embed';`)).toBe(true);
    expect(hasBackwardEdge(`import '@frontierui';`)).toBe(true);
  });

  it('ALLOWS runtime / documentary / string-literal / lookalike references', () => {
    // cross-origin dynamic import (mode-C runtime edge) — allowed
    expect(hasBackwardEdge(`const m = await import('https://frontierui.dev/embed.js');`)).toBe(false);
    expect(hasBackwardEdge(`const url = "https://frontierui.dev";`)).toBe(false);
    // F2 regression — a specifier inside a STRING LITERAL must never false-DENY (statement-anchored match)
    expect(hasBackwardEdge(`const s = "import x from '@frontierui/y'";`)).toBe(false);
    expect(hasBackwardEdge(`const s = '@frontierui/x';`)).toBe(false);
    // a non-FUI local side-effect import next to a frontierui string must not trip
    expect(hasBackwardEdge(`import './styles.css';\nconst y = '@frontierui';`)).toBe(false);
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

  it('isWeSource — WE src yes, demos no, and a SIBLING repo src no (F3 / #2673)', () => {
    // repoName injected → hermetic, no fs walk. WE's own src/ is in scope.
    expect(isWeSource('/ws/lane-1/src/foo.ts', 'web-everything')).toBe(true);
    expect(isWeSource('/ws/lane-1/src/_data/backlog.js', 'web-everything')).toBe(true);
    // #2673 — WE's in-repo sub-packages (@webeverything/*) are WE source too.
    expect(isWeSource('/ws/lane-1/packages/webcases/src/x.ts', '@webeverything/webcases')).toBe(true);
    expect(isWeSource('/ws/lane-1/demos/foo/src/x.ts', 'web-everything')).toBe(false); // nested demos/**/src
    expect(isWeSource('/ws/lane-1/demos/bar.ts', 'web-everything')).toBe(false);
    expect(isWeSource('/ws/lane-1/scripts/x.mjs', 'web-everything')).toBe(false);
    // #2673 — a sibling repo's src/ shares the /src/ segment but is NOT WE source (forward edge, allowed).
    expect(isWeSource('/ws/plateau-app/src/foo.ts', 'plateau-app')).toBe(false);
    expect(isWeSource('/ws/frontierui/src/foo.ts', 'frontierui')).toBe(false);
    // no package.json found above the file → null repo → not WE source (fail-open, never wedges the agent).
    expect(isWeSource('/ws/orphan/src/foo.ts', null)).toBe(false);
  });

  it('repoNameFor — resolves the nearest package.json name via walk-up (#2673)', () => {
    expect(repoNameFor(join(weRoot, 'src/foo.ts'))).toBe('web-everything');
    expect(repoNameFor(join(weRoot, 'src/deep/nested/x.ts'))).toBe('web-everything');
    expect(repoNameFor(join(plateauRoot, 'src/foo.ts'))).toBe('plateau-app');
  });
});

describe('guard-backward-edge.mjs — wiring (deny via exit 2, repo-scoped #2673)', () => {
  it('DENIES a static FUI import written into WE src/', () => {
    expect(runHook('Write', join(weRoot, 'src/foo.ts'), { content: `import x from '@frontierui/embed';` })).toBe(2);
  });
  it('DENIES an Edit that INTRODUCES a FUI import into a WE src file', () => {
    // old_string absent on disk → hook scans new_string (fail-safe path)
    expect(runHook('Edit', join(weRoot, 'src/foo.ts'),
      { old_string: 'export const y = 1;', new_string: `import x from '@frontierui/embed';` })).toBe(2);
  });
  it('ALLOWS a FUI import in a plateau-app src/ file — a forward edge, not WE source (#2673)', () => {
    // The core regression: a WE-rooted agent editing plateau-app:src/** that dogfoods FUI must NOT be denied.
    expect(runHook('Write', join(plateauRoot, 'src/foo.ts'), { content: `import x from '@frontierui/embed';` })).toBe(0);
  });
  it('ALLOWS a FUI import in WE demos/ (runtime pages, out of scope)', () => {
    expect(runHook('Write', join(weRoot, 'demos/bar.ts'), { content: `import x from '@frontierui/embed';` })).toBe(0);
  });
  it('ALLOWS a cross-origin dynamic import in WE src/', () => {
    expect(runHook('Write', join(weRoot, 'src/foo.ts'),
      { content: `const m = await import('https://frontierui.dev/embed.js');` })).toBe(0);
  });
  it('DENIES a bare side-effect import written into WE src/ (F1)', () => {
    expect(runHook('Write', join(weRoot, 'src/foo.ts'), { content: `import '@frontierui/embed';` })).toBe(2);
  });
  it('ALLOWS a FUI import in a nested WE demos/**/src subtree (F3)', () => {
    expect(runHook('Write', join(weRoot, 'demos/app/src/x.ts'), { content: `import x from '@frontierui/embed';` })).toBe(0);
  });
  it('ALLOWS a non-src path', () => {
    expect(runHook('Write', join(weRoot, 'scripts/x.mjs'), { content: `import x from '@frontierui/embed';` })).toBe(0);
  });
  it('ALLOWS a src path with no package.json above it (fail-open, never wedges)', () => {
    expect(runHook('Write', '/nonexistent-orphan-xyz/src/foo.ts', { content: `import x from '@frontierui/embed';` })).toBe(0);
  });
});
