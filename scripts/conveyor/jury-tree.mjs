#!/usr/bin/env node
/**
 * @file scripts/conveyor/jury-tree.mjs
 * @description The CONVEYOR LIVE JURY TREE (WE #2641, epic #2636) — a compact `/workflows`-style TEXT tree of what
 *   the jury IS, is DOING, and has FOUND, surfaced to the operator from the SAME durable event log the #2642
 *   console reads. It makes the jury OBSERVABLE (the #2641 ruling): per review subject (a parked PR, a design, a
 *   decision), the roster + each juror's charter, its derived status (pending / running / found), its findings,
 *   its current verdict, and the round.
 *
 * SINGLE SOURCE OF TRUTH (#2612): this renderer INVENTS no state and RE-DERIVES nothing. It calls the ONE SHARED
 *   FOLD (`foldAllSubjects` / `foldSubject` in `scripts/lib/jury-ledger.mjs`) to reconstruct the ledger from the
 *   append-only on-disk log, then FORMATS it. The fold lives ONCE in the WE core; a second copy of the fold logic
 *   in this consumer would be a bug (#2641 guardrail) — so this file imports the fold and only renders. The
 *   plateau-app #2642 console is the OTHER consumer of the same fold, rendered its own (graphical) way.
 *
 * PURE-CORE / IO-SHELL SPLIT (mirrored from status-board.mjs): {@link renderJuryTree} / {@link renderAllJuryTrees}
 *   are PURE `ledger → string` formatters — no fs / Date / child_process, deterministic and vitest-testable
 *   against fixtures. The IO shell (`main()`, gated on direct invocation) is the only part that reads the log.
 *
 * DEGRADE GRACEFULLY: a null / partial / empty ledger never throws — an unfolded subject renders one honest line,
 *   and no logged jury run at all renders a single "no jury runs" note (an idle conveyor is untouched).
 *
 * MARKER LEGEND — one symbol, one meaning:
 *   ◷  pending   — a rostered juror that has not started
 *   ⟳  running   — a juror mid-review
 *   ✓  found     — a juror that has reported (a finding or a verdict)
 *   and the verdict glyph on a juror / panel line: ✓ accept · ✎ changes · ⚑ needs-human · ⚐ prevention-outstanding · · none yet
 */

import { pathToFileURL } from 'node:url';
import { foldAllSubjects, foldSubject } from '../lib/jury-ledger.mjs';

// ── PURE CORE (no fs / Date / child_process — the folded ledger is passed IN) ────────────────────────────────

/** Juror lifecycle-status glyphs (one symbol, one meaning — see the header legend). */
export const STATUS_MARKERS = Object.freeze({ pending: '◷', running: '⟳', found: '✓' });

/** Verdict glyphs — the strictest-wins verdict on a juror / panel line. `null`/unknown → a neutral dot. The
 *  `prevention-outstanding` (#2823) glyph is an OUTLINE flag `⚐`, distinct from needs-human's filled `⚑` — a
 *  blocking verdict must never render as the neutral `·` reserved for "no verdict reported yet".
 *  @verdicts-total — every `VERDICTS` member must be a key (enforced by the `check:standards` verdict-totality gate),
 *  so a new blocking verdict can never fall back to the neutral `·` glyph again. */
export const VERDICT_MARKERS = Object.freeze({ accept: '✓', changes: '✎', 'needs-human': '⚑', 'prevention-outstanding': '⚐' });

const arr = (x) => (Array.isArray(x) ? x : []);
const verdictGlyph = (v) => VERDICT_MARKERS[v] || '·';
const verdictWord = (v) => (v == null ? 'no verdict yet' : v);

/** Truncate a one-line finding summary so the tree stays scannable. */
function clip(s, n = 88) {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

/**
 * Render ONE subject's folded ledger into a `/workflows`-style tree. PURE + total: a missing / empty ledger
 * degrades to a single honest line, never a throw.
 * @param {string} subject - the subject key (e.g. `we#123`).
 * @param {import('../lib/jury-ledger.mjs').FoldedLedger|null|undefined} ledger
 * @returns {string}
 */
export function renderJuryTree(subject, ledger) {
  const l = ledger && typeof ledger === 'object' ? ledger : {};
  const jurors = arr(l.jurors);
  if (!l.rosterKnown || jurors.length === 0) {
    return `JURY ${subject}\n  (no roster recorded yet — the jury has not convened)`;
  }
  const c = l.counts && typeof l.counts === 'object' ? l.counts : { pending: 0, running: 0, found: 0 };
  const head =
    `JURY ${subject} · round ${Number.isFinite(l.round) ? l.round : 0} · ` +
    `${jurors.length} juror${jurors.length === 1 ? '' : 's'} ` +
    `(${c.found || 0} found · ${c.running || 0} running · ${c.pending || 0} pending) · ` +
    `panel ${verdictGlyph(l.panelVerdict)} ${verdictWord(l.panelVerdict)}`;

  const lines = [head];
  jurors.forEach((j, i) => {
    const last = i === jurors.length - 1;
    const branch = last ? '└─' : '├─';
    const cont = last ? '   ' : '│  ';
    const status = STATUS_MARKERS[j.status] || '?';
    const findings = arr(j.findings);
    lines.push(
      `  ${branch} ${status} ${j.lens} [${j.id}] ${verdictGlyph(j.verdict)} ${verdictWord(j.verdict)}` +
        (findings.length ? ` · ${findings.length} finding${findings.length === 1 ? '' : 's'}` : ''),
    );
    if (j.charter) lines.push(`  ${cont}   charter: ${clip(j.charter, 96)}`);
    findings.forEach((f) => {
      const where = f.file ? ` (${f.file}${f.line != null ? `:${f.line}` : ''})` : '';
      lines.push(`  ${cont}   • ${clip(f.summary)}${where}`);
    });
  });
  return lines.join('\n');
}

/**
 * Render EVERY subject's live jury tree — the whole jury picture the conveyor surfaces. PURE. An empty list
 * renders one honest idle note.
 * @param {Array<{ subject: string, ledger: object }>} subjects
 * @returns {string}
 */
export function renderAllJuryTrees(subjects) {
  const list = arr(subjects);
  if (list.length === 0) return 'JURY · no jury runs logged (no parked-PR review has recorded a ledger yet)\n';
  return `${list.map(({ subject, ledger }) => renderJuryTree(subject, ledger)).join('\n\n')}\n`;
}

// ── IO SHELL (runs only as a CLI — the only part that reads the durable log via the shared fold) ─────────────

function main(argv) {
  // A `--subject=<key>` flag scopes the tree to one subject; absent, render every logged subject.
  let subject = null;
  for (const a of argv) {
    if (a.startsWith('--subject=')) subject = a.slice('--subject='.length);
  }
  try {
    const out = subject && subject.trim()
      ? renderAllJuryTrees([foldSubject(subject)])
      : renderAllJuryTrees(foldAllSubjects());
    process.stdout.write(out);
    process.exit(0);
  } catch (e) {
    process.stderr.write(`jury-tree: could not render the live jury — ${String(e.message || e).split('\n')[0]}\n`);
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main(process.argv.slice(2));
}
