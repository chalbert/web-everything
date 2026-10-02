/** Pinned diagnostic store. Journal is authoritative; receipts are a rebuildable atomic index. */
import { openSync, closeSync, readFileSync, readSync, fstatSync, writeSync, fsyncSync, mkdirSync, renameSync, constants, lstatSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { healthDir } from './health-watch-section.mjs';
import { scrubDeep } from './health-watch-core.mjs';
import { DEFAULT_CONFIG, RECEIPT_STATES } from './health-responder-core.mjs';
export const responderDir = (stateRoot, env) => join(dirname(healthDir(stateRoot, env)), 'health-responder');
export function boundedText(file, max = 8 * 1024 * 1024) {
  const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size > max) throw new Error('non-regular or oversized input');
    return readFileSync(fd, 'utf8');
  } finally { closeSync(fd); }
}
const json = (p) => JSON.parse(boundedText(p));
export function readWatchGeneration(dir, { readJson = json, deadline = Infinity, clock = Date.now } = {}) {
  let episodes = [];
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (clock() > deadline) throw new Error('tick deadline');
      const before = readJson(join(dir, 'last-tick.json'));
      const state = readJson(join(dir, 'state.json'));
      if (!state?.episodes || Array.isArray(state.episodes)) throw new Error('missing episode map');
      episodes = Object.values(state.episodes);
      if (episodes.length > 2000) throw new Error('episode limit');
      let matches = JSON.stringify(before) === JSON.stringify(state.lastTick);
      for (const [key, e] of Object.entries(state.episodes)) {
        if (clock() > deadline) throw new Error('tick deadline');
        if (!e || key !== e.key || e.key !== `${e.smell}::${e.subject}`) throw new Error('bad episode identity');
        if (e.status === 'pending') continue;
        if (!['open', 'flapping'].includes(e.status) || !/^[a-zA-Z0-9_-]+$/.test(e.id ?? '') || !e.openedAt) throw new Error('bad open identity/status');
        const report = readJson(join(dir, 'episodes', `${e.id}.json`));
        if (JSON.stringify(scrubDeep(e)) !== JSON.stringify(report)) matches = false;
        for (const field of ['id', 'key', 'smell', 'subject', 'status', 'openedAt', 'samples', 'lastBreachAt']) {
          if (JSON.stringify(e[field]) !== JSON.stringify(report[field])) matches = false;
        }
      }
      const after = readJson(join(dir, 'last-tick.json'));
      if (matches && JSON.stringify(before) === JSON.stringify(after) && Number.isFinite(before.completedAt))
        return { episodes, watchGeneration: { valid: true, completedAt: before.completedAt } };
    }
    throw new Error('mixed watch generation after retry');
  } catch (error) { return { episodes, watchGeneration: { valid: false, reason: error.message } }; }
}
export function readResponderConfig(dir) {
  try { return json(join(dir, 'config.json')); }
  catch (e) { return e.code === 'ENOENT' ? { ...DEFAULT_CONFIG, smells: {} } : null; }
}
export function readJournal(dir) {
  let text;
  try { text = boundedText(join(dir, 'decisions.jsonl'), 32 * 1024 * 1024); }
  catch (e) { if (e.code === 'ENOENT') return []; throw e; }
  if (text && !text.endsWith('\n')) throw new Error('partial journal');
  return text.split('\n').filter(Boolean).map((line) => {
    const row = JSON.parse(line);
    if (row.schema !== 1 || row.mode !== 'shadow' || row.applied !== false || !row.rule || !row.episodeIdentity
      || !['act-would-have', 'hold', 'noop', 'escalate', 'cap-reached'].includes(row.decision)) throw new Error('corrupt journal schema');
    return row;
  });
}
export function receiptsFromJournal(rows) {
  return rows.filter((r) => r.decision === 'act-would-have').map((r) => ({
    mode: 'shadow', state: 'prepared', simulated: true, successfulLiveAction: false,
    familyKey: r.familyKey, family: r.actionFamily, identity: r.expectedHeadOrLease,
    episodeIdentity: r.episodeIdentity, configVersion: r.configVersion, firstEligibleAt: r.at,
    submittedAt: null, confirmedAt: null, recoveredAt: null, closedAt: null, jobRef: null,
  }));
}
function ensureStore(dir) {
  mkdirSync(dir, { recursive: true });
  if (lstatSync(dir).isSymbolicLink()) throw new Error('responder store must not be a symlink');
}
function atomic(dir, name, value) {
  const tmp = join(dir, `${name}.${process.pid}.tmp`);
  const fd = openSync(tmp, constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | constants.O_NOFOLLOW, 0o600);
  try { writeSync(fd, JSON.stringify(scrubDeep(value)) + '\n'); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(tmp, join(dir, name));
  const d = openSync(dir, 'r'); try { fsyncSync(d); } finally { closeSync(d); }
}
export function appendDecisions(dir, records) {
  ensureStore(dir);
  // Refuse corruption; never truncate, skip a malformed line or silently reset budgets.
  const prior = readJournal(dir);
  const rows = records.map((r) => scrubDeep({ ...r, schema: 1 }));
  const fd = openSync(join(dir, 'decisions.jsonl'), constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | constants.O_NOFOLLOW, 0o600);
  try {
    const bytes = Buffer.from(rows.map((r) => JSON.stringify(r) + '\n').join(''));
    let offset = 0;
    while (offset < bytes.length) offset += writeSync(fd, bytes, offset, bytes.length - offset);
    fsyncSync(fd);
  } finally { closeSync(fd); }
  atomic(dir, 'receipts.json', { schema: 1, allowedStates: RECEIPT_STATES,
    receipts: receiptsFromJournal([...prior, ...rows]), liveBudgets: [], shadowOnly: true });
  return rows;
}
export function writeLastTick(dir, record) { ensureStore(dir); atomic(dir, 'last-tick.json', record); }

/** Bounded read-only tail for the declared feed. No store writes on this path. */
export function readLatestDecisions({ stateRoot, env = process.env, limit = 50 } = {}) {
  const file = join(dirname(healthDir(stateRoot, env)), 'health-responder', 'decisions.jsonl');
  let fd;
  try {
    fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const stat = fstatSync(fd);
    if (!stat.isFile()) throw new Error('decision journal is not a regular file');
    const size = Math.min(stat.size, 1024 * 1024), buffer = Buffer.alloc(size);
    readSync(fd, buffer, 0, size, stat.size - size);
    const text = buffer.toString('utf8');
    if (text && !text.endsWith('\n')) throw new Error('partial decision journal');
    const lines = text.split('\n');
    if (stat.size > size) lines.shift();
    const records = lines.filter(Boolean).map((s) => JSON.parse(s));
    return { mode: 'shadow', records: records.slice(-Math.max(1, Math.min(100, limit))), truncated: stat.size > size };
  } catch (e) { return { mode: 'shadow', records: [], error: e.code === 'ENOENT' ? 'No decisions recorded' : e.message }; }
  finally { if (fd !== undefined) closeSync(fd); }
}
