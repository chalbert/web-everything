#!/usr/bin/env node
/**
 * PreToolUse(Bash) guard — project banned-command table (webeverything; AI-optimisation program).
 *
 * Moves mechanical footguns that previously relied on the model remembering a MEMORY.md line into
 * deterministic write-time enforcement. Denials (each a recurring real incident):
 *   • `build:plugs` / `tsc -p tsconfig.plugs.json` (no --noEmit) — emits shadow .js/.d.ts, breaks
 *     vitest, fakes a red gate. Typecheck plugs with `tsc --noEmit`.
 *   • `pkill`/`killall` of vite|node — never tear down the user's running dev server.
 *   • `rm`/`git rm` of a backlog/*.md — done items resolve (status:resolved); the file stays.
 *   • `mv`/`git mv` of a backlog/*.md that CHANGES its NNN prefix — NNN is immutable.
 *   • `>>` / `tee -a` / `sed -i` / `perl -*pi` into backlog|reports/*.md — bypasses the Edit/Write
 *     locus-prefix hook; use the Edit/Write tools so the check fires.
 *   • `git push` to a constellation `main` branch — strict lane-only enforcement (#2203): every change
 *     reaches main through a `lane/*` ref → PR → CI, so a DIRECT push bypasses the gate (observed
 *     2026-07-03: an ungated direct push landed a check:standards error on main). Escape: `MAIN_PUSH_OK=1`.
 *   • a BACKGROUNDED verification-set run (`verify-lane` / `check:standards` / `test:unit`) — via the Bash
 *     `run_in_background` param OR a shell `&`/nohup. Backgrounding the suite run then yielding is the exact
 *     #2833 subagent stall (the lane sits mid-flight, produces nothing, never errors). Run it synchronously in
 *     the foreground; no override.
 *   • a backlog item-mutation (claim/scaffold/…) run in a lane clone whose HEAD is BEHIND origin/main —
 *     a stale checkout runs stale `scripts/` against a stale backlog view (observed 2026-07-07: a lane
 *     19 commits behind ran the pre-#2288 "next free NNN" allocator and minted a colliding/low-gap
 *     number, #2323). Refuse and tell the caller to refresh (`git fetch && git reset --hard origin/main
 *     && git clean -fd`) rather than silently proceeding. Escape: `STALE_LANE_OK=1`.
 *   • a destructive git op (`reset --hard`, `clean -f[d]`, `checkout/restore/switch` that discards the tree,
 *     a force-push — normalized past wrapper/path/global-flag disguises by `canonicalGitOp`) run with cwd
 *     inside a `.lanes/<repo>/lane-N/` clone whose LIVE lease (`scripts/lib/lane-lease.mjs`) is held by
 *     ANOTHER session — the hole behind a 2026-07-09 incident: a `/slice` ran `git reset --hard` in a lane a
 *     concurrent session had just leased; the acquire correctly refused, but the `;`-chained reset ran
 *     regardless and clobbered the peer's clone. Ownership is decided by `isForeignLease` from the DURABLE
 *     session id ALONE (`CLAUDE_CODE_SESSION_ID`, stamped as `ownerSession` at `acquire`, read here from the
 *     same env first): a live lease whose `ownerSession` differs from mine ⇒ FOREIGN ⇒ deny; equal ⇒ my lane ⇒
 *     allow. Stale/absent lease, a lease with no `ownerSession`, or no session id here ⇒ allow (the documented
 *     fail-open degraded mode — r2 removed the earlier pid-ancestry fallback, which over-matched two independent
 *     sessions sharing an upper process ancestor and so failed open while looking protective). Escape:
 *     `LANE_CLOBBER_OK=1`.
 *   • the SAME destructive git op in a lane holding a LIVE MARKED (`workflowLane`) lease (#2413) — the
 *     parallel-/workflow case where every sibling lane shares `ownerSession`, so the compare above fails OPEN
 *     exactly where it matters. Fail-CLOSED instead: the op must ASSERT the lease's own minted slug inline
 *     (`LANE_SESSION=<slug>`, stamped by the acquiring orchestrator); absence OR mismatch ⇒ deny. This
 *     supersedes the `ownerSession` compare for marked lanes only; unmarked leases keep the fail-open behavior
 *     above. The owning lane re-asserts the slug it acquired under and passes; a sibling never holds it and is
 *     denied. Same escape: `LANE_CLOBBER_OK=1`.
 *   • a build that WRITES the shared PRIMARY tree, run at primary cwd (#2749/#2788 — the 4th arm under
 *     `#primary-read-only-lanes-only`) — an `npm run build`/`build:docs`/`build:demo` (or the `pnpm`/`yarn`/
 *     `run-s`/`run-p`/`npm-run-all` equivalent; `build:check` and `build:plugs` are excluded — the former
 *     writes only `/tmp`, the latter is already its own arm above), an fs-writing `node <generate*|scaffold*>`
 *     script, or a `sed -i`/`perl -pi`/`tee`/shell-redirect writing a file other than a `/tmp`|`/dev` scratch
 *     path. Keys on the TREE-WRITE and the cwd the write LANDS IN, never on who is asking — no session/agent
 *     identity is consulted, so it is the same rule for the main session and a delegated subagent. The
 *     reported cwd resets to primary between calls (#2335), so a lane-scoped build must make its lane cwd
 *     explicit (`cd <lane> && …`, which `resolveEffectiveCwd` honours) — without that the build really does
 *     run in the primary, which is exactly what this denies, and the deny message says so. Escape:
 *     `MAIN_SESSION_BUILD_OK=1` (mirrors `MAIN_PUSH_OK`/`LANE_GUARD_OFF`).
 *   • (WARN, never deny) a verification-set command (`test:unit`/`check:standards`/`verify-lane`) run at
 *     primary cwd — the un-script-decidable residual half of #2749 ("this session should have delegated
 *     mechanical work to a lane", #2677). Doesn't write the tree, so the hard arm above doesn't catch it, and
 *     there is no reliable way to tell a delegated subagent's own primary-reporting verify apart from the main
 *     session's own laziness (#2335) — so this is a stderr nudge only, never a deny.
 *
 * Input: PreToolUse JSON on stdin. Output: a deny decision (JSON) when blocked; nothing otherwise.
 * Fails open on unparseable input. The pure `reason`/`decide` are unit-tested (guard-bash.test.mjs).
 */
import { readFileSync, realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, join } from 'node:path';
import { LEASE_FILENAME, isLeaseStale, isForeignLease, laneMarkedSlug, assertedLaneSlug } from './lib/lane-lease.mjs';

const BACKLOG_MD = /(?:^|[\s'"=(])(?:\.\/)?backlog\/(\d+)-[^\s'")]*\.md/;
const CORPUS_MD = /(?:^|[\s'"=(])(?:\.\/)?(?:backlog|reports)\/[^\s'")]*\.md/;
// #2302 — a `node …/backlog.mjs <sub>` invocation that MUTATES an item's file/frontmatter (as opposed to the
// session/label-state verbs reserve/unreserve/queue/unqueue/calibrate AND the local prepare-hold/prepare-release
// tokens, which don't touch an item's .md). Run from the PRIMARY checkout it slips past guard-lane (a Bash call,
// not an Edit/Write) and stamps the item on primary — the exact hole guard-lane closes for the file tools.
// Blocked only when cwd is a primary (see isPrimaryCwd). The verb set is EVERY subcommand that reaches
// writeBacklogMd: claim/resolve/RELEASE (all three via transition), retype, yield, scaffold, settle, COST
// (accrual write), and PREPARE-STAMP (#2264 — the (b)-flow status:open+preparedDate splice, authored in a lane
// and landed via the one PR, never a primary splice). prepare-hold/prepare-release write only the local token.
const BACKLOG_MUTATION = /\bnode\s+\S*backlog\.mjs\s+(?:claim|resolve|release|scaffold|settle|retype|yield|cost|prepare-stamp)\b/;

/** Does this segment INVOKE a backlog item-mutation subcommand? Pure (unit-tested). */
export function isBacklogMutation(segment) { return BACKLOG_MUTATION.test(String(segment || '')); }

// #2833 finding 3 — the VERIFICATION set that must never be backgrounded. The whole point of #2833 is that a
// build subagent BACKGROUNDED its long verification and then yielded mid-run — the lane sat mid-flight, produced
// nothing, and never errored, so nothing reclaimed it. The delivery brief only asks for this in PROSE; this hook
// makes it structural. A command is a verification RUN when it actually invokes one of: `scripts/verify-lane.mjs`,
// `check:standards`, or `test:unit` (via a package runner, or the bare `npm test` alias). Anchored to a runner /
// the script path so a mere MENTION (grep/echo "check:standards") is not matched.
const VERIFICATION_RUN =
  /\bnode\s+\S*\bverify-lane\.mjs\b|\b(?:npm|pnpm|yarn|run-s|run-p|npm-run-all)\b[^|;&]*\b(?:check:standards|test:unit)\b|\bnpm\s+(?:run\s+)?test\b/;

/** Does this command INVOKE a member of the verification set (verify-lane / check:standards / test:unit)? Pure. */
export function isVerificationRun(command) { return VERIFICATION_RUN.test(String(command || '')); }

/**
 * Is `command` being BACKGROUNDED? Pure. Two channels the #2833 stall can arrive through:
 *   • the Bash tool's `run_in_background: true` parameter (the harness detaches it) — passed in as `runInBackground`;
 *   • a shell background operator in the command text — a trailing/embedded `&` (NOT `&&`), or `nohup`/`setsid`/
 *     `disown`. `&&`/`||` and redirections (`&>`, `2>&1`, `>&2`) are neutralized first so only a real background
 *     `&` remains.
 */
export function isBackgrounded(command, runInBackground = false) {
  if (runInBackground === true) return true;
  let c = String(command || '');
  if (/\b(?:nohup|setsid|disown)\b/.test(c)) return true;
  c = c
    .replace(/&&/g, ' ')            // logical AND — not backgrounding
    .replace(/\|\|/g, ' ')          // logical OR
    .replace(/[0-9]*>&[0-9-]*/g, '') // fd redirection: 2>&1, >&2, 1>&-
    .replace(/&>/g, '');            // bash `&>file` combined redirect
  return /&/.test(c);
}

/**
 * The #2833 finding-3 deny reason: a verification-set command that is being backgrounded. Pure. Returns a reason
 * string when BOTH true (it's a verification run AND it's backgrounded), else null. Checked at whole-command level
 * (backgrounding is a property of the whole command / the tool param, which the per-segment split would lose).
 */
export function backgroundedVerificationReason(command, runInBackground = false) {
  if (!isVerificationRun(command) || !isBackgrounded(command, runInBackground)) return null;
  return 'the verification set (verify-lane / check:standards / test:unit) must run SYNCHRONOUSLY in the FOREGROUND — never backgrounded (run_in_background, a trailing `&`, nohup/setsid/disown). Backgrounding the suite run and then yielding is the EXACT #2833 subagent stall: the lane sits mid-flight, produces nothing, and never errors, so nothing reclaims it. Re-run it in the foreground and WAIT for it to exit before landing (`node scripts/verify-lane.mjs …`, blocking). There is no override — a synchronous run is the whole point.';
}

// #2749/#2788 — the 4th `#primary-read-only-lanes-only` guard arm: a build that WRITES the shared PRIMARY
// tree, run at primary cwd. Three shapes; each pure/unit-tested below. Gated by `primaryCwd` in `reason()` —
// i.e. by where the write LANDS, not by who is asking (no session/agent identity is read, #2335). A lane
// build must carry its `cd <lane> &&`; without it the write really does hit the primary.

// ── shared command normalization (#2788 review r3 finding 1) ──────────────────────────────────────────
// The arms below MUST normalize a segment through the SAME wrapper-peeling `canonicalGitOp` uses (#2367),
// not a weaker local stripper. The first cut peeled only `VAR=`/`sudo`, so ONE leading wrapper word
// (`env`/`time`/`command`/`nice`/`npx`/`xargs`) disarmed all three arms completely — a total bypass beside a
// hardened normalizer that already knew about the whole class. `wrapperPrefixLength` is now the single
// source of truth for both.

/** How many LEADING tokens of `words` are wrapper/assignment noise before the real program word? Pure.
 *  Peels `VAR=val`, `env [VAR=v…]`, `time`/`command`/`builtin`/`nice`, `sudo [-n] [-u <user>]`,
 *  `xargs [opts]` and `npx`/`bunx` `[opts]`. Bounded — every branch advances by ≥1 token. Callers pass
 *  `' '` for a token that must never count as a wrapper (a quoted word, a redirect operator). */
function wrapperPrefixLength(words) {
  let i = 0;
  while (i < words.length) {
    const w = words[i];
    if (/^[A-Za-z_]\w*=/.test(w)) { i += 1; continue; }                       // bare `FOO=1 <cmd>` assignment
    if (w === 'env') {                                                        // env VAR=val … <cmd>
      i += 1;
      while (i < words.length && /^[A-Za-z_]\w*=/.test(words[i])) i += 1;
      continue;
    }
    if (w === 'time' || w === 'command' || w === 'builtin' || w === 'nice') { i += 1; continue; }
    if (w === 'sudo') {                                                       // sudo -n -u <user> … <cmd>
      i += 1;
      while (i < words.length && words[i].startsWith('-')) {
        const opt = words[i]; i += 1;
        if (opt === '-u' || opt === '-g' || opt === '-U') i += 1;              // option that takes an argument
      }
      continue;
    }
    if (w === 'xargs') {                                                      // xargs -n1 -I{} … <cmd>
      i += 1;
      while (i < words.length && words[i].startsWith('-')) i += 1;
      continue;
    }
    if (w === 'npx' || w === 'bunx') {                                        // npx [-y] [-p <pkg>] <cmd>
      i += 1;
      while (i < words.length && words[i].startsWith('-')) {
        const opt = words[i]; i += 1;
        if (opt === '-p' || opt === '--package' || opt === '-c') i += 1;
      }
      continue;
    }
    break;
  }
  return i;
}

/** Normalize a raw command segment to `<program-basename> <args…>`, or '' when there is no program word.
 *  Pure. Peels the wrapper prefix (`wrapperPrefixLength`), strips surrounding quotes / a leading backslash
 *  off the program word and resolves a path-qualified program to its basename
 *  (`./node_modules/.bin/eleventy` → `eleventy`). Accidental-disguise forms only, matching the #2367
 *  threat model — it deliberately does NOT chase `$(echo git)` / `bash -c "…"`. */
export function canonicalCommand(segment) {
  let c = String(segment || '').trim();
  if (!c) return '';
  c = c.replace(/^[({]\s*/, '').trim();                 // unwrap a leading subshell `(…` / brace group `{ …`
  if (!c) return '';
  const tokens = c.split(/\s+/);
  const rest = tokens.slice(wrapperPrefixLength(tokens));
  if (!rest.length) return '';
  const prog = rest[0].replace(/^(['"])(.*)\1$/, '$2').replace(/^\\+/, '').replace(/^.*\//, '');
  if (!prog) return '';
  return [prog, ...rest.slice(1)].join(' ');
}

// (a) an actual RUN of the tree-writing `build` family. `build:check` (writes only `/tmp`, see package.json's
// `--output=/tmp/…`) and `build:plugs` (already its own arm above, different message/reason) are excluded —
// neither is a primary-tree write in the sense this arm cares about.
const BUILD_RUNNER = /^(?:npm|pnpm|yarn|run-s|run-p|npm-run-all)\b/;
/** Every `build`/`build:<target>` token in a segment. `\b` keeps `rebuild-cache` / `prebuild` out. */
const BUILD_TARGETS_G = /\bbuild(?::[-\w]+)?\b/g;
// #2788 review r2 — the exclusion is tested against EVERY build target in the segment, and the arm fires if
// ANY of them is tree-writing. Two earlier cuts were both bypassable:
//   r0 tested the exclusion against the WHOLE segment, so merely MENTIONING `build:check` anywhere disarmed
//      a real build (`npm run build && echo build:check` read as safe).
//   r1 tested it against ONE extracted target — the FIRST in a greedy match — so an excluded target placed
//      BEFORE a real one disarmed it (verified: `run-s build:check build` read as safe). Same bypass, new
//      spelling. Checking all targets removes the ordering dependency entirely.
const BUILD_RUN_EXCLUDED = /^build:(?:check|plugs)$/;

// (a2) the build TOOLS the `build` aliases delegate to. #2788 review r3 finding 5 — `build = build:docs &&
// build:demo`, `build:docs = eleventy`, `build:demo = vite build`, so denying only the npm alias blocked the
// NAME, not the effect: `vite build` / `eleventy` / `./node_modules/.bin/eleventy` wrote the same `dist/`
// and `_site/` at the shared checkout and walked straight through. `eleventy --output=<scratch>` is the
// `build:check` spelling and stays allowed.
const VITE_BUILD_SUBCOMMAND = /(?:^|\s)build(?:\s|$)/;
const OUTPUT_FLAG = /--(?:output|outDir|out-dir)(?:=|\s+)(\S+)/;

// #2986(3) — bare `eleventy` writes `_site/`, so the arm denies it; but `--version`/`--help`/`--dryrun`
// write NOTHING, and the arm allowed only an explicit scratch `--output=`. A small allowlist of flags that
// suppress the write. `--serve`/`--watch` stay DENIED and take precedence — they really do write the site
// directory (and keep writing it), so their presence overrides anything else on the line.
const ELEVENTY_NO_WRITE_FLAG = /(?:^|\s)--(?:version|help|dryrun|dry-run)(?=[\s=]|$)/;
const ELEVENTY_WRITES_FLAG = /(?:^|\s)--(?:serve|watch)(?=[\s=]|$)/;

// #2986(2) — what a package-runner invocation ACTUALLY runs: either a COMMAND (`exec`/`dlx`) or a set of
// SCRIPT NAMES. Pure.
// `BUILD_TARGETS_G` used to be matched against the WHOLE segment, so the word `build` ANYWHERE in a runner
// line fired the arm: `npm run test:unit -- src/build-graph.test.ts`, `npm run lint src/build/`,
// `npm install --build-from-source …`, `pnpm add node-gyp-build`. Scanning only the positions a runner
// treats as a script name keeps every real alias (`npm run build`, `yarn build`, `run-s build:check build`)
// while dropping the incidental mentions. An `exec`/`dlx` form is not a script name at all — the caller
// re-canonicalizes its remainder so `pnpm exec vite build` still reaches the `vite` arm below.
//
// #2994 review r2 — the first cut of that narrowing was a regex (`^<runner> (exec|dlx) (--\s+)?(.+)$`) plus a
// "first non-flag word is the script name" scan, and BOTH under-matched real, tree-writing builds that the
// pre-#2986 guard denied:
//   • any flag between `exec`/`dlx` and the tool made the FLAG the recursed program —
//     `npm exec --package=vite vite build`, `npm exec --yes vite build`, `pnpm exec --silent vite build`,
//     `pnpm dlx --package=vite vite build`, `yarn dlx -q eleventy` all read as safe.
//   • `-c '<command>'` (npm's `--call`) hides the command in a quoted argument entirely.
//   • a runner-level selector before the subcommand desynced the script-name scan —
//     `pnpm --filter web exec vite build` (the `--filter` VALUE became the subcommand), and
//     `yarn workspace web build` (the workspace NAME became the script name).
// The replacement walks the invocation word by word, quote-aware, the way the runner itself does: skip
// runner-level flags (consuming the VALUE of the ones that take a separate value word), see through
// `workspace <name>`, then classify what is left as an `exec` command or a `run`/bare script name.
const RUNNER_NAMES = new Set(['npm', 'pnpm', 'yarn', 'bun', 'run-s', 'run-p', 'npm-run-all']);
const MULTI_SCRIPT_RUNNERS = new Set(['run-s', 'run-p', 'npm-run-all']);
/** Runner-level flags whose VALUE is a separate following word (so the value is not a subcommand/program). */
const RUNNER_VALUE_FLAGS = new Set(['--package', '-p', '--filter', '-F', '--workspace', '-w', '--prefix', '-C', '--dir', '--cwd']);
/** npm `exec --call/-c '<command>'` — the value is a COMMAND LINE, so it is recursed, not skipped. */
const RUNNER_CALL_FLAGS = new Set(['--call', '-c']);

/** Quote-aware word split of a command head that also reports each word's RAW start offset in `head`, so the
 *  `exec` remainder can be handed on verbatim (rejoining unquoted words would drop a `sed -i ''` empty
 *  argument and re-open #2986/1). Shares the quoted-run scanner below, so `\"` never desyncs a boundary. */
function headWords(s) {
  const out = [];
  let cur = '';
  let start = -1;
  const flush = () => { if (start >= 0) out.push({ text: cur, start }); cur = ''; start = -1; };
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (/\s/.test(ch)) { flush(); continue; }
    if (start < 0) start = i;
    if (quoteStartsAt(s, i)) {
      const close = quotedRunEnd(s, i);
      const end = close === -1 ? s.length : close;
      cur += s.slice(s[i] === '$' ? i + 2 : i + 1, end);
      i = end;
      continue;
    }
    if (ch === '\\' && i + 1 < s.length) { cur += s[i + 1]; i += 1; continue; }
    cur += ch;
  }
  flush();
  return out;
}

/**
 * Classify a package-runner invocation `head`. Pure. Returns:
 *   • `{ exec: '<command line>' }` — an `exec`/`dlx`/`--call` form; the caller re-canonicalizes the command.
 *   • `{ names: [...] }`          — the script-name argument positions (possibly empty).
 *   • `null`                      — not a package runner at all.
 */
export function runnerInvocation(head) {
  const words = headWords(String(head || ''));
  if (!words.length) return null;
  const runner = words[0].text;
  if (!RUNNER_NAMES.has(runner)) return null;

  if (MULTI_SCRIPT_RUNNERS.has(runner)) {                   // EVERY positional arg is a script name
    const names = [];
    for (let i = 1; i < words.length; i++) {
      if (words[i].text === '--') break;
      if (!words[i].text.startsWith('-')) names.push(words[i].text);
    }
    return { names };
  }

  let i = 1;
  let sawExec = false;
  let sawRun = false;
  while (i < words.length) {
    const w = words[i].text;
    if (w === '--') { i += 1; if (sawExec) break; continue; }   // `npm exec -- vite build`
    if (w.startsWith('-')) {
      const eq = w.indexOf('=');
      const flag = eq === -1 ? w : w.slice(0, eq);
      if (RUNNER_CALL_FLAGS.has(flag)) {                       // the value IS a command line
        return { exec: eq === -1 ? (words[i + 1] ? words[i + 1].text : '') : w.slice(eq + 1) };
      }
      if (eq === -1 && RUNNER_VALUE_FLAGS.has(flag)) i += 1;   // consume the flag's separate value word
      i += 1;
      continue;
    }
    if (w === 'exec' || w === 'dlx') { sawExec = true; i += 1; continue; }
    if (w === 'workspace' || w === 'workspaces') { i += 2; continue; }  // `yarn workspace <name> <rest…>`
    if (w === 'run' || w === 'run-script') { sawRun = true; i += 1; continue; }
    break;                                                    // the subcommand / script-name position
  }
  if (i >= words.length) return { names: [] };
  if (sawExec) return { exec: head.slice(words[i].start) };
  if (sawRun) return { names: [words[i].text] };               // `npm run <script>` — ONLY the script name
  // yarn/pnpm/bun accept a BARE script name (`yarn build`); npm does not (`npm install …` is never a script).
  return { names: runner === 'npm' ? [] : [words[i].text] };
}

/**
 * #2788 review — is `name=1` present as a LEADING env-assignment prefix of `segment` (the documented
 * "prefix `VAR=1`" spelling), rather than merely appearing somewhere in the text? Pure.
 *
 * A sanctioned escape hatch that matches anywhere is not an escape hatch, it is a bypass: any command that
 * quotes, echoes, greps for, or documents the token would disarm the guard. Scan ONLY the `VAR=val` run at
 * the head of the segment (the sole position a shell treats as an assignment for the following command) and
 * stop at the first token that is not an assignment.
 */
export function hasLeadingEnvEscape(segment, name) {
  // A leading `env` is part of the assignment prefix too (`env VAR=1 npm run build`) — the wrapper peel above
  // now sees through `env`, so the escape must see through it as well or the wrapper form would be a
  // deny-with-no-way-out.
  const s = String(segment || '').replace(/^\s+/, '').replace(/^env\s+/, '');
  const re = /^(\w+)=(\S*)\s+/;
  let rest = s;
  for (;;) {
    const m = rest.match(re);
    if (!m) return false;
    if (m[1] === name && m[2] === '1') return true;
    rest = rest.slice(m[0].length);
  }
}

/** Is `segment` an actual RUN (not a mention — anchored at command position, not a quoted/echoed string) of
 *  the tree-writing `build` family — `npm run build`/`build:docs`/`build:demo`/the bare `pnpm`/`yarn`/
 *  `run-s`/`run-p`/`npm-run-all` equivalent — excluding the non-tree-writing `build:check` (`/tmp` output)
 *  and the separately-handled `build:plugs`? Pure. */
export function isTreeWritingBuildRun(segment) {
  const cmd = canonicalCommand(segment);
  if (!cmd) return false;
  const head = cmd.split(/[|;&]/)[0];                        // stay inside THIS segment
  const prog = head.split(/\s+/)[0];
  // `npm exec … ` / `pnpm dlx …` / `npm exec -c '…'` runs its remainder as a COMMAND, not as a script name —
  // re-canonicalize it so the tool arms below still see `vite build` / `eleventy`.
  const inv = runnerInvocation(head);
  if (inv && inv.exec !== undefined) return isTreeWritingBuildRun(inv.exec);
  if (inv && BUILD_RUNNER.test(head)) {                      // a package runner at command position
    // #2986(2) — only the runner's SCRIPT-NAME positions, never the whole segment.
    const targets = inv.names.flatMap((n) => n.match(BUILD_TARGETS_G) || []);
    // Fire if ANY target is tree-writing — order-independent, so no placement of an excluded name disarms it.
    if (targets.some((t) => !BUILD_RUN_EXCLUDED.test(t))) return true;
  }
  // …and the same effect reached WITHOUT the alias (r3 finding 5).
  if (prog === 'vite') return VITE_BUILD_SUBCOMMAND.test(head.slice(prog.length));
  if (prog === 'eleventy' || prog === '11ty') {
    const args = head.slice(prog.length);
    if (ELEVENTY_WRITES_FLAG.test(args)) return true;        // `--serve`/`--watch` DO write the site dir
    if (ELEVENTY_NO_WRITE_FLAG.test(args)) return false;     // #2986(3) `--version`/`--help`/`--dryrun`
    const out = (head.match(OUTPUT_FLAG) || [])[1];
    return !(out && isScratch(out));                         // `--output=<scratch>` is the build:check shape
  }
  return false;
}

// (b) an fs-writing GENERATOR/SCAFFOLD script — the exact hole guard-lane.mjs misses (a `node` script writes
// the tree via `fs`, never touching the Edit/Write tools). Keyed on the script's own path, not a hardcoded
// list. #2788 review r3 finding 3 — the first cut required `generate`/`scaffold` in the name and so matched
// NOTHING in this tree: every fs-writing generator here is spelled `gen-*` (`gen-inventory.mjs` rewrites
// AGENTS.md, plus `gen-reference-index`, `gen-maas-openapi`, `gen-cem`, `gen-dogfooding-progress`,
// `gen-webdirectives-ssr-vectors`, `gen-wrapper/`). A `gen-`/`gen_` PATH SEGMENT covers the convention as it
// actually is (including the `gen-wrapper/` directory), and `generate`/`scaffold` anywhere in the path keeps
// the forward-looking half.
const GENERATOR_SCRIPT_PATH = /(?:^|\/)gen[-_]|generate|scaffold/i;

/** Is `segment` a `node <path>` invocation (anchored at command position, not a quoted/echoed string) of a
 *  script whose OWN path says it generates/scaffolds files (a `gen-*`/`gen_*` path segment, or
 *  `generate`/`scaffold` anywhere in the path; any extension of `.mjs`/`.cjs`/`.js`)? Pure — matches the
 *  SCRIPT PATH only, so a `scaffold` SUBCOMMAND argument (`node scripts/backlog.mjs scaffold 1234`) is not
 *  this arm's business (it is #2302's). */
export function isGeneratorScriptRun(segment) {
  const head = canonicalCommand(segment).split(/[|;&]/)[0];
  if (!head) return false;
  // the package-runner ALIAS for the same effect (`npm run gen:inventory`) — same alias-vs-effect pair as the
  // build arm above; blocking only the direct `node` spelling would block the name, not the write.
  if (BUILD_RUNNER.test(head) && /\bgen:[-\w]+\b/.test(head)) return true;
  const m = head.match(/^node\s+(?:--\S+\s+)*(\S+\.(?:mjs|cjs|js))(?:\s|$)/i);
  return !!m && GENERATOR_SCRIPT_PATH.test(m[1]);
}

// (c) a shell redirect/`tee`/`sed -i`/`perl -pi` writing a file — generalizes the existing backlog|reports-
// scoped CORPUS_MD rule (further down in `reason()`) to ANY path, excluding a `/tmp`|`/dev` scratch target
// (the pattern every lane/skill in this very workflow already uses for scratch files, e.g. the manifest/
// PR-body files under `/tmp/`). Anchored the same way as the existing rules: `sed`/`perl`/`tee` must be the
// command word itself, not merely mentioned in a quoted commit message.
// #2788 review r3 findings 2/4/6 — this arm is now parsed, not regex-sniffed. Three bugs shared one root
// (a pattern tuned on one example spelling):
//   • the redirect matcher was anchored to END of segment, so ANYTHING after the target hid it —
//     `cat > config/app.json <<'EOF'`, `> config/app.json echo hi`, `>| config/app.json` all read as safe,
//     and a heredoc is the one idiom an agent reaches for to write a file without the Edit/Write tools.
//   • `sed`/`perl`/`tee` tested ONE argument as a proxy for the whole write set, so a second target
//     (`sed -i s/x/y/ config/app.json /tmp/x`, `tee /tmp/x config/app.json`) fell through the proxy.
//   • `tee`'s flags were one hardcoded spelling (`-a`), so `tee --append /tmp/x` / `tee -a -- /tmp/x` — the
//     STANDARD safe idiom — tested the flag as the filename and were wrongly DENIED.
// `shellTokens` gives quote-aware tokens with redirect operators split out, so the trailing anchor (a
// precision hack for `git commit -m "fix > bug"`) is replaced by the real rule: a `>` inside quotes is not a
// redirect. Every file operand is checked, and the arm fires if ANY of them is a non-scratch path.
// #2788 review — a scratch target is any of the REAL temp roots this platform hands an agent, not just the
// literal `/tmp/` spelling. On macOS `/tmp` is a symlink to `/private/tmp`, and the sanctioned per-session
// scratchpad the harness hands every agent is spelled `/private/tmp/claude-<uid>/…`; `$TMPDIR` resolves to
// `/var/folders/<xx>/<yy>/T/…`. Matching only `^/tmp/` DENIED the agent's own scratchpad (verified: a write to
// `/private/tmp/claude-501/…` flagged as a primary-tree write), turning the guard into a false-positive on the
// single most common legitimate write. Keep this list literal + anchored — a loose `/tmp/` ANYWHERE would let
// `./not-tmp/x` or `foo/tmp/bar` pass as scratch.
const SCRATCH_TARGET = /^(?:\/tmp\/|\/private\/tmp\/|\/var\/tmp\/|\/var\/folders\/|\/dev\/)/;

// #2788 review r2 — a target must be UNQUOTED before the scratch allowlist sees it. `SCRATCH_TARGET` is
// anchored (`^/tmp/`…), so testing the raw shell token made every QUOTED scratch write read as a primary-tree
// write — verified: `tee "/tmp/x"` and `sed -i s/a/b/ "/tmp/x"` were both denied. Quoting a path is ordinary
// shell hygiene (it is what you do for a path with a space), so this was the same false-positive class as the
// scratchpad denial, just one spelling further out.
const unquote = (t) => String(t || '').replace(/^(['"])(.*)\1$/, '$2');
const isScratch = (t) => SCRATCH_TARGET.test(unquote(t));

// ── the ONE quoted-run scanner both quote-aware parsers below share (#2994 review r2) ──────────────────
// `shellTokens` and `splitSegments` each used to find the end of a quoted run with a bare
// `s.indexOf(quote, i + 1)`. That is not how bash ends a quoted run, and the disagreement was a total
// guard bypass rather than a rounding error:
//   `git commit -m "guard: reject \"a|b\" input" && npm run build`
// bash reads `\"` as a LITERAL quote inside the double-quoted run (verified: `bash -c 'echo "a\"b"'`
// prints `a"b`), so the run ends at the FINAL `"`. `indexOf` stopped at the `"` of the `\"`, which left the
// parser one quote out of phase; the NEXT `"` then opened a run with no closer and swallowed the entire
// rest of the line as one blob. Every downstream arm — the tree-write deny, the `git push origin main`
// deny, the `pkill`/`rm backlog/*.md` denies, and (via `hasDestructiveLaneOp`) the whole lane-clobber
// lease check — reads that blob and sees nothing to deny. An EVEN number of escaped quotes does not
// re-sync it either: each `\"` shifts the phase again.
// The rules this encodes are bash's actual ones, and they are NOT uniform across quote kinds:
//   • `"…"`   — a backslash escapes the next character; `\"` does not close the run.
//   • `'…'`   — NOTHING is special, not even a backslash; the run ends at the very next `'`.
//               (`echo 'a\'` is a complete word `a\`, so applying the double-quote rule here would be a
//               NEW desync in the opposite direction.)
//   • `$'…'`  — ANSI-C quoting; backslash escapes ARE honoured, so `\'` does not close the run.
//   • `$"…"`  — locale translation; escapes behave as in `"…"`.
// Same non-shell-parser threat model as before: no expansion, no command substitution.

/** Does a quoted run START at `s[i]` — a `"`/`'`, or the `$` of a `$'…'`/`$"…"` run? Pure. */
function quoteStartsAt(s, i) {
  const ch = s[i];
  if (ch === '"' || ch === "'") return true;
  return ch === '$' && (s[i + 1] === "'" || s[i + 1] === '"');
}

/** Index of the CLOSING quote of the run starting at `s[i]`, or -1 if unterminated. Pure. */
function quotedRunEnd(s, i) {
  const dollar = s[i] === '$';
  const q = dollar ? s[i + 1] : s[i];
  // `"…"`, `$'…'` and `$"…"` honour a backslash escape; a plain `'…'` does not.
  const escapes = dollar || q !== "'";
  for (let j = (dollar ? i + 2 : i + 1); j < s.length; j++) {
    if (escapes && s[j] === '\\' && j + 1 < s.length) { j += 1; continue; }
    if (s[j] === q) return j;
  }
  return -1;
}

/**
 * Split a command segment into quote-aware tokens. Pure. Each token is `{ text, quoted, op }`:
 *   • quoting is resolved (the surrounding quotes are removed and `quoted` is set) — so a `>` inside a
 *     quoted argument is ordinary TEXT, never a redirect (this is what makes `git commit -m "fix > bug"`
 *     safe, replacing the old end-of-segment anchor that only worked by accident);
 *   • redirect operators are split out as their own `op` tokens even when glued to their neighbours, with
 *     any fd prefix attached: `2>&1` → `2>&` + `1`, `>|file` → `>|` + `file`, `cmd>x` → `cmd` + `>` + `x`.
 * Not a shell parser — no expansion, no command substitution; the #2367 accidental-collision threat model.
 */
export function shellTokens(segment) {
  const s = String(segment || '');
  const out = [];
  let cur = '';
  let started = false;
  let quoted = false;
  const flush = () => { if (started) out.push({ text: cur, quoted, op: false }); cur = ''; started = false; quoted = false; };
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoteStartsAt(s, i)) {
      const close = quotedRunEnd(s, i);
      const end = close === -1 ? s.length : close;
      cur += s.slice(s[i] === '$' ? i + 2 : i + 1, end);        // body only — the quotes are resolved away
      started = true;
      quoted = true;
      i = end;
      continue;
    }
    if (ch === '\\' && i + 1 < s.length) { cur += s[i + 1]; started = true; i += 1; continue; }
    if (ch === '>' || ch === '<') {
      let fd = '';
      if (started && !quoted && /^(?:[0-9]+|&)$/.test(cur)) { fd = cur; cur = ''; started = false; }  // `2>` / `&>`
      flush();
      let op = fd + ch;
      let j = i + 1;
      if (s[j] === ch) { op += ch; j += 1; }                       // `>>` / `<<`
      if (s[j] === '|' || s[j] === '&') { op += s[j]; j += 1; }    // `>|` (noclobber override) / `>&` (fd dup)
      out.push({ text: op, quoted: false, op: true });
      i = j - 1;
      continue;
    }
    if (/\s/.test(ch)) { flush(); continue; }
    cur += ch;
    started = true;
  }
  flush();
  return out;
}

/**
 * Split a command line into its `&&`/`||`/`;`/`&`/`|`/newline-separated SEGMENTS, honouring quotes. Pure.
 * Returns the RAW text of each segment (quotes intact) — every caller re-parses it (`canonicalCommand`,
 * `shellTokens`, the anchored regexes in `reason`), so this must not consume the quoting it is respecting.
 *
 * #2994 — the whole point. The previous split was a quote-BLIND regex (`/(?:&&|\|\||[;&|]|\n)+/`) applied
 * BEFORE the quote-aware `shellTokens` ever ran, so a `|` inside a quoted argument tore the command in two.
 * The fragment after the tear starts in an unquoted tokenizer state, which broke BOTH ways:
 *   • false DENY — `gh pr list --jq '.[] | select(.n > 5)'` tore at the jq pipe and the `>` in the tail
 *     fragment read as a real redirect to a non-scratch path. That is *the* house idiom for reading GitHub
 *     state, and every jq filter that both pipes and compares hit it.
 *   • false ALLOW — `gh pr list --jq '.[] | .number' > config/app.json` tore at the same pipe, leaving the
 *     tail fragment with an UNBALANCED quote that swallowed the REAL trailing redirect, so a genuine
 *     primary-tree write walked through. Tokenizing quotes first closes the hole and the false deny at once.
 *
 * A redirect operator run (`>`, `>>`, `>|`, `>&`, `&>`, `<`, `<<`) is consumed whole, so the `|`/`&` glued
 * into it is never mistaken for a separator (this is what retires `decide`'s old `>|`→`>` pre-normalization).
 * Same non-shell-parser threat model as `shellTokens`: no expansion, no command substitution.
 */
export function splitSegments(command) {
  const s = String(command || '');
  const segs = [];
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoteStartsAt(s, i)) {                          // quoted run — kept verbatim, separators inside are TEXT
      const close = quotedRunEnd(s, i);
      const end = close === -1 ? s.length - 1 : close;  // unterminated quote runs to end of string
      cur += s.slice(i, end + 1);
      i = end;
      continue;
    }
    if (ch === '\\' && i + 1 < s.length) { cur += ch + s[i + 1]; i += 1; continue; }
    if (ch === '>' || ch === '<' || (ch === '&' && s[i + 1] === '>')) {
      let j = i;
      if (ch === '&') { cur += s[j]; j += 1; }                     // `&>` / `&>>`
      cur += s[j]; j += 1;                                         // the `>` / `<`
      if (s[j] === s[j - 1]) { cur += s[j]; j += 1; }               // `>>` / `<<`
      if (s[j] === '|' || s[j] === '&') { cur += s[j]; j += 1; }    // `>|` (noclobber) / `>&` (fd dup)
      i = j - 1;
      continue;
    }
    if (ch === ';' || ch === '&' || ch === '|' || ch === '\n') {
      segs.push(cur);
      cur = '';
      while (i + 1 < s.length && /[;&|\n]/.test(s[i + 1])) i += 1;  // consume the whole separator run
      continue;
    }
    cur += ch;
  }
  segs.push(cur);
  return segs;
}

/** The file OPERANDS of a tokenized argument list — every non-flag token, honouring `--` and the options in
 *  `optsWithArg` (which swallow the token after them, e.g. `sed -e <script>`). Pure. A QUOTED token is never
 *  read as a flag (a quoted `-x` is a filename).
 *  #2986(1) — an EMPTY token is never a file operand either. BSD `sed -i '' <script> <file>` spells its
 *  in-place suffix as an empty quoted argument; counting it as an operand shifted the `files.slice(1)` below
 *  by one, so the sed SCRIPT read as the write target and a scratch-path edit was denied. */
function fileOperands(args, optsWithArg = new Set()) {
  const files = [];
  const push = (t) => { if (t !== '') files.push(t); };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.quoted && a.text === '--') { for (const t of args.slice(i + 1)) push(t.text); break; }
    if (!a.quoted && a.text.length > 1 && a.text.startsWith('-')) {
      if (optsWithArg.has(a.text)) i += 1;
      continue;
    }
    push(a.text);
  }
  return files;
}

/** Is `segment` a shell redirect/`tee`/`sed -i`/`perl -pi` that writes a file OTHER than a `/tmp`|`/dev`
 *  scratch path? Pure. Fires if ANY written path is non-scratch (never one argument as a proxy). */
export function isFileWriteRedirect(segment) {
  const toks = shellTokens(segment);
  if (!toks.length) return false;
  // Peel the same wrapper prefix the other arms peel (`env sed -i …` must not slip past). A quoted word or a
  // redirect operator can never BE a wrapper, so blank those out before measuring the prefix.
  const rest = toks.slice(wrapperPrefixLength(toks.map((t) => (t.op || t.quoted ? ' ' : t.text))));
  if (!rest.length) return false;

  // 1) A WRITE redirect ANYWHERE in the segment (not just at its end) — `>`, `>>`, `>|`, `&>`, `2> file`.
  //    An operator ending in `&` duplicates an fd (`2>&1`, `>&2`) and writes no file.
  for (let i = 0; i < rest.length; i++) {
    const t = rest[i];
    if (!t.op || !t.text.includes('>') || t.text.endsWith('&')) continue;
    const target = rest[i + 1];
    if (target && !target.op && !isScratch(target.text)) return true;
  }

  // 2) An in-place editor / `tee` — every file operand, in any flag spelling.
  const prog = rest[0].quoted ? '' : rest[0].text.replace(/^.*\//, '');
  const args = [];
  for (let i = 1; i < rest.length; i++) {
    if (rest[i].op) { i += 1; continue; }                          // skip the operator AND its target
    args.push(rest[i]);
  }
  const flags = args.filter((a) => !a.quoted && a.text.startsWith('-') && a.text.length > 1).map((a) => a.text);
  const has = (...names) => flags.some((f) => names.includes(f) || names.some((n) => f.startsWith(n + '=')));
  if (prog === 'sed' || prog === 'gsed' || prog === 'perl') {
    // in-place: the long `--in-place[=SUFFIX]`, or a short single-letter cluster containing `i` — `-i`,
    // `-i.bak`, `-pi`, `-i -pe` (the flags need not share ONE cluster). `-M<module>` is perl's module load,
    // never an in-place switch, so it is excluded rather than letter-scanned.
    const inPlace = flags.some((f) => /^--in-place\b/.test(f)
      || (!f.startsWith('--') && !f.startsWith('-M') && /^-[A-Za-z]+(?:\.[\w-]+)?$/.test(f) && f.includes('i')));
    if (inPlace) {
      // The script can arrive as an explicit flag argument (`-e '<code>'`) or as the first bare operand
      // (`sed -i s/x/y/ <files…>`) — either way it is NOT a written path, and everything else is.
      const scriptOpts = prog === 'perl' ? ['-e', '-E', '-f'] : ['-e', '--expression', '-f', '--file'];
      const files = fileOperands(args, new Set(scriptOpts));
      const targets = has(...scriptOpts) ? files : files.slice(1);
      if (targets.some((f) => !isScratch(f))) return true;
    }
  }
  if (prog === 'tee') {
    const files = fileOperands(args, new Set(['--output-error', '-p']));
    if (files.some((f) => !isScratch(f))) return true;
  }
  return false;
}

/** The #2749 hard-tree-write deny reason for `segment` at a PRIMARY cwd, or null. Pure. Checked ONLY when
 *  `primaryCwd` is true (callers gate it); the `MAIN_SESSION_BUILD_OK=1` escape is checked by the caller
 *  (`reason()`), mirroring `MAIN_PUSH_OK`/`LANE_CLOBBER_OK`. */
export function primaryTreeWriteReason(segment) {
  const s = String(segment || '');
  // #2788 review r3 finding 7 — every message must name the ACTUAL remedy. This arm reads the cwd the command
  // will run in, and the harness resets the reported cwd to the primary between calls (#2335), so an agent
  // ALREADY in a lane trips it whenever it omits the `cd`. "Delegate to a lane clone" is useless advice to
  // that caller; the fix is to make the lane cwd explicit, which `resolveEffectiveCwd` then honours.
  const RUN_IN_LANE = 'Run it with the lane cwd made EXPLICIT — `cd <lane-path> && <cmd>` (a leading `cd` is what this guard resolves, #2335); if you have no lane, acquire one (`node scripts/lane-pool.mjs acquire`). Sanctioned override (rare): prefix `MAIN_SESSION_BUILD_OK=1`.';
  if (isTreeWritingBuildRun(s))
    return 'a build that WRITES the shared PRIMARY tree is blocked at primary cwd (#2749/#2788) — `npm run build`/`build:docs`/`build:demo` (and the `vite build`/`eleventy` they delegate to) emits into the tree (dist/_site) at the shared checkout. ' + RUN_IN_LANE;
  if (isGeneratorScriptRun(s))
    return 'an fs-writing generator/scaffold script is blocked at primary cwd (#2749/#2788) — a `node` script writes the tree via `fs`, slipping past the Edit/Write-tool guard (guard-lane.mjs) entirely. ' + RUN_IN_LANE;
  if (isFileWriteRedirect(s))
    return 'a shell redirect/`tee`/`sed -i`/`perl -pi` writing a file is blocked at primary cwd (#2749/#2788) — it writes the shared PRIMARY tree directly, bypassing the Edit/Write tools. Write scratch files under `/tmp` instead. ' + RUN_IN_LANE;
  return null;
}

/** The #2749 WARN-only nudge for the un-script-decidable "this session should have delegated mechanical
 *  work" half — never denies (a hard-deny here would false-wedge a delegated subagent whose bare verify
 *  reports primary cwd, #2335/#2677). Fires when a verification-set command (`test:unit`/`check:standards`/
 *  `verify-lane`, reusing `isVerificationRun`) runs at a PRIMARY cwd: it writes no tree (so
 *  `primaryTreeWriteReason` above doesn't catch it), but is exactly the mechanical work #2677 argues the main
 *  session should delegate to a lane. Pure + independent of `decide`/`reason` — never feeds the deny channel;
 *  the CLI writes the result to stderr only. */
export function mainSessionDelegateNudge(command, { primaryCwd = false } = {}) {
  if (!primaryCwd) return null;
  if (!isVerificationRun(String(command || ''))) return null;
  return "you're running mechanical verification work (test:unit/check:standards/verify-lane) from the PRIMARY checkout — the conveyor's main session should delegate mechanical work to a lane subagent (#2677). This is a WARN, not a denial (there's no reliable way to tell a delegated subagent's own primary-reporting verify apart from the main session's own laziness, #2335) — if this really is a delegated subagent's verify, ignore it.";
}

/**
 * Is `cwd` a constellation PRIMARY checkout (not a lane clone)? Pure. A lane clone lives under `/.lanes/` so
 * it is always allowed; otherwise cwd must sit at/under one of the `primaries` roots. `primaries` is injected
 * (the CLI derives + realpaths them from this script's location) so the test stays pure/unit-testable.
 */
export function isPrimaryCwd(cwd, primaries = []) {
  if (!cwd) return false;
  const c = String(cwd);
  if (c.includes('/.lanes/')) return false;                         // a lane clone → always allowed
  return primaries.some((p) => p && (c === p || c.startsWith(p.endsWith('/') ? p : p + '/')));
}

/** Is `cwd` inside a pool lane clone (`~/workspace/.lanes/<repo>/lane-N/…`)? Pure — string test only, no
 *  git call (the CLI does the actual "how far behind" git call and passes the count in via ctx). */
export function isLaneCwd(cwd) {
  return !!cwd && String(cwd).includes('/.lanes/');
}

// #2367 — the destructive-git-op guard for a lane clone leased by ANOTHER session ─────────────────────

/** The lane clone ROOT (`…/.lanes/<repo>/lane-N`) a `cwd` sits at or under, or null. Pure — string test
 *  only; the CLI resolves the `.git/<LEASE_FILENAME>` marker path from this. */
export function laneRootFromCwd(cwd) {
  if (!cwd) return null;
  const m = String(cwd).match(/^(.*\/\.lanes\/[^/]+\/lane-\d+)(?:\/.*)?$/);
  return m ? m[1] : null;
}

/** Normalize the leading git invocation of a single command segment to a canonical `git <subcommand> …`
 *  string, or '' if the segment is not a git invocation. Pure — closes the #2367 matcher-BYPASS holes an
 *  `^git`-anchored test misses (accidental-collision threat model, NOT adversarial evasion): it unwraps a
 *  leading subshell `(`/group `{`, peels wrapper commands (`env [VAR=v…]`, `time`, `command`, `builtin`,
 *  `nice`, `xargs [opts]`, `sudo [-n] [-u <user>]`), strips surrounding quotes / a leading backslash off the
 *  program word (`"git"`/`'git'`/`\git`→`git`) and resolves a path-qualified git to its basename
 *  (`/usr/bin/git`→`git`), then skips git's leading GLOBAL flags (`-C <path>`, `-c <k=v>`, `--git-dir=…`, …) so
 *  the REAL subcommand is what the danger patterns match. Deliberately does NOT chase adversarial disguises
 *  (`git$IFS…`, `$(echo git)`, `bash -c "…"`, `ssh host git`): this guard is advisory with a one-env-var escape
 *  (`LANE_CLOBBER_OK=1`), so an actor bent on evasion never needs them — see #2367 r2 dismissal. */
export function canonicalGitOp(cmd) {
  // Wrapper-peeling + program-word normalization is shared with the #2788 tree-write arms via
  // `canonicalCommand` (r3 finding 1 — the new arms reimplemented a strictly weaker stripper beside this one).
  const tokens = canonicalCommand(cmd).split(/\s+/);
  if (tokens[0] !== 'git') return '';
  // Skip git's leading global flags to reach the real subcommand.
  let i = 1;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t === '-C' || t === '-c' || t === '--git-dir' || t === '--work-tree' || t === '--namespace') { i += 2; continue; }
    if (t.startsWith('-')) { i += 1; continue; }        // `--git-dir=…` / `--no-pager` / `--paginate` / `-p`
    break;
  }
  return 'git ' + tokens.slice(i).join(' ');
}

/** Is this command segment a destructive git op that would CLOBBER a lane clone (working tree or its remote
 *  branch) in place — `reset --hard`; `clean` with a force flag (`-fd`, and `-f`/`-fx` alone still deletes
 *  untracked FILES); `checkout`/`restore`/`switch` that discard the tree (`checkout [<ref>] [--] .`,
 *  `checkout -f <ref>`, `restore [--worktree/--staged/--] .`, `switch -f`); or a force-push (flag OR a
 *  leading-`+` refspec)? Normalizes via `canonicalGitOp` first (so wrappers / path-qualified git / global
 *  flags can't slip past). Pure (unit-tested); the #2367 danger table in `reason()` gates behind `ctx.foreignLiveLease`. */
export function isDestructiveLaneGitOp(cmd) {
  const c = canonicalGitOp(cmd);
  if (!c) return false;
  if (/^git\s+reset\b[^|;&]*--hard\b/.test(c)) return true;
  // `clean` with a FORCE flag — deletes untracked files (`-f`/`-fx`) and, with `-d`, untracked dirs. A force
  // flag is the destructive trigger; `-d` alone (no force) is a no-op, so force-present is the whole test.
  if (/^git\s+clean\b/.test(c) && /(?:^|\s)(?:--force|-[a-zA-Z]*f[a-zA-Z]*)(?=\s|$)/.test(c)) return true;
  if (/^git\s+checkout\s+(?:\S+\s+)?(?:--\s+)?\.(?:\s|$)/.test(c)) return true;   // checkout [<ref>] [--] .
  if (/^git\s+checkout\b[^|;&]*\s(?:-f|--force)(?=\s|$)/.test(c)) return true;    // checkout -f <ref>
  if (/^git\s+restore\b[^|;&]*\s\.(?:\s|$)/.test(c)) return true;                 // restore [--worktree/--staged/--] .
  if (/^git\s+switch\b[^|;&]*\s(?:-f|--force|--discard-changes)(?=\s|$)/.test(c)) return true; // switch -f <branch>
  if (/^git\s+push\b/.test(c) &&
      (/(?:^|\s)(?:-f|--force|--force-with-lease)(?=\s|$)/.test(c) || /(?:^|\s)\+\S/.test(c))) return true; // force-push (flag or +refspec)
  return false;
}

/** Does ANY `&&`/`|`/`;`-separated segment of `command` look like a destructive lane git op? Pure — mirrors
 *  `decide`'s segment split. The CLI uses this as a cheap pre-filter so the `fs` lease-ownership check below
 *  only runs when it could possibly matter (the overwhelming majority of Bash calls skip it). Passes each raw
 *  segment straight to `isDestructiveLaneGitOp` — `canonicalGitOp` strips env/sudo/wrapper disguises itself. */
export function hasDestructiveLaneOp(command) {
  if (!command) return false;
  return splitSegments(command).some((seg) => isDestructiveLaneGitOp(seg.trim()));
}

// #2335 — the harness resets the reported Bash cwd to the PRIMARY checkout between tool calls, so the
// standard lane invocation `cd <lane> && node …/backlog.mjs claim` reports cwd=primary and gets misclassified
// as a primary mutation (denied) AND makes the #2323 git call run in the primary (a false "behind" count).
// Recover the cwd the command will ACTUALLY run in by honouring a leading `cd <target>` — resolving a
// `cd "$LANE"` against a literal `LANE=/abs` assignment earlier in the same command (the exact lane idiom).
// Pure + unit-tested. Fails safe: an unresolvable target (unknown var, command-subst) → the reported cwd,
// i.e. today's behaviour. #2339 removed the BACKLOG_MUTATE_OK override, so there is now no escape hatch for
// that residual case — never a wrong ALLOW of a real primary mutation, but a genuine lane mutation whose `cd`
// target this resolver can't statically resolve (e.g. a command-substitution path) will be wrongly denied.
// The fix is to invoke with a directly-resolvable `cd` (a literal absolute path, or `LANE=/abs; cd "$LANE"` —
// the standard lane idiom every skill already teaches), not to reach for a removed override.
export function resolveEffectiveCwd(command, reportedCwd, resolvePath = resolve) {
  const cmd = String(command || '');
  if (!cmd) return reportedCwd;
  // Collect simple literal `VAR=value` / `export VAR=value` assignments (no command-subst/globs) in order.
  const vars = Object.create(null);
  for (const stmt of splitSegments(cmd)) {
    const m = stmt.trim().match(/^(?:export\s+)?([A-Za-z_]\w*)=(.+)$/);
    if (!m) continue;
    let val = m[2].trim();
    if (/[`$(]/.test(val)) continue;                          // command-subst / nested expansion → skip
    val = val.replace(/^(['"])(.*)\1$/, '$2');                // strip matching surrounding quotes
    if (!/\s/.test(val)) vars[m[1]] = val;                    // single-token literal only
  }
  // First `cd <target>` statement wins (that is where the command lands before the mutation runs).
  for (const stmt of splitSegments(cmd)) {
    const cd = stmt.trim().match(/^cd\s+(.+)$/);
    if (!cd) continue;
    let target = cd[1].trim().split(/\s+/)[0];                // first arg only (ignore trailing redirs/opts)
    target = target.replace(/^(['"])(.*)\1$/, '$2');          // strip surrounding quotes
    const v = target.match(/^\$\{?([A-Za-z_]\w*)\}?$/);       // whole target is $VAR / ${VAR}
    if (v) target = vars[v[1]] ?? '';
    if (!target || /[`$(*?]/.test(target)) return reportedCwd; // still unexpanded / globby → fail safe
    return target.startsWith('/') ? target : resolvePath(reportedCwd || '.', target);
  }
  return reportedCwd;
}

/** Return a deny reason for one shell segment, or null to allow. Pure. `ctx.primaryCwd` = the Bash cwd is a
 *  constellation primary checkout (computed by the CLI via isPrimaryCwd) — gates the #2302 backlog-mutation rule.
 *  `ctx.staleBehind` = how many commits the lane's HEAD sits behind its upstream (computed by the CLI via a git
 *  call — kept out of this pure function so it stays unit-testable with a plain number) — gates the #2323 rule.
 *  `ctx.foreignLiveLease` = this lane clone carries a LIVE UNMARKED lease held by a DIFFERENT session (computed
 *  by the CLI via a lease-file read + a durable session-id compare — kept out of this pure function for the same
 *  reason) — gates the #2367 destructive-op rule. `ctx.markedLeaseSlug` = this lane clone carries a LIVE MARKED
 *  (workflowLane) lease whose minted slug is this string (computed by the CLI via the lease read) — gates the
 *  #2413 fail-closed destructive-op rule, which SUPERSEDES the #2367 ownerSession compare for a marked lane. */
export function reason(segment, { primaryCwd = false, staleBehind = 0, foreignLiveLease = false, markedLeaseSlug = null } = {}) {
  const s = segment.trim();
  if (!s) return null;

  // #2302 — a backlog item-mutation (claim/resolve/scaffold/…) run from the PRIMARY checkout stamps the item on
  // primary and bypasses lane isolation (found working #2095: a primary `claim` flipped open→active, reverted +
  // re-run in the lane). Deny it and steer to a lane — the same invariant guard-lane enforces for Edit/Write.
  // Only fires when cwd is a primary (a lane clone is allowed). #2219 ratified that NO item-file frontmatter
  // transition ever splices to primary (everything rides the lane→PR) — so unlike MAIN_PUSH_OK/STALE_LANE_OK,
  // there is no legitimate direct-to-primary case left to escape-hatch for. #2339 — the former
  // `BACKLOG_MUTATE_OK=1` override was itself the hole (used in error 2026-07-09, defeating this very guard);
  // removed. This denial is now UNCONDITIONAL — primary stays read-only in fact, not just by convention.
  if (primaryCwd && isBacklogMutation(s))
    return 'Backlog item-mutations (claim/resolve/scaffold/settle/retype/yield/prepare-stamp) must run in a LANE clone, not the primary checkout — running backlog.mjs here mutates the item on primary and bypasses lane isolation (#2302/#104/#2219). cd into your lane clone (~/workspace/.lanes/<repo>/lane-N) and run it there. There is no override — #2219 ratified that nothing ever splices to primary (#2339).';

  // #2323 — a backlog item-mutation run in a lane clone that is BEHIND its upstream runs STALE `scripts/`
  // against a STALE backlog view: a pool lane handed out N commits behind origin/main once ran the pre-#2288
  // "next free NNN" allocator and minted a colliding/low-gap number. Only fires when cwd is a lane (never a
  // primary — that path is already denied above) AND the CLI found it behind. Sanctioned override: STALE_LANE_OK=1.
  if (!primaryCwd && staleBehind > 0 && isBacklogMutation(s) && !/\bSTALE_LANE_OK=1\b/.test(s))
    return `This lane clone is ${staleBehind} commit(s) behind origin/main — a mutation here would run STALE scripts/ against a STALE backlog view and can mint a colliding/wrong NNN (#2323). Refresh first: \`git fetch origin --prune && git reset --hard origin/main && git clean -fd\`. Sanctioned override (rare): prefix \`STALE_LANE_OK=1\`.`;

  // The command word(s) of this segment, after stripping leading env-assignments / sudo — so we match
  // actual INVOCATIONS (anchored at command position), not mentions buried in a quoted arg like a commit
  // message. `git commit -m "...pkill vite..."` has command `git`, so the pkill rule no longer fires.
  const cmd = s.replace(/^(?:\w+=\S+\s+)*(?:sudo\s+)?/, '');

  // A destructive git op (reset --hard / clean -f[d] / checkout/restore/switch discard / force-push) run with
  // cwd inside a leased lane clone can clobber in-flight work. Two lease regimes, checked in precedence order:
  if (!primaryCwd && isDestructiveLaneGitOp(s)) {
    const clobberOk = /\bLANE_CLOBBER_OK=1\b/.test(s);
    // #2413 — a LIVE MARKED (workflowLane) lease: fail-CLOSED, and this SUPERSEDES the #2367 ownerSession
    // compare below. In the parallel-/workflow topology every sibling lane shares `ownerSession`, so it can't
    // tell a lane's OWN destructive op from a sibling's — a `reset --hard` in the wrong lane silently clobbers
    // a peer. So the op must ASSERT this lease's own minted slug inline (`LANE_SESSION=<slug>`, the slug the
    // acquiring orchestrator stamped into the lease); ABSENCE or MISMATCH ⇒ deny. The owning lane proves
    // itself by re-asserting the slug it acquired under; a sibling (which never holds that slug) is denied.
    if (markedLeaseSlug) {
      if (clobberOk) return null; // the deliberate escape wins even for a marked lane
      const asserted = assertedLaneSlug(s);
      if (asserted !== markedLeaseSlug)
        return `This lane clone holds a LIVE workflow-lane lease (#2413) — a destructive git op here must ASSERT the lease's own slug inline: prefix \`LANE_SESSION=${markedLeaseSlug}\` (e.g. \`LANE_SESSION=${markedLeaseSlug} git reset --hard origin/main\`). The slug was ${asserted ? `asserted as "${asserted}" — a MISMATCH` : 'ABSENT'}, so this is denied fail-closed: a sibling parallel lane cannot be told apart by ambient session identity, so only the minted slug proves ownership. If this really is your lane, re-assert its slug; otherwise pick another lane. Sanctioned override (rare): prefix \`LANE_CLOBBER_OK=1\`.`;
      return null; // slug asserted and matches → this is the owning lane's own op → allow
    }
    // #2367 — a LIVE UNMARKED lease held by ANOTHER session (serial topology; the durable `ownerSession`
    // compare, fail-OPEN with no id). Unchanged for unmarked leases. Escape: `LANE_CLOBBER_OK=1`.
    if (foreignLiveLease && !clobberOk)
      return 'This lane clone carries a LIVE lease held by ANOTHER session — a destructive git op here (reset --hard/clean -fd/checkout -- ./force-push) would clobber their in-flight work (#2367). If this really is your own lane, release it first (or re-acquire) rather than running this here; otherwise pick a different lane. Sanctioned override (rare): prefix `LANE_CLOBBER_OK=1`.';
  }

  // #2749/#2788 — the 4th `#primary-read-only-lanes-only` guard arm: a build that writes the shared PRIMARY
  // tree, run at primary cwd. Keys on the tree-write alone (never session identity, #2335) — only fires when
  // cwd IS a primary; a lane clone (main session or a delegated subagent, both build in a lane) is untouched.
  // #2788 review — the escape must be a LEADING env-assignment prefix, exactly how it is documented
  // ("prefix `MAIN_SESSION_BUILD_OK=1`"), never a bare substring test. Matching it anywhere meant a command
  // that merely MENTIONED the token — inside a quoted string, a commit message, an echoed doc line — silently
  // disarmed the whole arm. `hasLeadingEnvEscape` walks only the `VAR=val …` prefix, so the token must be in
  // assignment position ahead of the command word to count.
  if (primaryCwd && !hasLeadingEnvEscape(s, 'MAIN_SESSION_BUILD_OK')) {
    const treeWriteReason = primaryTreeWriteReason(s);
    if (treeWriteReason) return treeWriteReason;
  }

  // Only an actual RUN of build:plugs (a runner invocation), not a mention (grep/echo/read).
  if (/\b(?:npm|pnpm|yarn|run-s|run-p|npm-run-all)\b[^|;&]*\bbuild:plugs\b/.test(s) || (/\btsc\b[^|;&]*-p\s+\S*tsconfig\.plugs\.json/.test(s) && !/--noEmit/.test(s)))
    return 'build:plugs / `tsc -p tsconfig.plugs.json` emits shadow .js/.d.ts into the tree (breaks vitest, fakes a red gate). To typecheck plugs use `tsc --noEmit`.';

  if (/^(?:pkill|killall)\b[^|;&]*\b(?:vite|node)\b/.test(cmd))
    return "Never kill the running dev server (pkill/killall vite|node). It's the user's own server — detect the already-running instance and probe its port (3000/4000/8080) instead.";

  if (/^(?:git\s+)?rm\b/.test(cmd) && BACKLOG_MD.test(s))
    return "Never delete a backlog/*.md — a done item becomes status:resolved (the file stays as the record). Resolve it, don't rm it.";

  const mv = cmd.match(/^(?:git\s+)?mv\s+(.+)/);
  if (mv) {
    const paths = mv[1].split(/\s+/).filter((p) => p && !p.startsWith('-'));
    if (paths.length >= 2) {
      const srcN = (paths[0].match(/backlog\/(\d+)-/) || [])[1];
      const dstN = (paths[paths.length - 1].match(/backlog\/(\d+)-/) || [])[1];
      if (srcN && dstN && srcN !== dstN)
        return `Never renumber a backlog item (${srcN} → ${dstN}) — NNN is immutable. A new item takes the next free number; yield this one.`;
    }
  }

  if (/>>\s*(?:\.\/)?(?:backlog|reports)\//.test(s) || (/^(?:sed|tee|perl)\b/.test(cmd) && CORPUS_MD.test(s)))
    return "Don't append/in-place-edit backlog|reports/*.md from the shell (>>, tee -a, sed -i, perl -pi) — it bypasses the locus-prefix write hook so bare code-paths leak to the gate. Use the Edit/Write tools.";

  // Direct push to a constellation `main` — blocked (strict lane-only, #2203). Everything reaches main via a
  // `lane/*` ref → PR → CI gate; a direct `git push … main` (or a bare `git push` from a checkout on main)
  // skips CI entirely. Only an explicit `lane/*` destination is allowed. Sanctioned override: prefix
  // `MAIN_PUSH_OK=1` (e.g. pr-land --fallback-git, or an emergency the user directs).
  if (/^git\s+push\b/.test(cmd) && !/\bMAIN_PUSH_OK=1\b/.test(s)) {
    const rest = cmd.replace(/^git\s+push\b/, '');
    const targetsMain = /(?::(?:refs\/heads\/)?main\b)|(?:\s(?:refs\/heads\/)?main\b)/.test(rest);
    const targetsLane = /lane\//.test(rest);
    if (targetsMain || !targetsLane)
      return 'direct push to `main` is blocked (strict lane-only enforcement, #2203). Push to a `lane/*` ref and land via a PR so CI gates it: `git push origin HEAD:refs/heads/lane/<name>` then `pr-land`. Sanctioned override (rare): prefix `MAIN_PUSH_OK=1`.';
  }

  return null;
}

/** Drop heredoc BODIES (and their terminator lines) from a multi-line command, keeping every real command
 *  line — including the opener that declares the heredoc. Pure. Without this, `decide`'s newline split reads
 *  each body line as a command segment, so prose containing `>`/`sed`/`npm run build` produces phantom
 *  denials. Only `<<`/`<<-` with a plain, quoted, or bare-word delimiter is recognised (the forms an agent
 *  actually writes); anything else is left untouched, i.e. today's behaviour. */
export function stripHeredocBodies(command) {
  const text = String(command || '');
  if (!text.includes('<<')) return text;
  const OPENER = /<<-?\s*(?:'([^']+)'|"([^"]+)"|\\?([A-Za-z_]\w*))/;
  const kept = [];
  let delim = null;
  for (const line of text.split('\n')) {
    if (delim !== null) {
      if (line.trim() === delim) delim = null;   // terminator — dropped along with the body
      continue;
    }
    kept.push(line);
    const m = line.match(OPENER);
    if (m) delim = m[1] || m[2] || m[3];
  }
  return kept.join('\n');
}

/** First deny reason across a command's `&&`/`|`/`;`-separated segments, or null. Pure. `ctx` is passed to
 *  each `reason` call (carries `primaryCwd` for the #2302 rule, `staleBehind` for the #2323 rule, and
 *  `foreignLiveLease` for the #2367 rule). */
export function decide(command, ctx = {}) {
  if (!command) return null;
  // #2788 review r3 finding 2 — a heredoc BODY is data, not commands. The segment split below treats every
  // newline as a separator, so a body line that happens to contain `>` (`Fix the > thing` in a PR-body
  // heredoc) would be read as a redirect. Drop the bodies first; the OPENER line stays, so
  // `cat > config/app.json <<'EOF'` is still caught as the tree write it is.
  command = stripHeredocBodies(command);
  // (`>|`, the noclobber-override redirect, used to be pre-normalized to `>` here because the quote-blind
  // split tore it in half at its `|` — r3 finding 2. `splitSegments` consumes a redirect operator run whole,
  // so the rewrite is no longer needed and no longer mangles a `>|` that appears inside a quoted argument.)
  // #2833 finding 3 — whole-command check FIRST: backgrounding is a property of the whole command (a trailing `&`
  // / the `run_in_background` tool param), which the per-segment split below would lose. Deny a backgrounded
  // verification-set run before anything else.
  const bg = backgroundedVerificationReason(command, ctx.runInBackground);
  if (bg) return bg;
  // #2994 — QUOTE-AWARE split: tokenize quotes first, cut only on UNQUOTED separators.
  for (const seg of splitSegments(command)) {
    const r = reason(seg, ctx);
    if (r) return r;
  }
  return null;
}

// #2323 — how many commits is `cwd`'s HEAD behind its upstream (`@{u}`)? Impure (a git call), so it lives in
// the CLI section, not the pure `reason`/`decide` — those stay unit-testable with a plain ctx.staleBehind
// number. A lane clone's local branch tracks `origin/<branch>` from its initial `checkout -B` (lane-pool.mjs
// cloneLane), so `@{u}` resolves there without hardcoding a branch name. Fails OPEN (0) on any error — no
// upstream configured, not a git repo, network hiccup on the fetch this reads (stale local knowledge is still
// informative, we don't fetch here) — a guard bug or an unusual checkout must never wedge the agent.
function commitsBehindUpstream(cwd) {
  try {
    return Number(execFileSync('git', ['rev-list', '--count', 'HEAD..@{u}'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()) || 0;
  } catch {
    return 0;
  }
}

// #2367 — read a lane clone's lease marker (`.git/<LEASE_FILENAME>`, written by `lane-pool.mjs acquire`).
// Impure (fs read); mirrors lane-pool.mjs's own `readLease` (kept separate — this side has no reason to
// depend on the CLI-flags-shaped lane-pool.mjs module). A missing/corrupt marker is "no lease" — fail open.
function readLaneLease(laneRoot) {
  try {
    const parsed = JSON.parse(readFileSync(join(laneRoot, '.git', LEASE_FILENAME), 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// #2367/#2413 — the destructive-op lease context for `cwd` (a lane clone about to run what LOOKS like a
// destructive git op). Impure (fs + env); the CLI only calls this when both are already true (isLaneCwd +
// hasDestructiveLaneOp) so the cost is paid on a tiny slice of Bash calls. Reads the lease ONCE and returns
// { markedLeaseSlug, foreignLiveLease }:
//   • Stale / absent lease ⇒ { null, false } (allow — no live hold).
//   • LIVE MARKED (workflowLane) lease ⇒ { <its minted slug>, false } — the #2413 fail-closed slug-assertion
//     regime takes over; the ownerSession compare is NOT consulted (siblings share it, so it fails open in the
//     one topology that matters — the whole reason marked lanes exist).
//   • LIVE UNMARKED lease ⇒ { null, isForeignLease(ownerSession vs mine) } — the #2367 regime, unchanged (r2's
//     durable-ownerSession-alone compare; degraded no-id ⇒ fail-open allow).
function laneLeaseGuardCtx(cwd, mySessionId) {
  const laneRoot = laneRootFromCwd(cwd);
  if (!laneRoot) return { markedLeaseSlug: null, foreignLiveLease: false };
  const lease = readLaneLease(laneRoot);
  if (!lease || isLeaseStale(lease, Date.now())) return { markedLeaseSlug: null, foreignLiveLease: false };
  const marked = laneMarkedSlug(lease);
  if (marked) return { markedLeaseSlug: marked, foreignLiveLease: false };
  return { markedLeaseSlug: null, foreignLiveLease: isForeignLease({ lease, mySessionId }) };
}

// ── CLI: read the PreToolUse event, emit a deny decision when blocked ──────────────────────────────────
const IS_CLI = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (IS_CLI) {
  let cmd = '';
  let primaryCwd = false;
  let staleBehind = 0;
  let foreignLiveLease = false;
  let markedLeaseSlug = null;
  let runInBackground = false;
  try {
    const ev = JSON.parse(readFileSync(0, 'utf8'));
    cmd = (ev.tool_input || {}).command || '';
    // #2833 finding 3 — the Bash tool's own `run_in_background` param is the primary channel the stall arrives
    // through (the harness detaches the process). Read it so a backgrounded verification run is denied even when
    // the command text carries no `&`.
    runInBackground = !!(ev.tool_input || {}).run_in_background;
    // #2367 — the DURABLE session identity. Key on `CLAUDE_CODE_SESSION_ID` (env) FIRST — the SAME source
    // `lane-pool.mjs acquire` stamps into the lease's `ownerSession`, so my own lease can never read as foreign
    // due to a string-source mismatch (r2 correctness fix). The hook payload's `session_id` is only a secondary
    // cross-check/fallback for the rare call where the env is unset. Used to tell my own lease from a peer's.
    const mySessionId = process.env.CLAUDE_CODE_SESSION_ID || ev.session_id || null;
    // #2302 — the Bash cwd decides primary-vs-lane. Derive the constellation primary roots from THIS script's
    // location (<workspace>/<repo>/scripts/guard-bash.mjs) and realpath both sides so a symlinked workspace
    // still matches. Fail-OPEN (leave primaryCwd=false) on any error — a guard bug must never wedge the agent.
    const rp = (p) => { try { return realpathSync(p); } catch { return p; } };
    // #2335 — the reported cwd resets to the primary between calls; honour a leading `cd <lane>` so a genuine
    // lane mutation isn't misread as a primary one (and the #2323 git call runs in the lane, not the primary).
    const cwd = rp(resolveEffectiveCwd(cmd, ev.cwd || process.cwd()));
    const weRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    const workspace = dirname(weRoot);
    const primaries = ['webeverything', 'web-everything', 'frontierui', 'plateau-app'].map((r) => rp(join(workspace, r)));
    primaryCwd = isPrimaryCwd(cwd, primaries);
    // #2323 — only pay for the git call when it could possibly matter: a lane cwd about to run a
    // backlog-mutation command. Every other Bash call (the overwhelming majority) skips it entirely.
    if (!primaryCwd && isLaneCwd(cwd) && isBacklogMutation(cmd)) staleBehind = commitsBehindUpstream(cwd);
    // #2367/#2413 — only pay for the lease read when it could possibly matter: a lane cwd about to run
    // something that LOOKS like a destructive git op. Every other Bash call skips it entirely.
    if (!primaryCwd && isLaneCwd(cwd) && hasDestructiveLaneOp(cmd)) ({ markedLeaseSlug, foreignLiveLease } = laneLeaseGuardCtx(cwd, mySessionId));
  } catch { process.exit(0); }
  const r = decide(cmd, { primaryCwd, staleBehind, foreignLiveLease, markedLeaseSlug, runInBackground });
  if (r) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: 'Blocked: ' + r },
    }));
  }
  // #2749/#2788 — the WARN-only nudge for the un-script-decidable "should have delegated" half. Independent
  // of the deny channel above (fires even when `r` is null — this command wrote no tree); stderr only, never
  // blocks. try/catch: a guard bug here must never wedge the agent.
  try {
    const nudge = mainSessionDelegateNudge(cmd, { primaryCwd });
    // #2788 review — stderr on an exit-0 PreToolUse hook is NOT surfaced to the user or fed back to the
    // model, so the WARN half shipped as a no-op. Emit it on the structured stdout channel instead
    // (`systemMessage`, the documented field for a non-blocking hook message) and keep writing stderr as a
    // belt-and-braces fallback for a human tailing the hook log.
    // NOTE: the deny path (`hookSpecificOutput`) is proven by this file's own use; `systemMessage` delivery
    // is NOT independently verified here — it is additive and strictly no worse than today's stderr-only
    // behaviour (an unrecognised field is ignored), and it can never deny, so a wrong guess cannot wedge a
    // command. Confirm against the live hook contract before relying on it as the sole channel.
    if (nudge) {
      // #2788 review r2 — stdout must stay ONE JSON document per hook invocation. The deny path above may
      // already have written `hookSpecificOutput`; emitting a second `systemMessage` object after it produced
      // two concatenated JSON documents on one stream, which a strict reader cannot parse — and the deny is
      // the message that matters, so corrupting it to append a nudge is a strictly bad trade. When the
      // command is already denied, the nudge goes to stderr only.
      if (!r) process.stdout.write(JSON.stringify({ systemMessage: 'guard-bash: ' + nudge }) + '\n');
      process.stderr.write('guard-bash: ' + nudge + '\n');
    }
  } catch { /* never wedge on a nudge-computation fault */ }
  process.exit(0);
}
