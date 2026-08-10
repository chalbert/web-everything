/**
 * write-all-sync.mjs — the SINGLE home of the synchronous stdout/stderr drain that makes
 * `write(…); process.exit(…)` safe. This module is also the canonical write-up of the footgun, so no
 * seventh CLI has to rediscover it in a local comment (#3061).
 *
 * THE FOOTGUN. `process.stdout.write` (and `console.log`) to a PIPE is ASYNCHRONOUS in Node once the
 * payload exceeds the pipe buffer. `process.exit()` tears the process down immediately, so the unflushed
 * tail is dropped — silently, with a zero exit status and no error anywhere. A TTY or a redirect to a real
 * file is synchronous and wins the race, which is why this is invisible in manual use and only bites when a
 * parent CAPTURES stdout.
 *
 * HOW MUCH IS LOST DEPENDS ON THE CONSUMER — the reason this reads as intermittent (measured on macOS,
 * `we:scripts/lane-review.mjs diff` over a 1.36 MB diff, 2026-08-10):
 *
 * | consumer                | bytes delivered |
 * |-------------------------|-----------------|
 * | `execFileSync` (Node)   | **8 192**       |
 * | shell `\| wc -c`        | **65 536**      |
 * | `> file`                | 1 355 035 (all) |
 *
 * TWO REMEDIES; PICK PER CALL SITE. They are NOT interchangeable:
 *
 *   (a) `process.exitCode = N` and RETURN — no `process.exit` at all. Node exits naturally once stdout has
 *       drained. Correct when the exit is the LAST thing that runs, and the only remedy that also repairs a
 *       `console.log`-loop human mode (many small async writes, which truncate racily rather than
 *       deterministically). `we:scripts/check-standards.mjs` and `we:skills-src/jury/resolve-roster.mjs`
 *       take this one.
 *   (b) `writeAllSync(fd, chunk)` from HERE, keeping `process.exit()`. The write is fully drained before the
 *       exit runs. REQUIRED where the exit is a GUARD that must halt in place — swapping such a site to (a)
 *       would let the code after the guard keep running. `we:scripts/lane-review.mjs`'s `runCli` branches and
 *       `we:scripts/backlog.mjs`'s `die()` are that shape.
 *
 * `process.stderr.write` is already synchronous in Node, so an exit after one needs neither remedy.
 *
 * A THIRD SHAPE, which neither remedy reads as a call site: `process.exit(main(argv))`. The exit is nowhere
 * near a write, yet it discards the drain for every byte the callee wrote — `we:scripts/readiness/
 * velocity-metrics.mjs` (644 635 B → 8 192) and `we:scripts/progress-board.mjs` (25 142 → 8 192) both died
 * this way. It always takes (a): `process.exitCode = main(argv)`.
 *
 * YOU DO NOT HAVE TO REMEMBER ANY OF THIS. `we:scripts/lib/stdout-flush-scan.mjs` is the `check:standards` rule
 * that flags all three shapes, and its baseline is ZERO — the #3061 sweep fixed all 109 sites on the tree, so a
 * new one is a red gate rather than a comment nobody reads.
 */

import { writeSync } from 'node:fs';

/**
 * Write `chunk` to `fd` synchronously and COMPLETELY, then return — the exact bytes, nothing appended.
 * Byte-transparent on purpose: callers that emit a diff or a pre-terminated payload must not gain a stray
 * trailing newline (use `writeLineSync` when you do want one).
 *
 * `EAGAIN` (a full non-blocking pipe — the reader has not drained yet) retries; `EPIPE` (the reader closed
 * early, e.g. `| head`) stops quietly rather than crashing, matching what an async write would have done.
 *
 * @param {number} fd  1 for stdout, 2 for stderr.
 * @param {string|Buffer} chunk
 */
export function writeAllSync(fd, chunk) {
  const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), 'utf8');
  let off = 0;
  while (off < buf.length) {
    try { off += writeSync(fd, buf, off, buf.length - off); }
    catch (e) { if (e.code === 'EAGAIN') continue; if (e.code === 'EPIPE') break; throw e; }
  }
}

/**
 * `writeAllSync` plus exactly one trailing newline — the line-oriented form the CLI emitters use. `String(…)`
 * coerces defensively so a future non-string payload degrades predictably instead of throwing inside the loop.
 *
 * @param {number} fd
 * @param {unknown} line
 */
export function writeLineSync(fd, line) {
  writeAllSync(fd, `${String(line)}\n`);
}
