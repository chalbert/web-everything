import { describe, it, expect } from 'vitest';
import { buildReadyArgs, createDraftPromoteProvider } from '../draft-promote-provider.mjs';

describe('draft-promote-provider (draft-first PRs)', () => {
  it('buildReadyArgs is exactly `gh pr ready <pr>`, pr coerced to a string', () => {
    expect(buildReadyArgs(42)).toEqual(['pr', 'ready', '42']);
    expect(buildReadyArgs('42')).toEqual(['pr', 'ready', '42']);
  });

  it('the adapter shells buildReadyArgs through the injected exec and hands its result straight back', () => {
    const seen = [];
    const provider = createDraftPromoteProvider({ cwd: '/repo', exec: (args) => { seen.push(args); return 'ok'; } });
    expect(provider.ready(42)).toBe('ok');
    expect(seen).toEqual([['pr', 'ready', '42']]);
  });


  it('is named "gh", matching the sibling forge-land-provider adapter', () => {
    expect(createDraftPromoteProvider({ exec: () => '' }).name).toBe('gh');
  });
});
