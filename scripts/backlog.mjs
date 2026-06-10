#!/usr/bin/env node
/**
 * backlog.mjs — the mechanical backlog-status CLI (claim / resolve / release / scaffold).
 *
 * The deterministic counterpart to `check-readiness.mjs --select` (which tells you *what* to work):
 * this performs the *mechanical* state changes the agent otherwise does by hand on every item — flip
 * `status`, stamp `dateStarted`/`dateResolved`, set `graduatedTo`, allocate the next free `NNN`. Each
 * is a surgical frontmatter splice (the body is never touched — see `backlog/frontmatter.mjs`), guarded
 * by the legal `from` status so the script can't double-claim or resolve an open item. One command
 * replaces a re-read → reason → Edit round-trip, saving a tool call and context on every transition.
 *
 * It does the EDIT only — never the gate. `claim` doesn't run tests; `resolve` assumes you've already
 * run the close-out gate (tests + check:standards green). And it stays out of the chat-rename
 * discipline: `claim` prints the rename slug for you to copy, but the script can't (and doesn't) rename.
 *
 * Usage:
 *   node scripts/backlog.mjs claim   <NNN>                       # open    → active  + dateStarted=today; prints rename slug
 *   node scripts/backlog.mjs resolve <NNN> [--graduated-to=X]    # active  → resolved + dateResolved=today (+ graduatedTo)
 *   node scripts/backlog.mjs release <NNN>                       # active  → open (abandon/redirect; stamps untouched)
 *   node scripts/backlog.mjs scaffold --type=idea --workitem=story --size=3 --title="..." [--digest="..."] [--blocked-by=NNN,NNN] [--parent=NNN]
 *   add --json to any verb for machine-readable output.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { applyTransition, readField } from './backlog/frontmatter.mjs';
import { nextNum, slugify, renderItem } from './backlog/scaffold.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'backlog');
const CAPACITY_PATH = join(ROOT, '.claude/skills/batch-backlog-items/capacity.json');
const RED = '\x1b[31m', GRN = '\x1b[32m', YEL = '\x1b[33m', DIM = '\x1b[2m', BLD = '\x1b[1m', RST = '\x1b[0m';

const argv = process.argv.slice(2);
const JSON_MODE = argv.includes('--json');
const verb = argv[0];
const flag = (name) => { const m = argv.find((a) => a.startsWith(`--${name}=`)); return m ? m.slice(name.length + 3) : undefined; };
const positional = argv.slice(1).filter((a) => !a.startsWith('--'));

const today = () => new Date().toISOString().slice(0, 10);
const files = () => readdirSync(DIR).filter((f) => f.endsWith('.md'));

function die(msg) {
  if (JSON_MODE) console.log(JSON.stringify({ ok: false, error: msg }));
  else console.error(`${RED}✗${RST} ${msg}`);
  process.exit(1);
}
function ok(payload, human) {
  if (JSON_MODE) console.log(JSON.stringify({ ok: true, ...payload }));
  else console.log(human);
  process.exit(0);
}

/** Resolve a bare NNN (or NNN-slug) to its current filename, or die if it's missing/ambiguous. */
function resolveFile(ref) {
  if (!ref) die('missing <NNN> — e.g. `backlog.mjs claim 122`');
  const num = (String(ref).match(/^(\d+)/) || [])[1];
  if (!num) die(`"${ref}" is not a valid NNN reference`);
  const padded = num.padStart(3, '0');
  const matches = files().filter((f) => f.startsWith(`${padded}-`));
  if (matches.length === 0) die(`no backlog item #${padded} on disk`);
  if (matches.length > 1) die(`#${padded} is ambiguous: ${matches.join(', ')}`);
  return matches[0];
}

/** Warn (don't block) if the working tree already has uncommitted edits to this file — a concurrency smell. */
function isDirty(relPath) {
  try {
    const out = execFileSync('git', ['status', '--short', '--', relPath], { cwd: ROOT, encoding: 'utf8' });
    return out.trim().length > 0;
  } catch { return false; }
}

function transition(v) {
  const file = resolveFile(positional[0]);
  const rel = `backlog/${file}`;
  const abs = join(DIR, file);
  const before = readFileSync(abs, 'utf8');
  // Concurrency guard for claim: a racing agent often dirties the file before flipping status.
  if (v === 'claim' && isDirty(rel)) die(`${rel} has uncommitted edits — another session may be on it; verify before claiming`);
  const res = applyTransition(before, v, { today: today(), graduatedTo: flag('graduated-to') });
  if (res.error) die(`#${file.match(/^\d+/)[0]} — ${res.error}`);
  writeFileSync(abs, res.content);
  const id = file.replace(/\.md$/, '');
  const slug = id; // the rename slug is the full id (NNN-slug)
  if (v === 'claim') {
    ok({ verb: v, id, file: rel, slug, status: 'active' },
      `${GRN}✓ claimed${RST} ${id} ${DIM}→ active (dateStarted ${today()})${RST}\n\n${DIM}Rename this chat via the tab menu to label this session — copy:${RST}\n\`\`\`\n${slug}\n\`\`\``);
  }
  if (v === 'resolve') {
    const g = flag('graduated-to');
    ok({ verb: v, id, file: rel, status: 'resolved', graduatedTo: g },
      `${GRN}✓ resolved${RST} ${id} ${DIM}→ resolved (dateResolved ${today()}${g ? `, graduatedTo ${g}` : ''})${RST}${g ? '' : `\n${YEL}note:${RST} ${DIM}no --graduated-to set; if a resolved idea spawned no entity, set graduatedTo=none by hand${RST}`}`);
  }
  ok({ verb: v, id, file: rel, status: 'open' }, `${GRN}✓ released${RST} ${id} ${DIM}→ open${RST}`);
}

function scaffold() {
  const type = flag('type') || 'idea';
  const workitem = flag('workitem') || 'story';
  const size = flag('size') !== undefined ? Number(flag('size')) : undefined;
  const title = flag('title');
  if (!title) die('scaffold needs --title="…"');
  if (workitem === 'story' && !Number.isFinite(size)) die('a story needs --size=<Fibonacci>');
  const slug = flag('slug') || slugify(title);
  const blockedBy = (flag('blocked-by') || '').split(',').map((s) => s.trim()).filter(Boolean).map((n) => n.padStart(3, '0'));
  const parent = flag('parent') ? flag('parent').padStart(3, '0') : undefined;

  const existing = files().map((f) => (f.match(/^(\d+)/) || [])[1]).filter(Boolean);
  const num = nextNum(existing);
  const fileName = `${num}-${slug}.md`;
  const abs = join(DIR, fileName);
  // Re-glob immediately before write to win the id race; if taken, bump once.
  let finalNum = num, finalName = fileName, finalAbs = abs;
  if (files().some((f) => f.startsWith(`${num}-`))) {
    finalNum = nextNum([...existing, num]);
    finalName = `${finalNum}-${slug}.md`;
    finalAbs = join(DIR, finalName);
  }
  const content = renderItem({ type, workItem: workitem, size, slug, title, today: today(), blockedBy, parent, digest: flag('digest') });
  writeFileSync(finalAbs, content);
  const id = finalName.replace(/\.md$/, '');
  const filled = !!flag('digest');
  ok({ verb: 'scaffold', id, num: finalNum, file: `backlog/${finalName}`, digestFilled: filled },
    `${GRN}✓ scaffolded${RST} ${BLD}#${finalNum}${RST} ${DIM}backlog/${finalName}${RST}\n${YEL}→ ${filled ? 'add the body (digest set), then re-run check:standards' : 'fill the digest (TODO line) and body, then re-run check:standards'}${RST}`);
}

/**
 * calibrate — fold one session's observed (points resolved ÷ context fraction) into the rolling
 * session-capacity estimate that sizes a points-budgeted batch (capacity.json). This is the close-out
 * feedback loop: the count cap is gone, so the budget must stay honest about what a session actually
 * fits. EMA-blend so a single odd session can't swing the target, and keep the last 12 raw samples for
 * audit. `--points` = cost-points resolved (sum of each item's batchCost: a story's size, a task = 2);
 * `--context-pct` = the share of the window consumed at close (the editor's context meter, 1–100).
 */
function calibrate() {
  const points = Number(flag('points'));
  const ctxPct = Number(flag('context-pct'));
  if (!Number.isFinite(points) || points <= 0) die('calibrate needs --points=<cost-points resolved this session>');
  if (!Number.isFinite(ctxPct) || ctxPct <= 0 || ctxPct > 100) die('calibrate needs --context-pct=<1–100, context consumed at close>');

  let cap;
  try { cap = JSON.parse(readFileSync(CAPACITY_PATH, 'utf8')); }
  catch { die(`cannot read ${CAPACITY_PATH} — run a batch in this repo first (the file ships seeded)`); }

  const implied = Math.round(points / (ctxPct / 100)); // what a full session would have fit at this rate
  const alpha = Number.isFinite(cap.ema) ? cap.ema : 0.3;
  const prev = Number.isFinite(cap.capacityPoints) ? cap.capacityPoints : implied;
  const next = Math.round(alpha * implied + (1 - alpha) * prev);

  cap.capacityPoints = next;
  cap.samples = [...(Array.isArray(cap.samples) ? cap.samples : []), { date: today(), points, contextPct: ctxPct, impliedCapacity: implied }].slice(-12);
  writeFileSync(CAPACITY_PATH, JSON.stringify(cap, null, 2) + '\n');

  const budget = Math.round(next * (cap.targetFraction ?? 0.5));
  ok({ verb: 'calibrate', points, contextPct: ctxPct, impliedCapacity: implied, capacityPoints: next, budget },
    `${GRN}✓ calibrated${RST} ${DIM}— ${points} pts at ${ctxPct}% → implied ${implied}; capacity ${prev} → ${BLD}${next}${RST}${DIM}; next batch budget ≈ ${RST}${BLD}${budget} pts${RST}`);
}

switch (verb) {
  case 'claim': case 'resolve': case 'release': transition(verb); break;
  case 'scaffold': scaffold(); break;
  case 'calibrate': calibrate(); break;
  default:
    console.error(`${BLD}backlog.mjs${RST} — mechanical backlog-status CLI\n` +
      `  ${GRN}claim${RST} <NNN>                 open → active + dateStarted\n` +
      `  ${GRN}resolve${RST} <NNN> [--graduated-to=X]   active → resolved + dateResolved\n` +
      `  ${GRN}release${RST} <NNN>               active → open\n` +
      `  ${GRN}scaffold${RST} --type= --workitem= --size= --title= [--digest=] [--blocked-by=] [--parent=]\n` +
      `  ${GRN}calibrate${RST} --points= --context-pct=   fold a session into the batch point-budget estimate\n` +
      `  (add --json for machine output)`);
    process.exit(verb ? 1 : 0);
}
