#!/usr/bin/env node
/**
 * @file scripts/usage-report/usage-report.mjs
 * @description Epic #3383 — a STANDALONE, read-only CLI that answers "how much Anthropic/OpenAI usage and
 * spend has this operator's own org burned, and what's the runway before a limit bites." NOT wired into
 * `runner.mjs`, NOT a dispatch operation, NOT registered in `DISPATCH_PROVIDER_REGISTRY` or any dispatch-
 * related registry, and imported by NOTHING under `scripts/operations/` or `skills-src/conveyor/`. It exists
 * entirely outside the mechanical-dispatcher's own process tree, on purpose — see the THREAT MODEL section
 * below for why that separation is load-bearing, not incidental.
 *
 * ── WHAT THIS CALLS, AND NOTHING ELSE ────────────────────────────────────────────────────────────────────
 * Four hard-coded GET endpoints, confirmed against the providers' own current API reference this session
 * (2026-09, via WebFetch against platform.claude.com and developers.openai.com/openai's own docs — not
 * assumed from training data):
 *   - `GET https://api.anthropic.com/v1/organizations/usage_report/messages` — token usage, RFC 3339-bucketed
 *     (1m/1h/1d), groupable by model/workspace/api key/etc. Requires an Admin API key (`x-api-key`) or an
 *     `org:admin`-scoped OAuth bearer token; UNAVAILABLE for individual (non-organization) Anthropic accounts.
 *   - `GET https://api.anthropic.com/v1/organizations/cost_report` — USD cost, `1d` buckets only.
 *   - `GET https://api.openai.com/v1/organization/usage/completions` — token usage, unix-second buckets
 *     (1m/1h/1d), groupable by project/user/api key/model/etc. Requires an Admin key (an ordinary project API
 *     key is NOT sufficient).
 *   - `GET https://api.openai.com/v1/organization/costs` — USD cost, `1d` buckets only.
 * This file deliberately does NOT build a generic "call any admin endpoint" helper — the four paths above are
 * hard-coded string literals, so there is no code path in this tool that could be pointed at, say, a
 * member-management or key-provisioning admin endpoint by mistake or by a later careless edit.
 *
 * ── PART 1 FINDING, CARRIED HERE SO THE CODE'S OWN SHAPE EXPLAINS ITSELF (full writeup: README.md) ────────
 * NEITHER provider exposes a subscription/billing-cycle RENEWAL date via API. Anthropic's own `/v1/
 * organizations/me` returns only `{id, name}` — no plan/renewal field exists there or anywhere else in the
 * Admin API. OpenAI's billing cycle renews on the calendar day you first subscribed, and that anchor date is
 * dashboard/invoice-only, never returned by any endpoint. What IS real and derivable, and what this tool
 * therefore surfaces instead of a renewal date it cannot get:
 *   - Anthropic's ORG-LEVEL MONTHLY SPEND CAP (a pay-as-you-go usage-tier ceiling, separate from any personal
 *     Claude subscription) resets on a FIXED, computable boundary: 00:00 UTC on the 1st of the next calendar
 *     month — stated in the 429 body you get once you're already capped ("You will regain access on
 *     2026-09-01 at 00:00 UTC"), not proactively queryable, but the boundary itself needs no API call to
 *     compute. `daysUntilNextUtcMonth` below does exactly that, locally, no network.
 *   - The per-minute/per-request `anthropic-ratelimit-*-reset` / `x-ratelimit-reset-*` headers describe a
 *     SHORT, continuously-replenished token-bucket window, not a billing cycle — and, importantly, they are
 *     attached to actual INFERENCE calls (`POST /v1/messages`, `POST /v1/chat/completions`), not to the
 *     metadata GETs this tool makes. This tool therefore does NOT assume those specific header names will be
 *     present on the usage_report/cost_report/costs responses; see `extractRateLimitHeaders` below — it reads
 *     whatever rate-limit-shaped headers a response actually carries, generically, rather than hard-coding an
 *     inference-call header set that may not apply to an admin GET.
 *   - The daily cost-report buckets ARE something this tool can sum itself: `sumAnthropicCost`/`sumOpenAICost`
 *     total the buckets returned, and the CLI's default `--since` window plus `daysUntilNextUtcMonth` together
 *     give "spend so far this cycle" and "days left in the cycle" side by side — the best available proxy for
 *     runway, assembled locally from real numbers rather than a renewal field that does not exist.
 *   - UPDATE (2026-09-13): the operator separately supplied the REAL usage-window renewal schedule for both
 *     providers — no API exposes it, so this is an operator-confirmed fact, not a derivation. Anthropic renews
 *     weekly, every Friday 16:00 America/New_York; OpenAI renews weekly, every Saturday 09:02 (zone assumed
 *     America/New_York — not independently stated for OpenAI). This is DISTINCT from the monthly UTC spend cap
 *     above (a pay-as-you-go org ceiling) — both are surfaced, labeled separately, never conflated. Config
 *     lives in `ANTHROPIC_RENEWAL`/`OPENAI_RENEWAL` (plain, easily-editable objects — a schedule/zone/day may
 *     still change); the DST-aware "time until next renewal" math is `nextWeeklyRenewalUtc`/
 *     `describeWeeklyRenewal` below, built on `Intl.DateTimeFormat` against the IANA zone (no date library —
 *     this repo has none, native-first #75 — following the same `formatToParts`-over-locale-pattern idiom
 *     `scripts/lib/local-date.mjs` already established for zone-aware date handling).
 *
 * ── THE THREAT MODEL AND WHY THE SECRET LIVES WHERE IT DOES ──────────────────────────────────────────────
 * An Anthropic or OpenAI ADMIN key is not a scoped "usage-only" credential — neither provider offers one;
 * whatever admin key exists carries full org-admin power (manage members, keys, workspaces) alongside the
 * usage/cost read this tool needs. This repo's dispatch pipeline has FIVE spawn sites
 * (`deliver-item-wrapper.mjs`, `fix-dispatch-wrapper.mjs`, `ci-heal-dispatch-wrapper.mjs`,
 * `minimal-context-provider.mjs`, `dispatch-lane-io.mjs`) that all spread `{...process.env, ...}` wholesale
 * into every dispatched agent (Claude AND Codex) they spawn — so this key must NEVER exist in the environment
 * of any process that ever spawns a dispatched agent, and never live at a path any of those processes (or the
 * lane clones they work in) can read. Concretely, in order of preference:
 *   1. macOS KEYCHAIN (tried first when available) — `security find-generic-password -s we-usage-report
 *      -a <account> -w`. See README.md for exact setup and an HONEST assessment of what this does and does
 *      not add over a plain file for THIS threat model (a dispatched agent is a same-user-account, same-
 *      machine subprocess — Keychain's per-application ACL identity check does not meaningfully separate it
 *      from this tool's own invocation, since both would run through the same generic `node`/`security`
 *      binaries; what DOES help is creating the item with NO trusted application at all, which forces every
 *      access — this tool's own included — through an interactive OS confirmation prompt. A headless
 *      dispatched agent (no attended GUI session) cannot satisfy that prompt, so it is structurally locked
 *      out in a way a plain file read never is. This is believed-true from documented Keychain ACL semantics;
 *      it was NOT live-tested in this session — see README.md for why (avoiding an unannounced OS prompt on
 *      the operator's own screen) and treat it accordingly, same honesty standard
 *      `we:scripts/lib/isolation-provider.mjs` holds itself to about Codex's own sandbox.
 *   2. The external file, `~/.we-usage-report/.env` (`scripts/lib/usage-report-secret-paths.mjs`) — OUTSIDE
 *      the repo checkout entirely (not `scripts/usage-report/.env`, even gitignored — see that module's own
 *      header for why an in-tree path is never enough). Cross-platform fallback when Keychain is unavailable
 *      (any non-macOS host) or not set up.
 *   3. `process.env.ANTHROPIC_ADMIN_KEY`/`OPENAI_ADMIN_KEY`, already set — ONLY safe because this is a
 *      one-shot standalone process that a dispatched agent never spawns and is never spawned from; see the
 *      `.env.example` header for the explicit warning against sourcing it into a long-lived shell.
 * BOTH the external file's directory and the Keychain service name are ALSO wired into the two real deny
 * surfaces a dispatched agent's own process actually runs under — `we:scripts/guard-bash.mjs` (Claude's Bash
 * tool, re-enabled under `--restricted`) and `we:scripts/operations/codex-delivery-provider.mjs`'s native
 * Codex filesystem deny (OS-enforced Seatbelt, `we:scripts/lib/isolation-provider.mjs`) — defense in depth
 * layered ON TOP of the structural/interactive protections above, never a substitute for them. See
 * `we:scripts/lib/usage-report-secret-paths.mjs`'s own header for the full reasoning.
 *
 * ── PURE / IMPURE SPLIT ──────────────────────────────────────────────────────────────────────────────────
 * Every parser/formatter below (`sumAnthropicUsage`, `sumAnthropicCost`, `sumOpenAIUsage`, `sumOpenAICost`,
 * `extractRateLimitHeaders`, `daysUntilNextUtcMonth`, `nextWeeklyRenewalUtc`, `describeWeeklyRenewal`,
 * `renderSummary`, the `build*Params` argv-shape builders) is PURE — fixture data in, a value out, no
 * fs/network/clock (a clock is passed in explicitly where needed). The tests exercise ONLY these, with
 * recorded fixture JSON shaped exactly like the real
 * response bodies quoted above — never a real network call, per this task's own instruction. All impure I/O
 * (the `security` CLI shell-out, the external `.env` file read, the actual `fetch` calls) is confined to
 * thin wrapper functions the CLI section below composes, injectable so nothing in this file needs live
 * network access to be tested.
 */
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import {
  usageReportSecretEnvPath, USAGE_REPORT_KEYCHAIN_SERVICE, USAGE_REPORT_KEYCHAIN_ACCOUNTS,
} from '../lib/usage-report-secret-paths.mjs';
import { rateFor, usdFromTokens } from '../backlog/cost-rates.mjs';
import { createFileOtelStore } from '../operations/claude-otel-collector.mjs';
import { createFileTelemetryStore } from '../operations/telemetry-store.mjs';

// ── endpoints — hard-coded literals, deliberately not composed from a generic base+path helper ───────────
export const ANTHROPIC_BASE = 'https://api.anthropic.com';
export const ANTHROPIC_USAGE_PATH = '/v1/organizations/usage_report/messages';
export const ANTHROPIC_COST_PATH = '/v1/organizations/cost_report';
export const ANTHROPIC_VERSION = '2023-06-01';

export const OPENAI_BASE = 'https://api.openai.com';
export const OPENAI_USAGE_PATH = '/v1/organization/usage/completions';
export const OPENAI_COST_PATH = '/v1/organization/costs';

// ── weekly usage-window renewal config — DISTINCT from the monthly UTC spend-cap boundary computed by
// `daysUntilNextUtcMonth` below. The spend cap is a pay-as-you-go ORG-LEVEL ceiling; this is the actual
// plan USAGE-WINDOW renewal, i.e. when the operator's real usage allowance resets. Neither provider
// exposes this via API (see this file's header) — these are operator-supplied facts, kept as plain,
// easily-editable config rather than baked into the DST math itself, since a schedule/zone/day may still
// change or be corrected. `cadence: 'weekly'` is the only cadence `describeWeeklyRenewal` below resolves
// today; a different cadence would need its own resolver, not a new field bolted onto this same shape.
/** Confirmed by the operator (2026-09-13): Anthropic's usage window renews every Friday at 16:00,
 *  America/New_York (DST-aware — `nextWeeklyRenewalUtc` below resolves the correct EST/EDT offset for
 *  the target date itself, not for "now"). */
export const ANTHROPIC_RENEWAL = { cadence: 'weekly', dayOfWeek: 'Friday', time: '16:00', timezone: 'America/New_York' };
/** Confirmed by the operator (2026-09-13): OpenAI's usage window renews every Saturday at 09:02. Zone
 *  assumed `America/New_York` — not independently stated for OpenAI, but no other zone was given and
 *  that's the operator's own zone; revisit this assumption if it turns out wrong. */
export const OPENAI_RENEWAL = { cadence: 'weekly', dayOfWeek: 'Saturday', time: '09:02', timezone: 'America/New_York' };

// ── secret loading (impure) ─────────────────────────────────────────────────────────────────────────────

/** A tiny, dependency-free `KEY=VALUE` line reader — this repo has no `dotenv` dependency (native-first, #75)
 *  and pulling one in for two lines would be the opposite of that. Ignores blank lines and `#` comments;
 *  does not attempt quoting/escaping beyond a plain value, which is all `.env.example` ever needs. */
export function parseEnvFile(text) {
  const out = {};
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    if (!key) continue;
    out[key] = line.slice(eq + 1).trim();
  }
  return out;
}

/** Shell out to macOS Keychain for one item. Returns the secret string, or null if the item does not exist /
 *  `security` is unavailable / the platform is not macOS. Never throws — a missing Keychain item is exactly
 *  as normal as a missing file, and this is tried FIRST, before the file even exists on most setups. */
export function readKeychainSecret(account, { platform = process.platform, execFileSyncFn = execFileSync } = {}) {
  if (platform !== 'darwin') return null;
  try {
    const out = execFileSyncFn('security', ['find-generic-password', '-s', USAGE_REPORT_KEYCHAIN_SERVICE, '-a', account, '-w'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    });
    const v = String(out || '').trim();
    return v || null;
  } catch {
    return null;
  }
}

/**
 * The full secret-loading ladder, in the order documented in this file's own header: an already-set env var
 * (this process's own, one-shot) → macOS Keychain → the external `.env` file. Returns which SOURCE each key
 * actually came from too, so the human summary can say so (an operator debugging "why is this empty" needs
 * to know whether Keychain or the file was even tried, not just the end result).
 * @param {object} [o]
 * @param {NodeJS.ProcessEnv} [o.env]
 * @param {string} [o.platform]
 * @param {(account: string, opts?: object) => string|null} [o.readKeychain]
 * @param {(path: string) => boolean} [o.existsSyncFn]
 * @param {(path: string, enc: string) => string} [o.readFileSyncFn]
 */
export function loadSecrets({
  env = process.env, platform = process.platform,
  readKeychain = (account) => readKeychainSecret(account, { platform }),
  existsSyncFn = existsSync, readFileSyncFn = (p) => readFileSync(p, 'utf8'),
} = {}) {
  const fileVars = (() => {
    const path = usageReportSecretEnvPath(env);
    if (!existsSyncFn(path)) return {};
    try { return parseEnvFile(readFileSyncFn(path)); } catch { return {}; }
  })();

  const resolve = (envKey, keychainAccount) => {
    if (env[envKey]) return { value: env[envKey], source: 'env' };
    const kc = readKeychain(keychainAccount);
    if (kc) return { value: kc, source: 'keychain' };
    if (fileVars[envKey]) return { value: fileVars[envKey], source: 'file' };
    return { value: null, source: null };
  };

  const anthropic = resolve('ANTHROPIC_ADMIN_KEY', USAGE_REPORT_KEYCHAIN_ACCOUNTS.anthropic);
  const openai = resolve('OPENAI_ADMIN_KEY', USAGE_REPORT_KEYCHAIN_ACCOUNTS.openai);
  return {
    anthropicKey: anthropic.value, anthropicSource: anthropic.source,
    openaiKey: openai.value, openaiSource: openai.source,
  };
}

// ── request param builders (pure) ───────────────────────────────────────────────────────────────────────

/** Anthropic's usage/cost report query string. Both endpoints share the same param names for what this tool
 *  needs (`starting_at`/`ending_at`/`bucket_width`/`group_by`/`limit`/`page`); the cost endpoint only accepts
 *  `bucket_width=1d`, enforced by the caller passing that literal rather than by this pure builder guessing. */
export function buildAnthropicParams({ startingAt, endingAt, bucketWidth = '1d', groupBy = [], limit, page } = {}) {
  const p = new URLSearchParams();
  if (startingAt) p.set('starting_at', startingAt);
  if (endingAt) p.set('ending_at', endingAt);
  if (bucketWidth) p.set('bucket_width', bucketWidth);
  for (const g of groupBy) p.append('group_by[]', g);
  if (limit) p.set('limit', String(limit));
  if (page) p.set('page', page);
  return p;
}

/** OpenAI's usage/cost query string. `start_time`/`end_time` are UNIX SECONDS (OpenAI's published API
 *  reference, `platform.openai.com/docs/api-reference/usage`) — distinct from Anthropic's RFC 3339 strings. */
export function buildOpenAIParams({ startTime, endTime, bucketWidth = '1d', groupBy = [], limit, page } = {}) {
  const p = new URLSearchParams();
  if (startTime) p.set('start_time', String(startTime));
  if (endTime) p.set('end_time', String(endTime));
  if (bucketWidth) p.set('bucket_width', bucketWidth);
  for (const g of groupBy) p.append('group_by[]', g);
  if (limit) p.set('limit', String(limit));
  if (page) p.set('page', page);
  return p;
}

// ── response parsing (pure) — fixture-shaped exactly like the real bodies quoted in this file's header ────

/** Sum an Anthropic `usage_report/messages` response into totals + a per-model breakdown. `model` is `null`
 *  when the caller did not `group_by=model`; those buckets are folded under the `'(ungrouped)'` key rather
 *  than silently dropped, so a caller who forgot to group still gets a real total. */
export function sumAnthropicUsage(report) {
  const byModel = {};
  let totalInput = 0; let totalOutput = 0; let totalCacheRead = 0;
  for (const bucket of report?.data || []) {
    for (const r of bucket?.results || []) {
      const key = r.model || '(ungrouped)';
      const m = byModel[key] || (byModel[key] = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 });
      const input = Number(r.uncached_input_tokens) || 0;
      const output = Number(r.output_tokens) || 0;
      const cacheRead = Number(r.cache_read_input_tokens) || 0;
      m.inputTokens += input; m.outputTokens += output; m.cacheReadTokens += cacheRead;
      totalInput += input; totalOutput += output; totalCacheRead += cacheRead;
    }
  }
  return { totalInputTokens: totalInput, totalOutputTokens: totalOutput, totalCacheReadTokens: totalCacheRead, byModel };
}

/** Sum an Anthropic `cost_report` response. `amount` is a decimal STRING in the currency's lowest unit (cents
 *  for USD — the API reference's own example: `"123.45"` in `"USD"` means `$1.23`), so this divides by 100. */
export function sumAnthropicCost(report) {
  let totalUsd = 0;
  const byModel = {};
  for (const bucket of report?.data || []) {
    for (const r of bucket?.results || []) {
      const usd = (Number(r.amount) || 0) / 100;
      totalUsd += usd;
      const key = r.model || '(ungrouped)';
      byModel[key] = (byModel[key] || 0) + usd;
    }
  }
  return { totalUsd, byModel };
}

/** Sum an OpenAI `usage/completions` response. Same ungrouped-fold behavior as `sumAnthropicUsage`. */
export function sumOpenAIUsage(report) {
  const byModel = {};
  let totalInput = 0; let totalOutput = 0; let totalCached = 0; let totalRequests = 0;
  for (const bucket of report?.data || []) {
    for (const r of bucket?.results || []) {
      const key = r.model || '(ungrouped)';
      const m = byModel[key] || (byModel[key] = { inputTokens: 0, outputTokens: 0, cachedTokens: 0, requests: 0 });
      const input = Number(r.input_tokens) || 0;
      const output = Number(r.output_tokens) || 0;
      const cached = Number(r.input_cached_tokens) || 0;
      const requests = Number(r.num_model_requests) || 0;
      m.inputTokens += input; m.outputTokens += output; m.cachedTokens += cached; m.requests += requests;
      totalInput += input; totalOutput += output; totalCached += cached; totalRequests += requests;
    }
  }
  return { totalInputTokens: totalInput, totalOutputTokens: totalOutput, totalCachedTokens: totalCached, totalRequests, byModel };
}

/** Sum an OpenAI `costs` response. `amount` is `{ value, currency }` — ALREADY in whole currency units
 *  (OpenAI's own reference example: `value: 0.06, currency: "usd"`), unlike Anthropic's cents-string. */
export function sumOpenAICost(report) {
  let totalUsd = 0;
  const byLineItem = {};
  for (const bucket of report?.data || []) {
    for (const r of bucket?.results || []) {
      const usd = Number(r.amount?.value) || 0;
      totalUsd += usd;
      const key = r.line_item || '(ungrouped)';
      byLineItem[key] = (byLineItem[key] || 0) + usd;
    }
  }
  return { totalUsd, byLineItem };
}

/**
 * Whatever rate-limit-shaped headers a response ACTUALLY carries — generic by design, not a hard-coded
 * inference-call header set (see this file's own header for why: these two endpoints are metadata GETs, not
 * `POST /v1/messages`/`POST /v1/chat/completions`, so the documented `anthropic-ratelimit-tokens-*` /
 * `x-ratelimit-tokens-*` families may simply not be present here). `headers` is a plain lowercased-key record
 * (the CLI section lowercases a real `Headers` object before calling this, since `Headers` iteration already
 * yields lowercase names — kept a plain object here so this stays pure and fixture-testable with no DOM/undici
 * type in the test file).
 * @param {Record<string,string>} headers
 * @param {string[]} prefixes - header name prefixes to keep, e.g. `['anthropic-ratelimit-', 'retry-after']`.
 */
export function extractRateLimitHeaders(headers, prefixes) {
  const out = {};
  for (const [k, v] of Object.entries(headers || {})) {
    if (prefixes.some((p) => k === p || k.startsWith(p))) out[k] = v;
  }
  return out;
}

/** Anthropic's org-level monthly SPEND CAP resets at a fixed, computable boundary (00:00 UTC on the 1st of
 *  the next calendar month) — see this file's own header for why that is the honest substitute for a renewal
 *  date neither provider exposes via API. Pure given `now`. Returns whole days remaining (rounds down) plus
 *  the boundary itself as an ISO string, so a caller can show both "how many days" and "resets exactly when". */
export function daysUntilNextUtcMonth(now = new Date()) {
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0));
  const msRemaining = nextMonthStart.getTime() - now.getTime();
  return { days: Math.floor(msRemaining / 86400000), resetsAt: nextMonthStart.toISOString() };
}

// ── weekly usage-window renewal (DST-aware) — computes the REAL "usage window renews" instant for
// `ANTHROPIC_RENEWAL`/`OPENAI_RENEWAL` above, distinct from the monthly UTC spend-cap boundary above this
// comment. No date library: this repo has none (native-first, #75) and `scripts/lib/local-date.mjs`
// already establishes the pattern this follows — resolve everything through `Intl.DateTimeFormat` against
// the IANA zone name, read wall-clock components back via `formatToParts` (never a locale's default
// pattern, which can silently degrade on a small-icu Node), and never hard-code a fixed UTC offset for a
// zone that has two of them (EST/EDT) depending on the calendar date.

/** The IANA zone's UTC offset in ms (east-positive) AT a given instant — the one DST-aware primitive
 *  everything below composes. Formats `instant` in `timeZone`, reads the wall-clock parts back as if they
 *  were themselves a UTC instant, and the difference from the real instant IS the zone's offset at that
 *  moment (negative for America/New_York: -18000000ms in EST, -14400000ms in EDT). */
function zoneOffsetMs(instant, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(instant).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  const asUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second),
  );
  return asUtc - instant.getTime();
}

/** Convert a WALL-CLOCK date+time as read in `timeZone` (e.g. "2026-09-18 16:00" America/New_York) to the
 *  real UTC instant it names — the DST-aware inverse of `zoneOffsetMs`. Two passes: right around a DST
 *  transition the offset at the naive guess and the offset at the real instant can differ by exactly one
 *  hour, and re-deriving the guess from the corrected offset is enough to converge (the zone only ever
 *  has two possible offsets, so it never needs a third pass). */
function zonedWallClockToUtc(y, m, d, hour, minute, timeZone) {
  let utcMs = Date.UTC(y, m - 1, d, hour, minute, 0);
  for (let i = 0; i < 2; i += 1) utcMs = Date.UTC(y, m - 1, d, hour, minute, 0) - zoneOffsetMs(new Date(utcMs), timeZone);
  return new Date(utcMs);
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** The next occurrence, at or after `now`, of a weekly renewal described as `{ dayOfWeek, time, timezone }`
 *  (`time` is zone-local 24h `HH:MM`). Pure given `now`. DST-SAFE BY CONSTRUCTION: the target day's own
 *  wall-clock-to-UTC conversion resolves the IANA zone's offset AT THE TARGET DATE (via `zoneOffsetMs`
 *  called on a guess already anchored to that date), never at "now" — so a renewal whose upcoming week
 *  straddles a spring-forward/fall-back transition still lands on the correct zone-local hour instead of
 *  drifting by the one-hour shift. */
export function nextWeeklyRenewalUtc(now, { dayOfWeek, time, timezone }) {
  const targetDow = WEEKDAYS.indexOf(dayOfWeek);
  if (targetDow < 0) throw new Error(`nextWeeklyRenewalUtc: dayOfWeek "${dayOfWeek}" is not a weekday name`);
  const [hour, minute] = String(time).split(':').map(Number);

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  const nowDow = WEEKDAYS.indexOf(parts.weekday);
  const y = Number(parts.year); const m = Number(parts.month); const d = Number(parts.day);

  // Advance the ZONE-LOCAL calendar date by `days` (plain Gregorian arithmetic via Date.UTC — this is
  // calendar-day rollover, not an instant, so it needs no timezone awareness itself) then resolve that
  // rolled-over date's own wall-clock target time to a real UTC instant.
  const advance = (days) => {
    const rolled = new Date(Date.UTC(y, m - 1, d + days));
    return zonedWallClockToUtc(rolled.getUTCFullYear(), rolled.getUTCMonth() + 1, rolled.getUTCDate(), hour, minute, timezone);
  };

  const daysToTarget = (targetDow - nowDow + 7) % 7;
  let target = advance(daysToTarget);
  if (target.getTime() <= now.getTime()) target = advance(daysToTarget + 7); // today's own occurrence already passed
  return target;
}

/** Render a resolved renewal instant as a short zone-local label, e.g. "Friday 2026-09-18 16:00 EDT" — the
 *  zone abbreviation (`timeZoneName: 'short'`) is what actually proves DST was handled correctly to a
 *  reader: EDT vs EST on either side of a transition, not a UTC instant they'd have to convert by hand. */
function formatZonedRenewalLabel(instant, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short',
  }).formatToParts(instant).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  return `${parts.weekday} ${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute} ${parts.timeZoneName}`;
}

/**
 * The full "time until next usage-window renewal" for one provider — pure given `now`. `renewalConfig` is
 * one of `ANTHROPIC_RENEWAL`/`OPENAI_RENEWAL` above, or `null` for a provider whose renewal window is not
 * yet known/confirmed — this then returns `null` rather than guessing, so a future provider (or a value
 * reverted to unknown) degrades to "not shown" instead of a fabricated countdown.
 * @returns {{resetsAt: string, label: string, days: number, hours: number, minutes: number}|null}
 */
export function describeWeeklyRenewal(renewalConfig, now = new Date()) {
  if (!renewalConfig) return null;
  if (renewalConfig.cadence !== 'weekly') throw new Error(`describeWeeklyRenewal: unsupported cadence "${renewalConfig.cadence}"`);
  const target = nextWeeklyRenewalUtc(now, renewalConfig);
  const totalMinutes = Math.floor((target.getTime() - now.getTime()) / 60000);
  return {
    resetsAt: target.toISOString(),
    label: formatZonedRenewalLabel(target, renewalConfig.timezone),
    days: Math.floor(totalMinutes / 1440),
    hours: Math.floor((totalMinutes % 1440) / 60),
    minutes: totalMinutes % 60,
  };
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════
// SELF-TRACKED USAGE LEDGER (epic #3383) — "how much have WE used this cycle," answered from what THIS
// system's own dispatched agents and this operator's own Claude Code sessions actually consumed, reconciled
// against the renewal windows above. This is a SELF-TRACKED ESTIMATE, explicitly labeled as such everywhere
// it is rendered (see `renderLedgerSummary`) — never confused with the Admin-API path above, which stays in
// this file unchanged for OpenAI or for if the operator's Anthropic account situation changes.
//
// TWO SOURCES, DIFFERENT PROVENANCE, NEVER MERGED SILENTLY:
//   - ANTHROPIC (Claude): Claude Code's own OFFICIAL OpenTelemetry export (`claude_code.token.usage` /
//     `claude_code.cost.usage`), ingested by `scripts/operations/claude-otel-collector.mjs` into its own
//     day-rotated store. This is REAL harness-reported data covering EVERY Claude Code process on this
//     machine once `~/.claude/settings.json`'s `env` block is wired — the interactive orchestrating session
//     included, not just this repo's own dispatched agents — which is why it supersedes the earlier plan (see
//     that file's own header) to reconstruct Claude usage from a dispatched agent's own stdout: that path
//     could only ever have covered agents THIS repo spawns.
//   - OPENAI (Codex): no equivalent official export exists, so this reads this repo's OWN self-tracked
//     `dispatch.tokens.*` telemetry metrics (`scripts/operations/telemetry-store.mjs#recordTokenUsage`),
//     recorded per real Codex dispatch from that CLI's own `--json` stdout (`codex-delivery-provider.mjs`).
//     This ONLY covers Codex turns this repo's own wrappers spawn — there is no interactive-session
//     equivalent to reconcile against, since this repo has no interactive Codex orchestrator.
//
// DOLLAR CONVERSION: Claude's own `claude_code.cost.usage` sum IS the primary dollar figure — it is the
// provider's own SDK computing cost from the exact rates it billed, not a re-derivation. `cost-rates.mjs`'s
// table (reused, never duplicated — the operator's own instruction) is applied ADDITIONALLY to the same
// token counts as a cross-check line, so a reader can see the two agree (or flag it if a rate table goes
// stale). For Codex, `cost-rates.mjs` has no OpenAI-model rows by design (it is documented as "THE CANONICAL
// CLAUDE usage-equivalent rate table") — `rateFor` returns `null` for a Codex model id, and this ledger
// reports that side's dollar estimate as `null` ("not available"), never a silent `0` that would read as "no
// cost" — the same honesty convention `codex-judge-spawn.mjs#parseCodexJudgeOutcome` already uses for Codex's
// own missing cost figure ("no USD figure exists anywhere in Codex's output... reported as 0, never
// estimated" — here surfaced as `null` rather than `0` specifically so a renderer can tell "zero dollars"
// from "no rate table row exists to compute one").
//
// PURE / IMPURE SPLIT, same convention as the rest of this file: every function below takes an already-read
// array of store RECORDS (plain objects) and a window — no fs, no network, no clock except what is passed
// in. The CLI section further down does the actual file reads.
// ════════════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * The PREVIOUS occurrence, at or before `now`, of a weekly renewal described the same way
 * {@link nextWeeklyRenewalUtc} takes its config — "how long ago did the current usage cycle start." Mirrors
 * that function's own DST-safe construction exactly (same `advance`/`zonedWallClockToUtc` primitives, walking
 * the zone-local calendar date backward instead of forward) rather than subtracting a fixed
 * `7 * 24 * 3600 * 1000` ms from `nextWeeklyRenewalUtc`'s own result — a fixed-ms subtraction lands on the
 * WRONG wall-clock hour whenever a DST transition falls between the two occurrences (the zone's UTC offset
 * differs by exactly one hour on either side), which is exactly the failure mode this file's own DST
 * machinery exists to avoid elsewhere.
 * @param {Date} now
 * @param {{dayOfWeek: string, time: string, timezone: string}} config
 * @returns {Date}
 */
export function previousWeeklyRenewalUtc(now, { dayOfWeek, time, timezone }) {
  const targetDow = WEEKDAYS.indexOf(dayOfWeek);
  if (targetDow < 0) throw new Error(`previousWeeklyRenewalUtc: dayOfWeek "${dayOfWeek}" is not a weekday name`);
  const [hour, minute] = String(time).split(':').map(Number);

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  const nowDow = WEEKDAYS.indexOf(parts.weekday);
  const y = Number(parts.year); const m = Number(parts.month); const d = Number(parts.day);

  const advance = (days) => {
    const rolled = new Date(Date.UTC(y, m - 1, d + days));
    return zonedWallClockToUtc(rolled.getUTCFullYear(), rolled.getUTCMonth() + 1, rolled.getUTCDate(), hour, minute, timezone);
  };

  const daysSinceTarget = (nowDow - targetDow + 7) % 7;
  let target = advance(-daysSinceTarget);
  if (target.getTime() > now.getTime()) target = advance(-daysSinceTarget - 7); // today's own occurrence hasn't happened yet
  return target;
}

/**
 * Sum a window of already-read `claude-otel-collector.mjs` store records into per-model token/cost totals.
 * PURE — `events` is the plain array `createFileOtelStore().readAll()` (or its memory twin) returns; this
 * never touches fs itself. `sinceIso`/`untilIso` bound on each record's own `receivedAt` (half-open:
 * `since <= receivedAt < until`).
 * @param {Array<object>} events
 * @param {{sinceIso: string, untilIso: string}} window
 * @returns {{totalsByType: Record<string, number>, totalUsd: number, byModel: Record<string, {input:number, output:number, cacheRead:number, cacheCreation:number, usd:number, estimatedUsd:number}>}}
 */
export function sumClaudeOtelUsage(events, { sinceIso, untilIso }) {
  const since = Date.parse(sinceIso);
  const until = Date.parse(untilIso);
  const totalsByType = { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 };
  let totalUsd = 0;
  const byModel = {};
  const ensure = (model) => (byModel[model] ||= { input: 0, output: 0, cacheRead: 0, cacheCreation: 0, usd: 0, estimatedUsd: 0 });

  for (const e of Array.isArray(events) ? events : []) {
    const t = Date.parse(e?.receivedAt);
    if (!Number.isFinite(t) || t < since || t >= until) continue;
    const model = (e?.attributes && e.attributes.model) || '(unknown)';
    if (e?.name === 'claude_code.token.usage') {
      const type = e?.attributes && e.attributes.type;
      const value = Number(e.value) || 0;
      if (type === 'input' || type === 'output' || type === 'cacheRead' || type === 'cacheCreation') {
        totalsByType[type] += value;
        ensure(model)[type] += value;
      }
    } else if (e?.name === 'claude_code.cost.usage') {
      const value = Number(e.value) || 0;
      totalUsd += value;
      ensure(model).usd += value;
    }
  }
  for (const [model, m] of Object.entries(byModel)) {
    m.estimatedUsd = usdFromTokens({ in: m.input, cw: m.cacheCreation, cr: m.cacheRead, out: m.output }, model);
  }
  return { totalsByType, totalUsd, byModel };
}

/**
 * Sum a window of already-read `telemetry-store.mjs` events into per-model token totals for ONE provider tag
 * (default `'codex'` — see this section's own header for why Claude does not use this path). PURE — `events`
 * is `createFileTelemetryStore().readAll()`'s plain array (or its memory twin); filters to
 * `event === 'metric'`, `name` one of the four `dispatch.tokens.*` names, and `attributes.provider === provider`.
 * @param {Array<object>} events
 * @param {{sinceIso: string, untilIso: string, provider?: string}} window
 * @returns {{totalsByType: Record<string, number>, byModel: Record<string, {input:number, output:number, cacheRead:number, cacheWrite:number, estimatedUsd: (number|null)}>}}
 */
export function sumProviderTokenTelemetry(events, { sinceIso, untilIso, provider = 'codex' }) {
  const since = Date.parse(sinceIso);
  const until = Date.parse(untilIso);
  const NAME_TO_TYPE = {
    'dispatch.tokens.input': 'input',
    'dispatch.tokens.output': 'output',
    'dispatch.tokens.cache_read': 'cacheRead',
    'dispatch.tokens.cache_write': 'cacheWrite',
  };
  const totalsByType = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const byModel = {};
  const ensure = (model) => (byModel[model] ||= { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, estimatedUsd: null });

  for (const e of Array.isArray(events) ? events : []) {
    if (e?.event !== 'metric') continue;
    const type = NAME_TO_TYPE[e?.name];
    if (!type) continue;
    if ((e?.attributes && e.attributes.provider) !== provider) continue;
    const ts = Date.parse(e?.timestamp);
    if (!Number.isFinite(ts) || ts < since || ts >= until) continue;
    const model = (e?.attributes && e.attributes.model) || '(unknown)';
    const value = Number(e.value) || 0;
    totalsByType[type] += value;
    ensure(model)[type] += value;
  }
  for (const [model, m] of Object.entries(byModel)) {
    // `rateFor` returns `null` for a model `cost-rates.mjs` has no row for (every Codex/OpenAI model, by
    // design — see this section's header) — `estimatedUsd` stays `null` ("not available"), never a silent
    // `0` that would read as "this cost nothing."
    m.estimatedUsd = rateFor(model) ? usdFromTokens({ in: m.input, cw: m.cacheWrite, cr: m.cacheRead, out: m.output }, model) : null;
  }
  return { totalsByType, byModel };
}

/**
 * Assemble the full two-provider ledger for the CURRENT cycle (since each provider's own last renewal
 * boundary, through `now`). PURE given already-read event arrays for both sources.
 * @param {{now: Date, claudeOtelEvents: Array<object>, codexTelemetryEvents: Array<object>}} o
 * @returns {object}
 */
export function buildUsageLedger({ now, claudeOtelEvents = [], codexTelemetryEvents = [] }) {
  const anthropicWindowStart = previousWeeklyRenewalUtc(now, ANTHROPIC_RENEWAL);
  const openaiWindowStart = previousWeeklyRenewalUtc(now, OPENAI_RENEWAL);
  const nowIso = now.toISOString();
  return {
    generatedAt: nowIso,
    anthropic: {
      windowStart: anthropicWindowStart.toISOString(),
      windowEnd: nowIso,
      usage: sumClaudeOtelUsage(claudeOtelEvents, { sinceIso: anthropicWindowStart.toISOString(), untilIso: nowIso }),
    },
    openai: {
      windowStart: openaiWindowStart.toISOString(),
      windowEnd: nowIso,
      usage: sumProviderTokenTelemetry(codexTelemetryEvents, { sinceIso: openaiWindowStart.toISOString(), untilIso: nowIso, provider: 'codex' }),
    },
  };
}

/** Render the ledger as text (or return it as-is for `--json`) — every line is labeled a SELF-TRACKED
 *  ESTIMATE, never phrased as an official provider figure, per this section's own header. */
export function renderLedgerSummary(ledger) {
  const L = [];
  L.push(`usage-ledger (self-tracked estimate of what THIS system consumed — generated ${ledger.generatedAt})`);
  L.push('NOT an official provider-reported figure. See usage-report.mjs\'s own header for the Admin-API path this supplements.');
  L.push('');

  L.push(`ANTHROPIC (Claude) — since ${ledger.anthropic.windowStart} (this cycle's renewal boundary)`);
  L.push('  source: Claude Code\'s own OpenTelemetry export (claude_code.token.usage / claude_code.cost.usage), via claude-otel-collector.mjs');
  const au = ledger.anthropic.usage;
  L.push(`  tokens — input ${fmtNum(au.totalsByType.input)}, output ${fmtNum(au.totalsByType.output)}, cache-read ${fmtNum(au.totalsByType.cacheRead)}, cache-creation ${fmtNum(au.totalsByType.cacheCreation)}`);
  L.push(`  cost — ${fmtUsd(au.totalUsd)} (Claude Code's own reported cost)`);
  for (const [model, m] of Object.entries(au.byModel)) {
    L.push(`    ${model.padEnd(28)} in ${fmtNum(m.input).padStart(9)}  out ${fmtNum(m.output).padStart(9)}  cost ${fmtUsd(m.usd).padStart(9)}  (cost-rates.mjs cross-check: ${fmtUsd(m.estimatedUsd)})`);
  }
  L.push('');

  L.push(`OPENAI (Codex) — since ${ledger.openai.windowStart} (this cycle's renewal boundary)`);
  L.push('  source: this repo\'s own dispatch.tokens.* telemetry, recorded per Codex dispatch (build/fix/ci-heal only — no interactive Codex orchestrator to reconcile)');
  const ou = ledger.openai.usage;
  L.push(`  tokens — input ${fmtNum(ou.totalsByType.input)}, output ${fmtNum(ou.totalsByType.output)}, cache-read ${fmtNum(ou.totalsByType.cacheRead)}, cache-write ${fmtNum(ou.totalsByType.cacheWrite)}`);
  for (const [model, m] of Object.entries(ou.byModel)) {
    L.push(`    ${model.padEnd(28)} in ${fmtNum(m.input).padStart(9)}  out ${fmtNum(m.output).padStart(9)}  cost ${m.estimatedUsd == null ? 'not available (no cost-rates.mjs row for this model)' : fmtUsd(m.estimatedUsd)}`);
  }
  if (!Object.keys(ou.byModel).length) L.push('  (no Codex dispatches recorded this cycle)');
  L.push('');
  return L.join('\n');
}

// ── formatting (pure) — style mirrors we:scripts/operations/telemetry-cli.mjs's fmtMs/fmtBytes/pct helpers ─

export function fmtNum(n) {
  if (!Number.isFinite(n)) return '—';
  return Math.round(n).toLocaleString('en-US');
}

export function fmtUsd(n) {
  if (!Number.isFinite(n)) return '—';
  return `$${n.toFixed(2)}`;
}

/** Render the full two-provider summary as text, or return the same data as-is for `--json`. PURE — takes
 *  the already-computed sums/rate-limit-header maps/secret sources, never touches fs/network itself. */
export function renderSummary(result) {
  const L = [];
  L.push(`usage-report — generated ${result.generatedAt}`);
  L.push('');

  const cap = daysUntilNextUtcMonth(new Date(result.generatedAt));
  L.push(`Anthropic org-level MONTHLY SPEND CAP resets ${cap.resetsAt} (${cap.days} day(s) from now, UTC calendar month) — a pay-as-you-go org ceiling, DISTINCT from the actual usage-window renewal below (see this tool's own header).`);
  L.push('');

  const anthropicRenewal = describeWeeklyRenewal(ANTHROPIC_RENEWAL, new Date(result.generatedAt));
  const openaiRenewal = describeWeeklyRenewal(OPENAI_RENEWAL, new Date(result.generatedAt));
  L.push(anthropicRenewal
    ? `Anthropic usage window renews: ${anthropicRenewal.label} (in ${anthropicRenewal.days}d ${anthropicRenewal.hours}h) — the actual plan usage-window renewal, distinct from the monthly spend cap above.`
    : 'Anthropic usage window renewal: not yet known — ANTHROPIC_RENEWAL is unset.');
  L.push(openaiRenewal
    ? `OpenAI usage window renews: ${openaiRenewal.label} (in ${openaiRenewal.days}d ${openaiRenewal.hours}h).`
    : 'OpenAI usage window renewal: not yet known — pending; see OPENAI_RENEWAL in usage-report.mjs.');
  L.push('');

  for (const provider of ['anthropic', 'openai']) {
    const p = result[provider];
    L.push(provider.toUpperCase());
    if (!p.keyConfigured) {
      L.push(`  (no admin key configured — set ${provider === 'anthropic' ? 'ANTHROPIC_ADMIN_KEY' : 'OPENAI_ADMIN_KEY'}; see README.md)`);
      L.push('');
      continue;
    }
    L.push(`  admin key source: ${p.keySource}`);
    if (p.usageError) L.push(`  usage: ERROR — ${p.usageError}`);
    else if (p.usage) {
      const u = p.usage;
      L.push(`  usage — input ${fmtNum(u.totalInputTokens)} tok, output ${fmtNum(u.totalOutputTokens)} tok`
        + (u.totalCacheReadTokens ? `, cache-read ${fmtNum(u.totalCacheReadTokens)} tok` : '')
        + (u.totalRequests ? `, ${fmtNum(u.totalRequests)} requests` : ''));
      for (const [model, m] of Object.entries(u.byModel)) {
        L.push(`    ${model.padEnd(24)} in ${fmtNum(m.inputTokens).padStart(10)}  out ${fmtNum(m.outputTokens).padStart(10)}`);
      }
    }
    if (p.costError) L.push(`  cost: ERROR — ${p.costError}`);
    else if (p.cost) L.push(`  cost — ${fmtUsd(p.cost.totalUsd)} total this window`);
    const rl = p.rateLimitHeaders || {};
    L.push(Object.keys(rl).length
      ? `  rate-limit headers on this response: ${Object.entries(rl).map(([k, v]) => `${k}=${v}`).join(', ')}`
      : '  rate-limit headers on this response: (none — expected; these are metadata GETs, not inference calls)');
    L.push('');
  }
  return L.join('\n');
}

// ── CLI (impure) ────────────────────────────────────────────────────────────────────────────────────────

const USAGE = 'usage: usage-report.mjs [--since=<hours>] [--json] | --ledger [--json]';

/** Lowercase every header name from a real `Headers` object (or a plain record) into a plain object, so the
 *  pure `extractRateLimitHeaders` above never has to know about the `Headers` API. */
function headersToRecord(headers) {
  const out = {};
  if (headers && typeof headers.forEach === 'function') { headers.forEach((v, k) => { out[k.toLowerCase()] = v; }); return out; }
  for (const [k, v] of Object.entries(headers || {})) out[String(k).toLowerCase()] = v;
  return out;
}

/** One provider's usage+cost fetch, composed from the injectable `fetchFn` so nothing here needs a live
 *  network to be exercised by a test — the CLI entrypoint below is the only caller that supplies the real
 *  global `fetch`. Returns the exact shape `renderSummary` consumes for this one provider. */
async function fetchProviderSummary({
  keyConfigured, keySource, usageUrl, costUrl, headers, rateLimitPrefixes, sumUsageFn, sumCostFn, fetchFn,
}) {
  if (!keyConfigured) return { keyConfigured: false };
  const out = { keyConfigured: true, keySource };
  try {
    const res = await fetchFn(usageUrl, { headers });
    const body = await res.json();
    if (!res.ok) out.usageError = `HTTP ${res.status} — ${body?.error?.message || JSON.stringify(body)}`;
    else { out.usage = sumUsageFn(body); out.rateLimitHeaders = extractRateLimitHeaders(headersToRecord(res.headers), rateLimitPrefixes); }
  } catch (e) { out.usageError = String(e?.message || e); }
  try {
    const res = await fetchFn(costUrl, { headers });
    const body = await res.json();
    if (!res.ok) out.costError = `HTTP ${res.status} — ${body?.error?.message || JSON.stringify(body)}`;
    else out.cost = sumCostFn(body);
  } catch (e) { out.costError = String(e?.message || e); }
  return out;
}

/**
 * The argv driver, exported so a test can inject `fetchFn`/`loadSecretsFn`/`now` and assert the RENDERED
 * output against fixture data with no real network call — mirrors `we:scripts/operations/telemetry-cli.mjs
 * #runTelemetryCli`'s injectable shape.
 */
export async function runUsageReportCli(argv, {
  loadSecretsFn = loadSecrets, fetchFn = fetch, now = () => new Date(),
  out = (s) => process.stdout.write(s),
} = {}) {
  const json = argv.includes('--json');
  const hoursFlag = argv.find((a) => a.startsWith('--since='));
  const hours = hoursFlag ? Number(hoursFlag.slice('--since='.length)) || 24 : 24;
  if (argv.includes('--help') || argv.includes('-h')) { out(`${USAGE}\n`); return 0; }

  // ── --ledger mode (epic #3383) — the SELF-TRACKED usage ledger, entirely local: no Admin API call, no
  // secrets, no network. Reads the two local stores this file's own header describes and renders/returns the
  // ledger this section builds. Separate branch, not folded into the network path above, because the two
  // answer genuinely different questions ("what does the provider's own billing say" vs "what did THIS
  // system itself observe") and must never be composed into one number.
  if (argv.includes('--ledger')) {
    const nowDate = now();
    const claudeOtelEvents = createFileOtelStore().readAll();
    const codexTelemetryEvents = createFileTelemetryStore().readAll();
    const ledger = buildUsageLedger({ now: nowDate, claudeOtelEvents, codexTelemetryEvents });
    out(json ? `${JSON.stringify(ledger, null, 2)}\n` : `${renderLedgerSummary(ledger)}\n`);
    return 0;
  }

  const secrets = loadSecretsFn();
  const nowDate = now();
  const startingAt = new Date(nowDate.getTime() - hours * 3600000);
  const bucketWidth = hours <= 24 ? '1h' : '1d';

  const anthropicUsageParams = buildAnthropicParams({ startingAt: startingAt.toISOString(), endingAt: nowDate.toISOString(), bucketWidth, groupBy: ['model'] });
  const anthropicCostParams = buildAnthropicParams({ startingAt: startingAt.toISOString(), endingAt: nowDate.toISOString(), bucketWidth: '1d', groupBy: ['description'] });
  const openaiUsageParams = buildOpenAIParams({ startTime: Math.floor(startingAt.getTime() / 1000), endTime: Math.floor(nowDate.getTime() / 1000), bucketWidth, groupBy: ['model'] });
  const openaiCostParams = buildOpenAIParams({ startTime: Math.floor(startingAt.getTime() / 1000), endTime: Math.floor(nowDate.getTime() / 1000), bucketWidth: '1d' });

  const [anthropic, openai] = await Promise.all([
    fetchProviderSummary({
      keyConfigured: Boolean(secrets.anthropicKey), keySource: secrets.anthropicSource,
      usageUrl: `${ANTHROPIC_BASE}${ANTHROPIC_USAGE_PATH}?${anthropicUsageParams}`,
      costUrl: `${ANTHROPIC_BASE}${ANTHROPIC_COST_PATH}?${anthropicCostParams}`,
      headers: { 'x-api-key': secrets.anthropicKey, 'anthropic-version': ANTHROPIC_VERSION },
      rateLimitPrefixes: ['anthropic-ratelimit-', 'anthropic-priority-', 'retry-after'],
      sumUsageFn: sumAnthropicUsage, sumCostFn: sumAnthropicCost, fetchFn,
    }),
    fetchProviderSummary({
      keyConfigured: Boolean(secrets.openaiKey), keySource: secrets.openaiSource,
      usageUrl: `${OPENAI_BASE}${OPENAI_USAGE_PATH}?${openaiUsageParams}`,
      costUrl: `${OPENAI_BASE}${OPENAI_COST_PATH}?${openaiCostParams}`,
      headers: { authorization: `Bearer ${secrets.openaiKey}` },
      rateLimitPrefixes: ['x-ratelimit-', 'retry-after'],
      sumUsageFn: sumOpenAIUsage, sumCostFn: sumOpenAICost, fetchFn,
    }),
  ]);

  const result = {
    generatedAt: nowDate.toISOString(), sinceHours: hours,
    monthlySpendCap: daysUntilNextUtcMonth(nowDate),
    anthropicRenewal: describeWeeklyRenewal(ANTHROPIC_RENEWAL, nowDate),
    openaiRenewal: describeWeeklyRenewal(OPENAI_RENEWAL, nowDate),
    anthropic, openai,
  };
  out(json ? `${JSON.stringify(result, null, 2)}\n` : `${renderSummary(result)}\n`);
  return 0;
}

const IS_CLI = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (IS_CLI) {
  runUsageReportCli(process.argv.slice(2)).then((code) => { process.exitCode = code; }).catch((e) => {
    process.stderr.write(`error: ${String(e?.message || e)}\n`);
    process.exitCode = 1;
  });
}
