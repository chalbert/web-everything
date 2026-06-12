/**
 * @file webpolicy/proof.ts
 * @description Proof-of-compliance format — backlog #407 (Fork 2 of the #093 ruling, profile A*), built
 *   on the #406 webpolicy project + DMN-aligned rule meta-schema.
 *
 * A tamper-evident, auditor-acceptable record of policy decisions. Each {@link ProofRecord} is an
 * OPA-style decision-log entry — `{ rule, inputs, verdict, actor, time }` anchored to a webtraces span —
 * appended to a **SHA-256 hash chain** (`hash = H(prevHash ‖ canonical(record))`), so any edit to a past
 * record breaks every hash after it. Records are **signed** through a swappable {@link Signer} seam, and
 * the chain exports an **OSCAL-aligned** bundle (machine-readable assessment results an auditor's tooling
 * ingests).
 *
 * **A\* raised the baseline to external anchoring:** {@link ProofChain.checkpoint} computes a **Merkle
 * root** over the record hashes and anchors it to a running **transparency log** (e.g. Sigstore Rekor)
 * via an injected anchor function — so a third party can verify the log existed at a point in time
 * without trusting the operator. Full per-record inclusion proofs / a blockchain anchor are an opt-in
 * strength dial layered on the same Merkle root, not required here.
 *
 * Pure + dependency-free, like the rest of the standards planes: the SHA-256 `hash`, the wall-clock
 * `time`, the `Signer`, and the transparency-log `anchor` are all **injected** (a Node host wires
 * `node:crypto` + Rekor; the browser wires Web Crypto). The core owns only the chain/Merkle/OSCAL logic,
 * so it is deterministic and testable with no ambient crypto or clock.
 */

/** A versioned reference to the policy rule that produced a verdict (the #406 `PolicyRuleSet` id+version). */
export interface RuleRef {
  readonly id: string;
  readonly version: string;
}

/** The decision an enforcement point recorded — the content of one proof entry, before chaining. */
export interface ProofRecordInput {
  readonly rule: RuleRef;
  /** The inputs the rule was evaluated against (the decision's facts). */
  readonly inputs: Readonly<Record<string, unknown>>;
  /** The verdict (OPA/DMN style); open vocabulary, e.g. `permit` | `deny` | `not-applicable`. */
  readonly verdict: string;
  /** Who/what made the decision (service, user, or agent id). */
  readonly actor: string;
  /** ISO-8601 decision time — INJECTED by the caller (the core never reads the clock). */
  readonly time: string;
  /** The webtraces span this decision is anchored to, tying the proof back to the live request. */
  readonly traceSpan?: string;
}

/** A chained, optionally-signed proof entry — the input plus its position and hash linkage. */
export interface ProofRecord extends ProofRecordInput {
  readonly seq: number;
  readonly prevHash: string;
  readonly hash: string;
  readonly signature?: string;
}

/** Injected SHA-256 (or any collision-resistant hash): a string in, a hex digest out. */
export type HashFn = (input: string) => string;

/**
 * The swappable signing seam. The reference walking-skeleton signer is symmetric (sign = keyed hash,
 * `verify` re-derives and compares); a production signer is asymmetric (`sign` with a private key,
 * `verify` with the public key) behind the same shape — the chain never assumes which.
 */
export interface Signer {
  readonly id: string;
  sign(data: string): string;
  /** Verify a signature; defaults (when omitted) to re-signing and comparing — valid only for a symmetric signer. */
  verify?(data: string, signature: string): boolean;
}

/** The transparency-log anchor for a Merkle root — what {@link ProofChain.checkpoint} records (e.g. Rekor). */
export interface TransparencyAnchor {
  /** The log this root was submitted to (e.g. `rekor`). */
  readonly logId: string;
  /** The log's own identifier for the entry (an index / UUID), used to fetch + verify it later. */
  readonly entryId: string;
  /** When the log accepted it (ISO-8601). */
  readonly anchoredAt: string;
}

/** Submit a Merkle root to a transparency log and return its anchor — injected (a Node host wires Rekor). */
export type AnchorFn = (merkleRoot: string) => TransparencyAnchor;

/** A periodic external-anchoring checkpoint — a Merkle root over the chain so far + its transparency anchor. */
export interface Checkpoint {
  readonly merkleRoot: string;
  readonly recordCount: number;
  readonly chainHead: string;
  readonly anchor: TransparencyAnchor;
}

/** The result of re-walking the chain — `ok`, or the first record that failed and why. */
export interface VerifyResult {
  readonly ok: boolean;
  readonly brokenAt?: number;
  readonly reason?: string;
}

/** Deterministic (sorted-key) JSON — so the SAME record always hashes the same, regardless of key order. */
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(',')}}`;
}

/** The genesis hash for an empty chain — the prevHash of the first record. */
export const GENESIS_HASH = '0'.repeat(64);

/**
 * An append-only, hash-chained, signable proof log. `append` links each record to the previous by hashing
 * `prevHash ‖ canonical(content)`; `verify` re-walks to prove no record was altered or reordered;
 * `merkleRoot` + `checkpoint` provide the A* external-anchoring baseline; `toOscal` exports an
 * auditor-ingestible bundle. All crypto + clock + transport is injected, so the chain itself is pure.
 */
export class ProofChain {
  readonly #hash: HashFn;
  readonly #signer: Signer | null;
  readonly #genesis: string;
  readonly #records: ProofRecord[] = [];

  constructor(opts: { hash: HashFn; signer?: Signer; genesis?: string }) {
    this.#hash = opts.hash;
    this.#signer = opts.signer ?? null;
    this.#genesis = opts.genesis ?? GENESIS_HASH;
  }

  /**
   * Rehydrate a chain from already-built records — the auditor's path: receive a proof bundle and
   * {@link verify} it independently, against the same `hash`/`signer` the producer used. Does not
   * re-chain; the records are taken as-is so {@link verify} can prove (or disprove) their integrity.
   */
  static from(records: readonly ProofRecord[], opts: { hash: HashFn; signer?: Signer; genesis?: string }): ProofChain {
    const chain = new ProofChain(opts);
    chain.#records.push(...records);
    return chain;
  }

  /** The hash linking `content` at `seq` to `prevHash` — the chain's per-record digest. */
  #recordHash(content: ProofRecordInput, seq: number, prevHash: string): string {
    return this.#hash(canonical({ seq, prevHash, content }));
  }

  /** Append a decision to the chain, computing its hash + (if a signer is set) its signature. */
  append(input: ProofRecordInput): ProofRecord {
    const seq = this.#records.length;
    const prevHash = seq === 0 ? this.#genesis : this.#records[seq - 1].hash;
    const hash = this.#recordHash(input, seq, prevHash);
    const signature = this.#signer ? this.#signer.sign(hash) : undefined;
    const record: ProofRecord = { ...input, seq, prevHash, hash, signature };
    this.#records.push(record);
    return record;
  }

  get records(): readonly ProofRecord[] {
    return this.#records;
  }

  /** The latest record's hash — the chain head a checkpoint anchors. */
  get head(): string {
    return this.#records.length ? this.#records[this.#records.length - 1].hash : this.#genesis;
  }

  /**
   * Re-walk the chain and prove integrity: every record's `prevHash` links correctly, its `hash`
   * recomputes from its content (tamper detection), and its signature verifies. Returns the first break.
   */
  verify(): VerifyResult {
    let prevHash = this.#genesis;
    for (const record of this.#records) {
      if (record.prevHash !== prevHash) {
        return { ok: false, brokenAt: record.seq, reason: 'prevHash does not link to the previous record' };
      }
      const { seq, prevHash: _p, hash: _h, signature: _s, ...content } = record;
      const expected = this.#recordHash(content, seq, prevHash);
      if (expected !== record.hash) {
        return { ok: false, brokenAt: record.seq, reason: 'record content was altered (hash mismatch)' };
      }
      if (this.#signer) {
        if (record.signature === undefined) return { ok: false, brokenAt: record.seq, reason: 'missing signature' };
        const verified = this.#signer.verify
          ? this.#signer.verify(record.hash, record.signature)
          : this.#signer.sign(record.hash) === record.signature;
        if (!verified) return { ok: false, brokenAt: record.seq, reason: 'signature does not verify' };
      }
      prevHash = record.hash;
    }
    return { ok: true };
  }

  /**
   * The Merkle root over every record hash (a binary tree, duplicating the last leaf on an odd level —
   * the common RFC-6962-style convention). One root commits to the entire log, so a single external
   * anchor of this root makes the whole chain third-party verifiable.
   */
  merkleRoot(): string {
    if (this.#records.length === 0) return this.#genesis;
    let level = this.#records.map((r) => r.hash);
    while (level.length > 1) {
      const next: string[] = [];
      for (let i = 0; i < level.length; i += 2) {
        const left = level[i];
        const right = i + 1 < level.length ? level[i + 1] : left; // duplicate the odd leaf
        next.push(this.#hash(left + right));
      }
      level = next;
    }
    return level[0];
  }

  /** A* external anchoring: checkpoint the current Merkle root to a transparency log via `anchor`. */
  checkpoint(anchor: AnchorFn): Checkpoint {
    const merkleRoot = this.merkleRoot();
    return { merkleRoot, recordCount: this.#records.length, chainHead: this.head, anchor: anchor(merkleRoot) };
  }

  /**
   * Export an OSCAL-aligned assessment-results bundle: each proof record becomes an OSCAL `observation`
   * (the decision) with a `finding` carrying the verdict, plus a back-matter checkpoint when one is given.
   * Deliberately a minimal, recognizably-OSCAL shape (assessment-results → results → observations) — an
   * auditor's OSCAL tooling reads it; the full catalog cross-refs are an opt-in elaboration.
   */
  toOscal(meta: { title: string; uuid: string; anchored?: Checkpoint }): OscalAssessmentResults {
    return {
      'assessment-results': {
        uuid: meta.uuid,
        metadata: { title: meta.title, version: '1.0.0', 'oscal-version': '1.1.2' },
        results: [
          {
            uuid: meta.uuid,
            title: `${this.#records.length} policy decisions`,
            observations: this.#records.map((r) => ({
              uuid: r.hash,
              description: `rule ${r.rule.id}@${r.rule.version} → ${r.verdict}`,
              methods: ['TEST'],
              collected: r.time,
              'relevant-evidence': r.traceSpan ? [{ href: `webtraces:${r.traceSpan}` }] : undefined,
              props: [
                { name: 'verdict', value: r.verdict },
                { name: 'actor', value: r.actor },
                { name: 'hash', value: r.hash },
                ...(r.signature ? [{ name: 'signature', value: r.signature }] : []),
              ],
            })),
            ...(meta.anchored
              ? { 'back-matter': { resources: [{ uuid: meta.anchored.merkleRoot, title: `transparency-log anchor (${meta.anchored.anchor.logId})`, props: [{ name: 'entry-id', value: meta.anchored.anchor.entryId }, { name: 'merkle-root', value: meta.anchored.merkleRoot }] }] } }
              : {}),
          },
        ],
      },
    };
  }
}

// ── OSCAL shape (minimal, assessment-results-aligned) ────────────────────────────

interface OscalObservation {
  uuid: string;
  description: string;
  methods: string[];
  collected: string;
  'relevant-evidence'?: { href: string }[];
  props: { name: string; value: string }[];
}
interface OscalResult {
  uuid: string;
  title: string;
  observations: OscalObservation[];
  'back-matter'?: { resources: { uuid: string; title: string; props: { name: string; value: string }[] }[] };
}
export interface OscalAssessmentResults {
  'assessment-results': {
    uuid: string;
    metadata: { title: string; version: string; 'oscal-version': string };
    results: OscalResult[];
  };
}
