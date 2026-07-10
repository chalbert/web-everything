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
 *   • a destructive git op (`reset --hard`, `clean -f[d]`, `checkout/restore/switch` that discards the tree,
 *     a force-push — normalized past wrapper/path/global-flag disguises by `canonicalGitOp`) run with cwd
 *     inside a `.lanes/<repo>/lane-N/` clone whose LIVE lease (`scripts/lib/lane-lease.mjs`) is held by
 *     ANOTHER session — the hole behind a 2026-07-09 incident: a `/slice` ran `git reset --hard` in a lane a
 *     concurrent session had just leased; the acquire correctly refused, but the `;`-chained reset ran
 *     regardless and clobbered the peer's clone. Ownership is decided by `isForeignLease`: the DURABLE
 *     session id (`CLAUDE_CODE_SESSION_ID`, stamped as `ownerSession` at `acquire`, read here from the hook
 *     payload's `session_id`) is the authoritative signal — a live lease whose `ownerSession` differs from
 *     mine ⇒ FOREIGN ⇒ deny; equal ⇒ my lane ⇒ allow. Only an OLDER lease lacking `ownerSession` falls back
 *     to the pid-ancestry overlap heuristic. Stale or absent lease ⇒ allow (nothing to protect). Escape:
 *     `LANE_CLOBBER_OK=1`.
 *
 * Input: PreToolUse JSON on stdin. Output: a deny decision (JSON) when blocked; nothing otherwise.
 * Fails open on unparseable input. The pure `reason`/`decide` are unit-tested (guard-bash.test.mjs).
 */
import { readFileSync, realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, join } from 'node:path';
import { LEASE_FILENAME, isLeaseStale, isForeignLease } from './lib/lane-lease.mjs';
import { getAncestryPids } from './lib/pid-ancestry.mjs';

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

// #2367 — the destructive-git-op guard for a lane clone leased by ANOTHER session ─────────────────────

/** The lane clone ROOT (`…/.lanes/<repo>/lane-N`) a `cwd` sits at or under, or null. Pure — string test
 *  only; the CLI resolves the `.git/<LEASE_FILENAME>` marker path from this. */
export function laneRootFromCwd(cwd) {
  if (!cwd) return null;
  const m = String(cwd).match(/^(.*\/\.lanes\/[^/]+\/lane-\d+)(?:\/.*)?$/);
  return m ? m[1] : null;
}

/** Normalize the leading git invocation of a single (already env/sudo-stripped) command segment to a
 *  canonical `git <subcommand> …` string, or '' if the segment is not a git invocation. Pure — closes the
 *  #2367 matcher-BYPASS holes an `^git`-anchored test misses: it unwraps a leading subshell `(`/group `{`,
 *  peels wrapper commands (`env [VAR=v…]`, `time`, `command`, `builtin`, `nice`, `xargs [opts]`), resolves a
 *  path-qualified git to its basename (`/usr/bin/git`→`git`), and skips git's leading GLOBAL flags
 *  (`-C <path>`, `-c <k=v>`, `--git-dir=…`, …) so the REAL subcommand is what the danger patterns match. */
export function canonicalGitOp(cmd) {
  let c = String(cmd || '').trim();
  if (!c) return '';
  c = c.replace(/^[({]\s*/, '').trim();                 // unwrap a leading subshell `(…` / brace group `{ …`
  let tokens = c.split(/\s+/);
  // Peel leading wrapper commands until the real program word is exposed (bounded: each pass shifts ≥1 token).
  for (let guard = 0; guard < tokens.length && tokens.length; guard++) {
    const w = tokens[0];
    if (w === 'env') {
      tokens.shift();
      while (tokens.length && /^[A-Za-z_]\w*=/.test(tokens[0])) tokens.shift();  // env VAR=val … <cmd>
    } else if (w === 'time' || w === 'command' || w === 'builtin' || w === 'nice') {
      tokens.shift();
    } else if (w === 'xargs') {
      tokens.shift();
      while (tokens.length && tokens[0].startsWith('-')) tokens.shift();          // xargs -n1 -I{} … <cmd>
    } else break;
  }
  if (!tokens.length || tokens[0].replace(/^.*\//, '') !== 'git') return '';      // /usr/bin/git → git; else not git
  tokens[0] = 'git';
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
 *  `decide`'s segment split. The CLI uses this as a cheap pre-filter so the `ps`/`fs` lease-ownership check
 *  below only runs when it could possibly matter (the overwhelming majority of Bash calls skip it). */
export function hasDestructiveLaneOp(command) {
  if (!command) return false;
  return String(command)
    .split(/(?:&&|\|\||[;&|]|\n)+/)
    .some((seg) => isDestructiveLaneGitOp(seg.trim().replace(/^(?:\w+=\S+\s+)*(?:sudo\s+)?/, '')));
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
 *  call — kept out of this pure function so it stays unit-testable with a plain number) — gates the #2323 rule.
 *  `ctx.foreignLiveLease` = this lane clone carries a LIVE lease held by a DIFFERENT session (computed by the
 *  CLI via a lease-file read + pid-ancestry `ps` walk — kept out of this pure function for the same reason)
 *  — gates the #2367 destructive-op rule. */
export function reason(segment, { primaryCwd = false, staleBehind = 0, foreignLiveLease = false } = {}) {
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

  // #2367 — a destructive git op (reset --hard / clean -f[d] / checkout/restore/switch discard / force-push)
  // run with cwd inside a lane clone that carries a LIVE lease from ANOTHER session would clobber their
  // in-flight work — the hole a 2026-07-09 incident opened (a concurrent `/slice`'s `;`-chained `reset --hard`
  // ran anyway after its own `acquire` was correctly refused). `ctx.foreignLiveLease` is precomputed by the CLI
  // (readLaneLease + `isForeignLease`: durable `ownerSession` id, ancestry fallback; a cost only paid when cwd
  // is a lane AND the command looks destructive). Only fires for a segment that IS itself the destructive op
  // (a lane's OWN session running one is unaffected — its `ownerSession` matches). Escape: `LANE_CLOBBER_OK=1`.
  if (!primaryCwd && foreignLiveLease && isDestructiveLaneGitOp(cmd) && !/\bLANE_CLOBBER_OK=1\b/.test(s))
    return 'This lane clone carries a LIVE lease held by ANOTHER session — a destructive git op here (reset --hard/clean -fd/checkout -- ./force-push) would clobber their in-flight work (#2367). If this really is your own lane, release it first (or re-acquire) rather than running this here; otherwise pick a different lane. Sanctioned override (rare): prefix `LANE_CLOBBER_OK=1`.';

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
 *  each `reason` call (carries `primaryCwd` for the #2302 rule, `staleBehind` for the #2323 rule, and
 *  `foreignLiveLease` for the #2367 rule). */
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

// #2367 — is `cwd` (a lane clone about to run what LOOKS like a destructive git op) leased LIVE by ANOTHER
// session? Impure (fs + env + ps); the CLI only calls this when both are already true (isLaneCwd +
// hasDestructiveLaneOp) so the cost is paid on a tiny slice of Bash calls. Stale/absent lease ⇒ false (allow).
// Ownership is decided by the pure `isForeignLease`: the durable `ownerSession` (this session's id) is the
// authoritative signal; the `ps` ancestry walk is only the legacy fallback for older leases. Returns true
// only for a genuine foreign hold.
function isForeignLiveLease(cwd, mySessionId) {
  const laneRoot = laneRootFromCwd(cwd);
  if (!laneRoot) return false;
  const lease = readLaneLease(laneRoot);
  if (!lease || isLeaseStale(lease, Date.now())) return false;
  const myAncestry = getAncestryPids(process.pid);
  return isForeignLease({ lease, mySessionId, myAncestry });
}

// ── CLI: read the PreToolUse event, emit a deny decision when blocked ──────────────────────────────────
const IS_CLI = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (IS_CLI) {
  let cmd = '';
  let primaryCwd = false;
  let staleBehind = 0;
  let foreignLiveLease = false;
  try {
    const ev = JSON.parse(readFileSync(0, 'utf8'));
    cmd = (ev.tool_input || {}).command || '';
    // #2367 — the DURABLE session identity: the PreToolUse payload carries `session_id`; fall back to the
    // `CLAUDE_CODE_SESSION_ID` env this hook subprocess inherits. Used to tell my own lease from a peer's.
    const mySessionId = ev.session_id || process.env.CLAUDE_CODE_SESSION_ID || null;
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
    // #2367 — only pay for the lease read + `ps` ancestry walk when it could possibly matter: a lane cwd about
    // to run something that LOOKS like a destructive git op. Every other Bash call skips it entirely.
    if (!primaryCwd && isLaneCwd(cwd) && hasDestructiveLaneOp(cmd)) foreignLiveLease = isForeignLiveLease(cwd, mySessionId);
  } catch { process.exit(0); }
  const r = decide(cmd, { primaryCwd, staleBehind, foreignLiveLease });
  if (r) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: 'Blocked: ' + r },
    }));
  }
  process.exit(0);
}
