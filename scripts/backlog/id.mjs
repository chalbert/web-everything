/**
 * @file scripts/backlog/id.mjs
 * @description Canonical helpers for the two-form backlog id (#2288 — JIT backlog numbering).
 *
 * A backlog item is born with a collision-free HASH id (`x` + 6 base36 chars, e.g. `x7k2q9a`) so
 * parallel lanes never race on `max+1` at creation time (#2189 root cause, #2289 epic). The drain —
 * the sole serial writer to main (#2290) — rewrites the hash to the real sequential `NNN` just before
 * merge. So on disk a backlog filename leads with EITHER form:
 *   - `2288-slug.md`   — a LANDED item; the numeric `NNN` is its permanent, immutable id.
 *   - `x7k2q9a-slug.md` — a PROVISIONAL (in-flight) item, hash-keyed until the drain numbers it at land.
 *
 * The leading token (numeric or hash) is the item's `num`/id everywhere — a hash is a valid unique
 * key, so any consumer that keys off `num` abstractly needs no change. Only arithmetic (`max+1`) and
 * zero-padding must distinguish numeric from hash, hence `isNum()`/`isHash()` below. The hash's global
 * uniqueness (vs. slugs, which recur in prose) is what makes the drain's blind search-replace provably
 * safe.
 *
 * NOTE: `src/_data/backlog.js` (the 11ty loader) is CommonJS and cannot import this ESM module cleanly,
 * so it inlines the same `ID_TOKEN_RE` / slug pattern with a pointer comment back here — keep the two
 * in sync (there is one such duplication, deliberately).
 */

/** A provisional hash id: `x` + exactly 6 base36 chars. Non-numeric leading char so no `^\d` parser mis-reads it. */
export const HASH_RE = /^x[0-9a-z]{6}$/;

/**
 * A `bornAs:` frontmatter line carrying a birth-hash value (#2392) — the durable, cross-clone,
 * renumber-immune proof-of-land record. Anchored to a whole line so `applyLedger` can recognise (and
 * protect) it while blind-rewriting every OTHER hash token to its assigned NNN.
 */
export const BORN_AS_RE = /^bornAs:\s*x[0-9a-z]{6}\s*$/;

/**
 * The leading id TOKEN of a backlog filename stem or ref — numeric `NNN` (landed) OR `xNNNNNN` hash
 * (provisional). Anchored, followed by a `-` (before the slug) or end-of-string (a bare ref).
 */
export const ID_TOKEN_RE = /^(\d{1,5}|x[0-9a-z]{6})(?=-|$)/;

/** True for a provisional hash id (`x7k2q9a`). */
export const isHash = (id) => HASH_RE.test(String(id));

/** True for a landed numeric id (`2288`). */
export const isNum = (id) => /^\d{1,5}$/.test(String(id));

/** Extract the id token from a filename stem or `NNN`/`xNNNNNN[-slug]` ref; undefined if none. */
export const idFromName = (name) => (String(name).match(ID_TOKEN_RE) || [])[1];

/** The slug portion of a filename stem (leading id token + dash stripped). */
export const slugFromName = (stem) => String(stem).replace(/^(\d{1,5}|x[0-9a-z]{6})-/, '');

/**
 * Normalise a caller-supplied item ref to its canonical id: pad a numeric ref to 3 digits (`7` →
 * `007`), leave a hash untouched (`x7k2q9a`). Use everywhere a ref could be either form.
 */
export const normalizeId = (ref) => {
  const r = String(ref).trim();
  return isHash(r) ? r : (/^\d+$/.test(r) ? r.padStart(3, '0') : r);
};

/**
 * Mint a fresh collision-free hash id (`x` + 6 base36). Retries against `existingIds` (any ids already
 * in use — landed nums can't collide with a hash, but passing them all is cheap and harmless). Plain
 * `Math.random` is fine here: this runs in a node CLI, not a workflow script.
 *
 * NOTE: `existingIds` only sees the LOCAL checkout, so two concurrent lanes that can't see each other could
 * in principle mint the SAME hash (~1 in 2.2e9 with a 36^6 space). That mode is corrupting, not detected —
 * the drain would rename both to one NNN and blind-replace the shared token in both. Accepted given the
 * odds; a stronger guard would seed the taken-set from a shared source (the drain's ledger/queue).
 * @param {Iterable<string>} existingIds
 */
export function nextHash(existingIds = []) {
  const taken = new Set([...existingIds].map(String));
  for (let i = 0; i < 1000; i++) {
    const rand = Math.random().toString(36).slice(2).replace(/[^0-9a-z]/g, '');
    const h = 'x' + (rand + '000000').slice(0, 6);
    if (!taken.has(h)) return h;
  }
  throw new Error('nextHash: could not mint a collision-free hash after 1000 tries');
}

/**
 * Stamp the durable birth-hash record (`bornAs: <hash>`) into an item's YAML frontmatter — the sole
 * cross-clone, renumber-immune proof that this hash has landed (#2392). Inserted as the first field
 * right after the opening `---`. PURE (a string transform); the drain calls it on each item it is
 * numbering NOW, then `applyLedger` protects the value from the blind hash→NNN rewrite so it records
 * the ORIGINAL birth hash — the record `landedNumberFor` reads back off main. Idempotent: a file that
 * already carries a `bornAs` is returned unchanged; a file with no frontmatter delimiter is returned
 * unchanged (nothing to stamp).
 * @param {string} content  raw file text
 * @param {string} hash     the item's birth hash (`x`+6 base36)
 */
export function stampBornAs(content, hash) {
  if (content.split('\n').some((l) => BORN_AS_RE.test(l))) return content; // already stamped — never double
  return content.replace(/^---\n/, `---\nbornAs: ${hash}\n`);
}

/**
 * Compute the renames + content rewrites to number one-or-more provisional items — the PURE core of the
 * drain's at-land numbering (#2288). Given every backlog file (stem `name` + raw `content`) and a
 * `ledger` mapping each in-flight `hash → assigned NNN`, it returns:
 *   - `renames`  — `{from, to}` filename stems for every file whose leading id token is a ledgered hash.
 *   - `rewrites` — `{name, content}` for every file whose text changed (a ledgered hash token replaced).
 *
 * The replace is a BLIND, WHOLE-TOKEN swap of each hash → its NNN. It is provably safe because a hash
 * (`x` + 6 base36) is globally unique and never recurs in prose the way a slug does — so it correctly
 * catches the item's own frontmatter/body AND other items' `blockedBy`/`parent`/`#refs`, with no risk
 * of a spurious hit. Applying the WHOLE ledger at every land (not just the just-landed hash) is what
 * fixes a dependent that references an already-numbered blocker by its old hash (the cross-lane edge).
 * PURE — no FS/git; the drain does the `git mv` / write at its boundary.
 *
 * @param {{name:string, content:string}[]} files
 * @param {Record<string,string>} ledger  { hash: nnn }
 * @returns {{ renames: {from:string,to:string}[], rewrites: {name:string,content:string}[] }}
 */
export function applyLedger(files, ledger) {
  const entries = Object.entries(ledger).filter(([h]) => isHash(h));
  const renames = [];
  const rewrites = [];
  for (const { name, content } of files) {
    // Blind whole-token rewrite of every ledgered hash → its NNN, line by line, EXCEPT a `bornAs:` value
    // line — the birth-hash record must survive numbering. Clobbering it to the assigned NNN would erase
    // the sole cross-clone proof-of-land and deadlock the permanent strand the adversary found (#2392);
    // every OTHER hash cross-ref (`blockedBy`/`parent`/`#ref`/body) is still rewritten.
    let text = content
      .split('\n')
      .map((line) =>
        BORN_AS_RE.test(line)
          ? line
          : entries.reduce((l, [hash, nnn]) => l.replace(new RegExp(`\\b${hash}\\b`, 'g'), String(nnn)), line),
      )
      .join('\n');
    const idTok = idFromName(name);
    if (idTok && ledger[idTok] !== undefined && isHash(idTok)) {
      renames.push({ from: name, to: `${ledger[idTok]}-${slugFromName(name)}` });
      // Stamp the durable birth-hash proof-of-land on the item being numbered NOW (#2392) — AFTER the
      // rewrite above and with the ORIGINAL hash (`idTok`), so it records the pre-numbering id; the guard
      // above then preserves it verbatim on any later rewrite pass. Idempotent (stampBornAs no-ops if the
      // record already exists). This is why the item lands carrying its birth hash: bornAs-on-main and the
      // local ledger are both minted here from the same assignment, so they can never diverge.
      text = stampBornAs(text, idTok);
    }
    if (text !== content) rewrites.push({ name, content: text });
  }
  return { renames, rewrites };
}
