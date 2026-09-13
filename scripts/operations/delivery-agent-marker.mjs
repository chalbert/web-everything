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

/** The frontmatter key itself — named once so a grep for the marker's spelling has exactly one hit. */
export const DELIVERY_AGENT_MARKER_KEY = 'deliveryAgent';

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
