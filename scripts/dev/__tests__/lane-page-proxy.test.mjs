// #2139 — pure half of the lane page-proxy: registry parse + URL→lane target resolution.
import { describe, it, expect } from 'vitest';
import { parseRegistry, resolveLaneTarget, LANE_PORTS_REGISTRY } from '../lane-page-proxy.mjs';

const REGISTRY = {
  '2138': { port: 3110, lane: 1, repo: 'webeverything' },
  '42': { port: 3120, lane: 2, repo: 'webeverything' },
};

describe('parseRegistry', () => {
  it('parses a valid registry text', () => {
    expect(parseRegistry(JSON.stringify(REGISTRY))).toEqual(REGISTRY);
  });

  it.each([
    ['missing text', null],
    ['empty text', ''],
    ['invalid JSON', '{oops'],
    ['array root', '[1,2]'],
    ['scalar root', '"str"'],
  ])('resolves to no mappings on %s', (_label, text) => {
    expect(parseRegistry(text)).toEqual({});
  });

  it('drops malformed entries but keeps valid ones', () => {
    const mixed = {
      '2138': { port: 3110, lane: 1 },
      'not-a-num': { port: 3120, lane: 2 },
      '99': { lane: 3 }, // no port
      '100': 'scalar',
    };
    expect(parseRegistry(JSON.stringify(mixed))).toEqual({ '2138': { port: 3110, lane: 1 } });
  });
});

describe('resolveLaneTarget', () => {
  it('resolves the canonical slugged page URL', () => {
    expect(resolveLaneTarget('/backlog/2138-should-lane-landing-move/', REGISTRY)).toEqual({
      num: '2138',
      port: 3110,
      lane: 1,
    });
  });

  it('resolves the bare-number redirect URL and sub-paths', () => {
    expect(resolveLaneTarget('/backlog/2138/', REGISTRY)?.port).toBe(3110);
    expect(resolveLaneTarget('/backlog/2138-slug/anything/deeper', REGISTRY)?.port).toBe(3110);
  });

  it('ignores query strings and normalizes zero-padded ids', () => {
    expect(resolveLaneTarget('/backlog/2138-slug/?tab=x', REGISTRY)?.port).toBe(3110);
    expect(resolveLaneTarget('/backlog/042-old-item/', REGISTRY)?.port).toBe(3120);
  });

  it('falls through (null) for the index, unmapped items, and non-backlog paths', () => {
    expect(resolveLaneTarget('/backlog/', REGISTRY)).toBeNull();
    expect(resolveLaneTarget('/backlog/9999-unmapped/', REGISTRY)).toBeNull();
    expect(resolveLaneTarget('/blocks/droplist/', REGISTRY)).toBeNull();
    expect(resolveLaneTarget('', REGISTRY)).toBeNull();
    expect(resolveLaneTarget('/backlog/2138-slug/', null)).toBeNull();
  });

  it('does not match a slug that merely starts with digits-dash inside the index page path', () => {
    expect(resolveLaneTarget('/backlog', REGISTRY)).toBeNull();
  });
});

describe('LANE_PORTS_REGISTRY', () => {
  it('is the .claude-relative registry path the CLI and plugin share', () => {
    expect(LANE_PORTS_REGISTRY).toBe('.claude/lane-ports.json');
  });
});
