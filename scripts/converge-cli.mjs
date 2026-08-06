#!/usr/bin/env node
/**
 * converge-cli.mjs — the thin I/O bridge over the pure convergence core (#xztipiw).
 *
 * WHY A CLI AT ALL. The core (`we:scripts/lib/converge-core.mjs`) is pure and importable, but the things that
 * DRIVE it are not: a Workflow harness body cannot `import` anything, and a main-session skill drives agents
 * through the tool layer rather than through Node. Both reach the core the same way every other shared
 * derivation in this repo is reached — by shelling a CLI (the pattern `we:scripts/review-core-cli.mjs` set).
 *
 * WHAT IT DOES NOT DO. It never spawns an agent, never edits a file, never commits, never opens a PR. It reads
 * state, calls a pure function, writes state, prints the next action. Every effect belongs to the caller — that
 * is what keeps the loop's decisions testable and the caller's judgement in the loop.
 *
 * SUBCOMMANDS
 *   init  --lane=<path> --state=<file> [--care=<level>] [--jurors=N] [--round-cap=N] [--base-ref=<ref>]
 *         Seed the run. Prints the roster and the shell command the caller runs to read the material.
 *   step  --state=<file> [--obs=<file>|stdin]
 *         Feed one round's observations in, get the next action out, and advance the persisted state.
 *   read  --state=<file>
 *         Reprint the transport's read command (after an edit round advanced the work).
 *
 * Exit codes: 0 ok · 2 usage error · 1 a derivation threw.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import {
  CONVERGE_ACTIONS,
  initConvergeState,
  deriveRoundObservations,
  convergeStep,
  applyJurorInvite,
  buildEscalationPacket,
} from './lib/converge-core.mjs';
import { resolveTransport } from './lib/converge-transports.mjs';
import { PANEL_LENSES, MANDATORY_LENSES, panelRigorForCareLevel } from './lib/jury-core.mjs';
import { buildPanelMandate } from './lib/review-core.mjs';

/** Parse `--flag=value` / `--flag` argv into an object. */
function parseFlags(argv) {
  const flags = {};
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const eq = arg.indexOf('=');
    if (eq === -1) flags[arg.slice(2)] = true;
    else flags[arg.slice(2, eq)] = arg.slice(eq + 1);
  }
  return flags;
}

function fail(message, code = 2) {
  process.stderr.write(`converge: ${message}\n`);
  process.exit(code);
}

function readState(path) {
  if (!path) fail('--state=<file> is required');
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    return fail(`could not read state at ${path}: ${err.message}`);
  }
}

function writeState(path, envelope) {
  writeFileSync(path, `${JSON.stringify(envelope, null, 2)}\n`, 'utf8');
}

function readJsonInput(flags) {
  if (flags.obs) {
    try {
      return JSON.parse(readFileSync(flags.obs, 'utf8'));
    } catch (err) {
      return fail(`could not read --obs at ${flags.obs}: ${err.message}`);
    }
  }
  let stdin = '';
  try {
    stdin = readFileSync(0, 'utf8');
  } catch {
    return fail('no observations supplied — pass --obs=<file> or pipe JSON on stdin');
  }
  if (!stdin.trim()) return fail('no observations supplied — pass --obs=<file> or pipe JSON on stdin');
  try {
    return JSON.parse(stdin);
  } catch (err) {
    return fail(`observations are not valid JSON: ${err.message}`);
  }
}

/** `init` — seed the state file and print the first action. */
function runInit(flags) {
  if (!flags.lane) fail('--lane=<path to the lane clone> is required');
  const transportName = typeof flags.transport === 'string' ? flags.transport : 'working-tree';
  const resolved = resolveTransport(transportName);
  if (!resolved.ok) fail(`${resolved.error} (available: ${resolved.available.join(', ')})`);

  // The care band dials the jury size and the round cap — both derived, never hand-tuned.
  const careLevel = typeof flags.care === 'string' ? flags.care : 'low';
  const rigor = panelRigorForCareLevel(careLevel);
  const jurorsPerLens = flags.jurors ? Math.max(1, Number(flags.jurors)) : rigor.jurorsPerLens;
  const roundCap = flags['round-cap'] ? Math.max(1, Number(flags['round-cap'])) : rigor.rounds;

  const state = initConvergeState({
    careLevel,
    jurorsPerLens,
    roundCap,
    jurorCeiling: panelRigorForCareLevel('high').jurorsPerLens,
    activeLenses: [...PANEL_LENSES],
    seatableLenses: [...PANEL_LENSES],
    mandatoryLenses: [...MANDATORY_LENSES],
  });

  const ctx = { laneRoot: flags.lane, baseRef: typeof flags['base-ref'] === 'string' ? flags['base-ref'] : 'origin/main' };
  const envelope = { transport: transportName, ctx, state };
  writeState(flags.state, envelope);

  process.stdout.write(`${JSON.stringify({
    action: CONVERGE_ACTIONS.READ,
    careLevel,
    jurorsPerLens,
    roundCap,
    lenses: state.activeLenses,
    mandatoryLenses: state.mandatoryLenses,
    read: resolved.transport.readMaterial(ctx),
  }, null, 2)}\n`);
}

/** `read` — reprint the transport's read command for the current state. */
function runRead(flags) {
  const envelope = readState(flags.state);
  const resolved = resolveTransport(envelope.transport);
  if (!resolved.ok) fail(resolved.error);
  process.stdout.write(`${JSON.stringify(resolved.transport.readMaterial(envelope.ctx), null, 2)}\n`);
}

/**
 * `step` — the whole decision, in one call.
 *
 * Input JSON: `{ readResult?, lensResults?, invites?, editResult?, inviteEcho? }`. Everything is optional; the
 * core reads whatever is absent as "did not happen", which is why a malformed caller degrades to an escalation
 * rather than to a land.
 */
function runStep(flags) {
  const envelope = readState(flags.state);
  const resolved = resolveTransport(envelope.transport);
  if (!resolved.ok) fail(resolved.error);
  const input = readJsonInput(flags);
  const state = envelope.state;

  // An accepted invite is applied against the state BEFORE the next decision — it changes the roster the next
  // panel round runs with, and it spends a round.
  if (input.inviteEcho && input.invite) {
    const applied = applyJurorInvite(state, input.inviteEcho, input.invite);
    writeState(flags.state, { ...envelope, state: applied.state });

    // A REJECTED invite falls through to an editor round on the SAME round — so this call must hand back the
    // editor prompt, or the caller is told to `edit` with nothing to run. That needs the round's findings, which
    // is why the caller carries them into an invite step alongside the echo.
    const instruction = {};
    if (applied.action === CONVERGE_ACTIONS.READ) {
      instruction.read = resolved.transport.readMaterial(envelope.ctx);
    } else if (applied.action === CONVERGE_ACTIONS.EDIT) {
      instruction.edit = resolved.transport.applyRevision({
        findings: Array.isArray(input.findings) ? input.findings : [],
        round: applied.state.round,
        roundCap: applied.state.roundCap,
        ctx: envelope.ctx,
      });
    } else if (applied.action === CONVERGE_ACTIONS.ESCALATE) {
      instruction.escalation = buildEscalationPacket(applied.state, { reason: applied.reason });
    }

    process.stdout.write(`${JSON.stringify({
      action: applied.action,
      applied: applied.applied,
      reason: applied.reason || null,
      round: applied.state.round,
      roundCap: applied.state.roundCap,
      lenses: applied.state.activeLenses,
      jurorsPerLens: applied.state.jurorsPerLens,
      ...instruction,
    }, null, 2)}\n`);
    return;
  }

  const obs = deriveRoundObservations({
    readResult: input.readResult,
    lensResults: input.lensResults,
    invites: input.invites,
    editResult: input.editResult,
    mandatoryLenses: state.mandatoryLenses,
  });

  const result = convergeStep(state, obs);
  writeState(flags.state, { ...envelope, state: result.state });

  /** Build the caller's next instruction — the ONE place an action becomes something to run. */
  const instruction = {};
  if (result.action === CONVERGE_ACTIONS.READ) {
    instruction.read = resolved.transport.readMaterial(envelope.ctx);
  } else if (result.action === CONVERGE_ACTIONS.PANEL) {
    instruction.panel = result.state.activeLenses.map((lens) => ({
      lens,
      jurors: result.state.jurorsPerLens,
      mandatory: result.state.mandatoryLenses.includes(lens),
      mandate: buildPanelMandate({ lens }),
    }));
  } else if (result.action === CONVERGE_ACTIONS.EDIT) {
    instruction.edit = resolved.transport.applyRevision({
      findings: result.findings,
      round: result.state.round,
      roundCap: result.state.roundCap,
      ctx: envelope.ctx,
    });
  } else if (result.action === CONVERGE_ACTIONS.ESCALATE) {
    instruction.escalation = buildEscalationPacket(result.state, result);
  }

  process.stdout.write(`${JSON.stringify({
    action: result.action,
    round: result.state.round,
    roundCap: result.state.roundCap,
    verdict: result.verdict || null,
    outcome: result.outcome || null,
    reason: result.reason || null,
    lensVerdicts: result.lensVerdicts || null,
    findings: result.findings || [],
    invite: result.invite || null,
    ...instruction,
  }, null, 2)}\n`);
}

function main(argv) {
  const subcommand = argv[0];
  const flags = parseFlags(argv.slice(1));
  if (subcommand === 'init') return runInit(flags);
  if (subcommand === 'step') return runStep(flags);
  if (subcommand === 'read') return runRead(flags);
  return fail(`unknown subcommand "${subcommand || ''}" — expected init | step | read`);
}

try {
  main(process.argv.slice(2));
} catch (err) {
  process.stderr.write(`converge: ${err && err.stack ? err.stack : err}\n`);
  process.exit(1);
}
