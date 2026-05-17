# SPEC.md - RayView Blog

## 1. Concept & Vision

A hyper-minimalist blog for [@睿见RayView](https://github.com/rayview) — synchronized with WeChat Official Account. The design philosophy mirrors rsms.me: almost no UI elements, extreme alignment precision, monochrome palette, and极致扁平化. Content is king; every pixel serves function. The absence of decoration is itself the decoration.

**Personality**: Restrained, confident, professional. No visual noise. Typography and whitespace do all the heavy lifting.

---

## 2. Design Language

### Aesthetic Direction
Reference: rsms.me, inter.var.com, and Apple's product pages in their "flat design" era. Not brutalist — more "refined minimal". Think Dieter Rams' "less but better" applied to web.

### Color Palette

**Light Mode (Default)**
| Role | Hex | Usage |
|------|-----|-------|
| Background | `#F0F0F0` | Page background |
| Surface | `#FFFFFF` | Cards, modals (if any) |
| Text Primary | `#000000` | Headlines, body |
| Text Secondary | `#6B6B6B` | Dates, meta info |
| Accent | `#000000` | Links, interactive (underlined) |
| Border | `#E0E0E0` | Subtle separators (used sparingly) |

**Dark Mode (AMOLED)**
| Role | Hex | Usage |
|------|-----|-------|
| Background | `#000000` | Page background |
| Surface | `#0A0A0A` | Cards (barely visible) |
| Text Primary | `#FFFFFF` | Headlines, body |
| Text Secondary | `#888888` | Dates, meta info |
| Accent | `#FFFFFF` | Links (underlined) |
| Border | `#1A1A1A` | Subtle separators |

### Typography

**Font Stack:**
```css
font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

- **Headlines**: 600 weight, tracking -0.02em (tight)
- **Body**: 400 weight, line-height 1.65
- **Meta/Labels**: 400 weight, 13px, text-secondary color
- **Code**: ui-monospace, "SF Mono", Menlo, monospace

**Scale (8px grid):**
- xs: 12px (meta)
- sm: 14px (secondary text)
- base: 16px (body)
- lg: 18px (large body)
- xl: 24px (h3)
- 2xl: 32px (h2)
- 3xl: 48px (h1)

### Spacing System

Base unit: 8px. All spacing is multiples: 4, 8, 16, 24, 32, 48, 64, 96.

### Motion Philosophy

Only two types of motion:

1. **Page Transitions (View Transitions API)**
   - Duration: 200ms
   - Easing: ease-out
   - Effect: Crossfade between pages
   - No sliding, no scaling — just smooth opacity

2. **Hover Micro-interactions**
   - Link underline: opacity transition 150ms
   - Theme toggle: icon rotation 300ms
   - No bounces, no springs — understated

### Visual Assets
- **Icons**: None. Text labels only. Or minimal Unicode symbols (→, ←).
- **Images**: Banner images are full-bleed, 16:9 aspect ratio, monochrome-tinted in dark mode via CSS filter.
- **Decorative Elements**: None. No gradients, no shadows, no borders unless absolutely necessary.

---

## 3. Layout & Structure

### Page Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  HEADER                                                      │
│  [rayview] ←→ [☀/☾]                                         │
│  48px height, sticky, blur backdrop                         │
├─────────────────────────────────────────────────────────────┤
│  CONTENT (max-width: 680px, centered)                       │
│                                                             │
│  [Page-specific content]                                     │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  FOOTER                                                      │
│  © 2024 RayView                                              │
│  48px height                                                 │
└─────────────────────────────────────────────────────────────┘
```

### Pages

1. **Home (/)** — Post Archive
   - Year/month grouping (YYYY年MM月)
   - Vertical stack, 48px between months
   - Within month: 16px between posts
   - Each post: Title (link) + Date + Tags (inline, comma-separated)
   - Tags are clickable for filtering

2. **Post (/posts/[slug])** — Single Article
   - Optional banner: full-width, 16:9, max-height 400px, object-fit cover
   - Title: 3xl, -0.02em tracking
   - Meta line: date + reading time + tags
   - Body: max-width 640px, centered, lg text size
   - No sidebar, no related posts, no comments

3. **Tag Filter (/tags/[tag])** — Filtered Archive
   - Same layout as Home, pre-filtered
   - Shows current tag name as heading

### Responsive Strategy
- Mobile-first
- Single column always
- Horizontal padding: 24px (mobile), 48px (tablet+)
- Max content width: 680px
- No breakpoint magic — it just works at any width

---

## 4. Features & Interactions

### Core Features

**F1: Post Archive (Home)**
- Display all posts grouped by YYYY年MM月
- Most recent first within each month
- Clicking tag filters to that tag's archive page

**F2: Single Post View**
- Render Markdown to HTML
- Display banner if frontmatter has `banner` field
- Show: title, date, tags, reading time (auto-calculated)
- Code blocks syntax highlighted (minimal theme)

**F3: Tag Filtering**
- `/tags/[tag]` page generated for each unique tag
- Tag pills on post pages link to filtered view
- Active tag highlighted

**F4: Client-side Search**
- Search input in header (always visible on desktop, expandable on mobile)
- Searches: title, tags, date (not full content)
- Fuzzy matching (tolerates typos)
- Results dropdown: up to 5 matches, click to navigate
- Press Escape to close
- Empty state: "No results"
- Search index: `/search.json` built at build time

**F5: Theme Toggle**
- Button in header (sun/moon icon via inline SVG)
- Three states: light, dark, system
- Persists to localStorage
- On load: check localStorage → else check system preference → else default to light
- Transition: 150ms on color properties

### Interaction Details

**Navigation:**
- Logo click → Home
- Post title click → Post page
- Tag click → Tag archive page

**Search:**
- Focus: click input or press `/` (global shortcut)
- Type: live results (debounced 150ms)
- Select: click result or keyboard arrow + Enter
- Close: Escape or click outside

**Theme Toggle:**
- Click cycles: light → dark → system → light
- Icon morphs with rotation

### Edge Cases
- No posts: "No posts yet." centered message
- No search results: "No posts found for 'xxx'."
- Invalid tag URL: redirect to home
- Missing banner: no placeholder, just no banner
- Long titles: normal wrap, no truncation

---

## 5. Component Inventory

### Header
- **Default**: logo left, search center, theme toggle right
- **Mobile**: logo left, icons right (search expands overlay)
- Height: 48px fixed
- Background: semi-transparent (#F0F0F0 @ 80% opacity) with backdrop-blur
- Position: sticky top

### Post Card (in archive)
- Title: base size, accent color, underline on hover
- Meta: xs size, text-secondary
- Tags: xs size, inline, comma-separated, each tag underlined on hover
- Spacing: 48px between groups, 16px between posts in group

### Search Input
- Border: 1px solid border color
- Padding: 8px 12px
- Font: sm size
- Border-radius: 0 (sharp corners)
- Focus: border becomes accent
- Placeholder: "Search..." (text-secondary)

### Tag Pill
- No background, no border
- Text only: xs size, text-secondary
- Hover: text becomes primary, underline

### Theme Toggle Button
- Size: 32px × 32px
- Icon: 18px SVG
- Hover: opacity 80%
- Click: icon rotates 360° over 300ms

### Footer
- Text: xs, text-secondary, centered
- Content: "© 2024 RayView. All rights reserved."

### Banner Image
- Full width within content area
- Max height: 400px
- Object-fit: cover
- Dark mode filter: grayscale(100%) brightness(0.8)
- No border-radius

---

## 6. Technical Approach

### Stack
- **Framework**: Astro 4.x (zero-JS by default, View Transitions built-in)
- **Styling**: Vanilla CSS (CSS custom properties for theming)
- **Content**: Markdown files in `/src/content/posts/`
- **Deployment**: GitHub Pages via GitHub Actions

### Directory Structure
```
raysview/
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── Header.astro
│   │   ├── Footer.astro
│   │   ├── PostCard.astro
│   │   └── Search.astro
│   ├── content/
│   │   └── posts/
│   │       └── [slug].md
│   ├── layouts/
│   │   └── Base.astro
│   ├── pages/
│   │   ├── index.astro
│   │   ├── posts/
│   │   │   └── [slug].astro
│   │   ├── tags/
│   │   │   └── [tag].astro
│   │   └── search.json.ts
│   └── styles/
│       └── global.css
├── astro.config.mjs
├── package.json
└── README.md
```

### Content Schema (Frontmatter)
```yaml
---
title: "Post Title"
date: 2024-01-15
tags: ["tech", "javascript"]
banner: /banner.jpg  # optional
excerpt: "Short description for search"  # auto-generated if omitted
---
```

### Build-time Generation
- All tag pages generated via `getStaticPaths()`
- `search.json` generated via API endpoint at build time

### Deployment Workflow
1. Push to `main` branch
2. GitHub Actions trigger on push
3. `npm install` → `npm run build`
4. Output to `dist/` folder
5. Deploy `dist/` to GitHub Pages

---

## 7. Content Guidelines

- **Language**: Chinese primary, English allowed for technical terms
- **Writing style**: Concise, no fluff, code examples encouraged
- **Images**: Banner images should be < 200KB, 16:9 ratio recommended
- **Publishing**: Push `.md` file to `src/content/posts/` with proper frontmatter

---

## 8. Future Considerations (Out of Scope for V1)

- Comments (explicitly not wanted)
- Newsletter signup
- Analytics
- Related posts
- RSS feed (may add later)
- Sitemap (GitHub Pages has limitations)