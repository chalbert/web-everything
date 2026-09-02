/**
 * @file scripts/conveyor/hiccup-approve.mjs
 * @description The explicit human-approval store for BLOCKING learnings-pool entries (#3421, Done-when #3).
 *   A blocking entry (scripts/conveyor/hiccup-sink.mjs) is stamped `approvalPending:true` at append time —
 *   this file is how a human CLEARS that flag. The pool itself is append-only JSONL (never mutated in place —
 *   see learnings-drop.mjs's header), so "clearing" a flag on an already-written line is not an in-place
 *   edit: it is a SEPARATE small record, keyed by `<session>#<ts>`, in one shared `approvals.json` alongside
 *   the pool. scripts/conveyor/learnings-harvest.mjs reads this store to gate its candidate list — an
 *   unapproved blocking entry is held out of `candidates` entirely (see its `partitionGated`).
 *
 *   Lives in the SAME pool directory as the session `*.jsonl` files (poolDir, resolved the identical way
 *   learnings-drop.mjs / learnings-harvest.mjs already resolve it) so a lane clone and the primary checkout
 *   approve against the same store — never a repo-anchored, per-clone file.
 *
 * Usage (CLI):
 *   node scripts/conveyor/hiccup-approve.mjs --session=<slug> --ts=<iso> [--dir=<pool>] [--json]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { poolDir } from './learnings-drop.mjs';
import { writeLineSync } from '../lib/write-all-sync.mjs';

/** approvalsPath({dir, env, home}) → the ONE approvals store for a pool. `dir` (when given — e.g. the
 *  RESOLVED pool dir a caller already computed, so tests stay isolated to a tmp dir) wins over the
 *  machine-fixed default, mirroring resolvePoolDir's own precedence in learnings-harvest.mjs. */
export function approvalsPath({ dir, env = process.env, home } = {}) {
  return join(dir || poolDir({ env, home }), 'approvals.json');
}

/** readApprovals(path) → the approvals map, or `{}` for an absent/malformed store (never fatal — a missing
 *  approvals.json means "nothing approved yet", not an error). */
export function readApprovals(path) {
  if (!path || !existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/** approvalKey({session, ts}) → the deterministic key an entry is approved under. `session` matches
 *  learnings-harvest.mjs's `readPool` tag (the pool file's basename, no `.jsonl`) and `ts` is the entry's own
 *  normalized append stamp — together unique enough for one machine's pool. */
export function approvalKey({ session, ts }) {
  return `${session}#${ts}`;
}

/** isApproved(entry, approvals) → true when `entry` (`{session, ts}`) has a matching key in `approvals`. */
export function isApproved({ session, ts }, approvals) {
  return !!(approvals && Object.prototype.hasOwnProperty.call(approvals, approvalKey({ session, ts })));
}

/**
 * approveEntry({session, ts}, opts) → record an explicit approval, clearing the entry's approval-pending
 * gate for the NEXT harvest read. opts: { dir, env, home, now, approvedBy }.
 * @returns {{ path:string, key:string }}
 */
export function approveEntry({ session, ts }, opts = {}) {
  if (!session || !ts) throw new Error('hiccup-approve: both --session and --ts are required to approve an entry');
  const path = approvalsPath(opts);
  mkdirSync(dirname(path), { recursive: true });
  const approvals = readApprovals(path);
  const key = approvalKey({ session, ts });
  approvals[key] = {
    approvedAt: (opts.now ? new Date(opts.now) : new Date()).toISOString(),
    ...(opts.approvedBy ? { approvedBy: opts.approvedBy } : {}),
  };
  writeFileSync(path, JSON.stringify(approvals, null, 2) + '\n', 'utf8');
  return { path, key };
}

// ── thin CLI ──────────────────────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const flags = {};
  for (const a of argv) {
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq === -1) flags[a.slice(2)] = true;
    else flags[a.slice(2, eq)] = a.slice(eq + 1);
  }
  return flags;
}

function main(argv) {
  const f = parseArgs(argv);
  try {
    const { path, key } = approveEntry({ session: f.session, ts: f.ts }, { dir: f.dir, approvedBy: f['approved-by'] });
    if (f.json) writeLineSync(1, JSON.stringify({ ok: true, path, key }));
    else console.log(`✓ approved ${key} → ${path}`);
    process.exit(0);
  } catch (e) {
    if (f.json) writeLineSync(1, JSON.stringify({ ok: false, error: e.message }));
    else console.error(`✗ ${e.message}`);
    process.exit(1);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2));
}
