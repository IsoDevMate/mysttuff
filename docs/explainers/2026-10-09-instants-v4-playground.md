# 2026-10-09 — Instants v4 + the creative playground: reading pulls you into moments, the admin stops being a dashboard

## Background

Three threads from earlier planning finally got their turn in v4:

1. **Article ↔ instant cross-linking** — articles and instants lived in two silos.
   A reader finishing a story had no path into the moments captured around it.
2. **The viewer was a box, not a scene** — the v2 viewer was a 380px card pinned
   bottom-right. Instagram-trained thumbs expect full-bleed, progress, and taps.
3. **The admin home was a stats wall** — "Total Articles: 7" is inventory, not
   creation. The whole brief: *creator playground, not 43-year-old dashboard*.

All three shipped behind flags (canary), on top of v1–v3 architecture — no new
tables, no new services.

## Intuition before details

### 1. Cross-linking = ranked matching, not a join table

The simplest version of "which instants belong to this article" is a join
table. But you don't want to fill in another form field when you capture a
moment. So matching is *inferred* at read time:

```
GET /api/articles/:slug/instants
```

Scans recent published instants and scores each:

- **weight 2 — explicit**: `link_url` mentions the article's slug
  (e.g. you linked the instant to `/blog?slug=my-post`)
- **weight 1 — keyword**: any article tag (>2 chars) or the slug's words
  appear in the instant's text

Explicit beats keyword; within a tier, newest first; capped at 12. No admin
effort — the matching is a *language* problem the backend solves by reading
your existing tags.

The public strip (`InstantsStrip.jsx`) sits between RelatedPosts and
Comments. It's SSE-linked: someone captures a moment that matches the article
you're reading, it slides in live with a "new" pill.

### 2. The viewer is now a *scene*: typed-stack progress + seen ledger

Real stories viewers have three mechanics that make them feel alive:

- **Progress segments** — one sliver per instant; the current one fills over
  6 seconds, then auto-advances (paused while you're typing a note, disabled
  entirely for already-seen instants so browsing feels calm).
- **Tap zones** — left third goes back, right third goes forward, like IG.
  Desktop also gets edge arrows and ←/→ keys; Esc closes.
- **The seen ledger** — `localStorage.instantsSeen` records what you opened.
  Unseen instants carry a small "new" pill in the feed. Seen ones never
  auto-advance again. This is the same psychological loop as "blue ring vs
  grey ring" — cheap to compute, no server round-trip, capped at 400 ids.

```js
// the resolve rule (same shape as the flags canary rule — coincidence not)
visible_as_new = loaded && !seen.has(instant.id);
```

Reduced motion: the fill animation is disabled via a CSS media query and
`useReducedMotion`-style guards; seen instants never animate at all.

### 3. The creator recap grid: reciprocity made visible

`/Recap` now shows — **only to admin-token sessions** — two grids above the
public month archive: *today* and *this week*, each tile 4:5 with its top
emoji + total reaction count pulled from the existing
`/api/admin/reaction-summary` endpoint. Zero new endpoints; the pill data is
the same rollup Instants.jsx already uses.

### 4. The creative playground: routing intent, not rendering forms

`PlaygroundStudio.jsx` replaces the stats wall when `admin_playground` is
canary/on. Its substance:

| Element | What it does |
|---|---|
| Command box | Types "photos from friday" → routes to `/gallery`. "article…", "instant…", "flags…", "hot takes…" get their own verbs. Unmatched text → article editor. If a draft title matches your words, it offers *resume* instead of *new*. |
| Quick leaps | write an article / drop photos / capture a moment — three verbs, no nesting. |
| Loose ends | Unfinished drafts (resumable), published-without-cover articles, gallery nudge, total-reactions loop note. Dismissable; dismissals persist in `localStorage.pgDismissed`. |
| Moments you caught | Recent `source='capture'` instants with their top-emoji pill — the same reciprocity loop as the recap grid, closer to the work. |

The routing rule is a plain function (`routeCommand`), not an AI call —
predictable beats clever for something you'll hit 20 times a day. AI upgrades
later can slot behind the same signature.

**Fail-safe design**: if the flags fetch fails, the classic dashboard
renders. The old board never went away — `admin_playground=off` makes that
literally true.

## Mental model to keep

- **Flags decide visibility, never existence.** All 7 flags now:
  widget/film/home/reactions/capture/crosslink/playground — same resolve rule.
- **Matching is inference, not data entry.** Tags you already write do the
  linking work.
- **Seen-ness is a client ledger.** Server stays stateless about reading;
  expiry remains the only server-side lifecycle truth.
- **Playground = routing + context, not new storage.** It reads the same
  articles/gallery/instants/reactions data through existing endpoints.

## Quiz yourself

1. An instant's `link_url` is `/blog?slug=nairobi-nights` and its text says
   "nairobi". An article has slug `nairobi-nights` and tag `nairobi`. What
   weight does the instant carry, and why? *(2 — explicit link match beats
   the keyword; within weight 2 sorting is newest-first.)*
2. You open instant B, read it, then navigate to A, back to B, C. Which
   instants auto-advance now? *(None that are seen — B is in the ledger, and
   already-seen instants never auto-advance; only the unseen ones do.)*
3. A visitor with no admin token opens `/Recap`. What do they see above the
   month archive? *(Nothing — the today/this-week grids render only behind a
   verified token; the archive is unchanged.)*
4. Type "FuRf flags" in the command box… which route wins? *(Flags — the
   /flag/ pattern matches before the article default, case-insensitively.)*
5. `admin_playground` is `off` and you hit `/`. What renders? *(The classic
   stats-wall dashboard — the studio mount returns nothing when the flag is
   off; fail-closed to old behavior.)*
6. Why does the cross-link endpoint cap at 12 and the strip refuse to render
   with zero matches? *(Long articles shouldn't drown under strips; and an
   empty strip section returns null — no heading, no gap — reading flow is
   untouched when there's no link.)*
7. On the photo canvas, which tile is the cover, and what happens if the
   save request fails? *(Position 0 — demoting it is impossible in the UI,
   and a failed save keeps every tile plus its arrangement on the canvas for
   retry; nothing is half-written server-side because the PUT is atomic.)*
8. Why does PhotoCanvas portal to document.body instead of rendering inside
   the studio component tree? *(StrictMode double-mount and App-level
   AnimatePresence route transitions would otherwise unmount it mid-edit —
   erasing an unsaved arrangement during navigation.)*

## 5. PhotoCanvas — the "50-photo moment", real this time

`PhotoCanvas.jsx` is the first true *temporary creative mode*: a full-screen
workspace that mounts only when a task calls for it (from the "drop photos"
leap or a loose-ends card) and unmounts when the task is done.

**What direct manipulation means here:**

- Drop or pick a whole batch → uploads run one-by-one through the existing
  `api.uploadFile` (R2) pipeline; each thumbnail appears the moment *its*
  upload lands, while the rest are still in flight. Perceived speed > raw speed.
- Reorder by dragging tiles, or by hover buttons (`← earlier` / `later →`)
  that also work without precise pointer gestures. Position 0 **is** the
  cover — the badge lives on the tile, not in a dropdown.
- Save is blocked until uploads finish (`hasPending`), disabled state shows
  why. The footer states the truth: esc/discard writes nothing; save failure
  keeps everything on the canvas for retry — no silent data loss in either
  direction.

**Engineering notes worth keeping in mind:**

- `media` arrives as a JSON *string* (Turso TEXT column) — `parseMedia`
  normalizes string/array/legacy `image_url`-only rows, same contract as the
  public site's `getMedia()`.
- The canvas mounts through `createPortal(..., document.body)` so StrictMode
  double-mounts and App-level `AnimatePresence mode="wait"` route transitions
  can never unmount it mid-edit; the portal key (`canvasItem.id || 'new'`)
  separates create from edit instances.
- `onClick={onClose(false)}` (vs `() =>`) would call `setCanvasItem(null)
during render` — a real bug class this codebase hit; check for it in any
  future `onClose(fn)` style APIs.

## What's next (honest ledger)

- Alt text per photo, AVIF/WebP variants, blur-up placeholders — still open.
- Command box is rule-based; an AI porter can upgrade `routeCommand` without
  touching UI.
- Playful extras (canvas collage mode, headline lab, contextual action
  bubbles) were scoped but not built — the studio foundation needed to exist
  first. They're natural slices on this base.

## 6. Collage reshuffle — try layouts before you commit one

*(added after first ship; commits `2b9d837`)*

The canvas already answered "how do I arrange these?" (drag, nudge). The
reshuffle answers the harder question: *"what other arrangements are there
that I haven't thought to try?"* It is a preview-first loop, not another
reorder control.

**The interaction:**

- "try layouts" (meta row, only with ≥2 tiles and no uploads in flight)
  opens a preview overlay that shows the *whole canvas* reordered under the
  first preset — the committed tiles are untouched while you look.
- The overlay header carries a tiny `before → after` index map
  (`[0 1 2 3 4] → [3 2 1 0]`) so the shape change is legible without
  mentally simulating three permutations.
- Each preview tile labels itself: "stays here", "was #4", or on position 0,
  "would be cover" — because in this data model position 0 *is* the cover,
  for reshuffles exactly as for drags.
- "next layout" cycles three deterministic presets — flipped (reverse),
  stride (evens forward / odds reversed), midpoint (back half interleaved
  into the front) — chosen so every preset produces a genuinely distinct
  order for n ≥ 4 (verified in the suite: `[3 2 1 0]`, `[0 3 2 1]`,
  `[0 3 1 2]` for n=4). Deterministic beats random: the same photos always
  produce the same three candidates, so "no, go back to the first one" is
  possible.
- "use this layout" writes the picked permutation into the ordinary `tiles`
  state — adoption exits the preview into the exact save flow a drag would
  have used. "keep original" (or Escape — which closes only the preview,
  not the canvas) restores the snapshot.

**The snapshot rule (the one real bug this feature could have shipped with):**

The original order is snapshotted the *first* time you open the preview in a
stretch, and any manual edit (drag, nudge, remove) clears the snapshot. Why
not snapshot on every open? Because adopt-then-reopen would otherwise make
"keep original" mean "keep the last thing you adopted", and "reset" would
become unreachable — you'd have to manually undo your own adopt step by step.
With the re-baseline rule, adopt → reopen → keep original is a genuine undo
of the whole reshuffle stretch, and tile removal invalidates the snapshot
(any restore would resurrect a deleted tile's URL).

**Verify:** `.freebuff/verify-shuffle.mjs` — 17 checks: preview opens, ≥3
distinct layouts, Escape closes only the preview (canvas keeps its own Escape
confirm — the two handlers mutually defer via `reshuffleOrder` in the dep
array), adopt changes the cover match, reset restores the pre-shuffle order,
publish persists the adopted order server-side with cover = `media[0]`.
Canvas (15) and playground (9) regressions re-run clean.

**Quiz the reshuffle:**

9. Preview shows `midpoint`, you adopt, reopen the preview, then press
   "keep original". Where do the tiles land? *(Back at the order from before
   the whole reshuffle stretch — the snapshot was taken on first open and
   adopt did not re-baseline it.)*
10. You remove a tile mid-shuffle, then "keep original". What happens and
    why? *(The snapshot was cleared by the remove — restore would otherwise
    resurrect a deleted tile's URL, so no restore is offered.*
11. Escape while the preview is open does what, and why is that different
    from Escape with no preview open? *(The preview's handler closes only
    the overlay; the canvas handler checks `reshuffleOrder` and defers —
    closing the whole canvas from inside a preview you were merely looking
    at would be a data-loss trap.)*
