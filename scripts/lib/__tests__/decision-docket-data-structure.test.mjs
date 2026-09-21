/**
 * @file decision-docket-data-structure.test.mjs — the extractor keeps a card's block structure (lists, quotes,
 * fences, headings) as markdown for the shared renderer, instead of flattening every paragraph onto one line.
 * Complements decision-docket-data.test.mjs (which pins what each field MEANS); these pin what each field's text
 * still LOOKS like when it reaches the renderer.
 */
import { describe, expect, it } from 'vitest';
import { parseDecisionBody, parseForkSection } from '../decision-docket-data.mjs';

describe('extractor keeps block markdown intact', () => {
  it('keeps a blockquote in the digest as quoted lines, not one flattened "> …" run', () => {
    const { digest } = parseDecisionBody('# T\n\n> **Update:** built.\n> Second line.\n\nAfter.\n\n## Fork 1 — q\n\nx');
    expect(digest).toEqual(['> **Update:** built.\n> Second line.', 'After.']);
  });

  it('keeps a list in the digest as separate lines', () => {
    const { digest } = parseDecisionBody('# T\n\nPlan:\n\n- one\n- two\n  - nested\n\n## Fork 1 — q\n\nx');
    expect(digest[1]).toBe('- one\n- two\n  - nested');
  });

  it('does not split a paragraph at a blank line INSIDE a fenced code block', () => {
    const fence = '```svg\n<svg>\n\n<path/>\n</svg>\n```';
    const { digest } = parseDecisionBody(`# T\n\nLead.\n\n${fence}\n\nAfter.\n\n## Fork 1 — q\n\nx`);
    expect(digest).toEqual(['Lead.', fence, 'After.']);
  });

  it('does not start a new section at a "## " line inside a fenced code block', () => {
    const body = '# T\n\nDigest.\n\n## Fork 1 — q\n\nWhy.\n\n- **(a)** A. **Rejected**: no.\n- **(b)** **B** ← **RECOMMENDED**.\n\n'
      + 'Sample:\n\n```md\n## Not a section\n\ntext\n```\n\n**Skeptic:** SURVIVES.\n**Screen:** clear.\n';
    const parsed = parseDecisionBody(body);
    expect(parsed.forks).toHaveLength(1);
    expect(parsed.forks[0].notes.map((n) => n.kind)).toEqual(['text', 'code']);
    expect(parsed.forks[0].notes[1].text).toBe('## Not a section\n\ntext');
    expect(parsed.forks[0].skeptic).toBe('SURVIVES.');
  });

  it('keeps an option\'s nested sub-bullets on their own lines (dedented to the option\'s content column)', () => {
    const section = 'Why.\n\n- **(a)** A. **Rejected**: no.\n- **(b)** **B** ← **RECOMMENDED**. Reasons:\n  - first\n  - second\n\n**Skeptic:** SURVIVES.\n**Screen:** clear.';
    const fork = parseForkSection(1, '', section);
    expect(fork.options[1].body).toBe('**B**. Reasons:\n- first\n- second');
  });

  it('keeps a multi-paragraph `why` as separate paragraphs', () => {
    const fork = parseForkSection(1, '', 'First para.\n\nSecond para.\n\n- **(a)** A. **Rejected**: no.\n- **(b)** **B** ← **RECOMMENDED**.\n\n**Skeptic:** SURVIVES.\n**Screen:** clear.');
    expect(fork.why).toBe('First para.\n\nSecond para.');
  });

  it('keeps a fence inside a note paragraph (prose directly above it) as markdown, not a flattened line', () => {
    const fork = parseForkSection(1, '', 'Why.\n\n- **(a)** A. **Rejected**: no.\n- **(b)** **B** ← **RECOMMENDED**.\n\nShape:\n```js\nlet a = 1;\nlet b = 2;\n```\n\n**Skeptic:** SURVIVES.\n**Screen:** clear.');
    expect(fork.notes).toHaveLength(1);
    expect(fork.notes[0]).toEqual({ kind: 'text', text: 'Shape:\n```js\nlet a = 1;\nlet b = 2;\n```' });
  });

  it('keeps a done-when item\'s continuation lines and nested bullets on their own lines', () => {
    const { doneWhen } = parseDecisionBody('# T\n\nD.\n\n## Fork 1 — q\n\nx\n\n## Done when\n\n1. **Executable** — a command passes:\n   - sub a\n   - sub b\n2. Second.\n');
    expect(doneWhen).toEqual(['1. **Executable** — a command passes:\n- sub a\n- sub b', '2. Second.']);
  });
});

describe('Skeptic/Screen label stripping never leaves an orphaned closing marker', () => {
  const opts = '- **(a)** A. **Rejected**: no.\n- **(b)** **B** ← **RECOMMENDED**.';
  const run = (verdicts) => parseForkSection(1, '', `Why.\n\n${opts}\n\n${verdicts}`);

  it('a bold span opened at the label and closed after the verdict word: "**Skeptic: SURVIVES.** rest"', () => {
    const f = run('**Skeptic: SURVIVES-WITH-AMENDMENT.** Attacked and fixed.\n**Screen: clear.** Both held.');
    expect(f.skeptic).toBe('SURVIVES-WITH-AMENDMENT. Attacked and fixed.');
    expect(f.screen).toBe('clear. Both held.');
  });

  it('a code span opened at the label: "`Skeptic: SURVIVES.` rest"', () => {
    expect(run('`Skeptic: SURVIVES (near-precedent).` Attacked it.\n`Screen: clear.` Fine.').skeptic).toBe('SURVIVES (near-precedent). Attacked it.');
  });

  it('a label whose emphasis closes AT the label leaves the verdict\'s own emphasis alone', () => {
    const f = run('**Skeptic:** **SURVIVES.** Attacked `x` and fixed.\n**Screen:** *clear*.');
    expect(f.skeptic).toBe('**SURVIVES.** Attacked `x` and fixed.');
    expect(f.screen).toBe('*clear*.');
  });

  it('a wrapped parenthetical aside in the label still parses', () => {
    const f = run('*Skeptic (dedicated fresh sub-agent,\nfour axes):* SURVIVES.\nScreen: clear.');
    expect(f.skeptic).toBe('SURVIVES.');
    expect(f.screen).toBe('clear.');
  });
});
