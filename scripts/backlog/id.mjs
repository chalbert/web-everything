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
 *
 * `pathRenames` (#2400) — a hash also embeds in ON-DISK PATH VALUES: a `relatedReport` whose report
 * filename stem IS the item's own birth hash, or a body markdown link to `reports/…-<hash>.md`. The
 * blind swap above rewrites the *reference* correctly, but the referenced *file* is NOT one of `files`
 * (it lives outside `backlog/`), so nothing renames it — the ref would dangle + the report would be
 * hidden on main (the #2387 red-main regression). So we also collect every path-shaped token that
 * embeds a ledgered hash and return the `{from, to}` file rename for the drain to `git mv` + rewrite in
 * the same land commit. Tokens under `backlog/` are excluded (those files are renamed via `renames`);
 * a `/backlog/<hash>/` URL has no extension so it isn't matched here — its ref-rewrite to
 * `/backlog/<NNN>/` is correct and needs no file rename. PURE (pattern only): the drain verifies the
 * file EXISTS before acting, so a path token with no on-disk file (a bare URL, a prose mention) is a
 * harmless no-op.
 *
 * PURE — no FS/git; the drain does the `git mv` / write at its boundary.
 *
 * @param {{name:string, content:string}[]} files
 * @param {Record<string,string>} ledger  { hash: nnn }
 * @returns {{ renames: {from:string,to:string}[], rewrites: {name:string,content:string}[], pathRenames: {from:string,to:string}[] }}
 */
export function applyLedger(files, ledger) {
  const entries = Object.entries(ledger).filter(([h]) => isHash(h));
  const renames = [];
  const rewrites = [];
  const pathRenames = [];
  const pathSeen = new Set();
  for (const { name, content } of files) {
    let text = content;
    for (const [hash, nnn] of entries) {
      text = text.replace(new RegExp(`\\b${hash}\\b`, 'g'), String(nnn));
      // Collect on-disk path values embedding this hash (see `pathRenames` in the doc above). Match a
      // path-shaped run (dir/file chars) that carries the hash AND ends in a `.ext`; scan the ORIGINAL
      // content (post-swap the hash is gone). Skip `backlog/*` — handled by `renames`.
      const pathRe = new RegExp(`(?<![\\w./-])([\\w./-]*\\b${hash}\\b[\\w./-]*\\.[\\w]+)`, 'g');
      for (const m of content.matchAll(pathRe)) {
        const from = m[1];
        if (from.startsWith('backlog/') || pathSeen.has(from)) continue;
        const to = from.replace(new RegExp(`\\b${hash}\\b`, 'g'), String(nnn));
        if (to === from) continue;
        pathSeen.add(from);
        pathRenames.push({ from, to });
      }
    }
    const idTok = idFromName(name);
    if (idTok && ledger[idTok] !== undefined && isHash(idTok)) {
      renames.push({ from: name, to: `${ledger[idTok]}-${slugFromName(name)}` });
    }
    if (text !== content) rewrites.push({ name, content: text });
  }
  return { renames, rewrites, pathRenames };
}
