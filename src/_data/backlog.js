// The backlog feeds entirely off a directory of markdown files — one per item:
//
//   backlog/<id>.md
//     ---
//     type / status / dateOpened / tags / relatedReport / relatedProject /
//     crossRef / graduatedTo            (metadata only — the registry fields)
//     ---
//     # Title
//     First paragraph (the summary)…
//     …the rest is the detail-page body.
//
// EVERYTHING shown — title, description, detail-page body — is derived from
// markdown, never from hand-typed frontmatter strings:
//   • an item with its own markdown body → title = its H1, summary = its first
//     paragraph, details = the rendered body.
//   • a pointer item (a `relatedReport` and NO body) → it MIRRORS the report:
//     title/summary/details are loaded from the report md itself.
//
// This `.js` data file is the single loader: it parses backlog/*.md into the
// `backlog` array the pages (backlog.njk, backlog-pages.njk) and the validator
// (scripts/check-standards.mjs) all consume. There is no backlog.json.
const { readdirSync, readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');
const matter = require('gray-matter');
const MarkdownIt = require('markdown-it');

const md = new MarkdownIt({ html: true, linkify: true, typographer: true });
const BACKLOG_DIR = join(__dirname, '../../backlog');
const ROOT = join(__dirname, '../..');

const toDateString = (v) =>
  v instanceof Date ? v.toISOString().slice(0, 10) : v;

// Infer an item's repo-LOCUS when no explicit `locus:` is authored. Two PRECISE signals only — locus is
// "which gate/loop honestly CLOSES the item", so the signal must indicate where it BUILDS, never mere
// provenance. The big noise source is the `exercise-app` *tag*, which WE standards/blocks carry to mean
// "surfaced by an exercise app" (a discovery marker), NOT "lives in the exercise app" — so exercise-app
// locus is detected STRUCTURALLY (a descendant of the flagship-exercise-apps epic #314, immutable NNN),
// via {@link isExerciseAppDescendant}, never the tag. The remaining tag markers are high-precision build
// signals. Values stay a subset of check-standards-rules.mjs `LOCI` keys; an explicit `locus:` always wins.
const EXERCISE_APP_ROOT = '314'; // #314 flagship-exercise-apps — its descendants run via the /exercise-app loop
const LOCUS_TAG_MARKERS = [
  [/frontier-?ui/i, 'frontierui'],
  [/technical-configurator|intent-configurator|dev-browser|\bplateau-app\b/i, 'plateau-app'],
];
function inferLocusFromTags(tags) {
  const joined = (Array.isArray(tags) ? tags : []).join(' ');
  for (const [re, locus] of LOCUS_TAG_MARKERS) if (re.test(joined)) return locus;
  return 'webeverything';
}
// Walk the `parent` chain (via the num→item map) looking for the exercise-app root. Cycle-guarded.
function isExerciseAppDescendant(item, byNum) {
  const seen = new Set();
  let cur = item;
  while (cur && cur.parent != null && !seen.has(String(cur.parent))) {
    const pnum = String(cur.parent);
    if (pnum === EXERCISE_APP_ROOT) return true;
    seen.add(pnum);
    cur = byNum.get(pnum);
  }
  return false;
}

// Strip inline markdown so a line makes a clean one-line summary.
const stripInline = (s) => s
  .replace(/`([^`]+)`/g, '$1')
  .replace(/\*\*([^*]+)\*\*/g, '$1')
  .replace(/\*([^*]+)\*/g, '$1')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  .trim();

// First real paragraph of a markdown body (skips headings/rules/quotes/lists/code/meta).
function firstParagraph(body) {
  const buf = [];
  for (const raw of body.split('\n')) {
    const l = raw.trim();
    const skip = !l || l === '---' || /^#/.test(l) || /^>/.test(l)
      || /^```/.test(l) || /^[-*|]/.test(l) || /^\*\*[^*]+:\*\*/.test(l);
    if (skip) { if (buf.length) break; else continue; }
    buf.push(l);
  }
  return buf.length ? buf.join(' ') : undefined;
}

// Derive { title, summary, details } from a markdown document.
// Reports carry a metadata block (Date/Point/…) before a `---` rule and a
// `**Point:**` lead; item bodies are plain (H1 + paragraphs).
function derive(text, { isReport = false } = {}) {
  const titleMatch = text.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : undefined;

  let lead;
  let bodyMd;
  if (isReport) {
    const meta = text.match(/\*\*(?:Point|Goal|Subject|Scope|Purpose|Summary):\*\*\s*(.+)/i);
    if (meta) lead = stripInline(meta[1]);
    const hrIdx = text.search(/^\s*---\s*$/m); // drop the H1 + metadata block
    bodyMd = hrIdx !== -1
      ? text.slice(text.indexOf('\n', hrIdx) + 1).trimStart()
      : (titleMatch ? text.replace(titleMatch[0], '').trimStart() : text);
  } else {
    bodyMd = titleMatch ? text.replace(titleMatch[0], '').trimStart() : text;
  }

  if (!lead) { const p = firstParagraph(bodyMd); if (p) lead = stripInline(p); }
  return {
    title,
    summary: lead,
    details: bodyMd.trim() ? md.render(bodyMd) : undefined,
  };
}

function loadReport(relPath) {
  const p = join(ROOT, relPath);
  if (!existsSync(p)) return null;
  const { content } = matter(readFileSync(p, 'utf8')); // reports have no frontmatter
  return derive(content, { isReport: true });
}

module.exports = function backlog() {
  // Malformed YAML frontmatter in ONE item must not take down the whole load (#430): a single bad
  // file (the recurring trigger is a `graduatedTo:`/scalar value with an unquoted colon, which
  // js-yaml reads as a nested mapping and throws on) would otherwise hard-crash every consumer —
  // Eleventy, check:readiness, check:standards. We catch per-item, skip the bad file, and collect
  // it so the failure degrades to a reported warning, not a crash.
  const malformed = [];
  const items = readdirSync(BACKLOG_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((file) => {
      const id = file.replace(/\.md$/, '');
      // Filenames are `NNN-slug.md`: `num` (the leading NNN) is the stable unique id shown as
      // "#042" and used for short references; `slug` is the human-readable text. `id` stays the
      // full filename stem so it remains the route key (permalink = /backlog/<id>/).
      const num = (id.match(/^(\d+)-/) || [])[1];
      const slug = id.replace(/^\d+-/, '');
      let data, content;
      try {
        ({ data, content } = matter(readFileSync(join(BACKLOG_DIR, file), 'utf8')));
      } catch (err) {
        // Skip-and-report: one malformed item is a warning, never a crash.
        malformed.push({ file, reason: err.reason || err.message });
        return null;
      }
      const ownBody = content.trim();

      // Own markdown body wins; else mirror the related report; else nothing.
      const src = ownBody
        ? derive(ownBody)
        : (typeof data.relatedReport === 'string' ? loadReport(data.relatedReport) : null) || {};

      const reportDate = typeof data.relatedReport === 'string'
        ? (data.relatedReport.match(/(\d{4}-\d{2}-\d{2})/) || [])[1]
        : undefined;

      return {
        ...data,
        id,
        num,
        slug,
        title: src.title || data.title || id,
        summary: src.summary || data.summary,
        dateOpened: toDateString(data.dateOpened),
        dateStarted: toDateString(data.dateStarted),
        dateResolved: toDateString(data.dateResolved),
        reportDate,
        details: src.details || data.details || undefined,
      };
    })
    .filter(Boolean); // drop items whose frontmatter failed to parse (reported below)

  if (malformed.length) {
    const lines = malformed.map((m) => `  • ${m.file} — ${m.reason}`).join('\n');
    console.warn(
      `[backlog] ${malformed.length} item(s) skipped — malformed YAML frontmatter ` +
        `(fix the file; an unquoted colon in a scalar is the usual cause):\n${lines}`,
    );
  }

  // Resolve `blockedBy: ["NNN", …]` (a directional prerequisite edge — "cannot start until NNN is
  // resolved", distinct from the "see also" `crossRef` and the epic-grouping `parent`) into a
  // `blockers` array of lightweight references, so a detail page can link each prerequisite.
  // Kept lightweight ({ id, num, slug, title, status }) rather than full item objects to avoid
  // cyclic refs. The validator (check-standards.mjs) guards unresolvable / self / cyclic edges;
  // here we simply drop any NNN that doesn't resolve so a page never renders a dead link.
  const byNum = new Map(items.map((it) => [it.num, it]));

  // D3-READINESS (#608) — a build can't be agent-ready if the STANDARD it builds into doesn't exist
  // yet. `check:standards` gates on mechanics (tier + size + resolved `blockedBy`); it never asks
  // whether the item's `relatedProject` is a real, shipped project. So an open issue/idea whose
  // `relatedProject` is still `status: concept` AND has NO shipped surface is "project-pending": the
  // project must exist first, so the item is NOT truly batchable however clean its frontmatter looks.
  //
  // Precision mirrors the audit's D3 fix (#613): a `concept` project with substantial SHIPPED work is
  // data-drift (the status lags reality — see #617), NOT a pending project, so its dependents stay
  // ready. The deterministic shipped-surface proxy is "has ≥1 resolved item filed against it" — webplugs
  // (0 resolved, pending the #606 ownership ruling) is pending; webblocks/webdocs (many resolved,
  // mislabeled concept) are not. We never demote on a `concept` label alone.
  let projectStatus = new Map();
  try {
    const projects = JSON.parse(readFileSync(join(ROOT, 'src/_data/projects.json'), 'utf8'));
    projectStatus = new Map(projects.map((p) => [p.id, p.status]));
  } catch { /* missing/malformed projects.json → no D3-readiness demotion (degrade, don't crash) */ }
  const resolvedByProject = new Map();
  for (const it of items) {
    if (it.status === 'resolved' && typeof it.relatedProject === 'string') {
      resolvedByProject.set(it.relatedProject, (resolvedByProject.get(it.relatedProject) || 0) + 1);
    }
  }

  for (const item of items) {
    const edges = Array.isArray(item.blockedBy) ? item.blockedBy : [];
    item.blockers = edges
      .map((n) => byNum.get(String(n)))
      .filter(Boolean)
      .map(({ id, num, slug, title, status }) => ({ id, num, slug, title, status }));

    // Derived agent-readiness tier — a DETERMINISTIC pure function of structured frontmatter only
    // (type + resolved prerequisites), so it's identical across rebuilds, no LLM in the path. It
    // mirrors the four-signal rubric in docs/agent/backlog-workflow.md but ONLY its structurally
    // decidable core: the two prose signals (body verbs, whether the `relatedReport` is a settled
    // plan) are deliberately not read here, which is why the tier is an agent-ready *hint*, not a
    // guarantee — the LLM selection pass still refines it. Only `open` items carry a tier; for
    // active/resolved/parked items readiness is moot (already claimed, done, or shelved), so they
    // get none (and thus no chip / no tier-filter effect).
    //   A — agent-ready:  issue/idea with every blocker resolved (nothing structural blocks a start).
    //   B — one nod away: a `decision` (it typically already states a recommendation, but that nuance
    //                      is prose, so the structural proxy is just the type) — ratify, then build.
    //   C — needs design / not ready: everything else open — an issue/idea with an unresolved
    //                      blocker.
    // D3-readiness (#608): the build's standard must exist first. `projectPending` ⇒ the
    // `relatedProject` is a `concept` project with zero shipped (resolved) surface — not mere
    // status-drift (a concept label over real work, see #617), but a project that genuinely isn't
    // built yet. Such a build is NOT agent-ready even with every `blockedBy` resolved, so it is
    // demoted out of Tier A (it falls to C, alongside structurally-blocked work). Exposed as its own
    // field so the detail page, check:standards, and the audit can name the reason precisely.
    item.relatedProjectStatus = typeof item.relatedProject === 'string'
      ? (projectStatus.get(item.relatedProject) ?? 'unknown') : undefined;
    item.projectPending = item.status === 'open'
      && (item.type === 'issue' || item.type === 'idea')
      && item.relatedProjectStatus === 'concept'
      && !(resolvedByProject.get(item.relatedProject) > 0);

    item.tier = item.status !== 'open' ? undefined
      : ((item.type === 'issue' || item.type === 'idea')
          && item.blockers.every((b) => b.status === 'resolved')
          && !item.projectPending) ? 'A'
      : item.type === 'decision' ? 'B'
      : 'C';

    // Batchable (deterministic) — the candidate set a POINTS-BUDGETED batch may pack
    // (docs/agent/backlog-workflow.md → "Running a batch"): a Tier-A item small enough to chain — a
    // `task` (bounded sub-work, never sized), or a `story` of `size` ≤ 8. A `story` of `size` ≥ 13 and
    // any `epic` are agent-ready but never batched. So `batchable` ⊂ `tier === 'A'`. There is no
    // separate ≤3 "core" tier: the budget packs SMALLEST-FIRST (the selection rank orders by effort),
    // reaching a single `size·8` only when the remaining budget fits — one pool, ordered by `batchCost`.
    // The one non-structural guard the batch skill adds — no buried design fork in the body — can't be
    // decided from fields, so this flag is the size+tier gate; selection still skims the body for a fork.
    item.batchable = item.tier === 'A' && (
      item.workItem === 'task' ||
      (item.workItem === 'story' && typeof item.size === 'number' && item.size <= 8)
    );

    // An open, unblocked `epic` clears every prerequisite (so it's Tier A) but an agent can't BUILD it
    // directly — its work lives in child stories/tasks. It is ready to be SLICED, not implemented. We
    // surface that as its own readiness class so the Prioritisation tab doesn't tally a container epic
    // as buildable work standing NEXT TO the very slices its work already lives in (a visual double-
    // count — the complaint that drove this). `batchable` ⊂ Tier A and `sliceable` ⊂ Tier A are disjoint:
    // an epic is never batchable, a task/story is never sliceable. A `story·≥13` stays plain agent-ready
    // (real buildable work, just beyond the batch pool) — only epics peel off.
    item.sliceable = item.tier === 'A' && item.workItem === 'epic';

    // Batch COST (deterministic) — the context-budget weight used to pack a POINTS-BUDGETED batch
    // (docs/agent/backlog-workflow.md → "Running a batch"). Distinct from burndown `size`: a `task`
    // carries no burndown points (they roll up to a parent) but still consumes a session's context, so
    // it is weighted at a nominal TASK_COST (2). A `story`/unstoried-epic uses its own `size`. The
    // budget sums this, NOT burndown `size`, so a task-heavy chain can't slip through "free".
    item.batchCost = item.workItem === 'task' ? 2
      : typeof item.size === 'number' ? item.size
      : undefined;

    // Repo-LOCUS (#447-follow / #498/#500 / backlog-workflow.md → "Repo-locus") — which repo's gate can
    // honestly CLOSE this item, i.e. its **gate home**. A cross-locus `/batch` is locus-agnostic: it packs
    // items of any locus and gates EACH in its own locus (the LOCI registry's `gateCommand`/`repoPath`), so
    // no item is dropped for locus — but the locus must be RIGHT, since it selects which gate runs. The
    // locus is `locus:` frontmatter when AUTHORED (an explicit decision — e.g. a frontier-ui-tagged item
    // built and gated IN WE declares `locus: webeverything`), else INFERRED from cross-repo tag markers
    // (biasing toward `webeverything` — a wrongly-inferred cross-repo locus would route close-out to the
    // wrong repo's gate, so inference only fires on high-precision structural/tag markers), else
    // `webeverything`. `locusAuthored` lets check:standards nudge unset-but-inferred items to
    // declare it explicitly. Inferred values are a subset of check-standards-rules.mjs `LOCI` keys.
    item.locusAuthored = typeof item.locus === 'string' && item.locus.length > 0;
    item.locus = item.locusAuthored ? item.locus
      : isExerciseAppDescendant(item, byNum) ? 'exercise-app'
      : inferLocusFromTags(item.tags);
  }

  // Reverse dependency edges + unblock-leverage (#254) — INVERT `blockedBy` so each item knows who
  // depends on it, then score how much work resolving it would free. A pure, deterministic function of
  // the structured edge set (no body parsing, no LLM), so it's identical across rebuilds — the same
  // "downstream-unblock leverage" the next-backlog-item skill ranks by, made visible on /backlog/.
  const dependentsByNum = new Map(items.map((it) => [it.num, []]));
  for (const item of items) {
    for (const b of item.blockers) {
      // `b` is a resolvable prerequisite of `item` → `item` is a dependent of `b`.
      if (dependentsByNum.has(b.num)) dependentsByNum.get(b.num).push(item);
    }
  }
  const isOpen = (it) => it.status === 'open';
  // Distinct OPEN items reachable along the reverse-dependency chain (the full set an item ultimately
  // gates). Memoised DFS; the validator forbids cycles, but the in-stack guard keeps a stray cycle from
  // looping forever (it just stops descending at the back-edge). DAG ⇒ the memo is always complete.
  const transOpenCache = new Map();
  function transitiveOpenDependents(num, stack = new Set()) {
    if (transOpenCache.has(num)) return transOpenCache.get(num);
    if (stack.has(num)) return new Set(); // cycle guard
    stack.add(num);
    const acc = new Set();
    for (const dep of dependentsByNum.get(num) || []) {
      if (isOpen(dep)) acc.add(dep.num);
      for (const n of transitiveOpenDependents(dep.num, stack)) acc.add(n);
    }
    stack.delete(num);
    transOpenCache.set(num, acc);
    return acc;
  }
  for (const item of items) {
    const directDeps = dependentsByNum.get(item.num) || [];
    const openDirect = directDeps.filter(isOpen);
    item.dependents = directDeps.map(({ id, num, slug, title, status }) => ({ id, num, slug, title, status }));
    item.directUnblocks = openDirect.length; // open items directly blocked by this one
    item.transitiveUnblocks = transitiveOpenDependents(item.num).size; // all open items it ultimately gates
    // The dependents that would flip to agent-ready if THIS item resolved: open issue/idea whose every
    // *other* blocker is already resolved, so this item is their last open prerequisite. This is the
    // leverage that actually frees work (an edge to a still-multiply-blocked item frees nothing yet).
    item.unblocksToReady = openDirect.filter((dep) =>
      (dep.type === 'issue' || dep.type === 'idea') &&
      dep.blockers.every((b) => b.status === 'resolved' || b.num === item.num),
    ).length;
    // Single composite for a deterministic template sort: transitive reach dominates (×1000, counts are
    // far below that), direct count breaks ties. Higher = frees more work. (direct ≤ transitive always.)
    item.leverageScore = item.transitiveUnblocks * 1000 + item.directUnblocks;
  }

  // Roll children up under their epic so an epic tile can list what it contains — `parent` is the
  // grouping edge ("rolls under epic NNN"), distinct from the `blockedBy` prerequisite edge. Each child
  // is a lightweight ref (no cyclic full objects), carrying the fields the circle chip needs (status +
  // tier for colour, size/workItem for the tooltip). Ordered by `num` so the circles read in filing
  // order, independent of the dateOpened sort applied to `items` below.
  for (const item of items) {
    item.children = items
      .filter((c) => c.parent != null && String(c.parent) === item.num)
      .sort((a, b) => String(a.num).localeCompare(String(b.num)))
      .map(({ id, num, slug, title, status, workItem, size, tier }) =>
        ({ id, num, slug, title, status, workItem, size, tier }));
    // How many child slices are still unresolved — drives the tile's epic-state badge. An open epic with
    // 0 open children is effectively delivered (ready to resolve); a resolved epic with >0 open children
    // is a contradiction worth flagging.
    item.openChildCount = item.children.filter((c) => c.status !== 'resolved').length;

    // For a ready-to-slice epic, WHICH action it actually needs — so the Prioritisation bucket separates
    // the few epics that want attention from the many that are just live rollups (their work already sits
    // in the agent-ready/batch pool as open children, so the epic itself is nothing to "do"):
    //   'unsliced'  no child slices, NO reason recorded → ready to /slice now (cut slices, or record why)
    //   'parked'    no child slices but a `childlessReason` IS recorded → decomposition is gated on that
    //               reason (blocked / undecided / untriaged / program); the note IS the blocker, so it's
    //               NOT a slice to-do — surface the reason, never prompt a slice.
    //   'done'      every child resolved, epic open    → needs an explicit resolve (a status update)
    //   'tracking'  open child slices remain           → NO epic-level action; progress IS the children
    // Only 'unsliced' + 'done' are "actionable"; 'parked' + 'tracking' are not. Set only on sliceable
    // epics (`sliceable` is assigned in the enrichment loop above, before this one).
    if (item.sliceable) {
      item.epicState = item.children.length > 0
        ? (item.openChildCount === 0 ? 'done' : 'tracking')
        : (item.childlessReason ? 'parked' : 'unsliced');
    }
  }

  items.sort((a, b) =>
    String(b.dateOpened || '').localeCompare(String(a.dateOpened || '')) ||
    a.id.localeCompare(b.id));

  // Burndown-point totals per readiness group, surfaced beside the item counts on the Prioritisation
  // tab's tags (backlog.njk). Summed from `size` (tasks and most decisions carry none, so they
  // contribute 0) — a story-point total, not item-weighted. Computed here (a live-reloading data file)
  // rather than via a template filter, which would need a config reload to take effect.
  const sumSize = (pred) => items.reduce((t, it) =>
    t + (pred(it) && typeof it.size === 'number' ? it.size : 0), 0);
  items.pointsBatch = sumSize((it) => it.batchable === true);
  // pointsTierA / countAgentReady = BUILDABLE agent-ready only (Tier A minus container epics). Epics
  // roll into the `sliceable` tallies below so the "agent-ready" chip never double-counts an epic
  // alongside its own slices. (Only fed to the Prioritisation chip — no other consumer, #safe-to-narrow.)
  items.pointsTierA = sumSize((it) => it.tier === 'A' && !it.sliceable);
  items.pointsSlice = sumSize((it) => it.sliceable === true);
  items.pointsTierB = sumSize((it) => it.tier === 'B');
  items.pointsTierC = sumSize((it) => it.tier === 'C');

  // Prepared open decisions — a Tier-B item with `preparedDate` set has its forks researched +
  // options stated (the "prepared-fork shape"), so it's ready to ratify rather than research. Counted
  // here (not via a template filter, which can't test attribute presence) to surface on the Prioritisation tab.
  items.countPreparedB = items.filter((it) => it.status === 'open' && it.tier === 'B' && it.preparedDate).length;

  // Buildable agent-ready (Tier A minus epics) and ready-to-slice (Tier-A epics) — split here, not via a
  // template filter, because Nunjucks `where` can't express "tier A AND not sliceable". Drives the
  // Prioritisation chips so a container epic is shown as slice-work, not as a buildable Tier-A item.
  items.countAgentReady = items.filter((it) => it.tier === 'A' && !it.sliceable).length;
  items.countSliceable = items.filter((it) => it.sliceable === true).length;
  // Of the ready-to-slice epics, how many actually need a human/agent action (slice or resolve) versus
  // are just tracking open children. The chip leads with this so the screen never reads as "N epic
  // to-dos" when most are passive rollups.
  items.countEpicUnsliced = items.filter((it) => it.epicState === 'unsliced').length;
  items.countEpicDone = items.filter((it) => it.epicState === 'done').length;
  items.countEpicParked = items.filter((it) => it.epicState === 'parked').length;
  items.countEpicActionable = items.countEpicUnsliced + items.countEpicDone;

  return items;
};
