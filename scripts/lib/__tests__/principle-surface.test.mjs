/**
 * @file principle-surface.test.mjs — #2892, the `isPrincipleSurface` composition that enforces #2840
 * (`docs/agent/platform-decisions.md#human-is-principle-surface-not-path`).
 *
 * Three layers: the pure diff/marker grammar in gate-config.mjs; `scoreEscalation`'s human trigger over hand-built
 * diffs; and the REAL call path — a throwaway git repo, `computeNetDiffSignals` running real `git`, and pr-land's
 * `resolveProducerReviewLabel` turning that into the PR-open label.
 *
 * Marker lines in fixtures are spelled with `%` for `@` and converted by `mk()`, so this file never carries a
 * real marker that check:standards would try to validate.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import {
  indexDiffByFile, parseHunks, isStatuteAnchorEdit, isMarkedInvariantEdit, isPrincipleSurface,
  isDeclarativeLeashPath, markerBlockPin, parseMarkedBlocks, isMarkerSourcePath, POLICY_SPEC_BASENAMES, TRUST_CHAIN,
} from '../gate-config.mjs';
import { scoreEscalation, producerReviewLabel, REVIEW_LABELS } from '../review-escalation.mjs';
import { computeNetDiffSignals } from '../../merge-ai-prs.mjs';
import { resolveProducerReviewLabel } from '../../pr-land.mjs';

const mk = (s) => s.replace(/%/g, '@');
const STATUTE = 'docs/agent/platform-decisions.md';

/** One file's section of a unified diff, the shape `git diff` prints. */
function section(path, hunks, { from = path, to = path } = {}) {
  return `diff --git a/${from} b/${to}\n--- a/${from}\n+++ b/${to}\n${hunks}`;
}

describe('indexDiffByFile — one section per file, keyed by plain path', () => {
  it('splits a multi-file diff and keys each section by its path', () => {
    const d = section('a.md', '@@ -1 +1 @@\n-x\n+y\n') + section('b/c.mjs', '@@ -1 +1 @@\n-p\n+q\n');
    const m = indexDiffByFile(d);
    expect([...m.keys()].sort()).toEqual(['a.md', 'b/c.mjs']);
    expect(parseHunks(m.get('a.md'))).toEqual([{ removed: ['x'], added: ['y'] }]);
  });
  it('registers a rename under BOTH sides, and a deletion under its old path', () => {
    const renamed = `diff --git a/docs/old.md b/${STATUTE}\nsimilarity index 90%\nrename from docs/old.md\nrename to ${STATUTE}\n--- a/docs/old.md\n+++ b/${STATUTE}\n@@ -1 +1 @@\n-a\n+b\n`;
    expect([...indexDiffByFile(renamed).keys()].sort()).toEqual(['docs/old.md', STATUTE].sort());
    const deleted = `diff --git a/gone.mjs b/gone.mjs\ndeleted file mode 100644\n--- a/gone.mjs\n+++ /dev/null\n@@ -1 +0,0 @@\n-x\n`;
    expect([...indexDiffByFile(deleted).keys()]).toEqual(['gone.mjs']);
  });
  it('decodes C-quoted paths and drops the TAB git appends to a name containing a space', () => {
    const quoted = 'diff --git "a/caf\\303\\251.md" "b/caf\\303\\251.md"\n--- "a/caf\\303\\251.md"\n+++ "b/caf\\303\\251.md"\n@@ -1 +1 @@\n-a\n+b\n';
    expect([...indexDiffByFile(quoted).keys()]).toEqual(['café.md']);
    const spaced = 'diff --git a/my doc.md b/my doc.md\n--- a/my doc.md\t\n+++ b/my doc.md\t\n@@ -1 +1 @@\n-a\n+b\n';
    expect([...indexDiffByFile(spaced).keys()]).toEqual(['my doc.md']);
  });
  it('a mode-only change (no ---/+++ lines) is still keyed, from the diff --git line itself', () => {
    const modeOnly = `diff --git a/${STATUTE} b/${STATUTE}\nold mode 100644\nnew mode 100755\n`;
    expect([...indexDiffByFile(modeOnly).keys()]).toEqual([STATUTE]);
  });
  it('a removed line that reads `--- x` inside a hunk is content, not a file header', () => {
    const d = section('a.md', '@@ -1,2 +1 @@\n--- not/a/path\n-+++ nor/this\n');
    expect([...indexDiffByFile(d).keys()]).toEqual(['a.md']);
    expect(parseHunks(indexDiffByFile(d).get('a.md'))[0].removed).toEqual(['-- not/a/path', '+++ nor/this']);
  });
  it('is total: non-strings and header-less text yield an empty map, never a throw', () => {
    for (const junk of [null, undefined, '', 42, {}, '@@ -1 +1 @@\n-a\n+b\n']) expect(indexDiffByFile(junk).size).toBe(0);
  });
});

describe('isStatuteAnchorEdit — trigger 1, content-scoped (a reflow no longer fires)', () => {
  const edit = (hunks) => isStatuteAnchorEdit(STATUTE, section(STATUTE, hunks));
  it('is false for any non-statute path, whatever the content', () => {
    expect(isStatuteAnchorEdit('docs/agent/conventions.md', null)).toBe(false);
    expect(isStatuteAnchorEdit('backlog/1-x.md', section('backlog/1-x.md', '@@ -1 +1 @@\n-### A {#a}\n+### B {#a}\n'))).toBe(false);
  });
  it('FAILS CLOSED on unknown content: null / non-string / binary all fire', () => {
    expect(isStatuteAnchorEdit(STATUTE, null)).toBe(true);
    expect(isStatuteAnchorEdit(STATUTE, undefined)).toBe(true);
    expect(isStatuteAnchorEdit(STATUTE, `diff --git a/${STATUTE} b/${STATUTE}\nBinary files a/${STATUTE} and b/${STATUTE} differ\n`)).toBe(true);
  });
  it('does NOT fire on whitespace-only, reflow and blank-line edits', () => {
    expect(edit('@@ -1 +1 @@\n-A rule  that   binds.\n+A rule that binds.\n')).toBe(false);
    expect(edit('@@ -1,2 +1,3 @@\n-A rule that binds every agent\n-and every lane.\n+A rule that\n+binds every agent and\n+every lane.\n')).toBe(false);
    expect(edit('@@ -1,2 +1,3 @@\n+\n')).toBe(false);
    expect(edit('@@ -1 +1 @@\n-###  A rule {#a-rule}  \n+### A rule {#a-rule}\n')).toBe(false);
  });
  it('does NOT fire on a section with no hunks (mode-only / pure rename)', () => {
    expect(isStatuteAnchorEdit(STATUTE, `diff --git a/${STATUTE} b/${STATUTE}\nold mode 100644\nnew mode 100755\n`)).toBe(false);
  });
  it('FIRES on a changed heading, a changed anchor, and an added or removed rule', () => {
    expect(edit('@@ -1 +1 @@\n-### A rule {#a-rule}\n+### A narrower rule {#a-rule}\n')).toBe(true);
    expect(edit('@@ -1 +1 @@\n-### A rule {#a-rule}\n+### A rule {#b-rule}\n')).toBe(true);
    expect(edit('@@ -0,0 +1,3 @@\n+### New rule {#new}\n+\n+It binds.\n')).toBe(true);
    expect(edit('@@ -1,3 +0,0 @@\n-### Old rule {#old}\n-\n-It bound.\n')).toBe(true);
  });
  it('FIRES on any ruling-body text change, typo fixes included (no deterministic read tells them apart)', () => {
    expect(edit('@@ -1 +1 @@\n-An agent MAY clear it.\n+An agent MUST NOT clear it.\n')).toBe(true);
    expect(edit('@@ -1 +1 @@\n-recieve\n+receive\n')).toBe(true);
  });
  it('FIRES when a reflow keeps the words but changes the anchor inventory (a heading folded into prose)', () => {
    expect(edit('@@ -1,2 +1 @@\n-Prose.\n-### A rule {#a-rule}\n+Prose. ### A rule {#a-rule}\n')).toBe(true);
    expect(edit('@@ -1,2 +1 @@\n-see\n-{#a-rule}\n+see {#a-rule}\n')).toBe(false); // same inline anchor, just reflowed
  });
  it('one text-changing hunk among reflow hunks is enough', () => {
    expect(edit('@@ -1 +1 @@\n-a  b\n+a b\n@@ -9 +9 @@\n-may\n+must\n')).toBe(true);
  });
});

describe('marker grammar — pins, structure, source types', () => {
  const block = (pin, body = ['expect(x).toBe(false);']) => [mk(`// %invariant keep-x pin:${pin} — enforces #some-anchor`), ...body, mk('// %end-invariant keep-x')].join('\n');
  it('markerBlockPin is 12 hex chars and whitespace-insensitive, but content-sensitive', () => {
    const p = markerBlockPin(['  expect(x).toBe(false);', '', '\tfoo( 1 )']);
    expect(p).toMatch(/^[0-9a-f]{12}$/);
    expect(markerBlockPin(['expect(x).toBe(false);', 'foo( 1 )'])).toBe(p);
    expect(markerBlockPin(['expect(x).toBe(true);', 'foo( 1 )'])).not.toBe(p);
  });
  it('parses a well-formed block with its body', () => {
    const { blocks, problems } = parseMarkedBlocks(`head\n${block('aaaaaaaaaaaa')}\ntail`);
    expect(problems).toEqual([]);
    expect(blocks).toEqual([{ kind: 'invariant', id: 'keep-x', pin: 'aaaaaaaaaaaa', openLine: 2, closeLine: 4, body: ['expect(x).toBe(false);'] }]);
  });
  it('reports every structural problem: malformed, unclosed, stray close, mismatched close, nesting, duplicate id', () => {
    const lines = (xs) => parseMarkedBlocks(xs.map(mk).join('\n')).problems.map((p) => p.message);
    expect(lines(['// %invariant no-pin-here'])[0]).toMatch(/malformed/);
    expect(lines(['// %invariant a pin:aaaaaaaaaaaa'])[0]).toMatch(/never closed/);
    expect(lines(['// %end-invariant a'])[0]).toMatch(/closes no open/);
    expect(lines(['// %invariant a pin:aaaaaaaaaaaa', '// %end-principle a'])[0]).toMatch(/does not match/);
    expect(lines(['// %invariant a pin:aaaaaaaaaaaa', '// %principle b pin:bbbbbbbbbbbb', '// %end-invariant a'])[0]).toMatch(/do not nest/);
    expect(lines(['// %invariant a pin:aaaaaaaaaaaa', '// %end-invariant a', '// %invariant a pin:aaaaaaaaaaaa', '// %end-invariant a'])[0]).toMatch(/used twice/);
  });
  it('prose that mentions the tags mid-line is not a marker', () => {
    expect(parseMarkedBlocks(' * the `@principle`/`@invariant` markers, see gate-config').problems).toEqual([]);
    expect(parseMarkedBlocks("const s = '// @invariant x';").problems).toEqual([]);
  });
  it('markers are recognized only in source files', () => {
    for (const p of ['a.mjs', 'a.cjs', 'a.js', 'a.ts', 'a.tsx', 'a.jsx', 'a.mts', 'a.cts']) expect(isMarkerSourcePath(p)).toBe(true);
    for (const p of ['a.md', 'a.json', 'a.njk', 'mjs']) expect(isMarkerSourcePath(p)).toBe(false);
  });
});

describe('isMarkedInvariantEdit — trigger 2, a base-present marked guarantee', () => {
  const F = 'scripts/lib/__tests__/some.test.mjs';
  const at = (hunks, path = F) => isMarkedInvariantEdit(path, section(path, hunks));
  it('FIRES when a hunk removes (edits, moves or deletes) a marker line — open or close', () => {
    expect(at(mk('@@ -1 +1 @@\n-// %invariant keep-x pin:aaaaaaaaaaaa\n+// %invariant keep-x pin:bbbbbbbbbbbb\n'))).toBe(true);
    expect(at(mk('@@ -1,3 +0,0 @@\n-// %invariant keep-x pin:aaaaaaaaaaaa\n-expect(x).toBe(false);\n-// %end-invariant keep-x\n'))).toBe(true);
    expect(at(mk('@@ -3 +3 @@\n-  // %end-invariant keep-x\n+  expect(y).toBe(1);\n'))).toBe(true);
    expect(at(mk('@@ -1 +1 @@\n- * %principle loose-malformed\n+ * gone\n'))).toBe(true); // malformed still fires: safe side
  });
  it('does NOT fire when a marker is only ADDED (a new guarantee is implementation, #2839) or only in context', () => {
    expect(at(mk('@@ -0,0 +1,3 @@\n+// %invariant keep-x pin:aaaaaaaaaaaa\n+expect(x).toBe(false);\n+// %end-invariant keep-x\n'))).toBe(false);
    expect(at(mk('@@ -1,3 +1,3 @@\n // %invariant keep-x pin:aaaaaaaaaaaa\n-a\n+b\n'))).toBe(false);
  });
  it('does NOT fire outside source files, or on unknown content (the documented residual)', () => {
    expect(at(mk('@@ -1 +1 @@\n-// %invariant keep-x pin:aaaaaaaaaaaa\n+x\n'), 'docs/notes.md')).toBe(false);
    expect(isMarkedInvariantEdit(F, null)).toBe(false);
  });
  it('FIRES on a rename out of the marker-source types (it would un-recognize markers without removing a line)', () => {
    const d = 'diff --git a/x/guard.test.mjs b/x/guard.test.md\nsimilarity index 100%\nrename from x/guard.test.mjs\nrename to x/guard.test.md\n';
    expect(isMarkedInvariantEdit('x/guard.test.md', d)).toBe(true);
    const inside = 'diff --git a/x/a.mjs b/x/b.mjs\nsimilarity index 100%\nrename from x/a.mjs\nrename to x/b.mjs\n';
    expect(isMarkedInvariantEdit('x/b.mjs', inside)).toBe(false);
  });
});

describe('isPrincipleSurface — the union, with the leash pinned by path', () => {
  it('every declarative-leash file is a principle surface under EVERY diff shape (trigger 3, permanent)', () => {
    for (const base of POLICY_SPEC_BASENAMES) {
      const homes = TRUST_CHAIN.find((m) => m.file === base).homes;
      for (const path of [...homes, base, `elsewhere/${base}`]) {
        for (const d of [null, '', section(path, '@@ -1 +1 @@\n-a  b\n+a b\n'), 'garbage']) {
          expect(isPrincipleSurface(path, d), `${path} / ${JSON.stringify(d)}`).toBe(true);
        }
      }
    }
  });
  it('derivation code and engine files with no marked guarantee are NOT principle surfaces', () => {
    const d = (p) => section(p, '@@ -1 +1 @@\n-const a = 1;\n+const a = 2;\n');
    for (const p of ['scripts/lib/review-escalation.mjs', 'scripts/merge-ai-prs.mjs', 'scripts/lib/review-core.mjs']) {
      expect(isDeclarativeLeashPath(p)).toBe(false);
      expect(isPrincipleSurface(p, d(p))).toBe(false);
    }
  });
  it('the same derivation file IS a principle surface once the diff edits a marked guarantee in it', () => {
    const p = 'scripts/lib/review-escalation.mjs';
    expect(isPrincipleSurface(p, section(p, mk('@@ -1 +1 @@\n-// %principle x pin:aaaaaaaaaaaa\n+// %principle x pin:bbbbbbbbbbbb\n')))).toBe(true);
  });
});

describe('scoreEscalation — humanRequired = gateBasis.some(isPrincipleSurface)', () => {
  it('a whitespace-only statute edit ESCALATES to the committee but is NOT human, and names no statute reason', () => {
    const r = scoreEscalation({ changedFiles: [STATUTE], diffHunks: section(STATUTE, '@@ -1 +1 @@\n-a  rule\n+a rule\n') });
    expect(r.escalate).toBe(true);
    expect(r.humanRequired).toBe(false);
    expect(r.reasons.some((x) => x.startsWith('statute'))).toBe(false);
    expect(producerReviewLabel(r)).toBe(REVIEW_LABELS.pending);
  });
  it('a rule-text statute edit is human, with the statute reason', () => {
    const r = scoreEscalation({ changedFiles: [STATUTE], diffHunks: section(STATUTE, '@@ -1 +1 @@\n-may\n+must\n') });
    expect(r.humanRequired).toBe(true);
    expect(r.signals.statute).toEqual([STATUTE]);
    expect(producerReviewLabel(r)).toBe(REVIEW_LABELS.human);
  });
  it('a statute file present in the basis but ABSENT from a computed diff fails closed (unknown ⇒ human)', () => {
    const r = scoreEscalation({ changedFiles: [STATUTE, 'a.md'], diffHunks: section('a.md', '@@ -1 +1 @@\n-x\n+y\n') });
    expect(r.humanRequired).toBe(true);
  });
  it('a marked-guarantee edit OUTSIDE the trust chain and blast radius escalates AND is human, via gate-self', () => {
    const p = 'src/features/guard.test.ts';
    const r = scoreEscalation({ changedFiles: [p], diffHunks: section(p, mk('@@ -1 +1 @@\n-// %invariant g pin:aaaaaaaaaaaa\n+// %invariant g pin:bbbbbbbbbbbb\n')) });
    expect(r.escalate).toBe(true);
    expect(r.humanRequired).toBe(true);
    expect(r.signals.principleMarker).toEqual([p]);
    expect(r.reasons).toContain(`gate-self (${p}) — edits a pre-existing @principle/@invariant-marked guarantee, human review required`);
  });
  it('a leash file that also carries a marker edit is named once, as the leash', () => {
    const p = 'scripts/lib/gate-config.mjs';
    const r = scoreEscalation({ changedFiles: [p], diffHunks: section(p, mk('@@ -1 +1 @@\n-// %invariant g pin:aaaaaaaaaaaa\n+x\n')) });
    expect(r.reasons.filter((x) => x.startsWith('gate-self'))).toHaveLength(1);
    expect(r.signals.principleMarker).toBeUndefined();
  });
  it('flags principleContentUnknown only when there is a basis and no content', () => {
    expect(scoreEscalation({ changedFiles: ['a.md'] }).signals.principleContentUnknown).toBe(true);
    expect(scoreEscalation({ changedFiles: ['a.md'], diffHunks: '' }).signals.principleContentUnknown).toBeUndefined();
    expect(scoreEscalation({}).signals.principleContentUnknown).toBeUndefined();
  });
  it('never throws on hostile hunk text', () => {
    for (const h of ['diff --git', 'diff --git \n@@', '\0\0', 'diff --git a/x b/y\n+++ \n@@ -\n-']) {
      expect(() => scoreEscalation({ changedFiles: [STATUTE, 'x', 'y'], diffHunks: h })).not.toThrow();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
// THE REAL CALL PATH — real git, the drain's shared diff derivation, and pr-land's PR-open label.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('real call path — computeNetDiffSignals (real git) → resolveProducerReviewLabel', () => {
  let root;
  let work;
  const git = (...args) => execFileSync('git', args, { cwd: work, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const write = (rel, text) => { mkdirSync(dirname(join(work, rel)), { recursive: true }); writeFileSync(join(work, rel), text); };
  const exec = (cmd, args, opts) => execFileSync(cmd, args, { ...opts, cwd: work });
  const MARKED = 'src/guards/keep.test.mjs';
  const body = ['it(\'never applies\', () => {', '  expect(plan.apply).toBe(false);', '});'];
  const markedFile = (lines) => [
    'import { it, expect } from "vitest";',
    mk(`// %invariant keep-apply-false pin:${markerBlockPin(lines)}`),
    ...lines,
    mk('// %end-invariant keep-apply-false'),
    '',
  ].join('\n');

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'principle-surface-'));
    execFileSync('git', ['init', '--bare', '-q', '-b', 'main', join(root, 'origin.git')]);
    work = join(root, 'work');
    execFileSync('git', ['clone', '-q', join(root, 'origin.git'), work], { stdio: 'ignore' });
    git('config', 'user.email', 't@example.invalid');
    git('config', 'user.name', 't');
    git('checkout', '-q', '-b', 'main');
    write(STATUTE, '# Decisions\n\n### A rule {#a-rule}\n\nAn agent may not clear a human label.\n');
    write(MARKED, markedFile(body));
    write('src/other.mjs', 'export const a = 1;\n');
    git('add', '-A');
    git('commit', '-q', '-m', 'base');
    git('push', '-q', 'origin', 'main');
  });
  afterAll(() => { if (root) rmSync(root, { recursive: true, force: true }); });

  const land = (branch, edit) => {
    git('checkout', '-q', '-B', branch, 'origin/main');
    edit();
    git('commit', '-q', '-am', branch);
    git('push', '-q', '-f', 'origin', branch);
    const sig = computeNetDiffSignals({ exec, rev: branch, fetchExtraRefs: [branch] });
    expect(sig.diffHunks, 'the real producer computed content').not.toBeNull();
    return resolveProducerReviewLabel({ ...sig });
  };

  it('a statute REFLOW lands review:pending (committee), not review:human', () => {
    const v = land('lane/reflow', () => write(STATUTE, '# Decisions\n\n### A rule {#a-rule}\n\nAn agent may not\nclear a human label.\n'));
    expect(v.humanRequired).toBe(false);
    expect(v.label).toBe(REVIEW_LABELS.pending);
  });
  it('a statute RULE change lands review:human', () => {
    const v = land('lane/rule', () => write(STATUTE, '# Decisions\n\n### A rule {#a-rule}\n\nAn agent may clear a human label.\n'));
    expect(v.humanRequired).toBe(true);
    expect(v.label).toBe(REVIEW_LABELS.human);
  });
  it('a re-pinned edit to a marked guarantee lands review:human, even deep inside a long block', () => {
    const longBody = [...body.slice(0, 1), ...Array.from({ length: 20 }, (_, i) => `  // step ${i}`), ...body.slice(1)];
    // base first: a long marked block, then an edit to its middle with the required re-pin.
    git('checkout', '-q', 'main');
    write(MARKED, markedFile(longBody));
    git('commit', '-q', '-am', 'long block');
    git('push', '-q', 'origin', 'main');
    const edited = longBody.map((l) => (l === '  // step 10' ? '  expect(plan.apply).toBe(true);' : l));
    const v = land('lane/weaken', () => write(MARKED, markedFile(edited)));
    expect(v.humanRequired).toBe(true);
    expect(v.label).toBe(REVIEW_LABELS.human);
  });
  it('ADDING a new marked guarantee, and an unmarked edit, stay agent-clearable', () => {
    const added = land('lane/add-guard', () => write('src/other.mjs', ['export const a = 1;', mk(`// %invariant a-is-one pin:${markerBlockPin(['export const b = a;'])}`), 'export const b = a;', mk('// %end-invariant a-is-one'), ''].join('\n')));
    expect(added.humanRequired).toBe(false);
    const plain = land('lane/plain', () => write('src/other.mjs', 'export const a = 2;\n'));
    expect(plain.humanRequired).toBe(false);
  });
});
