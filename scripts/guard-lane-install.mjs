#!/usr/bin/env node
/**
 * guard-lane-install.mjs — register the lane-isolation guard ONCE, at user level, so it runs whatever the
 * current directory is (#3074).
 *
 * WHY THIS EXISTS. The hook was registered only in web-everything's `.claude/settings.json`, as the RELATIVE
 * command `node scripts/guard-lane.mjs`. A hook resolves against the caller's directory, so:
 *   - from a WE lane it ran the LANE's copy — fixed in #3074's sibling, but only for that case;
 *   - from frontierui, plateau-app, or either of their lanes it ran NOTHING. Neither repo has a
 *     `.claude/settings.json` at all, so two of the three primaries were unguarded from anywhere.
 *
 * WHY NOT COPY THE GUARD INTO ALL THREE REPOS. That is three files to keep in step, and the failure mode is
 * silent divergence: a fix landing in one leaves the others quietly weaker, with nothing to notice. One
 * registration with an ABSOLUTE path has one source of truth.
 *
 * WHAT IT COSTS, stated rather than discovered. The path is absolute, so MOVING the web-everything checkout
 * breaks it — and `guard-lane.mjs` fails OPEN by design (a guard fault must never wedge the agent), so a broken
 * path means NO GUARD, silently. `status` exists to make that checkable, and re-running `install` repairs it.
 * Gating "is it installed" in `check:standards` is the obvious next step and is deliberately not done here: it
 * would fail on any machine without the hook, including CI, and that trade needs its own decision.
 *
 * Usage:
 *   node scripts/guard-lane-install.mjs print      # show the hook entry, touch nothing
 *   node scripts/guard-lane-install.mjs status     # is it registered, and does its path resolve?
 *   node scripts/guard-lane-install.mjs install    # add/repair the entry in ~/.claude/settings.json
 *   node scripts/guard-lane-install.mjs uninstall  # remove it
 */
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeLineSync } from './lib/write-all-sync.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * The guard to register — always the PRIMARY checkout's copy, never this script's own.
 *
 * The first cut used `resolve(HERE, 'guard-lane.mjs')` and reproduced, in the installer, the exact bug the
 * guard itself had: run from a lane it registered the LANE's path. A lane is reset and recycled, so that
 * installs a hook which silently stops resolving — and `guard-lane.mjs` fails open, so a broken path means no
 * guard at all, quietly. Deriving the workspace root the same way the guard now does keeps one answer to
 * "where does the real copy live".
 */
export function primaryGuardPath(from = HERE) {
  const i = from.indexOf(`${sep}.lanes${sep}`);
  const workspace = i >= 0 ? from.slice(0, i) : resolve(from, '..', '..');
  return join(workspace, 'webeverything', 'scripts', 'guard-lane.mjs');
}
export const GUARD_PATH = primaryGuardPath();
export const SETTINGS_PATH = join(homedir(), '.claude', 'settings.json');
/** The Edit|Write matcher the guard belongs on. Kept as a constant so `status` and `install` cannot disagree. */
export const MATCHER = 'Edit|Write';

/** The hook entry, as it appears in settings. Pure — takes the guard path so a test can pass a fake one. */
export function hookEntry(guardPath = GUARD_PATH) {
  return { type: 'command', command: `node ${guardPath}` };
}

/**
 * Add or repair the entry in a settings OBJECT, returning a new one. PURE — the caller does the io.
 *
 * Idempotent by identity, not by count: an entry whose command names this same script is REPLACED rather than
 * appended, so re-running after moving the checkout repairs the path instead of registering a second, stale
 * guard that fails open on every write.
 */
export function withGuardHook(settings, guardPath = GUARD_PATH) {
  const next = JSON.parse(JSON.stringify(settings ?? {}));
  next.hooks = next.hooks ?? {};
  next.hooks.PreToolUse = Array.isArray(next.hooks.PreToolUse) ? next.hooks.PreToolUse : [];
  const isOurs = (h) => typeof h?.command === 'string' && h.command.includes('guard-lane.mjs');
  let block = next.hooks.PreToolUse.find((b) => b.matcher === MATCHER);
  if (!block) { block = { matcher: MATCHER, hooks: [] }; next.hooks.PreToolUse.push(block); }
  block.hooks = Array.isArray(block.hooks) ? block.hooks.filter((h) => !isOurs(h)) : [];
  block.hooks.push(hookEntry(guardPath));
  return next;
}

/** Remove every guard entry, wherever it sits. Pure. */
export function withoutGuardHook(settings) {
  const next = JSON.parse(JSON.stringify(settings ?? {}));
  for (const block of next.hooks?.PreToolUse ?? []) {
    if (Array.isArray(block.hooks)) block.hooks = block.hooks.filter((h) => !String(h?.command || '').includes('guard-lane.mjs'));
  }
  return next;
}

/** Which guard commands a settings object registers, and whether each resolves. Pure over an `exists` probe. */
export function guardStatus(settings, exists = existsSync) {
  const found = [];
  for (const block of settings?.hooks?.PreToolUse ?? []) {
    for (const h of block?.hooks ?? []) {
      const cmd = String(h?.command || '');
      if (!cmd.includes('guard-lane.mjs')) continue;
      const path = cmd.replace(/^node\s+/, '').trim();
      found.push({ matcher: block.matcher, path, resolves: exists(path), absolute: path.startsWith('/') });
    }
  }
  return found;
}

const readSettings = () => (existsSync(SETTINGS_PATH) ? JSON.parse(readFileSync(SETTINGS_PATH, 'utf8')) : {});

function main(argv) {
  const cmd = argv[0] || 'status';
  if (cmd === 'print') { writeLineSync(1, JSON.stringify(hookEntry(), null, 2)); return 0; }
  if (cmd === 'status') {
    const found = guardStatus(readSettings());
    if (!found.length) { writeLineSync(1, `guard-lane: NOT registered in ${SETTINGS_PATH} — run \`install\``); return 1; }
    for (const f of found) {
      writeLineSync(1, `guard-lane: ${f.matcher} → ${f.path} ${f.resolves ? '(resolves)' : '(MISSING — the guard fails open, so this means NO guard)'}${f.absolute ? '' : ' (RELATIVE — only guards the directory it is run from)'}`);
    }
    return found.every((f) => f.resolves && f.absolute) ? 0 : 1;
  }
  if (cmd === 'install' || cmd === 'uninstall') {
    const before = readSettings();
    if (existsSync(SETTINGS_PATH)) copyFileSync(SETTINGS_PATH, `${SETTINGS_PATH}.bak`);
    const after = cmd === 'install' ? withGuardHook(before) : withoutGuardHook(before);
    writeFileSync(SETTINGS_PATH, `${JSON.stringify(after, null, 2)}\n`, 'utf8');
    writeLineSync(1, `guard-lane: ${cmd}ed in ${SETTINGS_PATH} (previous saved to ${SETTINGS_PATH}.bak)`);
    return 0;
  }
  writeLineSync(2, 'usage: guard-lane-install.mjs print|status|install|uninstall');
  return 2;
}

// `process.exitCode =`, not `process.exit()` — #3061's exit-wraps-call shape discards the callee's flush.
if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = main(process.argv.slice(2));
