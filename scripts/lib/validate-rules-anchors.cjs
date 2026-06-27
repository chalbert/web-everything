// The cross-doc `codifiedIn:` anchor-resolution gate (#1828, #1792 Fork 1 → (c)).
//
// docs/agent/platform-decisions.md is edited on every decision-resolve, and ~229 `codifiedIn:` frontmatter
// values across backlog/*.md cite anchors in it and three sibling docs. With the docs now rendered at
// /rules/ (rules-loader.cjs), a renamed/removed heading would silently 404 every inbound cite. This gate
// re-uses the loader's `extractAnchors` to build the authoritative anchor set per doc, then asserts every
// `codifiedIn:` frontmatter anchor resolves to a rendered anchor — so anchor drift fails the build the
// next time `check:standards` runs, not at some reader's broken link.
//
// Scope: `codifiedIn:` FRONTMATTER values only (the machine-cite contract). Prose-body file:line links and
// GitHub line-anchors (#L110) are informal references, not part of the codified-cite namespace.

const fs = require('fs');
const path = require('path');
const { extractAnchors, RULE_DOCS } = require('./rules-loader.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const CODIFIED_RE = /^codifiedIn:\s*["']?([^"'\n]+?)["']?\s*$/m;
const DOC_CITE_RE = /^docs\/agent\/([\w-]+)\.md#([\w-]+)$/;

// Per-doc anchor sets, keyed by the `docs/agent/<id>.md` path the cites use. Pure (reads the four docs).
function buildAnchorIndex() {
  const index = {};
  for (const doc of RULE_DOCS) {
    const src = fs.readFileSync(path.join(ROOT, doc.file), 'utf8');
    index[doc.file] = extractAnchors(src).anchors;
  }
  return index;
}

// Collect every backlog item's `codifiedIn:` frontmatter value that points at a `docs/agent/*.md#anchor`.
function collectCodifiedCites(backlogDir) {
  const cites = [];
  for (const name of fs.readdirSync(backlogDir)) {
    if (!name.endsWith('.md')) continue;
    const txt = fs.readFileSync(path.join(backlogDir, name), 'utf8');
    const fm = txt.match(/^---\n([\s\S]*?)\n---/);
    if (!fm) continue;
    const m = fm[1].match(CODIFIED_RE);
    if (!m) continue;
    const value = m[1].trim();
    if (!value.includes('docs/agent/') || !value.includes('#')) continue; // one-off / none / non-doc
    cites.push({ file: name, value });
  }
  return cites;
}

// The pure gate: every codifiedIn doc-cite resolves to a rendered anchor. Returns { errors, warnings }
// in the check-standards shape. `anchorIndex` + `cites` are injected so it is fixture-testable.
function validateRulesAnchors(anchorIndex, cites) {
  const errors = [];
  for (const { file, value } of cites) {
    const m = value.match(DOC_CITE_RE);
    if (!m) {
      errors.push({ message:
        `backlog/${file}: codifiedIn "${value}" is not a well-formed docs/agent/<doc>.md#<anchor> cite ` +
        `(the /rules/ read-path only renders the four cited governance docs).` });
      continue;
    }
    const docPath = `docs/agent/${m[1]}.md`;
    const anchor = m[2];
    const set = anchorIndex[docPath];
    if (!set) {
      errors.push({ message:
        `backlog/${file}: codifiedIn cites "${docPath}", which is not one of the four /rules/-rendered ` +
        `governance docs (platform-decisions, block-standard, backlog-workflow, vision-tiers).` });
      continue;
    }
    if (!set.has(anchor)) {
      errors.push({ message:
        `backlog/${file}: codifiedIn anchor "#${anchor}" does not resolve in ${docPath} — it would 404 on ` +
        `/rules/${m[1]}/. The heading/anchor was renamed or removed; update the cite or restore the anchor.` });
    }
  }
  return { errors, warnings: [] };
}

module.exports = { validateRulesAnchors, buildAnchorIndex, collectCodifiedCites };
