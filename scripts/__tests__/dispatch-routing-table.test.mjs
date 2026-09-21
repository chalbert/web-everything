/**
 * @file dispatch-routing-table.test.mjs — #3717 step 5: the PUBLISHED routing table and the code cannot drift.
 *
 * The card asks for the criteria to be "written down where a human can audit them", generated from the same
 * pure functions the dispatch path calls, "with a test that fails when the checked-in table drifts from what
 * the code produces". This is that test, and it is the whole reason the table is trustworthy: a published
 * table nothing re-derives is a comment, and a comment about routing is exactly what #3717 replaces.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import {
  BEGIN, END, RUNBOOK, TABLE_ROWS, expectedRunbook, loadScorecards, renderRoutingTable, spliceBlock,
} from '../gen-dispatch-routing-table.mjs';
import { LAUNCH_KINDS } from '../operations/dispatch-lane.mjs';

describe('the checked-in routing table equals what the code produces', () => {
  it('does not drift — run `npm run gen:dispatch-routing-table` if this fails', () => {
    expect(readFileSync(RUNBOOK, 'utf8')).toBe(expectedRunbook());
  });

  it('is deterministic: regenerating over the same inputs is byte-identical', () => {
    const scorecards = loadScorecards();
    expect(renderRoutingTable(scorecards)).toBe(renderRoutingTable(scorecards));
    // and it carries no clock, so a re-run tomorrow is still a no-op diff
    expect(renderRoutingTable(scorecards)).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it('covers every launch kind the dispatcher can start, plus `review`', () => {
    const kinds = new Set(TABLE_ROWS.map((r) => r.kind));
    for (const kind of LAUNCH_KINDS) expect([...kinds], kind).toContain(kind);
    expect([...kinds]).toContain('review');
  });

  it('states the routed/executed gap rather than presenting a route as if it ran', () => {
    const block = renderRoutingTable(loadScorecards());
    expect(block).toContain('| dispatch | derived `taskType` | routed | executed | supervision | why |');
    expect(block).toContain('**The gap.**');
    expect(block).toContain('#3443');
    // and it names the three taskTypes nothing produces, so the gap in the trust data is visible too
    for (const taskType of ['self-fix', 'other', 'conflict-resolution']) expect(block).toContain(`\`${taskType}\``);
  });
});

describe('the splice is idempotent and never eats the prose around it', () => {
  it('replaces an existing block in place', () => {
    const doc = `before\n\n${BEGIN}\nold\n${END}\n\nafter\n`;
    const out = spliceBlock(doc, `${BEGIN}\nnew\n${END}`);
    expect(out).toBe(`before\n\n${BEGIN}\nnew\n${END}\n\nafter\n`);
    expect(spliceBlock(out, `${BEGIN}\nnew\n${END}`)).toBe(out);
  });

  it('appends when the doc has no block yet', () => {
    expect(spliceBlock('prose\n', `${BEGIN}\nx\n${END}`)).toBe(`prose\n\n${BEGIN}\nx\n${END}\n`);
  });
});
