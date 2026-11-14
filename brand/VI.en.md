# Grove visual identity (VI)

Grove's brand line: **turn conversations into traceable knowledge assets.** The visual tone is restrained, concrete and auditable — closer to a well-filed notebook than to a poster.

## 1. The mark

- **What it is**: two leaves (larger dark green, smaller light green), a stem that tapers upward, and an amber baseline.
- **What it means**: leaves are claims and evidence, the stem is the shared source they grew from, and the amber baseline is the act of saving — Grove only keeps something once you confirm it.
- **Three versions**:
  | File | Use |
  | --- | --- |
  | `brand/mark.svg` | Light backgrounds (Paper, white) |
  | `brand/mark-on-dark.svg` | Dark backgrounds (Ink) |
  | `brand/mark-mono.svg` | Single-ink printing, watermarks |
- **Minimum size**: 24 px for the mark; 36 px in plugin rows; below that use only the 16 px plugin slot and add no detail.
- **Clear space**: at least 1/4 of the mark's height on every side.
- **Don't**: rotate, stretch, or change proportions; recolor outside the palette; add strokes, shadows, glows, or gradients; use one leaf alone; place it on a background of similar lightness.

## 2. Lockups

| File | Context | Min width |
| --- | --- | --- |
| `brand/logo-light.svg` | Light backgrounds | 120 px |
| `brand/logo-dark.svg` | Dark backgrounds or photos | 120 px |
| `brand/logo-zh.svg` | English wordmark first, 知林 second | 140 px |
| `brand/logo-zh-primary.svg` | Chinese-first contexts | 150 px |

The wordmark is the Latin face below at weight 600, letter-spacing -0.5 at 26 px. The gap between mark and wordmark is about 1/4 of the mark's height; don't improvise it.

## 3. Color

| Name | Hex | Contrast on Paper | Use |
| --- | --- | --- | --- |
| Ink | `#1B3A2E` | 11.3:1 | Body text, headings, dark surfaces |
| Ink soft | `#40514A` | 7.7:1 | Secondary body text |
| Ink muted | `#5A6B61` | 5.2:1 | Captions, metadata, mono labels |
| Green | `#2F7D5B` | 4.5:1 | Emphasis, links, primary graphics |
| Leaf | `#5FA37E` | 4.2:1 on Ink | Graphic layers, second leaf on dark |
| Green pale | `#8FC7A9` | 6.5:1 on Ink | Light leaf on dark surfaces |
| Amber | `#C98A3B` | 2.7:1 | **Decorative only**, never carries meaning |
| Amber strong | `#B87A2C` | 3.3:1 | Amber graphics that must be recognized |
| Amber text | `#8F5F1D` | 5.0:1 | Amber used as text |
| Paper | `#F7F4EC` | — | Light surfaces |
| Line | `#C3D3C9` | — | Dividers, borders, chips |

Rules: body copy uses Ink / Ink soft / Ink muted only; Green is not for small body text; Amber is not for text unless it becomes `Amber text`.

## 4. Type

- Latin: `SF Pro Display` (headings) / `SF Pro Text` (body), falling back to `Helvetica Neue, Helvetica, Arial, sans-serif`.
- Chinese: `PingFang SC`, falling back to `Source Han Sans SC, Noto Sans CJK SC, sans-serif`.
- Mono: `SF Mono`, falling back to `SFMono-Regular, Menlo, monospace`; used for asset IDs, versions and labels, letter-spacing 2 px.
- Weights: 600 for headings, 400 for body; emphasize by color, not by weight.
- Scale: 12 / 14 / 16 / 20 / 24 / 32 / 48 / 104 px.

## 5. Layout

- All spacing is a multiple of 4: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64.
- Radii: 6 px controls, 10–12 px cards, 999 px chips.
- Surfaces: light cards are `#FFFFFF` with a `Line` border; dark blocks are Ink; no shadows.
- One focal graphic per composition; whitespace around a text block is larger than its line height.

## 6. Voice

- Short sentences, verb-first, state the boundary; never promise what the product can't do.
- Examples: `You confirm every save` / `every claim points back to its source` / `no database — copy the folder to back up`.
- Avoid "revolutionary", "blazing", "best-in-class"; let verifiable behavior carry the value.

## 7. Assets and regeneration

See [`brand/README.en.md`](README.en.md). Every PNG is rendered by `brand/src/build.sh` through the local Chrome; rerun it after editing an SVG or the layout HTML. `brand/` is not part of the npm package — the plugin row only reads the root `icon.svg`.
