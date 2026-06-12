/**
 * @file blocks/renderers/module-service/productionDelivery.ts
 * @description MaaS production runtime delivery — backlog #312, spun out of #081.
 *
 * In dev, a MaaS consumer's import map points a bare specifier straight at Vite-served WE *source*:
 *
 *     <script type="importmap">{ "imports": { "@frontierui/jsx-runtime": "/blocks/renderers/jsx/index.ts" } }</script>
 *
 * That cannot ship: a real deploy serves **compiled `.js`**, not `.ts`, behind a **published
 * bare-specifier package**, with an import map that resolves the specifier to a real, cache-friendly URL.
 * This module is the production hardening of that native-ESM delivery seam (#081 phase 2c): it turns an
 * importable, already-compiled `ServeResult` into a {@link DeliveryArtifact} — the bare specifier, the
 * compiled module bytes + file name, the import-map entry, and a minimal `package.json` manifest — and
 * assembles a whole production import map from a set of them ({@link buildImportMap}).
 *
 * Scope follows the constellation rule (npm-scope-mirrors-layer, #239): served *implementations* publish
 * under **`@frontierui`**, never `@webeverything` (the standard never ships impl). It owns no transform:
 * the compiled bytes come from `serveCompiled` (the esbuild seam); this only frames them for delivery.
 * Relates to the module-resolution axis (#271/#274) and the import-map cleanup (#285). Browser-safe + pure.
 */
import { FORMS, type ServeResult } from './moduleService';

/** The constellation's implementation scope — served components publish here, never under `@webeverything`. */
export const DEFAULT_DELIVERY_SCOPE = '@frontierui';
const DEFAULT_VERSION = '0.0.0';

export interface ProductionDeliveryOptions {
  /** The component id / element name (the package's unscoped name). */
  readonly id: string;
  /** npm scope; defaults to `@frontierui` (the implementation layer). */
  readonly scope?: string;
  /** Published version; defaults to `0.0.0` (the unversioned walking-skeleton placeholder). */
  readonly version?: string;
  /** Base URL the compiled file is served from (no trailing slash); defaults to the package-relative `.`. */
  readonly baseUrl?: string;
}

/** A minimal, publish-ready `package.json` for a single served component — native ESM, one export. */
export interface PackageManifest {
  readonly name: string;
  readonly version: string;
  readonly type: 'module';
  readonly main: string;
  readonly exports: Record<string, string>;
  readonly sideEffects: boolean;
}

/** One import-map entry: the bare specifier and the URL it resolves to in production. */
export interface ImportMapEntry {
  readonly specifier: string;
  readonly url: string;
}

/**
 * The production delivery shape for one served component. `deliverable` is false (with a diagnostic, never
 * silent) when the input form can't be delivered as a native module — a display-only form, or a form not
 * yet compiled to `.js` (still `jsx`/`html`). When deliverable, `code` is the compiled module bytes ready
 * to write to `fileName` and serve from `url`.
 */
export interface DeliveryArtifact {
  readonly id: string;
  readonly deliverable: boolean;
  readonly bareSpecifier: string;
  readonly version: string;
  readonly fileName: string;
  readonly url: string;
  readonly importMapEntry: ImportMapEntry;
  readonly packageManifest: PackageManifest;
  readonly code: string;
  readonly language: ServeResult['language'];
  readonly diagnostics: readonly string[];
}

/** Is this served form a native-importable ES module per its FORMS descriptor? */
function isImportableForm(form: ServeResult['form']): boolean {
  return FORMS.find((f) => f.id === form)?.importable === true;
}

/**
 * Frame a served result as a production {@link DeliveryArtifact}. Validates that the form is importable
 * AND already compiled to JavaScript (a `jsx` result must be lowered via `serveCompiled` first); either
 * failure is reported as `deliverable: false` + a diagnostic, mirroring `ServeResult.lossy` — the seam
 * never silently emits an undeliverable module.
 */
export function deliverModule(served: ServeResult, opts: ProductionDeliveryOptions): DeliveryArtifact {
  const scope = opts.scope ?? DEFAULT_DELIVERY_SCOPE;
  const version = opts.version ?? DEFAULT_VERSION;
  const base = (opts.baseUrl ?? '.').replace(/\/$/, '');
  const bareSpecifier = `${scope}/${opts.id}`;
  const fileName = `${opts.id}.js`;
  const url = `${base}/${fileName}`;

  const diagnostics: string[] = [...served.diagnostics];
  let deliverable = true;
  if (!isImportableForm(served.form)) {
    deliverable = false;
    diagnostics.push(`form "${served.form}" is display-only — not a native module. Serve an importable form (wc-class / functional).`);
  } else if (served.language !== 'javascript') {
    deliverable = false;
    diagnostics.push(`form "${served.form}" is still "${served.language}", not compiled .js — lower it via serveCompiled (the esbuild seam) before delivery.`);
  }

  const packageManifest: PackageManifest = {
    name: bareSpecifier,
    version,
    type: 'module',
    main: fileName,
    exports: { '.': `./${fileName}` },
    // A custom-element module registers on import (`customElements.define`) — that side effect must survive tree-shaking.
    sideEffects: true,
  };

  return {
    id: opts.id,
    deliverable,
    bareSpecifier,
    version,
    fileName,
    url,
    importMapEntry: { specifier: bareSpecifier, url },
    packageManifest,
    code: served.code,
    language: served.language,
    diagnostics,
  };
}

/**
 * Assemble a production import map from delivered artifacts — the deployable replacement for the dev map
 * that points a specifier at TS source. Only `deliverable` artifacts are mapped; an undeliverable one is
 * skipped (its diagnostics already explain why) so the map never resolves a specifier to a broken module.
 */
export function buildImportMap(artifacts: readonly DeliveryArtifact[]): { imports: Record<string, string> } {
  const imports: Record<string, string> = {};
  for (const a of artifacts) if (a.deliverable) imports[a.bareSpecifier] = a.url;
  return { imports };
}
