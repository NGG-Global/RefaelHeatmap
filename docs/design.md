# Design — applying the programme design system

The screens use the programme's presentation design system (a 1920 × 1080,
Hebrew, right-to-left slide template). The system defines colour, type, geometry
and one decorative motif, and states that it has **no interactive states**. The
interactive rules below are new; each is derived from a rule the system already
has, so the app reads as part of the same family as the workshop slides.

Tokens: `src/platform/tokens.css`. Values marked *brief* come from the product
brief; *derived* values are computed from a system value and are always solid
colours (the system allows no transparency on content).

## Foundations kept as-is

| Area | Rule |
|---|---|
| Colour | `--blue #0044E8` (brand), `--navy #00002C` (dark ground), `--ink #000030` (titles), `--mist #F8FAFC`, white. Brief: `--card #F5F7FC`, `--text #2A3357`. |
| Grounds | One ground per screen region: navy (hero, lobby, PIN gate, message pages), white (questions, results), mist (host console). |
| Type | Assistant only, weights 400/600/700/800, self-hosted woff2 (Hebrew + Latin subsets), preloaded. Display type on 90 % leading. |
| Geometry | Radii are 0, 50 % or a stadium. Nothing is lightly rounded. No borders, no shadows, no blur. |
| Motif | Trail + dot at the template's exact sizes and rotations, only on navy grounds, clipped by the edge on small screens rather than scaled. |
| Projector | The display is laid out on the system's own 1920 × 1080 canvas and scaled to the window. Footer lockup: NGG mark at x 26, y 995, 72 px tall. Client marks are never used. |

## Extensions for interactive screens

| Need | Rule | Derived from |
|---|---|---|
| Idle control | `--blue-wash #E0E9FC` fill, ink label | The system's empty image well (12 % blue wash), made solid |
| Selected control | Solid `--blue`, white label (7.0:1) | Blue as the brand shape colour |
| Highlighted band | Stadium row in `--blue-wash`; idle buttons in it turn white | Stadium geometry; wash |
| Primary action | Blue stadium button, ExtraBold label | Stadium geometry |
| Disabled action | Wash fill, `--text-muted` label | Wash |
| Confirmation | Navy stadium, white ExtraBold text | Navy ground with white type |
| Focus | 3 px outline in blue (white on navy) | System contrast rule for focus rings |
| Inputs | White stadium on a navy ground, ink text | Contrast by ground, not by border |
| Running text on phones | 1.25 leading (display type keeps 0.9) | Legibility on small screens |
| Chart grid | `--rule #DBDBE2` (ink at 14 %), midlines in ink, 4 px | Ink |
| Bubbles | Blue at 85 % opacity with a `--blue-deep #002CA6` 2 px outline, white count | Brief |
| Mean marker | Navy ring and cross on a white halo, label "ממוצע" with a white halo | Brief (navy marker, never a bubble) |

All text/ground pairs meet WCAG AA: lowest is white on a bubble (5.3:1);
`--text-muted` is 5.9:1 on white and 5.5:1 on card.

## Screens

- **Participant (phone).** Navy hero with the opening line; two questions, each a
  numbered kicker (axis label), the question as a title, and five stadium rows:
  two 56 px score circles + the band text. Sticky submit bar on `--card`. Closed /
  not-found states are full navy message pages. Layout stays put when a score is
  chosen (no re-wrapping, no motion).
- **Display (projector).** Lobby on navy: QR (760 px, quiet zone included),
  short link under it, event name (88 px) and live counter (133 px) on the right.
  Results on white: matrix centred-left (`dir="ltr"`), event name top-right,
  counter bottom-right. Bubble sizes: `src/modules/heatmap/scale.ts`.
- **Host console (desktop first).** Navy header with the create form; events as
  white panels on mist with state chips, the participant link, and two action
  groups (state toggles / data actions). Reset and delete open a modal
  confirmation.

## Motion

None, except the 250 ms bubble resize the brief requires.
