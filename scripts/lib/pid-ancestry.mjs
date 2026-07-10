/**
 * pid-ancestry.mjs — the impure OS-process-tree half of the #2367 leaseholder-identity check.
 *
 * A SINGLE captured pid (this process's own, or its immediate parent's `ppid`) does not survive being
 * useful across SEPARATE shell invocations: each Bash-tool call in an interactive agent session gets its
 * OWN fresh `bash -c "…"` wrapper process (verified empirically — two Bash calls in the same session get
 * two different immediate-parent pids), so a pid captured during the `acquire` call is a dead LEAF by the
 * time a LATER call runs the destructive command — never an ancestor of anything again, so a same-lease
 * "is this pid an ancestor of me" test would ALWAYS read as foreign, even for the owning session.
 *
 * The one thing that DOES persist across every Bash-tool call within one session is a common ancestor
 * further up the tree (the session's own long-lived process, e.g. the Claude Code CLI itself). So identity
 * here isn't "one pid" — it's "the FULL live ancestry chain, walked NOW". Two chains captured at different
 * moments (lease-acquire time vs. guard time) OVERLAP wherever that common ancestor sits, regardless of how
 * many short-lived wrapper shells exist in between or how deep it is. See `ancestryOverlaps` in
 * `lane-lease.mjs` for the pure decision half.
 */
import { execFileSync } from 'node:child_process';

/**
 * The LIVE ancestor pids of `startPid`, INCLUSIVE of `startPid` itself, oldest-caller-first, via repeated
 * `ps -o ppid=`. OS-observed-NOW only — walks whatever the process tree looks like at the moment this
 * runs (works on macOS/Linux). Capped at `maxDepth`; stops at pid ≤ 1 or the first `ps` failure (process
 * gone / permission denied) — never spins, never throws.
 */
export function getAncestryPids(startPid, maxDepth = 40) {
  const pids = [];
  let pid = Number(startPid);
  for (let i = 0; i < maxDepth && Number.isFinite(pid) && pid > 1; i++) {
    pids.push(pid);
    let next;
    try {
      next = Number(execFileSync('ps', ['-o', 'ppid=', '-p', String(pid)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim());
    } catch {
      break;
    }
    if (!Number.isFinite(next) || next === pid) break;
    pid = next;
  }
  return pids;
}
