---
type: idea
workItem: story
size: 5
parent: "746"
status: open
dateOpened: "2026-06-17"
relatedProject: webtheme
tags: [webtheme, design-system, registry, catalog, decision-build]
---

# Build the design-system bundle infrastructure: designSystems.json registry + /design-systems/ catalog + validator

Execute #747 Fork-3-A: stand up the design-system bundle as a real surface. Add the designSystems.json registry (manifests of shape { extends, themeTokens (DTCG ref), intentDefaults?, traitDefaults? } extending the platform default), a /design-systems/ catalog page auto-rendered from it (the protocols.njk/intents.njk precedent), the base.njk nav entry, an authoring note, and a validateDesignSystem rule in check-standards-rules.mjs (every non-token field optional, themeTokens resolves, extends resolves). This is the unbuilt prerequisite every successor presupposes — #749 switcher, #751 Plateau-embed, #754 export, and the #864 WE-docs dogfood bundle all author into a registry that does not yet exist.
