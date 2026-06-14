/**
 * @file blocks/renderers/module-service/generation/index.ts
 * @description Public surface of the MaaS generation adapter (backlog #547, slice 1 of #507).
 * The deterministic engine, the language-backend contract, and the registered backends.
 */
export { generateOrigin, generateOrigins, NonDeterministicBackendError } from './generate';
export type { GeneratedModule, GeneratedOrigin, LanguageBackend } from './languageBackend';
export { javascriptBackend } from './backends/javascript';
export { csharpBackend } from './backends/csharp';
