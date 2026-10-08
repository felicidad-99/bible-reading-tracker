---
version: 1
slug: "src-app-page-tsx"
primary_target: "src/app/page.tsx"
related_targets: []
---

# Landing page — dark reading-room threshold

Scope: `src/app/page.tsx` only. Auth screens and the logged-in app keep the light Ember Sanctuary look.

## Direction contract

### THESIS
The offer presented at the threshold of a night reading room: a wordmark bar, a centered promise above an open Bible's glow, three proof cards — refusing the category's left-aligned, cream-background SaaS landing.

### OWN-WORLD
The existing Ember Sanctuary dark tokens (surface #17120e, raised #211b16, ink #f5efea, muted #c9bfb6, ember #fd8240 primary, warm-white inverse-surface controls, 1px warm line #332b24, 8px card radius, pill buttons) with the supplied photo (`website background.png`, shipped optimized as `/landing-bg.jpg`) as a fixed full-bleed ground: pure black upper field, warm glow at the viewport's bottom edge. Geist throughout; no eyebrow label above the heading.

### STORY
Visitor lands on black, reads the wordmark and sees Create account in ember; the centered heading states the promise ("Read the Bible. Build the habit. Finish what you started."), the sub-copy explains plans and gentle reminders; primary action "Create a reading plan", secondary "Sign in"; three cards prove allocation, schedule, and built-in reader; the footer keeps the Scripture licensing line.

### FIRST VIEWPORT
Fixed photo layer behind everything; header (wordmark with ember flame tile left; warm-white Sign in pill + ember Create account right) on the black upper field; centered hero — heading at display size over two lines, sub-copy at readable measure, ember primary + warm-white secondary buttons; the three dark cards sit below the hero, partially entering the first viewport at 900px height; the photo's glow rests behind the footer at the bottom edge.

### FORM
User-pinned comp: `Layout.png` (layout) over `website background.png` (ground); no concept roll was run because the brief pinned the direction. Code-led (no image generation available).

### FINISH
unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
