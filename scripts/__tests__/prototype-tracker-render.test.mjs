/**
 * @file scripts/__tests__/prototype-tracker-render.test.mjs
 * @description Proof of the pure renderer (prototype-tracker-render.mjs). Renders hand-built parsed-data
 *   structs (the shape parseTracker() returns) rather than going through the real parser, so this stays a
 *   focused check of the render layer's own contract — no `<!doctype>`/`<html>`/`<head>`/`<body>` (the
 *   Artifact tool supplies those), real content present, nothing fabricated when a section is empty.
 */
import { describe, it, expect } from 'vitest';
import { renderTrackerHtml } from '../lib/prototype-tracker-render.mjs';

const DATA = {
  frontmatter: { status: 'active', dateOpened: '2026-08-28', dateStarted: '2026-08-31' },
  title: 'A background mechanical dispatcher replaces the interactive session',
  standingGoal: 'improve the prototype and the machinery it depends on',
  doneWhen: ['A background process can run a full cycle.', 'A blocked case reaches a person.'],
  sessionUpdates: [
    { date: '2026-08-28', qualifier: null, digest: 'first pass', body: 'Early body.' },
    { date: '2026-09-14', qualifier: 'continued', digest: 'latest pass', body: 'Latest body with `code` and **bold**.' },
  ],
  latestUpdate: { date: '2026-09-14', qualifier: 'continued', digest: 'latest pass', body: 'Latest body with `code` and **bold**.' },
  latestDate: '2026-09-14',
};

describe('renderTrackerHtml', () => {
  const html = renderTrackerHtml(DATA, { generatedAt: '2026-09-14T12:00Z', itemNumber: '3383', sourcePath: 'backlog/3383-x.md' });

  it('emits a FRAGMENT — no outer document tags (the Artifact tool wraps those)', () => {
    expect(html).not.toMatch(/<!doctype/i);
    expect(html).not.toMatch(/<html/i);
    expect(html).not.toMatch(/<head>/i);
    expect(html).not.toMatch(/<body>/i);
  });

  it('carries a <title> naming the epic', () => {
    expect(html).toMatch(/<title>Prototype Tracker — #3383<\/title>/);
  });

  it('renders the status badge and both dates from frontmatter', () => {
    expect(html).toMatch(/status-active/);
    expect(html).toMatch(/opened 2026-08-28/);
    expect(html).toMatch(/started 2026-08-31/);
  });

  it('renders the standing goal callout', () => {
    expect(html).toMatch(/Standing goal/);
    expect(html).toMatch(/improve the prototype/);
  });

  it('renders every "Done when" item, numbered', () => {
    expect(html).toMatch(/A background process can run a full cycle\./);
    expect(html).toMatch(/A blocked case reaches a person\./);
  });

  it('marks the latest update distinctly and renders inline code/bold from the body', () => {
    expect(html).toMatch(/card latest/);
    expect(html).toMatch(/<code>code<\/code>/);
    expect(html).toMatch(/<b>bold<\/b>/);
  });

  it('renders earlier updates in a reverse-chronological, collapsible section', () => {
    expect(html).toMatch(/Earlier updates \(1\)/);
    expect(html).toMatch(/first pass/);
  });

  it('escapes HTML-special characters in user content (no injection from tracker text)', () => {
    const withMarkup = renderTrackerHtml({ ...DATA, title: '<script>alert(1)</script>' }, { generatedAt: 'x' });
    expect(withMarkup).not.toMatch(/<script>alert/);
    expect(withMarkup).toMatch(/&lt;script&gt;/);
  });

  it('reports an empty "Done when" plainly rather than fabricating content', () => {
    const empty = renderTrackerHtml({ ...DATA, doneWhen: [] }, { generatedAt: 'x' });
    expect(empty).toMatch(/No "Done when" section found/);
  });

  it('reports no session updates plainly when there are none yet', () => {
    const empty = renderTrackerHtml({ ...DATA, sessionUpdates: [], latestUpdate: null }, { generatedAt: 'x' });
    expect(empty).toMatch(/No session-update entries found/);
  });
});
