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
 *   • a backlog item-mutation (claim/scaffold/…) run in a lane clone whose HEAD is BEHIND origin/main —
 *     a stale checkout runs stale `scripts/` against a stale backlog view (observed 2026-07-07: a lane
 *     19 commits behind ran the pre-#2288 "next free NNN" allocator and minted a colliding/low-gap
 *     number, #2323). Refuse and tell the caller to refresh (`git fetch && git reset --hard origin/main
 *     && git clean -fd`) rather than silently proceeding. Escape: `STALE_LANE_OK=1`.
 *
 * Input: PreToolUse JSON on stdin. Output: a deny decision (JSON) when blocked; nothing otherwise.
 * Fails open on unparseable input. The pure `reason`/`decide` are unit-tested (guard-bash.test.mjs).
 */
import { readFileSync, realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, join } from 'node:path';

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

// #2335 — the harness resets the reported Bash cwd to the PRIMARY checkout between tool calls, so the
// standard lane invocation `cd <lane> && node …/backlog.mjs claim` reports cwd=primary and gets misclassified
// as a primary mutation (denied) AND makes the #2323 git call run in the primary (a false "behind" count).
// Recover the cwd the command will ACTUALLY run in by honouring a leading `cd <target>` — resolving a
// `cd "$LANE"` against a literal `LANE=/abs` assignment earlier in the same command (the exact lane idiom).
// Pure + unit-tested. Fails safe: an unresolvable target (unknown var, command-subst) → the reported cwd,
// i.e. today's behaviour (an override is still needed, never a wrong ALLOW of a real primary mutation).
export function resolveEffectiveCwd(command, reportedCwd, resolvePath = resolve) {
  const cmd = String(command || '');
  if (!cmd) return reportedCwd;
  // Collect simple literal `VAR=value` / `export VAR=value` assignments (no command-subst/globs) in order.
  const vars = Object.create(null);
  for (const stmt of cmd.split(/(?:&&|\|\||[;&|]|\n)+/)) {
    const m = stmt.trim().match(/^(?:export\s+)?([A-Za-z_]\w*)=(.+)$/);
    if (!m) continue;
    let val = m[2].trim();
    if (/[`$(]/.test(val)) continue;                          // command-subst / nested expansion → skip
    val = val.replace(/^(['"])(.*)\1$/, '$2');                // strip matching surrounding quotes
    if (!/\s/.test(val)) vars[m[1]] = val;                    // single-token literal only
  }
  // First `cd <target>` statement wins (that is where the command lands before the mutation runs).
  for (const stmt of cmd.split(/(?:&&|\|\||[;&|]|\n)+/)) {
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
 *  call — kept out of this pure function so it stays unit-testable with a plain number) — gates the #2323 rule. */
export function reason(segment, { primaryCwd = false, staleBehind = 0 } = {}) {
  const s = segment.trim();
  if (!s) return null;

  // #2302 — a backlog item-mutation (claim/resolve/scaffold/…) run from the PRIMARY checkout stamps the item on
  // primary and bypasses lane isolation (found working #2095: a primary `claim` flipped open→active, reverted +
  // re-run in the lane). Deny it and steer to a lane — the same invariant guard-lane enforces for Edit/Write.
  // Only fires when cwd is a primary (a lane clone is allowed). Sanctioned override: prefix BACKLOG_MUTATE_OK=1.
  if (primaryCwd && isBacklogMutation(s) && !/\bBACKLOG_MUTATE_OK=1\b/.test(s))
    return 'Backlog item-mutations (claim/resolve/scaffold/settle/retype/yield/prepare-stamp) must run in a LANE clone, not the primary checkout — running backlog.mjs here mutates the item on primary and bypasses lane isolation (#2302/#104). cd into your lane clone (~/workspace/.lanes/<repo>/lane-N) and run it there. Sanctioned override (rare): prefix `BACKLOG_MUTATE_OK=1`.';

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

/** First deny reason across a command's `&&`/`|`/`;`-separated segments, or null. Pure. `ctx` is passed to
 *  each `reason` call (carries `primaryCwd` for the #2302 rule and `staleBehind` for the #2323 rule). */
export function decide(command, ctx = {}) {
  if (!command) return null;
  for (const seg of String(command).split(/(?:&&|\|\||[;&|]|\n)+/)) {
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

// ── CLI: read the PreToolUse event, emit a deny decision when blocked ──────────────────────────────────
const IS_CLI = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (IS_CLI) {
  let cmd = '';
  let primaryCwd = false;
  let staleBehind = 0;
  try {
    const ev = JSON.parse(readFileSync(0, 'utf8'));
    cmd = (ev.tool_input || {}).command || '';
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
  } catch { process.exit(0); }
  const r = decide(cmd, { primaryCwd, staleBehind });
  if (r) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: 'Blocked: ' + r },
    }));
  }
  process.exit(0);
}
