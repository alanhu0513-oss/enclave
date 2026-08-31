# Anti-AI Design Overhaul — Implementation Plan

## Problem
The platform still has the hallmarks of an AI-generated website, even after the previous design pass. Research from 4 design articles confirms these are the top tells:
1. **Inter font** — the single most identifiable AI tell
2. **3-column card grids** repeated across Features, Testimonials, How It Works
3. **Same scroll animation on every section** — `whileInView` fade-in-up everywhere
4. **Smooth, grain-free surfaces** — noise texture at 0.03 opacity is invisible
5. **Uniform section structure** — header → cards → border → repeat

## Changes

### 1. Typography: Replace Inter with Geist
**Why**: Inter is the default AI-generated font. Geist is Vercel's custom font — distinctive, modern, not overused.

**Files**:
- `index.html` — swap Google Fonts link from Inter → Geist (use `@fontsource/geist-sans` or Google Fonts alternative)
- `src/index.css` — update `--font-sans` to `"Geist", ...` and `--font-display` to `"Geist Mono"` or keep Space Grotesk for display

**Note**: Geist isn't on Google Fonts. Alternatives: **DM Sans** (Google Fonts, distinctive, slightly rounded) or **Plus Jakarta Sans** (Google Fonts, geometric, modern). We'll use **DM Sans** for body + display.

**Implementation**:
```html
<!-- Replace Inter with DM Sans -->
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
```

```css
--font-sans: "DM Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
--font-display: "DM Sans", "Space Grotesk", ui-sans-serif, system-ui, sans-serif;
```

Also tighten heading letter-spacing:
```css
h1 { @apply text-3xl font-bold; letter-spacing: -0.03em; }
h2 { @apply text-2xl font-semibold; letter-spacing: -0.025em; }
```

### 2. Grain/Texture: Make noise visible
**Why**: AI-generated sites have perfect, smooth surfaces. Real sites have subtle texture.

**File**: `src/index.css`

**Implementation**:
- Increase noise opacity from `0.03` → `0.06` on `.vault-bg::after`
- Add a CSS grain overlay class for cards: `.grain::before` with noise texture at 0.04 opacity
- Apply `.grain` to the hero mock UI card and feature cards

### 3. Break the Grid: Asymmetric Features layout
**Why**: AI sites always use 3-column card grids. Real sites mix layouts.

**File**: `src/features/landing/landing-page.tsx`

**Implementation for Features section**:
- First feature (Deepfake Detection) spans full width with a horizontal layout (icon left, text right, wider)
- Next two features in a 2-column grid
- Last three features in a 3-column grid (but with different heights/padding)
- This creates visual hierarchy and breaks the repetitive pattern

### 4. Break the Grid: Asymmetric Testimonials
**Why**: 3 equal testimonial cards is the most AI pattern possible.

**File**: `src/features/landing/landing-page.tsx`

**Implementation**:
- First testimonial is larger (spans 2 columns, more padding, larger quote)
- Second and third testimonials stack in the remaining column
- Or: first testimonial on the left (tall), two smaller ones stacked on the right

### 5. Reduce Animations
**Why**: When every section fades in from the bottom, it screams "AI template."

**File**: `src/features/landing/landing-page.tsx`

**Implementation**:
- **Hero**: Keep animations (first impression)
- **Features**: Remove `whileInView` — just render static with CSS transitions on hover
- **How It Works**: Remove animation — static with subtle hover
- **Pricing**: Remove animation — static
- **Testimonials**: Remove animation — static
- Only the hero and mobile menu should animate. Everything else should feel solid and immediate.

### 6. Vary Section Structure
**Why**: Every section follows: left-aligned header → grid of cards → border-top. Repetitive.

**File**: `src/features/landing/landing-page.tsx`

**Implementation**:
- **How It Works**: Change from 3-column grid to a vertical timeline (steps stacked, connected by a line)
- **CTA section**: Make it asymmetric — text left, button right, instead of centered
- **Stats row**: Already inline (good), but add a subtle border-left accent on each stat

### 7. Tighter Heading Spacing
**Why**: AI sites use default letter-spacing. Real editorial design uses tight tracking.

**File**: `src/index.css`

**Implementation**:
```css
h1 { letter-spacing: -0.03em; }
h2 { letter-spacing: -0.025em; }
h3 { letter-spacing: -0.02em; }
```

Also add to font-display usages in the landing page.

## File Change Summary

| File | Changes |
|------|---------|
| `index.html` | Swap Inter → DM Sans in Google Fonts link |
| `src/index.css` | Update font vars, tighten heading tracking, increase noise opacity, add grain class |
| `src/features/landing/landing-page.tsx` | Break feature grid, asymmetric testimonials, remove scroll animations, vary section structures |

## Verification
1. `npm run build` — no errors
2. `npm test` — 99 tests pass
3. Lighthouse Mobile: Perf ≥80, A11y 100, BP 100, SEO 100
4. Visual inspection: platform should feel less template-like
5. `npx vercel --prod --yes` from `frontend-react/`
6. `railway up --yes` from repo root
