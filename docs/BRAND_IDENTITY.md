# STATOMERA brand identity

**STATOMERA** is the canonical product identity.

The descriptor is **Statistical Data Intelligence**. The identity communicates scientific credibility, statistical expertise, mathematical precision, premium quality, and private, browser-local data analysis.

> [!IMPORTANT]
> **Branding Direction History**: The preliminary Navy, Teal, and Silver palette explored during initial rebranding has been explicitly **rejected** by the founder. The founder-approved visual identity is **Electric Graphite + Champagne Gold**, featuring a minimalist statistical distribution curve with three internal statistical pillars, supported by Silver Grey and Warm White / Soft Ivory.

---

## Logo assets

| Variant | Path | Usage |
|---|---|---|
| **Primary horizontal logo** | `public/assets/statomera-primary.svg` | Horizontal lockup with symbol tile, uppercase STATOMERA wordmark, and descriptor. For documentation, reports, and headers. |
| **Compact symbol mark** | `public/assets/statomera-mark.svg` | Standalone symbol on an Electric Graphite tile (`#151922` with border `#39414E`). Used directly in the application header lockup. |
| **Favicon** | `public/assets/statomera-favicon.svg` | Full-bleed Deep Graphite tile (`#10141C`) with reinforced stroke weights for sharp 16×16 and 32×32 browser tab legibility. |
| **Dark showcase logo** | `public/assets/statomera-logo-dark.svg` | Authoritative stacked logo on Deep Graphite (`#10141C`) with Champagne Gold bell curve, crest highlight, and tapered gold rules. |
| **Light showcase logo** | `public/assets/statomera-logo-light.svg` | Authoritative stacked logo on Soft Ivory (`#F7F5F0`) with Dark Gold details, Deep Graphite text, and slate rules. |

### Symbol Geometry
The symbol contains:
- A smooth, elegant **gold arch** above the wordmark (`#F0C167` in dark, `#D7AF6A` in light).
- Three simple vertical rounded elements inside the arch:
  - **Center element**: One taller gold rounded capsule (`#F0C167` / `#D7AF6A`).
  - **Side elements**: Two shorter silver-gray rounded capsules (`#CCCCCC` in dark, `#8E95A5` in light).
- **Wordmark**: Bold uppercase **STATOMERA** in Soft White / Warm Ivory (`#FFFFFF` on dark, `#161A22` on light).
- **Descriptor**: **Statistical Data Intelligence** in Silver Grey (`#CBD5E1` on dark, `#5A6578` on light), centered beneath the wordmark.
- **Flanking lines**: Thin gold horizontal lines on both sides of the descriptor (`#F0C167` / `#D7AF6A`).
- Flat, clean, SVG-friendly geometry without glow, blur, gradients, metallic effects, shadows, or decorative complexity.

---

## Palette specification

### Dark Theme (Default)
Electric Graphite dominant canvas paired with Champagne Gold accents:

| Token | CSS Variable | Hex | Role | Contrast Ratio |
|---|---|---|---|---|
| Deep Graphite | `--background` | `#10141C` | Page canvas background | Baseline |
| Electric Graphite | `--surface` | `#151922` | Cards, panels, topbar header | — |
| Surface Graphite | `--raised` | `#202733` | Table headers, metrics cards, button hover | — |
| Subtle Border | `--border` | `#39414E` | Structural panel and table borders | — |
| Control Border | `--control-border` | `#4D5869` | Selects, inputs, unpressed buttons | — |
| Champagne Gold | `--brand-accent` | `#D6B36A` | Primary accent, primary button fill, panel top accents | **9.3:1** vs `#10141C` |
| Soft Gold | `--focus` | `#D6B36A` / `#E4C98F` | Active focus indicator, button hover | **10.5:1** vs `#10141C` |
| Silver Grey | `--muted` | `#AEB4BF` | Secondary text, captions, metadata | **8.7:1** vs `#10141C` (AAA) |
| Warm White | `--ink` | `#F3F0E8` | Primary text, headings, body copy | **16.5:1** vs `#10141C` (AAA) |
| Button Ink | `--button-ink` | `#10141C` | High-contrast text on gold buttons | **9.3:1** vs `#D6B36A` (AAA) |
| Warm Gold Tint | `--selection` | `#2E2A1E` | Selected cells, conversation question bubble | — |
| Warm Coral | `--error` | `#FF7F6E` | Accessible error notices and status badges | **6.8:1** vs `#10141C` (AA) |

### Light Theme
Soft Ivory neutral surfaces paired with high-contrast Deep Graphite and Dark Antique Gold:

| Token | CSS Variable | Hex | Role | Contrast Ratio |
|---|---|---|---|---|
| Soft Ivory | `--background` | `#F7F5F0` | Warm page canvas | Baseline |
| Clean White | `--surface` | `#FFFFFF` | Panels, cards, input surfaces | — |
| Raised Ivory | `--raised` | `#EFECE3` | Metric cards, table headers | — |
| Subtle Border | `--border` | `#D5D0C3` | Structural card and table borders | — |
| Control Border | `--control-border` | `#B8B2A2` | Controls, selects, inputs | — |
| Champagne Gold | `--brand-accent` | `#C29B48` | Section borders, decorative indicators | — |
| Deep Graphite | `--ink` | `#10141C` | Primary text, titles, headings | **16.5:1** vs `#F7F5F0` (AAA) |
| Slate Grey | `--muted` | `#565E6D` | Secondary text, captions, table metadata | **5.7:1** vs `#FFFFFF` (AA) |
| Dark Antique Gold | `--focus` / `--accent-text` | `#85631A` | Text links, focus rings, interactive text | **5.6:1** vs `#FFFFFF` (AA) |
| Primary Button | `button.primary` | `#C29B48` / `#10141C` | Gold button with Deep Graphite text | **7.1:1** (AAA) |
| Champagne Cream | `--selection` | `#F5EEDC` | Selected table cells, conversation question | — |
| Deep Crimson | `--error` | `#A32A1C` | Accessible light-mode error notices | **5.9:1** vs `#FFFFFF` (AA) |

---

## Typography and Language

- **System Font Stacks**:
  - Latin (`en`): `Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`
  - Arabic (`ar`): `"IBM Plex Sans Arabic", system-ui, sans-serif`
  - Zero external web font requests, zero Google Fonts telemetry.
- **Wordmark Tracking**:
  - Uppercase `STATOMERA` with letter-spacing `0.085em` in the UI header and `0.18em–0.22em` in standalone logos.
- **Bidirectional Isolation**:
  - The Latin brand name `STATOMERA` is wrapped in `<bdi class="wordmark" lang="en" dir="ltr">{productName}</bdi>` to prevent bidirectional reordering in Arabic RTL layouts.
  - Arabic descriptor is translated as **ذكاء البيانات الإحصائية**.
  - Operational feedback email `uktbli.eg@gmail.com` is isolated in `<bdi dir="ltr">`.

---

## Logo Usage Rules

1. **Clear Space**: Maintain a minimum clear space around the logo equal to 25% of the mark's height.
2. **Contrast & Legibility**:
   - In dark environments, display the symbol on Electric Graphite or Deep Graphite surfaces with Warm White typography.
   - In light environments, display the symbol with Deep Antique Gold accents and Deep Graphite typography.
3. **Restraint**: Champagne Gold is a premium signifier for primary actions, focus outlines, and key analytical highlights. It must not be applied indiscriminately to every surface or chart element.
4. **No Raster Compromises**: Shipped assets are pure scalable vectors (SVG). No raster bitmaps, glow effects, or faux-metallic bevels are used in production.
