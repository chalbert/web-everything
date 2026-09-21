import { describe, it, expect } from 'vitest';

import {
  COMMAND_CLASSES, CONTAINER_ACTIVE_CPU_PCT, HEAVY_CLASSES, NOT_QUIET_CLASSES, SYSTEM_CLASSES, WORKER_KINDS, classifyCommandClass, refineWithRoster, summarizeClasses, workerKind,
} from '../host-sampler-classes.mjs';
import { classifyFamily } from '../host-sampler.mjs';

describe('classifyCommandClass — the fixed command-class table', () => {
  const table = [
    // heavy commands, each its OWN class
    ['node (vitest)', 'vitest'],
    ['node (vitest 3)', 'vitest'],
    ['npm exec vitest run scripts', 'vitest'],
    ['node /w/node_modules/vitest/dist/workers/forks.js', 'vitest'],
    ['npm run test:unit', 'vitest'],
    ['sh -c npm run test:unit', 'vitest'],
    // a compound shell line names two heavy commands: the FIXED rule order decides (check-standards before vitest); it burns ~0 CPU itself
    ['sh -c npm run test:unit && npm run check:standards', 'check-standards'],
    ['node scripts/check-standards.mjs', 'check-standards'],
    ['npm run check:standards', 'check-standards'],
    ['node scripts/readiness/verify-lane.mjs --lane=3', 'verify-lane'],
    ['node /w/.lanes/web-everything/lane-3/scripts/verify-lane.mjs', 'verify-lane'],
    ['node /w/node_modules/.bin/playwright test tests/visual', 'playwright'],
    ['/Users/u/Library/Caches/ms-playwright/chromium-1140/chrome-mac/Chromium.app/Contents/MacOS/Chromium --headless', 'playwright'],
    // the admission wrapper is a holder, not the work
    ['node scripts/readiness/heavy-admission.mjs run -- npm run check:standards', 'node-tooling'],
    // the operator's dev servers
    ['node /w/lane-3/node_modules/.bin/eleventy --serve --port=8080 --quiet', 'eleventy-or-vite-dev'],
    ['npm exec @11ty/eleventy --serve --port=8080', 'eleventy-or-vite-dev'],
    ['node /w/app/node_modules/.bin/vite --port 5173', 'eleventy-or-vite-dev'],
    ['npm start', 'eleventy-or-vite-dev'],
    ['npm run dev', 'eleventy-or-vite-dev'],
    ['node /w/app/node_modules/.bin/vite build', 'node-tooling'],
    // git / npm / node
    ['/Library/Developer/CommandLineTools/usr/bin/git log --diff-filter=A -- backlog', 'git'],
    ['git status --porcelain', 'git'],
    ['git-remote-https origin https://github.com/x/y', 'git'],
    ['npm install --no-audit', 'npm-npx'],
    ['npx tsx scripts/foo.mjs', 'npm-npx'],
    ['node scripts/backlog.mjs build-queue --json', 'node-tooling'],
    ['/bin/bash -c source /Users/u/.claude/shell-snapshots/snapshot.sh && eval "ls"', 'node-tooling'],
    // claude: interactive vs background worker vs review/print vs the idle pool helpers
    ['claude', 'claude-interactive'],
    ['claude --resume abc123', 'claude-interactive'],
    ['/Users/u/.vscode/extensions/anthropic.claude-code-2.1.278-darwin-arm64/resources/native-binary/claude --output-format stream-json --verbose', 'claude-interactive'],
    ['/home/u/.nvm/v22/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe --print --sdk-url https://api.anthropic.com/v1/code/sessions/cse_1 --session-id cse_1', 'claude-interactive'],
    ['claude bg-spare --bg-spare /tmp/cc-daemon-501/x/spare/a.claim.sock', 'claude-background-worker'],
    ['/home/u/.nvm/v22/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe -p do-the-thing --output-format json', 'claude-review-or-print'],
    ['claude --print hello', 'claude-review-or-print'],
    ['claude bg-pty-host --bg-pty-host /tmp/cc-daemon-501/x/spare/a.pty.sock 200 50 -- /x/claude.exe --bg-spare /tmp/a', 'claude-infra'],
    ['/home/u/.nvm/v22/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe daemon run --origin transient', 'claude-infra'],
    // containers
    ['/opt/homebrew/Cellar/container/1.3.1/libexec/container-plugins/container-runtime-linux/bin/container-runtime-linux start --root /x', 'container'],
    ['/opt/homebrew/Cellar/container/1.3.1/libexec/container-apiserver start', 'container'],
    ['container run --rm we-heavy-admission:poc npm run check:standards', 'container'],
    ['/System/Library/Frameworks/Virtualization.framework/Versions/A/XPCServices/com.apple.Virtualization.VirtualMachine.xpc/Contents/MacOS/com.apple.Virtualization.VirtualMachine', 'container'],
    // macOS itself
    ['/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/FSEvents.framework/Versions/A/Support/fseventsd', 'system-macos'],
    ['/System/Library/PrivateFrameworks/PhotoLibraryServices.framework/Versions/A/Support/photolibraryd', 'system-macos'],
    ['/System/Library/PrivateFrameworks/SkyLight.framework/Resources/WindowServer -daemon', 'system-macos'],
    ['/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/Metadata.framework/Versions/A/Support/mds', 'system-macos'],
    ['/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/Metadata.framework/Versions/A/Support/mdworker_shared -s mdworker', 'system-macos'],
    ['/usr/libexec/nsurlsessiond', 'system-macos'],
    ['/usr/sbin/spindump', 'system-macos'],
    ['launchd', 'system-macos'],
    // VS Code
    ['/Applications/Visual Studio Code.app/Contents/Frameworks/Code Helper (Renderer).app/Contents/MacOS/Code Helper (Renderer) --type=renderer', 'vscode'],
    ['/Applications/Visual Studio Code.app/Contents/MacOS/Electron', 'vscode'],
    // everything else, including a flag VALUE that only looks like another class
    ['/Applications/Dashlane.app/Contents/MacOS/Dashlane', 'other'],
    ['/Applications/Slack.app/Contents/MacOS/Slack', 'other'],
    ['grep vitest /tmp/log', 'other'],
    ['tail -f /tmp/check-standards.log', 'other'],
    ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome --user-data-dir=/Users/u/Library/Application Support/Code', 'other'],
    ['', 'other'],
  ];
  for (const [cmd, want] of table) it(`${JSON.stringify(cmd.slice(0, 80))} -> ${want}`, () => expect(classifyCommandClass(cmd)).toBe(want));

  it('every class of the closed list is exercised by the table (an unknown command falls to other)', () => {
    const seen = new Set(table.map(([, want]) => want));
    for (const k of COMMAND_CLASSES) expect(seen.has(k), k).toBe(true);
    expect(classifyCommandClass(undefined)).toBe('other');
    expect(classifyCommandClass('a-brand-new-tool --with flags')).toBe('other');
  });

  it('the class list is the operator\'s fifteen plus claude-infra, heavy classes exclude container, and quiet excludes dev servers', () => {
    expect(COMMAND_CLASSES).toHaveLength(16);
    expect(new Set(COMMAND_CLASSES).size).toBe(16);
    expect(HEAVY_CLASSES).toEqual(['vitest', 'check-standards', 'verify-lane', 'playwright']);
    expect(HEAVY_CLASSES).not.toContain('container');
    expect(NOT_QUIET_CLASSES).toContain('eleventy-or-vite-dev');
    expect(SYSTEM_CLASSES).toEqual(['system-macos', 'vscode']);
    expect(CONTAINER_ACTIVE_CPU_PCT).toBeGreaterThan(0);
  });

  it('the ORIGINAL family table is untouched: check:standards is still node-other there (the gap this table closes)', () => {
    expect(classifyFamily('node scripts/check-standards.mjs')).toBe('node-other');
    expect(classifyCommandClass('node scripts/check-standards.mjs')).toBe('check-standards');
  });
});

describe('refineWithRoster', () => {
  const roster = new Map([[10, { kind: 'review' }], [11, { kind: 'build' }], [12, { kind: 'interactive' }]]);
  it('a bg-spare whose pid is a review session becomes claude-review-or-print; a build one stays a background worker', () => {
    expect(refineWithRoster('claude-background-worker', 10, roster)).toBe('claude-review-or-print');
    expect(refineWithRoster('claude-background-worker', 11, roster)).toBe('claude-background-worker');
    expect(refineWithRoster('claude-background-worker', 12, roster)).toBe('claude-interactive');
  });
  it('an unmatched pid, a non-claude class, claude-infra and a missing roster are never changed', () => {
    expect(refineWithRoster('claude-background-worker', 99, roster)).toBe('claude-background-worker');
    expect(refineWithRoster('vitest', 10, roster)).toBe('vitest');
    expect(refineWithRoster('claude-infra', 10, roster)).toBe('claude-infra');
    expect(refineWithRoster('claude-background-worker', 10, null)).toBe('claude-background-worker');
  });
});

describe('summarizeClasses', () => {
  const rows = [
    { pid: 1, pcpu: 100, rssKb: 1000, command: '/System/Library/CoreServices/fseventsd' },
    { pid: 2, pcpu: 50.04, rssKb: 500, command: 'node scripts/check-standards.mjs' },
    { pid: 3, pcpu: 25, rssKb: 250, command: 'node scripts/check-standards.mjs --fix' },
    { pid: 4, pcpu: 5, rssKb: 40, command: 'some-unknown-tool' },
    { pid: 10, pcpu: 2, rssKb: 100, command: 'claude bg-spare --bg-spare /tmp/x.sock' },
  ];
  it('sums count, CPU and RSS per class and zero-fills every class', () => {
    const s = summarizeClasses(rows);
    expect(Object.keys(s).sort()).toEqual([...COMMAND_CLASSES].sort());
    expect(s['system-macos']).toEqual({ cpuPct: 100, memBytes: 1000 * 1024, count: 1 });
    expect(s['check-standards']).toEqual({ cpuPct: 75, memBytes: 750 * 1024, count: 2 });
    expect(s.other.count).toBe(1);
    expect(s.vitest).toEqual({ cpuPct: 0, memBytes: 0, count: 0 });
  });
  it('UNATTRIBUTED falls: here `other` holds under 10% of the CPU where the old table left it all in node-other/other', () => {
    const s = summarizeClasses(rows);
    const total = Object.values(s).reduce((t, x) => t + x.cpuPct, 0);
    expect(s.other.cpuPct / total).toBeLessThan(0.1);
  });
  it('applies the roster overlay and tolerates junk rows', () => {
    const s = summarizeClasses([...rows, null, 7, {}], { sessionByPid: new Map([[10, { kind: 'review' }]]) });
    expect(s['claude-review-or-print'].count).toBe(1);
    expect(s['claude-background-worker'].count).toBe(0);
  });
});

describe('workerKind', () => {
  it('maps the roster name grammar to the five kinds', () => {
    expect(WORKER_KINDS).toEqual(['build', 'prepare', 'review', 'task', 'interactive']);
    expect(workerKind({ kind: 'background', name: 'build-3717' })).toBe('build');
    expect(workerKind({ kind: 'background', name: 'prepare-3690' })).toBe('prepare');
    expect(workerKind({ kind: 'background', name: 'prepare-decision-3690' })).toBe('prepare');
    expect(workerKind({ kind: 'background', name: 'review-2360' })).toBe('review');
    expect(workerKind({ kind: 'background', name: 'container-test-skip' })).toBe('task');
    expect(workerKind({ kind: 'background', name: 'rebuild-container-image' })).toBe('task');
    expect(workerKind({ kind: 'interactive', name: 'build-1' })).toBe('interactive');
    expect(workerKind({})).toBe('task');
  });
});
