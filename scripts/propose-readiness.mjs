#!/usr/bin/env node
/**
 * propose-readiness.mjs — the LLM spec-gap *proposer* CLI (backlog #252).
 *
 * The non-deterministic counterpart to the deterministic `check:readiness` (#250): for an `open`
 * issue/idea that is decided-but-thin (no acceptance criteria, no concrete file paths), it asks a
 * model provider to DRAFT candidate criteria / likely paths and prints them as a diff. It is dry-run
 * ONLY — it never splices body prose (the #089 propose-and-verify rule) and never touches the #250
 * deterministic core (it imports only the quarantined `scripts/readiness/proposer.mjs`).
 *
 * AI is a swappable provider behind a stable contract — the same `CustomFixerRegistry` seam as the
 * conformance auto-fix `model` fixer (#196). This CLI registers a BYO-key `claude-opus-4-8` provider
 * when `ANTHROPIC_API_KEY` is set; absent a key it registers nothing and reports "no provider" rather
 * than faking output (the graceful-degradation acceptance criterion). A `--reference` flag swaps in the
 * deterministic scaffolding proposer instead, so the propose → diff loop is demonstrable with no key.
 *
 * Usage:
 *   node scripts/propose-readiness.mjs              # model proposer (needs ANTHROPIC_API_KEY); writes nothing
 *   node scripts/propose-readiness.mjs --reference  # deterministic scaffolding proposer (no key) — demo/CI
 *   node scripts/propose-readiness.mjs --json       # machine-readable proposals on stdout
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  CustomProposerRegistry, registerReferenceProposers, propose, renderProposalDiff,
} from './readiness/proposer.mjs';
import { createModelProposer, MODEL } from './readiness/model-proposer.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const loadBacklog = require(join(ROOT, 'src/_data/backlog.js')); // the SAME loader (#248/#249 derivations)

const REFERENCE = process.argv.includes('--reference');
const JSON_MODE = process.argv.includes('--json');

const RED = '\x1b[31m', YEL = '\x1b[33m', GRN = '\x1b[32m', DIM = '\x1b[2m', CYA = '\x1b[36m', BLD = '\x1b[1m', RST = '\x1b[0m';

// ── Wire the registry: --reference (deterministic) | model (BYO key) | none ──────
//
// The BYO-key model proposer (which touches the network + retries transient failures, #252/#253) lives
// in `./readiness/model-proposer.mjs` so its `fetch` surface is an injectable, testable unit — the pure
// proposer engine stays network-free.
const registry = new CustomProposerRegistry();
let providerKind;
if (REFERENCE) {
  registerReferenceProposers(registry);
  providerKind = 'reference';
} else if (process.env.ANTHROPIC_API_KEY) {
  registry.register(createModelProposer(process.env.ANTHROPIC_API_KEY));
  providerKind = 'model';
} else {
  providerKind = 'none';
}

const items = typeof loadBacklog === 'function' ? loadBacklog() : loadBacklog;
const readBody = (file) => {
  // matter()-free body read: strip the leading frontmatter block, hand the proposer the prose.
  const raw = readFileSync(join(ROOT, file), 'utf8');
  const m = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  return m ? raw.slice(m[0].length) : raw;
};

const results = await propose(items, { readBody, registry });

if (JSON_MODE) {
  console.log(JSON.stringify({ provider: providerKind, providerIds: registry.ids(), results }, null, 2));
  process.exit(0);
}

// ── Human report ─────────────────────────────────────────────────────────────
console.log(`${DIM}propose:readiness — Web Everything (dry-run; provider: ${providerKind})${RST}`);

if (!results.length) {
  console.log(`\n${GRN}✓ no decided-but-thin items — nothing to propose.${RST}`);
  process.exit(0);
}

const proposed = results.filter((r) => r.status === 'proposed');
const noProvider = results.filter((r) => r.status === 'no-provider');
const refused = results.filter((r) => r.status === 'refused');
const errored = results.filter((r) => r.status === 'error');

console.log(`\n${BLD}Decided-but-thin items: ${results.length}${RST} ${DIM}(missing acceptance criteria and/or concrete file paths)${RST}`);

for (const r of proposed) {
  const c = r.candidate;
  console.log(`\n${CYA}▸ ${c.id}${RST} ${DIM}— gaps: ${c.gaps.join(', ')} · via ${r.providerId}${RST}`);
  console.log(renderProposalDiff(r));
  if (r.proposal.rationale) console.log(`${DIM}  rationale: ${r.proposal.rationale}${RST}`);
}

if (noProvider.length) {
  console.log(`\n${YEL}◌ no provider registered — gaps reported, not drafted:${RST}`);
  for (const r of noProvider) console.log(`  ${r.candidate.id} ${DIM}— gaps: ${r.candidate.gaps.join(', ')}${RST}`);
  console.log(`${DIM}  Set ANTHROPIC_API_KEY for the ${MODEL} proposer, or run with ${RST}--reference${DIM} for scaffolding.${RST}`);
}
for (const r of refused) console.log(`\n${YEL}◌ ${r.candidate.id} — provider produced no draft (refused).${RST}`);
for (const r of errored) console.log(`\n${RED}✗ ${r.candidate.id} — provider error: ${r.reason}${RST}`);

console.log(`\n${DIM}Nothing was written. Accept any draft by editing the file yourself.${RST}`);
process.exit(0);
