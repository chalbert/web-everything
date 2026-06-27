#!/usr/bin/env node
/**
 * @file memory-resolve.mjs — resolve a memory leaf by its stable number OR its slug → absolute path.
 *
 * The memory index is a tree: MEMORY.md (always-loaded category map) → `index-<category>.md`
 * (recall-gated sub-index, lines are bare `- N. Title`) → leaf files `N-slug.md`. A sub-index line
 * carries only the number `N` (not the long filename) to keep it narrow, so opening a leaf needs this
 * resolver: `node scripts/memory-resolve.mjs 5` → the file path; `--cat` prints its content instead.
 * Slugs still resolve too (`… memory-resolve.mjs monetization_strategy`) so `[[slug]]` links keep working.
 *
 * Memory dir is derived from the repo root the same way check-memory.mjs does (per-project key).
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HOME = process.env.HOME || process.env.USERPROFILE || '';
const MEM_DIR = join(HOME, '.claude', 'projects', ROOT.replace(/\//g, '-'), 'memory');

const args = process.argv.slice(2);
const cat = args.includes('--cat');
const key = args.find((a) => !a.startsWith('--'));
if (!key) { console.error('usage: memory-resolve.mjs <number|slug> [--cat]'); process.exit(1); }
if (!existsSync(MEM_DIR)) { console.error(`no memory dir at ${MEM_DIR}`); process.exit(2); }

const files = readdirSync(MEM_DIR).filter((f) => f.endsWith('.md') && f !== 'MEMORY.md');
// Strip the leading `N-` number prefix to get a file's slug; a bare slug (un-migrated file) is itself.
const slugOf = (f) => f.replace(/^\d+-/, '').replace(/\.md$/, '');
const hit = /^\d+$/.test(key)
  ? files.find((f) => new RegExp(`^${key}-`).test(f))
  : files.find((f) => slugOf(f) === key);

if (!hit) { console.error(`no memory matches "${key}"`); process.exit(2); }
const path = join(MEM_DIR, hit);
console.log(cat ? readFileSync(path, 'utf8') : path);
