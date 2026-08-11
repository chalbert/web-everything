/**
 * @file pr-body-edit.test.mjs — the stamp survives a body rewrite, and the guard denies the raw command.
 */
import { describe, it, expect } from 'vitest';
import { withCarriedStamps } from '../pr-body-edit.mjs';
import { buildAuthorActorMarker, parseAuthorActorId, readAuthorActorStamps } from '../lib/review-independence.mjs';
import { reason } from '../guard-bash.mjs';

const A = '01f39b97-274a-4078-8eeb-e7f8d6008673';
const B = 'ffffffff-1111-2222-3333-444444444444';
const stamp = (id) => buildAuthorActorMarker(id);

describe('withCarriedStamps', () => {
  it('carries a stamp the replacement body dropped', () => {
    // The #1162 case: pr-land stamped the body at open, three `gh pr edit --body-file` rewrites dropped it,
    // and the self-clear guard then read `unknown-author` and permitted the author's own clearance.
    const { body, carried } = withCarriedStamps(`old text\n\n${stamp(A)}`, 'brand new body');
    expect(carried).toEqual([A]);
    expect(parseAuthorActorId(body)).toBe(A);
    expect(body).toContain('brand new body');
  });

  it('does not duplicate a stamp the replacement already carries', () => {
    const next = `new body\n\n${stamp(A)}`;
    const { body, carried } = withCarriedStamps(`old\n\n${stamp(A)}`, next);
    expect(carried).toEqual([]);
    expect(readAuthorActorStamps(body)).toEqual([A]);
  });

  it('carries BOTH stamps of an ambiguous body, keeping it ambiguous', () => {
    // `parseAuthorActorId` resolves a two-stamp body to '' by design (agreement-or-nothing). Carrying only one
    // would convert an unresolvable body into a confident single-author one — a refusal silently becoming a
    // permit, which is the same class of defect this whole script exists to close.
    const { body } = withCarriedStamps(`old\n\n${stamp(A)}\n${stamp(B)}`, 'new');
    expect(readAuthorActorStamps(body).sort()).toEqual([A, B].sort());
    expect(parseAuthorActorId(body)).toBe('');
  });

  it('leaves an unstamped body unstamped rather than inventing one', () => {
    const { body, carried } = withCarriedStamps('no stamp here', 'new');
    expect(carried).toEqual([]);
    expect(readAuthorActorStamps(body)).toEqual([]);
  });
});

describe('guard-bash denies a raw PR-body rewrite', () => {
  for (const cmd of [
    'gh pr edit 1162 --body-file /tmp/body.md',
    'gh pr edit 1162 --repo chalbert/web-everything --body-file /tmp/b.md',
    'gh pr edit 1162 --body "text"',
    'gh pr edit 1162 --body="text"',
  ]) {
    it(`denies: ${cmd}`, () => {
      expect(reason(cmd)).toMatch(/authored-by-actor|pr-body-edit/);
    });
  }

  it('allows a label edit — every `gh pr edit` in scripts/ is labels only', () => {
    expect(reason('gh pr edit 1162 --add-label ready-to-merge')).toBeFalsy();
    expect(reason('gh pr edit 1162 --remove-label review:pending')).toBeFalsy();
  });

  it('honours the sanctioned override, which is how pr-body-edit itself writes', () => {
    expect(reason('PR_BODY_STAMP_OK=1 gh pr edit 1162 --body-file /tmp/b.md')).toBeFalsy();
  });
});
