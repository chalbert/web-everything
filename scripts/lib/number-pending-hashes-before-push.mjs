/**
 * @file scripts/lib/number-pending-hashes-before-push.mjs
 * @description Split mirrors the house idiom (`scripts/push-if-green.mjs`'s own header cites
 * `scripts/review-detail.mjs`, `scripts/pr-state.mjs`, `scripts/wait-green.mjs`): a PURE(-ish, fully
 * injectable) piece pulled out of a CLI script that otherwise runs its whole body at top-level import — a
 * plain `import` of `push-if-green.mjs` itself would execute a real `git`/`npm` gate and call
 * `process.exit()`, which is untestable. This file has no such top-level side effects, so it can be
 * `import`ed directly by a test.
 *
 * ROOT-CAUSE FIX for the 2026-09-08 incident: #3623/#3624 sat STRANDED (hash-keyed, un-numbered) on
 * `origin/main` for 44-92 minutes. Both landed via a DIRECT commit+push that never went through a
 * lane/PR/drain at all ("File #xkyisxe: …" / "WE: file backlog item …", pushed straight to `origin/main`
 * from outside the sanctioned lane→PR→drain flow `.claude/skills/file-item/SKILL.md` itself documents), so
 * neither of the two places JIT numbering (#2288) was previously wired to fire — `scripts/lane-drain.mjs`'s
 * `finalizeLand` and `scripts/merge-ai-prs.mjs`'s `landedLocal` numbering block, both PR-merge-triggered —
 * ever ran for them. The drain's own periodic safety-net sweep (`numberPendingHashes` running as a side
 * effect of the NEXT locally-landed PR) also missed both: it operates on a ONE-TIME git-sync snapshot taken
 * at that pass's start, so a direct push landing after that snapshot but before the sweep ran is invisible
 * to it — a genuine race, not a guarantee — and the miss was silent (the resident drain daemon always runs
 * its child pass with `--json`, which suppresses every human-readable numbering/push-warning line, and
 * neither `parsePassResult` nor `updateStateAfterPass` in `plateau-app/tools/drain-daemon/lib.mjs` extracts
 * the JSON's numbering fields into `history.jsonl` — so there was no log line, no alert, and no automatic
 * retry hook until a human ran `backlog.mjs number-stranded` by hand).
 *
 * `push-if-green.mjs` is the ONE shared choke point every write path already uses to publish `main` (#2073)
 * — including that direct push (`gated-push-wiring.test.mjs`'s "the SOLE publish site is the drain"
 * assertion was already just a convention nothing enforced; this incident is the proof). Hooking numbering
 * HERE, unconditionally, right before every push, closes the gap structurally instead of depending on every
 * caller going through a PR: a hash-keyed backlog item can no longer reach `origin/main` without being
 * numbered in the exact same push that lands it, and a numbering failure REFUSES the push (fail closed)
 * rather than landing an item this script already knows would be un-numbered.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * JIT-number (#2288) any pending hash-keyed backlog item now present in `repo`'s tree, BEFORE the caller
 * pushes. Dynamically imports `scripts/lane-drain.mjs` + `scripts/readiness/drain-lock.mjs` FROM THE TARGET
 * repo (never a static import of THIS repo) so a non-WE constellation repo (no backlog/, no lane-drain.mjs —
 * frontierui, plateau-app) is a silent, correct no-op — the same dynamic-import shape the drain daemon's own
 * `loadDrainLock()` already uses. Numbering runs inside the SAME numbering-critical-section mutex (#2391)
 * every other land path already uses, so a concurrent drain/land can never race it for one NNN. A cheap
 * `git ls-files` pre-check runs first so the overwhelmingly common "nothing pending" case never touches the
 * mutex or spawns the numbering module at all.
 *
 * Every fs/git/import touch is injected (`checkExists`/`exec`/`importer`, all defaulted to the real thing)
 * so a test can exercise the decision logic with fakes — no throwaway repo or copied `scripts/` tree needed.
 * @param {string} repo
 * @param {{checkExists?:Function, exec?:Function, importer?:Function}} [deps]
 * @returns {Promise<{attempted:boolean, committed?:boolean, assigned?:Array<{hash:string,nnn:string}>, error?:string}>}
 */
export async function numberPendingHashesBeforePush(repo, { checkExists = existsSync, exec = execFileSync, importer = (p) => import(pathToFileURL(p).href) } = {}) {
  const laneDrainPath = join(repo, 'scripts', 'lane-drain.mjs');
  const lockPath = join(repo, 'scripts', 'readiness', 'drain-lock.mjs');
  if (!checkExists(laneDrainPath) || !checkExists(lockPath)) return { attempted: false }; // not the WE repo — nothing to number
  let tracked;
  try { tracked = exec('git', ['ls-files', 'backlog/*.md'], { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
  catch { tracked = null; } // can't tell (no backlog/ tracked yet, or git failed) — fall through to the real check
  if (tracked !== null && !/backlog\/x[0-9a-z]{6}-/.test(tracked)) return { attempted: false }; // nothing pending — skip the mutex entirely
  let mods;
  try { mods = await Promise.all([importer(laneDrainPath), importer(lockPath)]); }
  catch (e) { return { attempted: true, error: `could not load the numbering module (${String((e && e.message) || e).split('\n')[0]})` }; }
  const [{ numberPendingHashes }, { withNumberingLock }] = mods;
  const lock = withNumberingLock(() => numberPendingHashes(repo));
  const numbered = lock.result;
  if (numbered.error) return { attempted: true, error: numbered.error };
  return { attempted: true, committed: numbered.committed, assigned: numbered.assigned };
}
