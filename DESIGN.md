# DESIGN.md - RayView Blog Design System

> **Living document** — Record all design decisions, tokens, and specifications here.
> Update as the design evolves. This prevents context loss across sessions.

---

## 🎨 Design Principles

1. **极度扁平** — No shadows, no gradients, no borders unless functionally necessary
2. **极致对齐** — 8px grid system. Everything aligns to the grid.
3. **留白为王** — Generous whitespace. Let content breathe.
4. **静默交互** — Hover states are subtle. Motion is minimal and purposeful.
5. **色彩克制** — Monochrome base. Color is used only for functional purposes (theme contrast).

---

## 📐 Grid & Spacing

### Base Unit
```
base-unit: 8px
```

### Spacing Scale
```
space-1:  4px   (tight gaps)
space-2:  8px   (element internal)
space-3:  16px  (component padding)
space-4:  24px  (mobile padding)
space-5:  32px  (section gaps)
space-6:  48px  (major sections)
space-7:  64px  (large gaps)
space-8:  96px  (hero spacing)
```

### Content Width
```
max-width: 680px
reading-width: 640px
```

### Breakpoints
```
mobile:  < 640px   → padding: 24px
desktop: >= 640px  → padding: 48px
```
**Note**: No other breakpoints. Layout is fluid between these.

---

## 🎨 Color Tokens

### Light Mode

```css
:root {
  /* Background */
  --color-bg: #F0F0F0;
  --color-surface: #FFFFFF;

  /* Text */
  --color-text-primary: #000000;
  --color-text-secondary: #6B6B6B;

  /* Accent */
  --color-accent: #000000;

  /* Utility */
  --color-border: #E0E0E0;

  /* Transitions */
  --transition-fast: 150ms ease-out;
  --transition-base: 200ms ease-out;
  --transition-slow: 300ms ease-out;
}
```

### Dark Mode (AMOLED)

```css
[data-theme="dark"] {
  /* Background */
  --color-bg: #000000;
  --color-surface: #0A0A0A;

  /* Text */
  --color-text-primary: #FFFFFF;
  --color-text-secondary: #888888;

  /* Accent */
  --color-accent: #FFFFFF;

  /* Utility */
  --color-border: #1A1A1A;
}
```

### Theme Toggle Behavior

| State | Icon | Action |
|-------|------|--------|
| Light | Sun (☀) | Click → Dark |
| Dark | Moon (☾) | Click → System |
| System | Monitor (⬜) | Click → Light |

Icon shows current target state, not current active state.

---

## 🔤 Typography

### Font Stack
```css
font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
/* Code: */
font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
```

### Type Scale

| Token | Size | Weight | Line-height | Usage |
|-------|------|--------|-------------|-------|
| text-xs | 12px | 400 | 1.5 | Meta, dates, tags |
| text-sm | 14px | 400 | 1.5 | Secondary body |
| text-base | 16px | 400 | 1.65 | Primary body |
| text-lg | 18px | 400 | 1.65 | Large body, post content |
| text-xl | 24px | 600 | 1.3 | h3 |
| text-2xl | 32px | 600 | 1.2 | h2 |
| text-3xl | 48px | 600 | 1.1 | h1 (hero, e.g. videos 敬请期待) |

> **Article page title** — `--post-title-size: 40px` (page-scoped token in `src/pages/posts/[...slug].astro`), applied to the article H1 via `.post-title`. Slightly smaller than `--text-3xl` (48px) so the reading page feels calmer; the global token stays 48px for hero contexts.

### Letter Spacing
```css
--tracking-tight: -0.02em;  /* Headlines */
--tracking-normal: 0;        /* Body */
```

### Chinese Typography
For Chinese text, increase line-height to 1.8 for readability:
```css
:lang(zh) {
  line-height: 1.8;
}
```
Article body (reading experience) uses a slightly looser rhythm — 1.9 — scoped to the article so header/cards/code blocks are unaffected:
```css
article.heti p:lang(zh),
article.heti li:lang(zh) {
  line-height: 1.9;
}
```

---

## 🧩 Components

### Header
```css
height: 48px;
position: sticky;
top: 0;
z-index: 100;
background: color-mix(in srgb, var(--color-bg) 80%, transparent);
backdrop-filter: blur(12px);
/* Content */
display: flex;
align-items: center;
justify-content: space-between;
padding: 0 24px; /* mobile */
padding: 0 48px; /* desktop */
```
**States:**
- Default: transparent blur
- Scrolled: same (no change needed — already blurred)

### Logo/Brand
```css
font-size: 14px;
font-weight: 600;
letter-spacing: -0.02em;
color: var(--color-text-primary);
text-decoration: none;
```
**States:**
- Hover: opacity 0.7

### Theme Toggle Button
```css
width: 32px;
height: 32px;
display: flex;
align-items: center;
justify-content: center;
border: none;
background: none;
cursor: pointer;
color: var(--color-text-primary);
```
**States:**
- Hover: opacity 0.7
- Active: rotate icon 360° over 300ms

### Search Input
```css
width: 180px;
height: 32px;
padding: 8px 12px;
border: 1px solid var(--color-border);
border-radius: 0;
background: var(--color-surface);
color: var(--color-text-primary);
font-size: 14px;
```
**States:**
- Default: border-color = --color-border
- Focus: border-color = --color-accent, outline: none
- Placeholder: color = --color-text-secondary

### Navigation Links
```css
font-size: 14px;
color: var(--color-text-secondary);
text-decoration: none;
```
**States:**
- Hover: color = --color-text-primary, text-decoration: underline

### Post Card (Archive)
```css
/* Container */
margin-bottom: 16px;

/* Title */
font-size: 16px;
font-weight: 400;
color: var(--color-text-primary);
text-decoration: underline;
text-decoration-color: transparent;
text-underline-offset: 3px;
transition: text-decoration-color var(--transition-fast);

/* Meta (date) */
font-size: 12px;
color: var(--color-text-secondary);
margin-top: 4px;

/* Tags */
font-size: 12px;
color: var(--color-text-secondary);
margin-top: 4px;
span:not(:last-child)::after { content: ", "; }
```

**States:**
- Title hover: text-decoration-color = currentColor
- Tag hover: color = --color-text-primary, underline

### Month Group Header (Archive)
```css
font-size: 12px;
color: var(--color-text-secondary);
text-transform: uppercase;
letter-spacing: 0.05em;
margin-top: 48px;
margin-bottom: 16px;
```

### Tag Pill
```css
font-size: 12px;
color: var(--color-text-secondary);
text-decoration: none;
```
**States:**
- Hover: color = --color-text-primary, underline

### Footer
```css
height: 48px;
display: flex;
align-items: center;
justify-content: center;
font-size: 12px;
color: var(--color-text-secondary);
```

### Banner Image
```css
width: 100%;
max-height: 400px;
object-fit: cover;
display: block;
margin-bottom: 32px;
```
**Dark Mode:**
```css
[data-theme="dark"] img {
  filter: grayscale(100%) brightness(0.8);
}
```

### Code Blocks
```css
font-family: ui-monospace, "SF Mono", Menlo, monospace;
font-size: 14px;
line-height: 1.6;
background: var(--color-surface);
padding: 16px;
overflow-x: auto;
```

---

## ✨ Motion Specifications

### Page Transitions (View Transitions API)
```css
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 200ms;
  animation-timing-function: ease-out;
}

::view-transition-old(root) {
  animation-name: fade-out;
}

::view-transition-new(root) {
  animation-name: fade-in;
}

@keyframes fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

### Micro-interactions

| Element | Property | Duration | Easing |
|---------|-----------|----------|--------|
| Link underline | opacity | 150ms | ease-out |
| Theme toggle | transform (rotate) | 300ms | ease-out |
| Search focus | border-color | 150ms | ease-out |

---

## 📱 Responsive Behavior

### Layout Strategy
Single column, always. No grid changes.

### Horizontal Padding
```css
/* Mobile (< 640px) */
padding-left: 24px;
padding-right: 24px;

/* Desktop (>= 640px) */
padding-left: 48px;
padding-right: 48px;
```

### Content Max-width
```css
max-width: 680px;
margin-left: auto;
margin-right: auto;
```

### Search Bar Responsive
- Mobile: Search icon only, expands to input on tap
- Desktop: Always visible input

---

## 🖼️ Image Treatment

### Banner Images
- Aspect ratio: 16:9 (recommended)
- Max file size: 200KB
- Formats: WebP preferred, JPEG fallback
- Dark mode: `filter: grayscale(100%) brightness(0.8)`

### No Images in Post Body
- If user includes images, they render normally
- No special treatment (already minimal)

---

## 📝 Design Decisions Log

### 2024-01-XX: Initial Design
- **Decision**: Use CSS custom properties for theming
- **Rationale**: No JS required for theme switching. System preference detection via `prefers-color-scheme`.
- **Status**: Approved

### 2024-01-XX: No Comments
- **Decision**: Explicitly exclude comment functionality
- **Rationale**: User requested no comments. Simplicity.
- **Status**: Approved

### 2024-01-XX: Static Search Index
- **Decision**: Generate `/search.json` at build time
- **Rationale**: GitHub Pages can't run server-side search. Client-side fuzzy search via Fuse.js.
- **Status**: Approved

---

## 🔗 Reference Links

- [rsms.me](https://rsms.me) — Design inspiration
- [inter.var.com](https://inter.var.com) — Typography reference
- [Astro View Transitions](https://docs.astro.build/en/guides/view-transitions/) — Implementation guide
- [TinaCMS](https://tinacms.org) — Future CMS integration (out of scope for V1)

---

## 📌 TODO

- [ ] Verify 8px grid alignment on all components
- [ ] Test dark mode on actual AMOLED display
- [ ] Check font rendering across browsers
- [ ] Validate touch targets (44px minimum) on mobile