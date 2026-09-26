/**
 * @file scripts/operations/delivery-agent-marker.mjs
 * @description Epic #3383 (mechanical-dispatcher), Part 2 — the per-item `deliveryAgent:` frontmatter marker
 * that lets a human (or a future validated policy) route ONE backlog item's `build`/`fix`/`ci-heal` dispatch to
 * a specific `DeliveryAgentProvider` (`claude-restricted` or `codex` — see
 * `we:scripts/operations/deliver-item-wrapper.mjs#DELIVERY_AGENT_PROVIDER_NAMES`), WITHOUT the driver making
 * that call itself.
 *
 * WHY EXPLICIT OPT-IN, NOT AN AUTOMATIC SELECTOR: Codex's delivery QUALITY (as opposed to its sandboxing/spawn
 * mechanics, already proven — see `codex-delivery-provider.mjs`'s own header) has never been validated on a
 * real task. A percentage rollout or risk-based auto-selector would be a driver-side judgment call made ahead
 * of that evidence; a per-item marker a human sets on purpose is not.
 *
 * SHAPE, FOLLOWING `deliveryTarget:` — the nearest precedent (`we:scripts/lib/poc-branches.mjs`, the POC-branch
 * work): a plain scalar frontmatter field on the item's own `backlog/NNN-*.md`, read with the SAME `readField`
 * primitive every other scalar frontmatter read in this repo uses (`we:scripts/backlog/frontmatter.mjs`), via
 * the SAME `resolveBacklogFile` lookup `we:scripts/operations/resolve-io.mjs`/`claim-io.mjs` already use to turn
 * a bare item number into its one `.md` file — REUSED here, not re-derived.
 *
 * DELIBERATELY NOT VALIDATED HERE. The one place that validates a provider NAME is the `*-run.mjs` CLI entry
 * point each dispatch kind already has (`selectDeliveryAgentProvider` / `selectFixAgentProvider` /
 * `selectCiHealAgentProvider`), which throws loudly on an unknown name before any lane is acquired or item
 * claimed. Re-validating the same vocabulary here would be a second copy of it that could drift from the
 * first; this module's only job is "what does the item's own file say", verbatim, trimmed.
 *
 * PURE CORE / IO SHELL split, matching this file family's convention: {@link parseDeliveryAgentMarker} is pure
 * (no fs); {@link readItemDeliveryAgentMarker} is the one impure call, injectable for the same reason every
 * sibling reader in this repo is (`acquireLane`, `readCodexThreadId`, …).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { readField } from '../backlog/frontmatter.mjs';
import { resolveBacklogFile } from './resolve-io.mjs';
import { REPO_ROOT } from './detached-dispatch.mjs';
import { checkMainStaleness, gitRun } from '../lib/main-staleness.mjs';

/** The frontmatter key itself — named once so a grep for the marker's spelling has exactly one hit. */
export const DELIVERY_AGENT_MARKER_KEY = 'deliveryAgent';

/**
 * The REQUIRED companion key (#3840, Fork 5 of #3801). A `deliveryAgent:` marker with no `deliveryAgentReason:`
 * is refused at routing (`we:scripts/lib/dispatch-contracts.mjs#decideDispatchRoute`): git's who and when is
 * not a why, and #3717 requires every override to carry its reason. This is the ONE provider override; the
 * process-wide environment variables that once selected a provider (three of them, retired by #3840) are
 * gone.
 */
export const DELIVERY_AGENT_REASON_KEY = 'deliveryAgentReason';

/**
 * PURE. Extracts `deliveryAgent:` from an already-read file's raw text, or `null` when absent/blank.
 * @param {string} content
 * @returns {string|null}
 */
export function parseDeliveryAgentMarker(content) {
  const raw = readField(content, DELIVERY_AGENT_MARKER_KEY);
  const value = raw ? String(raw).trim() : '';
  return value || null;
}

/**
 * PURE. Extracts `deliveryAgentReason:` from an already-read file's raw text, or `null` when absent/blank.
 * @param {string} content
 * @returns {string|null}
 */
export function parseDeliveryAgentReason(content) {
  const raw = readField(content, DELIVERY_AGENT_REASON_KEY);
  const value = raw ? String(raw).trim() : '';
  return value || null;
}

/**
 * THE IO SHELL. Resolve item `num`'s own backlog file and read its `deliveryAgent:` marker.
 *
 * NEVER THROWS, and returns `null` for every one of: no `num` given (a repair dispatch with no known item —
 * see the `fix`/`ci-heal` providers' own `num` field, which is genuinely optional), the item cannot be
 * resolved to exactly one `backlog/*.md` file, the file cannot be read, or the field is absent/blank. A marker
 * that cannot be read must never itself block a dispatch that would otherwise proceed under the default
 * provider — it degrades to "no marker", exactly the same best-effort posture `readCodexThreadId` and every
 * other sidecar read in this file family already take.
 *
 * @param {string|number|null|undefined} num
 * @param {{root?: string, listFiles?: (dir: string) => string[], read?: (path: string) => string}} [io]
 * @returns {string|null}
 */
export function readItemDeliveryAgentMarker(num, {
  root = REPO_ROOT,
  listFiles = (dir) => readdirSync(dir),
  read = (p) => readFileSync(p, 'utf8'),
} = {}) {
  const key = String(num ?? '').trim();
  if (!key) return null;
  try {
    const file = resolveBacklogFile(key, root, listFiles);
    if (!file) return null;
    return parseDeliveryAgentMarker(read(join(root, 'backlog', file)));
  } catch {
    return null;
  }
}

/**
 * THE IO SHELL for the whole override — the marker AND its reason — from ONE read of the item's own file
 * (#3840). Same never-throws, best-effort posture as {@link readItemDeliveryAgentMarker}: `null` when the item
 * cannot be resolved or read, or when NEITHER key is present. Otherwise both halves are returned as the file
 * states them (`null` for an absent one), so the caller can refuse a marker with no reason AND a reason with no
 * marker by name rather than by silence. Validation of the vendor name and of the pairing is NOT done here: it
 * is the router's (`decideDispatchRoute`), which is the one place that refuses.
 *
 * @param {string|number|null|undefined} num
 * @param {{root?: string, listFiles?: (dir: string) => string[], read?: (path: string) => string}} [io]
 * @returns {{deliveryAgent: (string|null), deliveryAgentReason: (string|null)}|null}
 */
export function readItemDeliveryAgentOverride(num, {
  root = REPO_ROOT,
  listFiles = (dir) => readdirSync(dir),
  read = (p) => readFileSync(p, 'utf8'),
} = {}) {
  const key = String(num ?? '').trim();
  if (!key) return null;
  try {
    const file = resolveBacklogFile(key, root, listFiles);
    if (!file) return null;
    const content = read(join(root, 'backlog', file));
    const deliveryAgent = parseDeliveryAgentMarker(content);
    const deliveryAgentReason = parseDeliveryAgentReason(content);
    if (!deliveryAgent && !deliveryAgentReason) return null;
    return { deliveryAgent, deliveryAgentReason };
  } catch {
    return null;
  }
}

/**
 * THE MARKER-ORDERING FIX (mechanical-dispatcher #3383 Part 2 follow-up — a real bug found on the first live
 * Codex trial). BEST-EFFORT: freshens `root`'s OWN currently-checked-out branch against `origin/<that branch>`
 * — a `fetch` + `--ff-only --autostash` fast-forward via {@link checkMainStaleness}
 * (`we:scripts/lib/main-staleness.mjs`, #2204) — the SAME fetch-first guard `we:scripts/operations/
 * review-dispatch.mjs#assertMainNotStale` (#3439) already gives the review dispatcher for an analogous
 * staleness risk. NEVER THROWS and never blocks: a network miss, a detached HEAD, or a diverged tree all
 * degrade to "did nothing" — a dispatch decision must proceed even when freshening cannot, exactly like every
 * other best-effort read `readItemDeliveryAgentMarker` above already takes.
 *
 * ── THE BUG THIS CLOSES, CONFIRMED BY READING THE REAL DISPATCH CODE, NOT ASSUMED ──────────────────────────────
 *
 * `readItemDeliveryAgentMarker`'s `root` is `REPO_ROOT` by default — ONE fixed, persistent checkout that
 * `we:scripts/operations/dispatch-lane-io.mjs#assertNotALaneCheckout` already guarantees can never be a
 * `lane-<N>` pool clone (that guard runs, and refuses, BEFORE any provider — hence any marker read — is ever
 * reached). So the literal mechanism the live trial's own hypothesis named — "a lane's acquire step resets the
 * lane's working tree... before the dispatch-provider code ever gets to read it" — cannot occur through
 * `build.mjs`/`fix.mjs`/`ci-heal.mjs`: each reads the marker in the PARENT process, strictly before the
 * detached child it spawns ever calls `acquireLane` (`we:scripts/operations/deliver-item-wrapper.mjs`), and the
 * resolved value is threaded through as a plain `--provider=<name>` argv string, immune to whatever that later
 * acquire does to a lane directory the read never touched.
 *
 * The REAL bug is narrower, and it is what the trial actually observed: the marker is invisible to the read
 * unless it is ALREADY on `root`'s own working copy of its tracked branch AT READ TIME. A marker set inside an
 * item's own lane clone — the only place this repo's own convention allows an edit to happen at all
 * (`Edit-Work Runs In A Lane Clone`) — reaches `root` only once its lane's PR lands there, same as `scope:`,
 * `status:`, or any other frontmatter field. But landing it is not sufficient either: nothing previously kept
 * `root`'s OWN on-disk copy current, so a marker that HAD already merged could still be invisible to the very
 * next dispatch decision if `root` itself had gone stale in the meantime — which is why the trial's "the
 * marker can only currently take effect if it's already merged into main" finding is true but incomplete:
 * merged-into-main was never sufficient on its own. Freshening `root` immediately before the read closes that
 * remaining gap, making the marker "readable at the point of dispatch regardless of when it was set", as long
 * as it is on `root`'s own remote branch — the one place it was always going to have to be.
 *
 * NOT WIRED AS `readItemDeliveryAgentMarker`'s OWN DEFAULT, DELIBERATELY. A default that silently shells `git
 * fetch`/`git pull` would fire on every existing caller and test that never named this concern — including
 * every dispatch-provider unit test that calls the bare function against `REPO_ROOT` — mutating a real
 * checkout as a side effect of an unrelated assertion. Instead this is wired ONCE, explicitly, where the real
 * dispatch decision actually happens: `we:scripts/operations/dispatch-lane-io.mjs#createDispatchSinks`'s
 * `freshenCheckout` option (default a no-op, so every existing caller stays byte-identical) and
 * `we:scripts/operations/run.mjs`'s own `dispatch-lane` registration, which passes this function in for real.
 *
 * @param {string} root
 * @param {{run?: (args: string[]) => {status: number, stdout: string, stderr: string}}} [io] - injectable,
 *   mirroring `assertMainNotStale`'s own seam — a test never shells real `git`.
 * @returns {void}
 */
export function defaultFreshenPrimaryCheckout(root, { run = (args) => gitRun(args, { cwd: root }) } = {}) {
  try {
    const head = run(['rev-parse', '--abbrev-ref', 'HEAD']);
    const base = head.status === 0 ? head.stdout.trim() : '';
    if (!base || base === 'HEAD') return; // a detached HEAD, or an unreadable checkout — nothing safe to sync.
    checkMainStaleness({ base, run });
  } catch {
    // Best-effort — see the docblock above. A dispatch decision must proceed even when this cannot.
  }
}
