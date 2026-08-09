/**
 * output-mix.mjs — the weekly product-vs-machinery output ratio (item `xzgt6zd`, #3012).
 *
 * WHAT IT ANSWERS. "How many lines did we add to the PRODUCT this week, and how many to the DELIVERY
 * MACHINERY and backlog bookkeeping?" One standing pair of numbers, with the four completed weeks before it,
 * so a slide in product output is visible the week it starts instead of at the next audit.
 *
 * WHY IT IS A SEPARATE MODULE FROM THE BOARD. The board owns rendering; this owns the derivation. The split
 * is what makes the number testable without spawning the CLI, and what lets anyone re-derive it by hand.
 *
 * ── The classification is DATA, not code ─────────────────────────────────────────────────────────────────
 *
 * Every path is charged to `product`, `machinery` or `other` by the ordered, first-match-wins rule list in
 * `we:scripts/lib/output-mix-paths.json`. That file is the whole classifier: it is committed, it explains
 * each rule in one line, and disagreeing with the number means editing one rule's `class` — never patching a
 * regex in here. `classifyPath()` returns the matching rule's `why`, so "why is this file machinery?" always
 * has a one-line answer that came from the file rather than from a maintainer's memory.
 *
 * The treatments that would otherwise be silent are all stated in that file's `conventions` block: test
 * lines count with the thing they test, generated files and lockfiles are `other` (nobody authored them),
 * vendored code is `other` (it is another repo's output), and anything unmatched falls to `other`. `other`
 * is REPORTED, not hidden — a large remainder means the rule list has a gap, and the reader can see it.
 *
 * THE GAP IS REAL TODAY, and it is not symmetric. Read `conventions.knownGap` in the rule list before
 * quoting the `product` figure: machinery is matched in all nine of its homes, product in four, and the
 * standard's own declarations (`contracts/`, `capabilities/`, `conformance-vectors/`, `webcases/`, the
 * per-domain contract trees) sit in ~50 directories no rule names, so they land in `other`. `product` is a
 * LOWER bound and the machinery:product ratio an UPPER one until those directories are ruled. The coverage
 * ratchet in `__tests__/output-mix.test.mjs` pins exactly which directories those are.
 *
 * ── Weeks are ISO weeks in UTC, and that is what makes it reproducible ───────────────────────────────────
 *
 * Buckets are Monday-00:00-UTC ISO weeks, and commit dates are read in UTC (`TZ=UTC` + `--date=format-local`)
 * so the boundary and the timestamps are on the SAME clock. This is deliberately NOT the operator-local rule
 * that backlog frontmatter follows (`we:scripts/lib/local-date.mjs`, #2747): this is a git-history metric, not
 * a calendar stamp for a human, and mixing an operator-local boundary with UTC commit dates is exactly the
 * class of bug #2987 records. The consequence worth knowing: the four COMPLETED weeks have frozen boundaries,
 * so any two people re-running this against the same commits get identical numbers for them. Only the current
 * week grows, because it is still happening.
 *
 * ── What is counted ─────────────────────────────────────────────────────────────────────────────────────
 *
 * ADDED lines only, from `git log --no-merges --numstat` over everything reachable from HEAD, bucketed by
 * COMMITTER date (when the work landed, not when it was first typed). Additions only, because the metric is
 * output, not churn — a big deletion is not negative product. Merge commits are skipped so their contents are
 * not double-counted against the lane commits they carry.
 *
 * `-z` is not an optimisation, it is a correctness requirement: this repo renames files constantly (every
 * JIT-numbered backlog card is a rename), and the human-readable numstat spells a rename as
 * `a/{old => new}/b`, which no naive split on TAB can resolve. Under `-z` a rename is emitted as
 * `adds\tdels\t\0<old>\0<new>\0`, so the NEW path is read positionally and never guessed.
 *
 * DEGRADATION. `git` failing must not lose the page, so `computeOutputMix()` returns `fresh: false` with a
 * reason instead of throwing. There is deliberately NO cache behind it (unlike the board's `gh` half): this
 * reads the LOCAL repository, so a failure means the repository itself is unavailable, and a cached number
 * from a different tree would be a confident-looking lie rather than a useful fallback.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, '..', '..');
export const RULES_PATH = join(HERE, 'output-mix-paths.json');

/** The three buckets every line lands in. `other` is a real answer, not a leftover — see the rules file. */
export const CLASSES = Object.freeze(['product', 'machinery', 'other']);

/** How many weeks the board shows: the current (partial) one plus the four completed weeks beside it. */
export const WEEK_COUNT = 5;

// ── The rule list ─────────────────────────────────────────────────────────────

/**
 * `**` spans separators, `*` stops at one, everything else is literal. Anchored at both ends so `src/**`
 * cannot match `vendor/src/x` — a half-anchored pattern is how a classifier quietly starts over-counting.
 */
export function patternToRegExp(pattern) {
  let out = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*') {
      if (pattern[i + 1] === '*') {
        out += '.*';
        i++;
      } else {
        out += '[^/]*';
      }
    } else {
      out += c.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${out}$`);
}

/**
 * Read + validate the rule list. Validation is strict and throws: a typo'd `class` that silently became
 * `other` would move the headline number with nothing on screen to say so.
 * @returns {{ defaultClass: string, rules: { match: string, class: string, why: string, re: RegExp }[] }}
 */
export function loadRules(rulesPath = RULES_PATH) {
  const raw = JSON.parse(readFileSync(rulesPath, 'utf8'));
  if (!Array.isArray(raw.rules) || raw.rules.length === 0) throw new Error(`${rulesPath}: "rules" must be a non-empty array`);
  const defaultClass = raw.defaultClass ?? 'other';
  if (!CLASSES.includes(defaultClass)) throw new Error(`${rulesPath}: defaultClass "${defaultClass}" is not one of ${CLASSES.join('/')}`);
  const rules = raw.rules.map((r, i) => {
    if (typeof r?.match !== 'string' || !r.match) throw new Error(`${rulesPath}: rule ${i} has no "match"`);
    if (!CLASSES.includes(r.class)) throw new Error(`${rulesPath}: rule ${i} ("${r.match}") has class "${r.class}", not one of ${CLASSES.join('/')}`);
    if (typeof r.why !== 'string' || !r.why.trim()) throw new Error(`${rulesPath}: rule ${i} ("${r.match}") has no "why" — every rule must explain itself in one line`);
    return { match: r.match, class: r.class, why: r.why, re: patternToRegExp(r.match) };
  });
  return { defaultClass, rules };
}

/**
 * Charge one path to one class, and say why in one line. First match wins, so the exclusions at the top of
 * the rule list beat the broad product/machinery rules below them.
 * @returns {{ class: string, why: string, match: string|null }}
 */
export function classifyPath(path, ruleset) {
  const { rules, defaultClass } = ruleset;
  for (const r of rules) {
    if (r.re.test(path)) return { class: r.class, why: r.why, match: r.match };
  }
  return { class: defaultClass, why: 'matched no rule in output-mix-paths.json — counted in the remainder', match: null };
}

// ── Weeks ─────────────────────────────────────────────────────────────────────

/** The Monday 00:00 UTC that owns a `YYYY-MM-DD`. ISO weeks, so the boundary never depends on the reader. */
export function isoWeekStart(day) {
  const d = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`not a YYYY-MM-DD date: ${day}`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  // utc-day-slice-ok: pure UTC arithmetic on an already-UTC input, not a wall-clock read of "what day is it".
  // The input was parsed as `…T00:00:00Z` two lines up, so the slice returns the same calendar day it was
  // given, shifted by whole days — an operator-local re-read here would corrupt it, not correct it (#2747).
  return d.toISOString().slice(0, 10);
}

const addDays = (day, n) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  // utc-day-slice-ok: same as `isoWeekStart` — whole-day arithmetic over a UTC-parsed day, no clock read.
  return d.toISOString().slice(0, 10);
};

/** The `WEEK_COUNT` week-starts ending with the week that contains `today`, oldest first. */
export function weekStarts(today, count = WEEK_COUNT) {
  const current = isoWeekStart(today);
  return Array.from({ length: count }, (_, i) => addDays(current, -7 * (count - 1 - i)));
}

// ── The git read ──────────────────────────────────────────────────────────────

const COMMIT_PREFIX = 'OMC|';

/**
 * Parse `git log --no-merges --numstat -z --format=OMC|%H|%cd`.
 *
 * The stream is NUL-separated tokens: a commit header, then one token per changed file. A RENAME is three
 * tokens — `adds\tdels\t` with an empty path, then the old path, then the new path — and they are consumed
 * POSITIONALLY, which is why a renamed file whose name happens to look like a header can never be misread.
 *
 * @returns {{ day: string, path: string, added: number }[]}
 */
export function parseNumstatZ(stdout) {
  const tokens = String(stdout).split('\0');
  const rows = [];
  let day = null;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i].replace(/^\n+/, '');
    if (!t) continue;
    if (t.startsWith(COMMIT_PREFIX)) {
      day = t.slice(COMMIT_PREFIX.length).split('|')[1] ?? null;
      continue;
    }
    const m = /^(\S+)\t(\S+)\t([\s\S]*)$/.exec(t);
    if (!m || !day) continue;
    // A binary file reports `-` for both counts; it has no lines, so it contributes nothing either way.
    const added = m[1] === '-' ? 0 : Number(m[1]);
    let path = m[3];
    if (path === '') {
      path = tokens[i + 2] ?? '';
      i += 2;
    }
    if (path && Number.isFinite(added)) rows.push({ day, path, added });
  }
  return rows;
}

/**
 * Sum added lines per class per week. Pure — takes already-parsed rows, so the whole reduction is testable
 * without a repository.
 * @returns {{ start: string, end: string, product: number, machinery: number, other: number, total: number }[]}
 */
export function bucketWeeks(rows, starts, ruleset) {
  const buckets = new Map(starts.map((s) => [s, { start: s, end: addDays(s, 6), product: 0, machinery: 0, other: 0, total: 0 }]));
  const first = starts[0];
  for (const r of rows) {
    if (r.day < first) continue;
    const b = buckets.get(isoWeekStart(r.day));
    if (!b) continue; // a commit dated in the future relative to `today` — not one of our weeks
    b[classifyPath(r.path, ruleset).class] += r.added;
    b.total += r.added;
  }
  return starts.map((s) => buckets.get(s));
}

/**
 * The whole metric: read the log, classify, bucket.
 *
 * @param {object} [opts]
 * @param {string} [opts.repoRoot] repository to measure — defaults to this checkout.
 * @param {string} [opts.today]    `YYYY-MM-DD` anchoring the current week (UTC). Defaults to now.
 * @param {number} [opts.weeks]    how many buckets, current week last.
 * @returns {{ fresh: boolean, reason: string|null, weeks: object[], current: object|null, trend: object[] }}
 */
export function computeOutputMix({ repoRoot = ROOT, today = null, weeks = WEEK_COUNT, rulesPath = RULES_PATH } = {}) {
  // utc-day-slice-ok: the anchor MUST be on the same clock as the data it buckets, and the data is UTC —
  // commit days are read with `TZ=UTC` below and week boundaries are UTC Mondays. Reading the operator's
  // local day here would pair a local anchor with UTC inputs, which is exactly the mismatch #2987 records
  // (and #2747's rule is about stamping a human-facing calendar date, which this is not). The visible cost
  // is bounded and stated: for a UTC-behind operator, late on a Sunday evening the board has already rolled
  // into the next ISO week. That is the correct trade against silently mis-bucketing every commit near a
  // week boundary.
  const day = today ?? new Date().toISOString().slice(0, 10);
  const empty = (reason) => ({ fresh: false, reason, weeks: [], current: null, trend: [] });

  let ruleset;
  try {
    ruleset = loadRules(rulesPath);
  } catch (err) {
    // A broken rule list must not take the page down with it, but it must not be papered over either.
    return empty(`the path classifier could not be read — ${err.message}`);
  }

  const starts = weekStarts(day, weeks);
  let stdout;
  try {
    stdout = execFileSync(
      'git',
      [
        '-C',
        repoRoot,
        'log',
        '--no-merges',
        '--numstat',
        '-z',
        `--format=${COMMIT_PREFIX}%H|%cd`,
        '--date=format-local:%Y-%m-%d',
        `--since=${starts[0]}T00:00:00Z`,
      ],
      { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, timeout: 60_000, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, TZ: 'UTC' } },
    );
  } catch (err) {
    return empty(`the git history could not be read — ${String(err?.message ?? err).split('\n')[0]}`);
  }

  const all = bucketWeeks(parseNumstatZ(stdout), starts, ruleset);
  return { fresh: true, reason: null, weeks: all, current: all[all.length - 1], trend: all.slice(0, -1) };
}

/**
 * "12.4× machinery" / "no product output" — the one phrase the board leads with. Returned as data, not
 * markup, so the renderer stays the only thing that knows about HTML.
 * @returns {{ text: string, sev: string }}
 */
export function ratioLabel(week) {
  const p = week?.product ?? 0;
  const m = week?.machinery ?? 0;
  if (!p && !m) return { text: 'nothing added either side', sev: 'muted' };
  if (!p) return { text: 'no product output at all', sev: 'crit' };
  if (!m) return { text: 'all product, no machinery', sev: 'ok' };
  const r = m / p;
  if (r < 1) return { text: `${(p / m).toFixed(1)}× more product than machinery`, sev: 'ok' };
  return { text: `${r.toFixed(1)}× more machinery than product`, sev: r >= 10 ? 'crit' : 'warn' };
}
