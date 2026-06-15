// design-refs/codification.mjs — the pure half of the design-ref codification pass (backlog #481,
// ruling #396). Dependency-free so it unit-tests without a browser, a model, or the heavy
// design-refs.mjs CLI. The IO orchestrator (`codify`) lives in design-refs.mjs and composes these.
//
// Two halves of #396's spec:
//   - per shot (F1): fold the reliable facets + loose pattern notes a provider returned into a shot's
//     `meta.json` sidecar — `applyCodificationToMeta`;
//   - cross shot (F3): cluster the recurring pattern observations into candidate paradigms for human
//     ratification — `harvestCandidates` → a session report (`renderCodificationReport`) and
//     ready-to-scaffold `type:idea` descriptors (`candidateToScaffold`). The formal standard-vocabulary
//     / #086-neutral-structure expression lives ONLY at that reviewed promotion boundary.

import { CODIFICATION_FACETS } from './vision.mjs';

// ---- per shot (F1) ---------------------------------------------------------
// Fold a normalized codification result into a shot's meta. Only the reliable facets are written, and
// only when the provider actually returned a value (a null facet never clobbers an authored one). Loose
// pattern observations land in `patternObservations`. Returns `{ meta, changed }`; idempotent — a second
// apply of the same result reports `changed: false`.
export function applyCodificationToMeta(meta, result) {
  const next = { ...meta };
  let changed = false;

  for (const k of CODIFICATION_FACETS) {
    const v = result?.facets?.[k];
    if (v != null && next[k] !== v) {
      next[k] = v;
      changed = true;
    }
  }

  const patterns = Array.isArray(result?.patterns) ? result.patterns : [];
  if (patterns.length) {
    const prev = Array.isArray(next.patternObservations) ? next.patternObservations : [];
    const merged = [...new Set([...prev, ...patterns])];
    if (merged.length !== prev.length || merged.some((p, i) => p !== prev[i])) {
      next.patternObservations = merged;
      changed = true;
    }
  }

  // Stamp only a real (non-ungated) analysis — an ungated/no-op run (the null `manual` provider, offline
  // / CI) leaves the corpus entirely untouched, as advertised.
  if (result?.ungated !== true) {
    const stamp = { provider: result?.provider ?? null, ungated: false, at: result?.at ?? null };
    if (JSON.stringify(next.codification) !== JSON.stringify(stamp)) {
      next.codification = stamp;
      changed = true;
    }
  }

  return { meta: next, changed };
}

// ---- cross shot (F3) -------------------------------------------------------
// Cluster the per-shot pattern observations into candidate paradigms. A pattern seen in at least
// `minSupport` distinct shots is a candidate, ranked by support. Loose by design — the human reviews and
// formalises each at the promotion boundary; nothing here mints a standard.
export function harvestCandidates(perShot, { minSupport = 3 } = {}) {
  const items = new Map(); // pattern -> Set(ids)
  for (const shot of perShot ?? []) {
    for (const pattern of shot?.patterns ?? []) {
      if (!items.has(pattern)) items.set(pattern, new Set());
      items.get(pattern).add(shot.id);
    }
  }
  return [...items.entries()]
    .map(([pattern, ids]) => ({ pattern, support: ids.size, items: [...ids].sort() }))
    .filter((c) => c.support >= minSupport)
    .sort((a, b) => b.support - a.support || a.pattern.localeCompare(b.pattern));
}

// A candidate → the `type:idea` scaffold descriptor for the new-standard flow. Loose-form proposal: it
// names the recurring paradigm and cites its supporting shots; a human ratifies + formalises it.
export function candidateToScaffold(candidate) {
  const title = `Candidate intent from design-ref corpus: ${candidate.pattern}`;
  const body = [
    `Harvested by the design-ref codification pass (#481, ruling #396) — a recurring paradigm observed`,
    `across ${candidate.support} corpus shot(s). LOOSE candidate for human ratification via the`,
    `new-standard flow; the formal standard-vocabulary / neutral-structure expression is the reviewer's`,
    `job at this promotion boundary (no standard is minted by the pass).`,
    ``,
    `**Pattern:** ${candidate.pattern}`,
    `**Support:** ${candidate.support} shot(s) — ${candidate.items.join(', ')}`,
  ].join('\n');
  return { title, body };
}

// ---- session report --------------------------------------------------------
// A human-readable summary of one codification run: how many shots were analysed (vs ungated), the
// facets filled, and the harvested candidates with their support. Pure string — the orchestrator writes it.
export function renderCodificationReport({ runId, provider, generatedAt, codified = [], candidates = [], minSupport = 3 }) {
  const analysed = codified.filter((c) => !c.ungated);
  const facetFill = Object.fromEntries(
    CODIFICATION_FACETS.map((k) => [k, analysed.filter((c) => c.facets?.[k] != null).length]),
  );
  const lines = [];
  lines.push(`# Design-ref codification run — ${runId}`);
  lines.push('');
  lines.push(`> Generated ${generatedAt} · provider \`${provider}\` · backlog #481 (ruling #396).`);
  lines.push('');
  lines.push(`The codification pass (#396 Fork 2) over the gated corpus: per shot it fills the reliable`);
  lines.push(`facets + loose pattern notes into \`meta.json\`; cross shot it clusters recurring paradigms`);
  lines.push(`into LOOSE candidates for human ratification (no standard is minted here — that is the`);
  lines.push(`reviewer's job at the promotion boundary).`);
  lines.push('');
  lines.push(`## Shots`);
  lines.push('');
  lines.push(`- Codified: **${codified.length}**  ·  model-analysed: **${analysed.length}**  ·  ungated (no provider ran): **${codified.length - analysed.length}**`);
  lines.push(`- Facets filled (of analysed): ${CODIFICATION_FACETS.map((k) => `\`${k}\` ${facetFill[k]}`).join(' · ')}`);
  lines.push('');
  lines.push(`## Candidate paradigms (support ≥ ${minSupport})`);
  lines.push('');
  if (!candidates.length) {
    lines.push(`_No recurring paradigm cleared the support floor this run._`);
  } else {
    lines.push(`| Pattern | Support | Shots |`);
    lines.push(`|---|---|---|`);
    for (const c of candidates) {
      lines.push(`| ${c.pattern} | ${c.support} | ${c.items.join(', ')} |`);
    }
    lines.push('');
    lines.push(`Scaffold each as a \`type:idea\` candidate (or re-run with \`--scaffold\`):`);
    lines.push('');
    lines.push('```sh');
    for (const c of candidates) {
      lines.push(`node scripts/backlog.mjs scaffold --type=idea --title=${JSON.stringify(candidateToScaffold(c).title)}`);
    }
    lines.push('```');
  }
  lines.push('');
  return lines.join('\n');
}
