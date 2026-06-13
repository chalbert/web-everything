// The re-export leg of the adapter-as-normalization-hub (#282, second leg of #236; the `see` leg
// shipped in normalize.mjs). The inverse direction: given the unified pivot model (what the project
// enforces today, expressed as tool-agnostic concerns), emit an *equivalent config for a DIFFERENT
// incumbent tool* — eslint → oxlint, oxlint → eslint, etc.
//
// The whole point is honesty about loss. A re-export is **best-effort, never lossless**: the target
// tool may express a concern exactly, only approximately, or not at all. Each concern the source
// enforces becomes one entry in a per-cell loss report, graded by the same confidence the knowledge
// base already records:
//   exact   → the rule re-exports 1:1; no loss for this concern.
//   lossy   → re-exported, but partial/approx — options/edge-cases/autofix differ (the note says how).
//   dropped → the target tool has NO equivalent; the concern cannot be carried at all (the shopping signal).
//
// Projects never see the pivot model — they hand in tool A's config and get tool B's config plus this
// report. The lossiness IS the comparative value (#236): it tells you exactly what you'd give up moving.

import { concerns, mappings, tools } from './knowledge.mjs';
import * as eslint from './adapters/eslint.mjs';
import * as oxlint from './adapters/oxlint.mjs';

const adapters = { eslint, oxlint };

// A concern is "enforced" in the model when at least one tool actively expresses it; carry the severity
// the project set (the first active cell wins — they're the same concern, just expressed per tool).
function enforcedConcerns(model) {
  return model
    .map((row) => {
      const active = row.cells.find((c) => c.active);
      return active ? { concernId: row.id, severity: active.severity ?? 'error' } : null;
    })
    .filter(Boolean);
}

/**
 * Re-export the model's enforced concerns into `targetToolId`'s own config, with a per-concern loss
 * report. Returns `{ tool, config, loss, summary }`:
 *   - `config` — the target tool's config object (via its adapter's `emit`), carrying only the concerns
 *     the target can actually express (exact + lossy); dropped concerns are omitted (they'd be a lie).
 *   - `loss`   — one entry per enforced concern: `{ concernId, label, status, confidence?, rule?, note? }`.
 *   - `summary`— `{ exact, lossy, dropped }` counts.
 */
export function reExport(model, targetToolId) {
  const adapter = adapters[targetToolId];
  if (!adapter) throw new Error(`Unknown target tool "${targetToolId}" (known: ${tools.map((t) => t.id).join(', ')})`);

  const enforced = enforcedConcerns(model);
  const emittable = [];
  const loss = [];

  for (const { concernId, severity } of enforced) {
    const label = concerns.find((c) => c.id === concernId)?.label ?? concernId;
    const map = mappings.find((m) => m.concernId === concernId && m.tool === targetToolId);

    if (!map) {
      loss.push({ concernId, label, status: 'dropped', confidence: 'none' });
      continue;
    }
    const status = map.confidence === 'exact' ? 'exact' : 'lossy';
    emittable.push({ rule: map.rule, severity });
    loss.push({ concernId, label, status, confidence: map.confidence, rule: map.rule, ...(map.note ? { note: map.note } : {}) });
  }

  const config = adapter.emit(emittable);
  const summary = {
    exact: loss.filter((l) => l.status === 'exact').length,
    lossy: loss.filter((l) => l.status === 'lossy').length,
    dropped: loss.filter((l) => l.status === 'dropped').length,
  };
  return { tool: targetToolId, config, loss, summary };
}
