/** Mechanical shape check for a completed prepare, shared by observation and lane recovery. */
import { readField } from '../backlog/frontmatter.mjs';

const REQUIRED = ['design', 'mvp', 'test plan', 'proof plan'];

/** Split a card body into `## ` sections. Headings inside a CommonMark fence never count, but fenced lines under a real heading are content. */
function readSections(body) {
  const sections = new Map();
  let name = null;
  let fence = null;
  for (const line of body.split(/\r?\n/)) {
    if (fence) {
      const close = line.match(/^ {0,3}(`+|~+)\s*$/);
      if (close && close[1][0] === fence.char && close[1].length >= fence.len) fence = null;
      else if (name) sections.set(name, `${sections.get(name)}\n${line}`);
      continue;
    }
    const open = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (open) {
      fence = { char: open[1][0], len: open[1].length };
      if (name) sections.set(name, `${sections.get(name)}\n${line}`);
      continue;
    }
    const heading = line.match(/^(#{1,2})\s+(.*)$/);
    if (heading) {
      name = heading[1] === '##' ? heading[2].trim().toLowerCase() : null;
      if (name && !sections.has(name)) sections.set(name, '');
      continue;
    }
    if (name) sections.set(name, `${sections.get(name)}\n${line}`);
  }
  return sections;
}

export function prepareCardStatus(raw) {
  const stamp = readField(raw, 'preparedDate');
  // Ignore frontmatter and comments: headings must be actual card sections.
  const body = String(raw).replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '').replace(/<!--[^]*?-->/g, '');
  const sections = readSections(body);
  return {
    preparedDate: /^\d{4}-\d{2}-\d{2}$/.test(stamp ?? '') ? stamp : null,
    hasSections: REQUIRED.every((name) => Boolean(sections.get(name)?.trim())),
  };
}
