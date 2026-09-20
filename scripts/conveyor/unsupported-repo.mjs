/** Durable owed work that a constellation dispatcher cannot run. */
import { mkdirSync, readFileSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

export const UNSUPPORTED_REPO_FILE = resolve(dirname(fileURLToPath(import.meta.url)), '../../.conveyor/unsupported-repo.json');

export function readUnsupported({ path = UNSUPPORTED_REPO_FILE } = {}) {
  try {
    const rows = JSON.parse(readFileSync(path, 'utf8'));
    return Array.isArray(rows) && rows.every((row) => row && typeof row === 'object') ? rows : [];
  } catch { return []; }
}

/** Replace one repo's rows; an empty replacement clears its outstanding work. */
export function recordUnsupported({ repo, rows, path = UNSUPPORTED_REPO_FILE, now = () => new Date().toISOString() }) {
  const next = readUnsupported({ path }).filter((row) => row.repo !== repo);
  next.push(...rows.map((row) => ({ ...row, repo, at: row.at ?? now() })));
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temp, JSON.stringify(next, null, 2) + '\n', { flag: 'wx' });
    renameSync(temp, path);
  } finally {
    try { unlinkSync(temp); } catch { /* renamed or never created */ }
  }
  return next;
}
