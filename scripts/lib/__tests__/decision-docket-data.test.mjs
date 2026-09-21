/**
 * @file decision-docket-data.test.mjs — proof of the Decision Docket's DATA half (backlog/3562's data/template
 * separation): parsing a decision item's markdown body into the clean, prose-narrative-free JSON shape. Covers
 * the canonical "prepared-fork shape" (docs/agent/backlog-workflow.md#decision-docket), the combined
 * Skeptic:/Screen: line split (a real quirk of the source markdown — the two verdicts are often written on
 * consecutive lines with no blank line between them, so a naive paragraph split glues them together), and the
 * graceful degradation for a fork that doesn't match the shape (never fabricates content, always flags).
 */
import { describe, it, expect } from 'vitest';
import {
  OPTION_KINDS, parseForkSection, parseDecisionBody, ageDays, buildDecisionRecord,
} from '../decision-docket-data.mjs';

describe('parseForkSection', () => {
  it('parses the canonical shape: justification, lettered options, default vs rejected, skeptic + screen', () => {
    const section = `**Why this is a real fork.** A count-only bar is gameable.

- **(a)** Fixed count only. **Rejected**: gameable.
- **(b)** **Count plus one informative trial** ← **RECOMMENDED**. Volume becomes evidence of range.
- **(c)** No numeric threshold. **Rejected**: reintroduces the gap.

**Skeptic:** SURVIVES-WITH-AMENDMENT — fixed a citation error.
**Screen:** clear — genuine merit difference.`;
    const fork = parseForkSection(1, '— What volume is required?', section);
    expect(fork.parseOk).toBe(true);
    expect(fork.crux).toBe('What volume is required?');
    expect(fork.why).toMatch(/count-only bar is gameable/);
    expect(fork.options).toHaveLength(3);
    expect(fork.options[0]).toMatchObject({ label: '(a)', kind: OPTION_KINDS.REJECTED });
    expect(fork.options[0].body).toMatch(/Rejected.*gameable/);
    expect(fork.options[1].kind).toBe(OPTION_KINDS.DEFAULT);
    // the "← **RECOMMENDED**" marker itself is stripped from the displayed body (redundant with `kind`)
    expect(fork.options[1].body).not.toMatch(/RECOMMENDED/);
  });

  it('keeps the sentence-ending period when stripping the RECOMMENDED marker, rather than gluing two sentences together', () => {
    const section = `Why.

- **(a)** **The good option** ← **RECOMMENDED**. Volume becomes evidence of range, not repetition.
- **(b)** The other one. **Rejected**: no.

**Skeptic:** SURVIVES.
**Screen:** clear.`;
    const fork = parseForkSection(1, '', section);
    expect(fork.options[0].body).toContain('option**. Volume becomes'); // period kept, sentences stay separated
    expect(fork.options[0].body).not.toContain('option** Volume'); // never glued with no punctuation
    expect(fork.options[1].kind).toBe(OPTION_KINDS.REJECTED);
  });

  it('keeps leftover context paragraphs (code samples, scope narrowing) as notes, never dropping real content', () => {
    const section = `**Why this is a real fork.** Reason.

- **(a)** Option A. **Rejected**: reason.
- **(b)** **Option B** ← **RECOMMENDED**.

Scope narrowed after attack: only the veto is ratified here.

**Skeptic:** SURVIVES.
**Screen:** clear.`;
    const fork = parseForkSection(2, '', section);
    expect(fork.notes).toHaveLength(1);
    expect(fork.notes[0]).toMatchObject({ kind: 'text' });
    expect(fork.notes[0].text).toMatch(/Scope narrowed/);
  });

  it('keeps a fenced code sample as its own preformatted note, never flattened through joinSoft', () => {
    const section = `Why.

- **(a)** A. **Rejected**: no.
- **(b)** **B** ← **RECOMMENDED**.

Illustrative shape only:

\`\`\`js
function f() {
  return 1;
}
\`\`\`

**Skeptic:** SURVIVES.
**Screen:** clear.`;
    const fork = parseForkSection(4, '', section);
    const codeNote = fork.notes.find((n) => n.kind === 'code');
    expect(codeNote).toBeDefined();
    expect(codeNote.text).toContain('function f() {\n  return 1;\n}');
  });

  it('flags (never fabricates) a fork with no lettered options', () => {
    const fork = parseForkSection(1, '— some question', 'Just prose, no bullet list at all.');
    expect(fork.parseOk).toBe(false);
    expect(fork.options).toHaveLength(0);
    expect(fork.warning).toMatch(/no lettered options/);
  });

  it('flags (never guesses) a fork whose options carry no RECOMMENDED marker', () => {
    const section = `Some justification.

- **(a) option one** — plain prose, no explicit marker.
- **(b) option two** — also no explicit marker.`;
    const fork = parseForkSection(3, '', section);
    expect(fork.options).toHaveLength(2);
    expect(fork.options.every((o) => o.kind === OPTION_KINDS.OPEN)).toBe(true);
    expect(fork.parseOk).toBe(false);
    expect(fork.warning).toMatch(/no option marked RECOMMENDED/);
  });

  it('flags a fork whose option text carries an unclosed bold marker (a nested sub-bullet that got flattened)', () => {
    // Real shape found in backlog/2209: an option's own body contains a nested "- (b1) ... - (b2) ..." list,
    // each with its own bold markers, that joinSoft flattens into one run-on line with an ODD "**" count.
    const section = `Why.

- **(a)** keep letterforms.** Legible, zero work.
- **(b)** **concept-bearing symbol** ← **RECOMMENDED**. Three candidates: - **(b1) horizon** — sun over the line. - **(b2) flag** — planted-flag metaphor.

**Skeptic:** SURVIVES.
**Screen:** clear.`;
    const fork = parseForkSection(1, '', section);
    expect(fork.parseOk).toBe(false);
    expect(fork.warning).toMatch(/unclosed bold marker/);
  });

  it('does NOT flag a fork whose option text has cleanly paired bold markers', () => {
    const section = `Why.

- **(a)** A plain option. **Rejected**: no.
- **(b)** **A clean bold phrase** ← **RECOMMENDED**. Trailing prose with no more bold at all.

**Skeptic:** SURVIVES.
**Screen:** clear.`;
    const fork = parseForkSection(1, '', section);
    expect(fork.parseOk).toBe(true);
  });

  it('accepts the legacy label style where the bold does not close right after the letter', () => {
    const section = `Why it forks.

- **(a) flat-minimal baseline** — keep the current approach.
- **(b) rich-dimensional marks** — adopt depth as baseline.

Skeptic: SURVIVES-WITH-AMENDMENT — no bold label used here.
Screen: clear.`;
    const fork = parseForkSection(1, '', section);
    expect(fork.options).toHaveLength(2);
    expect(fork.options[0].label).toBe('(a)');
    expect(fork.skeptic).toMatch(/^SURVIVES-WITH-AMENDMENT/);
    expect(fork.screen).toMatch(/^clear/);
  });

  it('recognizes the "[bold default]" bracket marker (119+ instances across the corpus) as a default, and its closing "**" no longer misreads as an unclosed bold pair', () => {
    // Real shape (backlog/2249 Fork 1): the bold span covers the whole "(label) title" and closes right at
    // the inline marker, with unbolded prose after — not the canonical trailing "← **RECOMMENDED**".
    const section = `Why.

- **(a) flat-minimal baseline — the family's core character. [bold default]** The merit that survives.
- **(b) rich-dimensional marks — depth as the baseline.** The restrained treatment is attractive.

Skeptic: SURVIVES.
Screen: clear.`;
    const fork = parseForkSection(1, '', section);
    expect(fork.parseOk).toBe(true);
    expect(fork.options[0].kind).toBe(OPTION_KINDS.DEFAULT);
    expect(fork.options[0].body).not.toMatch(/bold default/i);
    // no explicit "Rejected" marker on (b) at all — it's implicit from (a) already being the stated default,
    // the common legacy convention (backlog/2249, backlog/2938, …): never left as merely "open"/undecided.
    expect(fork.options[1].kind).toBe(OPTION_KINDS.REJECTED);
  });

  it('recognizes "(default)"/"(rejected …)"/"(dominated)" trailing parentheticals as markers', () => {
    const section = `Why.

- **(a) Keep the module in one place (rejected — status quo).** Rests on prior art.
- **(b) Vendor the built artifact (dominated).** Strictly worse than (c) on every axis.
- **(c) Relocate the runtime (default).** The only branch that clears every constraint.

Skeptic: SURVIVES.
Screen: clear.`;
    const fork = parseForkSection(1, '', section);
    expect(fork.options.map((o) => o.kind)).toEqual([OPTION_KINDS.REJECTED, OPTION_KINDS.REJECTED, OPTION_KINDS.DEFAULT]);
  });

  it('recognizes a standalone "**Default: (x).**" paragraph after the option bullets (69+ instances) and keeps it visible as a note', () => {
    const section = `Why.

- **(a) Repo-wide freeze.** The load-bearing set only.
- **(b) Keep the narrower scope.** Less disruption elsewhere.

**Default: (a).** The re-derived data strengthens the original case.

Skeptic: SURVIVES.
Screen: clear.`;
    const fork = parseForkSection(1, '', section);
    expect(fork.options[0].kind).toBe(OPTION_KINDS.DEFAULT);
    expect(fork.options[1].kind).toBe(OPTION_KINDS.REJECTED);
    expect(fork.notes.some((n) => /re-derived data strengthens/.test(n.text))).toBe(true);
  });

  it('accepts a backtick-wrapped or parenthetical-aside Skeptic/Screen label, not just a plain or bold one', () => {
    const section = `Why.

- **(a)** One. **Rejected**: no.
- **(b)** Two. [default]

\`Skeptic:\` **SURVIVES-WITH-AMENDMENT.** A throwaway sub-agent ran the four-axis prompt.
*Screen (separate fresh-context agent, no exposure to this session's authoring):* **clear.** Both questions held.`;
    const fork = parseForkSection(1, '', section);
    expect(fork.skeptic).toMatch(/^\*\*SURVIVES-WITH-AMENDMENT/);
    expect(fork.screen).toMatch(/^\*\*clear/);
  });

  it('does not misread a bare lowercase "rejected" used as ordinary prose (not a marker) as marking the option rejected', () => {
    // Real false positive found in backlog/2096 Fork 2: "…one typed, named error per rejected input…" inside
    // the option that is actually the fork's DEFAULT.
    const section = `Why.

- **(a) House-adapted register [bold default]** — a fixed skeleton with one typed, named error per rejected input.
- **(b) Full clone.** Rejected: too heavyweight for this register.

Skeptic: SURVIVES.
Screen: clear.`;
    const fork = parseForkSection(1, '', section);
    expect(fork.options[0].kind).toBe(OPTION_KINDS.DEFAULT);
    expect(fork.options[1].kind).toBe(OPTION_KINDS.REJECTED);
  });

  it('does not misread a negated "not recommended" inside a rejected option\'s own prose as a default marker', () => {
    const section = `Why.

- **(a) The chosen approach [bold default]** — clears every constraint.
- **(b) A coherent counter, not recommended.** Attractive but loses on merit.

Skeptic: SURVIVES.
Screen: clear.`;
    const fork = parseForkSection(1, '', section);
    expect(fork.options[0].kind).toBe(OPTION_KINDS.DEFAULT);
    expect(fork.options[1].kind).toBe(OPTION_KINDS.REJECTED);
  });
});

describe('parseDecisionBody', () => {
  it('extracts the digest (before the first heading), every Fork section, and the Done-when bullets', () => {
    const body = `# A title line, stripped

This is the digest paragraph.

## Grounding

Some grounding text, not a fork.

## Fork 1 — the question

**Why this is a real fork.** Reason.

- **(a)** A. **Rejected**: no.
- **(b)** **B** ← **RECOMMENDED**.

**Skeptic:** SURVIVES.
**Screen:** clear.

## Done when

1. **Executable** — a command passes.
2. Something else happens.
`;
    const parsed = parseDecisionBody(body);
    expect(parsed.digest).toEqual(['This is the digest paragraph.']);
    expect(parsed.forks).toHaveLength(1);
    expect(parsed.forks[0].crux).toBe('the question');
    expect(parsed.doneWhen).toHaveLength(2);
    expect(parsed.doneWhen[0]).toMatch(/^1\. \*\*Executable\*\*/);
  });

  it('reports no forks found rather than fabricating one', () => {
    const parsed = parseDecisionBody('# Title\n\nJust a digest, no forks, no Done-when.');
    expect(parsed.forks).toHaveLength(0);
    expect(parsed.gate).toBeNull();
    expect(parsed.parseOk).toBe(false);
    expect(parsed.warnings.join(' ')).toMatch(/No "## Fork N" sections/);
  });

  describe('validation-gate shape (no ## Fork N, closes with ## Recommendation)', () => {
    const gateBody = `# A gate

## Digest

**Verdict: not yet.** Wait for the trigger.

## What you're deciding

Whether to build X now.

## Why this isn't a classic fork (and is still a decision)

One-sided gate.

## Context & prior-art delta

| Incumbent | Delta |
|---|---|
| A | B |

## Recommendation

**Not yet.** Hold until the trigger.

**Un-gate trigger:** the next real failure.

**Skeptic:** SURVIVES — beat the attack.
**Screen:** clear.

## Done when

1. Filed.
2. Reopened on the trigger.
`;

    it('parses a gate: digest from ## Digest, deciding, prior-art, recommendation, and both verdict lines', () => {
      const parsed = parseDecisionBody(gateBody);
      expect(parsed.forks).toHaveLength(0);
      expect(parsed.parseOk).toBe(true);
      expect(parsed.warnings).toEqual([]);
      expect(parsed.digest).toEqual(['**Verdict: not yet.** Wait for the trigger.']);
      expect(parsed.gate.deciding).toBe('Whether to build X now.');
      expect(parsed.gate.priorArt).toMatch(/^\| Incumbent \| Delta \|/);
      expect(parsed.gate.recommendation).toContain('**Not yet.** Hold until the trigger.');
      expect(parsed.gate.recommendation).toContain('**Un-gate trigger:** the next real failure.');
      expect(parsed.gate.skeptic).toBe('SURVIVES — beat the attack.');
      expect(parsed.gate.screen).toBe('clear.');
      expect(parsed.doneWhen).toHaveLength(2);
    });

    it('keeps the verdict lines out of the displayed recommendation', () => {
      const { gate } = parseDecisionBody(gateBody);
      expect(gate.recommendation).not.toMatch(/Skeptic|Screen/);
    });

    it('flags (never fabricates) a gate whose recommendation has no Skeptic verdict', () => {
      const parsed = parseDecisionBody(gateBody.replace(/\*\*Skeptic:\*\*[^\n]*\n\*\*Screen:\*\*[^\n]*\n/, ''));
      expect(parsed.parseOk).toBe(false);
      expect(parsed.gate.skeptic).toBeNull();
      expect(parsed.warnings.join(' ')).toMatch(/no "Skeptic:" verdict line/);
    });

    it('still prefers forks: an item with a ## Fork N is never read as a gate, even if it has a Recommendation section', () => {
      const parsed = parseDecisionBody('# T\n\nDigest.\n\n## Fork 1 — q\n\n- **(a)** A. **Rejected**: no.\n- **(b)** **B** ← **RECOMMENDED**.\n\n**Skeptic:** SURVIVES.\n\n## Recommendation\n\nGo with B.\n');
      expect(parsed.forks).toHaveLength(1);
      expect(parsed.gate).toBeNull();
    });
  });
});

describe('ageDays', () => {
  it('computes whole days between dateOpened and now', () => {
    expect(ageDays('2026-09-01', new Date('2026-09-13'))).toBe(12);
  });
  it('never throws on a malformed date', () => {
    expect(ageDays('not-a-date', new Date('2026-09-13'))).toBe(0);
  });
});

describe('buildDecisionRecord', () => {
  const rankedEntry = {
    num: '64', title: 'Tree-select block', prepared: true, preparedDate: '2026-01-01',
    leverageScore: 42, directUnblocks: 2, transitiveUnblocks: 3, unblocksToReady: 1,
  };

  it('builds a full record from ranking data + a real file body', () => {
    const fileText = `---\ndateOpened: "2026-01-01"\n---\n\n# Tree-select block\n\nDigest here.\n\n## Fork 1 — q\n\nWhy.\n\n- **(a)** A. **Rejected**: no.\n- **(b)** **B** ← **RECOMMENDED**.\n\n**Skeptic:** SURVIVES.\n**Screen:** clear.\n`;
    const rec = buildDecisionRecord(rankedEntry, fileText, new Date('2026-02-01'));
    expect(rec.num).toBe('64');
    expect(rec.dateOpened).toBe('2026-01-01');
    expect(rec.ageInDays).toBe(31);
    expect(rec.digest).toEqual(['Digest here.']);
    expect(rec.forks).toHaveLength(1);
    expect(rec.parseOk).toBe(true);
  });

  it('degrades honestly (never throws, never invents) when the file text is unavailable', () => {
    const rec = buildDecisionRecord(rankedEntry, null);
    expect(rec.parseOk).toBe(false);
    expect(rec.forks).toEqual([]);
    expect(rec.warnings[0]).toMatch(/Source file not found/);
  });

  it('never parses a body for an un-prepared item — no forks are pulled if `prepared` is false', () => {
    const rec = buildDecisionRecord({ ...rankedEntry, prepared: false, preparedDate: null }, '# T\n\nDigest.\n\n## Fork 1 — q\n\n- **(a)** A. **Rejected**: no.\n');
    expect(rec.prepared).toBe(false);
    expect(rec.forks).toEqual([]);
  });

  it('every schema field is data, never prose narrative — there is no "correction"/"note" field anywhere', () => {
    const rec = buildDecisionRecord(rankedEntry, `---\ndateOpened: "2026-01-01"\n---\n\n# T\n\nD.\n`, new Date());
    const keys = Object.keys(rec);
    for (const forbidden of ['correction', 'note', 'update', 'retraction', 'commentary']) {
      expect(keys.some((k) => k.toLowerCase().includes(forbidden))).toBe(false);
    }
  });
});
