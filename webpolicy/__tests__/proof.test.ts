/**
 * Proof-of-compliance format (backlog #407, profile A*). Proves the hash chain links + is tamper-evident,
 * the signing seam verifies, the Merkle root + transparency-log checkpoint give external anchoring, and
 * the OSCAL export is auditor-shaped. Real SHA-256 (node:crypto) is INJECTED here — the core stays pure.
 */
import { describe, it, expect } from 'vitest';
import { createHash, createHmac } from 'node:crypto';
import {
  ProofChain,
  GENESIS_HASH,
  type HashFn,
  type Signer,
  type ProofRecordInput,
  type AnchorFn,
} from '../proof';

const sha256: HashFn = (input) => createHash('sha256').update(input).digest('hex');

// Reference symmetric signer (keyed HMAC) — the walking-skeleton stand-in; a real one is asymmetric.
const hmacSigner = (key: string): Signer => ({
  id: `hmac:${key}`,
  sign: (data) => createHmac('sha256', key).update(data).digest('hex'),
});

const decision = (verdict: string, n: number): ProofRecordInput => ({
  rule: { id: 'gdpr.export-consent', version: '1.2.0' },
  inputs: { subjectId: `s${n}`, region: 'EU' },
  verdict,
  actor: 'policy-engine',
  time: `2026-06-12T10:0${n}:00Z`,
  traceSpan: `span-${n}`,
});

describe('ProofChain — hash chain', () => {
  it('links each record to the previous (genesis-rooted)', () => {
    const chain = new ProofChain({ hash: sha256 });
    const a = chain.append(decision('permit', 0));
    const b = chain.append(decision('deny', 1));
    expect(a.prevHash).toBe(GENESIS_HASH);
    expect(a.seq).toBe(0);
    expect(b.prevHash).toBe(a.hash); // b chains onto a
    expect(chain.head).toBe(b.hash);
    expect(a.hash).toHaveLength(64); // real sha-256 hex
  });

  it('verify() passes for an intact chain', () => {
    const chain = new ProofChain({ hash: sha256 });
    chain.append(decision('permit', 0));
    chain.append(decision('deny', 1));
    chain.append(decision('not-applicable', 2));
    expect(chain.verify()).toEqual({ ok: true });
  });

  it('is tamper-evident — editing a past record breaks verification at that record', () => {
    const chain = new ProofChain({ hash: sha256 });
    chain.append(decision('deny', 0));
    chain.append(decision('permit', 1));

    // An auditor receives the bundle; someone flipped record 0's verdict deny → permit but kept its hash.
    const tampered = chain.records.map((r) => (r.seq === 0 ? { ...r, verdict: 'permit' } : r));
    const received = ProofChain.from(tampered, { hash: sha256 });
    const result = received.verify();
    expect(result.ok).toBe(false);
    expect(result.brokenAt).toBe(0);
    expect(result.reason).toMatch(/altered/);
  });

  it('detects a reordering / broken link', () => {
    const chain = new ProofChain({ hash: sha256 });
    chain.append(decision('deny', 0));
    chain.append(decision('permit', 1));
    const swapped = [chain.records[1], chain.records[0]]; // out of order
    expect(ProofChain.from(swapped, { hash: sha256 }).verify().ok).toBe(false);
  });
});

describe('ProofChain — signing seam', () => {
  it('signs each record and verifies the signatures', () => {
    const signer = hmacSigner('k1');
    const chain = new ProofChain({ hash: sha256, signer });
    const rec = chain.append(decision('permit', 0));
    expect(rec.signature).toBeDefined();
    expect(chain.verify()).toEqual({ ok: true });
  });

  it('fails verification when a signature does not match the record', () => {
    const chain = new ProofChain({ hash: sha256, signer: hmacSigner('k1') });
    chain.append(decision('permit', 0));
    // Verify the SAME records under a different key → signatures no longer verify.
    const wrongKey = ProofChain.from(chain.records, { hash: sha256, signer: hmacSigner('k2') });
    const result = wrongKey.verify();
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/signature/);
  });
});

describe('ProofChain — Merkle root + external anchoring (A*)', () => {
  it('produces a stable Merkle root that changes when the log changes', () => {
    const chain = new ProofChain({ hash: sha256 });
    chain.append(decision('permit', 0));
    const root1 = chain.merkleRoot();
    chain.append(decision('deny', 1));
    const root2 = chain.merkleRoot();
    expect(root1).toHaveLength(64);
    expect(root2).not.toBe(root1); // appending a record moves the root
    // Deterministic: an identical log yields the identical root.
    const twin = new ProofChain({ hash: sha256 });
    twin.append(decision('permit', 0));
    twin.append(decision('deny', 1));
    expect(twin.merkleRoot()).toBe(root2);
  });

  it('checkpoints the root to a transparency log via the injected anchor', () => {
    const chain = new ProofChain({ hash: sha256 });
    chain.append(decision('permit', 0));
    chain.append(decision('deny', 1));

    const anchored: string[] = [];
    const anchor: AnchorFn = (root) => {
      anchored.push(root);
      return { logId: 'rekor', entryId: '0x1234', anchoredAt: '2026-06-12T11:00:00Z' };
    };
    const checkpoint = chain.checkpoint(anchor);
    expect(checkpoint.merkleRoot).toBe(chain.merkleRoot());
    expect(checkpoint.recordCount).toBe(2);
    expect(checkpoint.chainHead).toBe(chain.head);
    expect(checkpoint.anchor).toEqual({ logId: 'rekor', entryId: '0x1234', anchoredAt: '2026-06-12T11:00:00Z' });
    expect(anchored).toEqual([chain.merkleRoot()]); // the root was actually submitted
  });
});

describe('ProofChain — OSCAL export', () => {
  it('exports an assessment-results bundle with one observation per decision', () => {
    const chain = new ProofChain({ hash: sha256, signer: hmacSigner('k1') });
    chain.append(decision('permit', 0));
    chain.append(decision('deny', 1));
    const oscal = chain.toOscal({ title: 'GDPR export decisions', uuid: 'uuid-1' });

    const ar = oscal['assessment-results'];
    expect(ar.metadata['oscal-version']).toBe('1.1.2');
    expect(ar.results[0].observations).toHaveLength(2);
    const obs0 = ar.results[0].observations[0];
    expect(obs0.description).toBe('rule gdpr.export-consent@1.2.0 → permit');
    expect(obs0.props.find((p) => p.name === 'verdict')!.value).toBe('permit');
    expect(obs0.props.find((p) => p.name === 'signature')).toBeDefined();
    expect(obs0['relevant-evidence']).toEqual([{ href: 'webtraces:span-0' }]);
  });

  it('includes a back-matter resource for the transparency-log anchor when checkpointed', () => {
    const chain = new ProofChain({ hash: sha256 });
    chain.append(decision('permit', 0));
    const anchored = chain.checkpoint(() => ({ logId: 'rekor', entryId: '42', anchoredAt: '2026-06-12T11:00:00Z' }));
    const oscal = chain.toOscal({ title: 'audit', uuid: 'uuid-2', anchored });
    const backMatter = oscal['assessment-results'].results[0]['back-matter'];
    expect(backMatter!.resources[0].props.find((p) => p.name === 'entry-id')!.value).toBe('42');
  });
});
