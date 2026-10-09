# mysttuff — Design Brief (public site + admin studio)

> For any model/agent: read this first when touching UI. Extracted from the
> user's design principles (Gienagon design prompts + the three YouTube UI
> scripts) and adapted to this stack. The full verbatim sources live in
> `/home/archlinux/Documents/gymstuff/design-prompts/` — load them only when
> this file is missing a detail you need.

## Product (1 line)

A personal digital world: instants (ephemeral camera moments), articles
(long-form learning journeys), galleries (visual event stories), hot takes
(compact opinions), links. Two faces: the public site (`barackServer/`) and
the creator studio (`admin-dashboard/`).

## North star

> Entering someone's world, not visiting their CMS.

Quiet confidence. Whisper personality; never shout. Personality comes from
hierarchy, motion, spacing, photography, typography — never from loud
colors, decorative widgets, filler copy, or invented statistics.

## Type system (what we have, what it's for)

Fonts available in `barackServer/src/Layout.jsx` — use them by role,
don't mix roles. `Playfair Display` and `Inter` are the active display/body
classes; Lora, JetBrains Mono, and Caveat are loaded or selectable for
specific contexts rather than universally applied:

| Role | Font | Where |
|---|---|---|
| Display / headings | `Playfair Display` (`.font-serif-display`) | page titles, instants panel title |
| Body / UI | `Inter` (`.font-body`) | paragraphs, buttons, captions, chips |
| Long-form reading | `Lora` | article body text |
| Code / timestamps / mono numbers | `JetBrains Mono` | code blocks, index maps, counts |
| Handwritten accents | `Caveat` | sparingly — signatures, "psst" moments |

The admin studio currently ships with browser-default stacks — that is a big
part of why it reads dated. It should inherit the same role system (display
font for the big studio headline, Inter for UI). Define shared font tokens
there before a broad admin reskin; do not change the public typography the
user already likes.

## Tokens

- Public site keeps its warm paper palette (`--bg-color #FAF3E8`,
  text `#292524`, accent `var(--accent-color)` — user-customizable via
  ThemeCustomizer; never hardcode around it).
- Spacing rhythm: 4-pt grid (4/8/12/16/24/32). Radii: `8/12/16/24` +
  squircles for photo media.
- Every color/font via tokens; no one-off hex in components.

## Motion language (one system)

| Interaction | Spec |
|---|---|
| Screen enter | fade + translateY 8→16px, 200–400ms, ease `[0.22,1,0.36,1]` |
| Lists | stagger 40–60ms/item |
| Press | scale 0.95–0.98 + spring |
| Photo/media | shared-element feel where practical; squircle stack arrival |
| Irreversible actions | confirm step (never silent) |
| Forbidden | confetti, random bounce, decorative parallax, motion without purpose |

Principle: everything should *arrive*, nothing should just *exist*.
`prefers-reduced-motion` disables all of it (already the codebase norm).

## Mobile-first rules

1. Public site is read on phones: design at 375px first, then widen.
2. **No horizontal page overflow — ever.** Long words break, not layout:
   `break-words`, `min-w-0` on flex children, no fixed-width blocks wider
   than the viewport. Audit the actual mobile screenshot before changing
   page layout; do not guess at the overflow source.
3. ≥44px hit targets on anything tappable.
4. One scroll direction per section (vertical feeds OR horizontal strips,
   never both in the same section).
5. Text must stay on-screen: no paragraph wider than the container, no
   `whitespace-nowrap` on copy that can wrap.
6. Bottom sheets, not new pages, for context-preserving extras.
7. Type stays large: body ≥16px, captions ≥12px.

## Per-type interaction contracts (echo of the v5 brief)

- **Instants**: camera at the moment, never a picked file — capture → share →
  view → expire. No captions/notes in the core flow (pure mode). Reactions
  stay. Camera denial means no capture, not a gallery-picker fallback.
- **Galleries**: visual story — strongest cover first, fluid sequencing.
- **Hot takes**: compact, thought-prominent, not "another card".
- **Articles**: typography-first long form (Lora body, Playfair heads),
  code in JetBrains Mono.
- **Links/tags**: quiet metadata, not loud chips — small, muted, tappable,
  no pill-stacks competing with content.

## Copy rules

- No em-dashes in user-facing UI copy (user's standing complaint).
- Short, plain, human. No filler explanations; buttons say what they do.
- Empty states: one line of context + one action. Never apologetic filler.

## Do / Don't

| Do | Don't |
|---|---|
| Distinct visual language per content type | "same rounded card" for everything |
| Mobile layout first, 375px | desktop shrunk down |
| Motion that arrives on purpose | decoration for spectacle |
| Copy that says the thing | marketing fluff, em-dashes |
| Tokens for all color/type | hardcoded hex/font stacks |
