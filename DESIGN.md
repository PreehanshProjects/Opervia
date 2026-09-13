---
name: Opervia
description: A digital ledger book for the Mauritian small business — orderly, durable, unshowy.
colors:
  ledger-green: "#173f35"
  ledger-green-hover: "#265747"
  fresh-lime: "#d6edb0"
  paper: "#f7f8f5"
  surface: "#ffffff"
  surface-sunken: "#fafbf7"
  ink: "#233c35"
  ink-muted: "#7b857f"
  border: "#e5e9e2"
  border-field: "#dce2d9"
  tint-green: "#edf2e5"
  focus-ring: "#557d4b"
  focus-ring-field: "#9fbd90"
  status-paid: "#527b49"
  status-paid-bg: "#edf4e5"
  status-partial: "#a18539"
  status-partial-bg: "#faf3dd"
  status-overdue: "#b86e57"
  status-overdue-bg: "#fcf0e9"
  status-unpaid: "#728393"
  status-unpaid-bg: "#eff3f6"
  status-void: "#8c8282"
  status-void-bg: "#eeeaea"
  error: "#a44832"
  error-bg: "#fff0ed"
  success: "#54793f"
  success-bg: "#edf5e6"
  demo-amber: "#948152"
  demo-amber-bg: "#f4eedc"
typography:
  display:
    fontFamily: "Manrope, sans-serif"
    fontSize: "33px"
    fontWeight: 650
    letterSpacing: "-1.2px"
  brand:
    fontFamily: "Manrope, sans-serif"
    fontSize: "29px"
    fontWeight: 800
    letterSpacing: "-1.5px"
  headline:
    fontFamily: "Manrope, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    letterSpacing: "-0.4px"
  title:
    fontFamily: "Manrope, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    letterSpacing: "-0.2px"
  figure:
    fontFamily: "Manrope, sans-serif"
    fontSize: "25px"
    fontWeight: 650
    letterSpacing: "-0.8px"
  body:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "12px"
    fontWeight: 600
  micro:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "11px"
    fontWeight: 400
  eyebrow:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "10px"
    fontWeight: 700
    letterSpacing: "1.5px"
rounded:
  chip: "5px"
  badge: "6px"
  control: "7px"
  field: "8px"
  raised: "9px"
  note: "10px"
  mark: "11px"
  card: "12px"
  modal: "15px"
  round: "50%"
spacing:
  xs: "5px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "22px"
  gutter: "24px"
  page: "37px"
components:
  button-primary:
    backgroundColor: "{colors.ledger-green}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.field}"
    padding: "11px 17px"
    height: "43px"
  button-primary-hover:
    backgroundColor: "{colors.ledger-green-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.field}"
    padding: "11px 17px"
    height: "43px"
  button-secondary-hover:
    backgroundColor: "#f0f4ec"
  button-danger:
    backgroundColor: "#fff4f1"
    textColor: "#a44637"
    typography: "{typography.label}"
    rounded: "{rounded.field}"
    padding: "11px 17px"
    height: "43px"
  icon-button:
    rounded: "{rounded.control}"
    size: "34px"
  icon-button-hover:
    backgroundColor: "#eaf0e5"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "11px 12px"
    height: "44px"
  nav-item:
    textColor: "{colors.ink-muted}"
    typography: "{typography.body}"
    rounded: "{rounded.field}"
    padding: "0 14px"
    height: "45px"
  nav-item-active:
    backgroundColor: "#edf3e5"
    textColor: "#294a36"
  badge-paid:
    backgroundColor: "{colors.status-paid-bg}"
    textColor: "{colors.status-paid}"
    rounded: "{rounded.badge}"
    padding: "5px 9px"
  badge-partial:
    backgroundColor: "{colors.status-partial-bg}"
    textColor: "{colors.status-partial}"
    rounded: "{rounded.badge}"
    padding: "5px 9px"
  badge-overdue:
    backgroundColor: "{colors.status-overdue-bg}"
    textColor: "{colors.status-overdue}"
    rounded: "{rounded.badge}"
    padding: "5px 9px"
  badge-unpaid:
    backgroundColor: "{colors.status-unpaid-bg}"
    textColor: "{colors.status-unpaid}"
    rounded: "{rounded.badge}"
    padding: "5px 9px"
  badge-void:
    backgroundColor: "{colors.status-void-bg}"
    textColor: "{colors.status-void}"
    rounded: "{rounded.badge}"
    padding: "5px 9px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "22px 20px"
  card-featured:
    backgroundColor: "{colors.ledger-green}"
    textColor: "#e4f2ce"
    rounded: "{rounded.card}"
    padding: "22px 20px"
  modal:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.modal}"
  toast:
    backgroundColor: "#1b4334"
    textColor: "#eff6e4"
    rounded: "{rounded.raised}"
---

# Design System: Opervia

## Overview

**Creative North Star: "The Ledger Book"**

Opervia is a well-kept accounts book made digital. Its ancestor is not a SaaS dashboard — it is a bound invoice book with a dark cover, ruled pages, and a column of figures that has to add up. Every visual decision answers to that object: the dark green of the binding, the warm off-white of the page, the single bright ribbon marker, and columns of numbers set in tabular figures so they align down the page the way a hand-ruled column does.

The system is **orderly, durable, and unshowy**. It is almost entirely flat — hairline borders and tonal shifts do the separating work that shadows do elsewhere. Color is rationed hard: two greens carry the identity, five muted status tints carry meaning, and the remaining surface is paper. Type is a two-family pairing where the geometric display face handles names and figures while the humanist body face handles everything a person reads at length. Nothing decorates. Density is high without being cramped, because the user is transcribing real work at speed and the screen must be at least as fast as writing a line by hand.

The center of the product is the **printed A4 invoice sheet** — a literal page rendered on screen, shadowed, and handed to a customer on paper. The application chrome is the desk the sheet sits on. That hierarchy is the system's organizing idea: the app recedes, the document is the deliverable.

**Key Characteristics:**
- Two-green identity (Ledger Green + Fresh Lime) on a warm paper ground, rationed to roughly 10% of any screen
- Flat by construction: 1px `#e5e9e2` borders and tonal tints, not elevation
- Manrope for names and figures, DM Sans for reading; tabular numerals wherever money appears
- A visible paper document at the product's center, with its own type scale and print rules
- Status is always a colored dot **and** a word — never color alone
- 44px minimum interactive height everywhere; phone and desktop are equal surfaces

## Colors

A rationed two-green identity on warm paper, with a muted earth-tone status set that never shouts.

### Primary
- **Ledger Green** (`#173f35`): The binding. Carries the brand mark, the primary button, the featured stat card, the auth story panel, and the toast. It is the only near-black in the system — body text is a softer green-black, so Ledger Green always reads as deliberate emphasis rather than default ink. Hovers to **Ledger Green Light** (`#265747`).
- **Fresh Lime** (`#d6edb0`): The ribbon marker. The single bright note in the entire product, and it appears almost nowhere — the brand mark glyph and the auth story's accents. Its scarcity is the point; it signals "Opervia" and nothing else.

### Secondary
- **Tint Green** (`#edf2e5`): The soft wash behind the active nav item, the active tab, the ledger summary panel, and the collect card. It is how the system says "you are here" and "this block is grouped" without a border or a shadow.

### Neutral
- **Paper** (`#f7f8f5`): The page. The application background, warm rather than blue-grey, so white cards read as fresh sheets laid on an older desk.
- **Surface** (`#ffffff`): Cards, panels, tables, inputs, the modal, and the invoice sheet. Pure white is reserved for things that are *content*.
- **Sunken Surface** (`#fafbf7`): Table headers and the auth form column — a half-step below Surface, used to seat a header row into the card rather than draw a line under it.
- **Ink** (`#233c35`): Body text. A green-black, not a grey-black — it keeps the whole page inside one hue family.
- **Muted Ink** (`#7b857f`): Secondary text, inactive nav labels, captions. The system leans on this heavily; it is the workhorse of the type color scale.
- **Border** (`#e5e9e2`): The hairline that does nearly all the separating. **Field Border** (`#dce2d9`) is a half-step darker for input strokes, which need to read as enterable.

### Tertiary — the status set
Five muted tint-and-ink pairs, each a text color on its own wash. They are deliberately low-saturation: an overdue invoice should be noticeable on a scan, not alarming.
- **Paid** (`#527b49` on `#edf4e5`) · **Partial** (`#a18539` on `#faf3dd`) · **Overdue** (`#b86e57` on `#fcf0e9`) · **Unpaid** (`#728393` on `#eff3f6`) · **Void** (`#8c8282` on `#eeeaea`)

Void is the only grey in the set and the only one outside the warm family — a voided invoice is visibly *retired* without being hidden, which is exactly what an immutable ledger requires.

Feedback colors sit apart from status: **Error** (`#a44832` on `#fff0ed`), **Success** (`#54793f` on `#edf5e6`), and **Demo Amber** (`#948152` on `#f4eedc`) for the demo-mode banner and connection dot.

### Named Rules

**The Rationed Green Rule.** Ledger Green covers no more than ~10% of any screen — one primary button, one featured card, the brand mark. When a second element wants it, the answer is Tint Green or a border, not more green.

**The Ribbon Rule.** Fresh Lime is identity, never state. It may not be used for success, selection, emphasis, or any semantic meaning. If a new element wants lime, it wants Tint Green.

**The Two-Signal Rule.** Status is never color alone. Every badge carries a 4px dot in `currentColor` *and* a word. A color-blind user, a monochrome print, and a glanced-at phone all read the same fact.

## Typography

**Display Font:** Manrope (with `sans-serif` fallback)
**Body Font:** DM Sans (with `sans-serif` fallback)

**Character:** Manrope is geometric, tightly tracked, and heavy at the top of the scale — it handles the things that are *named* (the brand, page titles, panel headings) and the things that are *counted* (stat figures, invoice totals). DM Sans is humanist and comfortable at small sizes — it handles everything a person actually reads: labels, table cells, captions, help text. The division is strict and it is what keeps a dense screen legible.

### Hierarchy
- **Brand** (Manrope 800, 29px, -1.5px): The wordmark only. The tightest tracking in the system.
- **Display** (Manrope 650, 33px, -1.2px): Page titles and the auth headline. One per screen.
- **Figure** (Manrope 650, 25px, -0.8px, tabular): Stat card values and the collect card total. Always `font-variant-numeric: tabular-nums` so figures align in a column.
- **Headline** (Manrope 700, 18px, -0.4px): Panel and modal headings.
- **Title** (Manrope 400, 16px, -0.2px): Card titles, section headings inside forms.
- **Body** (DM Sans 400, 14px, line-height 1.7): The root size. Paragraphs run at 1.7 for comfort in help and security copy.
- **Label** (DM Sans 600, 12px): Form labels, buttons, table links. Semibold at small size is how the system creates emphasis without color.
- **Micro** (DM Sans 400, 11px): Table cells, captions, secondary metadata. This is the working size for dense data.
- **Eyebrow** (DM Sans 700, 10px, +1.5px, uppercase-by-content): Section kickers and the `WORKSPACE` nav label. Wide tracking at small size.
- **Table header** (DM Sans 500, 9px, +0.7px): The smallest type in the system, used only for column headers where the label is a repeated landmark rather than something read.

### Named Rules

**The Two-Family Rule.** Manrope names and counts. DM Sans reads. A number that represents money is Manrope with tabular figures; a number inside a sentence is DM Sans.

**The Tabular Money Rule.** Any element displaying an amount carries `font-variant-numeric: tabular-nums`. Columns of money must align on the decimal down the page, exactly as a ruled ledger column does.

**The Semibold-Not-Color Rule.** Emphasis at small sizes comes from weight (600/650), not from color. Colored text is reserved for status and links.

## Layout

**Shell.** A fixed 246px left sidebar and a fluid main column (`margin-left: 246px`). The sidebar carries the brand, a workspace card, the six-item nav, a note block pinned to the bottom with `margin-top: auto`, and a footer row. The main column is a 78px topbar (breadcrumb left, connection status and avatar right) over a content area padded 37px and capped at 1550px.

**Content grids.**
- Overview: a 4-column stat grid (`repeat(4, minmax(0, 1fr))`, 16px gap) above a two-column `minmax(0, 1fr) 274px` split — main panel and a right stack of the collect card and quick actions.
- Customers: a responsive card grid.
- Settings: a `1fr 250px` split — form and a security note card.
- Invoice form: a 6-column item row (`2fr 0.7fr 0.8fr 1fr 1fr 25px`) over a `1fr 290px` bottom split for notes and the totals summary.

**Rhythm.** Page gutter 37px, card padding 22px/24px, grid gaps 16–22px, form field gaps 8px between label and control. Sections separate by 28–29px.

**Responsive.** Five breakpoints, each doing real work rather than only shrinking type:
- **1500px+** — more air: content padding 45px, table rows 23px, right rail widens to 300px.
- **1200px** — sidebar narrows to 215px, page gutter to 25px, stat cards tighten, heading actions stack vertically, customers drop to 2 columns.
- **1000px** — the overview split collapses to one column and the right stack goes side-by-side; the collect card's icon is dropped rather than shrunk; invoice item rows reflow so section and total span their own rows.
- **760px** — the sidebar becomes an off-canvas drawer (`translateX(-100%)`, 0.2s, with a `#183b3260` scrim) behind a hamburger; the topbar drops to 65px; the invoice table hides columns 2 and 4 rather than compressing them.
- **380px** — single-column everything: form grids, customer grid, and the right stack all collapse; page gutter to 14px.

### Named Rules

**The Drop, Don't Squeeze Rule.** Below 760px, low-value table columns and decorative icons are removed outright (`display: none`) rather than compressed. A cramped cell is worse than an absent one when the user is entering an invoice one-handed.

**The Equal Surfaces Rule.** Phone and desktop are both primary. A layout is not finished when it merely survives at 390px — it has to be as fast there.

## Elevation & Depth

**This system is flat by default, and borders do the work.** Separation comes from a 1px `#e5e9e2` hairline and from tonal steps between Paper, Surface, and Sunken Surface. Cards do not float. Panels do not lift on hover. The overwhelming majority of the interface has no `box-shadow` at all.

Shadows exist only where something genuinely sits *above* the page, and even then they are whisper-light — 6% to 10% opacity in green-black, never neutral grey. The one exception is the modal, which is heavy on purpose: it has to detach the invoice builder from everything behind it.

### Shadow Vocabulary
- **Button lift** (`0 3px 4px #173f3510`): The primary button only. A 6% seat, not a lift.
- **Card hover** (`0 4px 16px #173f3506`): Customer cards on hover, at 2% opacity — paired with a border color shift to `#a8bb93`, which is the signal that actually registers.
- **Paper** (`0 3px 15px #173f3510`): The invoice sheet resting on the print area's `#e9ece4` desk. This is the one shadow that is a *metaphor* rather than a UI affordance.
- **Modal** (`0 24px 80px #0f2f2433`): 20% opacity over a `#132c2466` backdrop. Deliberately the heaviest thing in the product.
- **Toast** (`0 5px 30px #193b3522`): Floating confirmation.
- **Avatar ring** (`0 0 0 1px #e6e9df`): A hairline ring, not a shadow — a border drawn outside a 3px white stroke.

### Named Rules

**The Flat-By-Default Rule.** A new surface gets a 1px `#e5e9e2` border and, if it needs grouping, a Tint Green wash. It does not get a shadow. Shadows are reserved for the four elements listed above.

**The Green-Shadow Rule.** Every shadow is green-black (`#173f35` / `#0f2f24` / `#193b35` with alpha), never `rgba(0,0,0,…)`. A neutral black shadow reads cold against warm paper and is the fastest way to break this system.

## Shapes

A soft, consistent radius ladder that scales with the size of the thing. Nothing is sharp and nothing is a pill.

- **5–7px** — small controls: nav counts (5px), badges and tabs (6px), icon buttons, the search box, and inline chips (7px).
- **8px** — the workhorse: every input, select, textarea, button, and nav item. If you are unsure what radius to use, it is 8px.
- **9–11px** — raised or branded blocks: the toast and workspace card (9px), the invoice summary and sidebar note (10px), the brand mark (11px).
- **12px** — all cards and panels: stat cards, customer cards, the collect card, table panels.
- **15px** — the modal, the largest radius in the system.
- **50%** — circles only: status dots (6px), the connection indicator, the collect icon (42px), and the user avatar (31px).

Borders are always 1px and always solid. The system has no dashed, dotted, or multi-weight strokes.

### Named Rules

**The Radius Ladder Rule.** Radius scales with surface size: controls 5–8px, raised blocks 9–11px, cards 12px, modal 15px. A 12px radius on a 34px button breaks the ladder and reads as a different product.

## Components

The component language is **tactile and confident** — things you can hit, with state changes you can feel. Targets are generous (44px minimum), states are unambiguous, and every interactive element responds. Where the incumbent implementation is quieter than that phrase implies, treat the phrase as the direction: new components should commit harder to press and hover feedback than the current baseline does, without adding decoration.

### Buttons
- **Shape:** Softly rounded (8px), 43px minimum height, 11px/17px padding, 9px gap between icon and label, `white-space: nowrap`.
- **Type:** 12px semibold DM Sans. Never uppercase.
- **Primary:** Ledger Green on white text with the 6% button lift. Hovers to `#265747`.
- **Secondary:** White with a `#dde3d9` border. Hovers to `#f0f4ec`.
- **Danger:** A pale rose ground (`#fff4f1`) with `#a44637` text and a `#f1d7d1` border — muted rather than red, because the only destructive action in this product (void) is recoverable-by-design and must not read as deletion.
- **Transition:** 0.15s on all properties.
- **Disabled:** 50% opacity and `cursor: not-allowed`.
- **Icon button:** A 34px square at 7px radius with no resting background; hovers to `#eaf0e5`.
- **Text button:** 12px semibold in `#315c44` with a 9px icon gap and no chrome.

### Badges (status)
- **Style:** A tint ground with matching text at 10px, 6px radius, 5px/9px padding, and a 4px `currentColor` dot rendered via `:before`.
- **Variants:** paid · partial · overdue · unpaid · void — plus a neutral default (`#818876` on `#f0f1ec`).
- **Behavior:** Non-interactive. Badges report; they never filter or toggle.

### Cards / Panels
- **Corner:** 12px.
- **Background:** Surface white, or Tint Green for grouped informational blocks (collect card, ledger summary).
- **Border:** 1px `#e5e9e2`. Always present — this is what replaces elevation.
- **Shadow:** None at rest. See Elevation.
- **Padding:** 22px/20px on stat cards, 24px on panels and the collect card.
- **Featured variant:** The stat card inverts to Ledger Green with `#e4f2ce` figures, `#cfddbf` labels, and `#b2d28f` icons. Exactly one featured card per screen.
- **Panels** clip their contents (`overflow: hidden`) so tables seat flush inside the 12px corner with no inner radius.

### Inputs / Fields
- **Style:** White ground, 1px `#dce2d9` stroke, 8px radius, 11px/12px padding, **44px minimum height**, full width.
- **Label:** A column-flex wrapper with an 8px gap — the label sits above its control at 12px semibold, never floating or inside.
- **Focus:** A 2px `#9fbd90` outline at 1px offset — a soft sage ring rather than a border color change, so the field does not shift size.
- **Placeholder:** `#99a098`.
- **Textarea:** Vertical resize only.

### Navigation
Two distinct components, not one component reflowed. Above 760px the sidebar is the navigation; below it, the bottom bar is.

**Sidebar (desktop, >760px)**
- 45px min-height, 8px radius, 13px type, 13px icon gap, `#707971` at rest.
- **Hover:** `#f5f7f1`.
- **Active:** Tint Green ground (`#edf3e5`), `#294a36` text at weight 650, icon `#507244`.
- **Count chip:** Right-aligned, `#e0e8d5` ground, `#4b6640` text, 10px, 5px radius. Counts unvoided invoices only.

**Bottom bar (mobile, ≤760px)**
- A fixed five-column grid pinned to the bottom on a translucent white ground (`#fffffff2`) with `backdrop-filter: blur(16px) saturate(1.5)`, a hairline top border, and a green-black upward shadow. Bottom padding adds `env(safe-area-inset-bottom)` so the home indicator never crowds it.
- Each item is an icon over a 10px label in a 52px-minimum column. The active item carries a Tint Green pill (46×28, 9px radius) behind the icon, `#3f6b3a` icon, and `#294a36` label at weight 700 — the same three signals as the sidebar, expressed vertically. The pill is the only part that moves; the label never shifts.
- **Count badge:** a 16px Ledger Green dot on the Invoices icon with a 2px ring that matches whatever sits behind it (white at rest, Tint Green when active).
- **Five destinations, not six.** Settings is set once and rarely revisited, so it leaves the bar for the topbar, alongside sign-out.
- Content reserves `168px + safe-area` of bottom padding so nothing is ever trapped beneath the bar or the floating action.

**Floating action (mobile only)**
A 58px Ledger Green circle above the bar on the right, carrying the create-invoice action. It is **hidden until the page scrolls past 150px** — while the heading's own "New invoice" button is still on screen the FAB would be redundant, and on a short page a fixed FAB would sit on top of a row the user is trying to tap. It fades and scales in, and is `pointer-events: none` plus `tabIndex={-1}` while hidden so it is inert to both pointer and keyboard.

### Named Rules

**The Two Navigations Rule.** The sidebar and the bottom bar are separate components with separate layouts. Never try to make one become the other with CSS — a drawer is a desktop pattern wearing a phone costume, and the top-left corner is the furthest point from a thumb.

**The Earned Overlay Rule.** Anything fixed over content must justify covering it. The FAB appears only when the action it duplicates has scrolled out of reach, and it is inert whenever it is invisible.

### Data table
- **Header:** 9px DM Sans 500 with +0.7px tracking on a Sunken Surface ground, bounded by hairlines above and below — seated into the panel rather than underlined.
- **Cells:** 11px, 19px padding, `white-space: nowrap` inside an `overflow-x: auto` scroller. First column gets 24px left padding to align with the panel heading.
- **Row hover:** `#fcfdf9` — barely there, enough to track a row across a wide table.
- **Row link:** 12px at weight 650 in `#334f3c`, underlining on hover.
- **Money cells** carry `.number` (tabular figures, weight 500).

### Modal
- **Shape:** 15px radius, white, with the heaviest shadow in the system over a `#132c2466` backdrop.
- **Header:** Title at 18px with a 34px close icon button.
- **Behavior:** Focus is trapped, the first focusable element receives focus on open, Escape closes, body scroll is locked, and focus returns to the invoking element on close.
- **Print:** The backdrop goes static and unstyled, the modal loses its chrome entirely, and the invoice sheet prints alone.

### The Invoice Sheet (signature component)
The product's centerpiece and the only component with its own type scale. A white A4 page resting on a `#e9ece4` desk with the Paper shadow, its own ink color (`#29362d`), a `#eef2e7` table header band, ruled rows, a totals block, and signature lines.

In print it stops being a component and becomes a document: `@page { size: A4; margin: 12mm }`, all chrome hidden, the table header repeating across pages via `display: table-header-group`, `break-inside: avoid` on the header, rows, totals and signature blocks, and `print-color-adjust: exact` so the header band survives. The blank variant adds ruled cell borders and taller rows for handwriting.

### Brand mark
A rounded-square mark (`public/favicon.svg`) in Ledger Green carrying a Fresh Lime "O" aperture with a Paper-white quadrant — the two signature colors and the ground, in one 64×64 shape. Its corner radius is `28.125%`, which resolves to the ladder's 11px at the canonical 40px size and stays proportional at every other.

It renders through one component, `src/Brand.tsx`, paired with the lowercase `opervia` wordmark at Manrope 800. Sign-in, the sidebar, the app footer (22px) and the loading screen (52px) all draw from that single source; the favicon and Apple touch icon are the same artwork.

**The One Mark Rule.** There is exactly one Opervia mark and one place it is defined. A new surface that needs identity imports `Brand` or the SVG — it never redraws the shape, recolors it, sets it on another ground, or substitutes a lettermark. And it never appears on the invoice sheet or the blank sheet: those carry the user's business, not ours.

### Toast
Ledger Green ground (`#1b4334`) with `#eff6e4` text at 9px radius, floating on the toast shadow. Confirmation only.

### Named Rules

**The 44px Rule.** No interactive element is under 44px of touch height. Inputs are 44px, buttons 43px, nav items 45px. The 34px icon button is the one exception and is only permitted where a larger target sits adjacent.

**The Three-Signal Active Rule.** The active nav state changes ground, text color, and weight together. One signal is a hint; three is a fact.

## Do's and Don'ts

### Do:
- **Do** give every new surface a 1px `#e5e9e2` border instead of a shadow.
- **Do** use Manrope with tabular figures for anything that represents money, and DM Sans for anything a person reads.
- **Do** pair every status color with a dot and a word.
- **Do** keep interactive targets at 44px or above, and test at 390px as a primary width — not as a fallback.
- **Do** use Tint Green (`#edf2e5`) when a block needs grouping or a "you are here" signal.
- **Do** hide low-value table columns below 760px rather than compressing them.
- **Do** tint shadows green-black (`#173f35` with alpha) on the rare occasions a shadow is warranted.
- **Do** keep the invoice sheet's print rules intact when touching it — `break-inside: avoid`, `table-header-group`, and `print-color-adjust: exact` are load-bearing, not decoration.
- **Do** state exactly what a figure is. "Net cash movement" is not profit, and the label must never drift toward implying it is.

### Don't:
- **Don't** use Fresh Lime (`#d6edb0`) for state, success, or selection. It is identity only.
- **Don't** introduce `rgba(0,0,0,…)` shadows or neutral grey borders — they read cold against warm paper and break the hue family.
- **Don't** exceed roughly 10% Ledger Green coverage on a screen, or place two featured cards on one view.
- **Don't** convey status, or anything else, by color alone.
- **Don't** uppercase button labels. Uppercase belongs to the eyebrow and nowhere else.
- **Don't** add a third font family. Two is the system.
- **Don't** break the radius ladder — controls 5–8px, raised blocks 9–11px, cards 12px, modal 15px.
- **Don't** style the void state as deletion. A voided invoice is retired, stays visible in history, and uses the neutral grey badge for exactly that reason.
- **Don't** put a shadow on a card at rest, or a hover lift on a panel.
