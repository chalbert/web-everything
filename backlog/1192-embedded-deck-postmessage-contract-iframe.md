---
type: idea
workItem: story
status: resolved
size: 3
blockedBy: ["1175"]
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "protocol:embedded-deck"
relatedProject: webportals
tags: [deck, embed, postmessage, webportals]
relatedReport: reports/2026-06-19-deck-slide-standards.md
---

# Embedded-deck postMessage contract (iframe embedding)

Embed a **live deck in another document** with state isolation, deep-link, and cross-iframe sync over a postMessage contract. Composes `navigation` + webportals (compose-intent, don't duplicate the model); homed in **webportals**. *New contract.*

*Carved from epic #1173 under the ratified distributed placement (#1175 → B, no webdecks project); homed by its kin per the contract-inventory table.*

## Progress (batch-2026-06-20-deck)

Authored protocol `embedded-deck` in **webportals** (`we:src/_data/protocols/embedded-deck.json` + spec section `#protocol-embedded-deck` in `we:src/_includes/project-webportals.njk`): a typed postMessage envelope for embedding a live deck in an iframe — host→deck (`goto`/`advance`/`retreat`), deck→host (`state`/`ended`) — with state isolation and independent deep-linking. Composes Navigation + the #1182 slide-addressing semantic (bridges, doesn't duplicate). Satisfies the protocol-anchor gate.
