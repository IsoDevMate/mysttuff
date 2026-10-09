# Instants pure mode: the camera moment, without the form

## Background

Instants currently have one shared model for several experiences: a database
row can contain text, an image, a link, an expiry time, reactions, and public
notes. The capture endpoint accepts an uploaded image and optional text. The
public widget can capture from the camera or choose an image from the roll; the
viewer shows notes and reactions. Public queries hide expired rows, but expiry
does not delete the row or its R2 media.

That flexibility had drifted away from the intended meaning: an Instant is a
photo taken right then. This slice changes the interaction behind a new
`instants_pure` flag. It preserves the old experience when the flag is off and
does not delete existing notes or media.

## Intuition before details

Pure mode removes the form, not the moment: open the camera, take the photo,
share it. No picked file, caption, or note field competes with the image. People
can still react. The timer still governs public visibility; it does not erase
the stored photo.

## Literate code diff

### 1. Flag the new behavior, keep rollback

`backend/server.js` registers `instants_pure`; `backend/database.js` seeds it as
`canary`; and `admin-dashboard/src/components/Flags.jsx` gives it a readable
label. The public flags resolver already grants canary to an authenticated
admin or a visitor who explicitly opts in with `?new-ui=1`. Off restores the
classic UI without changing stored content.

### 2. Enforce the pure capture contract

In `POST /api/instants/capture`, pure mode ignores submitted text and requires
both an image and `capture_method=camera`. The widget attaches that marker only
when the pure camera flow shares its camera frame. The endpoint still uses the
existing authentication, upload size/type checks, R2 upload, expiry duration,
insert, audit log, and SSE broadcast. Notes read/write endpoints return 410
when the flag is fully `on`; while it is `canary`, visitor access remains
available so the staged rollout keeps its fallback behavior.

The marker is not cryptographic proof of a physical camera; an authenticated
caller could forge it. It protects the product contract from ordinary UI paths
and accidental picked-file requests. Stronger provenance would need a trusted
capture mechanism and is outside this slice.

### 3. Keep notes out of the pure viewer and capture flow

`InstantsWidget.jsx` reads `instants_pure`. When active, it does not fetch or
render public notes, removes caption controls and the gallery picker, and shows
a camera shutter followed by a photo preview and share action. Camera denial is
reported plainly; it does not offer a picked-photo substitute. Emoji reactions,
feed navigation, the full-screen viewer, and seen-state behavior remain. Main
camera and share controls meet the 44px mobile target.

Legacy note rows and note endpoints are retained for compatibility and rollback.
They are hidden by the flag, not erased. This change adds no database migration.

### 4. Verify behavior, not just appearance

`.freebuff/verify-pure.mjs` exercises the real capture endpoint and a browser
with a fake camera device. It checks the off/canary behavior, the camera marker,
text removal, hidden notes, retained reactions, shutter-to-preview-to-share,
and visitor fail-closed behavior. It restores original flag states and removes
its test instants on exit.

The extracted design principles live in `docs/design-brief.md`: mobile-first
constraints, the existing public font roles, quiet links/tags, and a distinct
interaction contract for each content type.

## Quiz

1. In pure mode, what must the authenticated capture request contain, and
   what happens to submitted caption text?
2. If an Instant expires, does this feature delete its database row or R2 image?
3. What happens to existing notes when `instants_pure` is enabled?
4. Can the server prove that a photo really came from a device camera because
   of `capture_method=camera`?
5. Which interaction stays available in pure mode, and what flag state returns
   the previous notes/caption experience?

<details>
<summary>Answers</summary>

1. It needs an image and `capture_method=camera`; submitted text is discarded.
2. No deletion. Expiry only hides it from public active queries.
3. They remain stored and available when pure mode is off.
4. No. The marker is an API contract, not trusted camera provenance.
5. Reactions stay; `instants_pure=off` restores classic UI.

</details>
