/**
 * @file guard-bash-fuzz.test.mjs — generative equivalence fuzz for the git-add ENUMERATION guard (#3452).
 * PR #1816's review of #2968 found that three spellings equivalent to an already-guarded operand slipped
 * past `reason()`/`decide()`: a bare `.` vs `./` vs `./.`; the combined-short-flag clusters `-vA`/`-Av` vs
 * `-A`; and the pipe-sink's enumeration source `-su` vs `-s`. Each is fixed by #2968/#1816 as ONE guarded
 * shape with SEVERAL equivalent spellings, not several independent shapes — so this file pins the
 * equivalence GENERATIVELY (a spelling table per operand family, crossed against a command builder) rather
 * than as literal cases. A next equivalent spelling for an existing family is one array entry to add, not a
 * new test — and the loop fails the moment any ONE spelling stops denying, proving the pin actually holds.
 */
import { describe, it, expect } from 'vitest';
import { decide, reason } from '../guard-bash.mjs';

const ENUMERATION_MESSAGE = /stages a path set you did not name/;

const FAMILIES = [
  {
    name: 'bare-dot direct shape',
    spellings: ['.', './', './.'],
    build: (operand) => `git add ${operand}`,
  },
  {
    name: 'combined-short-flag direct shape',
    spellings: ['-A', '-vA', '-Av'],
    build: (flag) => `git add ${flag}`,
  },
  {
    name: 'git-status enumeration source (pipe/xargs sink)',
    spellings: ['-s', '--short', '--porcelain', '-su'],
    build: (flag) => `git status ${flag} | xargs git add`,
  },
];

describe('guard-bash — git-add ENUMERATION equivalent spellings (fuzz, #3452)', () => {
  for (const family of FAMILIES) {
    it(`${family.name} — every listed spelling denies via decide()`, () => {
      for (const spelling of family.spellings) {
        const cmd = family.build(spelling);
        expect(decide(cmd, {}), cmd).toMatch(ENUMERATION_MESSAGE);
      }
    });
  }

  // The two DIRECT families (no pipe) are also caught per-segment by `reason()` alone, ahead of any
  // whole-command pipe/while-read/-exec analysis `decide()` layers on top — pin that entrypoint too.
  for (const family of FAMILIES.filter((f) => f.name !== 'git-status enumeration source (pipe/xargs sink)')) {
    it(`${family.name} — every listed spelling denies via reason()`, () => {
      for (const spelling of family.spellings) {
        const cmd = family.build(spelling);
        expect(reason(cmd, {}), cmd).toMatch(ENUMERATION_MESSAGE);
      }
    });
  }
});
