/**
 * WE-docs chrome config — the JSON-serializable `ChromeConfig` (#881-A transport) the #865 mode-C mount
 * point hands to the generic FUI chrome module (`@frontierui/embed/chrome-in-document`). WE owns its
 * information architecture (brand / nav tree / footer) as data here; FUI owns the rendering. The module
 * reads this off `data-chrome-config` on the mount point and renders the `app-shell` + `sectioned-nav`
 * blocks (#870), so the rendered site dogfoods FUI components (epic #777).
 *
 * Static and identical on every page (cacheable): the current-page nav link is computed client-side by
 * the FUI module from `location.pathname`, not stamped per route. Mirrors the hand-written `base.njk`
 * reveal-nav, which stays the progressive-enhancement SSR baseline if the FUI module fails to load.
 */
module.exports = {
  brand: {
    title: 'Web Everything',
    href: '/',
    logoSrc: '/assets/logo.svg',
    tagline: 'Defining the missing standards for the modern web.',
  },
  navLabel: 'Main',
  nav: {
    ariaLabel: 'Main',
    sections: [
      {
        id: 'standards',
        label: 'Standards',
        links: [
          { href: '/intents/', label: 'Intents' },
          { href: '/blocks/', label: 'Blocks' },
          { href: '/capabilities/', label: 'Capabilities' },
          { href: '/protocols/', label: 'Protocols' },
          { href: '/design-systems/', label: 'Design Systems' },
          { href: '/presets/', label: 'Presets' },
          { href: '/semantics/', label: 'Semantics' },
        ],
      },
      {
        id: 'explore',
        label: 'Explore',
        links: [
          { href: '/demos/', label: 'Demos' },
          { href: '/conformance/', label: 'Conformance' },
          { href: '/validation-rules/', label: 'Validation' },
          { href: '/research/', label: 'Research' },
          { href: '/backlog/', label: 'Backlog' },
        ],
      },
      {
        id: 'about',
        label: 'About',
        links: [
          { href: '/mission/', label: 'Mission' },
          { href: '/governance/', label: 'Governance' },
          { href: '/author/', label: 'Author' },
        ],
      },
    ],
  },
  headerControls: [
    { label: 'GitHub', variant: 'icon', href: 'https://github.com/chalbert/webeverything', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"/></svg>' },
  ],
  footer: {
    html: '<p>&copy; 2026 Web Everything. No cookies were used. | <a href="https://patreon.com/" style="color: inherit; text-decoration: underline;">Support this project</a></p>',
  },
};
