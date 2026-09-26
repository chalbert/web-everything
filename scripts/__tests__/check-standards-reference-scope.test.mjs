/**
 * #4166 — reference checks (blockedBy edges, the backlog load) run on changed + LINKED files under
 * `--local --files=`. Source-level guard, same style as `check-standards-scoped-file-scan.test.mjs` (#4168)
 * and `check-standards-local-skip-work.test.mjs` (#4167) — running the whole script here would re-run
 * every gate (~13s full, still several seconds scoped); the wiring below is what a full run would exercise,
 * pinned as anchors so a later edit can't silently drop one half of it.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = readFileSync(join(ROOT, 'scripts', 'check-standards.mjs'), 'utf8');

describe('check-standards.mjs — LINKED_FILES / EFFECTIVE_FILES wiring (#4166)', () => {
  it('imports linkedFilesFor from the shared claimScope.mjs (single source with the #4164 replay harness)', () => {
    expect(src).toMatch(/import \{[^}]*linkedFilesFor[^}]*\} from '\.\/readiness\/claimScope\.mjs';/);
  });

  it('gates the git-grep linking work on the diff actually touching a backlog/*.md file', () => {
    expect(src).toContain("const CHANGED_BACKLOG_FILES = LOCAL_FILES_LIST");
    expect(src).toContain("f.startsWith('backlog/') && f.endsWith('.md')");
    const linkedDecl = src.slice(src.indexOf('const LINKED_FILES ='), src.indexOf('const LINKED_FILES =') + 300);
    expect(linkedDecl).toContain('CHANGED_BACKLOG_FILES.length');
    expect(linkedDecl).toContain('linkedFilesFor(CHANGED_BACKLOG_FILES');
    expect(linkedDecl).toContain('outgoingBacklogTargets(CHANGED_BACKLOG_FILES)');
  });

  it('git grep is forced single-threaded (measured: ~10x less sys time, no real-time cost, #4166)', () => {
    expect(src).toContain("['grep', '--threads=1', '-l', '-F', '-e', needle, '--', '.', ':!node_modules']");
  });

  it('EFFECTIVE_FILES (changed ∪ linked) is monotonically wider than LOCAL_FILES, never narrower', () => {
    expect(src).toContain('const EFFECTIVE_FILES = LOCAL_FILES ? new Set([...LOCAL_FILES, ...(LINKED_FILES || [])]) : null;');
  });

  it('scopedReaddir and scopedReportFiles read EFFECTIVE_FILES, not the literal LOCAL_FILES (the false-green #4166 closes)', () => {
    const scopedReaddir = src.slice(src.indexOf('const scopedReaddir = '), src.indexOf('const scopedReaddir = ') + 400);
    expect(scopedReaddir).toContain('EFFECTIVE_FILES.has(`${dirRel}${n}`)');
    expect(scopedReaddir).not.toContain('LOCAL_FILES.has(`${dirRel}${n}`)');
    expect(src).toContain('const scopedReportFiles = SCOPE_TO_FILES ? reportFiles.filter((f) => EFFECTIVE_FILES.has(`reports/${f}`)) : reportFiles;');
  });

  it('the backlog load calls the SCOPED entry point under SCOPE_TO_FILES, falling back to the default loader otherwise', () => {
    expect(src).toContain('const backlogScopedFiles = SCOPE_TO_FILES');
    const loadSite = src.slice(src.indexOf('const backlog = arr(\n  SCOPE_TO_FILES'), src.indexOf('const backlog = arr(\n  SCOPE_TO_FILES') + 250);
    expect(loadSite).toContain('loadBacklog.loadBacklogScoped(backlogScopedFiles)');
    expect(loadSite).toContain("(typeof loadBacklog === 'function' ? loadBacklog() : loadBacklog)");
  });

  it('the bottom-of-file classification fileSet is EFFECTIVE_FILES, not the literal --files= list', () => {
    expect(src).toContain('const fileSet = EFFECTIVE_FILES ?? (list ? new Set(list) : null);');
  });

  it('a bare --local (no --files=) or the default no-flag run never touch git — SCOPE_TO_FILES stays the gate', () => {
    // SCOPE_TO_FILES is unchanged from #4168: LOCAL_MODE && !!LOCAL_FILES. CHANGED_BACKLOG_FILES/LINKED_FILES
    // are derived from LOCAL_FILES_LIST (null whenever --files= is absent), so they degrade to [] / null too.
    expect(src).toMatch(/const SCOPE_TO_FILES = LOCAL_MODE && !!LOCAL_FILES;/);
    expect(src).toContain('const CHANGED_BACKLOG_FILES = LOCAL_FILES_LIST\n  ? LOCAL_FILES_LIST.filter');
  });
});
