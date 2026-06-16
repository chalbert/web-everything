/**
 * @file webcases/compileRequirement.ts
 * @description Requirement-as-code **slice B** (backlog #797): the deterministic compiler that projects a
 *   typed requirement record (the #100 slice-A schema, `./requirementValidator.ts`) into one-or-many
 *   webcases — the **compile-to** relationship ratified in #714 fork 2. The requirement is the
 *   human-authored source; the webcase is the derived, machine-checkable artifact. WE-resident and
 *   dependency-free (the `webcases/driftCheck.ts` pattern).
 *
 * Deterministic: same record → byte-identical output, no I/O, no clock. Compiles only the typed,
 * registry-grounded record; requirements that don't ground are the AI test-generator's domain (a
 * Plateau-served provider, #475 no-leakage) and are **out of scope here**.
 *
 * 1:N is the contract (`compileRequirement` returns an array): a record's `then` can carry several
 * observable outcomes, each projecting to its own check. The slice-A schema carries a single `then`, so a
 * single-outcome record compiles 1:1; the array return + the per-outcome fan-out keep it 1:N-ready.
 */
import type { RequirementRecord } from './requirementValidator';

/** A compiled webcase artifact — the in-memory shape `src/_data/cases.js` parses from `src/cases/*`. */
export interface WebCase {
  id: string;
  title: string;
  description: string;
  /** The scenario source: a `WEB CASE` header comment carrying the typed Given/When/Then references. */
  code: string;
}

/** Deterministic kebab-case slug for a stable webcase id (no randomness, no clock). */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'requirement';
}

/** Each `then` outcome a requirement carries (slice A: exactly one; the loop keeps the fan-out 1:N-ready). */
function outcomes(record: RequirementRecord): RequirementRecord['then'][] {
  return [record.then];
}

/**
 * Compile a (validated) requirement record into one-or-many webcases — the deterministic 1:N projection.
 * Each `then` outcome becomes a machine-checkable scenario asserting it under the requirement's
 * `given` precondition and `when` trigger.
 */
export function compileRequirement(record: RequirementRecord): WebCase[] {
  const givenLine = `Given ${record.given.intent}.${record.given.dimension} = ${record.given.value}`;
  const whenLine = `When ${record.when.event}`;
  const base = slugify(record.description);

  return outcomes(record).map((then, i) => {
    const thenLine = `Then ${then.protocol} observes ${then.observe} at ${then.tier}`;
    const suffix = outcomes(record).length > 1 ? `-${i + 1}` : '';
    const title = `${record.description} — ${then.observe} (${then.tier})`;
    const code = [
      '<!--',
      `  WEB CASE: ${record.description}`,
      `  Compiled from a typed requirement (requirement-as-code #100/#797) — do not hand-edit.`,
      `  ${givenLine}`,
      `  ${whenLine}`,
      `  ${thenLine}`,
      `  role: ${record.role ?? '—'}`,
      '-->',
      `<!-- assert: protocol="${then.protocol}" observe="${then.observe}" tier="${then.tier}" -->`,
    ].join('\n');

    return {
      id: `${base}${suffix}.html`,
      title,
      description: `Compiled requirement: when ${record.when.event} while ${record.given.intent}.${record.given.dimension} is ${record.given.value}, ${then.protocol} reaches ${then.observe} at ${then.tier}.`,
      code,
    };
  });
}
