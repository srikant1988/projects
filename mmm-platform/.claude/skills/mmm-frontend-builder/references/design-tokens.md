# Design tokens — MMX (Model Studio & Marketing Performance)

Extracted verbatim from the approved `mmx.html` prototype. These are the only colors, radii,
and type sizes this product uses. Never introduce a new hex value, shadow, or radius outside
this file — if a request seems to need one, it almost always means an existing token was
misapplied, not that a new one is needed. If a genuinely new token is unavoidable, add it here
first, in the same style as the rest, before using it anywhere.

## Color tokens

```css
:root {
  /* ink — text */
  --ink:        #14181F;   /* primary text, headings */
  --ink-2:      #3D4650;   /* secondary text, body copy inside cards */
  --ink-3:      #737D89;   /* muted / tertiary text, table headers, captions */

  /* structure */
  --line:       #E1E5EA;   /* default borders, table rules */
  --line-hard:  #C6CDD5;   /* input borders, button borders, stronger dividers */
  --surface:    #F1F3F6;   /* page background */
  --panel:      #FFFFFF;   /* card / modal background */
  --sunken:     #F8F9FB;   /* table header row, hover states, secondary panels */

  /* accent — brand / primary action / "in progress or selected" */
  --accent:     #3B3A8F;   /* primary buttons, active nav, links, champion badge */
  --accent-dim: #EDEDF7;   /* selected-row tint, active step background */
  --accent-mid: #6E6DC0;   /* chart bars/lines, focus ring, secondary emphasis */
  --accent-soft:#B9B8E0;   /* rarely used — lightest accent tint */

  /* gate — "locked / awaiting / needs attention", NEVER used for errors */
  --gate:       #8A5A00;
  --gate-dim:   #FBF2E2;

  /* semantic status */
  --pos:        #14795C;   /* positive deltas, "passed", "valid", "done" */
  --pos-dim:    #E6F2ED;
  --neg:        #B03A2E;   /* negative deltas, "failed", errors */
  --neg-dim:    #FBEAE8;
}
```

**Color usage rules (not stylistic preference — these are semantic contracts the whole product
relies on):**
- `--accent` = the user's primary action or the system's current focus. Never repurpose it for
  a status meaning.
- `--gate` (amber) = something is locked, pending, or awaiting an upstream step — **not** an
  error. A failed run or a blocking validation error is `--neg`, not `--gate`. Confusing these
  two is the single most common mistake when extending this UI.
- `--pos` / `--neg` = only for evaluative status (pass/fail, up/down, valid/invalid). Never used
  decoratively.
- Tags (`.tag.ok / .warn / .bad / .idle / .champ`) are the canonical way status is shown in
  tables and headers — see `component-library.md`. Don't invent ad hoc colored `<span>`s.

## Layout tokens

```css
:root {
  --r:    3px;     /* the only border-radius in the product — cards, buttons, tags, inputs, modals */
  --rail: 236px;   /* fixed width of the left navigation/filter rail */
}
```

Everything in this product uses `border-radius: 3px` or is a perfect circle (avatars, step
dots, tab-count badges). There is no second radius scale — no `rounded-lg` / `rounded-xl`
equivalents. If a mockup shows a larger radius, treat that as a detail to intentionally not
copy (see SKILL.md §5).

## Typography

| Role | Font | Weight | Size | Notes |
|---|---|---|---|---|
| Headings, wordmark, KPI values | Archivo | 600–700 | varies | `letter-spacing: -0.015em` |
| Body, UI copy, tables | IBM Plex Sans | 400–500 | 13px base | default body font |
| Page title (`h1`) | Archivo | 600 | 19px | |
| Card title (`h3`) | IBM Plex Sans | 600 | 13px | |
| Section caption | IBM Plex Sans | 400 | 12.5px | `color: var(--ink-3)` |
| Table header | IBM Plex Sans | 600 | 11px | uppercase-weight but NOT uppercase text; `color: var(--ink-3)` |
| Micro / meta text | IBM Plex Sans | 400 | 11px | timestamps, sub-labels |

Load both from Google Fonts: `Archivo:wght@500;600;700` and `IBM+Plex+Sans:wght@400;500;600`.
`font-variant-numeric: tabular-nums` is set globally on `body` — every table of numbers must
keep this so columns of figures align. Don't override it locally.

## Spacing

No formal spacing scale was defined in the prototype (it was hand-tuned per component), but
values cluster tightly around a base-4/5 rhythm: `4px, 6px, 8px, 9px, 10px, 12px, 13px, 14px,
16px, 18px, 22px`. When building a new component in React, snap to the nearest of these rather
than introducing arbitrary values like `15px` or `20px`.

## Elevation

```css
--shadow: 0 1px 2px rgba(20,24,31,.08), 0 8px 24px -12px rgba(20,24,31,.18);
```
Used only for modals and dropdown menus — never on cards (cards use a 1px border instead of a
shadow; this product is deliberately flat/enterprise, not "floating card" styled).

## Focus state

```css
:focus-visible { outline: 2px solid var(--accent-mid); outline-offset: 1px; }
```
Applies globally. Don't remove or replace with a custom focus ring per component.

## Translating to the React stack

The prototype was hand-built HTML/CSS/JS for speed of iteration. For the production React app:

- Port this file's `:root` block into `src/styles/tokens.css`, imported once at the app root.
  Keep the CSS custom property names identical — every component below references them by name.
- If the team adopts Tailwind, map these into `tailwind.config.js` under `theme.extend.colors`
  using the same names (`ink`, `ink2`, `ink3`, `accent`, `accentDim`, `gate`, `pos`, `neg`, …)
  rather than Tailwind's default palette, so `bg-accent` and `var(--accent)` always agree. Don't
  let Tailwind's default blue/green/red slip into any component — that is the fastest way this
  system drifts from itself.
- Keep `--r: 3px` as the single `borderRadius.DEFAULT` in the Tailwind theme, not `rounded-md`'s
  usual 6px.
