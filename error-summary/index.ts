/**
 * Error-summary model (#1114) — the GOV.UK dual-model aggregation (DOM-ordered + field-link), pure and
 * DOM-free. The runtime `<validation-error-summary>` element consumes it; the model is the build-agnostic
 * half (mirrors validity-merge / commitment-policy split).
 */
export * from './model.js';
