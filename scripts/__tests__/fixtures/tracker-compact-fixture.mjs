/**
 * @file tracker-compact-fixture.mjs — one small, deterministic tracker card and its cards, shared by the compact
 * tracker page tests (`prototype-tracker-compact.test.mjs`, `prototype-tracker-render-real.test.mjs`) and the
 * `tracker-refresh` tests. Not a test file: it only builds text.
 *
 * The shape mirrors the live card: a `## Priority order` section with a health chain, a delegation section, bands
 * A, B and C, a claimed list and an off-path list, then `## Done when` and dated `## Session update` notes.
 */

export const FIXTURE_TITLE = 'A fixture epic for the compact tracker page';

const frontmatter = (o) => `---\n${Object.entries(o).map(([k, v]) => `${k}: ${v}`).join('\n')}\n---\n`;

/** [id, size, band, why] for each ordered line, in list order (the number is its position). */
export const ORDERED = [
  // health chain
  ['3901', '5', 'B', 'Clears: the branch fails the standards check.'],
  ['3902', '3', 'A', 'Clears: CI cannot be switched on.'],
  // delegation
  ['3903', '5', 'A', 'operator-added · Removes: a person choosing the provider by hand.'],
  ['3904', 'epic', 'A', 'Container: decouple dispatch from one CLI.'],
  // band A
  ['3905', '3', 'A', 'Clears: a review step runs only from the branch.'],
  ['3906', 'task', 'A', 'Clears: the agent brief tells workers the wrong step.'],
  ['3907', 'task', 'A', 'why: (unwritten)'],
  ['3908', '2', 'A', 'Clears: the sync pass loops on conflicts.'],
  ['3909', '2', 'A', 'Clears: a good review is marked blocked.'],
  ['3910', '3', 'A', 'Removes: hand-writing the job record.'],
  ['3911', '5', 'A', 'Removes: a person driving fix dispatch.'],
  ['3912', '5', 'A', 'Clears: nothing caps concurrent lanes.'],
  ['3913', '3', 'A', 'Clears: the tick has no failure backoff.'],
  // band B
  ['3914', '3', 'B', 'Clears: review briefs carry an unresolved token.'],
  ['3915', '5', 'B', 'why: (unwritten)'],
  ['3916', '2', 'B', 'Clears: the reaper crashes on a null row.'],
  ['3917', '5', 'B', 'Removes: about eight commands by hand.'],
  // band C
  ['3918', 'decision', 'C', 'Clears: a cleared item drops out of dispatch.'],
  ['3919', 'decision', 'C', 'Rules what context a dispatched agent gets.'],
  ['3920', '3', 'C', 'Clears: the deployed command drifts from source.'],
];

/** Claimed lines: [id, size, why]. */
export const CLAIMED = [
  ['3930', 'task', 'A spawned review session hard-fails on a full lane pool'],
  ['3931', 'epic', 'Graduate the branch to main in small pieces'],
];

/** Off-path lines: [id, size, prose]. */
export const OFFPATH = [
  ['3940', 'decision', 'parent #3054: whether an approval carries across a merge-only push.'],
];

/** The H1 of each card: the long one exercises the cut to about 40 characters. */
export const TITLES = {
  3901: 'Fix the standards check on the prototype branch',
  3902: 'Switch CI on for the prototype branch, so a check gates what lands on it',
  3903: 'Route dispatch to the right provider',
  3904: 'Decouple dispatch from the Claude CLI',
  3905: 'Graduate the review step to main',
  3906: 'Fix the agent brief',
  3907: 'Make the unwritten line real',
  3908: 'Stop the sync pass looping',
  3909: 'Do not mark a good review blocked',
  3910: 'Write the job record mechanically',
  3911: 'Wire fix dispatch',
  3912: 'Cap concurrent lanes',
  3913: 'Back off a failing tick',
  3914: 'Resolve the review brief token',
  3915: 'Settle the open design',
  3916: 'Guard the reaper against a null row',
  3917: 'Fold the session-start commands',
  3918: 'Rule the renumbering of a cleared item',
  3919: 'Rule the context a dispatched agent gets',
  3920: 'Deploy the wip command from source',
  3930: 'Survive a full lane pool',
  3931: 'Graduate the prototype branch',
  3940: 'Decide the merge-only approval',
};

/** Status of a card, when it is not `open`. */
export const STATUS = { 3930: 'active', 3931: 'active', 3906: 'active' };

export const NOTES = [
  { date: '2026-09-18', qualifier: null, digest: 'first fixture note', body: 'Body of the first note.\n\nSecond paragraph of the first note.' },
  { date: '2026-09-19', qualifier: 'continued', digest: 'second fixture note', body: 'Body of the second note, with `code` and **bold**.' },
  { date: '2026-09-20', qualifier: null, digest: 'the latest fixture note, whose title is what the page shows', body: 'LATEST-BODY-MARKER first paragraph.\n\n- a bullet\n- another bullet' },
];

const line = (n, [id, size, band, why]) => `${n}. #${id} · ${size} · ${band} · ${why}`;

/** The tracker card's whole text. `overrides.ordered` replaces the ordered lines (same tuple shape). */
export function trackerCardText({ ordered = ORDERED, notes = NOTES } = {}) {
  const at = (from, to) => ordered.slice(from, to);
  let n = 0;
  const block = (rows) => rows.map((r) => line(++n, r)).join('\n');
  return [
    frontmatter({ bornAs: 'xfixture', kind: 'epic', parent: '"3029"', status: 'active', dateOpened: '"2026-08-28"', dateStarted: '"2026-08-31"' }),
    `# ${FIXTURE_TITLE}`,
    '',
    '> **STANDING GOAL FOR THIS EPIC (operator, 2026-08-29): improve the prototype and the machinery it depends on — not deliver any particular backlog item.** Discard work on an item freely, without ceremony.',
    '',
    '## Priority order',
    '',
    'Updated: 2026-09-20 by fixture — a long prose line the compact page must not carry. Derived by the rules below from the ranker.',
    '',
    '**Rules — re-apply exactly as written.**',
    '',
    '0. **The mechanised system first.** Prose that names #3999 is not an entry.',
    '',
    '**Health chain (rule 1) — before every band**',
    '',
    block(at(0, 2)),
    '',
    '**Delegation to Codex and Antigravity (operator priority) — before band A**',
    '',
    block(at(2, 4)),
    '',
    '**Band A — dispatchable now**',
    '',
    block(at(4, 13)),
    '',
    '**Band B — design first (uncleared)**',
    '',
    block(at(13, 17)),
    '',
    '**Band C — needs an operator ruling**',
    '',
    block(at(17)),
    '',
    '**Claimed (`status: active`) — listed, not ordered**',
    '',
    CLAIMED.map(([id, size, why]) => `- #${id} · ${size} · claimed · ${why}`).join('\n'),
    '',
    '**Off-path, not ordered — not #3383 cards.** Listed so nothing is silently dropped.',
    '',
    OFFPATH.map(([id, size, prose]) => `- off-path #${id} · ${size} · ${prose}`).join('\n'),
    '',
    '## Done when',
    '',
    '1. A background process can run a full cycle.',
    '2. A blocked case reaches a person.',
    '',
    '## The problem, stated plainly',
    '',
    'Some prose the page does not carry.',
    '',
    notes.map((u) => `## Session update (${u.date}${u.qualifier ? `, ${u.qualifier}` : ''}) — ${u.digest}\n\n${u.body}\n`).join('\n'),
  ].join('\n');
}

/** Every card file, `{ 'backlog/<name>.md': text }`, plus the tracker card. */
export function fixtureFiles({ ordered = ORDERED, notes = NOTES } = {}) {
  const files = { 'backlog/3383-tracker.md': trackerCardText({ ordered, notes }) };
  const ids = [...ordered.map((r) => r[0]), ...CLAIMED.map((r) => r[0]), ...OFFPATH.map((r) => r[0])];
  for (const id of ids) {
    const status = STATUS[id] ?? 'open';
    files[`backlog/${id}-card.md`] = `${frontmatter({ kind: 'story', size: 3, status, parent: '"3383"', dateOpened: '"2026-09-01"' })}\n# ${TITLES[id] ?? `Card ${id}`}\n\nBody of card ${id}.\n`;
  }
  return files;
}
