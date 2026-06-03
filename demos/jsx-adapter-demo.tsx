/**
 * JSX Adapter Playground — mirror-dialect rendering sandbox + conformance harness.
 *
 * Authors each example in the HTML *mirror dialect* of JSX (class not className, for not htmlFor,
 * on:* string behaviors, bind-* bindings, <template is="..."> directives), renders it live through
 * the realigned JSX renderer, shows the produced HTML, and CHECKS it against the canonical HTML the
 * mapping says it must equal (DOM-equality, attribute-order-independent). A red badge means the
 * renderer or the mapping drifted — fix it here before porting pairs onto block pages.
 *
 * See reports/2026-06-03-jsx-adapter-feature-mapping.md. JSX is auto-injected by vite.config.mts.
 */

// The auto-injected factory, declared for editor/type tooling.
declare const jsx: typeof import('/blocks/renderers/jsx').default;

interface Example {
  title: string;
  note?: string;
  /** The authored JSX source, shown verbatim as text (JSX compiles away). */
  jsx: string;
  /** Live render through the realigned renderer — keep in lockstep with `jsx`. */
  render: () => Node;
  /** The canonical HTML this JSX must produce (the mapping contract). Checked via DOM-equality. */
  html: string;
}

const examples: Example[] = [
  {
    title: '1 · Element, class, text',
    note: 'class — never className. Plain element + text round-trips as identity.',
    jsx: `<div class="card">Hello</div>`,
    render: () => <div class="card">Hello</div>,
    html: `<div class="card">Hello</div>`,
  },
  {
    title: '2 · Attributes — boolean, data, hyphenated binding',
    note: 'Bare boolean, data-*, and bind-* (the Axis-1 reversible binding form) all become plain attributes.',
    jsx: `<input type="text" required data-id="42" bind-text="count" />`,
    render: () => <input type="text" required data-id="42" bind-text="count" />,
    html: `<input type="text" required data-id="42" bind-text="count">`,
  },
  {
    title: '3 · Events — function prop vs string behavior',
    note: 'onclick={fn} wires a real listener (try it) and leaves no HTML trace; on:select="..." stays a string behavior attribute.',
    jsx:
      `<button class="btn"\n` +
      `        onclick={(e) => (e.currentTarget.textContent = 'Clicked ✓')}\n` +
      `        on:select="choose($event)">Click me</button>`,
    render: () => (
      <button
        class="btn"
        onclick={(e: Event) => ((e.currentTarget as HTMLElement).textContent = 'Clicked ✓')}
        on:select="choose($event)"
      >
        Click me
      </button>
    ),
    // the function handler is a listener, not an attribute — so it does not appear in the HTML
    html: `<button class="btn" on:select="choose($event)">Click me</button>`,
  },
  {
    title: '4 · className / htmlFor aliases lower to class / for',
    note: 'React-style sources keep working: className → class, htmlFor → for. The produced HTML is the canonical mirror.',
    jsx: `<label className="lbl" htmlFor="email">Email</label>`,
    render: () => <label className="lbl" htmlFor="email">Email</label>,
    html: `<label class="lbl" for="email">Email</label>`,
  },
  {
    title: '5 · Context reference (injector alias)',
    note: 'Injector/context refs are plain string attributes — identity across formats.',
    jsx: `<drop-list options="@countries" placeholder="Country"></drop-list>`,
    render: () => <drop-list options="@countries" placeholder="Country"></drop-list>,
    html: `<drop-list options="@countries" placeholder="Country"></drop-list>`,
  },
  {
    title: '6 · Fragment — multiple roots',
    note: 'A <>…</> fragment maps to sibling nodes with no wrapper (DocumentFragment at runtime).',
    jsx: `<>\n  <li>Argentina</li>\n  <li>Australia</li>\n</>`,
    render: () => (
      <>
        <li>Argentina</li>
        <li>Australia</li>
      </>
    ),
    html: `<li>Argentina</li><li>Australia</li>`,
  },
  {
    title: '7 · Slots / content projection',
    note: 'Named slots are the slot attribute, identical in both formats.',
    jsx: `<user-card>\n  <span slot="title">Ada Lovelace</span>\n  <p>First programmer.</p>\n</user-card>`,
    render: () => (
      <user-card>
        <span slot="title">Ada Lovelace</span>
        <p>First programmer.</p>
      </user-card>
    ),
    html: `<user-card><span slot="title">Ada Lovelace</span><p>First programmer.</p></user-card>`,
  },
  {
    title: '8 · Directive — customized built-in via is',
    note: 'The JSX mirror of <!-- control:for-each -->: createElement("template", { is: "for-each" }); children land in .content.',
    jsx:
      `<template is="for-each" items="users" key="id">\n` +
      `  <div class="user-row"><span data-bind="name"></span></div>\n` +
      `</template>`,
    render: () => (
      <template is="for-each" items="users" key="id">
        <div class="user-row">
          <span data-bind="name"></span>
        </div>
      </template>
    ),
    html: `<template is="for-each" items="users" key="id"><div class="user-row"><span data-bind="name"></span></div></template>`,
  },
];

/** Serialize a rendered node to its produced HTML (handles elements, templates, fragments). */
function producedHtml(node: Node): string {
  if (node instanceof HTMLTemplateElement) {
    const attrs = Array.from(node.attributes).map((a) => ` ${a.name}="${a.value}"`).join('');
    const inner = Array.from(node.content.childNodes)
      .map((n) => (n instanceof Element ? n.outerHTML : (n.textContent || '').trim()))
      .filter(Boolean)
      .join('\n  ');
    return `<template${attrs}>\n  ${inner}\n</template>`;
  }
  if (node instanceof Element) return node.outerHTML;
  if (node instanceof DocumentFragment) {
    return Array.from(node.childNodes)
      .map((n) => (n instanceof Element ? n.outerHTML : n.textContent || ''))
      .join('\n');
  }
  return node.textContent || '';
}

/** Wrap a live node in a <div> so single-root and multi-root compare uniformly (Element.isEqualNode). */
function toBox(node: Node): HTMLElement {
  const d = document.createElement('div');
  d.appendChild(node.cloneNode(true));
  return d;
}

/** Parse canonical HTML into a <div> box (canonicalizes boolean attrs, quoting, whitespace). */
function parseBox(html: string): HTMLElement {
  const d = document.createElement('div');
  d.innerHTML = html.trim();
  return d;
}

/**
 * DOM-equality conformance check: does the rendered tree equal the canonical HTML?
 * isEqualNode is attribute-order-independent but skips <template> .content, so nested
 * template contents are compared explicitly (boxed, since DocumentFragment.isEqualNode is patchy).
 */
function domEqual(produced: Node, canonicalHtml: string): boolean {
  const a = toBox(produced);
  const b = parseBox(canonicalHtml);
  if (!a.isEqualNode(b)) return false;
  const aT = a.querySelectorAll('template');
  const bT = b.querySelectorAll('template');
  if (aT.length !== bT.length) return false;
  for (let i = 0; i < aT.length; i++) {
    if (!toBox(aT[i].content).isEqualNode(toBox(bT[i].content))) return false;
  }
  return true;
}

let passCount = 0;

/** Build one example card. The chrome is itself authored in JSX (dogfooding the renderer). */
function card(ex: Example): Node {
  const live = ex.render();
  const html = producedHtml(live);
  const pass = domEqual(live, ex.html);
  if (pass) passCount++;

  return (
    <section class="ex">
      <h2 class="ex-title">
        {ex.title}
        <span class={`badge ${pass ? 'pass' : 'fail'}`}>{pass ? '✓ conformant' : '✗ drift'}</span>
      </h2>
      {ex.note ? <p class="ex-note">{ex.note}</p> : null}
      <div class="ex-grid">
        <div class="pane">
          <div class="pane-label">JSX source</div>
          <pre class="code">{ex.jsx}</pre>
        </div>
        <div class="pane">
          <div class="pane-label">Live render</div>
          <div class="preview">{live}</div>
        </div>
        <div class="pane">
          <div class="pane-label">Produced HTML {pass ? '= canonical' : '≠ canonical'}</div>
          <pre class="code">{html}</pre>
        </div>
      </div>
    </section>
  );
}

const host = document.getElementById('examples');
if (host) {
  const cards = examples.map(card);
  const summary = (
    <div class={`summary ${passCount === examples.length ? 'pass' : 'fail'}`}>
      {passCount}/{examples.length} examples conformant (produced HTML equals canonical)
    </div>
  );
  host.replaceChildren(summary, ...cards);
}

// Activate any custom attributes the renderer produced (best-effort; bootstrap may expose `attributes`).
const we = window as unknown as { attributes?: { upgrade?: (root: Node) => void } };
we.attributes?.upgrade?.(document.body);

(window as unknown as { playgroundReady?: boolean; playgroundPass?: number }).playgroundReady = true;
(window as unknown as { playgroundPass?: number }).playgroundPass = passCount;
