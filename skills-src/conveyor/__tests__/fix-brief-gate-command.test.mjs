/**
 * @file skills-src/conveyor/__tests__/fix-brief-gate-command.test.mjs
 * @description Brief-lint (#4369): every verify-lane command a fix / ci-heal brief tells its agent to run must be
 *   one the agent's own guard permits for that dispatch kind, and step 4 must key its red branch to the `check`
 *   output. Fails if a brief names a command `dispatchedAgentVerificationReason` denies.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { dispatchedAgentVerificationReason } from '../../../scripts/guard-bash.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

function fill(text) {
  return text.replace(/\{\{WE_ROOT\}\}/g, '/we').replace(/\{\{GATE_COMMAND\}\}/g, 'node /we/scripts/verify-lane.mjs run --repo=.');
}

function fencedCommands(text) {
  const cmds = [];
  for (const m of text.matchAll(/```bash\n([\s\S]*?)```/g)) {
    for (const line of m[1].split('\n')) {
      const cmd = line.replace(/\s+#.*$/, '').trim();
      if (cmd) cmds.push(cmd);
    }
  }
  return cmds;
}

for (const [file, kind] of [['fix-agent-brief.md', 'fix'], ['fix-agent-ci-brief.md', 'ci-heal']]) {
  describe(`${file} — gate commands vs the ${kind} guard`, () => {
    const filled = fill(readFileSync(join(HERE, '..', file), 'utf8'));
    const gateLines = fencedCommands(filled).filter((c) => /verify-lane|test:unit|heavy-admission/.test(c));

    it('names a verify-lane request and a check in its bash fences', () => {
      expect(gateLines.some((c) => /verify-lane\.mjs request\b/.test(c))).toBe(true);
      expect(gateLines.some((c) => /verify-lane\.mjs check --wait=9600000 --json\b/.test(c))).toBe(true);
    });

    it('no gate/verify command in a bash fence is denied for this kind', () => {
      for (const c of gateLines) expect(dispatchedAgentVerificationReason(c, kind), c).toBeNull();
    });

    it('keys the red branch to the `check` output, not the request call', () => {
      const step4 = filled.split(/### 4\./)[1].split(/### 5\./)[0];
      expect(step4).toMatch(/`check` output/);
      expect(step4).toMatch(/`red` \(exit 2\)/);
    });
  });
}

for (const file of ['fix-agent-brief.md', 'fix-agent-ci-brief.md', 'delivery-agent-brief.md']) {
  it(`${file} instructs one budget-sized wait and completion notification`, () => {
    const text = readFileSync(join(HERE, '..', file), 'utf8');
    expect(text).toMatch(/ONE .*check --wait=9600000/);
    expect(text).toMatch(/completion\s+notification/);
    expect(text).not.toMatch(/call `check --wait=.*again|--wait=60000/);
    expect(text).toContain('infrastructure-failure');
  });
}
