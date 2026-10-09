# 2026-10-09 — Instants v2: reactions, free notes, IG-style viewer

## Background

The first Instants was a Locket-style feed: admin posts a spark, visitors watch
live over SSE. If a visitor wanted to respond, the form demanded **your name,
your email, and a waitlist approval** before anything went live. Text was
capped short. Visually it was small cards in cream — nothing like the thing
that inspired it.

The bus-factor problem: this design made every interaction a negotiation
("who are you? may you speak?"), which is the opposite of how IG Instants
works — you tap an emoji, that's it, you're done. Identity was being collected
for a *moderation* reason but applied as an *entry* tax.

## Intuition before details

Three changes, one theme: **lower the cost of reacting to zero.**

1. **Reactions** = emoji pills (❤️😂🔥😮🥲👏) under each instant. Tap toggles on
   (IG behavior), tap again removes. No account, no email — just a random id
   generated in the browser (`visitorId`) so we can count "one per person"
   without knowing who the person is.
2. **Notes** = free text, goes live instantly. No name, no email, no waitlist.
   Old gate deleted server-side. Moderation is now *reactive* (admin deletes)
   instead of *preventive* (waitlist approves first), with a per-visitor rate
   limit to make spam drive-bys annoying rather than profitable.
3. **The viewer** went dark (#0b0b0b) with big squircle-cornered media
   (rounded-[28px], 4:5 aspect) — the IG-instants look: media is the hero,
   chrome recedes.

```js
// The whole reactions model in one invariant:
// (instant_id, emoji, visitor_id) either exists or it doesn't.
// POST = toggle that row. COUNT = the pill badge. Nothing else.
```

## The system map

```text
backend/database.js     + instant_reactions table (instant_id, emoji, visitor_id)
                        + 'instants_reactions' flag seeded as 'canary' (QA first)
backend/server.js       + GET  /api/instants/:id/reactions  (counts + mine, no-store)
                        + POST /api/instants/:id/reactions  (toggle, ≤6 emoji/person)
                        + DELETE /api/admin/instants/:id/thoughts/:tid (moderate note)
                        + thoughts POST: no name/email; rate limit 8/min/visitor
                        + instant delete now cascades reactions too
admin-dashboard         + Flags panel auto-shows the new 'instants_reactions' switch
barackServer            + InstantsWidget rewritten: dark feed, IG single-instant
                          viewer, reaction row (flag-gated), free note composer
```

## Behavioral decisions worth knowing

- **`content over identity`** — notes render as `someone <text>`; only
  waitlist-approved emails (via `v:wl:<email>` visitor id) keep their name.
  The waitlist/approval machinery lives on untouched for future uses.
- **Rate limit is in-memory** (Map of timestamps). Resets on server restart.
  Fine for a personal blog; swap for a persistent store if spam becomes war.
- **Notes are capped at 1200 chars** — that's "not an article", not the old
  5-word vibe. The old cap is gone.
- **Race-safety client-side:** rapid emoji taps serialize per-emoji
  (`inFlight` set) so a slow remote DB can't produce count drift; possible
  SSE echo of your own note is deduped by id.
- **Reactions flag defaults to `canary`** — unlike last time where new
  features shipped "on", this one is a behavior change on a public surface,
  so it rolls out: you QA → friends via `?new-ui=1` → everyone.

- **Moderation tradeoff:** open posting means occasional junk you'll delete
  from... nowhere yet (admin UI for notes comes with the next pass; for now
  the DELETE endpoint exists and is audited — reachable via API).

## Quiz

1. How does the server let a visitor "un-react" while still counting
   "one ❤️ per person"? What's the actual uniqueness mechanism?
2. Why was the reactions flag seeded `canary` instead of `on`, and what's
   the exact rollout path from there to everyone?
3. The old thought flow created waitlist rows as a side effect of posting.
   What side effect does the new flow have instead, and what bounds it?
4. Where does the visitor's "identity" live, what is it, and what can't the
   server figure out from it?
5. In the widget, why is there an `inFlight` set around reaction toggles, and
   what would a user observe without it on a slow connection?

<details>
<summary>Answers</summary>

1. Uniqueness = the primary-key-free constraint enforced in the handler: it
   SELECTs for `(instant_id, emoji, visitor_id)`; row exists → DELETE
   (`reacted:false`), row missing → INSERT (`reacted:true`). The toggle IS
   the endpoint; the pill badge is just `COUNT(*) GROUP BY emoji`.
2. Seeding `on` would change what strangers see at deploy time without you
   having seen the new UI live. Canary: you (admin token) and `?new-ui=1`
   visitors see it, nobody else. Path: QA yourself → share new-ui link →
   flip to `on` in the Flags panel. No redeploy at any step.
3. The new flow has no automatic side effect on other tables (no waitlist
   writes). Its bound is the in-memory rate limit: 8 notes/min/visitor_id,
   plus the 1200-char cap and admin deletion with audit logging.
4. It lives in the browser's localStorage (`visitorId`), is a random UUID
   with no meaning, and reveals nothing linkable — no email, no IP stored,
   no cross-session identity unless the visitor happens to use the same
   browser. The server can count them but never name them.
5. Without serialization, two quick taps on a slow network produce two
   concurrent POSTs; the second SELECT may run before the first INSERT
   commits, creating duplicate rows (count reads 2, then 1... drift) — or
   the optimistic UI and server disagree. With it, the second tap is a no-op
   until the first toggle confirms; the user sees a stable count that always
   converges to server truth.

</details>
