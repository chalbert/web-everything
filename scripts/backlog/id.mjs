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
 * A hash TOKEN shape (`x` + 6 base36), global — matches ANY hash-looking run of chars regardless of
 * whether it is ledgered. Shared by {@link swapWithMap} (the replace) and {@link ANY_HASH_RE}/the
 * path-rename scan (the detect); ONE pattern, never one-per-ledger-entry (xn6n5gp — audit finding D1).
 */
const HASH_TOKEN_RE = /\bx[0-9a-z]{6}\b/g;

/** Non-global sibling of {@link HASH_TOKEN_RE} for a cheap boolean "does this text carry ANY hash token at
 *  all" pre-check — lets a file/line with nothing to number skip the split/replace/scan work entirely. */
const ANY_HASH_RE = /\bx[0-9a-z]{6}\b/;

/**
 * A path-shaped run of characters that embeds AT LEAST ONE hash token and ends in a `.ext` — the on-disk
 * path-value shape {@link applyLedger}'s `pathRenames` looks for (a `relatedReport`, a body markdown link).
 * Generalised to "any hash", not one-per-ledger-entry (xn6n5gp finding D1: this specific regex, run once
 * per ledger entry per file, was ~76% of the pre-fix cost) — the ledger-membership filter is applied
 * AFTER the single scan, in {@link applyLedger}, not baked into the pattern.
 */
const PATH_HASH_RE = /(?<![\w./-])([\w./-]*\bx[0-9a-z]{6}\b[\w./-]*\.[\w]+)/g;

/**
 * Blind, whole-token swap of every hash in `map` → its `NNN` in `text`, via ONE regex scan + a Map lookup
 * per match (not one `RegExp` construction + scan per ledger entry, xn6n5gp finding D1). A hash token not
 * present in `map` is left untouched. Internal to this module — {@link swapHashes} (the public, array-based
 * API) and {@link applyLedger}'s per-line loop both funnel through this so the map is built ONCE per caller
 * rather than once per line.
 * @param {string} text
 * @param {Map<string,string>} map
 * @returns {string}
 */
function swapWithMap(text, map) {
  if (map.size === 0) return text;
  return text.replace(HASH_TOKEN_RE, (m) => (map.has(m) ? String(map.get(m)) : m));
}

/**
 * Blind, whole-token swap of every ledgered hash → its `NNN` in `text`. `entries` is the ledger's
 * `[hash, nnn]` pairs (already filtered to real hashes), OR a `Map<hash,nnn>` directly (avoids rebuilding
 * one when a caller already has it). Each hash (`x` + 6 base36) is globally unique and never recurs in
 * prose, so a word-boundary replace is provably safe. Shared by `applyLedger` (both the body-ref rewrite
 * and the path-token `from → to` computation) and the drain's on-disk report rewrite, so all three use ONE
 * definition of "apply the whole ledger" (no drift between them).
 *
 * xn6n5gp (audit finding D1, P0): previously built a FRESH `RegExp` per ledger entry and ran a full
 * `.replace()` scan per entry — O(entries) regex constructions × O(text) scans, repeated per LINE by
 * `applyLedger`'s old caller. Now ONE regex, reused via {@link swapWithMap}; behaviour (output) is
 * byte-identical, only the cost changed.
 * @param {string} text
 * @param {[string,string][]|Map<string,string>} entries
 * @returns {string}
 */
export function swapHashes(text, entries) {
  return swapWithMap(text, entries instanceof Map ? entries : new Map(entries));
}

/**
 * Visit explicit cross-references for cross-clone repair (#2903). Bare hashes in prose (including
 * birth-hash tables) are evidence, not pointers. Frontmatter reference fields accept both YAML
 * list styles; free-text fields such as resolutionNote are preserved as authored.
 * The existing local-ledger rewrite remains separate from this narrower fallback.
 */
export function mapHashReferences(content, visit) {
  let frontmatter = false;
  let referenceField = false;
  let fenced = false;
  return content.split('\n').map((line, index) => {
    if (line === '---' && (index === 0 || frontmatter)) {
      frontmatter = !frontmatter;
      return line;
    }
    if (frontmatter) {
      if (/^\S/.test(line)) referenceField = /^(blockedBy|parent|relatedTo|supersedes|supersededBy):/.test(line);
      return referenceField ? line.replace(/\bx[0-9a-z]{6}\b/g, visit) : line;
    }
    if (/^\s*(```|~~~)/.test(line)) { fenced = !fenced; return line; }
    if (fenced) return line;
    // Explicit #refs and backlog paths/URLs; a bare `bornAs` value is deliberately not matched.
    return line.replace(/#x[0-9a-z]{6}\b|backlog\/x[0-9a-z]{6}\b/g,
      (ref) => ref.replace(/x[0-9a-z]{6}/, visit));
  }).join('\n');
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
 * embeds a ledgered hash and return the `{from, to}` file rename for the drain to enact in the same land
 * commit — via this module's established `git rm` OLD + write-to-NEW convention (NOT `git mv`) + rewrite. Tokens under `backlog/` are excluded (those files are renamed via `renames`);
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
  if (entries.length === 0) return { renames, rewrites, pathRenames }; // nothing ledgered → nothing to do (no corpus scan at all)
  const ledgerMap = new Map(entries); // built ONCE for the whole call — xn6n5gp: not once per line/per file
  for (const { name, content } of files) {
    // xn6n5gp (audit finding D1, P0): a file whose CONTENT carries no hash token at all needs no per-line
    // split/replace and no path scan — skip straight to `text = content`. Cheap (one non-global regex test
    // over the whole file) and, for a corpus where only a small fraction of files ever mention a hash, the
    // single biggest win: it turns an O(files × ledger-entries) scan into an O(files-that-actually-mention-
    // a-hash) one. NOTE: this guards only the content scan — the file's OWN leading id token (the rename +
    // bornAs stamp below) is checked unconditionally, since a file being numbered may have zero OTHER hash
    // mentions in its body (e.g. a freshly-scaffolded item with no cross-refs yet).
    let text = content;
    if (ANY_HASH_RE.test(content)) {
      // Blind whole-token rewrite of every ledgered hash → its NNN, line by line, EXCEPT a `bornAs:` value
      // line — the birth-hash record must survive numbering. Clobbering it to the assigned NNN would erase
      // the sole cross-clone proof-of-land and deadlock the permanent strand the adversary found (#2392);
      // every OTHER hash cross-ref (`blockedBy`/`parent`/`#ref`/body) is still rewritten. Reuses the shared
      // map-based swap (#2400) per line, off the ONE map built above, so the body rewrite and the path/report
      // rewrites can't drift AND never rebuild a Map/RegExp per line (the pre-fix cost).
      text = content
        .split('\n')
        .map((line) => (BORN_AS_RE.test(line) ? line : swapWithMap(line, ledgerMap)))
        .join('\n');
      // Collect on-disk path values embedding ANY ledgered hash (see `pathRenames` in the doc above). ONE scan
      // of the ORIGINAL content (post-swap the hash is gone) with a hash-shape-generic pattern — not one
      // lookbehind regex re-scanning the WHOLE file per ledger entry (xn6n5gp finding D1: ~76% of the pre-fix
      // cost). Skip `backlog/*` — handled by `renames`. Each `from` is emitted ONCE, deduped, with a `to` that
      // applies the WHOLE ledger — a filename can embed TWO ledgered hashes (`reports/<hashA>-<hashB>-notes.md`),
      // and the body ref rewrites BOTH; computing `to` per-match (this hash only) would leave the other hash
      // unswapped → renamed file and rewritten ref disagree, re-creating the dangling-ref/hidden-report failure
      // this whole path-rename exists to prevent (#2400). A path segment may embed a hash that is NOT ledgered
      // this pass (some other in-flight item) alongside one that IS — check every hash found in the match, not
      // just the first, and require ANY of them to be ledgered before acting (matches the old per-entry-regex
      // behaviour exactly: each ledgered entry's own regex independently matched the full span).
      for (const m of content.matchAll(PATH_HASH_RE)) {
        const from = m[1];
        if (from.startsWith('backlog/') || pathSeen.has(from)) continue;
        const hashesInPath = from.match(HASH_TOKEN_RE) || [];
        if (!hashesInPath.some((h) => ledgerMap.has(h))) continue; // path embeds a hash, but none ledgered this pass
        pathSeen.add(from);
        pathRenames.push({ from, to: swapWithMap(from, ledgerMap) }); // whole-ledger swap → all embedded hashes numbered
      }
    }
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
  return { renames, rewrites, pathRenames };
}
