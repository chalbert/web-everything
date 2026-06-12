/**
 * check-standards-rules.mjs — pure, individually-testable rule bodies for the validator.
 *
 * `check-standards.mjs` is a top-to-bottom live script (it loads the real registries and
 * `process.exit`s), which makes a new rule's correctness — false-positive safety especially — a
 * manual, un-regressed check. This module factors the highest-value, context-pure rules out of that
 * script so they can be unit-tested with synthetic fixtures (see `scripts/__tests__/`). The script
 * stays the single source of live behavior: it *imports and composes* these, so the test exercises
 * the exact code the production gate runs (backlog #251).
 *
 * Each rule takes already-loaded data + an item and returns `{ errors, warnings }`, where every entry
 * is `{ message, descriptor? }` — identical to what `check-standards.mjs` pushes — so the descriptor
 * feed (#095/#196/#197) and the human output are unchanged.
 */

// Backlog operational axis (not the implementation lifecycle) + agile sizing — see
// docs/agent/backlog-workflow.md. Exported so the script and the tests share one definition.
export const BACKLOG_STATUSES = new Set(['open', 'active', 'parked', 'resolved']);
export const BACKLOG_TYPES = new Set(['idea', 'issue', 'review', 'decision']);
export const WORK_ITEMS = new Set(['story', 'epic', 'task']);
export const FIB = new Set([1, 2, 3, 5, 8, 13]);
// The digest is each item's lead paragraph (the loader's derived `summary`), surfaced for one-glance
// selection. Presence is a required-field error; length is a soft nudge — a runaway opener defeats the
// "scan, don't read the body" purpose. Accuracy (does it still describe the item?) is a review-time
// concern, not mechanical. See docs/agent/backlog-workflow.md → "The digest".
export const DIGEST_MAX_WORDS = 100;

// ── Failure descriptors (#095 → fed to the auto-fix agent #196) ────────────────
// A required field declared in the spec but absent — the model fixer supplies a value.
export const dMissingField = (entity, id, file, field) =>
  ({ kind: 'missing-required-field', fix: 'model', entity, id, file, field });
// A cross-reference whose value doesn't resolve in its target registry — model judgment (typo vs.
// genuinely-missing entity), so `model`. `refRegistry` names the registry the value should resolve in.
export const dUnresolvedRef = (entity, id, file, field, value, refRegistry) =>
  ({ kind: 'unresolved-ref', fix: 'model', entity, id, file, field, value, refRegistry });

// graduatedTo compact ref shape (#247): a single lowercase kind, a colon, and a kebab/underscore slug
// — no spaces, slashes, or dots, so prose / paths / URLs / the `none` sentinel never match and stay
// free-form (the sanctioned alternative, left untouched).
export const GRADUATED_REF = /^([a-z][a-z]*):([A-Za-z0-9_-]+)$/;

/**
 * Build the graduatedTo `kind → { ids, file }` resolution table from the loaded registries. A
 * graduatedTo written in the compact `kind:slug` form is resolved against the matching registry, so a
 * typo'd kind or a stale slug is caught instead of silently silencing the nudge. Adapters live nested
 * under adapters.json `items[]`.
 */
export function buildGraduatedKinds({ blocks = [], intents = [], protocols = [], projects = [], plugs = [], capabilityIds = new Set(), adapters = [], demos = [] }) {
  return {
    block: { ids: new Set(blocks.map((b) => b.id)), file: 'blocks.json' },
    intent: { ids: new Set(intents.map((i) => i.id)), file: 'intents.json' },
    protocol: { ids: new Set(protocols.map((p) => p.id)), file: 'protocols.json' },
    project: { ids: new Set(projects.map((p) => p.id)), file: 'projects.json' },
    plug: { ids: new Set(plugs.map((p) => p.id)), file: 'plugs.json' },
    capability: { ids: capabilityIds instanceof Set ? capabilityIds : new Set(capabilityIds), file: 'capabilities.json' },
    adapter: { ids: new Set(adapters.flatMap((a) => (a.items || []).map((i) => i.id))), file: 'adapters.json' },
    demo: { ids: new Set(demos.map((d) => d.id)), file: 'demos.json' },
  };
}

/**
 * Validate a single backlog item's fields and outward references.
 *
 * Pure: all I/O is injected via `ctx`, so the rule is exercisable with synthetic items.
 * @param item  one backlog entry (frontmatter fields, incl. derived `num`).
 * @param ctx   { projectById: Map, graduatedKinds: object (buildGraduatedKinds output),
 *                knownNums: Set<string> (every item's `num`, for parent resolution),
 *                reportExists: (relPath: string) => boolean (relatedReport file probe) }
 * @returns { errors: Array<{message, descriptor?}>, warnings: Array<{message, descriptor?}> }
 */
export function validateBacklogItem(item, ctx) {
  const { projectById, graduatedKinds, knownNums, reportExists } = ctx;
  const errors = [];
  const warnings = [];
  const err = (m, descriptor) => errors.push({ message: m, descriptor });
  const warn = (m, descriptor) => warnings.push({ message: m, descriptor });

  const backlogFile = item.id ? `backlog/${item.id}.md` : undefined;
  for (const f of ['id', 'title', 'type', 'status', 'summary', 'dateOpened']) {
    if (item[f] === undefined || item[f] === null || item[f] === '')
      err(`Backlog item "${item.id || '<no id>'}" missing required field "${f}"`,
        dMissingField('Backlog', item.id, backlogFile, f));
  }
  // Digest length nudge — the lead paragraph is surfaced for one-glance selection; keep it scannable.
  if (typeof item.summary === 'string') {
    const words = item.summary.split(/\s+/).filter(Boolean).length;
    if (words > DIGEST_MAX_WORDS)
      warn(`Backlog item "${item.id}" digest (lead paragraph) is ${words} words — keep it under ${DIGEST_MAX_WORDS} for one-glance selection`);
  }
  if (item.type && !BACKLOG_TYPES.has(item.type))
    err(`Backlog item "${item.id}" has invalid type "${item.type}" (expected ${[...BACKLOG_TYPES].join(' / ')})`);
  if (item.status && !BACKLOG_STATUSES.has(item.status))
    err(`Backlog item "${item.id}" has invalid status "${item.status}" (expected ${[...BACKLOG_STATUSES].join(' / ')})`);
  if (item.relatedProject && !projectById.has(item.relatedProject))
    err(`Backlog item "${item.id}" relatedProject "${item.relatedProject}" does not resolve in projects.json`,
      dUnresolvedRef('Backlog', item.id, backlogFile, 'relatedProject', item.relatedProject, 'projects.json'));
  if (item.relatedReport && !reportExists(item.relatedReport))
    err(`Backlog item "${item.id}" relatedReport does not exist: ${item.relatedReport}`,
      dUnresolvedRef('Backlog', item.id, backlogFile, 'relatedReport', item.relatedReport, 'reports/'));
  if (item.crossRef && (!item.crossRef.url || !item.crossRef.label))
    err(`Backlog item "${item.id}" crossRef must have both "url" and "label"`);
  // graduatedTo records the entity a resolved item became. It doesn't apply to outcomes that aren't a
  // new entity: an `issue`/`review` (a fix/audit) or a `decision` (a ruling). A resolved `idea` that
  // produced no entity sets the sentinel `graduatedTo: none`; any present value silences this nudge.
  if (item.status === 'resolved' && !item.graduatedTo && !['issue', 'review', 'decision'].includes(item.type))
    warn(`Backlog item "${item.id}" is resolved but has no graduatedTo — record what it became`);
  // #247 — resolve the value, not just its presence. A compact `kind:slug` ref must have a known kind
  // and a resolving slug; the `none` sentinel and every free-form value don't match GRADUATED_REF and
  // are left untouched.
  if (typeof item.graduatedTo === 'string') {
    const gm = GRADUATED_REF.exec(item.graduatedTo.trim());
    if (gm) {
      const [, kind, slug] = gm;
      const reg = graduatedKinds[kind];
      if (!reg)
        err(`Backlog item "${item.id}" graduatedTo "${item.graduatedTo}" uses unknown kind "${kind}" — expected one of ${Object.keys(graduatedKinds).join(' / ')}, the sentinel "none", or a free-form description of what it became`);
      else if (!reg.ids.has(slug))
        err(`Backlog item "${item.id}" graduatedTo "${kind}:${slug}" does not resolve to a known ${kind} in ${reg.file}`,
          dUnresolvedRef('Backlog', item.id, backlogFile, 'graduatedTo', `${kind}:${slug}`, reg.file));
    }
  }

  // ── Agile sizing — drives the /backlog/ burndown ──
  if (!item.workItem)
    err(`Backlog item "${item.id}" missing required field "workItem" (story / epic / task)`);
  else if (!WORK_ITEMS.has(item.workItem))
    err(`Backlog item "${item.id}" has invalid workItem "${item.workItem}" (expected ${[...WORK_ITEMS].join(' / ')})`);
  if (item.size !== undefined && !FIB.has(item.size))
    err(`Backlog item "${item.id}" has non-Fibonacci size "${item.size}" (expected one of ${[...FIB].join(', ')})`);
  if (item.workItem === 'story' && item.size === undefined)
    err(`Backlog item "${item.id}" is a story but has no size — every story must carry Fibonacci points`);
  if (item.workItem === 'task' && item.size !== undefined)
    err(`Backlog item "${item.id}" is a task but has a size — tasks are never sized (they roll up under a story/epic)`);
  if (item.parent !== undefined && !knownNums.has(String(item.parent)))
    err(`Backlog item "${item.id}" parent "#${item.parent}" does not resolve to an existing item`,
      dUnresolvedRef('Backlog', item.id, backlogFile, 'parent', String(item.parent), 'backlog/'));
  // Resolution date is what the burndown plots — required once resolved.
  if (item.status === 'resolved' && !item.dateResolved)
    err(`Backlog item "${item.id}" is resolved but has no dateResolved — the burndown needs the resolution date`);

  return { errors, warnings };
}

// ── Raw-HTML-in-backlog-body lint (#290) ──────────────────────────────────────
// An un-backticked HTML tag in a backlog markdown body is passed through verbatim by 11ty and parsed
// by the browser as a live element. A void/unclosed interactive one (`<select>`, `<dialog>`,
// `<textarea>`) then swallows the rest of the page body, rendering the item visibly empty — the #020
// bug, which shipped silently because check:standards didn't look. This lint flags tag-like `<…>`
// sequences outside code spans/fences so the author wraps them (cheap fix: backticks).
//
// Severity is WARNING, not error: balanced raw HTML (e.g. #028's deliberate `<h3>/<p>/<ul>` block)
// renders fine, so banning all body HTML would red-gate a working item. The warning surfaces every
// raw tag — including the dangerous unclosed ones — without failing on legitimate rich-HTML prose.
//
// Match is restricted to RECOGNISED HTML element names. Backlog/doc prose is dense with `<NNN>`,
// `<date>`, `<slug>` placeholders that are valid tag-name syntax but are NOT elements (the browser
// treats them as inert unknown tags); matching every `<…>` would bury the real hits under placeholder
// noise. Every content-swallowing element is a standard one, so the recognised-element set IS the
// danger zone — custom elements (hyphenated, inert) are intentionally excluded.
export const HTML_ELEMENTS = new Set([
  'a', 'abbr', 'address', 'area', 'article', 'aside', 'audio', 'b', 'base', 'bdi', 'bdo',
  'blockquote', 'body', 'br', 'button', 'canvas', 'caption', 'cite', 'code', 'col', 'colgroup',
  'data', 'datalist', 'dd', 'del', 'details', 'dfn', 'dialog', 'div', 'dl', 'dt', 'em', 'embed',
  'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head',
  'header', 'hgroup', 'hr', 'html', 'i', 'iframe', 'img', 'input', 'ins', 'kbd', 'label', 'legend',
  'li', 'link', 'main', 'map', 'mark', 'menu', 'meta', 'meter', 'nav', 'noscript', 'object', 'ol',
  'optgroup', 'option', 'output', 'p', 'picture', 'pre', 'progress', 'q', 'rp', 'rt', 'ruby', 's',
  'samp', 'script', 'section', 'select', 'slot', 'small', 'source', 'span', 'strong', 'style', 'sub',
  'summary', 'sup', 'table', 'tbody', 'td', 'template', 'textarea', 'tfoot', 'th', 'thead', 'time',
  'title', 'tr', 'track', 'u', 'ul', 'var', 'video', 'wbr',
]);

/**
 * Find un-backticked HTML element tags in a markdown body. Fenced code blocks (``` / ~~~) and inline
 * code spans (`…`) are stripped first, so a `<select>` shown as an example inside backticks is ignored
 * and only prose-level raw HTML remains. Only tags whose name resolves in HTML_ELEMENTS are reported.
 *
 * Pure: takes the raw body string (the script reads the file) and returns `{ line, tag, name }` per
 * hit, line-numbered against the original body for an actionable message.
 */
export function findRawHtmlInMarkdown(body) {
  const findings = [];
  if (typeof body !== 'string' || body === '') return findings;
  let fenceChar = null;   // the char of the open fence (` or ~), or null when outside a fence
  let fenceLen = 0;       // its run length — a fence closes on the same char, run length ≥ this
  body.split('\n').forEach((line, i) => {
    const fm = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceChar) {
      if (fm && fm[1][0] === fenceChar && fm[1].length >= fenceLen) { fenceChar = null; fenceLen = 0; }
      return; // inside a fence — drop the line
    }
    if (fm) { fenceChar = fm[1][0]; fenceLen = fm[1].length; return; }
    // Strip inline code spans (a backtick run, lazily, to a matching-length run) before scanning.
    const prose = line.replace(/(`+)[\s\S]*?\1/g, ' ');
    for (const m of prose.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g)) {
      const name = m[1].toLowerCase();
      if (HTML_ELEMENTS.has(name)) findings.push({ line: i + 1, tag: m[0], name });
    }
  });
  return findings;
}

// ── Implementation-lifecycle vocabulary + descriptor plumbing (#256) ───────────
// Shared by the script (blocks/plugs status) AND the entity validators below, so the lifecycle
// vocabulary and the descriptor `file` pointers have a single definition. Ordered concept → draft →
// experimental → active. Deprecated synonyms map to their canonical target (flagged so drift can't
// return). Research topics use a separate axis (RESEARCH_STATUSES, kept in the script).
export const LIFECYCLE = new Set(['concept', 'draft', 'experimental', 'active']);
export const STATUS_SYNONYMS = { implemented: 'active', stable: 'active', done: 'active', planned: 'concept', wip: 'draft' };

// Spec data files, keyed by entity for descriptor `file` pointers (the row/file a fixer edits).
export const FILE = {
  Block: 'src/_data/blocks.json', Plug: 'src/_data/plugs.json', Protocol: 'src/_data/protocols.json',
  Intent: 'src/_data/intents.json', Capability: 'src/_data/capabilities.json',
  CapabilityAdapter: 'src/_data/capabilityMatrix.json', Project: 'src/_data/projects.json',
  Research: 'src/_data/researchTopics.json',
};

// A spec entity with no matching description .njk — the model writes the prose; `file` is the path to create.
export const dMissingDescription = (entity, id, file) =>
  ({ kind: 'missing-description', fix: 'model', entity, id, file });

/**
 * Status enum check — returns an array of `{ message, descriptor? }` error entries (status rules
 * never warn). A deprecated synonym is `reference`-fixable (canonical target known); an
 * otherwise-invalid value is `model`-fixable (intended status isn't derivable). Pure: the caller
 * pushes the entries onto its own error list, so the script and the entity validators share one body.
 */
export function checkStatus(kind, id, status) {
  const out = [];
  if (!status) return out;
  if (STATUS_SYNONYMS[status]) {
    const to = STATUS_SYNONYMS[status];
    out.push({
      message: `${kind} "${id}" uses deprecated status "${status}" — use canonical "${to}"`,
      descriptor: FILE[kind] ? { kind: 'deprecated-status', fix: 'reference', entity: kind, id, file: FILE[kind], field: 'status', from: status, to } : undefined,
    });
  } else if (!LIFECYCLE.has(status)) {
    out.push({
      message: `${kind} "${id}" has invalid status "${status}" (expected ${[...LIFECYCLE].join(' / ')})`,
      descriptor: FILE[kind] ? { kind: 'invalid-status', fix: 'model', entity: kind, id, file: FILE[kind], field: 'status', from: status, allowed: [...LIFECYCLE] } : undefined,
    });
  }
  return out;
}

/**
 * Validate a single protocol (§6b) — required fields, ownedByProject / realizesIntent resolution,
 * and the project-partial anchor probe.
 *
 * Pure: the anchor probe's file read is injected via `readProjectPartial(projectId) => string|null`
 * (null = the partial file is absent), so the rule is exercisable with synthetic projects.
 * @param ctx { projectById: Map, intentById: Map, readProjectPartial: (projectId) => string|null }
 */
export function validateProtocol(proto, ctx) {
  const { projectById, intentById, readProjectPartial } = ctx;
  const errors = [];
  const err = (m, descriptor) => errors.push({ message: m, descriptor });
  for (const f of ['id', 'name', 'summary', 'status', 'ownedByProject', 'anchor']) {
    if (!proto[f]) err(`Protocol "${proto.id || '<no id>'}" missing required field "${f}"`,
      dMissingField('Protocol', proto.id, FILE.Protocol, f));
  }
  for (const e of checkStatus('Protocol', proto.id, proto.status)) err(e.message, e.descriptor);
  if (proto.ownedByProject && !projectById.has(proto.ownedByProject))
    err(`Protocol "${proto.id}" ownedByProject "${proto.ownedByProject}" does not resolve in projects.json`,
      dUnresolvedRef('Protocol', proto.id, FILE.Protocol, 'ownedByProject', proto.ownedByProject, 'projects.json'));
  if (proto.realizesIntent && !intentById.has(proto.realizesIntent))
    err(`Protocol "${proto.id}" realizesIntent "${proto.realizesIntent}" does not resolve in intents.json`,
      dUnresolvedRef('Protocol', proto.id, FILE.Protocol, 'realizesIntent', proto.realizesIntent, 'intents.json'));
  if (proto.ownedByProject && proto.anchor) {
    const body = readProjectPartial(proto.ownedByProject);
    if (body === null || body === undefined)
      err(`Protocol "${proto.id}" expects project partial src/_includes/project-${proto.ownedByProject}.njk`);
    else if (!body.includes(`id="${proto.anchor}"`))
      err(`Protocol "${proto.id}" anchor "${proto.anchor}" not found in project-${proto.ownedByProject}.njk`);
  }
  return { errors, warnings: [] };
}

/**
 * Validate a single intent (§6c) — required fields, status, `dimensions` presence (warn), and
 * `requiresCapabilities` resolution (every declared id must resolve in capabilities.json).
 * @param ctx { capabilityIds: Set }
 */
export function validateIntent(intent, ctx) {
  const { capabilityIds } = ctx;
  const errors = [];
  const warnings = [];
  const err = (m, descriptor) => errors.push({ message: m, descriptor });
  const warn = (m, descriptor) => warnings.push({ message: m, descriptor });
  for (const f of ['id', 'name', 'summary', 'status', 'dimensions']) {
    if (intent[f] === undefined || intent[f] === null || intent[f] === '')
      err(`Intent "${intent.id || '<no id>'}" missing required field "${f}"`,
        dMissingField('Intent', intent.id, FILE.Intent, f));
  }
  for (const e of checkStatus('Intent', intent.id, intent.status)) err(e.message, e.descriptor);
  const dimCount = intent.dimensions && typeof intent.dimensions === 'object'
    ? Object.keys(intent.dimensions).length
    : 0;
  if (!dimCount) warn(`Intent "${intent.id}" has no dimensions — /intents/ catalog needs at least one axis`);
  // Intent → required-capabilities mapping (data-driven, D3′): every declared id must resolve.
  if (intent.requiresCapabilities !== undefined) {
    if (!Array.isArray(intent.requiresCapabilities)) {
      err(`Intent "${intent.id}" requiresCapabilities must be an array of capability ids`);
    } else {
      for (const capId of intent.requiresCapabilities)
        if (!capabilityIds.has(capId))
          err(`Intent "${intent.id}" requires unknown capability "${capId}" — not in capabilities.json`,
            dUnresolvedRef('Intent', intent.id, FILE.Intent, 'requiresCapabilities', capId, 'capabilities.json'));
    }
  }
  return { errors, warnings };
}

// Capability + build-matrix vocabularies (§6c-bis, #204). Exported so the script and tests share one
// definition of the three tier states and the polyfill classes.
export const TIER_STATES = new Set(['native-ok', 'polyfill-ok', 'capability-hard']);
export const CAP_POLYFILL = new Set(['polyfillable', 'partial', 'capability']);

/**
 * Validate a single capability (§6c-bis) — required fields, the `baseline` year-string-or-false
 * shape, and the polyfill class vocabulary.
 */
export function validateCapability(cap) {
  const errors = [];
  const err = (m, descriptor) => errors.push({ message: m, descriptor });
  for (const f of ['id', 'label', 'webFeaturesKey', 'baseline', 'polyfill', 'summary']) {
    if (cap[f] === undefined || cap[f] === null || cap[f] === '')
      err(`Capability "${cap.id || '<no id>'}" missing required field "${f}"`,
        dMissingField('Capability', cap.id, FILE.Capability, f));
  }
  if (cap.baseline !== undefined && cap.baseline !== false && typeof cap.baseline !== 'string')
    err(`Capability "${cap.id}" baseline must be a year string or false (not-yet-Baseline)`);
  if (cap.polyfill && !CAP_POLYFILL.has(cap.polyfill))
    err(`Capability "${cap.id}" has invalid polyfill class "${cap.polyfill}" (expected ${[...CAP_POLYFILL].join(' / ')})`);
  return { errors, warnings: [] };
}

/**
 * Validate the registered capability-adapter table + static build-matrix invariants (§6c-bis,
 * #204/#206/#216). The `impls[]` array IS the registered adapter table — one row per impl — and the
 * matrix's row source. This guards: a non-empty table, unique ids, per-row required fields, a boolean
 * `native` marker, a tier map whose values are all valid states keying only known capabilities, the
 * *completeness* of the grid (every row tiers every capability), a detail-page partial per row, and
 * the single-native-substrate invariant.
 *
 * Pure: `capabilityIds` (the known-capability id set) and `hasAdapterDesc(id) => bool` (the partial
 * probe) are injected, so the gnarly completeness/native-count logic is fixture-testable.
 * @param ctx { capabilityIds: Set, hasAdapterDesc: (id) => boolean }
 */
export function validateCapabilityMatrix(matrixImpls, ctx) {
  const { capabilityIds, hasAdapterDesc } = ctx;
  const errors = [];
  const warnings = [];
  const err = (m, descriptor) => errors.push({ message: m, descriptor });
  const warn = (m, descriptor) => warnings.push({ message: m, descriptor });
  const impls = Array.isArray(matrixImpls) ? matrixImpls : [];
  if (!impls.length) err('capabilityMatrix.json has no registered capability adapters — the default provider needs at least one impl row');
  // Unique adapter ids (dup rows would silently double-tier a capability).
  const seenIds = new Set();
  for (const impl of impls) {
    if (!impl.id) continue;
    if (seenIds.has(impl.id)) err(`Duplicate id "${impl.id}" in capabilityMatrix.json adapter table (impls)`);
    seenIds.add(impl.id);
  }
  let nativeImplCount = 0;
  for (const impl of impls) {
    for (const f of ['id', 'label', 'summary', 'tiers']) {
      if (impl[f] === undefined || impl[f] === null || impl[f] === '')
        err(`Registered capability adapter "${impl.id || '<no id>'}" missing required field "${f}"`,
          dMissingField('CapabilityAdapter', impl.id, FILE.CapabilityAdapter, f));
    }
    // `native` (the native-first tiebreak marker, #205) is optional but, when present, a boolean.
    if (impl.native !== undefined && typeof impl.native !== 'boolean')
      err(`Capability adapter "${impl.id}" native must be a boolean (the native-first substrate marker)`);
    if (impl.native === true) nativeImplCount++;
    const tiers = impl.tiers && typeof impl.tiers === 'object' ? impl.tiers : {};
    // Every tier value must be one of the 3 states, and key a known capability id (no stray rows).
    for (const [capId, tier] of Object.entries(tiers)) {
      if (!capabilityIds.has(capId))
        err(`Capability adapter "${impl.id}" tiers unknown capability "${capId}" — not in capabilities.json`,
          dUnresolvedRef('CapabilityAdapter', impl.id, FILE.CapabilityAdapter, 'tiers', capId, 'capabilities.json'));
      if (!TIER_STATES.has(tier))
        err(`Capability adapter "${impl.id}" capability "${capId}" has invalid tier "${tier}" (expected ${[...TIER_STATES].join(' / ')})`);
    }
    // The build-matrix is a complete grid: tier() must be total, so every row tiers every capability.
    for (const capId of capabilityIds)
      if (!(capId in tiers))
        err(`Capability adapter "${impl.id}" is missing a tier for capability "${capId}" — the registered row must tier every capability (the matrix is a complete impl × capability grid)`);
    // Each registered adapter gets a detail page (capability-adapter-pages.njk) backed by a prose
    // partial — the column-detail discovery surface (#216), mirroring adapter-descriptions/{id}.njk.
    if (impl.id && !hasAdapterDesc(impl.id))
      err(`Capability adapter "${impl.id}" has no src/_includes/capability-adapter-descriptions/${impl.id}.njk`,
        dMissingDescription('CapabilityAdapter', impl.id, `src/_includes/capability-adapter-descriptions/${impl.id}.njk`));
  }
  // The native-first tiebreak needs an unambiguous substrate: at most one impl may be marked native.
  if (nativeImplCount > 1)
    err(`capabilityMatrix.json registers ${nativeImplCount} native adapters — the native-first tiebreak needs a single native substrate`);
  // Zero native is legal but means native-first can never win a lightness tie on the bundled table.
  if (impls.length && nativeImplCount === 0)
    warn('capabilityMatrix.json registers no native adapter — native-first has no substrate to prefer on a tie');
  return { errors, warnings };
}

// Strip the leading `YYYY-MM-DD-` date and the `.md` suffix from a report filename to get its slug
// (the id a /research/ topic would carry). Exported for the reports-not-hidden test fixtures.
export const deDateReport = (f) => f.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.md$/, '');

/**
 * Reports-not-hidden (§6e): reports/ is NOT in the 11ty build, so a report is reachable only when a
 * /research/ topic (id = its de-dated slug) or a backlog item (relatedReport) references it. A report
 * that is neither is invisible — fail.
 *
 * Pure: the fs walk stays in the script; the file list + the two reference sets are injected.
 * @param ctx { researchIds: Set, backlogReportRefs: Set } — refs are filenames with the `reports/`
 *              prefix stripped (matching how the script normalises relatedReport).
 */
export function validateReportsNotHidden(reportFiles, ctx) {
  const { researchIds, backlogReportRefs } = ctx;
  const errors = [];
  for (const f of reportFiles) {
    const slug = deDateReport(f);
    if (!researchIds.has(slug) && !backlogReportRefs.has(f))
      errors.push({ message:
        `Report "reports/${f}" is hidden — no /research/ topic (id "${slug}") and no /backlog/ item ` +
        `references it (relatedReport). Promote it to a research topic or add a backlog item.` });
  }
  return { errors, warnings: [] };
}

/**
 * Compiled-artifact shadow (§8): a `.js`/`.d.ts` emitted next to its `.ts`/`.tsx` source silently
 * shadows it in vitest (extensionless imports resolve `.js` BEFORE `.tsx`). Fail on any such pair.
 *
 * Pure: takes a flat list of file paths (the fs walk stays in the script) and returns one error per
 * shadowing artifact. `rel(path)` formats the display path (default: identity).
 */
export function findCompiledShadows(fileList, rel = (f) => f) {
  const errors = [];
  const fileSet = new Set(fileList);
  for (const f of fileList) {
    const base = f.endsWith('.d.ts') ? f.slice(0, -5) : f.endsWith('.js') ? f.slice(0, -3) : null;
    if (!base) continue;
    if (fileSet.has(`${base}.ts`) || fileSet.has(`${base}.tsx`))
      errors.push({ message:
        `Compiled artifact "${rel(f)}" shadows its TS source — delete it. ` +
        `Stale .js/.d.ts next to .ts/.tsx silently override the source in vitest (.js resolves first).` });
  }
  return { errors, warnings: [] };
}

// Escape a string for literal use inside a RegExp (the proxy-coverage probe builds a regex per segment).
export const escapeRegExp = (s) => s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');

/**
 * Is a top-level catalog segment covered by the Vite proxy allowlist? (§9, #210.) A segment is
 * "covered" when it appears in the proxy-key blob bounded by a path/alternation delimiter — so `js`
 * matches `|js)` but the `js` inside `project-lifecycle` does not. This bounded-match regex is the
 * gnarly bit a silent false-positive/negative most likely hides in, so it's factored for fixtures.
 */
export function isSegmentCovered(seg, proxyKeys) {
  return new RegExp(`(?:^|[\\/|(])${escapeRegExp(seg)}(?:[\\/|)\\\\$]|$)`).test(proxyKeys);
}

/**
 * Derive a catalog njk's top-level URL segment from its body — its `permalink:` front-matter, else
 * the 11ty default `/<name>/`. Returns null for the root or a fully-templated first segment (neither
 * maps to a fixed proxy route).
 */
export function permalinkSegment(njkBody, filename) {
  const m = njkBody.match(/^\s*permalink:\s*["']?([^"'\n]+)/m);
  const permalink = m ? m[1].trim() : `/${filename.replace(/\.njk$/, '')}/`;
  const seg = permalink.replace(/^\//, '').split('/')[0];
  if (!seg || seg.includes('{')) return null;
  return seg;
}

/**
 * Vite dev-proxy allowlist coverage (§9): every catalog route that renders on 11ty :8080 must be
 * forwarded by the Vite proxy, or it 404s on :3000. Pure: takes the parsed `{ seg, file }` segments
 * (via permalinkSegment) + the proxy-key blob and reports each uncovered segment.
 */
export function validateViteProxyCoverage(segments, proxyKeys) {
  const errors = [];
  for (const { seg, file } of segments)
    if (!isSegmentCovered(seg, proxyKeys))
      errors.push({ message:
        `Vite proxy is missing catalog route "/${seg}/" (from src/${file}) — it renders on 11ty :8080 ` +
        `but 404s on the Vite dev server :3000. Add "${seg}" to the proxy allowlist alternation in vite.config.mts.` });
  return { errors, warnings: [] };
}

// ── Module-resolution exports-lock (#274, materialising #271) ──────────────────────────────────────
// The module-resolution axis lets a project resolve a bare specifier however its toolchain does
// (node_modules+exports, importmap, CDN URL, dev alias) — but with ONE lock: an `@frontierui/*` entry
// in any of those native manifests must terminate at the PACKAGE's `exports`, never at WE/foreign
// source or a raw in-repo path. "protocol is the only lock." This is the lint half of #274's three
// deliverables (the model + reference page are the other two); the resolution itself is native, no
// runtime code.

/** The published-impl scope whose entries are locked to package-exports resolution (#239/#271). */
export const MODULE_RESOLUTION_LOCKED_SCOPE = '@frontierui/';

/**
 * Is an importmap/alias `target` a legitimate package-exports terminus (vs a raw source path)? OK:
 * an http(s) URL (CDN/served), a `node_modules` path, or a bare specifier (no leading `/`, `.` — node
 * resolves it via `exports`). NOT OK: a raw in-repo/foreign source path — a leading `/` that is not a
 * URL (e.g. `/plugs/...`), a relative `./`/`../` path, or any path reaching into a `/src/` tree.
 */
export function isExportsSafeTarget(target) {
  if (typeof target !== 'string' || target.trim() === '') return false;
  if (/^https?:\/\//.test(target)) return true; // URL override
  if (/(^|\/)node_modules\//.test(target)) return true; // resolved package path
  if (target.startsWith('/') || target.startsWith('./') || target.startsWith('../')) return false; // raw path
  if (target.includes('/src/')) return false; // foreign/WE source tree
  return true; // bare specifier → node-resolution via exports
}

/**
 * Module-resolution exports-lock: every locked-scope (`@frontierui/*`) importmap/alias entry must
 * resolve to the package's exports (URL, node_modules, or bare specifier), never a raw WE/foreign
 * source path. Pure: takes the gathered `{ specifier, target, source }` entries and reports each
 * violation. Vacuously passes when no locked entry exists (the common case until a project repoints).
 */
export function validateModuleResolutionLock(entries) {
  const errors = [];
  for (const { specifier, target, source } of entries) {
    if (!specifier.startsWith(MODULE_RESOLUTION_LOCKED_SCOPE)) continue;
    if (!isExportsSafeTarget(target))
      errors.push({ message:
        `Module-resolution lock: "${specifier}" → "${target}"${source ? ` (in ${source})` : ''} resolves to a ` +
        `raw source path, not the package exports. An ${MODULE_RESOLUTION_LOCKED_SCOPE}* entry must terminate at ` +
        `the published package (a bare specifier, a node_modules path, or an http(s) URL) — never WE/foreign ` +
        `source. See the module-resolution reference (#271/#274).` });
  }
  return { errors, warnings: [] };
}
