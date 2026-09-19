// Tests for the target registry (#2806, epic #2804) — the mint-authorization predicate, integrity digest,
// tamper-evident chain, frozen-artifact scan, canonicalization, perceptual floor, and source-shape
// validation, per the backlog card's Done-when list. Requirement #2 (integrity digest, not authenticity) has
// no dedicated describe block of its own — it's a documented property of computeIntegrityDigest's
// construction (an unkeyed sha256), exercised implicitly by every "context binding (#3)" case below, since
// both requirements share the same digest.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { reserve, releaseLockDir } from '../readiness/file-locks.mjs';

import {
  TARGET_REGISTRY_VERSION, TARGET_REGISTRY_KIND,
  canonicalizeBytes, computeContentHash, computeIntegrityDigest,
  mintAuthorizationVerdict, frozenArtifactScan,
  buildRegistryEntry, validateRegistryEntry, serializeRegistryEntry, parseRegistryLog,
  foldTargetRegistry, verifyChain, verifyPerceptualFloor,
  targetRegistryPath, appendRegistryEntry, readTargetRegistry,
} from '../lib/target-registry.mjs';

const AT = '2026-09-07T12:00:00.000Z';

// A minimal, schema-valid entry builder for tests that don't care about the specific fields.
function entry(overrides = {}) {
  return buildRegistryEntry({
    registryId: 'mock:board@1', version: 1, contentHash: `sha256:${'a'.repeat(64)}`,
    authoredInCommit: 'aaa1111', prevDigest: null, mintedBy: 'test', mintedAt: AT, ...overrides,
  });
}

describe('canonicalizeBytes (#6)', () => {
  it('CRLF-normalizes text content — \\n and \\r\\n line endings hash identically', () => {
    const lf = Buffer.from('line1\nline2\nline3', 'utf8');
    const crlf = Buffer.from('line1\r\nline2\r\nline3', 'utf8');
    expect(canonicalizeBytes(crlf).equals(canonicalizeBytes(lf))).toBe(true);
  });

  it('passes BINARY (non-UTF8) content through unmodified, byte-for-byte, stably', () => {
    const binary = Buffer.from([0xff, 0xfe, 0x00, 0x01, 0x02, 0xc0, 0xc1]); // never valid UTF-8
    const a = canonicalizeBytes(binary);
    const b = canonicalizeBytes(binary);
    expect(a.equals(binary)).toBe(true);
    expect(a.equals(b)).toBe(true);
  });

  it('never throws on arbitrary bytes', () => {
    expect(() => canonicalizeBytes(Buffer.from([0xff, 0xff, 0xff, 0xff]))).not.toThrow();
  });
});

describe('computeContentHash (#6)', () => {
  it('a directory manifest hash is independent of listing order', () => {
    const a = computeContentHash({ manifest: [
      { path: 'a.svg', bytes: Buffer.from('A') }, { path: 'b.svg', bytes: Buffer.from('B') },
    ] });
    const b = computeContentHash({ manifest: [
      { path: 'b.svg', bytes: Buffer.from('B') }, { path: 'a.svg', bytes: Buffer.from('A') },
    ] });
    expect(a).toBe(b);
    expect(a).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('single-file hash changes when bytes change', () => {
    const a = computeContentHash({ bytes: Buffer.from('one') });
    const b = computeContentHash({ bytes: Buffer.from('two') });
    expect(a).not.toBe(b);
  });

  it('throws on a shape that is neither {bytes} nor {manifest}', () => {
    expect(() => computeContentHash({})).toThrow(/target-registry:/);
  });

  it('throws on {bytes: null} — a nullish-but-present key must not silently hash an empty buffer', () => {
    expect(() => computeContentHash({ bytes: null })).toThrow(/target-registry:/);
  });

  it('throws on a manifest entry with nullish bytes, same as the single-file case', () => {
    expect(() => computeContentHash({ manifest: [{ path: 'a.svg', bytes: null }] })).toThrow(/target-registry:/);
  });
});

describe('context binding (#3)', () => {
  const base = { version: 1, contentHash: `sha256:${'b'.repeat(64)}`, authoredInCommit: 'ccc2222', prevDigest: null };
  it('two entries with identical contentHash but different registryId produce different integrityDigests', () => {
    const a = computeIntegrityDigest({ ...base, registryId: 'mock:a@1' });
    const b = computeIntegrityDigest({ ...base, registryId: 'mock:b@1' });
    expect(a).not.toBe(b);
  });

  it('two entries differing only in version (@vN) produce different integrityDigests', () => {
    const a = computeIntegrityDigest({ ...base, registryId: 'mock:a@1', version: 1 });
    const b = computeIntegrityDigest({ ...base, registryId: 'mock:a@1', version: 2, prevDigest: `sha256:${'c'.repeat(64)}` });
    expect(a).not.toBe(b);
  });

  it('is deterministic — same inputs, same digest', () => {
    const a = computeIntegrityDigest({ ...base, registryId: 'mock:a@1' });
    const b = computeIntegrityDigest({ ...base, registryId: 'mock:a@1' });
    expect(a).toBe(b);
  });
});

describe('mintAuthorizationVerdict — self-mint escalation (#1)', () => {
  it('authoredInCommit === buildCommit escalates', () => {
    const v = mintAuthorizationVerdict({ authoredInCommit: 'deadbee', buildCommit: 'deadbee' });
    expect(v).toMatchObject({ authorized: false, escalate: true });
  });

  it('authoredInLane === buildLane escalates even with distinct commits', () => {
    const v = mintAuthorizationVerdict({
      authoredInCommit: 'aaa', buildCommit: 'bbb', authoredInLane: 'lane-7', buildLane: 'lane-7',
    });
    expect(v).toMatchObject({ authorized: false, escalate: true });
  });

  it('a distinct commit and lane authorizes cleanly', () => {
    const v = mintAuthorizationVerdict({
      authoredInCommit: 'aaa', buildCommit: 'bbb', authoredInLane: 'lane-1', buildLane: 'lane-2',
    });
    expect(v).toMatchObject({ authorized: true, escalate: false });
  });

  it('fails CLOSED (never authorized:true) when authoredInCommit is missing', () => {
    const v = mintAuthorizationVerdict({ buildCommit: 'bbb' });
    expect(v).toMatchObject({ authorized: false, escalate: true });
  });

  it('fails CLOSED when buildCommit is missing', () => {
    const v = mintAuthorizationVerdict({ authoredInCommit: 'aaa' });
    expect(v).toMatchObject({ authorized: false, escalate: true });
  });

  it('fails CLOSED when called with no arguments at all', () => {
    expect(mintAuthorizationVerdict()).toMatchObject({ authorized: false, escalate: true });
  });
});

describe('frozenArtifactScan — frozen-artifact rejection (#5)', () => {
  it('flags a <script src="https://..."> live reference', () => {
    const { frozen, violations } = frozenArtifactScan('<html><script src="https://cdn.evil.example/x.js"></script></html>');
    expect(frozen).toBe(false);
    expect(violations[0].reference).toBe('https://cdn.evil.example/x.js');
  });

  it('flags a CSS url(...) live reference', () => {
    const { frozen } = frozenArtifactScan('<style>.x{background:url(https://cdn.example/bg.png)}</style>');
    expect(frozen).toBe(false);
  });

  it('artifact bytes with no external reference are frozen', () => {
    const { frozen, violations } = frozenArtifactScan('<div class="board">static mock, no network</div>');
    expect(frozen).toBe(true);
    expect(violations).toEqual([]);
  });

  it('a well-formed SVG whose only http(s) occurrence is the xmlns namespace declaration is NOT flagged', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>';
    const { frozen, violations } = frozenArtifactScan(svg);
    expect(frozen).toBe(true);
    expect(violations).toEqual([]);
  });

  it('a DOCTYPE declaration is NOT flagged', () => {
    const html = '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd"><html></html>';
    expect(frozenArtifactScan(html).frozen).toBe(true);
  });

  it('accepts a Buffer as well as a string', () => {
    expect(frozenArtifactScan(Buffer.from('<div>ok</div>')).frozen).toBe(true);
  });

  it('flags an UNQUOTED attribute value (legal HTML, bypassed a quote-only match)', () => {
    const { frozen, violations } = frozenArtifactScan('<script src=https://cdn.evil.example/x.js></script>');
    expect(frozen).toBe(false);
    expect(violations[0].reference).toBe('https://cdn.evil.example/x.js');
  });

  it('flags a PROTOCOL-RELATIVE reference (no explicit http(s) scheme)', () => {
    const { frozen, violations } = frozenArtifactScan('<img src="//cdn.evil.example/x.png">');
    expect(frozen).toBe(false);
    expect(violations[0].reference).toBe('//cdn.evil.example/x.png');
  });

  it.each([
    ['<iframe src="https://evil.example/x"></iframe>'],
    ['<object data="https://evil.example/x"></object>'],
    ['<embed src="https://evil.example/x">'],
    ['<source src="https://evil.example/x">'],
    ['<video poster="https://evil.example/x.png"></video>'],
    ['<form action="https://evil.example/submit"></form>'],
    ['<svg><use xlink:href="https://evil.example/sprite.svg#x"/></svg>'],
  ])('flags a live-fetch vector beyond the original script/link/img triad: %s', (html) => {
    expect(frozenArtifactScan(html).frozen).toBe(false);
  });

  it('flags a bare @import "https://..." with no url() wrapper', () => {
    const { frozen, violations } = frozenArtifactScan('<style>@import "https://evil.example/x.css";</style>');
    expect(frozen).toBe(false);
    expect(violations[0].reference).toBe('https://evil.example/x.css');
  });

  it('flags a <meta http-equiv="refresh"> live redirect', () => {
    const { frozen, violations } = frozenArtifactScan('<meta http-equiv="refresh" content="0;url=https://evil.example/x">');
    expect(frozen).toBe(false);
    expect(violations[0].attribute).toBe('meta[http-equiv=refresh]');
    expect(violations[0].reference).toBe('https://evil.example/x');
  });

  it('a meta refresh with attributes in the OPPOSITE order is still flagged', () => {
    expect(frozenArtifactScan('<meta content="0;url=https://evil.example/x" http-equiv="refresh">').frozen).toBe(false);
  });

  it('an ordinary <meta charset="utf-8"> (not a refresh) is NOT flagged', () => {
    expect(frozenArtifactScan('<meta charset="utf-8">').frozen).toBe(true);
  });

  it('a same-origin relative path is NOT flagged (not a live/remote fetch)', () => {
    expect(frozenArtifactScan('<img src="./local.png">').frozen).toBe(true);
  });

  it('a custom data-* attribute (e.g. data-testid) is NOT mistaken for <object data>', () => {
    expect(frozenArtifactScan('<div data-testid="https://not-a-fetch.example/x"></div>').frozen).toBe(true);
  });

  it.each([
    ['<img data-src="https://not-a-fetch.example/x.png">'],
    ['<a data-href="https://not-a-fetch.example/x">'],
    ['<form data-action="https://not-a-fetch.example/x">'],
    ['<video data-poster="https://not-a-fetch.example/x.png"></video>'],
    ['<body data-background="https://not-a-fetch.example/x.png"></body>'],
  ])('a hyphenated custom attribute that merely ENDS in a tracked name is NOT flagged: %s', (html) => {
    expect(frozenArtifactScan(html).frozen).toBe(true);
  });

  it('flags `srcset` (`\\bsrc\\b` does not match inside `srcset`)', () => {
    const { frozen, violations } = frozenArtifactScan('<img srcset="https://evil.example/x.png 1x">');
    expect(frozen).toBe(false);
    expect(violations[0].reference).toBe('https://evil.example/x.png');
  });

  it('flags <button formaction="..."> distinctly from a plain <form action="...">', () => {
    expect(frozenArtifactScan('<button formaction="https://evil.example/exfil">go</button>').frozen).toBe(false);
  });

  it('flags <html manifest="..."> (legacy app-cache manifest)', () => {
    expect(frozenArtifactScan('<html manifest="https://evil.example/app.appcache"></html>').frozen).toBe(false);
  });

  it('flags a legacy <body background="..."> reference', () => {
    expect(frozenArtifactScan('<body background="https://evil.example/bg.png"></body>').frozen).toBe(false);
  });

  it('flags an <a ping="..."> click-time beacon', () => {
    expect(frozenArtifactScan('<a ping="https://evil.example/beacon" href="./local">x</a>').frozen).toBe(false);
  });

  it('decodes numeric HTML entities before scanning — a raw scheme obfuscated as &#104;ttps:// is still caught', () => {
    const { frozen, violations } = frozenArtifactScan('<script src="&#104;ttps://evil.example/x.js"></script>');
    expect(frozen).toBe(false);
    expect(violations[0].reference).toBe('https://evil.example/x.js');
  });

  it('decodes hex numeric entities (&#x68;) the same way', () => {
    expect(frozenArtifactScan('<script src="&#x68;ttps://evil.example/x.js"></script>').frozen).toBe(false);
  });
});

describe('buildRegistryEntry / validateRegistryEntry — shape', () => {
  it('builds a well-formed @v1 (genesis-eligible) entry', () => {
    const e = entry();
    expect(e.v).toBe(TARGET_REGISTRY_VERSION);
    expect(e.kind).toBe(TARGET_REGISTRY_KIND);
    expect(e.integrityDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(validateRegistryEntry(e).valid).toBe(true);
  });

  it('throws TypeError on a bad shape (programming error)', () => {
    expect(() => buildRegistryEntry({})).toThrow(/target-registry:/);
    expect(() => entry({ version: 0 })).toThrow(TypeError);
    expect(() => entry({ contentHash: 'not-a-hash' })).toThrow(TypeError);
  });

  it('rejects a non-null prevDigest omitted... i.e. version>1 REQUIRES a real prevDigest', () => {
    expect(() => entry({ version: 2, prevDigest: null })).toThrow(/prevDigest/);
  });

  it('version>1 with a well-formed prevDigest builds cleanly', () => {
    const e = entry({ version: 2, prevDigest: `sha256:${'d'.repeat(64)}` });
    expect(e.version).toBe(2);
  });

  describe('source-shape validation (#7)', () => {
    it('a source block missing sourceHash fails validateRegistryEntry', () => {
      const raw = entry();
      raw.source = { kind: 'figma', redacted: true }; // no sourceHash
      expect(validateRegistryEntry(raw).valid).toBe(false);
    });

    it('a source block with redacted !== true fails validateRegistryEntry', () => {
      const raw = entry();
      raw.source = { kind: 'figma', sourceHash: `sha256:${'e'.repeat(64)}`, redacted: false };
      expect(validateRegistryEntry(raw).valid).toBe(false);
    });

    it('a well-formed source block passes', () => {
      const e = entry({ source: { kind: 'figma', sourceHash: `sha256:${'e'.repeat(64)}`, redacted: true } });
      const { valid, record } = validateRegistryEntry(e);
      expect(valid).toBe(true);
      expect(record.source).toEqual({ kind: 'figma', sourceHash: `sha256:${'e'.repeat(64)}`, redacted: true });
    });

    it('buildRegistryEntry itself throws on a bad source block (fail closed at mint time too)', () => {
      expect(() => entry({ source: { sourceHash: `sha256:${'e'.repeat(64)}`, redacted: false } })).toThrow(TypeError);
    });
  });

  it('validateRegistryEntry never throws on garbage input', () => {
    expect(validateRegistryEntry(null).valid).toBe(false);
    expect(validateRegistryEntry('a string').valid).toBe(false);
    expect(validateRegistryEntry([1, 2, 3]).valid).toBe(false);
    expect(validateRegistryEntry({ garbage: true }).valid).toBe(false);
  });
});

describe('serializeRegistryEntry + parseRegistryLog', () => {
  it('round-trips a valid entry through JSONL', () => {
    const e = entry();
    const { ok, line } = serializeRegistryEntry(e);
    expect(ok).toBe(true);
    const parsed = parseRegistryLog(`${line}\n`);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].integrityDigest).toBe(e.integrityDigest);
  });

  it('serializeRegistryEntry refuses an invalid entry — ok:false, no line', () => {
    const { ok, line } = serializeRegistryEntry({ not: 'valid' });
    expect(ok).toBe(false);
    expect(line).toBeNull();
  });

  it('parseRegistryLog skips blank and unparseable lines without throwing', () => {
    const e = entry();
    const text = `\n{not json}\n${JSON.stringify(e)}\n\n`;
    expect(parseRegistryLog(text)).toHaveLength(1);
  });

  it('drops an extra/unrecognized field on the raw object — never lets it reach the committed ledger', () => {
    const raw = { ...entry(), sneaky: 'not part of the schema' };
    const { ok, line } = serializeRegistryEntry(raw);
    expect(ok).toBe(true);
    expect(JSON.parse(line).sneaky).toBeUndefined();
  });

  it('preserves the allow-listed `unlocked: true` writer-stamped field through serialize + parse', () => {
    const raw = { ...entry(), unlocked: true };
    const { line } = serializeRegistryEntry(raw);
    expect(JSON.parse(line).unlocked).toBe(true);
    expect(parseRegistryLog(`${line}\n`)[0].unlocked).toBe(true);
  });
});

describe('foldTargetRegistry', () => {
  it('finds the latest @vN per registryId', () => {
    const v1 = entry({ registryId: 'mock:x@1', version: 1 });
    const v2 = entry({ registryId: 'mock:x@1', version: 2, prevDigest: v1.integrityDigest });
    const other = entry({ registryId: 'mock:y@1', version: 1 });
    const folded = foldTargetRegistry([v1, v2, other]);
    expect(folded.get('mock:x@1').latest.version).toBe(2);
    expect(folded.get('mock:x@1').versions).toHaveLength(2);
    expect(folded.get('mock:y@1').latest.version).toBe(1);
  });
});

describe('verifyChain — tamper detection (#4), GLOBAL append order across multiple registryIds', () => {
  it('an unmutated 3-entry chain across two different registryIds is valid', () => {
    const e1 = entry({ registryId: 'mock:a@1', version: 1, prevDigest: null });
    const e2 = entry({ registryId: 'mock:b@1', version: 1, prevDigest: e1.integrityDigest });
    const e3 = entry({ registryId: 'mock:a@1', version: 2, prevDigest: e2.integrityDigest });
    expect(verifyChain([e1, e2, e3])).toEqual({ valid: true, brokenAt: null, reason: '' });
  });

  it('mutating a historical (non-latest) entry breaks the chain at that exact index, after refold', () => {
    const e1 = entry({ registryId: 'mock:a@1', version: 1, prevDigest: null });
    const e2 = entry({ registryId: 'mock:b@1', version: 1, prevDigest: e1.integrityDigest });
    const e3 = entry({ registryId: 'mock:a@1', version: 2, prevDigest: e2.integrityDigest });
    const tampered = { ...e2, contentHash: `sha256:${'f'.repeat(64)}` }; // e2's fields changed, digest NOT re-minted
    const result = verifyChain([e1, tampered, e3]);
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(1);
  });

  it('the very first entry must have a null prevDigest (fixed genesis)', () => {
    const notGenesis = entry({ registryId: 'mock:a@1', version: 1, prevDigest: `sha256:${'0'.repeat(64)}` });
    // integrityDigest was computed WITH that prevDigest, so it recomputes fine — but position 0 requires null.
    const result = verifyChain([notGenesis]);
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(0);
  });
});

describe('verifyPerceptualFloor — perceptual floor (#8)', () => {
  it('two pHashes within the default threshold (5) are too close', () => {
    // 3 bits apart: 0000 vs 0111 in the low nibble.
    const { tooClose, distance } = verifyPerceptualFloor({ targetPHash: '0000000000000000', buildPHash: '0000000000000007' });
    expect(distance).toBeLessThanOrEqual(5);
    expect(tooClose).toBe(true);
  });

  it('two pHashes far apart are not too close', () => {
    const { tooClose, distance } = verifyPerceptualFloor({ targetPHash: '0000000000000000', buildPHash: 'ffffffffffffffff' });
    expect(distance).toBe(64);
    expect(tooClose).toBe(false);
  });

  it('threshold is caller-overridable', () => {
    expect(verifyPerceptualFloor({ targetPHash: '0000000000000000', buildPHash: '0000000000000007', threshold: 2 }).tooClose).toBe(false);
  });
});

describe('IO shell — targetRegistryPath / appendRegistryEntry / readTargetRegistry', () => {
  let root;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'target-registry-io-')); });
  afterEach(() => { try { rmSync(root, { recursive: true, force: true }); } catch { /* best-effort */ } });

  it('targetRegistryPath places the file under <root>/design-refs/', () => {
    expect(targetRegistryPath(root)).toBe(join(root, 'design-refs', 'target-registry.jsonl'));
  });

  it('readTargetRegistry returns [] for a root with no registry file yet', () => {
    expect(readTargetRegistry(root)).toEqual([]);
  });

  it('appendRegistryEntry writes a line, and it round-trips through readTargetRegistry', () => {
    const prevRoot = process.env.WE_TARGET_REGISTRY_ROOT;
    process.env.WE_TARGET_REGISTRY_ROOT = root;
    try {
      const e = entry();
      const result = appendRegistryEntry(e);
      expect(result.ok).toBe(true);
      expect(existsSync(result.path)).toBe(true);
      const read = readTargetRegistry(root);
      expect(read).toHaveLength(1);
      expect(read[0].integrityDigest).toBe(e.integrityDigest);
      const raw = readFileSync(result.path, 'utf8').trim();
      expect(raw.split('\n')).toHaveLength(1);
    } finally {
      if (prevRoot === undefined) delete process.env.WE_TARGET_REGISTRY_ROOT;
      else process.env.WE_TARGET_REGISTRY_ROOT = prevRoot;
    }
  });

  it('appendRegistryEntry refuses an invalid entry and writes nothing', () => {
    const prevRoot = process.env.WE_TARGET_REGISTRY_ROOT;
    process.env.WE_TARGET_REGISTRY_ROOT = root;
    try {
      const result = appendRegistryEntry({ not: 'valid' });
      expect(result.ok).toBe(false);
      expect(existsSync(targetRegistryPath(root))).toBe(false);
    } finally {
      if (prevRoot === undefined) delete process.env.WE_TARGET_REGISTRY_ROOT;
      else process.env.WE_TARGET_REGISTRY_ROOT = prevRoot;
    }
  });

  it('a second entry chained correctly against the current last digest appends cleanly', () => {
    const prevRoot = process.env.WE_TARGET_REGISTRY_ROOT;
    process.env.WE_TARGET_REGISTRY_ROOT = root;
    try {
      const e1 = entry();
      expect(appendRegistryEntry(e1).ok).toBe(true);
      const e2 = entry({ version: 2, prevDigest: e1.integrityDigest });
      const result = appendRegistryEntry(e2);
      expect(result.ok).toBe(true);
      expect(readTargetRegistry(root)).toHaveLength(2);
    } finally {
      if (prevRoot === undefined) delete process.env.WE_TARGET_REGISTRY_ROOT;
      else process.env.WE_TARGET_REGISTRY_ROOT = prevRoot;
    }
  });

  it('REFUSES a stale prevDigest — closes the TOCTOU race between reading the registry and minting against it', () => {
    const prevRoot = process.env.WE_TARGET_REGISTRY_ROOT;
    process.env.WE_TARGET_REGISTRY_ROOT = root;
    try {
      const e1 = entry();
      expect(appendRegistryEntry(e1).ok).toBe(true);
      // A second "concurrent" mint that (wrongly) still claims genesis (null) as its prevDigest — as if it
      // had read the registry before e1 landed. Must be refused, not silently written.
      const stale = entry({ registryId: 'mock:other@1', prevDigest: null });
      const result = appendRegistryEntry(stale);
      expect(result.ok).toBe(false);
      expect(result.errors[0]).toMatch(/stale prevDigest/);
      expect(readTargetRegistry(root)).toHaveLength(1); // nothing extra was written
    } finally {
      if (prevRoot === undefined) delete process.env.WE_TARGET_REGISTRY_ROOT;
      else process.env.WE_TARGET_REGISTRY_ROOT = prevRoot;
    }
  });

  it('REFUSES a non-sequential version — a correct prevDigest is not enough on its own', () => {
    const prevRoot = process.env.WE_TARGET_REGISTRY_ROOT;
    process.env.WE_TARGET_REGISTRY_ROOT = root;
    try {
      const v1 = entry({ registryId: 'mock:seq@1', version: 1 });
      expect(appendRegistryEntry(v1).ok).toBe(true);
      // Skips @v2 straight to @v3, but its prevDigest correctly chains to v1 — the prevDigest check alone
      // would let this through; only the version check catches it.
      const skipped = entry({ registryId: 'mock:seq@1', version: 3, prevDigest: v1.integrityDigest });
      const result = appendRegistryEntry(skipped);
      expect(result.ok).toBe(false);
      expect(result.errors[0]).toMatch(/non-sequential version/);
      expect(readTargetRegistry(root)).toHaveLength(1);
    } finally {
      if (prevRoot === undefined) delete process.env.WE_TARGET_REGISTRY_ROOT;
      else process.env.WE_TARGET_REGISTRY_ROOT = prevRoot;
    }
  });

  it('stamps unlocked:true and STILL writes when the append lock is held by someone else', () => {
    const prevRoot = process.env.WE_TARGET_REGISTRY_ROOT;
    process.env.WE_TARGET_REGISTRY_ROOT = root;
    const lockRoot = `${dirname(targetRegistryPath(root))}-locks`;
    const LOCK_KEY = '<target-registry:append>';
    mkdirSync(lockRoot, { recursive: true });
    // Pre-hold the SAME lock key appendRegistryEntry uses, as a DIFFERENT owner — simulates real contention
    // deterministically, rather than mocking `reserve` internals.
    const held = reserve(lockRoot, LOCK_KEY, 'some-other-process', Date.now(), new Date().toISOString(), 999999, 'alive', 15);
    expect(held.ok).toBe(true);
    try {
      const e = entry();
      const result = appendRegistryEntry(e);
      expect(result.ok).toBe(true); // a lost lock does not cost the record
      const read = readTargetRegistry(root);
      expect(read).toHaveLength(1);
      expect(read[0].unlocked).toBe(true); // the weaker case is legible, not silent
    } finally {
      try { releaseLockDir(lockRoot, LOCK_KEY); } catch { /* best-effort */ }
      if (prevRoot === undefined) delete process.env.WE_TARGET_REGISTRY_ROOT;
      else process.env.WE_TARGET_REGISTRY_ROOT = prevRoot;
    }
  });
});
