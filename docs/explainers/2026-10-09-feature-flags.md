# 2026-10-09 — Feature flags: staged rollouts without redeploys

## Background

Before this change, every public feature was **hardwired into the code**. If
`InstantsLive` (the homepage section) broke at 2am, your only option was a new
git commit + redeploy of the backend *and* both frontends. Render deploys take
minutes; a broken feature stays broken for that whole window.

Three features existed across three codebases:

| Feature | Lives in | Shows on |
|---|---|---|
| Instants floating widget ⚡ | `barackServer/src/components/instants/InstantsWidget.jsx` | every public page, via `Layout.jsx` |
| Gallery film strip | `barackServer/src/components/instants/InstantsFilm.jsx` | `Gallery.jsx`, top of page |
| Homepage live section | `barackServer/src/components/instants/InstantsLive.jsx` | `Home.jsx`, between hero and Recent writing |

The public site had no way to say "hide this for a bit" — that decision was
baked into whether an `<Component />` tag existed in JSX.

## Intuition before details

A **feature flag** is a switch stored in your database instead of your source
code. The code for a feature always ships; whether it *renders* is decided at
page load by a tiny `on/off` value fetched from the backend.

Think of a light switch wired to a smart plug: the wiring (feature code) never
changes — you just tap the plug (DB row) to control the room. Rolling a feature
out becomes: off → canary → on, like Instagram giving a new UI to 5% of users
before everyone.

Canary = "me only": the switch returns `canary`, and the public site treats it
as **off for strangers, on for you**. How does the page know it's *you*? Your
browser has the admin dashboard's JWT in `localStorage` (`adminToken`). The
site verifies it silently against a token-protected endpoint. No login page on
the public site, no leaked user data — just "this token opens the admin door."

The visitor preview: `?new-ui=1` in the URL opts a visitor into canary
features (persisted in `localStorage`). A small pill ("trying the new
version — back to classic") appears so they can flip back. This is the
"toggle between the existing version and the version being rolled out."

```js
// The resolve rule, in one line:
visible = state === 'on' || (state === 'canary' && (admin || newUiOptIn));
// 'off' → nobody. That's the whole system.
```

## The system map (what actually changed)

```text
backend/database.js      + site_flags table (key, state, updated_at)
                         + seed rows defaulting to 'on' (backward compatible)
backend/server.js        + GET  /api/flags          (public, no-store)
                         + GET  /api/admin/flags    (auth)
                         + PUT  /api/admin/flags/:key (auth, audited)
admin-dashboard          + api.getFlags / api.setFlag
                         + components/Flags.jsx (new route /flags, sidebar)
barackServer             + lib/flags.jsx  (FlagsProvider: fetch + resolve)
                         + Home.jsx, Gallery.jsx, Layout.jsx read flags
                         + version pill in Layout while previewing
```

## Literate code diff walkthrough

**`backend/database.js`** — additive migration. A new table, plus seed rows
using `ON CONFLICT DO NOTHING` so re-running never overwrites your manual
choices. Defaults are `'on'` for all three flags: the day this deploys,
**nothing visible changes**. That is the backward-compatibility principle:
a migration's job is to preserve current behavior, then hand control to you.

**`backend/server.js`** — three endpoints. Note the detail you'd miss:
`res.set('Cache-Control', 'no-store')`. Without it, browsers/CDNs may heuristically
cache the flags response and serve *yesterday's* rollout state minutes after you
flip a switch — the exact class of bug a rollout system must never have. `PUT`
validates the state against `off|canary|on` (bad input gets 400) and rejects
unknown flag keys (404), and every flip writes an `audit_logs` row: who
changed what, when.

**`barackServer/src/lib/flags.jsx`** — one `FlagsProvider` wraps the whole
public app (`App.jsx`). Two data sources race in parallel: the public flags
fetch, and the admin-token check. Resolution happens client-side. On fetch
failure it **fails closed** (`{}` = all features hidden) — the classic site
(articles, tags, gallery) still renders; nothing broken flashes in.

While `flags` is `null` (still loading), gated features stay hidden. This
prevents the flash-of-new-UI: features never appear briefly before the flags
answer arrives.

**Gating** is one-line in each page:

```jsx
const { flags } = useFlags();
const showInstants = flagOn(flags, "instants_home_section");
{showInstants && <InstantsLive />}
```

**`admin-dashboard/src/components/Flags.jsx`** — visually a 3-level segmented
toggle per feature: Off / Canary (me only) / On (everyone). Updates are
**optimistic with rollback**: the UI flips instantly; if the `PUT` fails, the
old state is restored and an error banner shows. Confirmed 200s are fast, so
optimism is safe here.

## Behavior boundaries (know before you trust it)

- **Failed flags fetch** → features hidden, nothing crashes. Classic site intact.
- **Unknown flag key in PUT** → 404, no silent no-op.
- **Invalid state string** → 400, DB CHECK constraint as backup.
- **Expired admin token** → the canary check quietly fails → you see the
  visitor view. Not a security boundary — worst case a stranger with
  `?new-ui=1` sees a canary feature early; it is intentionally preview-able.
- **Render deploy lag** — the backend must be redeployed once for this system
  to exist in prod. After that, flips are instant (SSE/stream not used for
  flags: page loads are the poll).

## Quiz

1. A flag is set to `canary`. Under what exact conditions does a visitor see
   the feature? What does the site check to decide "this is the admin"?
2. Why does `/api/flags` set `Cache-Control: no-store`, and what bug would you
   observe without it?
3. The flag seed rows use `ON CONFLICT DO NOTHING` and default to `'on'`.
   Which engineering principle does this implement, and what would break if
   the default were `'off'` instead?
4. `FlagsProvider` renders gated features only when `flags` is non-null.
   What two distinct problems does this prevent?
5. The admin Flags panel sets state optimistically. What must the rollback
   path do, and why is optimistic UI acceptable *here* but not for, say,
   deleting an article?

<details>
<summary>Answers</summary>

1. Only when `state === 'canary'` AND (the browser holds a working
   `adminToken` verified against a protected endpoint OR the visitor opted in
   via `?new-ui=1`, persisted in localStorage). Everyone else: hidden. The
   "admin" decision is purely client-side verification of an existing JWT —
   the public site never gets user data from the flags endpoint.
2. Without `no-store`, a browser or shared cache may reuse a previously cached
   flags response (heuristic caching), so pages loaded minutes after a flip
   still show the old rollout state — a rollout system that lags its own
   switches is unsafe to operate.
3. Backward compatibility via additive migration. If defaults were `'off'`,
   the deploy itself would silently hide all three instants features — a
   migration should preserve existing behavior and hand control to the
   operator afterward, not cause a surprise outage of features.
4. (a) Flash-of-new-UI — a feature briefly appearing before flags load says
   "off". (b) Wrong-permission flash — canary features appearing to strangers
   during load. Fail-closed also means an API outage hides features rather
   than exposing them.
5. Rollback must restore the previous flag state in the UI (and it does —
   it keeps the pre-flip snapshot). Optimistic UI is acceptable for a flag
   flip because the operation is cheap, idempotent, and near-instant with
   clear success/failure; deleting an article is destructive and
   irreversible, so confirmation and server-confirmed-then-update is right
   there.

</details>
