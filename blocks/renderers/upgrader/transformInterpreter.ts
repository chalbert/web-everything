/**
 * @file blocks/renderers/upgrader/transformInterpreter.ts
 * @description Version-migration **transform interpreter** — slice (b) of the ratified #191 upgrader
 *   (Fork 2 = declarative-first with an imperative escape hatch). It EXECUTES the ordered plan that
 *   slice (a) ({@link ./versionMigrationPlanner}) produces: each `MigrationStep` carries a migration
 *   linkage that is either a DECLARATIVE transform the engine interprets natively (no codemod to write
 *   or trust) or an IMPERATIVE codemod reference run under #102's author/integrity-hash trust metadata.
 *   The rewritten source is then handed to slice (c) for the existing `verifyUpgrade` gate.
 *
 * **Declarative-first (the OpenRewrite principle, #191 Fork 2).** The native vocabulary is the four
 * mechanically-distinct change-kinds enumerated on {@link DeclarativeChangeKind} in the planner — the
 * #191 held-open sub-decision, resolved by "a kind earns a slot only if it maps to a distinct markup
 * mechanic." Anything too complex to declare drops to the imperative escape hatch — never silently
 * skipped: a step that can't be interpreted is returned `applied: false` with a diagnostic.
 *
 * **Trust is the gate on imperative code (#102).** The interpreter NEVER runs an arbitrary module: an
 * imperative migration is resolved from an injected, caller-owned {@link CustomCodemodRegistry} (a
 * devtools provider seam — same discipline as the analyzer seam in {@link ./upgraderEngine}, no global
 * singleton) and run only when the registered codemod's `integrity` matches the manifest author's
 * declared hash. A missing, untrusted, or throwing codemod is refused with a diagnostic, not executed.
 *
 * **Markup model.** Transforms operate on the consumer's declarative markup via a DOM round-trip (the
 * same `document`-based approach `upgraderEngine`'s `normalizeHtml` uses). Output is DOM-reserialized;
 * any incidental quoting/ordering normalisation is washed out downstream by slice (c)'s `verifyUpgrade`
 * fidelity check, which compares both sides through the same round-trip.
 */
import type {
  DeclarativeTransform,
  ImperativeMigration,
  MigrationPlan,
  MigrationRef,
} from './versionMigrationPlanner';

// ── Imperative codemod provider seam (injected devtools registry, no global) ──────────────────────

/** A consumer-registered codemod. `integrity` must match the manifest's declared hash to be run. */
export interface RegisteredCodemod {
  readonly ref: string;
  readonly integrity: string;
  /** Pure source→source rewrite for the change too complex to declare. */
  readonly apply: (source: string) => string;
}

/**
 * Registry of trusted codemods, constructed and owned by the caller and handed into the interpreter —
 * a devtools provider seam (same shape/discipline as `CustomAnalyzerRegistry`, deliberately no shared
 * singleton). Resolution is by `ref`; the trust check (integrity match) happens at run time.
 */
export class CustomCodemodRegistry {
  #byRef = new Map<string, RegisteredCodemod>();

  register(codemod: RegisteredCodemod): this {
    this.#byRef.set(codemod.ref, codemod);
    return this;
  }
  resolve(ref: string): RegisteredCodemod | null {
    return this.#byRef.get(ref) ?? null;
  }
  ids(): string[] {
    return [...this.#byRef.keys()];
  }
}

// ── Interpreter results ───────────────────────────────────────────────────────────────────────────

export interface InterpretResult {
  /** Which path ran: a native declarative interpret, a trusted imperative codemod, or a deferral. */
  readonly mode: 'declarative' | 'imperative' | 'deferred';
  /** Did the transform change the source? `false` for a no-match or any deferral. */
  readonly applied: boolean;
  /** The rewritten source (unchanged from input when `applied` is false). */
  readonly output: string;
  /** What changed — surfaced, never silent. */
  readonly notes: string[];
  /** Why a transform was deferred / partially flagged (untrusted codemod, no replacement, …). */
  readonly diagnostics: string[];
}

export interface InterpretOptions {
  /** Codemod registry for the imperative escape hatch. Omit if the plan is purely declarative. */
  readonly codemods?: CustomCodemodRegistry;
}

const deferred = (source: string, reason: string): InterpretResult => ({
  mode: 'deferred',
  applied: false,
  output: source,
  notes: [],
  diagnostics: [reason],
});

// ── DOM helpers ───────────────────────────────────────────────────────────────────────────────────

/** Parse `source` into a detached host, run `mutate`, and reserialize. */
function inHost(source: string, mutate: (host: HTMLElement) => void): string {
  const host = document.createElement('div');
  host.innerHTML = source;
  mutate(host);
  return host.innerHTML;
}

/** Selector for an optional element scope — a bare tag, or `*` for "any element". */
const scope = (element?: string): string => (element && element !== '*' ? element : '*');

/** Re-namespace tag prefixes nested-safe: process descendants before ancestors (reverse pre-order). */
function renameTagPrefix(host: HTMLElement, from: string, to: string, onChange: () => void): void {
  const matches = [...host.querySelectorAll('*')].filter((el) => el.tagName.toLowerCase().startsWith(from));
  for (const el of matches.reverse()) {
    const repl = document.createElement(to + el.tagName.toLowerCase().slice(from.length));
    for (const attr of [...el.attributes]) repl.setAttribute(attr.name, attr.value);
    while (el.firstChild) repl.appendChild(el.firstChild);
    el.replaceWith(repl);
    onChange();
  }
}

const describe = (t: DeclarativeTransform): string => {
  switch (t.kind) {
    case 'rename-attr':
      return `renamed @${t.from}→@${t.to}`;
    case 'move-dimension':
      return `moved @${t.from}→@${t.to}`;
    case 'retire-provider':
      return `retired provider "${t.retired}" on @${t.attribute}`;
    case 're-namespace':
      return `re-namespaced <${t.from}*>→<${t.to}*>`;
  }
};

// ── Declarative interpretation ──────────────────────────────────────────────────────────────────────

function interpretDeclarative(source: string, t: DeclarativeTransform): InterpretResult {
  const diagnostics: string[] = [];
  let changes = 0;

  const output = inHost(source, (host) => {
    switch (t.kind) {
      case 'rename-attr': {
        for (const node of host.querySelectorAll(scope(t.element))) {
          if (node.hasAttribute(t.from)) {
            const value = node.getAttribute(t.from) ?? '';
            node.removeAttribute(t.from);
            node.setAttribute(t.to, value);
            changes++;
          }
        }
        break;
      }
      case 'move-dimension': {
        for (const node of host.querySelectorAll(scope(t.element))) {
          if (node.hasAttribute(t.from)) {
            const raw = node.getAttribute(t.from) ?? '';
            const mapped = t.valueMap?.[raw] ?? raw;
            if (t.valueMap && !(raw in t.valueMap)) {
              diagnostics.push(`move-dimension: value "${raw}" has no entry in valueMap — moved verbatim`);
            }
            node.removeAttribute(t.from);
            node.setAttribute(t.to, mapped);
            changes++;
          }
        }
        break;
      }
      case 'retire-provider': {
        for (const node of host.querySelectorAll(scope(t.element))) {
          if (node.getAttribute(t.attribute) === t.retired) {
            if (t.replacement !== undefined) {
              node.setAttribute(t.attribute, t.replacement);
              changes++;
            } else {
              diagnostics.push(
                `retire-provider: "${t.retired}" on @${t.attribute} is retired with no replacement — manual intervention required`,
              );
            }
          }
        }
        break;
      }
      case 're-namespace': {
        renameTagPrefix(host, t.from, t.to, () => changes++);
        break;
      }
    }
  });

  return {
    mode: 'declarative',
    applied: changes > 0,
    output,
    notes: changes > 0 ? [`${describe(t)} — ${changes} site(s)`] : [],
    diagnostics,
  };
}

// ── Imperative escape hatch (trust-gated) ───────────────────────────────────────────────────────────

function runImperative(source: string, m: ImperativeMigration, registry?: CustomCodemodRegistry): InterpretResult {
  if (!registry) {
    return deferred(source, `imperative migration "${m.ref}" needs a codemod registry, but none was provided`);
  }
  const codemod = registry.resolve(m.ref);
  if (!codemod) {
    return deferred(source, `no codemod registered for ref "${m.ref}" (have: ${registry.ids().join(', ') || 'none'})`);
  }
  if (codemod.integrity !== m.integrity) {
    return deferred(
      source,
      `codemod "${m.ref}" integrity mismatch — manifest declares ${m.integrity}, registered codemod is ${codemod.integrity}; refusing to run untrusted code`,
    );
  }
  let output: string;
  try {
    output = codemod.apply(source);
  } catch (e) {
    return deferred(source, `codemod "${m.ref}" threw: ${(e as Error).message}`);
  }
  return {
    mode: 'imperative',
    applied: output !== source,
    output,
    notes: [`ran trusted codemod "${m.ref}" by ${m.author}`],
    diagnostics: [],
  };
}

// ── Public surface ──────────────────────────────────────────────────────────────────────────────────

/** Interpret one migration linkage against `source`. Never throws — a failure becomes a deferral. */
export function interpretMigration(source: string, migration: MigrationRef, opts: InterpretOptions = {}): InterpretResult {
  return migration.mode === 'declarative'
    ? interpretDeclarative(source, migration.transform)
    : runImperative(source, migration, opts.codemods);
}

export interface PlanInterpretResult {
  /** Source after every step applied in order (steps that deferred leave it unchanged). */
  readonly output: string;
  /** Per-step result, in plan order. */
  readonly results: readonly InterpretResult[];
  /** Steps that changed the source. */
  readonly applied: number;
  /** Steps that deferred (untrusted/missing codemod, no-replacement flag, …). */
  readonly deferred: number;
  /** Every step's diagnostics, flattened. */
  readonly diagnostics: string[];
}

/**
 * Apply a whole {@link MigrationPlan}'s ordered steps, threading each step's output into the next — the
 * version-gated, intermediate-spanning run loop (#191, Angular `ng update` shape) executed. A deferred
 * step passes the source through untouched so the chain continues; the result tallies applied vs deferred.
 */
export function applyMigrationPlan(source: string, plan: MigrationPlan, opts: InterpretOptions = {}): PlanInterpretResult {
  let current = source;
  const results: InterpretResult[] = [];
  for (const step of plan.steps) {
    const result = interpretMigration(current, step.migration, opts);
    results.push(result);
    current = result.output;
  }
  return {
    output: current,
    results,
    applied: results.filter((r) => r.applied).length,
    deferred: results.filter((r) => !r.applied).length,
    diagnostics: results.flatMap((r) => r.diagnostics),
  };
}
