import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// #449 (per #606): WE consumes the plug platform layer as the `@frontierui/plugs` package — dev-time
// resolved to the sibling Frontier UI source (mirrors vite.config.mts). Shared by vitest.config.ts and
// vitest.integration.config.ts so the two runners can never resolve it to different places.
const repoRoot = dirname(fileURLToPath(import.meta.url));
export const fuiPlugsRoot = resolve(repoRoot, '../frontierui/plugs');
// #1910: the webtheme runtime relocated to fui:webtheme (#1907, per #1282). WE's remaining runtime
// consumer — the reproduction-parity harness — imports it via `@frontierui/webtheme`, dev-time resolved
// to the sibling FUI source (mirrors the `@frontierui/plugs` alias). WE keeps only the contract + vectors.
export const fuiWebthemeRoot = resolve(repoRoot, '../frontierui/webtheme');

export const weAlias = {
  '@frontierui/plugs': fuiPlugsRoot,
  '@frontierui/webtheme': fuiWebthemeRoot,
};
