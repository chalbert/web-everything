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
 */

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

function isSignificant(node: DomNode): boolean {
  if (node.nodeType === TEXT_NODE) return (node.textContent || '').trim() !== '';
  return true;
}

function serializeAttrs(el: DomNode): string {
  return Array.from(el.attributes || [])
    .map((a) => (a.value === '' ? ` ${a.name}` : ` ${a.name}="${a.value}"`))
    .join('');
}

function childrenOf(el: DomNode): DomNode[] {
  // A <template>'s children live in its inert .content, not light DOM.
  const source = isTemplate(el) && el.content ? el.content.childNodes : el.childNodes;
  return Array.from(source);
}

function elementToJsx(el: DomNode): string {
  const tag = el.nodeName.toLowerCase();
  const attrs = serializeAttrs(el);
  const inner = serializeChildren(childrenOf(el));

  if (VOID_ELEMENTS.has(tag) || inner.trim() === '') {
    return `<${tag}${attrs} />`;
  }
  return `<${tag}${attrs}>${inner}</${tag}>`;
}

function serializeChildren(nodes: DomNode[]): string {
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
        out.push(`<template ${open}>${serializeChildren(content)}</template>`);
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

    if (isElement(node)) out.push(elementToJsx(node));
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

/**
 * Convert a canonical HTML string into JSX mirror-dialect source.
 * @param doc parsing document (browser/happy-dom/linkedom). Defaults to the global document.
 */
export function htmlToJsx(html: string, doc?: DomDocument): string {
  const ownerDoc = doc || ((globalThis as unknown as { document: DomDocument }).document);
  const template = ownerDoc.createElement('template');
  template.innerHTML = html.trim();

  const roots = Array.from(template.content.childNodes);
  const body = serializeChildren(roots);

  // Multiple top-level roots → wrap in a fragment.
  if (countRoots(roots) > 1) return `<>${body}</>`;

  return body;
}

export default htmlToJsx;
