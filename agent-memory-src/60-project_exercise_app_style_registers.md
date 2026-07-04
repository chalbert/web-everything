---
name: project-exercise-app-style-registers
description: "Each flagship exercise app targets a distinct visual register to prove intents reskin; banking=enterprise (light/dense/corporate), NOT modern SaaS"
metadata: 
  node_type: memory
  type: project
  originSessionId: 3095a24d-fd26-43f4-a67f-bd6d880eb8e9
---

The flagship exercise apps ([[reference_repo_constellation]], backlog #314) deliberately target
**different visual registers** so the same intent-described structure demonstrably reskins via a
theme-token layer — that's the "our intents system replicates very different styles" showcase.

**Per-app register:**
- **Loan origination (app A, #317)** → **enterprise-finance** register: light (never dark-by-default),
  dense, gridlined, conservative navy/gray corporate palette, squared panels with title bars, tabular
  numerics, restrained semantic status colors. Reference points: ICE Encompass / Calyx (the real LOS
  incumbents — dense, "stuck in the 2000s") taken to a **modern-enterprise** finish (Microsoft Fluent /
  Salesforce Lightning), NOT the literal dated look. Banking is explicitly **not** modern-SaaS.
- **Modern-SaaS register** (whitespace-heavy, rounded, soft shadows, dark-mode option, vibrant accents,
  friendly type) is **saved for a different/later app** — do not apply it to banking.

**Why:** the user wants the program to span styles, and banking must read as "big serious financial
software." The original S0 demo's dark/rounded dev-tool look was the wrong register and was corrected.

**How to apply:** implement each register as a **theme-token layer** — CSS custom properties under a
`theme-<register>` body class (app A uses `theme-enterprise` in `demos/loan-origination/app.css`) — over
unchanged structure, so swapping the token set reskins the same components. This is the substrate the
theme-color intent (#010) and broader theming build on. Revisit app "simplicity/complexity" after more
build progress (separate concern from style).
