/**
 * Phase S5 — rules-driven document checklist + upload state machine (#383).
 *
 * The checklist is **generated from the application shape**, not static: a wage-earner owes paystub + W-2;
 * a self-employed borrower owes business returns + P&L; every asset account owes a statement; a purchase
 * owes the purchase agreement; a gift asset owes a (non-blocking) gift letter. Each item carries a state
 * (`requested → uploaded → accepted | rejected`) and a `blocking` flag; the lifecycle guard
 * `processing → underwriting` requires no blocking gaps (see domain/lifecycle.ts).
 *
 * Pure domain — no DOM, no fs. The app.ts documents view renders these and the upload surface (DnD /
 * clipboard / multi-file) drives `uploadDocument`. Upload exercises the WE **data-transfer** intent
 * (clipboard/DnD/files); it has no active runtime block yet, so the app hand-rolls the handlers behind a
 * `// PLATFORM-GAP` tag — the WE work this phase drives.
 */
import type { Application, Asset, Borrower, LoanDocument } from './types';

/** True when any of a borrower's employments is self-employed (drives the business-returns requirement). */
export function isSelfEmployed(borrower: Borrower): boolean {
  return borrower.employment.some((e) => e.selfEmployed)
    || borrower.employment.some((e) => e.income.some((i) => i.kind === 'self-employment'));
}

/** Asset kinds that need a statement to source down-payment / reserves (retirement included, partially liquid). */
const STATEMENT_ASSET_KINDS: ReadonlySet<Asset['kind']> = new Set(['checking', 'savings', 'investment', 'retirement']);

function doc(type: string, label: string, blocking: boolean): LoanDocument {
  return { id: `doc-${type}`, type, label, state: 'requested', blocking, fileNames: [] };
}

/**
 * Derive the required-document checklist from the application. Deterministic and de-duplicated by `type`
 * (so two wage-earners don't both request a generic paystab twice — income docs are per-borrower-keyed).
 */
export function requiredDocuments(app: Application): LoanDocument[] {
  const out: LoanDocument[] = [];

  // Income docs — per borrower, keyed so co-borrowers each get their own.
  app.borrowers.forEach((b, idx) => {
    const who = app.borrowers.length > 1 ? ` (${b.firstName ?? `borrower ${idx + 1}`})` : '';
    if (isSelfEmployed(b)) {
      out.push({ ...doc(`business-returns-${idx}`, `Business tax returns, 2 years${who}`, true) });
      out.push({ ...doc(`profit-loss-${idx}`, `Year-to-date profit & loss${who}`, true) });
    } else {
      out.push({ ...doc(`paystub-${idx}`, `Most recent paystub${who}`, true) });
      out.push({ ...doc(`w2-${idx}`, `W-2, 2 years${who}`, true) });
    }
  });

  // Asset statements — one per distinct account institution+kind; gift assets owe a (non-blocking) letter.
  const seenAssets = new Set<string>();
  app.assets.forEach((a, idx) => {
    if (a.kind === 'gift') {
      out.push(doc(`gift-letter-${idx}`, `Gift letter — ${a.institution}`, false));
      return;
    }
    if (!STATEMENT_ASSET_KINDS.has(a.kind)) return;
    const key = `${a.kind}:${a.institution}`;
    if (seenAssets.has(key)) return;
    seenAssets.add(key);
    out.push(doc(`bank-statement-${idx}`, `${a.kind} statement — ${a.institution}`, true));
  });

  // Purchase agreement — purchases only.
  if (app.loan.purpose === 'purchase') {
    out.push(doc('purchase-agreement', 'Fully-executed purchase agreement', true));
  }

  return out;
}

// ── State machine — pure transitions returning a new documents array ───────────

function update(docs: LoanDocument[], id: string, patch: (d: LoanDocument) => LoanDocument): LoanDocument[] {
  return docs.map((d) => (d.id === id ? patch(d) : d));
}

/** Borrower/processor uploads one or more files against a requested (or rejected) item. */
export function uploadDocument(docs: LoanDocument[], id: string, fileNames: string[]): LoanDocument[] {
  return update(docs, id, (d) => ({ ...d, state: 'uploaded', fileNames: [...d.fileNames, ...fileNames], rejectionReason: undefined }));
}

/** Processor accepts an uploaded item — it clears its gap. */
export function acceptDocument(docs: LoanDocument[], id: string): LoanDocument[] {
  return update(docs, id, (d) => ({ ...d, state: 'accepted', rejectionReason: undefined }));
}

/** Processor rejects an uploaded item with a reason — this RE-OPENS the request (M2). */
export function rejectDocument(docs: LoanDocument[], id: string, reason: string): LoanDocument[] {
  return update(docs, id, (d) => ({ ...d, state: 'rejected', rejectionReason: reason }));
}

/** The lifecycle guard input: a blocking item not yet `accepted` is an open blocking gap. */
export function blockingGapsRemain(docs: LoanDocument[]): boolean {
  return docs.some((d) => d.blocking && d.state !== 'accepted');
}

/** Count of open gaps (blocking + non-blocking) for the checklist summary. */
export function openGaps(docs: LoanDocument[]): { blocking: number; nonBlocking: number } {
  let blocking = 0;
  let nonBlocking = 0;
  for (const d of docs) {
    if (d.state === 'accepted') continue;
    if (d.blocking) blocking += 1;
    else nonBlocking += 1;
  }
  return { blocking, nonBlocking };
}

// ── Upload validation — the data-transfer `acceptance` dimension (client-side) ──

export interface UploadConstraints {
  /** Accepted file extensions (lower-case, no dot), e.g. ['pdf','png','jpg']. Empty = accept all. */
  accept?: string[];
  /** Max bytes per file. */
  maxBytes?: number;
}

export interface UploadRejection {
  fileName: string;
  reason: string;
}

/** Default checklist upload policy: common document types, 10 MB cap. */
export const DEFAULT_UPLOAD_CONSTRAINTS: UploadConstraints = { accept: ['pdf', 'png', 'jpg', 'jpeg', 'heic'], maxBytes: 10 * 1024 * 1024 };

/**
 * Validate a batch of files against the upload constraints (client-side type/size — the mock virus-scan +
 * classify step is downstream). Returns the accepted names and a reason per rejected file. Mirrors the
 * data-transfer intent's `acceptance` dimension (a zone declaring what it accepts).
 */
export function validateUpload(
  files: ReadonlyArray<{ name: string; size: number }>,
  constraints: UploadConstraints = DEFAULT_UPLOAD_CONSTRAINTS,
): { accepted: string[]; rejected: UploadRejection[] } {
  const accepted: string[] = [];
  const rejected: UploadRejection[] = [];
  const accept = (constraints.accept ?? []).map((e) => e.toLowerCase());
  for (const f of files) {
    const ext = (f.name.split('.').pop() ?? '').toLowerCase();
    if (accept.length && !accept.includes(ext)) {
      rejected.push({ fileName: f.name, reason: `type .${ext || '?'} not accepted (allowed: ${accept.join(', ')})` });
      continue;
    }
    if (constraints.maxBytes != null && f.size > constraints.maxBytes) {
      rejected.push({ fileName: f.name, reason: `exceeds ${(constraints.maxBytes / 1024 / 1024).toFixed(0)} MB` });
      continue;
    }
    accepted.push(f.name);
  }
  return { accepted, rejected };
}
