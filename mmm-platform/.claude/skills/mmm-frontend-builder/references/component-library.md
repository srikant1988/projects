# Component library — MMX

Every recurring UI pattern already established in the product, extracted from the `mmx.html`
prototype. **Check this file before writing new markup.** A new screen should be assembled
almost entirely from these primitives — needing a genuinely new primitive is rare, and worth
pausing on.

For each: what it's for, the prototype's DOM/class shape (ground truth), and a React
translation. Component names below (`<Card>`, `<Tag>`, etc.) are suggested — keep them
consistent once the team picks final names, and update this file if they're renamed, so it
never drifts out of sync with the real codebase.

---

## Shell & navigation

**`<TopBar>`** — 48px sticky header. Wordmark (left) → breadcrumb (client / project) → phase
tabs (right of center) → user avatar (far right). Phase tabs use numbered circular badges;
a locked phase shows a 🔒 and amber (`--gate`) styling instead of the numbered badge.

**`<PipelineStepper>`** — left rail for Phase 1 (Model Studio). A vertical connector line with
circular step dots. Dot states: `idle` (outline only), `active` (accent outline + glow ring),
`done` (filled accent, checkmark). Steps beyond the current furthest-completed one are
`disabled` and not clickable — this enforces the pipeline's sequential gate. Below the steps,
a **seal card**: amber while any stage is incomplete, flips to accent + open once the phase is
fully published, with a progress bar (`n of 7 stages complete`).

```jsx
<PipelineStepper
  steps={[{ title: 'My workspace', caption: 'Choose an engagement' }, /* … 7 total */]}
  currentIndex={step}
  completed={doneArray}   // boolean[]
  onSelect={(i) => canNavigateTo(i) && setStep(i)}
/>
```

**`<ScopeFilterRail>`** — left rail for Phase 2 (Marketing Performance). Stacked filter groups
(Period, Geography, Product, Channel, Tactics, Campaigns), each a header with a live count
(`"4 of 4"`) and a checkbox list. Reset / Apply buttons pinned at the bottom. Only one rail is
mounted at a time — the app swaps `<PipelineStepper>` for `<ScopeFilterRail>` when the user
crosses from Phase 1 into Phase 2, it does not stack both.

---

## Surfaces

**`<Card>` / `<CardHeader>` / `<CardBody>`** — the single content-grouping primitive for the
entire product. No shadow; a 1px `--line` border and `--r` radius. Header: title (`h3`) +
optional caption paragraph on the left, optional action/status on the right, wraps on narrow
widths. Nearly everything in this product is a card.

```jsx
<Card>
  <CardHeader title="Sources" caption="Last sync 06:12 today" action={<Tag variant="ok">7 connected</Tag>} />
  <CardBody>{/* table, form, chart… */}</CardBody>
</Card>
```

**`<Modal>`** — used sparingly (e.g. Add Source). Fixed, centered, `rgba(20,24,31,.5)` backdrop,
white panel with the shadow token, header + scrollable body + footer action row. Closes on
backdrop click or an explicit Cancel.

**`<Callout kind="out">`** (class `.out`) — a distinctive left-accent-bordered, tinted box used
*only* to summarize "what this stage produced" or "why this step exists" — never for generic
notes. This is a signature pattern of the product: after a setup/config screen, the callout
tells the user in plain language what just got computed or locked (e.g. dataset hash, row
count, parameter budget). Keep using it for that purpose specifically, not as a generic info box.

---

## Status & action

**`<Tag>`** — small pill, five variants matching the semantic color rules in
`design-tokens.md`: `ok` (green), `warn` (amber, = "gate"/pending), `bad` (red), `idle` (gray,
neutral/not-started), `champ` (solid accent — reserved specifically for "this is the published
champion model", never reused for anything else).

**`<Button>`** — default (white, bordered) and `variant="primary"` (solid accent). A `size="sm"`
compact variant exists for in-table and toolbar actions. Disabled state is 45% opacity, not a
color change.

**`<ChipToggle>` / `<ChipGroup>`** — pill-shaped multi-option toggles (View: Grid/Compare/Map/
Time series, Dimension: Brand/Channel/Tactics/Campaigns, Level: 1/2/3). Unselected = white/
bordered, selected = solid accent. Always grouped under a small-caps label (`.lbl`). This is
the pattern for "pick one of a short exclusive set," distinct from checkboxes (multi-select
filters) and from `<Tabs>` (navigating between whole views).

**`<Tabs>` (`.vtabs`/`.vtab`)** — underline-style tabs for switching between full sub-views
(Portfolio/Drivers/Scenarios/Tracking/Reports; Summary/Coefficients/Contribution review/Level
stats). Selected tab gets an accent bottom border and accent text color. Don't use `<ChipToggle>`
for this — tabs change what's rendered below entirely; chips filter/configure the current view.

**`<DropdownMenu>`** — small button with a `▾`, opens an absolutely-positioned panel (checkbox
list for "Select KPIs" / "Add column", or a short action list for "Export"). Closes on outside
click. Only one such menu should be open at a time.

---

## Data display

**`<DataTable>`** — the primary way numeric/tabular data is shown. Conventions:
- Sticky, `--sunken`-tinted header row, 11px semibold `--ink-3` labels.
- Numeric columns right-aligned via `.num`; text columns left.
- A **rollup/total row** (class `.rollup`, `--accent-dim` background, bold) always pinned as the
  first data row when the table aggregates — never bury the total at the bottom.
- Inline **bar cells** (`.bcell` + `.btrack`/`i`) for showing a value with a proportional bar
  next to it in the same cell — used throughout Portfolio/Compare views instead of a separate
  chart column.
- Up/down deltas use `.up`/`.down` (never a raw ▲/▼ with default color).
- Muted secondary text under a primary cell value uses `.sub`.

**`<KpiStrip>` / `<KpiTile>`** — a hairline-divided grid of metric tiles (1px `--line` gaps
simulate dividers without extra borders). Each tile: small caps label, large Archivo value,
small delta line. Some tiles show two stacked rows (e.g. Revenue: Total + Incremental) instead
of one big number — use that pattern when a metric has a natural total/incremental pair.

**Charts** — the prototype hand-rolled everything as inline SVG (waterfall, weekly bar+line
trend, response curves) because the environment had no chart library. **In the real React app,
use a proper charting library (Recharts is a good default)** — but preserve the exact visual
language pulled from the SVGs: muted `--line` gridlines, `--ink-3` 9.5–10px axis labels,
`--accent-mid` for primary series, `--pos`/`--neg` for waterfall up/down bars, dashed strokes
for "forecast" or "year-ago" comparison lines. Don't let a chart library's default theme show
through.

---

## Forms

**`<Field>`** — label (11.5px semibold) above a full-width input/select (`--line-hard` border,
`--r` radius, `--accent-mid` focus ring), optional `.hint` caption below in `--ink-3`.

**`<Checkbox>` (`.chk`)** — label + native checkbox, `accent-color: var(--accent)`, used for
both filter lists and settings toggles (not for the exclusive-choice case — that's
`<ChipToggle>`).

**Dropzone** — dashed `--line-hard` border, `--sunken` fill, centered instruction text + a
"Choose file…" button. Used identically for the specification-file upload and the Add Source
Excel path — reuse one `<Dropzone>` component rather than rebuilding it per screen.

---

## Adding a new primitive

If a request genuinely can't be built from the above: build it using only tokens from
`design-tokens.md`, then add a short entry to this file in the same format before considering
the task done. A new primitive that isn't documented here will drift the next time someone
(human or Claude) builds a similar screen without knowing it exists.
