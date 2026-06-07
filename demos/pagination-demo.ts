/**
 * Pagination Playground — exercise the Pagination block's verified contract live.
 *
 * For each shared fixture it (1) shows the contract options, (2) renders the controls through the
 * reference renderer, (3) shows the produced HTML, and (4) runs the SAME a11y/SEO audit the CI
 * conformance suite asserts — a green badge means the rendered controls satisfy the verified
 * WAI-ARIA APG + SEO contract. Renderer, audit, and fixtures are the one shared source, so the
 * badges below and CI exercise the exact same code. See /blocks/pagination/. Native DOM only.
 */
import { setPlaygroundReady } from '/demos/playground-harness';
import { renderPagination, auditPagination, type AuditResult } from '/blocks/renderers/pagination/renderPagination';
import { paginationCases, type PaginationCase } from '/blocks/renderers/pagination/__fixtures__/pagination-cases';

function el(tag: string, className?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function pane(label: string, content: Node): HTMLElement {
  const p = el('div', 'pane');
  p.append(el('div', 'pane-label', label));
  p.append(content);
  return p;
}

function contractLine(c: PaginationCase): string {
  const { mode, advance, urlSync, rangeLabel } = c.opts;
  const total = c.state.total != null ? `total ${c.state.total}` : 'no total (cursor)';
  return `pageMode:${mode}  advance:${advance}  urlSync:${urlSync}  rangeLabel:${rangeLabel}  ·  ${total}`;
}

function checklist(result: AuditResult): HTMLElement {
  const ul = el('ul', 'checks');
  for (const ch of result.checks) {
    const li = el('li', ch.pass ? 'check pass' : 'check fail');
    li.textContent = `${ch.pass ? '✓' : '✗'} ${ch.label}`;
    ul.append(li);
  }
  return ul;
}

let passCount = 0;

function buildCard(c: PaginationCase): HTMLElement {
  const section = el('section', 'ex');
  const title = el('h2', 'ex-title');
  title.append(document.createTextNode(c.title + ' '));
  const badge = el('span', 'badge info', '…');
  title.append(badge);
  section.append(title);

  section.append(el('p', 'ex-contract', contractLine(c)));
  if (c.note) section.append(el('p', 'ex-note', c.note));

  const grid = el('div', 'ex-grid');
  section.append(grid);

  // Render the controls + audit (the demo's whole point).
  const root = renderPagination(c.state, c.opts);
  const result = auditPagination(root, c.state, c.opts);
  if (result.ok) passCount++;

  badge.className = `badge ${result.ok ? 'pass' : 'fail'}`;
  badge.textContent = result.ok ? '✓ conformant' : '✗ contract violation';

  const live = el('div', 'preview');
  live.append(root);
  grid.append(pane('Live controls', live));
  grid.append(pane('Produced HTML', el('pre', 'code', root.outerHTML)));
  grid.append(pane('Contract audit', checklist(result)));

  return section;
}

const host = document.getElementById('examples');
if (host) {
  const summary = el('div', 'summary', '');
  const cards = paginationCases.map(buildCard);
  host.replaceChildren(summary, ...cards);
  summary.className = `summary ${passCount === paginationCases.length ? 'pass' : 'fail'}`;
  summary.textContent = `${passCount}/${paginationCases.length} cases satisfy the verified pagination contract`;
}

setPlaygroundReady(passCount);
