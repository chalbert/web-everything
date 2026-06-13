// Public entry point for the validation-normalization hub (#236).
//
// Two legs, both one-call:
//   `see(configsByTool)`  — the comparative view: hand it each incumbent tool's own config and get the
//     unified model + a summary back. The hub keeps no project-facing artifact.
//   `shop(configs, target)` — the re-export leg (#282): ingest the source config(s) and emit an
//     equivalent config for a DIFFERENT tool, with an honest per-concern round-trip loss report.

import * as eslint from './adapters/eslint.mjs';
import * as oxlint from './adapters/oxlint.mjs';
import { normalize, summarize } from './normalize.mjs';
import { reExport } from './reexport.mjs';
import { tools } from './knowledge.mjs';

export const adapters = { eslint, oxlint };

export function see(configsByTool) {
  const ingestedByTool = {};
  for (const [toolId, cfg] of Object.entries(configsByTool)) {
    const adapter = adapters[toolId];
    if (!adapter) continue; // unknown tool → skip; a real CLI would warn
    ingestedByTool[toolId] = adapter.ingest(cfg);
  }
  const model = normalize(ingestedByTool);
  return { model, summary: summarize(model), tools };
}

// The re-export leg (#282): `see` the source config(s) into the pivot model, then emit an equivalent
// config for a DIFFERENT target tool with an honest per-concern round-trip loss report. One-call story —
// returns `{ tool, config, loss, summary }`.
export function shop(configsByTool, targetToolId) {
  const { model } = see(configsByTool);
  return reExport(model, targetToolId);
}

export { normalize, summarize, reExport, tools };
