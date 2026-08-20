/**
 * @file scripts/operations/stage-pr-view-io.mjs
 * @description THE IO SHELL of the `stage-pr-view` declaration — read the payload the operator obtained, and
 *   write the checked view where the file transport looks for it.
 *
 * IT DOES NOT FETCH, AND THAT IS THE HONEST BOUNDARY. On a host with no GitHub credential nothing here can
 * obtain a PR view; the operator gets it through whatever channel they have (a connector, another machine,
 * a paste) and hands over the bytes. Pretending otherwise would mean shelling `gh` and failing, which is
 * what `review-pr` already does. What this owns is the half that CAN be mechanized: refusing an incomplete
 * view and putting a complete one under the one name the reader will look up.
 *
 * IMPURE by construction: `fs`, and `process.env` for the directory the reader itself resolves.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { WRITE_VIEW_EFFECT } from './stage-pr-view.mjs';

/**
 * The directory the READER resolves, read the same way it reads it. Returning `null` rather than a guessed
 * default is deliberate: a fabricated directory stages a file nowhere the reader looks, and the review then
 * fails with "no pre-fetched view" pointing at a path that was never the one written.
 */
export function defaultViewDir(env = process.env) {
  return env.WE_PR_VIEW_DIR ? resolve(env.WE_PR_VIEW_DIR) : null;
}

/**
 * Read the payload the operator staged. FAILS CLOSED on both halves — a path that cannot be read and bytes
 * that are not JSON are each named specifically, because "could not stage" does not tell an operator whether
 * to fix their path or their paste.
 */
export function createPayloadReader({ read = readFileSync } = {}) {
  return ({ from }) => {
    let raw;
    try {
      raw = read(from, 'utf8');
    } catch (e) {
      throw new Error(`stage-pr-view: could not read the payload at ${from} — ${e.code || e.message}`);
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      throw new Error(`stage-pr-view: ${from} is not valid JSON (${e.message})`);
    }
  };
}

/**
 * Write the checked view. The directory is created rather than required to exist: the reader's own default
 * lives under a scratch dir that a fresh host has not made yet, and failing on that would be a refusal about
 * nothing.
 */
export function createStagePrViewSinks({ write = writeFileSync, mkdir = mkdirSync } = {}) {
  return {
    [WRITE_VIEW_EFFECT]: async (payload) => {
      mkdir(dirname(payload.path), { recursive: true });
      write(payload.path, payload.content);
      return { path: payload.path, bytes: payload.content.length };
    },
  };
}
