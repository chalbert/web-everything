// Conveyor flows as data (#4075 step 1, describe only) — the pure model shared by check.mjs and graph.mjs.
//
// Loads `*.flow.json` files, checks them for structural gaps, and computes which facts are guaranteed at
// each step (a forward must-analysis over the state graph). Pure functions over plain objects; the only
// I/O is `loadFlows`. Nothing here executes a flow. The file shape and the rules are documented in README.md.

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FLOWS_DIR = dirname(fileURLToPath(import.meta.url));

export const RULES = Object.freeze({
  'no-owner': 'state has no owner — nothing acts on it',
  'unbounded-wait': 'wait has no timeout, or no state to go to on timeout',
  'failure-no-exit': 'a failure has nowhere to go',
  'silent-failure': 'a failure end-state escalates to no one',
  'uncapped-retry': 'retry has no cap, or no state to go to at the cap',
  'unprovided-assumption': 'a step assumes a fact that no earlier step guarantees on every path',
  'dangling-ref': 'reference to a state that does not exist',
  'unreachable': 'no path from the entry state reaches this state',
  'bad-ack': 'acknowledgement does not name a card',
  'bad-shape': 'the file does not follow the flow shape (so the checker cannot see part of it)',
});

/** A card reference: `#1234` or a pre-numbered hash id `x1a2b3c`. */
const CARD_RE = /^(#\d+|x[0-9a-z]{6,7})$/;

export const factKey = (f) => `${f.kind}:${f.name}`;

/** Apply one step to a fact set: its `provides` start to hold, its `removes` stop holding (e.g. a cwd change). */
export function applyStep(set, step) {
  for (const f of step.provides ?? []) set.add(factKey(f));
  for (const f of step.removes ?? []) set.delete(factKey(f));
  return set;
}

/** Load every `<id>.flow.json` in `dir` (default: this directory), sorted by id. */
export function loadFlows(dir = FLOWS_DIR) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.flow.json'))
    .sort()
    .map((f) => {
      const flow = JSON.parse(readFileSync(join(dir, f), 'utf8'));
      return { ...flow, _file: f };
    });
}

function isHandoff(to) {
  return typeof to === 'string' && to.startsWith('@');
}

/** Outgoing transitions per state id (hand-offs to other flows included; they have no local target). */
function outgoing(flow) {
  const out = new Map(flow.states.map((s) => [s.id, []]));
  for (const t of flow.transitions ?? []) if (out.has(t.from)) out.get(t.from).push(t);
  return out;
}

/** The flow's entry points: `entry` plus any `extraEntries` (independent external triggers). */
export function entries(flow) {
  return [flow.entry, ...(flow.extraEntries ?? [])].filter(Boolean);
}

function reachable(flow) {
  const out = outgoing(flow);
  const seen = new Set();
  const stack = entries(flow).map((e) => e.state);
  while (stack.length) {
    const id = stack.pop();
    if (!id || seen.has(id) || !out.has(id)) continue;
    seen.add(id);
    for (const t of out.get(id)) if (!isHandoff(t.to)) stack.push(t.to);
  }
  return seen;
}

/**
 * Forward must-analysis. IN[s] = ∩ over incoming edges of what the edge carries; the entry state also
 * gets `entry.provides`. A `normal` edge carries IN[from] ∪ provides(steps of from); a failure / timeout /
 * escalation edge carries only IN[from] (the steps did not all succeed). Any edge adds its own `provides` — the
 * condition that selected it (e.g. "required check concluded failing" ⇒ the checks ran). Iterates to a fixpoint starting
 * from ⊤ (all facts) for non-entry states, so loops converge to the greatest fixpoint.
 * Returns Map<stateId, Set<factKey>> of facts guaranteed on ENTRY to each reachable state.
 */
export function guaranteedFacts(flow) {
  const reach = reachable(flow);
  const stepsByState = new Map(flow.states.map((s) => [s.id, []]));
  for (const st of flow.steps ?? []) stepsByState.get(st.state)?.push(st);
  const universe = new Set();
  const entryFacts = new Map();
  for (const e of entries(flow)) {
    const ks = (e.provides ?? []).map(factKey);
    ks.forEach((k) => universe.add(k));
    const prev = entryFacts.get(e.state);
    entryFacts.set(e.state, prev ? new Set(ks.filter((k) => prev.has(k))) : new Set(ks));
  }
  for (const st of flow.steps ?? []) for (const f of st.provides ?? []) universe.add(factKey(f));
  /** What holds after a state's steps ran in order: add each step's provides, drop its removes. */
  const after = (id, inSet) => {
    const s = new Set(inSet);
    for (const st of stepsByState.get(id) ?? []) applyStep(s, st);
    return s;
  };
  const IN = new Map();
  for (const id of reach) IN.set(id, entryFacts.has(id) ? new Set(entryFacts.get(id)) : new Set(universe));
  const incoming = new Map([...reach].map((id) => [id, []]));
  for (const t of flow.transitions ?? []) {
    if (reach.has(t.from) && reach.has(t.to)) incoming.get(t.to).push(t);
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of reach) {
      let acc = null;
      for (const t of incoming.get(id)) {
        const carried = (t.kind ?? 'normal') === 'normal' ? after(t.from, IN.get(t.from)) : new Set(IN.get(t.from));
        for (const f of t.provides ?? []) carried.add(factKey(f)); // the condition that takes this edge establishes it
        acc = acc === null ? carried : new Set([...acc].filter((k) => carried.has(k)));
      }
      let next;
      if (entryFacts.has(id)) {
        // An entry state is entered from outside (its entry facts) AND possibly re-entered via loops.
        const ef = entryFacts.get(id);
        next = acc === null ? new Set(ef) : new Set([...ef].filter((k) => acc.has(k)));
      } else {
        next = acc ?? new Set();
      }
      const prev = IN.get(id);
      if (next.size !== prev.size || [...next].some((k) => !prev.has(k))) {
        IN.set(id, next);
        changed = true;
      }
    }
  }
  return IN;
}

function finding(flow, rule, where, message, ack) {
  const card = ack?.[rule];
  return { flow: flow.id, rule, where, message, acknowledged: card && CARD_RE.test(card) ? card : null };
}

/** Check one flow. Returns an array of findings `{flow, rule, where, message, acknowledged}`. */
export function checkFlow(flow) {
  const out = [];
  const ids = new Set(flow.states.map((s) => s.id));
  const exits = outgoing(flow);
  const ref = (id, where, what) => {
    if (id != null && !isHandoff(id) && !ids.has(id)) out.push(finding(flow, 'dangling-ref', where, `${what} "${id}" is not a state`));
  };
  const badAck = (ack, where) => {
    for (const [rule, card] of Object.entries(ack ?? {})) {
      if (!CARD_RE.test(String(card))) out.push(finding(flow, 'bad-ack', where, `ack for ${rule} is "${card}", not a card id (#NNNN or xHASH)`));
    }
  };

  for (const e of entries(flow)) ref(e.state, 'entry', 'entry state');
  for (const t of flow.transitions ?? []) {
    ref(t.from, `transition ${t.from}→${t.to}`, 'from');
    ref(t.to, `transition ${t.from}→${t.to}`, 'to');
  }

  const stepIds = new Set((flow.steps ?? []).map((st) => st.id));
  if (flow.steps != null && !Array.isArray(flow.steps)) out.push(finding(flow, 'bad-shape', 'steps', '`steps` must be a top-level array'));
  const reach = reachable(flow);
  for (const s of flow.states) {
    const where = `state ${s.id}`;
    badAck(s.ack, where);
    for (const st of s.steps ?? []) {
      if (typeof st !== 'string') out.push(finding(flow, 'bad-shape', where, 'state.steps lists step ids; step objects belong in the top-level `steps` array'));
      else if (!stepIds.has(st)) out.push(finding(flow, 'dangling-ref', where, `step "${st}" is not a step`));
    }
    if (!reach.has(s.id)) out.push(finding(flow, 'unreachable', where, RULES.unreachable, s.ack));
    if (!s.terminal) {
      if (!s.owner || s.owner === 'none') out.push(finding(flow, 'no-owner', where, `nothing acts on "${s.label ?? s.id}"${s.notes ? ` — ${s.notes}` : ''}`, s.ack));
      if ((exits.get(s.id) ?? []).length === 0) out.push(finding(flow, 'failure-no-exit', where, 'non-terminal state has no way out', s.ack));
    } else if (s.outcome === 'failure' && !s.escalation) {
      out.push(finding(flow, 'silent-failure', where, `"${s.label ?? s.id}" ends the flow and tells no one`, s.ack));
    }
    if (s.wait) {
      ref(s.wait.onTimeout, where, 'wait.onTimeout');
      if (s.wait.timeout == null) out.push(finding(flow, 'unbounded-wait', where, `waits for ${s.wait.for ?? 'something'} with no timeout`, s.ack));
      else if (!s.wait.onTimeout) out.push(finding(flow, 'unbounded-wait', where, `times out after ${s.wait.timeout} but nothing handles the timeout`, s.ack));
    }
    if (s.retries) {
      ref(s.retries.onCap, where, 'retries.onCap');
      if (s.retries.cap == null) out.push(finding(flow, 'uncapped-retry', where, `retries ${s.retries.what ?? ''} with no cap`.trim(), s.ack));
      else if (!s.retries.onCap) out.push(finding(flow, 'uncapped-retry', where, `retry cap ${s.retries.cap} reached → nowhere`, s.ack));
    }
    if (s.escalation && s.escalation.to && s.escalation.to !== 'operator') ref(s.escalation.to, where, 'escalation.to');
  }

  const IN = guaranteedFacts(flow);
  const cur = new Map(); // state id → facts holding before the next step of that state (array order)
  for (const st of flow.steps ?? []) {
    const where = `step ${st.id}`;
    badAck(st.ack, where);
    ref(st.state, where, 'step state');
    if (st.onFailure) ref(st.onFailure, where, 'onFailure');
    if (st.canFail && !st.onFailure) out.push(finding(flow, 'failure-no-exit', where, `can fail but has no onFailure`, st.ack));
    if (!cur.has(st.state)) cur.set(st.state, new Set(IN.get(st.state) ?? []));
    const have = cur.get(st.state);
    if (IN.has(st.state)) {
      for (const f of st.assumes ?? []) {
        if (!have.has(factKey(f))) {
          out.push(finding(flow, 'unprovided-assumption', where, `assumes ${factKey(f)} but no earlier step guarantees it on every path`, st.ack));
        }
      }
    }
    applyStep(have, st);
  }
  return out;
}

/** Check many flows; also flags hand-offs to unknown flows / states. */
export function checkFlows(flows) {
  const byId = new Map(flows.map((f) => [f.id, f]));
  const out = [];
  for (const flow of flows) {
    out.push(...checkFlow(flow));
    for (const t of flow.transitions ?? []) {
      if (!isHandoff(t.to)) continue;
      const [fid, sid] = t.to.slice(1).split('#');
      const target = byId.get(fid);
      if (!target) out.push(finding(flow, 'dangling-ref', `transition ${t.from}→${t.to}`, `hand-off to unknown flow "${fid}"`));
      else if (sid && !target.states.some((s) => s.id === sid)) out.push(finding(flow, 'dangling-ref', `transition ${t.from}→${t.to}`, `hand-off to unknown state "${sid}" in flow "${fid}"`));
    }
  }
  return out;
}

// ── Mermaid rendering ──────────────────────────────────────────────────────────────────────────────

const mid = (s) => String(s).replace(/[^A-Za-z0-9_]/g, '_');
const esc = (s) => String(s).replace(/#/g, '#35;').replace(/"/g, "'").replace(/[<>]/g, (c) => (c === '<' ? '‹' : '›'));

/** Mermaid `flowchart` for one flow. Unowned states are red, unbounded waits dashed-orange, terminals rounded. */
export function flowToMermaid(flow, { prefix = 's_', standalone = true } = {}) {
  const lines = [];
  const findings = checkFlow(flow);
  // Acknowledged findings are still real gaps (a card is open for them), so they are drawn too.
  const flagged = (id, rule) => findings.some((f) => f.where === `state ${id}` && f.rule === rule);
  if (standalone) lines.push('flowchart TD');
  const P = (id) => `${prefix}${mid(id)}`;
  entries(flow).forEach((e, i) => lines.push(`  ${P(`__entry${i}`)}(( )) -->${e.on ? `|"${esc(e.on)}"|` : ''} ${P(e.state)}`));
  for (const s of flow.states) {
    const owner = s.terminal ? '' : `<br/><i>${esc(s.owner && s.owner !== 'none' ? s.owner : 'NO OWNER')}</i>`;
    const wait = s.wait ? `<br/>⏱ ${esc(s.wait.timeout ?? '∞')}` : '';
    const label = `"${esc(s.label ?? s.id)}${owner}${wait}"`;
    lines.push(s.terminal ? `  ${P(s.id)}([${label}])` : `  ${P(s.id)}[${label}]`);
    if (flagged(s.id, 'no-owner')) lines.push(`  class ${P(s.id)} noOwner`);
    else if (flagged(s.id, 'unbounded-wait')) lines.push(`  class ${P(s.id)} unbounded`);
    else if (s.terminal && s.outcome === 'failure') lines.push(`  class ${P(s.id)} fail`);
  }
  for (const t of flow.transitions ?? []) {
    const arrow = { failure: '-.->', timeout: '-.->', escalation: '==>' }[t.kind] ?? '-->';
    const to = isHandoff(t.to) ? `${prefix}ho_${mid(t.to)}` : P(t.to);
    if (isHandoff(t.to)) lines.push(`  ${to}{{"${esc(t.to)}"}}`);
    lines.push(`  ${P(t.from)} ${arrow}|"${esc(t.on ?? t.kind ?? '')}"| ${to}`);
  }
  if (standalone) lines.push(...CLASSDEFS);
  return lines.join('\n');
}

const CLASSDEFS = [
  '  classDef noOwner fill:#fde2e2,stroke:#c0392b,stroke-width:2px',
  '  classDef unbounded fill:#fff3d6,stroke:#d68910,stroke-dasharray:4 3',
  '  classDef fail fill:#eee,stroke:#7f8c8d',
];

/** One combined graph: a subgraph per flow, hand-off edges drawn between subgraphs. */
export function combinedMermaid(flows) {
  const lines = ['flowchart LR'];
  for (const f of flows) {
    lines.push(`  subgraph ${mid(f.id)}["${esc(f.title ?? f.id)}"]`);
    lines.push(`    direction TB`);
    const body = flowToMermaid(f, { prefix: `${mid(f.id)}__`, standalone: false })
      .split('\n')
      .filter((l) => !/\{\{"@/.test(l) && !/ho_/.test(l));
    lines.push(...body.map((l) => `  ${l}`));
    lines.push('  end');
  }
  const byId = new Map(flows.map((f) => [f.id, f]));
  for (const f of flows) {
    for (const t of f.transitions ?? []) {
      if (!isHandoff(t.to)) continue;
      const [fid, sid] = t.to.slice(1).split('#');
      const target = byId.get(fid);
      if (!target) continue;
      lines.push(`  ${mid(f.id)}__${mid(t.from)} -.->|"${esc(t.on ?? 'hand-off')}"| ${mid(fid)}__${mid(sid ?? target.entry.state)}`);
    }
  }
  lines.push(...CLASSDEFS);
  return lines.join('\n');
}
