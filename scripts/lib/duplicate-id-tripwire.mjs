/**
 * @file scripts/lib/duplicate-id-tripwire.mjs
 * @description Post-land DUPLICATE-NNN tripwire (#2318). The drain is the sole serial writer to main and JIT
 * numbering (#2288) makes two lanes racing to the same birth-NNN structurally rare — but a bug on ANY land
 * path could still put two backlog files at one numeric id on main. That is exactly what the #2316 double-land
 * did: two individually-green PRs (#179, #180) each passed `ids must be unique` against a main that did not YET
 * hold #2316, both landed in one drain pass, and — with no post-land duplicate detection anywhere on the merge
 * path — the duplicate sat silently on main and turned every open PR's required `test` check red globally.
 *
 * This module is the impossible-or-LOUD guarantee: a pure detector the land paths run AFTER each land (post
 * heal + numbering) so a surviving duplicate is caught deterministically and surfaced loudly, never left on
 * main to be discovered by the next red gate. Only NUMERIC ids can collide — a provisional `xNNNNNN` hash is
 * globally unique by construction (#2288), so a hash is never a duplicate; we group by the numeric id only.
 *
 * PURE — no fs mutation, no git. `findDuplicateIds` reads the directory; the caller owns the heal + git writes.
 */
import { readdirSync } from 'node:fs';
import { idFromName, isNum } from '../backlog/id.mjs';

/**
 * Find every numeric backlog id that is carried by MORE THAN ONE file in `backlogDir` — a duplicate that must
 * never reach main. Returns one entry per collided id (empty array = clean).
 * @param {string} backlogDir  absolute path to the `backlog/` directory
 * @returns {{ num: string, names: string[] }[]}  collided numeric ids, each with its ≥2 filenames
 */
export function findDuplicateIds(backlogDir) {
  const byNum = new Map(); // numeric id -> [filename, …]
  let entries;
  try { entries = readdirSync(backlogDir); }
  catch { return []; } // no backlog dir → nothing to check (never throw from a tripwire)
  for (const f of entries) {
    if (!f.endsWith('.md')) continue;
    const id = idFromName(f);
    if (!isNum(id)) continue; // a hash id is unique by construction — only numeric ids can collide
    if (!byNum.has(id)) byNum.set(id, []);
    byNum.get(id).push(f);
  }
  const dups = [];
  for (const [num, names] of byNum) if (names.length > 1) dups.push({ num, names: names.sort() });
  return dups.sort((a, b) => Number(a.num) - Number(b.num));
}

/** One-line human summary of a duplicate set for a loud stderr line. */
export function summarizeDuplicates(dups) {
  return dups.map((d) => `#${d.num} (${d.names.join(' + ')})`).join(', ');
}
