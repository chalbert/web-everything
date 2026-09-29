/**
 * dispatch-trust-refused — #4174 follow-up (live-caught 2026-09-27). `claude --bg`'s own "Workspace not
 * trusted" refusal for a dispatched session's fresh scratch cwd, repeated in the daemon logs. Live evidence:
 * 17 occurrences in `~/workspace/wev-review-daemon/.conveyor/fix-dispatch-daemon.log` (`grep "Workspace not
 * trusted"`), across `fix-`/`ci-heal-`/review dispatches for PRs #2766/#2767/#2800/#2803/#2822, latest
 * ~2026-09-27 14:35 ET.
 *
 * ROOT CAUSE — a lost-update race, not a missing grant. `we:scripts/operations/dispatch-lane-io.mjs`'s
 * `ensureDispatchSessionCwd` already grants trust (via `grantDispatchTrust`) right before every dispatch, under
 * a file lock that serializes it against its own counterpart `revokeDispatchTrust`. That lock protects nothing
 * against a DIFFERENT, uncooperative writer: a concurrent `claude` process (another dispatched session, or an
 * interactive one on the same host) doing its own unrelated, unlocked read-modify-write of the same
 * `~/.claude.json` for its own bookkeeping. If that external write's read snapshot predates our grant, our
 * just-added trust entry is silently clobbered before the spawn even starts — intermittent by construction,
 * since it only bites when another `claude` process's write straddles this one session's narrow grant-to-spawn
 * window. `we:scripts/operations/dispatch-lane-io.mjs#defaultSpawnAgent` now verifies/re-grants and retries
 * once at the moment closest to the actual spawn, which should resolve most of these silently; this smell is
 * the BACKSTOP for whatever still slips through both retries (or a dispatch path that reaches `claude --bg`
 * without going through that retry) — the same "fix at spawn time, smell as backstop" shape
 * `dispatch-permission-stall.mjs` already established for #xrv69j6's own lane-grant race.
 */
import { MINUTE } from '../health-watch-core.mjs';

export default {
  id: 'dispatch-trust-refused',
  scope: 'host',
  cadence: 'every-tick',
  probes: ['daemonLogs'],
  openAfter: 1,
  closeAfter: 3,
  severity: 'high',
  action: 'alert',
  windowMs: 60 * MINUTE,
  minErrors: 2,
  recommendationHint: 'A dispatched session\'s scratch cwd is repeatedly refused as "not trusted" — the '
    + 'spawn-time grant/retry in dispatch-lane-io.mjs is losing a race against a concurrent claude process\'s '
    + 'own unlocked write of ~/.claude.json. See #4238 and dispatch-lane-io.mjs#isTrustRefusal.',
  evaluate(_probes, { now, daemons }) {
    const per = {};
    let total = 0;
    for (const [name, mem] of Object.entries(daemons)) {
      const c = (mem.trustRefusalTimes || []).filter((t) => now - t <= this.windowMs).length;
      if (c) { per[name] = c; total += c; }
    }
    return [{
      subject: 'dispatch-trust',
      breach: total >= this.minErrors,
      measure: { trustRefusals60m: total, perDaemon: per },
      summary: `${total} "Workspace not trusted" dispatch refusal(s) in the last `
        + `${Math.round(this.windowMs / MINUTE)}m${Object.keys(per).length ? ` (${Object.entries(per).map(([n, c]) => `${n}×${c}`).join(', ')})` : ''}.`,
      recommendation: this.recommendationHint,
    }];
  },
};
