/** #3383 — Thin fs lease shell. A short arbitration directory fences steal/renew/release races.
 * Publish a NONEMPTY fence atomically. Cleanup removes only an owner-specific marker, then rmdir:
 * it can never recursively delete a successor's nonempty fence. Dead-process fences are recoverable.
 */
import * as nativeFs from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { milliseconds, CoordinationUnavailableError } from './action-record.mjs';
export function pidAlive(pid) { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'ESRCH' ? false : true; } }
const fenceWaitCell = new Int32Array(new SharedArrayBuffer(4));
const waitForFence = () => Atomics.wait(fenceWaitCell, 0, 0, 1);
export function tryLease({ path, owner, now = Date.now, staleMs, maxHoldMs = Infinity, isPidAlive = pidAlive, fs = nativeFs, wait = waitForFence }) {
  const gate = `${path}.gate`;
  const fenceBusy = Symbol('fence-busy');
  const busyFence = (heldBy) => Object.defineProperty({ ok: false, reason: 'busy', heldBy }, fenceBusy, { value: true });
  const fenced = (fn) => {
    const token = randomUUID();
    const preparing = `${gate}.preparing-${token}`;
    const marker = `owner-${token}.json`;
    const gateOwner = { pid: process.pid, host: hostname(), token };
    const removeEmpty = () => {
      try { fs.rmdirSync(gate); }
      catch (e) { if (!['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes(e.code)) throw e; }
    };
    let owns = false;
    try {
      fs.mkdirSync(dirname(path), { recursive: true });
      fs.mkdirSync(preparing);
      fs.writeFileSync(join(preparing, marker), JSON.stringify(gateOwner));
      // Bounded, nonblocking retries: a concurrent recovery can win between any two fs calls.
      for (let attempt = 0; attempt < 3 && !owns; attempt++) {
        try { fs.renameSync(preparing, gate); owns = true; }
        catch (error) {
          if (!['EEXIST', 'ENOTEMPTY'].includes(error.code)) throw error;
          let names;
          try { names = fs.readdirSync(gate); } catch (e) { if (e.code === 'ENOENT') continue; throw e; }
          if (!names.length) { removeEmpty(); continue; }
          if (names.length !== 1 || !/^owner-[\w-]+\.json$/.test(names[0])) throw new Error('Invalid arbitration fence');
          let held;
          try { held = JSON.parse(fs.readFileSync(join(gate, names[0]), 'utf8')); }
          catch (e) { if (e.code === 'ENOENT') continue; throw e; }
          if (!Number.isInteger(held.pid) || held.pid < 1 || !held.host || names[0] !== `owner-${held.token}.json`) throw new Error('Invalid fence owner');
          // Only POSITIVE death permits recovery of a critical section. A clock timeout alone cannot
          // fence a paused writer between its last owner check and its rename.
          if (held.host !== hostname() || held.pid === process.pid || isPidAlive(held.pid) !== false) {
            return busyFence(held);
          }
          try { fs.unlinkSync(join(gate, names[0])); }
          catch (e) { if (e.code !== 'ENOENT') throw e; }
          removeEmpty();
        }
      }
      if (!owns) return busyFence(null);
      return fn();
    } catch (e) { throw e instanceof CoordinationUnavailableError ? e : new CoordinationUnavailableError(path, e); }
    finally {
      try {
        if (owns) {
          // A contender can replace the empty directory after unlink, before rmdir. rmdir then refuses
          // its nonempty successor; the unique marker prevents us from ever removing its owner.
          fs.unlinkSync(join(gate, marker));
          removeEmpty();
        } else { fs.rmSync(preparing, { recursive: true, force: true }); }
      } catch (e) { throw new CoordinationUnavailableError(gate, e); }
    }
  };
  // Acquisition remains nonblocking. An owner update must not confuse a reader's short fence with
  // loss of its token. Only a FAILED fence acquisition retries; the callback itself is never replayed.
  const ownedFence = (fn) => {
    let result;
    for (let attempt = 0; attempt < 1000; attempt++) {
      result = fenced(fn);
      if (!result?.[fenceBusy]) return result;
      wait();
    }
    return result;
  };
  const read = () => {
    try { const r = JSON.parse(fs.readFileSync(join(path, 'owner.json'), 'utf8')); if (!r.token || !Number.isInteger(r.pid) || r.pid < 1 || !r.host || !Number.isFinite(r.heartbeatAt) || !Number.isFinite(r.acquiredAt)) throw new Error('Invalid lock owner'); return r; }
    catch (e) { if (e.code === 'ENOENT') { try { fs.statSync(path); } catch (s) { if (s.code === 'ENOENT') return null; throw s; } } throw e; }
  };
  const write = (record) => {
    const tmp = join(path, `owner.${randomUUID()}.tmp`);
    fs.writeFileSync(tmp, JSON.stringify(record)); fs.renameSync(tmp, join(path, 'owner.json'));
  };
  return fenced(() => {
    const previous = read(), at = milliseconds(now());
    if (previous) {
      const age = at - previous.heartbeatAt;
      const dead = previous.host === (owner.host ?? hostname()) && isPidAlive(previous.pid) === false;
      if (!dead && !(age >= 0 && age > staleMs) && !(at - previous.acquiredAt > maxHoldMs)) return { ok: false, reason: 'busy', heldBy: previous };
      fs.rmSync(path, { recursive: true });
    }
    fs.mkdirSync(path);
    const record = { ...owner, token: randomUUID(), acquiredAt: at, heartbeatAt: at };
    write(record);
    let released = false;
    return { ok: true, handle: {
      token: record.token,
      // The read/check/write transaction is fenced against stale stealing as one synchronous section.
      runIfOwned: (fn) => ownedFence(() => {
        if (read()?.token !== record.token || released || milliseconds(now()) - record.acquiredAt >= maxHoldMs) return { ok: false, reason: 'owner-lost' };
        return fn();
      }),
      heartbeat: () => ownedFence(() => {
        const current = read();
        if (current?.token !== record.token || released || milliseconds(now()) - record.acquiredAt >= maxHoldMs) return false;
        write({ ...current, heartbeatAt: milliseconds(now()) }); return true;
      }) === true,
      release: () => ownedFence(() => {
        if (released) return true;
        if (read()?.token !== record.token) return false;
        fs.rmSync(path, { recursive: true }); released = true; return true;
      }) === true,
    } };
  });
}
