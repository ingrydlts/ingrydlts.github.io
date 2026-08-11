# Ingryd, tô Por Dentro — Design System

> *Existe para mostrar a vida real fora do Brasil — sem glamour, sem tragédia, mas com verdade.*

A design system for **Ingryd, tô Por Dentro** — a Brazilian-creator-living-abroad brand built around honest reflections on émigré life. Combines realism, sincere social commentary, and warm humour to keep the audience *por dentro* of everything that comes with living abroad: the struggles, the wins, and what shifts inside us along the way.

This system is built primarily to dress **social content** (Instagram carousels, Reels covers, Stories templates) and adjacent surfaces (newsletter, future website). It is editorial, warm, and unmistakably analog — the visual mood of a manila folder stuffed with notes from someone who's been paying attention.

---

## Index

| File | What it is |
|---|---|
| `README.md` | This file. Brand context + content + visual foundations + iconography. |
| `colors_and_type.css` | All color & type tokens — paste into any project to inherit the brand. |
| `SKILL.md` | Agent Skill manifest for use in Claude Code. |
| `assets/` | Logos, reference imagery, paper textures. |
| `fonts/` | Webfont references (currently CDN-only — see flagged substitutions). |
| `preview/` | The cards that populate the Design System tab. |
| `ui_kits/social/` | Instagram carousel UI kit (the brand's primary surface). |

---

## Brand context

**Ingryd, tô Por Dentro** is a creator-led publication on Instagram (`@ingryd.pordentro`), centered on Ingryd, a Brazilian living abroad. The voice is a smart, warm conversation between friends — never lecturing, never venting, never doing tourism PR. She shares what she's learned without pretending to know everything; teaches without the professorial posture; moves people without dramatising.

### The Voice (the litmus test)
> *"Isso soa como eu diria para uma amiga inteligente que acabou de chegar em Paris?"*
>
> If the answer is no, rewrite.

### Sources we were given for this system
- `uploads/logo.PNG` — the cowrie shell wordmark/symbol.
- `uploads/1.png` — a finished Instagram carousel cover, *"(IN)DIGEST DE MAIO"*. Single most important visual reference.
- `uploads/Capture d'écran 2026-05-09 à 11.44.09.png` and `…11.44.16.png` — supplementary screenshots; **inaccessible to the agent due to a curly-apostrophe in the filename that the platform rejects.** If you can re-upload them with simple ASCII filenames (e.g. `ref-1.png`), I'll fold their cues in next pass.
- Brand voice note (section "09 · Tom de Voz & Copywriting") from the brand book.

No Figma, no codebase — this is content design, not product design. Components are Instagram-native (1080×1350 carousels, 1080×1920 stories) plus newsletter blocks.

---

## Content fundamentals

### Tone
**A conversation between smart friends.** Direct, warm, lucid, anchored in real experience. Teaches without preaching. Moves without drama. The voice is a single human — Ingryd — not a brand committee, so it can be vulnerable, wry, and specific.

- **Language:** Primarily **Portuguese (BR)**. Foreign-language fragments (FR, EN, IT) appear inline and untranslated when they're part of the lived texture — *"o repas à 1 euro"*, *"chômage"*, *"carte de résident"* — the audience is fluent in being abroad.
- **Person:** First-person singular ("eu", "comigo") and second-person familiar ("você", "amiga"). Never the impersonal "a gente" stretched into a corporate "we". Never *vossa mercê*-formal.
- **Casing:**
  - Display titles set in **ALL CAPS** with playful parentheticals — *"(IN)DIGEST DE MAIO"*, *"(NÃO) GUIA DE PARIS"*. The parenthetical is the joke and the thesis.
  - Tracked caps for taglines / chapter labels — *"POR DENTRO DE NOTÍCIAS BOAS E OUTRAS NEM TANTO"*.
  - Sentence case in body copy.
- **Punctuation:** em-dashes — yes, lots. Ellipses sparingly. Exclamation marks rare; when present they're earned.
- **Emoji:** **Effectively no emoji** in finished post graphics. The visual vocabulary does that job (paperclips, folders, arrows, photo collage). Captions may use 1 emoji max to anchor a feeling, never a row of them.
- **Numerals:** Tabular, often parenthesised as section markers — `(01)` `(02)` `(03)`.
- **Hashtags:** Restraint. 3–6 in caption footers, lowercase, no emoji walls.

### Examples in the right voice
- ✅ "*A primeira vez que falei francês no boulanger ele me corrigiu duas palavras. A segunda, três. Hoje ele me chama pelo nome. Vai por mim — você fica.*"
- ✅ "*(In)digest de maio. Por dentro de notícias boas e outras nem tanto.*"
- ❌ "*5 dicas INFALÍVEIS para arrasar em Paris! 🇫🇷✨*" — too clickbaity, too tourist-board.
- ❌ "*Como dizem por aqui, 'la vie est belle' 💫*" — too greeting-card.

### Headlines and the parenthetical move
The single most recognisable copywriting tic is the **(parenthetical inversion)** — wrapping the qualifier that flips the reading. *(In)digest. (Não) guia. (Im)possível.* It signals: *I'm not selling you the polished version.* When in doubt, write the earnest title first, then ask "what's the honest qualifier I'd whisper to a friend?" — and parenthesise it.

---

## Visual foundations

The whole system reads like an **editorial scrapbook on a kitchen table** — warm cream paper, oxblood ink, photographic backgrounds with grain, and physical-object furniture (folders, paperclips, sticky notes, postcards) layered over them.

### Colors
A warm, low-saturation palette anchored on cream paper and oxblood ink. **No pure black, no pure white, no cool blues, no bluish-purple gradients.** Ever.

| Role | Token | Hex |
|---|---|---|
| Primary background (paper) | `--paper` | `#F4E7CE` |
| Off-white / card | `--paper-soft` | `#FBF6EB` |
| Primary ink | `--ink` | `#1C1614` |
| Display / accent (oxblood) | `--burgundy` | `#5C1F23` |
| Cowrie shell | `--shell` | `#DAC9AB` |
| Manila folder | `--manila` | `#E5C68F` |
| Kraft / brown paper | `--kraft` | `#A47E4A` |
| Signal red (rare hot stop) | `--signal-red` | `#C8242A` |

Full token list and semantic mappings live in `colors_and_type.css`.

### Typography
- **Display:** **Fraunces** (variable serif) at heavy weights (700–900) with the `SOFT` and `opsz` axes pushed for the chunky, friendly editorial feel.
- **Body / UI:** **DM Sans** for tracked caps eyebrows, captions, and copy.
- **Mono:** **JetBrains Mono** for the rare metadata moment.
- Tracked caps (`letter-spacing: 0.08em–0.16em`) is a brand fingerprint; use on eyebrows and chapter labels.

> ⚠️ **Font substitutions flagged.** Fraunces stands in for what looks like a paid display face (likely Migra / Recoleta family). DM Sans stands in for the working-grotesque caps. **If you have the real licensed files, drop them in `fonts/` and update `colors_and_type.css` — I'll match the registrations.**

### Backgrounds
- **Photographic, full-bleed, warm-toned.** Newsstands, kitchen tables, métro tiles, postcards, café marble. Always slightly warm-shifted in grade.
- **Grain is a feature.** A subtle film-grain overlay (~5% opacity) sits on every photographic surface — never crisp digital photos.
- **Paper textures** (manila, kraft, lined notebook) are common as mid-layer surfaces.
- Solid cream (`--paper`) is the fallback when no photo is right.
- **No gradients** in the corporate sense. The only "gradient" is photographic atmosphere.

### Imagery treatment
- Warm, slightly desaturated grade. Lifted blacks, creamy highlights.
- Real photos > illustrations. When illustrations appear, they are flat, single-color (oxblood), and woodcut-stamp-like, not vectorial gloss.
- Photos are often **clipped, taped, paperclipped** — i.e. presented as physical objects on a desk. They sit at a small rotation (±2–4°) and cast a soft drop-shadow.
- Cropped screenshots of news sites/articles are a recurring motif — they're *evidence*, not decoration.

### Layout
- **Grid is editorial, not engineering.** Generous margins (8–10% of frame), clear hierarchy, but slight intentional asymmetry — a tab pokes below the page line, a paperclip clips off the top.
- **Anchored bottom tagline + arrow CTA** is the brand's compositional signature on carousels.
- Section markers `(01)` `(02)` `(03)` are positioned bottom-left of each layered card, tabular numerals.
- Fixed elements: the `@ingryd.pordentro` handle + cowrie symbol consistently appear top-center on cover slides.

### Animation & motion
- **Restrained.** This is a print-feeling brand; it should mostly stay still.
- When motion is used: **slow fades (300–600ms)**, gentle paper-flip translateY (8–16px), no bounces, no springs, no parallax-tricks.
- Easing: `cubic-bezier(0.22, 0.61, 0.36, 1)` (ease-out, calm).
- Hover states (web): subtle — text accent shifts to `--burgundy-deep`, paper-card lifts 2px with shadow deepening.
- Press states: 1px translateY downward, shadow flattens. No color flash, no scale-down past 0.98.

### Borders, shadows, corners
- **Corner radii are small.** `4px` for inputs/cards, `8px` for larger surfaces, `0px` for editorial blocks. Never pill-shape unless it's an actual chip/badge.
- Photos and clippings have **no border**, but cast `--shadow-paper` (a soft warm-shadow that reads as desktop drop).
- Editorial dividers: `1px solid var(--burgundy)` or a literal hairline rule between sections.
- **No glassmorphism, no inner-glow, no neon.**

### Transparency & blur
- Used sparingly. The only legitimate use is a **dark-warm overlay** over a busy photo so cream type sits readable on top — `linear-gradient(rgba(28,22,20,0.4), rgba(28,22,20,0.4))` over the image, never a blur.
- `backdrop-filter: blur(...)` is **avoided**. It reads as 2020 SaaS, not editorial.

### Cards
- Warm `--paper-soft` fill, `1px solid --rule` hairline, `--r-md` corner radius, `--shadow-card`.
- For "evidence" cards (a screenshot of an article tucked into a folder), no border but `--shadow-paper` and a small rotation `transform: rotate(-2deg)`.

### Layout rules
- Carousels: **1080 × 1350** (4:5) primary; **1080 × 1080** for square; **1080 × 1920** for stories.
- Side margins on carousels: ~8–10% of frame width.
- Bottom safe-zone of ~140px reserved on stories for IG UI overlays.

---

## Iconography

**The brand has no icon set in the conventional sense.** Visual elements are mostly **photographic objects** (paperclips, folders, postcards, stamps) rather than abstract pictograms. When pictograms are needed:

- **Style:** thin (1.5–2px stroke), rounded line caps, square corners on geometric forms, no fill. Reads like a hand-drawn editorial diagram, not a SaaS icon.
- **Color:** `--ink` or `--burgundy`, never the manila/tan tones (those are surfaces, not strokes).
- **Common signs:**
  - **Arrow → in a hairline circle** — the carousel "next slide" indicator. Used on every cover slide bottom-right.
  - Underline-arrow ↳ — for footnote-style asides.
  - Asterisks `*` — handmade-feeling anchors for clarifications.
- **Substitution:** the system uses **Lucide** (`lucide.dev`, hairline, 24px, free) loaded from CDN whenever a UI surface needs more pictograms than the editorial set covers. Stroke 1.5, color `--ink`. **This is flagged as a substitution** — replace with custom iconography if/when commissioned.
- **Emoji:** **not part of the system.** Effectively never appear in graphic compositions; allowed in captions sparingly (1 max).
- **Unicode characters as icons:** yes — `→` `↳` `※` `*` `(01)` `—` are all part of the typographic toolkit and preferred over pictograms when the meaning fits.
- **The cowrie shell (`assets/logo-cowrie.png`)** is the brand symbol, not an icon. It anchors covers, never gets recolored, and never gets used inline as a bullet.

---

## A note on what's missing

This is **iteration 1** of the system. Open questions / next iterations:

1. **Reattach the two missing screenshots** with ASCII filenames — they likely contain feed-context cues I haven't accounted for.
2. **Real font files.** Fraunces and DM Sans are best-effort substitutes; if you have a Migra / Recoleta / custom face license, drop the `.woff2` files in `fonts/` and I'll wire them up.
3. **A real photo asset library.** The UI kit currently uses placeholder photographic surfaces. If you can share 6–10 hero photographs (newsstand, café, métro, kitchen table, postcards), I'll bake them in as named assets so future posts inherit the right grade.
4. **Newsletter and web surfaces** beyond Instagram aren't represented yet — say the word and I'll spin up a `ui_kits/web` and `ui_kits/newsletter` to match.

---

*— v1, May 2026.*
