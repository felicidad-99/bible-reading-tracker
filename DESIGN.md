---
name: Bible Track
description: "Read. Track. Finish. — a warm sanctuary system for daily Bible reading habits"
colors:
  primary: "#fd8240"
  primary-deep: "#a04100"
  primary-soft: "#ffe9dc"
  neutral-bg: "#fff8f5"
  neutral-raised: "#ffffff"
  neutral-sunken: "#fff4f1"
  neutral-ink: "#1e1b18"
  neutral-ink-muted: "#574239"
  neutral-ink-subtle: "#85695e"
  neutral-line: "#f4f4f2"
  neutral-line-strong: "#dec0b4"
  neutral-field: "#9d8b80"
  success: "#15803d"
  warning: "#b45309"
  danger: "#b91c1c"
  verdant: "#3d785f"
  sandstone: "#9a6228"
  dark-bg: "#17120e"
  dark-raised: "#211b16"
  dark-ink: "#f5efea"
  dark-ink-muted: "#c9bfb6"
  dark-line: "#332b24"
typography:
  display:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "60px"
    fontWeight: 600
    lineHeight: "1.05"
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: "1.3"
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "1.5"
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 550
    lineHeight: "1rem"
  scripture:
    fontFamily: "Trocchi, Georgia, serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: "1.7"
rounded:
  card: "8px"
  control: "8px"
  pill: "9999px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral-ink}"
    rounded: "{rounded.pill}"
    padding: "10px 20px"
  button-primary-hover:
    backgroundColor: "{colors.primary-deep}"
    textColor: "#ffffff"
  button-secondary:
    backgroundColor: "{colors.neutral-raised}"
    textColor: "{colors.neutral-ink}"
    rounded: "{rounded.pill}"
    padding: "10px 20px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.neutral-ink-muted}"
    rounded: "{rounded.pill}"
  card:
    backgroundColor: "{colors.neutral-raised}"
    textColor: "{colors.neutral-ink}"
    rounded: "{rounded.card}"
    padding: "20px"
  input:
    backgroundColor: "{colors.neutral-raised}"
    textColor: "{colors.neutral-ink}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
---

# Design System: Bible Track

## Overview

**Creative North Star: "Ember Sanctuary"**

Bible Track is a warm-lit sanctuary for a daily habit: quiet reverence without guilt, steadiness without coldness. The system reads like candlelight on warm paper — cream alabaster grounds for reading surfaces, a single living-ember accent that marks the next faithful step, and a complete dark twin (Sanctuary Black) for night reading and the landing threshold, where a photographed open Bible glows at the bottom edge. Density is calm and mobile-first: one task per screen, generous separation, controls within thumb reach. Confirmed visual rejections: no guilt-driven gamification chrome, no pure-gray neutrals, no cool slate dark mode.

**Key Characteristics:**
- Warm-tinted neutrals everywhere; the ember accent marks primary action only.
- Two complete palettes (light cream, dark sanctuary) switched by `.dark` tokens — same roles, same names.
- Pill buttons, 8px cards, 1px warm borders; flat and tonal, never floating.
- Geist for interface voice; Trocchi reserved for Scripture text.
- Gentle 160ms expo easing; motion is reassurance, never spectacle.

## Colors

The palette is warm from the ground up: every neutral carries an amber or brown cast, so even borders and placeholders feel lit rather than clinical.

### Primary
- **Living Ember** (#fd8240): the only accent — primary buttons, progress fills, active states, the flame mark. It marks the single next action or the current streak signal.
- **Ember Deep** (#a04100): primary hover, light-mode focus rings, accent text needing 4.5:1 on cream.
- **Ember Soft** (#ffe9dc): chip and selection backgrounds in light mode (dark twin: #43261a).

### Tertiary
- **Verdant** (#3d785f): completed-state text and success avatars; green means "done," never decoration.
- **Sandstone** (#9a6228): missed-day and avatar tones; amber-brown carries "attention" without alarm.

### Neutral
- **Warm Alabaster** (#fff8f5): page ground. **White** (#ffffff): raised cards and fields. **Sunken Cream** (#fff4f1): wells and tracks.
- **Charcoal Ink** (#1e1b18): primary text. **Muted Umber** (#574239): secondary text. **Faded Umber** (#85695e): tertiary text and placeholders.
- **Hairline** (#f4f4f2): all default borders. **Strong Line** (#dec0b4): emphasized borders.
- **Sanctuary Black** (#17120e): dark ground (dark twin surfaces #211b16 / #120e0b, ink #f5efea / #c9bfb6, line #332b24).

### Named Rules
**The Warm-Neutrals Rule.** No pure gray anywhere — text, borders, fields, and shadows are tinted from the warm palette. A cool or neutral gray hex is a bug.
**The One-Ember Rule.** Living Ember marks primary action and progress signal only; it is never a large background field or decorative wash.

## Typography

**Display Font:** Geist (self-hosted via `next/font`, `--font-geist`)
**Body Font:** Geist (same family; hierarchy comes from size and weight, not family mixing)
**Scripture Font:** Trocchi (`--font-trocchi`), reserved exclusively for Scripture text

**Character:** A single humanist sans doing quiet, confident work, with one serif held back so Biblical quotation feels like a different voice entering the room.

### Hierarchy
- **Display** (600, 60px desktop / 36px mobile, 1.05, -0.025em): landing hero only.
- **Title** (600, 20px, 1.3): page and section headings inside the app.
- **Body** (400, 14px, 1.5): default interface text; sub-copy may step to 16px. Measure 65–75ch for paragraphs.
- **Label** (550, 12px, 1rem): buttons, field labels, status pills, meta rows.
- **Scripture** (400, 18px, 1.7, Trocchi): reader passages and Scripture quotes only.

### Named Rules
**The 12px Floor Rule.** No interface text below 12px, at any breakpoint. Hierarchy comes from weight and color, not from shrinking further.

## Layout

Mobile-first single column. Task surfaces (dashboard, calendar, reader, settings) center in a `max-w-md` (448px) column; auth cards cap at 420px; marketing/landing content uses `max-w-5xl` (1024px). The logged-in shell is a top bar plus a fixed 4-tab bottom dock (thumb zone), with content padded clear of the dock. Spacing runs on a 4px base with 16px as the default gap; separation between groups is generous (24–40px) while related label/control pairs stay tight (4–8px). More space above a heading than below it. The landing inverts the density: centered hero over a fixed photographic ground, proof cards entering the first viewport.

## Elevation & Depth

Flat and tonal: the system is border-and-surface, not shadow. Depth is conveyed by the three warm surface tones (raised / sunken / page) plus 1px hairlines — cards never float.

### Shadow Vocabulary
- **Focus glow** (`box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 20%, transparent)`): input/field focus only, the system's sole shadow.

### Named Rules
**The Flat-By-Default Rule.** Surfaces sit flat at rest; the focus glow is the only shadow in the system. New components earn separation from tone and border, never from drop shadows.

## Shapes

Gently rounded throughout: cards and inputs at 8px (`--radius-card` / `--radius-control`), every button a full pill (9999px), status chips and avatars pill/circular. Borders are 1px warm hairlines; elevation is declared once — border *or* glow, never both stacking into a ghost edge. No hard offset shadows, no left-edge color stripes, no decorative clipping.

## Components

### Buttons
- **Shape:** full pill (9999px), min-height 44px, 12px/560 label.
- **Primary:** ember fill (#fd8240) with charcoal label (#1e1b18); hover deepens to Ember Deep with white label; active scales to 0.98.
- **Secondary:** raised white surface, ink label, 1px hairline; sunken tint on hover.
- **Ghost:** transparent with muted-umber label; sunken tint on hover.
- **Focus:** 2px Ember Deep outline, 2px offset (light) / soft accent outline (dark).

### Cards / Containers
- **Corner:** 8px. **Background:** raised surface. **Border:** 1px hairline. **Padding:** 20px (`p-5`). No resting shadow.

### Inputs / Fields
- 8px radius, raised background, 1px field-colored border; focus swaps to Ember Deep border plus the 3px focus glow. Placeholder text is muted umber.

### Status Pills
- Four states — Not started (sunken/umber), In progress (warning amber), Completed (success green), Missed (danger red) — each a soft tinted background with its darker text.

### Navigation
- App shell: compact top bar (page title + one contextual action) and a fixed bottom dock of four icon+label tabs; active tab in ember. Landing header: wordmark left, Sign in (light pill) + Create account (ember) right.

### Signature: The Flame Mark
- A 28px sandstone-soft tile holding a filled ember flame (Material Symbols `local_fire_department`, FILL 1), used as the wordmark glyph on landing and auth. The icon font is the project's icon system; icons never become unicode glyphs or emoji.

## Do's and Don'ts

### Do:
- **Do** keep every neutral warm-tinted (Alabaster, Umber, Hairline) and switch whole palettes with the `.dark` token block — never hand-pick one-off darks.
- **Do** give each screen one ember primary action; secondary choices step down to secondary or ghost.
- **Do** hold the 12px type floor, 8px card radius, pill buttons, and 160ms expo easing (`cubic-bezier(0.32, 0.72, 0, 1)`).
- **Do** use Trocchi only for Scripture text; interface copy stays Geist.
- **Do** theme browser surfaces (selection, focus, caret, scrollbars) from the palette — the landing does this by carrying `color-scheme: dark`.

### Don't:
- **Don't** add card drop shadows, hard offset shadows, or border-left stripes; separate with tone and 1px hairlines.
- **Don't** use pure gray, cool slate, or blue-black values anywhere.
- **Don't** let ember become a large background field or a second decorative accent.
- **Don't** set interface text under 12px or push display tracking past -0.04em.
- **Don't** introduce emoji or unicode glyphs as icons; use Material Symbols or inline SVG in one weight.
