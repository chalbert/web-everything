// Executable fixture tools. Only the four real planning CLIs may run; no host network/pool access.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const args = process.argv.slice(2);
const tool = path.basename(process.argv[1]);
const script = path.basename(args[0] || '');
fs.appendFileSync(process.env.SOAK_CALLS, JSON.stringify({ tool, script, args: args.slice(1) }) + '\n');
const json = value => process.stdout.write(JSON.stringify(value));
const slow = () => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1250);
if (tool === 'node') {
  if (['tick-core.mjs', 'conveyor-state.mjs', 'dispatch-plan.mjs', 'scope-lease-collect.mjs'].includes(script)) {
    const r = cp.spawnSync(process.execPath, args, { stdio: 'inherit', env: process.env });
    process.exit(r.status ?? 1);
  } else if (script === 'lane-pool.mjs' && args[1] === 'status') {
    slow(); json({ lanes: Array.from({ length: 90 }, (_, i) => ({ lane: i + 1, path: `/fixture/lane-${i + 1}`, leased: false, clean: true })) });
  } else if (script === 'lane-pool.mjs' && args[1] === 'list') {
    slow(); json(['/fixture/lane-1', '/fixture/lane-2']);
  } else if (script === 'backlog.mjs' && args[1] === 'build-queue') {
    slow(); json({ queue: [] });
  } else if (['heavy-admission.mjs', 'branch-drift.mjs', 'cli.mjs'].includes(script)) json({});
  else { process.stderr.write(`unexpected node tool: ${args.join(' ')}`); process.exit(1); }
} else if (tool === 'gh') {
  if (args.includes('-i')) process.stdout.write('HTTP/2.0 200 OK\r\nEtag: "fixture"\r\n\r\n');
  json([]);
} else if (tool === 'claude' && args[0] === 'agents') json([]);
else if (tool === 'git') {
  if (args[0] === 'remote') process.stdout.write('https://github.com/fixture/builder.git\n');
  else if (args[0] === 'rev-parse' && args.includes('--is-shallow-repository')) process.stdout.write('false\n');
  else if (args[0] === 'rev-parse') process.stdout.write('a'.repeat(40)+'\n');
  else if (!['log', 'notes', 'merge-base', 'ls-tree', 'show', 'diff', 'rev-list', 'status', 'config'].includes(args[0])) {
    process.stderr.write(`unexpected git: ${args.join(' ')}`); process.exit(1);
  }
} else { process.stderr.write(`unexpected tool ${tool}`); process.exit(1); }
