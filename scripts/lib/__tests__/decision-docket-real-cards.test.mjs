/**
 * @file decision-docket-real-cards.test.mjs — snapshot-style guard over the repo's REAL decision cards: run the
 * real extractor (`buildDecisionRecord`) over every live prepared decision card in `backlog/`, render the whole
 * page through the real `renderDocketHtml` + `template.html`, and assert zero raw markdown markers outside
 * `<pre>`/`<code>`. The fixture test (decision-docket-markdown.test.mjs) proves each construct renders; this one
 * proves the cards people actually write don't contain a shape the renderer misses — a card authored tomorrow
 * with a construct nothing handles fails HERE, naming the card.
 *
 * "Live" = the cards the docket lists: `kind: decision` with a `preparedDate`, not `resolved`/`folded`. (A resolved
 * card is history, never on the docket.) No ranking is read — that needs `check:readiness`, a subprocess, and does
 * not change how any card's TEXT renders.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildDecisionRecord } from '../decision-docket-data.mjs';
import { renderDocketHtml } from '../decision-docket-render.mjs';
import { findRawMarkers } from './fixtures/docket-raw-markers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const TEMPLATE = readFileSync(join(ROOT, 'skills-src/decision-docket/template.html'), 'utf8');

function liveDecisionCards() {
  const cards = [];
  for (const file of readdirSync(join(ROOT, 'backlog')).filter((f) => /^\d+-.*\.md$/.test(f)).sort()) {
    const text = readFileSync(join(ROOT, 'backlog', file), 'utf8');
    const fm = /^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? '';
    if (!/^kind:\s*decision\b/m.test(fm) || !/^preparedDate:\s*\S/m.test(fm)) continue;
    if (/^status:\s*(resolved|folded)\b/m.test(fm)) continue;
    const title = /^title:\s*"?(.*?)"?\s*$/m.exec(fm)?.[1] ?? file;
    cards.push({ num: file.match(/^(\d+)-/)[1], title, text });
  }
  return cards;
}

const NOW = new Date('2026-09-21T00:00:00Z');
const cards = liveDecisionCards();

/** Render ONE card as a page of its own, so a failure names the card. */
function renderOne({ num, title, text }) {
  const record = buildDecisionRecord(
    { num, title, prepared: true, preparedDate: '2026-09-01', leverageScore: 1, directUnblocks: 1, unblocksToReady: 1 },
    text,
    NOW,
  );
  return renderDocketHtml({ generatedFromRef: 'test', items: [record] }, TEMPLATE, { now: NOW });
}

describe('the real decision cards render with no raw markdown', () => {
  it('finds a meaningful set of live prepared decision cards (the check below is not vacuous)', () => {
    expect(cards.length).toBeGreaterThanOrEqual(10);
  });

  it('every live prepared decision card renders with zero raw markers outside <pre>/<code>', () => {
    const offenders = {};
    for (const c of cards) {
      const found = findRawMarkers(renderOne(c));
      if (found.length) offenders[`#${c.num}`] = found;
    }
    expect(offenders).toEqual({});
  });

  it('the whole page, all cards together, has zero raw markers too', () => {
    const items = cards.map((c) => buildDecisionRecord(
      { num: c.num, title: c.title, prepared: true, preparedDate: '2026-09-01', leverageScore: 1, directUnblocks: 1, unblocksToReady: 1 },
      c.text,
      NOW,
    ));
    expect(findRawMarkers(renderDocketHtml({ generatedFromRef: 'test', items }, TEMPLATE, { now: NOW }))).toEqual([]);
  });
});
