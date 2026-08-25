/**
 * @file stage-pr-view-integration.test.mjs — `stage-pr-view`'s reader and sink against a REAL filesystem.
 *
 * A SMALL OPERATION WITH ONE REAL EFFECT, and both halves of it are claims about a filesystem that its
 * stubbed suite states rather than checks:
 *
 *   · *"The directory is CREATED rather than required to exist: the reader's own default lives under a
 *     scratch dir that a fresh host has not made yet, and failing on that would be a refusal about
 *     nothing."* — an injected `mkdir` records that it was CALLED; only a real one shows the directory
 *     appears, recursively, and that the subsequent write lands in it.
 *
 *   · *"FAILS CLOSED on both halves — a path that cannot be read and bytes that are not JSON are each named
 *     specifically, because 'could not stage' does not tell an operator whether to fix their path or their
 *     paste."* — the distinguishing detail is `e.code`, which is a property of a real `ENOENT`. A stub that
 *     throws `new Error('nope')` has no `code`, so the branch that reads one is never exercised: the message
 *     falls through to `e.message` and the test passes on the wrong half of an `||`.
 *
 * Included because it is the cheapest possible demonstration of what the harness is for: two claims, both
 * about `fs`, both previously unwitnessed, at the cost of one temp directory.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { createPayloadReader, createStagePrViewSinks } from '../stage-pr-view-io.mjs';
import { WRITE_VIEW_EFFECT } from '../stage-pr-view.mjs';
import { withRealRepo } from './helpers/real-repo.mjs';

const VIEW = { number: 1496, title: 'a staged view', files: [] };

describe('stage-pr-view against a real filesystem', () => {
  /**
   * THE DIRECTORY IS CREATED, several levels deep, and the bytes really land in it. `mkdir` being called is
   * not the property — the property is that the write that follows it succeeds, which is only true if the
   * `{ recursive: true }` is there and the path it was given was the file's DIRECTORY rather than the file.
   */
  it('creates the view directory on a host that has never had one, and writes the bytes into it', async () => {
    await withRealRepo(async (ctx) => {
      const path = join(ctx.tmp, 'scratch', 'pr-views', 'never', 'existed', '1496.json');
      expect(existsSync(join(ctx.tmp, 'scratch'))).toBe(false);

      const out = await createStagePrViewSinks()[WRITE_VIEW_EFFECT]({ path, content: JSON.stringify(VIEW) });

      expect(out).toEqual({ path, bytes: JSON.stringify(VIEW).length });
      expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual(VIEW);
    });
  });

  /** The round trip, through real `fs` on both sides — what the sink wrote is what the reader reads back.
   *  Two halves of one operation that in the stubbed suite never meet. */
  it('the staged bytes read back through the real payload reader', async () => {
    await withRealRepo(async (ctx) => {
      const path = join(ctx.tmp, 'views', '1496.json');
      await createStagePrViewSinks()[WRITE_VIEW_EFFECT]({ path, content: JSON.stringify(VIEW) });

      expect(createPayloadReader()({ from: path })).toEqual(VIEW);
    });
  });

  /**
   * ★ THE `e.code` BRANCH, which needs a REAL errno. A missing file must be named as a PATH problem, and the
   * detail that says so is `ENOENT` — a property real `fs` attaches and a hand-thrown `Error` does not. The
   * two refusals below have to be told apart by an operator deciding whether to fix their path or their
   * paste, so the assertion is on the distinguishing token, not merely that something threw.
   */
  it('a missing payload is refused as a PATH problem, naming the real errno', async () => {
    await withRealRepo(async (ctx) => {
      const missing = join(ctx.tmp, 'nothing-here.json');

      expect(() => createPayloadReader()({ from: missing })).toThrow(/could not read the payload/);
      expect(() => createPayloadReader()({ from: missing })).toThrow(/ENOENT/);
    });
  });

  /** …and unreadable BYTES are refused as a paste problem, with the parser's own complaint attached. The two
   *  messages must not be interchangeable; that is the whole reason there are two. */
  it('an unparseable payload is refused as a PASTE problem, not a path one', async () => {
    await withRealRepo(async (ctx) => {
      const path = join(ctx.tmp, 'torn.json');
      writeFileSync(path, '{"number": 1496, "title": "half a pas');

      expect(() => createPayloadReader()({ from: path })).toThrow(/is not valid JSON/);
      expect(() => createPayloadReader()({ from: path })).not.toThrow(/could not read the payload/);
    });
  });
});
