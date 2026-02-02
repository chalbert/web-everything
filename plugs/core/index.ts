// Core utilities - Shared infrastructure

export { default as CustomRegistry } from './CustomRegistry';
export { default as HTMLRegistry } from './HTMLRegistry';
export type { Registry } from './Registry';
export type { 
  CustomRegistryOptions 
} from './CustomRegistry';
export type { 
  BaseDefinition,
  ConstructorDefinition 
} from './HTMLRegistry';

// Clone handler system
export { CloneHandlerRegistry, cloneHandlerRegistry } from './CloneHandlerRegistry';
export type { CloneHandler, CloneContext } from './CloneHandlerRegistry';
export * as cloneUtils from './cloneUtils';
