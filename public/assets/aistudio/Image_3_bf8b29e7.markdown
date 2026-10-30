---
name: Synthetic Intelligence Interface
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#bcc9cd'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#869397'
  outline-variant: '#3d494c'
  surface-tint: '#4cd7f6'
  primary: '#4cd7f6'
  on-primary: '#003640'
  primary-container: '#06b6d4'
  on-primary-container: '#00424f'
  inverse-primary: '#00687a'
  secondary: '#c0c1ff'
  on-secondary: '#1000a9'
  secondary-container: '#3131c0'
  on-secondary-container: '#b0b2ff'
  tertiary: '#7bd0ff'
  on-tertiary: '#00354a'
  tertiary-container: '#23b2ec'
  on-tertiary-container: '#00415a'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#acedff'
  primary-fixed-dim: '#4cd7f6'
  on-primary-fixed: '#001f26'
  on-primary-fixed-variant: '#004e5c'
  secondary-fixed: '#e1e0ff'
  secondary-fixed-dim: '#c0c1ff'
  on-secondary-fixed: '#07006c'
  on-secondary-fixed-variant: '#2f2ebe'
  tertiary-fixed: '#c4e7ff'
  tertiary-fixed-dim: '#7bd0ff'
  on-tertiary-fixed: '#001e2c'
  on-tertiary-fixed-variant: '#004c69'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '600'
    lineHeight: 48px
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '600'
    lineHeight: 38px
  headline-lg:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 30px
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
  code-md:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-tablet: 1.5rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 2rem
---

## Brand & Style

This design system embodies an authoritative, friction-free environment tailored for high-cognition computational dialogue, contextual research, and generative productivity. The aesthetic fuses **Technical Minimalism** with nuanced **Glassmorphic Precision**, avoiding unnecessary visual noise to prioritize conversational readability and focus.

### Personality & Tone
- **Intellectual & Composed:** The interface acts as a silent canvas that elevates the user's workflow without imposing personality onto the AI's outputs.
- **Precision-Engineered:** Sharp structure, micro-borders, and high legibility communicate absolute reliability, high processing velocity, and structural clarity.
- **Luminescent & Atmospheric:** Interaction accents utilize soft cyan-indigo luminescence to indicate state changes, generation cycles, and context switches without visual fatigue.

### Core Visual Principles
- **Atmospheric Layering:** Depth is conveyed through translucent glass tiers, backdrop blurs (`backdrop-filter: blur(12px)`), and delicate 1px border lines rather than heavy drop shadows.
- **Content Hierarchy First:** Utilitarian sidebars and floating input composers frame an expansive, readable stream of conversational nodes.

## Colors

The palette balances cool slate/zinc neutrals with precise glowing accents (cyan `#06b6d4` and indigo `#6366f1`). It is engineered to perform seamlessly across dark and light paradigms, with dark mode serving as the flagship default.

### Dark Mode (Default)
- **Canvas Base:** `#090d16` (Deep Obsidian Slate)
- **Surface Elevation 1 (Sidebar / Panels):** `#0f172a` (Deep Slate)
- **Surface Elevation 2 (Cards / Bubbles / Inputs):** `#1e293b` with 60% alpha translucency (`rgba(30, 41, 59, 0.6)`)
- **Surface Elevation 3 (Active / Hover Overlays):** `#334155` with 40% alpha translucency
- **Border Ghost Subdued:** `rgba(148, 163, 184, 0.08)`
- **Border Highlight / Focus:** `rgba(6, 182, 212, 0.4)`
- **Text Primary:** `#f8fafc`
- **Text Secondary:** `#94a3b8`
- **Text Muted:** `#64748b`

### Light Mode
- **Canvas Base:** `#f8fafc`
- **Surface Elevation 1 (Sidebar / Panels):** `#f1f5f9`
- **Surface Elevation 2 (Cards / Bubbles / Inputs):** `#ffffff` with 80% alpha translucency
- **Surface Elevation 3 (Active / Hover Overlays):** `#e2e8f0`
- **Border Ghost Subdued:** `rgba(15, 23, 42, 0.08)`
- **Border Highlight / Focus:** `rgba(6, 182, 212, 0.6)`
- **Text Primary:** `#0f172a`
- **Text Secondary:** `#475569`
- **Text Muted:** `#94a3b8`

### Accent Glow Mechanics
- **Active State:** Linear gradient interpolation between cyan `#06b6d4` and indigo `#6366f1` at 135 degrees.
- **Thinking / Streaming State:** Glowing cyan pulse (`0 0 16px rgba(6, 182, 212, 0.25)`).

## Typography

Typography relies on `Inter` (with native system fallbacks) for dense, rhythmic scannability across multi-paragraph AI outputs, alongside `JetBrains Mono` for code blocks, token counters, and prompt tags.

### Hierarchy & Usage
- **Display & Headings:** Reserved for greeting prompts, dashboard titles, and model selector panels. Tighter letter spacing (`-0.02em`) is applied to font sizes 20px and above.
- **Body Rhythm:** `body-lg` is the primary conversational stream size, set with generous line heights (`26px`) to reduce ocular fatigue during deep-reading sessions.
- **Code & Monospace:** Embedded code blocks use `code-md` within elevated syntax-highlighted containers featuring an inset copy action bar.

## Layout & Spacing

The application architecture utilizes a persistent multi-pane fixed and fluid model:

### Breakpoints & Adaptive Viewports
- **Mobile (< 768px):** Off-canvas drawer sidebar, full-bleed message feed, sticky floating bottom composer anchored with `12px` viewport margins.
- **Tablet (768px - 1024px):** Collapsible sidebar (`64px` icon rail or `260px` tray), centered chat thread with a strict max-width of `720px`.
- **Desktop (> 1024px):** Persistent sidebar (`260px`), primary conversation canvas with a constrained content spine (max-width `768px` for conversational reading, fluid up to `1140px` when artifacts/code canvasses open side-by-side).

### Vertical Rhythm
- Conversational turn spacing: `space-xl` (32px) between user prompt and assistant response blocks.
- Intra-message block spacing (paragraphs, lists, code cards): `space-md` (12px).

## Elevation & Depth

This design system avoids traditional heavy, muddy drop shadows. Depth is established through structural luminance, subtle frosted glass treatments, and micro-borders:

### Elevation Levels
- **Level 0 (Canvas Base):** Flat substrate.
- **Level 1 (Panels & Navigation):** `background: rgba(15, 23, 42, 0.75)`, `backdrop-filter: blur(16px)`, right border `1px solid rgba(148, 163, 184, 0.08)`.
- **Level 2 (Chat Bubbles, Floating Toolbars, Input Composer):** `background: rgba(30, 41, 59, 0.65)`, `backdrop-filter: blur(12px)`, border `1px solid rgba(148, 163, 184, 0.12)`, shadow `0 4px 20px -2px rgba(0, 0, 0, 0.25)`.
- **Level 3 (Modals, Command Palettes, Dropdown Menus):** `background: rgba(15, 23, 42, 0.92)`, `backdrop-filter: blur(20px)`, border `1px solid rgba(148, 163, 184, 0.2)`, shadow `0 12px 32px -4px rgba(0, 0, 0, 0.5)`.

### Accent Elevation (Glow Fields)
Floating action elements and the message composer utilize an ambient pseudo-layer glow:
- On focus, input borders receive `box-shadow: 0 0 0 1px rgba(6, 182, 212, 0.35), 0 0 24px -4px rgba(6, 182, 212, 0.15)`.

## Shapes

The interface embraces a unified modern corner language, balancing approachable softness with geometric alignment:

- **Base Radius (0.5rem / 8px):** Code blocks, contextual menus, tooltips, list items.
- **Medium / Large Radius (0.75rem to 1rem / 12px to 16px):** Conversational bubbles, card surfaces, modal envelopes.
- **Pill Geometry (9999px):** Action chips, prompt suggestion pills, status badges, voice trigger buttons, and user avatars.
- **Input Composer:** Engineered with a `24px` compound radius (`rounded-2xl`) to provide a friendly, distinct capsule shape that dynamically relaxes its bottom corners if expanded into multi-line prompt editing.

## Components

### 1. Buttons
- **Primary:** Solid cyan-to-indigo gradient fill or high-contrast solid neutral (`#f8fafc` text on `#0f172a` in light mode, `#090d16` text on `#f8fafc` in dark mode). Hover triggers a subtle brightness increase (`filter: brightness(1.1)`).
- **Secondary / Ghost:** Transparent background with `1px solid rgba(148, 163, 184, 0.12)`. Hover transitions to `rgba(148, 163, 184, 0.08)` background and crisp white foreground.
- **Icon Buttons:** Fixed square proportions (32x32px or 36x36px) with centered SVG icons, `border-radius: 8px`, hover background `rgba(148, 163, 184, 0.1)`.

### 2. Conversational Message Turns
- **User Turn:** Right-aligned or compact pill-card aligned to the right-center. Surface uses a slightly higher tonal value (`rgba(51, 65, 85, 0.5)`) with a refined border.
- **Assistant Turn:** Left-aligned, full-width stream within the content max-width. Borderless transparent canvas with flush typography. Action shelf (Copy, Regeneate, Good/Bad response) appears subtly on hover below the response with 60% opacity.
- **Streaming Indicator:** A small glowing cyan caret (`#06b6d4`) pulsing smoothly at the tail of active text generation.

### 3. Modular Input Composer
- Anchored at the bottom center with a subtle gradient backdrop mask that fades chat history behind it.
- **Structure:** Multi-line expanding textarea wrapped in an elevated glass container (`rgba(30, 41, 59, 0.75)` dark mode) with `1px` translucent border.
- **Controls Tray:** Attachment (+) icon and model selection trigger on the left; voice input and active send arrow icon on the right. The send button transitions from inactive slate to a vivid glowing cyan pill once input text is detected.

### 4. Sidebar Navigation
- **Header:** Workspace / Model switch dropdown and "New Chat" icon button with keyboard shortcut badge (`Cmd+K`).
- **History List:** Chronologically grouped (Today, Yesterday, Previous 7 Days). Items feature single-line ellipsis truncation, subtle slide-over actions (Rename, Pin, Delete) triggered on hover, and active state denoted by a vertical 2px cyan highlight bar on the left edge.
- **Footer:** User account tile, theme switcher (Dark / Light / System), and settings trigger.

### 5. Prompt Suggestion Chips
- Elliptical pills styled with low-opacity glass borders (`1px solid rgba(148, 163, 184, 0.1)`), featuring a small leading icon in muted indigo/cyan.
- On hover, translates `-1px` vertically with a faint cyan glow halo.

### 6. Code & Artifact Cards
- Header bar containing the syntax language tag (`label-sm`), execution state, and a one-click "Copy Code" button.
- Background fixed at `#05080f` regardless of active theme to preserve code readability.