---
name: mmm-frontend-builder
description: Build, extend, or modify screens, components, and flows for this enterprise Marketing Mix Modeling (MMM) product — a React frontend (Model Studio pipeline + Marketing Performance reporting) over a Python/FastAPI backend. Use this skill whenever asked to add a page, component, form, table, chart, or feature to the product, whenever given a reference image or mockup to implement, whenever modifying an existing screen, and whenever writing a FastAPI endpoint that a screen will call — even if the user doesn't explicitly say "match the design system" or name a screen. The established design tokens, component library, and information architecture live in this skill's references/ and must be consulted before generating any UI code, not just when things look inconsistent afterward.
---

# MMX frontend & backend builder

This product already has an approved visual identity, component library, and information
architecture — worked out over many iterations and captured in this skill's `references/`
folder. Your job is never to invent a new pattern when an existing one fits, and never to let a
reference screenshot's colors, radii, or spacing leak past this project's own tokens. This
skill exists specifically because ad hoc generation drifts from the established look and from
supplied mockups over a session — treat every step below as a way to prevent that, not as
process for its own sake.

## Before anything else

Read, in this order, whichever are relevant to the request:

1. **`references/information-architecture.md`** — always. Find where the request belongs in
   the domain model and the twelve existing screens (7 Model Studio stages + 5 Marketing
   Performance tabs) before writing anything.
2. **`references/component-library.md`** — always, before writing markup. Identify which
   existing primitives the request is built from.
3. **`references/design-tokens.md`** — always, before writing any CSS/className/style. This is
   the complete color, type, radius, and spacing palette; nothing outside it is used.
4. **`references/backend-conventions.md`** — when the request touches an API endpoint or a
   response shape a screen will render.

## The build loop

### 1. Classify the request

- **New screen/section within an existing stage or tab** — the common case.
- **New reusable component** — only when component-library.md genuinely has nothing that fits;
  say so explicitly rather than silently inventing one.
- **Edit to an existing screen** — locate and read the current implementation first; match its
  existing conventions over anything in this skill if the two ever conflict (the live codebase
  is more authoritative than this skill once it exists — update the relevant reference file if
  you find it's gone stale).
- **New API endpoint** — check `backend-conventions.md`'s route shape and the IP-protection
  rule before deciding what the response returns.

### 2. Place it in the information architecture

State, in one line, which of the 7 Model Studio stages or 5 Marketing Performance tabs this
belongs to (or confirm it's a genuine cross-cutting exception — see
information-architecture.md's placement rule). If the request would require adding a new stage
or tab, flag that explicitly and confirm before building — that changes the pipeline's gating
logic, which is the product's core mechanic, not a decision to make silently.

### 3. Match against the component library

Walk the relevant section of `component-library.md` and name which primitives you're
reusing (`<Card>`, `<DataTable>` with a rollup row, `<ChipToggle>`, `<Callout kind="out">`,
etc.) before writing code. If the request is best served by a genuinely new primitive, build it
from tokens only, then add it to component-library.md in the same pass — an undocumented new
pattern is exactly how this system drifts from itself.

### 4. Handle the input — text description or reference image

**Text description:** map directly onto the closest existing pattern(s) in
component-library.md. Ask one clarifying question only if the placement in the IA is genuinely
ambiguous; otherwise proceed with the most reasonable interpretation and say what you assumed.

**Reference image / mockup:** extract *layout, hierarchy, and interaction* only — which
elements exist, their relative size and grouping, what's clickable, what states it has (empty/
loading/error). **Do not copy colors, fonts, radii, shadows, or spacing from the image** — remap
every visual property onto `design-tokens.md`. This mirrors the product's own founding
decision: workflow and IA can be referenced from other products, visual identity must stay
this product's own. If the image is from a competitor tool or an unrelated design system, treat
it exactly the same way — structure yes, skin no. Say explicitly which visual details you
deliberately did not carry over, so the user can catch it if that was actually wanted.

### 5. Generate the code

React conventions for this codebase:
- Functional components, hooks, one component per file, named exports.
- Import tokens from `src/styles/tokens.css` (or the Tailwind theme mapping) — never hardcode a
  hex value or px radius inline.
- Every data-bearing screen needs loading, empty, and error states — this is enterprise
  software reporting on long-running async jobs (model runs, workbook generation, source
  syncs); a screen with only a "happy path" is incomplete. Reuse the Preparing→Ready pattern
  already established for Workbooks/Add Source for any new async operation.
- Tables render through the shared `<DataTable>` conventions (rollup row first, `.num`
  right-alignment, bar-cells for proportional values) rather than a bespoke `<table>` per screen.
- Charts: use a real charting library (Recharts is the default choice) but reproduce the exact
  visual language documented in component-library.md's Charts section — muted gridlines,
  `--accent-mid` primary series, dashed comparison lines.

FastAPI conventions (when applicable): follow `backend-conventions.md`'s route nesting and
field names exactly; don't introduce a differently-named field for a concept the frontend
already has a name for (`mroi` not `marginalRoi`, `rev` not `revenue` — check the file).

### 6. Self-check before returning

Run through this list and fix anything that fails before presenting the result:

- [ ] Every color/radius/spacing value traces back to `design-tokens.md` — no hardcoded hex,
      no Tailwind default palette colors, no radius other than `--r` (3px) or a circle.
- [ ] Every reusable pattern used is one from `component-library.md`, or is a new one that's
      now documented there.
- [ ] The screen is correctly placed in the IA (one of the 7+5, or a justified exception).
- [ ] `--gate` (amber) is used only for locked/pending states, never for errors; `--neg` (red)
      is used only for genuine failures/errors.
- [ ] Loading, empty, and error states exist for anything async.
- [ ] If built from a reference image: colors/type/radii were remapped to tokens, not copied,
      and that's stated to the user.
- [ ] If a new component or API field was introduced: it's documented in the matching reference
      file, not left implicit in the code alone.

## When this skill doesn't apply

Skip it for pure backend logic with no UI surface (e.g. the statistical fitting code itself,
database migrations) — `backend-conventions.md` still applies for the API layer around such
work, but the design-system parts of this skill don't. Skip it entirely for work on a different
product outside this MMX codebase.
