/**
 * @file blocks/renderers/functional/functionalComponent.ts
 * @description Functional Component adapter generator — backlog #081 phase 2c.
 *
 * Emits a React-style *functional component* module from a `<component>` definition: a function that
 * returns the template as JSX, plus a thin custom-element wrapper that mounts it. The WE spec is the
 * `functional-component` Syntax Adapter (/adapters/); this is the (Frontier-UI-side) generator that
 * realises it. Like the other renderers it owns no parsing — it reuses `htmlToJsx` for the template,
 * so the functional form provably mirrors the same tree as the wc-class / html / jsx forms (no drift).
 *
 * The output is NOT self-contained: it `import`s the jsx runtime. That is the point of phase 2c — it
 * is the first served form that forces the **import-map / bare-specifier** seam (a consumer must be
 * able to resolve `JSX_RUNTIME_SPECIFIER`). The source here is JSX; it must be transpiled (esbuild,
 * jsx loader) before it is an import-able ES module — the MaaS compiler seam does that at serve time.
 */
import { type ComponentDef, pascal } from '../component/declarativeComponent';
import { htmlToJsx } from '../jsx/htmlToJsx';

/**
 * The module specifier the generated component imports the jsx factory from — a **bare specifier**,
 * deliberately. A served functional module bypasses the consumer's bundler/dev-server import
 * rewriting, so the runtime can't be an app-relative path; the consumer must resolve this name via
 * an **import map** (the canonical native-platform answer). This is the import-map seam #081 flagged.
 */
export const JSX_RUNTIME_SPECIFIER = '@webeverything/jsx-runtime';

/** attachShadow init literal — mirrors declarativeComponent's, stable key order for deterministic output. */
function shadowInitLiteral(def: ComponentDef): string {
  const opts = [`mode: '${def.shadow}'`];
  if (def.delegatesFocus) opts.push('delegatesFocus: true');
  if (def.clonable) opts.push('clonable: true');
  if (def.serializable) opts.push('serializable: true');
  return `{ ${opts.join(', ')} }`;
}

/**
 * Emit the functional-component module source for `def`. JSX, not yet transpiled. Deterministic:
 * stable member order, no hashes. `htmlToJsx` supplies the body (raw-text `<style>` is string-wrapped
 * there, so the JSX is parseable).
 */
export function generateFunctionalSource(def: ComponentDef): string {
  const fn = pascal(def.name); // functional component, e.g. UserCard
  const cls = `${fn}Element`; // custom-element wrapper, e.g. UserCardElement
  const jsxBody = htmlToJsx(def.templateHTML);

  // Mount: shadow roots clone into the (DSD-aware) shadow root; light DOM appends directly.
  const fields = def.shadow === 'none' ? [] : ['  #root = this.shadowRoot;'];
  const mount =
    def.shadow === 'none'
      ? ['    if (!this.firstChild) this.append(' + fn + '());']
      : [
          `    this.#root ??= this.attachShadow(${shadowInitLiteral(def)});`,
          `    if (!this.#root.childNodes.length) this.#root.append(${fn}());`,
        ];

  return [
    `import jsx from '${JSX_RUNTIME_SPECIFIER}';`,
    ``,
    `export function ${fn}() {`,
    `  return (`,
    `    ${jsxBody}`,
    `  );`,
    `}`,
    ``,
    `export class ${cls} extends HTMLElement {`,
    ...fields,
    `  connectedCallback() {`,
    ...mount,
    `  }`,
    `}`,
    `customElements.define('${def.name}', ${cls});`,
  ].join('\n');
}
