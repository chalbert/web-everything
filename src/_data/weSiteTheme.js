/**
 * weSiteTheme.js — the WE docs site's **project theme** (the `values→product` layer, #1780 three-layer
 * carve), the override consumed by FUI's `ThemeSource.with()` over the platform default (#1813/#1824
 * Fork 2a). These are the site's brand values that used to be hand-authored as `:root` custom
 * properties in `we:src/css/style.css`; they now live here as the single source the token CSS is
 * emitted from (`scripts/lib/token-css.mjs`), so the site's `--token-*` / legacy `--color-*` vars come
 * from one place — no parallel hand-authoring.
 *
 * Shape: a `Partial<ResolvedTheme>` keyed by FUI token family (`color` · `spacing` · `radius` ·
 * `shadow` · `font`), values plain CSS strings — exactly what `ThemeSource.with(overrides)` accepts.
 * The site uses its own light "Slate/Indigo" brand, so it overrides the FUI dark default's `color`
 * rows by name and adds the names FUI's default lacks (`bg`, `surface`, `text-main`, `text-muted`,
 * `primary-hover`, `border`, `spacing.*`, `radius.md/lg/full`, `shadow.glass`, `font.sans`).
 *
 * NOTE: these are the SAME values the old `:root` block declared (so the site renders identically —
 * #1813's no-visual-diff acceptance); the WCAG-AA contrast adjustments (#793) are preserved verbatim.
 *
 * @typedef {Record<string, string>} TokenSet
 * @type {{color:TokenSet, spacing:TokenSet, radius:TokenSet, shadow:TokenSet, font:TokenSet}}
 */
const weSiteTheme = {
  color: {
    bg: '#f8fafc', // Slate-50
    surface: '#ffffff',
    'text-main': '#1e293b', // Slate-800
    'text-muted': '#475569', // Slate-600 — darkened from Slate-500 for WCAG AA contrast (#793)
    primary: '#4f46e5', // Indigo-600 — darkened from Indigo-500 for WCAG AA contrast (#793)
    'primary-hover': '#4338ca',
    border: '#e2e8f0', // Slate-200
  },
  spacing: {
    xs: '0.5rem',
    sm: '1rem',
    md: '2rem',
    lg: '4rem',
    xl: '8rem',
  },
  radius: {
    md: '8px',
    lg: '16px',
    full: '9999px',
  },
  shadow: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    glass: '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
  },
  font: {
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
};

/**
 * The legacy → emitted alias map: each `--<family>-<name>` custom property the site's 629 existing
 * call sites reference, pointed at its emitted `--token-<family>-<name>`. Generated into a `:root{}`
 * block by `scripts/lib/token-css.mjs` (`--color-primary: var(--token-color-primary)`), so the call
 * sites keep working AND now derive from the injector. The legacy var name is NOT always
 * `--<family>-<name>` (the site uses `--color-text-main`, not `--text-main`), so the mapping is
 * explicit rather than mechanical.
 */
const LEGACY_ALIASES = [
  { legacy: '--color-bg', family: 'color', name: 'bg' },
  { legacy: '--color-surface', family: 'color', name: 'surface' },
  { legacy: '--color-text-main', family: 'color', name: 'text-main' },
  { legacy: '--color-text-muted', family: 'color', name: 'text-muted' },
  { legacy: '--color-primary', family: 'color', name: 'primary' },
  { legacy: '--color-primary-hover', family: 'color', name: 'primary-hover' },
  { legacy: '--color-border', family: 'color', name: 'border' },
  { legacy: '--font-sans', family: 'font', name: 'sans' },
  { legacy: '--spacing-xs', family: 'spacing', name: 'xs' },
  { legacy: '--spacing-sm', family: 'spacing', name: 'sm' },
  { legacy: '--spacing-md', family: 'spacing', name: 'md' },
  { legacy: '--spacing-lg', family: 'spacing', name: 'lg' },
  { legacy: '--spacing-xl', family: 'spacing', name: 'xl' },
  { legacy: '--radius-md', family: 'radius', name: 'md' },
  { legacy: '--radius-lg', family: 'radius', name: 'lg' },
  { legacy: '--radius-full', family: 'radius', name: 'full' },
  { legacy: '--shadow-sm', family: 'shadow', name: 'sm' },
  { legacy: '--shadow-md', family: 'shadow', name: 'md' },
  { legacy: '--shadow-lg', family: 'shadow', name: 'lg' },
  { legacy: '--shadow-glass', family: 'shadow', name: 'glass' },
];

module.exports = weSiteTheme;
module.exports.LEGACY_ALIASES = LEGACY_ALIASES;
