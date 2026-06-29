// lane-partition — the PURE partition predicate for the /workflow (parallel) clone orchestrator.
//
// CANONICAL, TESTED home of the partition logic (proved by `__tests__/lane-partition.test.mjs`). The
// orchestrator `we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js` runs in the Workflow JS
// sandbox (no `import`, no fs), so it INLINE-MIRRORS these functions — keep the two in sync; this module +
// its test are the spec. Mirrors the #1933 clone model + the #1935/#1936/#1945 lock-and-optimistic decisions.
//
// THE MODEL (slice A, #1950 — optimistic-first). Serial is the safe baseline, but it is reached ONLY when it
// is actually needed, not pre-emptively on a conservative guess. An item is forced to the serial lane ONLY by:
//   (a) a genuinely-UNKNOWN touch-set — the probe failed/returned nothing (`mustSerialize`), or
//   (b) a real `blockedBy` edge to another batch item (a dependency can't run concurrently), or
//   (c) it shares a MERGE-RISK (blacklist) file with another item — the one case the optimistic git-merge
//       floor cannot catch, since two disjoint-line edits to a monolithic registry JSON merge CLEANLY yet can
//       be semantically wrong. That residual is exactly what the blacklist (RESERVED_MERGE_RISK) guards.
//   (d) a LOW-CONFIDENCE item (`confident:false`) that ALSO overlaps another item on ANY file — its touch-set
//       under-reports reality, so even a non-blacklist overlap is untrustworthy and stays same-lane.
// Everything else — confident items whose only overlaps are ordinary (build config, barrels, their own code
// spilling onto a shared source file) — runs CONCURRENT and leans on the optimistic floor (rebase-and-retry,
// then serial-replay of any real surviving conflict, plus post-hoc multiLaneFiles detection). A wrong
// "concurrent" call therefore costs SPEED (a replay), never correctness — so reliability is unchanged while
// genuinely-independent work stops collapsing to a single serial chain (the #1950 motivation).
//
// SUPERSEDES the prior conservative gate (`confident:false → serial` and `any-file-overlap → serial`), which
// forced provably-disjoint items serial: batch-2026-06-28-1946-1945 ran 8 pairwise-disjoint items in 0 lanes.

// RESERVED_MERGE_RISK = the genuinely-monolithic shared WE files where a CLEAN git merge can still be
// semantically wrong (single-doc registries + the AGENTS.md hand-authored prose body). After #1938 split
// adapters per-entry and the 3 pure-derived artifacts moved to regenerate-on-merge, this is the residual set.
// Per-entry registry files (src/_data/<reg>/<id>.json, INCLUDING src/_data/adapters/<id>.json) are disjoint
// by construction and are NEVER here. WE-only for now; the per-repo extension is slice B (#1951).
export const RESERVED_MERGE_RISK = [
  'src/_data/traits.json', 'src/_data/capabilityMatrix.json', 'src/_data/docs.json',
  'src/_data/webhandlers.json', 'src/_data/webportals.json',
  'src/_data/benchmarkCorpus.json', 'src/_data/workbenchTools.json', 'src/_data/workbenchFeatures.json',
  'vite.config.mts', 'tsconfig.json',
  'AGENTS.md', // its hand-authored PROSE body is a monolith edit; the AUTO-GENERATED inventory sub-block is derived (regen-on-merge), not a merge-risk lane edit
];

// Is a REPO-QUALIFIED path ("<repo>:<path>") a merge-risk file? WE-only for slice A: a `we:`-qualified path
// whose remainder is in the reserved set or matches the curated-sweep prefix. (Slice B extends this per-repo.)
export function isMergeRiskFile(repoQualifiedPath) {
  const s = String(repoQualifiedPath);
  if (!s.startsWith('we:')) return false;
  const f = s.slice(3);
  return RESERVED_MERGE_RISK.includes(f) || /^src\/_data\/(benchmark|workbench)/.test(f);
}

// The repo-qualified file set an item will touch. Files are "<repo>:<path>" so disjointness holds across the
// constellation (#96): the same path in two repos never collides; a genuine same-repo overlap still does. The
// backlog item itself always lives in WE. `predictedFiles`/`declaredFiles` are WE-relative; `extraRepos`
// carries the impl spill in frontierui/plateau-app. (touchesMonolith is folded in by mergeRiskFilesOf, not here.)
export function filesOf(entry) {
  const p = entry.probe;
  const base = new Set([`we:backlog/${entry.file}`]);
  if (p && Array.isArray(p.predictedFiles)) for (const f of p.predictedFiles) base.add(`we:${f}`);
  if (Array.isArray(entry.declaredFiles)) for (const f of entry.declaredFiles) base.add(`we:${f}`);
  if (p && Array.isArray(p.extraRepos)) {
    for (const er of p.extraRepos) {
      if (er && er.repo && Array.isArray(er.files)) for (const f of er.files) base.add(`${er.repo}:${f}`);
    }
  }
  return base;
}

// The MERGE-RISK files an item touches = its probed touchesMonolith (WE-qualified) ∪ any file in its touch-set
// that is itself a reserved merge-risk path. These are the ONLY shared files that force same-lane (c): the
// optimistic floor cannot catch a clean-but-wrong structured merge on one of them.
export function mergeRiskFilesOf(entry) {
  const out = new Set();
  const p = entry.probe;
  if (p && Array.isArray(p.touchesMonolith)) {
    for (const f of p.touchesMonolith) out.add(`we:${String(f).replace(/^we:/, '')}`);
  }
  for (const f of filesOf(entry)) if (isMergeRiskFile(f)) out.add(f);
  return out;
}

export function disjoint(setA, setB) {
  for (const f of setA) if (setB.has(f)) return false;
  return true;
}

// A real dependency edge between two batch items (either direction) — must run same-lane-after, never concurrent.
export function blockEdge(x, y) {
  const xbb = new Set((x.blockedBy || []).map(String));
  const ybb = new Set((y.blockedBy || []).map(String));
  return xbb.has(String(y.num)) || ybb.has(String(x.num));
}

// Only a genuinely-unknown touch-set is an UNCONDITIONAL serial. A probe that succeeded — even low-confidence
// or monolith-touching — is partitioned by the pairwise `conflicts` check, which serializes it only against an
// item it actually contends with (and otherwise lets it run concurrent under the optimistic floor).
export function mustSerialize(entry) {
  return !entry.probe;
}

// Do two probed candidates have to share a lane? (Both are assumed to have a probe — mustSerialize already
// pulled the probe-less ones out.) See THE MODEL above for (b)/(c)/(d).
export function conflicts(x, y) {
  if (blockEdge(x, y)) return true;                                       // (b) real dependency
  if (!disjoint(mergeRiskFilesOf(x), mergeRiskFilesOf(y))) return true;   // (c) shared merge-risk file
  const lowConf = (x.probe && x.probe.confident === false) || (y.probe && y.probe.confident === false);
  if (lowConf && !disjoint(filesOf(x), filesOf(y))) return true;         // (d) low-confidence + any overlap
  return false;                                                          // confident + only ordinary overlap → concurrent
}

// Partition probed entries into { concurrent, serial }. An entry is concurrent iff it has a usable probe AND
// conflicts with NO other probed candidate — so the concurrent set is pairwise-non-conflicting by construction
// and its lanes merge clean (or self-correct via the optimistic floor). Mirrors the workflow's two-step split:
// probe-less entries go straight to serial; the rest are concurrent unless entangled with another candidate.
export function partition(probedEntries) {
  const serialFromProbe = probedEntries.filter(mustSerialize);
  const candidates = probedEntries.filter((e) => !mustSerialize(e));
  const concurrent = [];
  const entangled = [];
  for (const item of candidates) {
    const clashes = candidates.some((o) => o !== item && conflicts(item, o));
    (clashes ? entangled : concurrent).push(item);
  }
  return { concurrent, serial: [...serialFromProbe, ...entangled] };
}

// Why a given entry landed in the serial lane — for the orchestrator's per-item `log` line. Pure, so the test
// can assert the human-readable reason matches the predicate that fired.
export function serialReason(entry, others) {
  if (!entry.probe) return 'probe failed — unknown touch-set';
  const rest = (others || []).filter((o) => o !== entry);
  const dep = rest.find((o) => blockEdge(entry, o));
  if (dep) return `blockedBy edge with #${dep.num}`;
  const risk = rest.find((o) => !disjoint(mergeRiskFilesOf(entry), mergeRiskFilesOf(o)));
  if (risk) return `shares a merge-risk file with #${risk.num}`;
  const lowConf = entry.probe.confident === false;
  const ov = lowConf ? rest.find((o) => !disjoint(filesOf(entry), filesOf(o))) : null;
  if (ov) return `low-confidence touch-set overlapping #${ov.num}`;
  return 'serial';
}
