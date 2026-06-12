/**
 * Mock provider seam (M6 non-functional).
 *
 * Every external integration a real LOS depends on — credit bureau, AUS, income/asset verification,
 * e-sign vendor, document classification — sits behind this interface so the app runs standalone.
 * Swapping to real providers later is an implementation change behind a stable contract (the
 * "minimize lock-in / mock-proxy" principle, backlog #107). Deterministic where it matters.
 */

import type { Application, Finding } from '../domain/types';
import { evaluate } from '../domain/rules';

export interface CreditReport {
  representativeScore: number;
  tradelines: number;
  derogatory: boolean;
  pulledAt: string;
}

export interface AusFindings {
  finding: Finding;
  reasonCodes: string[];
  ranAt: string;
}

export interface VerificationResult {
  type: 'income' | 'asset' | 'employment';
  verified: boolean;
  note: string;
}

export interface ClassificationResult {
  detectedType: string;
  confidence: number;
}

export interface ESignResult {
  signed: boolean;
  signatureId: string;
  signedAt: string;
}

export interface LoanProviders {
  pullCredit(app: Application): Promise<CreditReport>;
  runAus(app: Application): Promise<AusFindings>;
  verify(app: Application, type: VerificationResult['type']): Promise<VerificationResult>;
  classifyDocument(fileName: string): Promise<ClassificationResult>;
  requestESignature(app: Application, signerId: string): Promise<ESignResult>;
}

const NOW = '2026-06-11T00:00:00.000Z';

/**
 * Default in-memory mock. Credit/AUS are derived from the application so the rest of the app sees
 * a self-consistent story (the AUS finding matches the local rules engine).
 */
export const mockProviders: LoanProviders = {
  async pullCredit(app) {
    const representativeScore = Math.min(...app.borrowers.map((b) => b.creditScore));
    return {
      representativeScore,
      tradelines: 3 + (app.liabilities.length || 0),
      derogatory: representativeScore < 600,
      pulledAt: NOW,
    };
  },

  async runAus(app) {
    const result = evaluate(app);
    return { finding: result.finding, reasonCodes: result.reasonCodes, ranAt: NOW };
  },

  async verify(_app, type) {
    return { type, verified: true, note: `${type} verified (mock)` };
  },

  async classifyDocument(fileName) {
    const lower = fileName.toLowerCase();
    const detectedType =
      lower.includes('paystub') ? 'paystub' :
      lower.includes('w2') || lower.includes('w-2') ? 'w2' :
      lower.includes('bank') ? 'bank-statement' :
      lower.includes('purchase') ? 'purchase-agreement' : 'unknown';
    return { detectedType, confidence: detectedType === 'unknown' ? 0.4 : 0.95 };
  },

  async requestESignature(app, signerId) {
    return { signed: true, signatureId: `sig-${app.id}-${signerId}`, signedAt: NOW };
  },
};
