/** Filesystem backstop for #2866. Scan all UTF-8 text under scripts/docs, without an extension allowlist.
 * Binary assets (invalid UTF-8 or NUL-bearing content) and symlinks are not source files.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { scanInvisibleCharacters } from '../check-standards-rules.mjs';

export function scanInvisibleSourceTree(root) {
  const findings = [];
  // Preserve the BOM: TextDecoder otherwise silently strips precisely one of the forbidden characters.
  const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
  function walk(dir) {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
      const file = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(file);
      else if (entry.isFile()) {
        const bytes = readFileSync(join(root, file));
        let content;
        try { content = decoder.decode(bytes); } catch { continue; } // binary asset
        if (content.includes('\0')) continue;
        findings.push(...scanInvisibleCharacters([{ file, content }]));
      }
    }
  }
  for (const dir of ['scripts', 'docs']) if (existsSync(join(root, dir))) walk(dir);
  return findings;
}
