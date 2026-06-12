/**
 * Deterministic claims seed — a synthetic FNOL/claims book against in-force policies. A Claim is a SECOND
 * domain entity with its own lifecycle (Web Lifecycle), proving the standard generalizes beyond the policy.
 */

import type { Policy, Claim, ClaimState, LossType } from './types';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T>(rng: () => number, xs: T[]): T => xs[Math.floor(rng() * xs.length)];
const int = (rng: () => number, lo: number, hi: number): number => lo + Math.floor(rng() * (hi - lo + 1));

const LOSS: LossType[] = ['collision', 'comprehensive', 'liability', 'theft', 'glass'];
const STATES: ClaimState[] = ['fnol', 'triage', 'investigating', 'investigating', 'approved', 'paying', 'paid', 'denied', 'closed'];
const DESC: Record<LossType, string> = {
  collision: 'Rear-ended at a stop light', comprehensive: 'Hail damage to roof and hood',
  liability: 'At-fault parking-lot contact', theft: 'Vehicle broken into overnight', glass: 'Windshield crack from road debris',
};

export function generateClaims(policies: Policy[], count = 240): Claim[] {
  const inForce = policies.filter((p) => p.state === 'in-force');
  const pool = inForce.length ? inForce : policies;
  const out: Claim[] = [];
  for (let i = 1; i <= count; i++) {
    const rng = mulberry32(0xc1a1 + i * 2654435761);
    const policy = pool[Math.floor(rng() * pool.length)];
    const lossType = pick(rng, LOSS);
    const at = `2026-0${int(rng, 1, 6)}-${String(int(rng, 10, 28)).padStart(2, '0')}T10:00:00Z`;
    out.push({
      claimNumber: `CLM-${String(50000 + i)}`,
      policyNumber: policy.policyNumber,
      state: pick(rng, STATES),
      lossType,
      lossDate: at,
      description: DESC[lossType],
      reserve: int(rng, 1, 18) * 500,
      documents: rng() < 0.6 ? ['fnol-photo-1.jpg'] : [],
      audit: [{ at, actor: 'policyholder', action: 'fnol.filed' }],
    });
  }
  return out;
}
