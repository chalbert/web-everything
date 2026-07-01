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

// The legacy → emitted semantic-alias map (`--color-primary: var(--token-color-primary)`, …) used to
// live here, but #2026 Fork 1 relocated it into the FUI-owned single source (`fui:plugs/webtheme/
// legacyAliases.ts`) so the FUI runtime emit and this website build share one source. The build
// (`scripts/lib/token-css.mjs`) now imports `LEGACY_ALIASES` from the transpiled FUI bundle; this file
// stays the WE-site *project theme values* only.

module.exports = weSiteTheme;
