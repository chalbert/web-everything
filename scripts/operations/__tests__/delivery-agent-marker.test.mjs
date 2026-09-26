/**
 * @file delivery-agent-marker.test.mjs — coverage for the per-item `deliveryAgent:` frontmatter opt-in
 * (mechanical-dispatcher, epic #3383, Part 2). See `../delivery-agent-marker.mjs`'s own header for the design.
 *
 * Ported from the prototype branch (`origin/lane/mechanical-dispatcher`) as-is — `delivery-agent-marker.mjs`
 * itself was copied verbatim from that branch onto main (#3906), so this suite needed no adaptation to match.
 */
import { describe, it, expect } from 'vitest';

import {
  DELIVERY_AGENT_MARKER_KEY, DELIVERY_AGENT_REASON_KEY, parseDeliveryAgentMarker, parseDeliveryAgentReason,
  readItemDeliveryAgentMarker, readItemDeliveryAgentOverride, defaultFreshenPrimaryCheckout,
} from '../delivery-agent-marker.mjs';

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

describe('defaultFreshenPrimaryCheckout (mechanical-dispatcher #3383 Part 2 follow-up — the marker-ordering fix)', () => {
  /** A fake `run` shaped like `main-staleness.mjs#gitRun`'s own return, keyed by the exact argv joined. */
  const fakeRun = (responses) => {
    const calls = [];
    const run = (args) => {
      calls.push(args);
      const key = args.join(' ');
      if (key in responses) return responses[key];
      return { status: 0, stdout: '', stderr: '' };
    };
    return { run, calls };
  };

  it('reads the CURRENT branch and freshens THAT branch against its own origin ref', () => {
    const { run, calls } = fakeRun({
      'rev-parse --abbrev-ref HEAD': { status: 0, stdout: 'lane/mechanical-dispatcher\n', stderr: '' },
      'fetch origin lane/mechanical-dispatcher --quiet': { status: 0, stdout: '', stderr: '' },
      'rev-parse lane/mechanical-dispatcher': { status: 0, stdout: 'abc\n', stderr: '' },
      'rev-parse origin/lane/mechanical-dispatcher': { status: 0, stdout: 'abc\n', stderr: '' },
    });
    expect(() => defaultFreshenPrimaryCheckout('/repo', { run })).not.toThrow();
    expect(calls).toContainEqual(['fetch', 'origin', 'lane/mechanical-dispatcher', '--quiet']);
  });

  it('does nothing on a DETACHED HEAD — nothing safe to compare or fast-forward', () => {
    const { run, calls } = fakeRun({
      'rev-parse --abbrev-ref HEAD': { status: 0, stdout: 'HEAD\n', stderr: '' },
    });
    defaultFreshenPrimaryCheckout('/repo', { run });
    expect(calls).toEqual([['rev-parse', '--abbrev-ref', 'HEAD']]);
  });

  it('does nothing when the branch itself cannot be read — never guesses a base', () => {
    const { run, calls } = fakeRun({
      'rev-parse --abbrev-ref HEAD': { status: 128, stdout: '', stderr: 'fatal: not a git repository' },
    });
    defaultFreshenPrimaryCheckout('/repo', { run });
    expect(calls).toEqual([['rev-parse', '--abbrev-ref', 'HEAD']]);
  });

  it('NEVER THROWS — a dispatch decision must proceed even when freshening cannot', () => {
    const run = () => { throw new Error('ENOENT: no such file or directory, spawnSync git'); };
    expect(() => defaultFreshenPrimaryCheckout('/repo', { run })).not.toThrow();
  });

  // ── THE ACTUAL REGRESSION: the marker landed on `origin/<branch>` (a lane's PR merged it in), but THIS
  // checkout's own working copy is still behind — the exact residual gap the live Codex trial's own "the
  // marker can only currently take effect if it's already merged into main" finding names. Before this fix,
  // `readItemDeliveryAgentMarker`'s plain `readFileSync` would see the OLD, marker-less file forever; this
  // proves the freshen step pulls the landed state in, non-destructively, via `--ff-only --autostash`.
  it('a behind-but-not-diverged checkout is fast-forwarded to the branch that already carries the marker', () => {
    const { run, calls } = fakeRun({
      'rev-parse --abbrev-ref HEAD': { status: 0, stdout: 'main\n', stderr: '' },
      'fetch origin main --quiet': { status: 0, stdout: '', stderr: '' },
      'rev-parse main': { status: 0, stdout: 'old-sha-before-the-marker-landed\n', stderr: '' },
      'rev-parse origin/main': { status: 0, stdout: 'new-sha-carrying-the-marker\n', stderr: '' },
      'rev-list --count main..origin/main': { status: 0, stdout: '1\n', stderr: '' },
      'rev-list --count origin/main..main': { status: 0, stdout: '0\n', stderr: '' },
      'status --porcelain': { status: 0, stdout: '', stderr: '' },
      'pull --ff-only --autostash': { status: 0, stdout: '', stderr: '' },
    });
    defaultFreshenPrimaryCheckout('/repo', { run });
    expect(calls).toContainEqual(['pull', '--ff-only', '--autostash']);
  });
});

// #3840 (Fork 5 of #3801) — the required companion field, read from the same file as the marker.
describe('deliveryAgentReason (the required companion of the marker)', () => {
  const files = { '3629-some-item.md': '---\nstatus: open\ndeliveryAgent: codex\ndeliveryAgentReason: "trial of codex on a scoped doc fix"\n---\nBody\n' };
  const io = (fileMap) => ({ root: '/x', listFiles: () => Object.keys(fileMap), read: (p) => fileMap[p.split('/').pop()] });

  it('is named by ONE exported key, and the marker key does not match it as a prefix', () => {
    expect(DELIVERY_AGENT_REASON_KEY).toBe('deliveryAgentReason');
    expect(parseDeliveryAgentMarker('---\ndeliveryAgentReason: only a reason\n---\n')).toBeNull();
    expect(parseDeliveryAgentReason('---\ndeliveryAgent: codex\n---\n')).toBeNull();
    expect(parseDeliveryAgentReason('---\ndeliveryAgentReason: "why"\n---\n')).toBe('why');
  });

  it('reads both halves from one file, and never throws', () => {
    expect(readItemDeliveryAgentOverride('3629', io(files)))
      .toEqual({ deliveryAgent: 'codex', deliveryAgentReason: 'trial of codex on a scoped doc fix' });
    expect(readItemDeliveryAgentOverride(null, io({}))).toBeNull();
    expect(readItemDeliveryAgentOverride('9999', io(files))).toBeNull();
    expect(readItemDeliveryAgentOverride('3629', { root: '/x', listFiles: () => { throw new Error('boom'); } })).toBeNull();
  });

  it('returns a marker with a null reason (so the router can refuse it by name), and null for neither', () => {
    expect(readItemDeliveryAgentOverride('3629', io({ '3629-a.md': '---\ndeliveryAgent: codex\n---\n' })))
      .toEqual({ deliveryAgent: 'codex', deliveryAgentReason: null });
    expect(readItemDeliveryAgentOverride('3629', io({ '3629-a.md': '---\nstatus: open\n---\n' }))).toBeNull();
  });
});
