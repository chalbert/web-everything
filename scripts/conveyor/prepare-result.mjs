/** Mechanical shape check for a completed prepare, shared by observation and lane recovery. */
import { readField } from '../backlog/frontmatter.mjs';

export function prepareCardStatus(raw) {
  const stamp = readField(raw, 'preparedDate');
  // Ignore frontmatter, fenced examples and comments: headings must be actual card sections.
  const body = String(raw).replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '')
    .replace(/<!--[^]*?-->/g, '').replace(/^(`{3,}|~{3,})[^\n]*\n[^]*?^\1\s*$/gm, '');
  const sections = new Map([...body.matchAll(/^##\s+([^\n]+)\n([^]*?)(?=^#{1,2}\s|$(?![^]))/gm)]
    .map((m) => [m[1].trim().toLowerCase(), m[2].trim()]));
  return {
    preparedDate: /^\d{4}-\d{2}-\d{2}$/.test(stamp ?? '') ? stamp : null,
    hasSections: ['design', 'mvp', 'test plan', 'proof plan'].every((name) => Boolean(sections.get(name))),
  };
}
