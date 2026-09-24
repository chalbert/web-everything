/** Pure /wip data projection. Missing provenance remains explicitly unknown. */
import { TASK_LIFECYCLE, TASK_STATUSES, computeParallelEligible, taskSessionName } from './dispatch-contracts.mjs';

const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const array = x => Array.isArray(x) ? x : [];
const scalar = x => typeof x === 'string' ? x : 'unknown';
const supervisorFields = ['provider', 'model', 'sessionId'];
const agentFields = ['provider', 'model', 'executor', 'supervisionLevel', 'sessionName'];
const project = (value, fields) => Object.fromEntries(fields.map(k => [k, value?.[k] === null && ['sessionId', 'executor', 'sessionName'].includes(k) ? null : scalar(value?.[k])]));
function serialized(x) { try { return JSON.stringify(x) ?? ''; } catch { return ''; } }
function usable(rows) {
  return array(rows).filter(r => { try { return object(r) && !!serialized(r) && taskSessionName({ storyRef: r.storyRef, round: r.round, taskId: 'group' }) !== null; } catch { return false; } });
}
function latest(rows) {
  return [...array(rows)].filter(object).sort((a, b) =>
    (Number.isSafeInteger(b.attempt) ? b.attempt : 0) - (Number.isSafeInteger(a.attempt) ? a.attempt : 0)
    || compare(serialized(b), serialized(a)))[0];
}
function canonical(rows) { return [...rows].sort((a, b) => compare(serialized(b), serialized(a)))[0]; }
/** Latest attempt wins across results and acting verdicts; shadow never acts. */
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export function deriveTaskLifecycle(input = {}) {
  try {
    const { results = [], verdicts = [], dispatch = null, task = null, inPlan = !!task } = input;
    const rs = array(results).filter(r => object(r) && Number.isSafeInteger(r.attempt) && r.attempt >= 1);
    const vs = array(verdicts).filter(v => object(v) && v.mode !== 'shadow' && Number.isSafeInteger(v.attempt) && v.attempt >= 1);
    const attempt = latest([...rs, ...vs])?.attempt;
    const v = latest(vs.filter(r => r.attempt === attempt)), r = latest(rs.filter(r => r.attempt === attempt));
    if (v && ['accept', 'rework', 'reject'].includes(v.verdict)) return { accept: 'validated', rework: 'reworked', reject: 'failed' }[v.verdict];
    if (r && TASK_STATUSES.includes(r.status)) return r.status;
    if (dispatch) return 'dispatched';
    if (TASK_LIFECYCLE.includes(task?.status)) return task.status;
    return inPlan ? 'planned' : 'unknown';
  } catch { return 'unknown'; }
}
function dependencyOrder(tasks) {
  const remaining = new Map(tasks.map(t => [t.taskId, t])), done = new Set(), ordered = [];
  while (remaining.size) {
    const eligible = [...remaining.values()].filter(t => (t.dependsOn ?? []).every(id => done.has(id))).sort((a, b) => compare(a.taskId, b.taskId));
    if (!eligible.length) { ordered.push(...[...remaining.values()].sort((a, b) => compare(a.taskId, b.taskId))); break; }
    // Re-evaluate after each node so Kahn ties are always by taskId.
    const next = eligible[0]; remaining.delete(next.taskId); done.add(next.taskId); ordered.push(next);
  }
  return ordered;
}
function parallelComponents(graph) {
  // Connected components, not cliques: a component does not promise all-to-all eligibility.
  const seen = new Set(), groups = [];
  for (const id of [...graph.keys()].sort(compare)) {
    if (seen.has(id)) continue;
    const pending = [id], members = [];
    while (pending.length) {
      const current = pending.pop(); if (seen.has(current)) continue;
      seen.add(current); members.push(current); pending.push(...(graph.get(current) ?? []));
    }
    if (members.length >= 2) groups.push(members.sort(compare));
  }
  return groups.sort((a, b) => compare(a[0], b[0]));
}
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export function buildSupervisionTree(records, options = {}) {
  try {
    if (!object(records)) return [];
    const groups = new Map();
    for (const kind of ['plans', 'results', 'verdicts', 'dispatches']) for (const record of usable(records[kind])) {
      const key = `${record.storyRef}\n${record.round}`;
      if (!groups.has(key)) groups.set(key, { story: record.storyRef, round: record.round, plans: [], results: [], verdicts: [], dispatches: [] });
      groups.get(key)[kind].push(record);
    }
    return [...groups.values()].sort((a, b) => compare(a.story, b.story) || a.round - b.round).map(g => {
      const plan = canonical(g.plans), supervisorDispatch = canonical(g.dispatches.filter(d => d.kind === 'supervisor'));
      const sv = plan?.supervisor ?? supervisorDispatch?.supervisor ?? latest(g.verdicts)?.supervisor;
      const supervisor = project(sv, supervisorFields);
      if (plan?.supervisor?.sessionId === null && typeof supervisorDispatch?.supervisor?.sessionId === 'string') supervisor.sessionId = supervisorDispatch.supervisor.sessionId;
      const parallel = computeParallelEligible(plan), graph = new Map();
      if (parallel.ok) for (const [a, b] of parallel.pairs) {
        if (!graph.has(a)) graph.set(a, new Set()); if (!graph.has(b)) graph.set(b, new Set());
        graph.get(a).add(b); graph.get(b).add(a);
      }
      const planTasks = array(plan?.tasks).filter(object), ids = new Set(planTasks.map(t => t.id));
      for (const r of [...g.results, ...g.verdicts, ...g.dispatches.filter(d => d.kind === 'task')]) ids.add(r.taskId);
      const tasks = [...ids].filter(id => typeof id === 'string' && /^[A-Za-z0-9._-]+$/.test(id)).map(taskId => {
        const task = canonical(planTasks.filter(t => t.id === taskId));
        const results = g.results.filter(r => r.taskId === taskId), verdicts = g.verdicts.filter(v => v.taskId === taskId);
        const dispatch = canonical(g.dispatches.filter(d => d.kind === 'task' && d.taskId === taskId));
        const agent = project(dispatch?.agent ?? task?.agent ?? latest(results), agentFields);
        return { taskId, title: scalar(task?.title), status: deriveTaskLifecycle({ results, verdicts, dispatch, task }), agent,
          dependsOn: task ? Array.isArray(task.dependsOn) ? [...task.dependsOn].filter(id => typeof id === 'string').sort(compare) : null : null,
          complexity: scalar(task?.profile?.complexity), risk: scalar(task?.profile?.risk), parallelWith: [...(graph.get(taskId) ?? [])].sort(compare) };
      });
      const counts = Object.fromEntries(['total', ...TASK_LIFECYCLE, 'unknown'].map(k => [k, 0]));
      counts.total = tasks.length; for (const task of tasks) counts[task.status]++;
      return { story: g.story, round: g.round, asOf: typeof options?.now === 'string' ? options.now : null,
        supervisor, tasks: dependencyOrder(tasks), parallelGroups: parallel.ok ? parallelComponents(graph) : [], parallelKnown: !!parallel.ok, counts };
    });
  } catch { return []; }
}
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export function renderSupervisionTreeMarkdown(tree) {
  const empty = '_no supervision data_';
  try {
    if (!Array.isArray(tree) || !tree.length) return empty;
    const lines = [];
    for (const g of tree) {
      if (!object(g) || typeof g.story !== 'string' || !Number.isSafeInteger(g.round) || !object(g.supervisor) || !object(g.counts) || !Array.isArray(g.tasks)) return empty;
      const s = g.supervisor;
      const statuses = [...TASK_LIFECYCLE, 'unknown'];
      if (g.round < 1 || !supervisorFields.every(k => typeof s[k] === 'string' || (k === 'sessionId' && s[k] === null))
        || !['total', ...statuses].every(k => Number.isSafeInteger(g.counts[k]) && g.counts[k] >= 0)
        || g.counts.total !== g.tasks.length || statuses.reduce((sum, k) => sum + g.counts[k], 0) !== g.counts.total) return empty;
      const counts = [...TASK_LIFECYCLE, 'unknown'].filter(k => g.counts[k] > 0).map(k => `${k} ${g.counts[k]}`).join(', ');
      lines.push(`- **${g.story} r${g.round}** — supervisor ${s.provider}/${s.model} [${s.sessionId === null ? 'no-session' : s.sessionId}] — ${g.counts.total} tasks: ${counts}`);
      for (const t of g.tasks) {
        if (!object(t) || !object(t.agent) || !Array.isArray(t.parallelWith)) return empty;
        const a = t.agent;
        if (!['taskId', 'title', 'complexity', 'risk'].every(k => typeof t[k] === 'string') || !statuses.includes(t.status)
          || !agentFields.every(k => typeof a[k] === 'string' || (['executor', 'sessionName'].includes(k) && a[k] === null))
          || !t.parallelWith.every(id => typeof id === 'string')
          || !(t.dependsOn === null || (Array.isArray(t.dependsOn) && t.dependsOn.every(id => typeof id === 'string')))) return empty;
        lines.push(`  - \`${t.taskId}\` ${t.status} — ${a.provider}/${a.model} via ${a.executor === null ? '-' : a.executor} (${a.supervisionLevel}) — ${t.complexity}/${t.risk} — ${t.title}${t.parallelWith.length ? ` — parallel: ${t.parallelWith.join(',')}` : ''}${Array.isArray(t.dependsOn) && t.dependsOn.length ? ` — after: ${t.dependsOn.join(',')}` : ''}`);
      }
    }
    return lines.join('\n');
  } catch { return empty; }
}
