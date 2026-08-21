/**
 * @file scripts/operations/resolve-io.mjs
 * @description THE IO SHELL of the `resolve` declaration (#xrrpfo7) — the reader its `read` step is injected
 *   with, and the sink its `write` effect is applied through.
 *
 * SAME SPLIT AS `./claim-io.mjs`, deliberately: `./resolve.mjs` is the WHAT and this is the only place it
 * touches the world, which is what lets every refusal in the declaration be tested with no filesystem and no
 * git.
 *
 * IT REUSES, IT DOES NOT RESTATE. `resolveBacklogFile`/`idFromName`/`readField` come from the same modules
 * `claim-io.mjs` uses; the write goes through the extracted guarded writer
 * (`we:scripts/backlog/guarded-write.mjs#writeBacklogMd`) and never a bare `writeFileSync`, because that
 * writer owns the lane-not-primary refusal and the #883 locus scan at write time. A second writer here would
 * be a second answer to "may this file be written", which is the failure #2644 names.
 *
 * THE SCOPE READ IS THE EXPENSIVE ONE, and it is deliberately shaped to report THREE states rather than two.
 * `reconcileScope` can only run when the item declares a `scope:`; a pre-#2613 legacy item declares none, and
 * the CLI prints a note and passes. So this reader returns `scopeDeclared` SEPARATELY from `offending`:
 * `{scopeDeclared: false}` means the check could not run, `{scopeDeclared: true, offending: []}` means it ran
 * and found nothing. `planResolve` keeps them apart for the same reason `verify` keeps `unrun` out of `pass`.
 *
 * IMPURE by construction: `fs`, `git`.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readField } from '../backlog/frontmatter.mjs';
import { writeBacklogMd } from '../backlog/guarded-write.mjs';
// #2747 — the shared wall-clock helper, NOT a hand-rolled UTC ISO day-slice. The hand-rolled form stamps the
// runtime's UTC day, which runs a day ahead of a UTC-behind operator all evening. `check:standards` scans for
// it and caught this exact file on its first cut. `claim-io.mjs` imports the same helper for the same reason.
// (The scanner matches the pattern in comments too, so this note describes it rather than quoting it.)
import { localToday } from '../lib/local-date.mjs';
import { RESOLVE_EFFECT } from './resolve.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
/** Resolved by SCRIPT LOCATION, never cwd — same reason `run-store.mjs` does it. */
export const REPO_ROOT = resolvePath(HERE, '..', '..');

const backlogDir = (root) => join(root, 'backlog');
const idFromName = (file) => file.replace(/\.md$/, '').split('-')[0];

/**
 * Find the one backlog file a ref names. Refuses AMBIGUITY rather than picking the first match — two files
 * for one id means the caller's ref does not identify an item, and resolving the wrong card is worse than
 * refusing.
 */
export function resolveBacklogFile(ref, root, listFiles) {
  const raw = String(ref ?? '').replace(/^#/, '').trim();
  if (!raw) return null;
  const padded = /^\d+$/.test(raw) ? raw.padStart(3, '0') : raw;
  const files = listFiles(backlogDir(root)).filter((f) => f.endsWith('.md'));
  const matches = files.filter((f) => idFromName(f) === padded || f.replace(/\.md$/, '') === padded);
  if (matches.length !== 1) return null;
  return matches[0];
}

/**
 * Build the injected reader.
 *
 * `reconcile` and `observed` are parameters rather than direct imports so a test can drive the #2803 branch
 * without a git tree. #1497's lesson applies here as much as anywhere: a partially-injected shell is how a
 * suite goes green over code that genuinely reached the filesystem.
 */
export function createResolveReader({
  root = REPO_ROOT,
  listFiles = (dir) => readdirSync(dir),
  readText = (path) => readFileSync(path, 'utf8'),
  exec = execFileSync,
  today = localToday,
  // Injected so the declaration's scope-drift branch is reachable in a test. The real bindings are
  // `we:scripts/lib/scope-reconcile.mjs` and the observed-file walk the CLI uses.
  reconcile = null,
  observedFiles = null,
} = {}) {
  return ({ ref }) => {
    const file = resolveBacklogFile(ref, root, listFiles);
    if (!file) return { found: false };

    const abs = join(backlogDir(root), file);
    const rel = `backlog/${file}`;
    const content = readText(abs);
    const id = idFromName(file);
    const kind = readField(content, 'kind') || '';
    const status = readField(content, 'status') || '';

    // #658 — children by the `parent:` EDGE, never the body's prose listing. Only for an epic: walking every
    // card to find children of a story would be pure cost for a guard that cannot fire.
    const openChildren = [];
    if (kind === 'epic') {
      for (const f of listFiles(backlogDir(root)).filter((n) => n.endsWith('.md'))) {
        if (f === file) continue;
        let body;
        try { body = readText(join(backlogDir(root), f)); } catch { continue; }
        const parent = readField(body, 'parent');
        if (!parent || parent.replace(/^["']|["']$/g, '') !== id) continue;
        const st = readField(body, 'status') || '';
        if (st === 'open' || st === 'active' || st === 'preparing') openChildren.push({ num: idFromName(f), status: st });
      }
    }

    // #2803 — three-state, see the header. `scopeDeclared: false` is "could not check", NOT "clean".
    let scopeDeclared = false;
    let offending = [];
    const declared = readField(content, 'scope');
    if (declared && String(declared).trim() && String(declared).trim() !== '[]') {
      scopeDeclared = true;
      if (typeof reconcile === 'function') {
        try {
          const observed = typeof observedFiles === 'function' ? observedFiles({ root, exec }) : [];
          offending = reconcile({ declared: String(declared), observed })?.offending ?? [];
        } catch {
          // A reconciliation that THREW has not reported clean. Report the check as un-runnable rather than
          // returning an empty `offending`, which the declaration would read as "ran and found nothing".
          scopeDeclared = false;
          offending = [];
        }
      }
    }

    return { found: true, abs, rel, id, kind, status, content, openChildren, scopeDeclared, offending, today: today() };
  };
}

/**
 * BUILD THE SINK MAP for `resolve`'s one effect. Applies the already-computed bytes through the guarded
 * writer, which owns the lane-not-primary refusal — never a bare `writeFileSync`.
 */
export function createResolveSinks({ root = REPO_ROOT } = {}) {
  return {
    [RESOLVE_EFFECT]: async (payload) => {
      writeBacklogMd(payload.abs, payload.rel, payload.content, { root });
      return { rel: payload.rel, written: true };
    },
  };
}
