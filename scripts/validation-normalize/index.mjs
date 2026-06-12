// Public entry point for the validation-normalization hub (the `see` leg of #236).
//
// `see(configsByTool)` is the whole story: hand it each incumbent tool's *own* config and
// it returns the unified comparative model + a summary. The hub keeps no project-facing
// artifact — you can run it once and stop; nothing references it afterwards.

import * as eslint from './adapters/eslint.mjs';
import * as oxlint from './adapters/oxlint.mjs';
import { normalize, summarize } from './normalize.mjs';
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

export { normalize, summarize, tools };
