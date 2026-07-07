/**
 * @file scripts/backlog/renumber-collisions.mjs
 * @description Pure core for the merge-time NEW-ITEM id-collision renumber (#2071).
 *
 * Parallel `/workflow` lanes provably partition EDITS to existing files, but they do NOT partition
 * ID ALLOCATION for newly-created backlog items: each lane derives a new item's NNN as `max(existing)
 * + 1` from its OWN base view, so two lanes branching from the same base compute the SAME next id and
 * neither can see the other's not-yet-existing file. When both land, they collide on `#NNN` — the
 * disjointness checker is blind to it (the new file's path is in no lane's declared write-set at
 * partition time). It surfaces only at the standards gate (`ids must be unique`) and as an 11ty output
 * conflict, AFTER both have landed on main.
 *
 * The sanctioned resolution (backlog NNN ids are immutable): "newer yields" — the LATER-landing of the
 * two colliding new items is re-filed to the next free id, done as a REFILE (write the new file + delete
 * the old) NOT a `git mv` (which the #2071 guard-bash rule blocks as an illegal renumber; the fs write
 * from a sanctioned script bypasses the SHELL guard by construction). Crucially the renumber then
 * REWRITES EVERY INBOUND REFERENCE to the yielded id — `#NNN` short-refs, `/backlog/NNN/` and
 * `/backlog/NNN-slug/` URLs, and `parent:`/`blockedBy:` frontmatter edges — across the whole corpus, so
 * no link is left dangling (renumbering without a full reference sweep is worse than the collision).
 *
 * PURE — no fs, no process, no `Date`, no git. The CLI (scripts/backlog-renumber-collisions.mjs) globs
 * the backlog, derives per-file landing ordinals from git history, applies the plan's file writes/
 * deletes + rewrites, and re-runs the gate. This module only DECIDES: given the current file set (+ the
 * landing order that breaks a tie), it returns the collision plan and the reference-rewritten contents.
 * The same logic runs against the live backlog or an in-memory fixture in tests.
 *
 * BOUNDARIES (#2071):
 *   • Only NEW-ITEM id collisions — an id that BOTH lanes inherited from a shared ancestor is a real
 *     EDIT conflict (git already caught it), never an allocation race, and is never renumbered. The CLI
 *     encodes this by only considering ids introduced AT/AFTER the batch base (baseNums), and by never
 *     yielding an id present in the base.
 *   • Idempotent: with no collision the plan is empty → a no-op (a second run does nothing).
 */

/** Parse a `backlog/NNN-slug.md` filename into `{ num, slug }`, or `null` if it isn't one. */
export function parseBacklogFilename(name) {
  const m = String(name).match(/^(\d+)-(.+)\.md$/);
  if (!m) return null;
  return { num: m[1], slug: m[2] };
}

/**
 * Group backlog files by their NNN id and return only the ids with MORE THAN ONE file — the raw id
 * collisions. Each entry lists its files with the landing ordinal used to pick which one yields.
 *
 * @param {{ name: string, ordinal?: number }[]} files  Every `backlog/*.md` (name = basename). `ordinal`
 *   is the file's landing order on main (a git commit ordinal — higher = later-landing); when absent it
 *   defaults to 0 so a caller that can't derive git order still gets a deterministic (slug-broken) tie.
 * @returns {{ num: string, files: { name: string, slug: string, ordinal: number }[] }[]}
 */
export function findCollisions(files) {
  const byNum = new Map();
  for (const f of files) {
    const parsed = parseBacklogFilename(f.name);
    if (!parsed) continue;
    const entry = { name: f.name, slug: parsed.slug, ordinal: Number.isFinite(f.ordinal) ? f.ordinal : 0 };
    if (!byNum.has(parsed.num)) byNum.set(parsed.num, []);
    byNum.get(parsed.num).push(entry);
  }
  const out = [];
  for (const [num, group] of byNum) {
    if (group.length > 1) out.push({ num, files: group });
  }
  // Stable order by the colliding id so the plan (and its summary) is deterministic.
  out.sort((a, b) => Number(a.num) - Number(b.num));
  return out;
}

/**
 * Pick the file that YIELDS from a set of files colliding on one id: the LATER-landing one (highest
 * `ordinal` — "newer yields", the sanctioned rule). Ties (equal ordinal, e.g. both introduced in the
 * same octopus/no-git fixture) break by slug lexicographically so the choice is deterministic. The
 * NON-yielding files keep the id.
 * @returns {{ yielder: object, keepers: object[] }}
 */
export function pickYielder(group) {
  const sorted = [...group].sort((a, b) => (a.ordinal - b.ordinal) || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  const yielder = sorted[sorted.length - 1];
  const keepers = sorted.slice(0, -1);
  return { yielder, keepers };
}

/**
 * Allocate a fresh NNN for a yielding item: strictly greater than every id currently in use AND every
 * id already handed out earlier in THIS plan (so two yielders in one run never re-collide) AND never an
 * id present in the batch base (a base id is a real existing item, never free). Zero-padded to the
 * width of the largest input so the `NNN` convention holds.
 * @param {Set<string>} usedNums   every id currently on disk (all files, both sides of every collision)
 * @param {Set<string>} allocated  ids this plan has already assigned to earlier yielders
 * @param {Set<string>} baseNums   ids present in the batch base (never reused)
 */
export function allocateFreeNum(usedNums, allocated, baseNums) {
  let max = 0;
  let width = 3;
  for (const s of [...usedNums, ...allocated, ...baseNums]) {
    const n = Number(s);
    if (Number.isFinite(n)) max = Math.max(max, n);
    width = Math.max(width, String(s).length);
  }
  const taken = (n) => {
    const p = String(n).padStart(width, '0');
    return usedNums.has(p) || allocated.has(p) || baseNums.has(p) ||
      usedNums.has(String(n)) || allocated.has(String(n)) || baseNums.has(String(n));
  };
  let cand = max + 1;
  while (taken(cand)) cand++;
  return String(cand).padStart(width, '0');
}

/**
 * Allocate a free GAP id BELOW the `max+1` allocation frontier (#2222). Where `allocateFreeNum` hands out
 * `max+1` — the SAME id a concurrent `backlog.mjs scaffold` computes, so two heals/scaffolds racing on the
 * same base can immediately re-collide — this instead takes the HIGHEST free id below `max` (the hole nearest
 * the frontier, i.e. a recently-freed slot from a prior yield). A concurrent scaffold takes `max+1`, so a slot
 * below `max` can never re-collide with it. Scanning DOWN from the frontier (not up from the min) is deliberate:
 * the backlog carries ancient low ids (single-digit legacy items) with a vast empty range beneath the active
 * frontier, so an upward scan would hand out an absurd id like `#3`; the nearest-the-frontier hole is the only
 * sensible gap. Falls back to `allocateFreeNum` (the frontier) only when the top of the range is fully dense
 * (no hole below `max`) — the unavoidable edge. Zero-padded to the widest input so the `NNN` convention holds.
 * @param {Set<string>} usedNums   every id currently in use (lane corpus ∪ base)
 * @param {Set<string>} allocated  ids this plan already handed to earlier yielders (never re-used)
 * @param {Set<string>} baseNums   ids present on the merge base (never re-used — a live item owns each)
 */
export function allocateGapId(usedNums, allocated = new Set(), baseNums = new Set()) {
  let max = 0;
  let min = Infinity;
  let width = 3;
  for (const s of [...usedNums, ...allocated, ...baseNums]) {
    const n = Number(s);
    if (Number.isFinite(n)) { max = Math.max(max, n); min = Math.min(min, n); }
    width = Math.max(width, String(s).length);
  }
  const taken = (n) => {
    const p = String(n).padStart(width, '0');
    return usedNums.has(p) || allocated.has(p) || baseNums.has(p) ||
      usedNums.has(String(n)) || allocated.has(String(n)) || baseNums.has(String(n));
  };
  // Take the highest free slot below `max` (the hole nearest the frontier). `>= max+1` is the frontier a
  // concurrent scaffold owns (the re-collision we avoid); `<= min` would be an absurd ancient-range id.
  for (let cand = max - 1; cand > min; cand--) {
    if (!taken(cand)) return String(cand).padStart(width, '0');
  }
  // The top of the range is dense — no hole below `max`; fall back to the frontier allocator (max+1).
  return allocateFreeNum(usedNums, allocated, baseNums);
}

/**
 * Rewrite every inbound reference to the YIELDING item so it points at `newNum`, across one file's text.
 * Covers the four reference shapes the acceptance enumerates:
 *   • `#NNN` short-refs (id-bounded so `#2068` never matches inside `#20680`)
 *   • `/backlog/NNN/` (bare redirect URL) and `/backlog/NNN-slug/` (canonical, slug-bearing) URLs
 *   • `parent: "NNN"` / `parent: NNN` and `blockedBy: [..., NNN, ...]` frontmatter edges (quoted or bare)
 *
 * SLUG-DISAMBIGUATION (the load-bearing correctness half). At the moment of a renumber TWO items share
 * `oldNum`: the yielder (moving to `newNum`) and one-or-more keepers (staying at `oldNum`). A
 * SLUG-BEARING canonical URL `/backlog/NNN-slug/` names a SPECIFIC item — so it is rewritten ONLY when
 * its slug matches the YIELDER's slug (`yieldSlug`); a `/backlog/NNN-keeperslug/` URL points at an item
 * that KEEPS the id and MUST be left alone. The inherently-ambiguous shapes (`#NNN`, the bare
 * `/backlog/NNN/` redirect, and `parent:`/`blockedBy:` edges — none of which carry a slug) are rewritten
 * to `newNum`: a same-base parallel collision means any inbound `#NNN`/edge authored in that batch was
 * pointing at the new item, and leaving them at the now-freed `oldNum` (which the keeper still owns)
 * would silently re-target them at the WRONG item. Ids are matched with a trailing non-digit boundary so
 * a longer id that merely STARTS with `oldNum` (e.g. `20680`) is never corrupted. Returns the rewritten
 * text (unchanged when there is no inbound ref).
 *
 * @param {string} text
 * @param {string} oldNum
 * @param {string} newNum
 * @param {string} [yieldSlug]  the yielding item's slug — gates the slug-bearing URL rewrite. When
 *   omitted, slug-bearing URLs are rewritten by num alone (back-compat / no-keeper case).
 */
export function rewriteRefs(text, oldNum, newNum, yieldSlug) {
  const o = escapeRe(oldNum);
  let out = text;
  // `#NNN` short-ref: `#` + the id + a non-digit (or end).
  out = out.replace(new RegExp(`#${o}(?![0-9])`, 'g'), `#${newNum}`);
  // Slug-bearing canonical URL `/backlog/NNN-slug/`: rewrite ONLY when the slug is the yielder's (so a
  // keeper's URL is untouched). When yieldSlug is unknown, fall back to a num-only slugged rewrite.
  if (yieldSlug) {
    out = out.replace(new RegExp(`(/backlog/)${o}-${escapeRe(yieldSlug)}(?=[/\\s"')\\]])`, 'g'), `$1${newNum}-${yieldSlug}`);
  } else {
    out = out.replace(new RegExp(`(/backlog/)${o}(?=-)`, 'g'), `$1${newNum}`);
  }
  // Bare redirect URL `/backlog/NNN/` (no slug) — inherently ambiguous, rewrite to the new id.
  out = out.replace(new RegExp(`(/backlog/)${o}(?=/)`, 'g'), `$1${newNum}`);
  // Frontmatter edges: `parent:`/`blockedBy:` entries as a quoted or bare id, id-bounded.
  //   quoted:  "NNN"  →  "newNum"
  out = out.replace(new RegExp(`(["'])${o}(["'])`, 'g'), `$1${newNum}$2`);
  //   bare inside a `blockedBy: [ … ]` list or a bare `parent:`  →  id-bounded to avoid substring hits.
  out = out.replace(new RegExp(`(\\b(?:blockedBy|parent):[^\\n]*?[\\[,\\s])${o}(?![0-9])`, 'g'), `$1${newNum}`);
  return out;
}

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build the full renumber PLAN for a backlog state. Given every file (name + text + landing ordinal)
 * and the batch base ids, returns for each colliding NEW-item id the yielder that moves, its fresh id,
 * the new filename, and the corpus-wide reference rewrites — plus the yielder's OWN content re-filed
 * under the new name (its self-references, e.g. a redirect back to itself, are rewritten too).
 *
 * The plan is DATA the CLI executes: `writes` (path → content: the new yielded file + every file whose
 * refs changed), `deletes` (the old yielded filenames — the refile's remove half). An empty plan means
 * no collision → the CLI is a no-op (idempotent).
 *
 * @param {{ name: string, text: string, ordinal?: number }[]} files
 * @param {{ baseNums?: string[], ontoNames?: string[] }} [opts]
 *   baseNums   — ids present at the batch base (`--base-ref` for the parallel integrator): never yielded /
 *                reused, and a base id appearing twice is skipped (a real edit conflict, not an allocation race).
 *   ontoNames  — basenames of the backlog files PUBLISHED on the branch being landed onto (`--onto-ref` for a
 *                single/resume land, #2213). Those files are immutable KEEPERS; a colliding file NOT among them
 *                is the incoming lane's new file and yields — regardless of git ordinal (which, for a lane that
 *                authored first but lands last, wrongly points at the already-published item).
 * @returns {{
 *   collisions: { oldNum: string, newNum: string, oldName: string, newName: string, slug: string }[],
 *   writes: { name: string, text: string }[],
 *   deletes: string[],
 *   summary: string,
 * }}
 */
export function planRenumber(files, { baseNums = [], ontoNames = [] } = {}) {
  const baseSet = new Set(baseNums.map(String));
  const ontoSet = new Set(ontoNames.map(String));
  const collisions = findCollisions(files);
  const usedNums = new Set();
  for (const f of files) {
    const p = parseBacklogFilename(f.name);
    if (p) usedNums.add(p.num);
  }
  const allocated = new Set();
  const moves = []; // { oldNum, newNum, oldName, newName, slug }
  for (const group of collisions) {
    // #2213 — RESUME/single land: some colliding file(s) are already PUBLISHED on the branch being landed onto.
    // Those are immutable keepers; only the incoming (non-published) file yields — never the live main item,
    // even though its git ordinal is higher (it landed later). This precedes the ordinal heuristic below.
    const published = group.files.filter((f) => ontoSet.has(f.name));
    if (published.length > 0) {
      const incoming = group.files.filter((f) => !ontoSet.has(f.name));
      if (incoming.length === 0) continue; // every colliding file is already published — a genuine edit conflict, skip
      const { yielder } = pickYielder(incoming);
      const newNum = allocateFreeNum(usedNums, allocated, baseSet);
      allocated.add(newNum);
      moves.push({ oldNum: group.num, newNum, oldName: yielder.name, newName: `${newNum}-${yielder.slug}.md`, slug: yielder.slug });
      continue;
    }
    // BOUNDARY (#2071): never renumber an id that predates the batch base — a base id present twice is a
    // real edit conflict git already flagged, not an allocation race. Skip the whole group in that case.
    if (baseSet.has(group.num)) continue;
    const { yielder } = pickYielder(group.files);
    const newNum = allocateFreeNum(usedNums, allocated, baseSet);
    allocated.add(newNum);
    const newName = `${newNum}-${yielder.slug}.md`;
    moves.push({ oldNum: group.num, newNum, oldName: yielder.name, newName, slug: yielder.slug });
  }

  // Apply the reference sweep. Every move rewrites refs to its oldNum across every NON-published file
  // (including the yielded file's own content, then re-filed under the new name). Writes are keyed by
  // CURRENT name so stacked moves compose; the yielded file's writes are re-keyed to its new name at the end.
  //
  // #2316 — EDGE-CLOBBER GUARD: a file named in `ontoNames` is a PUBLISHED/immutable item (the RESUME-LAND
  // keeper set) whose content predates this batch entirely. Any `#NNN`/`blockedBy` edge inside it was authored
  // against whatever already held that num on the published branch — never against an incoming, not-yet-landed
  // yielder — so it must never be rewritten here, even when its num happens to equal some OTHER group's oldNum
  // (e.g. main's `#2295` legitimately `blockedBy: [2294]` pointing at the real keeper #2294 must stay put, even
  // though this run also yields a DIFFERENT, unrelated new item away from #2294).
  const contentByName = new Map(files.map((f) => [f.name, f.text]));
  const renamed = new Map(); // oldName -> newName (for the yielded files)
  for (const mv of moves) renamed.set(mv.oldName, mv.newName);

  const touched = new Set();
  for (const mv of moves) {
    for (const [name, text] of contentByName) {
      if (ontoSet.has(name)) continue;
      const next = rewriteRefs(text, mv.oldNum, mv.newNum, mv.slug);
      if (next !== text) {
        contentByName.set(name, next);
        touched.add(name);
      }
    }
  }

  const writes = [];
  for (const name of touched) {
    const finalName = renamed.get(name) || name;
    writes.push({ name: finalName, text: contentByName.get(name) });
  }
  // A yielded file whose OWN content had no inbound ref still must be re-filed under its new name.
  for (const mv of moves) {
    if (!touched.has(mv.oldName)) writes.push({ name: mv.newName, text: contentByName.get(mv.oldName) });
  }
  const deletes = moves.map((m) => m.oldName);

  const summary = moves.length === 0
    ? 'No new-item id collision — nothing to renumber (no-op).'
    : moves.map((m) => `#${m.oldNum} → #${m.newNum} (${m.slug}): re-filed ${m.oldName} → ${m.newName}`).join('\n');

  return { collisions: moves, writes, deletes, summary };
}
