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
  // Every spelling that replaces the body. The short flags and the quoted form were BYPASSES in the first
  // cut — `gh` documents `-b`/`-F` as exact equivalents, and a quoted `"--body-file"` has a quote before the
  // dashes rather than whitespace, so a raw-string regex missed both.
  for (const cmd of [
    'gh pr edit 1162 --body-file /tmp/body.md',
    'gh pr edit 1162 --repo chalbert/web-everything --body-file /tmp/b.md',
    'gh pr edit 1162 --body "text"',
    'gh pr edit 1162 --body="text"',
    'gh pr edit 1162 -F /tmp/body.md',
    'gh pr edit 1162 -b "text"',
    'gh pr edit 1162 "--body-file" /tmp/b.md',
    "gh pr edit 1162 '--body' 'text'",
    'gh api -X PATCH repos/o/r/pulls/1162 -f body=text',
    'gh api graphql -f query=mutation{updatePullRequest(input:{body:"x"})}',
    // pflag glues a value onto the shorthand, so these are ONE token each. Anchoring `-[bF]$` matched none
    // of them — the fourth bypass, each verified against the real `gh`.
    'gh pr edit 1162 -F/tmp/body.md',
    'gh pr edit 1162 -F=/tmp/body.md',
    'gh pr edit 1162 -bhello',
    'gh pr edit 1162 -b=hello',
    // The payload is in a file, so no `body=` appears anywhere in argv — refused on shape, not content.
    'gh api repos/o/r/pulls/1162 -X PATCH --input /tmp/patch.json',
    // …and the graphql endpoint has no `pulls/<n>` path to key on, so with the mutation in a file NEITHER the
    // endpoint nor `updatePullRequest` appears in argv. Verified against real `gh`: it reaches the resolver.
    'gh api graphql --input /tmp/gql.json',
    'gh api graphql --input -',
    'gh api graphql -F query=@/tmp/mutation.graphql',
  ]) {
    it(`denies: ${cmd}`, () => {
      expect(reason(cmd)).toMatch(/authored-by-actor|pr-body-edit/);
    });
  }

  // `-B` is `--base`, a different flag entirely. Case matters, and denying it would block a legitimate
  // retarget. Dropping the `$` anchor made this test load-bearing: `-[bF]` without it is one case-fold away
  // from swallowing `-Bmain`.
  it('does not deny the base flag, which only differs by case', () => {
    expect(reason('gh pr edit 1162 -B main')).toBeFalsy();
    expect(reason('gh pr edit 1162 -Bmain')).toBeFalsy();
    expect(reason('gh pr edit 1162 --base main')).toBeFalsy();
  });

  // A read of the same endpoint carries no payload and must stay allowed, or every `gh api` inspection of a
  // PR needs the escape.
  it('does not deny a GET of a pulls endpoint', () => {
    expect(reason('gh api repos/o/r/pulls/1162')).toBeFalsy();
    expect(reason('gh api repos/o/r/pulls/1162 --jq .body')).toBeFalsy();
  });

  it('allows a label edit — every `gh pr edit` in scripts/ is labels only', () => {
    expect(reason('gh pr edit 1162 --add-label ready-to-merge')).toBeFalsy();
    expect(reason('gh pr edit 1162 --remove-label review:pending')).toBeFalsy();
  });

  // `pr-land` opens PRs with `gh pr create --body`, which is where the stamp is WRITTEN. Denying create would
  // block the only path that stamps anything.
  it('does not touch `gh pr create --body`, which is what writes the stamp', () => {
    expect(reason('gh pr create --title x --body-file /tmp/b.md')).toBeFalsy();
  });

  it('does not deny a read of a PR body', () => {
    expect(reason('gh pr view 1162 --json body')).toBeFalsy();
    expect(reason('gh api repos/o/r/pulls/1162')).toBeFalsy();
  });

  it('honours the sanctioned override, which is how pr-body-edit itself writes', () => {
    expect(reason('PR_BODY_STAMP_OK=1 gh pr edit 1162 --body-file /tmp/b.md')).toBeFalsy();
    expect(reason('PR_BODY_STAMP_OK=1 gh pr edit 1162 -F /tmp/b.md')).toBeFalsy();
  });
});
