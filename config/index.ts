/**
 * `webeverything.config` author surface + per-dimension config loader/resolver (#1702, ratifying #1662).
 *
 * Public barrel. See `docs/agent/platform-decisions.md#config-extends-platform-default`.
 *
 * @module config
 */
export {
  defineConfig,
  extendsFlavor,
  isExtendsFlavorDescriptor,
  isDimensionPointer,
  InvalidConfigEntryError,
  type WebEverythingConfig,
  type DimensionEntry,
  type DimensionPointer,
  type ExtendsFlavorDescriptor,
  type ThemeFlavorName,
  type RenderStrategyFlavorName,
  type CodegenSoTFlavorName,
} from './defineConfig';

export {
  resolveDimension,
  resolveConfig,
  UnresolvableDimensionError,
  type DimensionResolver,
} from './resolveDimension';

export {
  autoDefineResolver,
  createScalarFlavorResolver,
  PLATFORM_AUTO_DEFINE_FLAVOR,
  PLATFORM_FLAVOR_DEFAULTS,
  type AutoDefineOverrides,
} from './platformFlavor';
