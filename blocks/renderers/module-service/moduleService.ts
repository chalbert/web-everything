/**
 * @file blocks/renderers/module-service/moduleService.ts
 * @description Module-as-a-Service resolver — backlog #081, v1 walking skeleton.
 *
 * Serves ONE authored component in whatever *form* the consumer asks for. This is the serve-time
 * twin of the build-time rendering adapters: the demos pre-render the forms into a page, MaaS
 * returns the requested form per call. Crucially it owns NO transform logic of its own — it only
 * resolves + dispatches to the existing SHARED transform modules (`declarativeComponent`,
 * `htmlToJsx`). That single-core reuse is the anti-drift guarantee from #081: the served form is
 * provably the same transform the /adapters/ demos document, never a parallel copy.
 *
 * v1 is deliberately trivial: a single synchronous resolve. Reactivity (callbacks/effects/change
 * detection) is out — it folds into the render-strategy Protocol (#052/#077/#078). The `strategy`
 * and `transpileTarget` params are accepted but NOT yet applied; a non-default request raises a
 * diagnostic instead of silently ignoring it (the seam where those axes will plug in).
 */
import { parseDefinition, generateClassSource } from '../component/declarativeComponent';
import { htmlToJsx } from '../jsx/htmlToJsx';
import { generateFunctionalSource } from '../functional/functionalComponent';

/**
 * The output shapes a single `<component>` definition can be served as. Open-ended by design.
 *
 * Source form is ADAPTER-DRIVEN (#663): HTML/declarative is NOT privileged as "the source." Each
 * registered framework adapter declares the native authoring dialect it emits — plain WC → HTML,
 * React → TSX, Vue → SFC — so this catalog is the open, multi-dialect set those adapters resolve,
 * not a closed enum. Native-first default: with no framework adapter selected, the form stays plain
 * WC → HTML (the web-platform-standard dialect); a framework dialect is the adapter author's opt-in,
 * never the floor. The serve path is deliberately multi-dialect (one component, many forms — the
 * most-flexible framing), with the active adapter supplying the transform per dialect. The assembler
 * emit format (#652) inherits this: the emitted recipe's dialect is adapter-resolved, not baked.
 */
export type ServeForm = 'declarative' | 'wc-class' | 'html' | 'jsx' | 'functional';

export interface FormDescriptor {
  id: ServeForm;
  label: string;
  /** Highlighting / content hint for the consumer. */
  language: 'html' | 'javascript' | 'jsx';
  blurb: string;
  /**
   * esbuild loader for transpilable forms. `js` → lower only on a non-default target; `jsx` → must
   * be transpiled to be an ES module (always). Forms with no loader are display-only (not importable).
   */
  loader?: 'js' | 'jsx';
  /** True when the served (possibly transpiled) form is a native-importable ES module. */
  importable?: boolean;
}

/** Catalog of forms — drives the demo toggle and documents the surface. Add a form here + a case in `serve`. */
export const FORMS: FormDescriptor[] = [
  { id: 'declarative', label: 'Declarative source', language: 'html', blurb: 'The authored `<component>` definition, as-is.' },
  { id: 'wc-class', label: 'Web Component class', language: 'javascript', loader: 'js', importable: true, blurb: 'The standard custom-element class the build-time adapter would emit (self-contained ESM).' },
  { id: 'html', label: 'Template HTML', language: 'html', blurb: 'The inner template, extracted from the definition.' },
  { id: 'jsx', label: 'JSX', language: 'jsx', blurb: 'The template lowered to JSX via the shared htmlToJsx transform (display form).' },
  { id: 'functional', label: 'Functional component', language: 'jsx', loader: 'jsx', importable: true, blurb: 'A React-style functional component + element wrapper; transpiled to ESM that imports the jsx runtime.' },
];

export interface ServeOptions {
  form: ServeForm;
  /** Reserved (#081 phase 2): output module target. Non-default is flagged, not applied, in v1. */
  transpileTarget?: 'esnext' | string;
  /** Reserved (#052): the update machine. Non-default is flagged, not applied, in v1. */
  strategy?: 'declarative-static' | string;
}

export interface ServeResult {
  form: ServeForm;
  code: string;
  language: FormDescriptor['language'];
  /** True when a requested param could not be honoured faithfully. Never silent — see `diagnostics`. */
  lossy: boolean;
  diagnostics: string[];
}

const formById = (id: ServeForm): FormDescriptor => {
  const f = FORMS.find((x) => x.id === id);
  if (!f) throw new Error(`Unknown form "${id}". Known: ${FORMS.map((x) => x.id).join(', ')}.`);
  return f;
};

// ── Delegated transpile (#081 phase 2b) — a swappable compiler seam ──────────────
//
// The core stays browser-safe: it defines the contract + registry but imports NO compiler.
// The Node delivery layer (tools/maas/vite-plugin.ts) registers an esbuild-backed provider at
// startup; the in-browser playground registers none and simply gets the diagnostic. Same
// inject-a-provider shape as CustomRenderStrategyRegistry — "don't reinvent the wheel," #081.

export interface CompilerInput {
  code: string;
  /** Source kind. v2b transpiles `js`; `jsx` lowering (needs the jsx runtime import) is phase 2c. */
  loader: 'js' | 'jsx';
  /** esbuild-style target token, e.g. `es2015`, `es2017`, `esnext`. */
  target: string;
}

export interface CustomCompiler {
  id: string;
  /** Lower `input.code` to `input.target`. Pure transform — self-contained in, self-contained out. */
  transpile(input: CompilerInput): Promise<{ code: string }>;
}

/** Name-keyed compiler registry. Empty by default → non-default targets are flagged, never faked. */
export class CustomCompilerRegistry {
  #byId = new Map<string, CustomCompiler>();
  #default: string | null = null;

  register(compiler: CustomCompiler, opts?: { default?: boolean }): void {
    this.#byId.set(compiler.id, compiler);
    if (opts?.default || this.#default === null) this.#default = compiler.id;
  }
  get(id?: string): CustomCompiler | null {
    const key = id ?? this.#default;
    return key ? this.#byId.get(key) ?? null : null;
  }
  has(): boolean {
    return this.#byId.size > 0;
  }
}

/** Pre-seeded singleton — the delivery layer registers into this; the playground leaves it empty. */
export const compilerRegistry = new CustomCompilerRegistry();

/**
 * True when `source` is an authored `<component>…</component>` definition (vs a pre-built ES module).
 * A definition is markup and always opens with a `<` after leading whitespace; a pre-built module — a
 * trait chunk served over MaaS (#743) — is JavaScript and never does. Used by {@link serve} to route a
 * trait chunk to verbatim passthrough rather than the component-lowering forms.
 */
export function isComponentDefinition(source: string): boolean {
  return source.trimStart().startsWith('<');
}

/**
 * Resolve `definition` into the requested `form`. `definition` is normally the authored
 * `<component>…</component>` source (the same text the component-cases fixtures hold), but the MaaS
 * resolver also unions **pre-built trait modules** (#743): a resolved source that is not a component
 * definition is already the final ES module artifact, so it is served **verbatim** — the `form` is moot
 * (a module has exactly one served shape). Throws on an unparseable component definition or an unknown
 * form — those are caller errors, distinct from the *lossy* param flags reported in the result.
 */
export function serve(definition: string, opts: ServeOptions): ServeResult {
  const descriptor = formById(opts.form);
  const diagnostics: string[] = [];
  let lossy = false;

  // A pre-built ES module (a #743 trait chunk) is the final artifact — serve it verbatim as JavaScript,
  // independent of the requested form (a module has one shape). A non-default transpileTarget still
  // lowers it via serveCompiled (loader `js`); the render-strategy axis is irrelevant to a plain module.
  if (!isComponentDefinition(definition)) {
    if (opts.strategy && opts.strategy !== 'declarative-static') {
      diagnostics.push(`strategy="${opts.strategy}" not applied to a pre-built module — it has no render-strategy axis.`);
      lossy = true;
    }
    return { form: opts.form, code: definition.trim(), language: 'javascript', lossy, diagnostics };
  }

  // Transpile is a separate, async, injected step — see serveCompiled. serve() itself never
  // transpiles, so a target requested here is flagged (call serveCompiled to actually lower).
  if (opts.transpileTarget && opts.transpileTarget !== 'esnext') {
    diagnostics.push(`transpileTarget="${opts.transpileTarget}" ignored by serve() — use serveCompiled (delegates to the compiler registry).`);
    lossy = true;
  }
  // Still unsupported: the render-strategy axis (#052/#078).
  if (opts.strategy && opts.strategy !== 'declarative-static') {
    diagnostics.push(`strategy="${opts.strategy}" not applied — render-strategy axis lands with #052/#078.`);
    lossy = true;
  }

  let code: string;
  switch (opts.form) {
    case 'declarative':
      // Passthrough — the canonical authored form, normalised only by trimming.
      code = definition.trim();
      break;
    case 'wc-class':
      code = generateClassSource(parseDefinition(definition));
      break;
    case 'html':
      code = parseDefinition(definition).templateHTML;
      break;
    case 'jsx':
      code = htmlToJsx(parseDefinition(definition).templateHTML);
      break;
    case 'functional':
      code = generateFunctionalSource(parseDefinition(definition));
      break;
  }

  return { form: opts.form, code, language: descriptor.language, lossy, diagnostics };
}

/**
 * serve() + delegated transpile (#081 phase 2b). Resolves the form, then — if `transpileTarget` is
 * a non-default value — lowers the code through the injected compiler registry. v2b transpiles the
 * JS forms (self-contained in, self-contained out); a non-JS form, or a missing compiler, is flagged
 * lossy rather than silently passed through. `jsx` lowering needs the jsx runtime import and is 2c.
 */
export async function serveCompiled(definition: string, opts: ServeOptions): Promise<ServeResult> {
  // Resolve the form WITHOUT serve()'s transpile flag — this path owns the transpile contract.
  const r = serve(definition, { form: opts.form, strategy: opts.strategy });
  const descriptor = formById(opts.form);
  const target = opts.transpileTarget && opts.transpileTarget !== 'esnext' ? opts.transpileTarget : null;

  // Display-only forms (no loader) are never transpiled; a target request on one is flagged.
  if (!descriptor.loader) {
    if (!target) return r;
    return { ...r, lossy: true, diagnostics: [...r.diagnostics, `transpileTarget="${target}" skipped — form "${opts.form}" is a display form, not a JS module.`] };
  }

  // A `jsx`-loader form (functional) MUST be transpiled to be an ES module; a `js`-loader form
  // (wc-class) only needs it for a non-default target.
  const mustTranspile = descriptor.loader === 'jsx';
  if (!mustTranspile && !target) return r;

  const compiler = compilerRegistry.get();
  if (!compiler) {
    const why = mustTranspile
      ? `form "${opts.form}" requires transpilation to be import-able, but no compiler is registered`
      : `transpileTarget="${target}" requested but no compiler registered`;
    return { ...r, lossy: true, diagnostics: [...r.diagnostics, `${why} — register one into compilerRegistry (the delivery layer does).`] };
  }
  try {
    const { code } = await compiler.transpile({ code: r.code, loader: descriptor.loader, target: target ?? 'esnext' });
    // After transpile the form is plain JS regardless of its authored language.
    return { ...r, code, language: 'javascript' };
  } catch (e) {
    return { ...r, lossy: true, diagnostics: [...r.diagnostics, `transpile failed (${compiler.id}): ${(e as Error).message}`] };
  }
}
