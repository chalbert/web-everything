// The merge engine — joins each tool's ingested rule-set against the knowledge base to
// produce the unified comparative model the `see` view renders.
//
// One entry per concern, with one cell per tool. A cell is either:
//   covered:false → the tool has *no equivalent* for this concern (the shopping signal), or
//   covered:true  → the tool can express it (with a confidence), and `active` says whether
//                   the loaded project actually has that rule enabled.

import { concerns, mappings, tools } from './knowledge.mjs';

export function normalize(ingestedByTool) {
  return concerns.map((concern) => {
    const cells = tools.map((t) => {
      const map = mappings.find((m) => m.concernId === concern.id && m.tool === t.id);
      if (!map) {
        return { tool: t.id, covered: false, confidence: 'none' };
      }
      const ingested = (ingestedByTool[t.id] || []).find((r) => r.rule === map.rule);
      return {
        tool: t.id,
        covered: true,
        confidence: map.confidence,
        rule: map.rule,
        note: map.note,
        active: !!(ingested && ingested.enabled),
        severity: ingested?.severity,
      };
    });

    return {
      ...concern,
      cells,
      // A concern diverges across tools when some tool has no equivalent, or expresses it
      // only partially/approximately. These are the rows worth reading before you pick a tool.
      divergence: cells.some((c) => !c.covered || (c.confidence !== 'exact' && c.confidence !== 'none')),
      // "Active" = at least one loaded tool actually enforces this concern today.
      activeInProject: cells.some((c) => c.active),
    };
  });
}

export function summarize(model) {
  const cells = model.flatMap((m) => m.cells);
  return {
    concerns: model.length,
    active: model.filter((m) => m.activeInProject).length,
    divergences: model.filter((m) => m.divergence).length,
    noEquivalentCells: cells.filter((c) => !c.covered).length,
  };
}
