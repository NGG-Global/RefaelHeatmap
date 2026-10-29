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
| Projector | The display is laid out on the system's own 1920 × 1080 canvas and scaled to the window. Footer: NGG mark at x 26, y 995, 72 px tall. No client logo (brief V5). |

## Extensions for interactive screens

| Need | Rule | Derived from |
|---|---|---|
| Score buttons | Ten 52 px circles, two in each band row: white with an ink number; the chosen one solid in the other programme colour (blue in the navy X question, navy in the blue Y question) with a white number | Circle geometry; programme colours |
| Question header | As on the slide: a bar "ציר X \| <axis name>", white ExtraBold on navy (X) or blue (Y), square corners | The slide "שתי שאלות למפת החום" |
| Anchor bands | As on the slide: five rows on `--card`, the row's two score buttons where the slide has its range pill. The chosen score's row turns solid in the axis colour with white text (same weight, so it never re-wraps) | The slide; card ground (brief) |
| Idle control | `--blue-wash #E0E9FC` fill, ink label | The system's empty image well (12 % blue wash), made solid |
| Primary action | Blue stadium button, ExtraBold label | Stadium geometry |
| Disabled action | Wash fill, `--text-muted` label | Wash |
| Confirmation | Navy stadium, white ExtraBold text | Navy ground with white type |
| Focus | 3 px outline in blue (white on navy) | System contrast rule for focus rings |
| Inputs | White stadium on a navy ground, ink text | Contrast by ground, not by border |
| Running text on phones | 1.25 leading (display type keeps 0.9) | Legibility on small screens |
| Chart grid | `--rule #DBDBE2` (ink at 14 %), midlines in ink, 4 px | Ink |
| Heatmap colour | ColorBrewer YlOrRd (light yellow → dark red #800026), transparent where nobody answered; on white | Brief V5: warm colours on white, interface in the programme colours |
| Respondent dots | 9 px radius, `--ink` with a 3 px white border | Brief V5 ("כחול כהה עם מסגרת לבנה") |
| Quadrant lines | `--ink`, 3 px, dashed 14 / 10, at 5.5 on both axes | Brief V5 |
| Quadrant names | Corners of the map, ink Bold 28 px on a white stadium at 78 % | Brief V5 ("רקע לבן שקוף למחצה") |
| Mean marker | `--blue` 7 px ring on a white halo, label "ממוצע" in blue with a white halo | Brief V5 ("טבעת כחולה") |
| Legend | Under the map, right-aligned: "פחות צפוף" [YlOrRd stadium] "יותר צפוף", then a dot and "נקודה אחת = משיב אחד" | Brief V5 |
| Backup matrix (`?view=matrix`) | Blue bubbles at 85 % with a `--blue-deep #002CA6` 2 px outline, white count; navy ring-and-cross mean marker | Earlier brief (alternative A) |

All text/ground pairs meet WCAG AA: `--text-muted` is 5.9:1 on white and 5.5:1
on card; white on `--blue` is 5.9:1. The heatmap is the one place with
transparency on content (the colour fades out where nobody answered, and the
quadrant-name backgrounds let it show through), because brief V5 requires it.

## Screens

- **Participant (phone).** Navy hero with the opening line; two questions laid
  out as on the slide (header bar, then the five anchor bands), each band row
  with its two of the ten score buttons (brief: buttons, not a slider); the
  chosen score's band is highlighted and nothing is preselected. Sticky submit
  bar on `--card`. Closed / not-found states are full navy message pages.
- **Display (projector).** Lobby on navy: QR (760 px, quiet zone included),
  short link under it, event name (88 px) and live counter (133 px) on the right.
  Results on white: heatmap centred-left (`dir="ltr"`, 840 px square, scale
  0–11 so the corner names clear scores 1 and 10), axis names, legend under the
  map, event name top-right, counter bottom-right. Maths:
  `src/modules/heatmap/density.ts`.
- **Host console (desktop first).** Navy header with the create form; events as
  white panels on mist with state chips, the participant link, and two action
  groups (state toggles / data actions). Reset and delete open a modal
  confirmation. On the projector, the control bar (navy stadium, auto-hides
  after 3 s) ends with "אפס אירוע", which asks "לאשר איפוס?" in place instead
  of opening a dialog on the projected screen.

## Motion

Only what the brief requires: the map fades in on reveal (900 ms); each new
vote fades in, the colour over 700 ms and the dot over 600 ms. Both are off with
reduced motion. (The backup matrix keeps its 250 ms bubble resize.)
