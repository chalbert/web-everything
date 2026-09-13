/**
 * @file delivery-agent-marker.test.mjs — coverage for the per-item `deliveryAgent:` frontmatter opt-in
 * (mechanical-dispatcher, epic #3383, Part 2). See `../delivery-agent-marker.mjs`'s own header for the design.
 */
import { describe, it, expect } from 'vitest';

import { DELIVERY_AGENT_MARKER_KEY, parseDeliveryAgentMarker, readItemDeliveryAgentMarker } from '../delivery-agent-marker.mjs';

describe('parseDeliveryAgentMarker (PURE)', () => {
  it('reads a scalar `deliveryAgent:` frontmatter value, trimmed', () => {
    const content = '---\nstatus: open\ndeliveryAgent: codex\n---\n\nBody.\n';
    expect(parseDeliveryAgentMarker(content)).toBe('codex');
  });

  it('tolerates surrounding whitespace and quotes, matching `readField`\'s own convention', () => {
    expect(parseDeliveryAgentMarker('---\ndeliveryAgent:   codex  \n---\n')).toBe('codex');
    expect(parseDeliveryAgentMarker('---\ndeliveryAgent: "codex"\n---\n')).toBe('codex');
  });

  it('returns null when the field is absent, blank, or there is no frontmatter block at all', () => {
    expect(parseDeliveryAgentMarker('---\nstatus: open\n---\n')).toBeNull();
    expect(parseDeliveryAgentMarker('---\ndeliveryAgent:\n---\n')).toBeNull();
    expect(parseDeliveryAgentMarker('no frontmatter here')).toBeNull();
    expect(parseDeliveryAgentMarker('')).toBeNull();
  });

  it('is named by ONE exported key, so a future rename touches one line', () => {
    expect(DELIVERY_AGENT_MARKER_KEY).toBe('deliveryAgent');
  });
});

describe('readItemDeliveryAgentMarker (IO SHELL)', () => {
  const io = (files, contents) => ({
    listFiles: () => files,
    read: (p) => {
      const name = p.split('/').pop();
      if (!(name in contents)) throw new Error(`no such file: ${p}`);
      return contents[name];
    },
  });

  it('resolves the item to its one backlog file and reads the marker off it', () => {
    const result = readItemDeliveryAgentMarker('3629', io(
      ['3629-some-item.md', '3630-other-item.md'],
      { '3629-some-item.md': '---\ndeliveryAgent: codex\n---\n' },
    ));
    expect(result).toBe('codex');
  });

  it('returns null for no `num` at all — a repair dispatch with no known item, never a throw', () => {
    expect(readItemDeliveryAgentMarker(null, io([], {}))).toBeNull();
    expect(readItemDeliveryAgentMarker('', io([], {}))).toBeNull();
    expect(readItemDeliveryAgentMarker(undefined, io([], {}))).toBeNull();
  });

  it('returns null when the item cannot be resolved to exactly one file — never guesses', () => {
    // No match.
    expect(readItemDeliveryAgentMarker('9999', io(['3629-some-item.md'], {}))).toBeNull();
    // Ambiguous (two files claiming the same id — should never happen, but this must not throw upward).
    expect(readItemDeliveryAgentMarker('3629', io(['3629-a.md', '3629-b.md'], {
      '3629-a.md': '---\ndeliveryAgent: codex\n---\n', '3629-b.md': '---\ndeliveryAgent: codex\n---\n',
    }))).toBeNull();
  });

  it('degrades to null on a read failure — a marker must never itself block a dispatch', () => {
    const result = readItemDeliveryAgentMarker('3629', {
      listFiles: () => ['3629-some-item.md'],
      read: () => { throw new Error('EACCES'); },
    });
    expect(result).toBeNull();
  });

  it('degrades to null when the resolved file has the field absent/blank', () => {
    const result = readItemDeliveryAgentMarker('3629', io(
      ['3629-some-item.md'],
      { '3629-some-item.md': '---\nstatus: open\n---\n' },
    ));
    expect(result).toBeNull();
  });
});
