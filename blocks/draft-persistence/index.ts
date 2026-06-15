/**
 * @file blocks/draft-persistence/index.ts
 * @description Public API for the Draft-Persistence block — durable save-and-resume
 * of an entity's working state (the #011 durable storage facet of `webstates`) plus
 * the last-writer-wins co-edit primitive.
 */

// Controller
export { default as DraftPersistence } from './DraftPersistence';
export type { DraftPersistenceOptions } from './DraftPersistence';

// Storage strategies + native-first pick
export {
  MemoryStorageStrategy,
  LocalStorageStrategy,
  IndexedDbStorageStrategy,
  pickDefaultStorage,
} from './storage';

// Co-edit primitive
export { CoEditCoordinator, resolveLww } from './coedit';

// Types
export type {
  CustomStorageStrategy,
  DraftSnapshot,
  DraftPersistenceConfig,
  CoEditor,
  LwwResult,
} from './types';

export { DEFAULT_CONFIG, PRESENCE_EVENT, CONFLICT_EVENT } from './types';
