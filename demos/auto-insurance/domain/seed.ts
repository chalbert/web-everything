/**
 * Deterministic seed — a synthetic book of personal-auto policies. Seeded PRNG (no Math.random) so the
 * book is reproducible, spread across territories / driver profiles / coverages / lifecycle states.
 */

import type { Policy, PolicyState, Driver, Vehicle, Coverage } from './types';

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

const FIRST = ['James', 'Maria', 'David', 'Aisha', 'Liam', 'Sofia', 'Noah', 'Mei', 'Omar', 'Grace', 'Lucas', 'Priya'];
const LAST = ['Okafor', 'Nguyen', 'Patel', 'Garcia', 'Cohen', 'Sato', 'Brooks', 'Rossi', 'Khan', 'Müller', 'Silva', 'Ahmed'];
const MAKES: Array<[string, string, number, number]> = [ // make, model, symbol, value
  ['Toyota', 'Corolla', 8, 22000], ['Honda', 'Civic', 9, 24000], ['Ford', 'F-150', 14, 42000],
  ['Tesla', 'Model 3', 22, 46000], ['BMW', 'M3', 26, 78000], ['Subaru', 'Outback', 12, 31000],
  ['Chevrolet', 'Malibu', 10, 26000], ['Jeep', 'Wrangler', 15, 40000], ['Porsche', '911', 27, 120000],
  ['Hyundai', 'Elantra', 7, 21000],
];
const TERRITORIES = ['T1', 'T2', 'T3', 'T3', 'T4', 'T5'];
const STATES: PolicyState[] = ['quote', 'referred', 'quoted', 'bound', 'in-force', 'in-force', 'in-force', 'cancelled', 'expired', 'lapsed'];

function makeDriver(rng: () => number): Driver {
  return {
    firstName: pick(rng, FIRST), lastName: pick(rng, LAST),
    licenseYears: int(rng, 0, 40),
    incidents: rng() < 0.55 ? 0 : int(rng, 1, 5),
  };
}

function makeVehicle(rng: () => number): Vehicle {
  const [make, model, symbol, value] = pick(rng, MAKES);
  return { year: int(rng, 2012, 2026), make, model, symbol, annualMiles: int(rng, 4, 24) * 1000, value };
}

function makeCoverages(rng: () => number): Coverage[] {
  const cov: Coverage[] = [
    { id: 'bi', limit: pick(rng, [50000, 100000, 250000]) },
    { id: 'pd', limit: pick(rng, [25000, 50000, 100000]) },
  ];
  if (rng() < 0.6) cov.push({ id: 'collision', deductible: pick(rng, [500, 1000]) });
  if (rng() < 0.55) cov.push({ id: 'comprehensive', deductible: pick(rng, [250, 500]) });
  if (rng() < 0.3) cov.push({ id: 'rental' });
  if (rng() < 0.25) cov.push({ id: 'roadside' });
  return cov;
}

function generatePolicy(i: number): Policy {
  const rng = mulberry32(0x5eed + i * 2654435761);
  const insured = makeDriver(rng);
  const extra = rng() < 0.3 ? [makeDriver(rng)] : [];
  const vehicles = Array.from({ length: rng() < 0.35 ? 2 : 1 }, () => makeVehicle(rng));
  const now = `2026-0${int(rng, 1, 6)}-${String(int(rng, 10, 28)).padStart(2, '0')}T09:00:00Z`;
  return {
    policyNumber: `PA-${String(100000 + i)}`,
    state: pick(rng, STATES),
    insured,
    drivers: [insured, ...extra],
    vehicles,
    coverages: makeCoverages(rng),
    territory: pick(rng, TERRITORIES),
    priorLapse: rng() < 0.18,
    term: { start: now, months: 6 },
    audit: [{ at: now, actor: 'system', action: 'quote.created' }],
  };
}

export function generateBook(count = 4000): Policy[] {
  const out: Policy[] = [];
  for (let i = 1; i <= count; i++) out.push(generatePolicy(i));
  return out;
}
