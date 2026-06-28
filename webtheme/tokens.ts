/**
 * @file webtheme/tokens.ts
 * @description Web Theme token model — backlog #404 (Fork 3 of the #364 ruling), built on the #403
 *   webtheme project + DTCG↔CSS protocol.
 *
 * The **concrete-value layer** a design system resolves into. Tokens are authored + interchanged as
 * **DTCG 2025.10** (`{ $type, $value }` nodes with `{group.token}` aliasing — the one legitimate Protocol
 * here, adopted not coined, #403) across a **3-tier** taxonomy:
 *
 *   - **primitive** — raw scales (color / space / radius / elevation / type ramp); owned here.
 *   - **semantic** — NOT a parallel vocabulary: the existing intents (surface/density/typography/motion/
 *     theme-color) ARE the semantic tier; a token never re-coins a role name. (Excluded from this model
 *     by design — see #403.)
 *   - **component** — per-component overrides (a button's own radius/padding), authored as DTCG nodes
 *     that **alias** a primitive (`{radius.md}`) so a component value can never silently disagree with
 *     the scale it points into.
 *
 * This module owns the model + the two operations the rest of webtheme builds on: **`extends`** (a project
 * token document deep-merges over the {@link defaultTokens platform default} — config-extends-platform-
 * default, never authored from scratch) and **alias resolution** (a `{group.token}` ref → its target,
 * cycle- and dangling-ref-checked). The DTCG→CSS compile is its sibling {@link ./compile}. Pure + dependency-free.
 *
 * The DTCG schema types ({@link DtcgType}, {@link DtcgToken}, {@link DtcgGroup}, {@link DtcgDocument},
 * {@link FlatToken}, {@link ResolvedToken}) are the **pure contract** — extracted to {@link ./contract}
 * (the `@webeverything/contracts/webtheme` entry, #1294 T1) so FUI imports them over the FUI→WE arrow. This
 * runtime module `import type`s them and re-exports the surface, so importers reach types + runtime from one
 * site.
 */
import type {
  DtcgDocument,
  DtcgGroup,
  DtcgToken,
  DtcgType,
  FlatToken,
  ResolvedToken,
} from './contract';

export type { DtcgDocument, DtcgGroup, DtcgToken, DtcgType, FlatToken, ResolvedToken } from './contract';

const META_KEYS = new Set(['$type', '$value', '$description']);

/** A node is a token iff it carries `$value`; otherwise it is a group. */
export function isToken(node: unknown): node is DtcgToken {
  return typeof node === 'object' && node !== null && '$value' in (node as object);
}

/** True for a `{group.token}` alias string (DTCG reference syntax). */
export function isAlias(value: unknown): value is string {
  return typeof value === 'string' && /^\{[A-Za-z0-9_.-]+\}$/.test(value);
}

/** The dot-path inside a `{group.token}` alias (no braces), e.g. `{radius.md}` → `radius.md`. */
export function aliasTarget(value: string): string {
  return value.slice(1, -1);
}

/** Global matcher for an embedded `{group.token}` reference (used by templated/calc values). */
const EMBEDDED_REF = /\{([A-Za-z0-9_.-]+)\}/g;

/**
 * True for a **templated** value — a string carrying one or more embedded `{group.token}` refs but which
 * is *not* a bare alias (#1315). The canonical case is a calc-derived offset of a base token,
 * `calc({radius.base} - 2px)` → `calc(var(--radius-base) - 2px)`, so a scale provably tracks its base
 * (shadcn's radius-derivation pattern) instead of drifting. Distinct from {@link isAlias} (a whole-value
 * `{ref}`, compiled to `var(--ref)`); a templated value substitutes each ref in place.
 */
export function isTemplated(value: unknown): value is string {
  return typeof value === 'string' && !isAlias(value) && /\{[A-Za-z0-9_.-]+\}/.test(value);
}

/** The dot-paths of every embedded `{group.token}` ref in a templated value, in source order. */
export function templatedRefs(value: string): string[] {
  return [...value.matchAll(EMBEDDED_REF)].map((m) => m[1]);
}

/** Replace each embedded `{group.token}` ref in a templated value via `replacer(dotPath)`. Pure. */
export function mapTemplatedRefs(value: string, replacer: (path: string) => string): string {
  return value.replace(/\{([A-Za-z0-9_.-]+)\}/g, (_m, ref: string) => replacer(ref));
}

/** The CSS custom-property name for a token path — `['radius','md']` → `--radius-md`. */
export function cssVarName(path: readonly string[]): string {
  return `--${path.join('-')}`;
}

/**
 * Walk a DTCG document into a flat token list, inheriting each token's `$type` from the nearest ancestor
 * group (or its own `$type`). Deterministic depth-first order, so the compiled CSS is stable.
 */
export function flattenTokens(doc: DtcgDocument): FlatToken[] {
  const out: FlatToken[] = [];
  const walk = (node: DtcgGroup, path: string[], inheritedType: DtcgType | undefined): void => {
    const groupType = (node.$type as DtcgType | undefined) ?? inheritedType;
    for (const [key, child] of Object.entries(node)) {
      if (META_KEYS.has(key) || child === undefined) continue;
      if (isToken(child)) {
        out.push({
          path: [...path, key],
          type: child.$type ?? groupType,
          value: child.$value,
          description: child.$description,
        });
      } else if (typeof child === 'object') {
        walk(child as DtcgGroup, [...path, key], groupType);
      }
    }
  };
  walk(doc, [], undefined);
  return out;
}

/** Thrown when an alias points at a missing token or forms a cycle — a malformed token document. */
export class TokenResolutionError extends Error {
  constructor(reason: string) {
    super(`webtheme token resolution — ${reason}`);
    this.name = 'TokenResolutionError';
  }
}

/**
 * Resolve every token's value to a literal, following `{group.token}` alias chains to the end. Throws
 * {@link TokenResolutionError} on a dangling reference or an alias cycle — lossy-but-loud, never a silent
 * bad value. The per-token `aliasOf` is kept so the compiler can emit `var(--ref)` for a direct alias
 * (matching the #403 example `--button-radius: var(--radius-md)`) while still knowing the literal for
 * an `@property` initial-value.
 */
export function resolveTokens(flat: readonly FlatToken[]): ResolvedToken[] {
  const byPath = new Map(flat.map((t) => [t.path.join('.'), t]));

  const resolveValue = (key: string, seen: Set<string>): string | number => {
    const token = byPath.get(key);
    if (!token) throw new TokenResolutionError(`alias points at unknown token "{${key}}"`);
    // A templated/calc value (#1315): substitute each embedded {ref} with its resolved literal so the
    // @property initial-value is a concrete literal (e.g. `calc(0.5rem - 2px)`), cycle/dangling-guarded
    // exactly like a bare alias.
    if (isTemplated(token.value)) {
      return token.value.replace(EMBEDDED_REF, (_m, ref: string) => {
        if (seen.has(ref)) throw new TokenResolutionError(`alias cycle: ${[...seen, ref].join(' → ')}`);
        return String(resolveValue(ref, new Set(seen).add(ref)));
      });
    }
    if (!isAlias(token.value)) return token.value;
    const next = aliasTarget(token.value);
    if (seen.has(next)) throw new TokenResolutionError(`alias cycle: ${[...seen, next].join(' → ')}`);
    return resolveValue(next, new Set(seen).add(next));
  };

  return flat.map((t) => {
    const aliasOf = isAlias(t.value) ? aliasTarget(t.value) : null;
    const key = t.path.join('.');
    return { ...t, aliasOf, resolved: resolveValue(key, new Set([key])) };
  });
}

/**
 * `extends` — the platform-default override mechanism (config-extends-platform-default, #403). Deep-merge
 * a project's `override` token document over the `base` (the {@link defaultTokens} set): a project supplies
 * only the tokens it changes and inherits the complete default for everything else. Token leaves (nodes
 * with `$value`) replace wholesale; groups merge recursively. Pure — neither input is mutated.
 */
export function extendTokens(base: DtcgDocument, override: DtcgDocument): DtcgDocument {
  const merge = (a: DtcgGroup, b: DtcgGroup): DtcgGroup => {
    const out: DtcgGroup = { ...a };
    for (const [key, bVal] of Object.entries(b)) {
      const aVal = out[key];
      if (META_KEYS.has(key) || bVal === undefined) {
        out[key] = bVal as DtcgGroup[string];
      } else if (isToken(bVal) || isToken(aVal) || typeof bVal !== 'object' || typeof aVal !== 'object') {
        // A token leaf (either side) or a primitive — the override wins wholesale.
        out[key] = bVal as DtcgGroup[string];
      } else {
        out[key] = merge(aVal as DtcgGroup, bVal as DtcgGroup);
      }
    }
    return out;
  };
  return merge(base, override);
}
