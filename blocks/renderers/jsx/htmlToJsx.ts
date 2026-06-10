/**
 * htmlToJsx — canonical HTML → JSX mirror-dialect source.
 *
 * The build-time direction of the conversion adapter: HTML is canonical, so HTML→JSX auto-generates
 * the JSX pane for any element (see reports/2026-06-03-jsx-adapter-feature-mapping.md). The mirror
 * dialect keeps class, for, on: events, bind- bindings and data- attributes verbatim, so most of
 * the transform is identity; the real work is the few non-identity rules:
 *
 *   - boolean attribute (value "")       → bare attr               (required="" → required)
 *   - void or empty element              → self-closing            (<input> → <input />)
 *   - comment directive                  → customized built-in     (<!-- control:for-each … --> → <template is="for-each" …>)
 *   - multiple roots                     → fragment                (siblings → <>…</>)
 *
 * DOM-implementation-agnostic: it walks nodes via nodeType/nodeName only (no instanceof) and takes
 * the parsing document as a parameter, so the SAME source runs in the browser, under vitest
 * (happy-dom), and in the 11ty build (node/linkedom). The default doc is the global document.
 *
 * Authoring dialect (#235): the emitted attribute spelling follows a soft preference — `html`
 * (default: `class`/`for`/`onclick`) vs `react` (`className`/`htmlFor`/`onClick`). Only the
 * attribute NAMES change; the tree is identical. The mapping lives in ./dialect.
 */
import { type JsxDialect, DEFAULT_DIALECT, applyDialect } from './dialect';

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const COMMENT_NODE = 8;

/** A comment-directive opener: `control:NAME attr="x" attr2="y"` (the closer is `/control:NAME`). */
const DIRECTIVE_OPEN = /^control:([\w-]+)\s*([\s\S]*)$/;

// Minimal structural node shape — satisfied by browser DOM, happy-dom, and linkedom alike.
interface DomNode {
  nodeType: number;
  nodeName: string;
  textContent: string | null;
  childNodes: ArrayLike<DomNode>;
  attributes?: ArrayLike<{ name: string; value: string }>;
  content?: { childNodes: ArrayLike<DomNode> };
}
interface DomDocument {
  createElement(tag: string): { innerHTML: string; content: { childNodes: ArrayLike<DomNode> } };
}

const isElement = (n: DomNode) => n.nodeType === ELEMENT_NODE;
const isTemplate = (n: DomNode) => n.nodeName.toUpperCase() === 'TEMPLATE';

// Raw-text elements: their text content is CSS/JS, not markup. In JSX the braces in `:host { … }`
// would be parsed as expression containers, so the content must be emitted as a JSX string
// expression — `<style>{`…`}</style>` — not bare text. (Without this the JSX is unparseable.)
const RAW_TEXT_ELEMENTS = new Set(['style', 'script']);
const escapeTemplateLiteral = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

function isSignificant(node: DomNode): boolean {
  if (node.nodeType === TEXT_NODE) return (node.textContent || '').trim() !== '';
  return true;
}

// Escape an attribute VALUE the same way HTML serialization does, so a value containing `"`
// (e.g. a JSON-valued attr `data-config='{"k":"v"}'`) can't close the JSX attribute early.
// Mirrors `outerHTML` exactly (`&`→`&amp;`, `"`→`&quot;`), keeping the canonical-HTML round-trip
// intact; JSX decodes these entities back to the raw value at compile time.
const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

function serializeAttrs(el: DomNode, dialect: JsxDialect): string {
  return Array.from(el.attributes || [])
    .map((a) => {
      const name = applyDialect(a.name, dialect);
      return a.value === '' ? ` ${name}` : ` ${name}="${escapeAttr(a.value)}"`;
    })
    .join('');
}

function childrenOf(el: DomNode): DomNode[] {
  // A <template>'s children live in its inert .content, not light DOM.
  const source = isTemplate(el) && el.content ? el.content.childNodes : el.childNodes;
  return Array.from(source);
}

function elementToJsx(el: DomNode, dialect: JsxDialect): string {
  const tag = el.nodeName.toLowerCase();
  const attrs = serializeAttrs(el, dialect);

  // Raw-text elements carry CSS/JS — emit as a JSX string expression so braces aren't parsed as JSX.
  if (RAW_TEXT_ELEMENTS.has(tag)) {
    const text = el.textContent || '';
    if (text.trim() === '') return `<${tag}${attrs} />`;
    return `<${tag}${attrs}>{\`${escapeTemplateLiteral(text)}\`}</${tag}>`;
  }

  const inner = serializeChildren(childrenOf(el), dialect);
  if (VOID_ELEMENTS.has(tag) || inner.trim() === '') {
    return `<${tag}${attrs} />`;
  }
  return `<${tag}${attrs}>${inner}</${tag}>`;
}

function serializeChildren(nodes: DomNode[], dialect: JsxDialect): string {
  const out: string[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];

    if (node.nodeType === COMMENT_NODE) {
      const match = (node.textContent || '').trim().match(DIRECTIVE_OPEN);
      if (match) {
        const name = match[1];
        const attrs = match[2].replace(/\s+/g, ' ').trim();
        // gather nodes until the matching `/control:NAME` closer
        const inner: DomNode[] = [];
        i++;
        while (
          i < nodes.length &&
          !(
            nodes[i].nodeType === COMMENT_NODE &&
            (nodes[i].textContent || '').trim().replace(/\s+/g, ' ') === `/control:${name}`
          )
        ) {
          inner.push(nodes[i]);
          i++;
        }
        // collapse a single wrapping <template> (comment form holds an inner <template>)
        let content = inner.filter(isSignificant);
        if (content.length === 1 && isTemplate(content[0]) && content[0].content) {
          content = Array.from(content[0].content.childNodes);
        }
        const open = `is="${name}"${attrs ? ' ' + attrs : ''}`;
        out.push(`<template ${open}>${serializeChildren(content, dialect)}</template>`);
        continue;
      }
      // non-directive comments are dropped (JSX cannot carry semantic HTML comments)
      continue;
    }

    if (node.nodeType === TEXT_NODE) {
      const text = (node.textContent || '').trim();
      if (text) out.push(text);
      continue;
    }

    if (isElement(node)) out.push(elementToJsx(node, dialect));
  }

  return out.join('');
}

/** Count logical roots, treating a comment directive + the nodes it wraps as one root. */
function countRoots(nodes: DomNode[]): number {
  let count = 0;
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.nodeType === COMMENT_NODE) {
      const match = (node.textContent || '').trim().match(DIRECTIVE_OPEN);
      if (match) {
        count++;
        const name = match[1];
        i++;
        while (
          i < nodes.length &&
          !(
            nodes[i].nodeType === COMMENT_NODE &&
            (nodes[i].textContent || '').trim().replace(/\s+/g, ' ') === `/control:${name}`
          )
        ) {
          i++;
        }
      }
      continue;
    }
    if (node.nodeType === TEXT_NODE) {
      if ((node.textContent || '').trim()) count++;
      continue;
    }
    if (isElement(node)) count++;
  }
  return count;
}

/** Options for {@link htmlToJsx}. */
export interface HtmlToJsxOptions {
  /** Authoring dialect for the emitted attribute spelling. Default `html` (HTML-mirror, native-first). */
  dialect?: JsxDialect;
}

/**
 * Convert a canonical HTML string into JSX source.
 * @param doc  parsing document (browser/happy-dom/linkedom). Defaults to the global document.
 * @param opts authoring options — currently the {@link JsxDialect} preference (#235).
 */
export function htmlToJsx(html: string, doc?: DomDocument, opts?: HtmlToJsxOptions): string {
  const ownerDoc = doc || ((globalThis as unknown as { document: DomDocument }).document);
  const dialect = opts?.dialect ?? DEFAULT_DIALECT;
  const template = ownerDoc.createElement('template');
  template.innerHTML = html.trim();

  const roots = Array.from(template.content.childNodes);
  const body = serializeChildren(roots, dialect);

  // Multiple top-level roots → wrap in a fragment.
  if (countRoots(roots) > 1) return `<>${body}</>`;

  return body;
}

export default htmlToJsx;
