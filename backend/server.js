import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import cron from 'node-cron';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import db from './database.js';
import { uploadFile, deleteFile } from './storage.js';
import { authenticateToken, generateToken } from './auth.js';
import os from 'os';

// ─── Structured logger ───────────────────────────────────────────────────────

function log(level, msg, extra = {}) {
  const entry = { time: new Date().toISOString(), level, msg, ...extra };
  if (level === 'error') {
    console.error(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

// Catch anything that slips through
process.on('uncaughtException', (err) => {
  log('error', 'Uncaught exception', { error: err.message, stack: err.stack });
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  log('error', 'Unhandled rejection', { reason: String(reason) });
  process.exit(1);
});

log('info', 'Starting server', {
  node: process.version,
  env: process.env.NODE_ENV || 'development',
  platform: process.platform,
});

// Connection checks (non-fatal — server must bind to PORT before Render health checks)
async function checkConnections() {
  try {
    await db.execute('SELECT 1');
    log('info', '✓ Database connected');
  } catch (error) {
    log('error', '✗ Database connection failed', { error: error.message });
  }

  try {
    const r2 = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
    await r2.send(new HeadBucketCommand({ Bucket: process.env.R2_BUCKET_NAME }));
    log('info', '✓ R2 bucket connected');
  } catch (error) {
    log('error', '✗ R2 bucket connection failed', { error: error.message });
  }
}

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

// Render health check — must respond 200 without auth or external deps
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    log('info', 'request', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      ms: Date.now() - start,
    });
  });
  next();
});

// ─── Serialization helpers ──────────────────────────────────────────────────

// tags arrives as an array from the admin UI; store as JSON text for the DB.
// Entries can be plain strings or { name, url } objects (custom tag links).
function serializeTags(tags) {
  if (!tags) return null;
  const list = Array.isArray(tags) ? tags : String(tags).split(',');
  const clean = list
    .map((t) => {
      if (typeof t === 'string') return t.trim();
      if (t && typeof t === 'object' && t.name) {
        const entry = { name: String(t.name).trim().toLowerCase() };
        if (t.url && String(t.url).trim()) entry.url = String(t.url).trim();
        return entry;
      }
      return null;
    })
    .filter(Boolean)
    .filter((t, i, arr) => arr.findIndex((x) => (x.name || x) === (t.name || t)) === i);
  return clean.length ? JSON.stringify(clean) : null;
}

// media arrives as an array of { url, type: 'image' | 'video' }; store as JSON text
function serializeMedia(media) {
  if (!Array.isArray(media) || media.length === 0) return null;
  return JSON.stringify(media);
}

// ─── Audit log helper ────────────────────────────────────────────────────────

async function auditLog(action, resourceType, resourceId, resourceTitle, detail = '') {
  try {
    await db.execute({
      sql: 'INSERT INTO audit_logs (id, action, resource_type, resource_id, resource_title, detail) VALUES (?, ?, ?, ?, ?, ?)',
      args: [uuidv4(), action, resourceType, resourceId, resourceTitle || '', detail],
    });
  } catch (e) {
    log('error', 'Failed to write audit log', { error: e.message });
  }
}

// ─── Public API Routes ──────────────────────────────────────────────────────

app.get('/api/articles', async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM articles WHERE published = 1 ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/articles/:slug', async (req, res) => {
  try {
    const result = await db.execute({ sql: 'SELECT * FROM articles WHERE slug = ? AND published = 1', args: [req.params.slug] });
    if (!result.rows[0]) return res.status(404).json({ error: 'Article not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Instants linked to an article — the reading experience pulls you into moments.
// Matching rules, in priority order:
//   1. explicit link: instant.link_url mentions the article slug
//   2. keyword match: any of the article's tags (case-insensitive, >2 chars) or
//      the slug words appear in the instant's text or link_url
// Public default: published + unexpired only, capped at 12.
app.get('/api/articles/:slug/instants', async (req, res) => {
  try {
    const artRes = await db.execute({
      sql: 'SELECT slug, tags FROM articles WHERE slug = ? AND published = 1',
      args: [req.params.slug],
    });
    const article = artRes.rows[0];
    if (!article) return res.status(404).json({ error: 'Article not found' });

    const result = await db.execute({
      sql: `SELECT * FROM instants
            WHERE published = 1
              AND (expires_at IS NULL OR expires_at > ?)
            ORDER BY created_at DESC, rowid DESC LIMIT 100`,
      args: [new Date().toISOString()],
    });

    const slugLower = article.slug.toLowerCase();
    let tags = [];
    try {
      const parsed = JSON.parse(article.tags || '[]');
      if (Array.isArray(parsed)) tags = parsed.map((t) => String(t?.name || t).toLowerCase()).filter(Boolean);
    } catch {
      // tags stored as comma text — fall through with just the slug
    }

    // Score each instant: explicit link match outranks keyword matches.
    const scored = [];
    for (const row of result.rows) {
      const link = (row.link_url || '').toLowerCase();
      const text = (row.text || '').toLowerCase();
      const linkedExplicitly = link.includes(slugLower);
      const keywordHit = tags.some((t) => t.length > 2 && (text.includes(t) || link.includes(t))) ||
        (slugLower.length > 3 && (text.includes(slugLower.replace(/-/g, ' ')) || text.includes(slugLower)));
      if (linkedExplicitly || keywordHit) {
        scored.push({ ...row, match_weight: linkedExplicitly ? 2 : 1 });
      }
    }
    scored.sort((a, b) => b.match_weight - a.match_weight || (b.created_at || '').localeCompare(a.created_at || ''));
    res.json(scored.slice(0, 12));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/gallery', async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM gallery ORDER BY date DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/social-links', async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM social_links ORDER BY order_index');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/hot-takes', async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM hot_takes WHERE published = 1 ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Comments (Public read, public write) ───────────────────────────────────

app.get('/api/articles/:id/comments', async (req, res) => {
  try {
    const result = await db.execute({
      sql: 'SELECT * FROM comments WHERE post_id = ? ORDER BY created_at ASC',
      args: [req.params.id],
    });
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/articles/:id/comments', async (req, res) => {
  const { author_name, author_email, content } = req.body;
  if (!author_name?.trim() || !content?.trim()) {
    return res.status(400).json({ error: 'Name and content are required' });
  }
  try {
    const id = uuidv4();
    await db.execute({
      sql: 'INSERT INTO comments (id, post_id, author_name, author_email, content) VALUES (?, ?, ?, ?, ?)',
      args: [id, req.params.id, author_name.trim(), author_email?.trim() || null, content.trim()],
    });
    const result = await db.execute({ sql: 'SELECT * FROM comments WHERE id = ?', args: [id] });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Likes (Public) ─────────────────────────────────────────────────────────

app.get('/api/articles/:id/likes', async (req, res) => {
  try {
    const result = await db.execute({
      sql: 'SELECT COUNT(*) as count FROM likes WHERE post_id = ?',
      args: [req.params.id],
    });
    res.json({ count: result.rows[0].count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/articles/:id/likes', async (req, res) => {
  const { user_identifier } = req.body;
  if (!user_identifier) return res.status(400).json({ error: 'user_identifier required' });
  try {
    const existing = await db.execute({
      sql: 'SELECT id FROM likes WHERE post_id = ? AND user_identifier = ?',
      args: [req.params.id, user_identifier],
    });
    if (existing.rows[0]) {
      // Unlike
      await db.execute({ sql: 'DELETE FROM likes WHERE id = ?', args: [existing.rows[0].id] });
      const count = await db.execute({ sql: 'SELECT COUNT(*) as count FROM likes WHERE post_id = ?', args: [req.params.id] });
      return res.json({ liked: false, count: count.rows[0].count });
    }
    // Like
    const id = uuidv4();
    await db.execute({
      sql: 'INSERT INTO likes (id, post_id, user_identifier) VALUES (?, ?, ?)',
      args: [id, req.params.id, user_identifier],
    });
    const count = await db.execute({ sql: 'SELECT COUNT(*) as count FROM likes WHERE post_id = ?', args: [req.params.id] });
    res.json({ liked: true, count: count.rows[0].count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Auth Routes ─────────────────────────────────────────────────────────────

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await db.execute({ sql: 'SELECT * FROM admin_users WHERE username = ?', args: [username] });
    const user = result.rows[0];
    if (!user || !await bcrypt.compare(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = generateToken(user);
    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Admin Routes (Protected) ────────────────────────────────────────────────

app.get('/api/admin/articles', authenticateToken, async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM articles ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/articles', authenticateToken, async (req, res) => {
  const { title, slug, content, excerpt, category, published, image_url, tags, show_toc } = req.body;
  const id = uuidv4();
  try {
    await db.execute({
      sql: 'INSERT INTO articles (id, title, slug, content, excerpt, category, published, image_url, tags, show_toc) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: [id, title, slug, content, excerpt, category, published ? 1 : 0, image_url || null, serializeTags(tags), show_toc ? 1 : 0],
    });
    const result = await db.execute({ sql: 'SELECT * FROM articles WHERE id = ?', args: [id] });
    await auditLog('CREATE', 'article', id, title);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/admin/articles/:id', authenticateToken, async (req, res) => {
  const { title, slug, content, excerpt, category, published, image_url, tags, show_toc } = req.body;
  try {
    await db.execute({
      sql: 'UPDATE articles SET title = ?, slug = ?, content = ?, excerpt = ?, category = ?, published = ?, image_url = ?, tags = ?, show_toc = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      args: [title, slug, content, excerpt, category, published ? 1 : 0, image_url || null, serializeTags(tags), show_toc ? 1 : 0, req.params.id],
    });
    const result = await db.execute({ sql: 'SELECT * FROM articles WHERE id = ?', args: [req.params.id] });
    await auditLog('UPDATE', 'article', req.params.id, title, published ? 'published' : 'draft');
    res.json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/admin/articles/:id', authenticateToken, async (req, res) => {
  try {
    const existing = await db.execute({ sql: 'SELECT title FROM articles WHERE id = ?', args: [req.params.id] });
    await db.execute({ sql: 'DELETE FROM articles WHERE id = ?', args: [req.params.id] });
    await auditLog('DELETE', 'article', req.params.id, existing.rows[0]?.title || req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Admin: Comments moderation ──────────────────────────────────────────────

app.delete('/api/admin/comments/:id', authenticateToken, async (req, res) => {
  try {
    await db.execute({ sql: 'DELETE FROM comments WHERE id = ?', args: [req.params.id] });
    await auditLog('DELETE', 'comment', req.params.id, req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Hot Takes Management ──────────────────────────────────────────────────

app.get('/api/admin/hot-takes', authenticateToken, async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM hot_takes ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/hot-takes', authenticateToken, async (req, res) => {
  const { take, article_slug, published } = req.body;
  if (!take?.trim()) return res.status(400).json({ error: 'Take text is required' });
  const id = uuidv4();
  try {
    await db.execute({
      sql: 'INSERT INTO hot_takes (id, take, article_slug, published) VALUES (?, ?, ?, ?)',
      args: [id, take.trim(), article_slug || null, published === false ? 0 : 1],
    });
    const result = await db.execute({ sql: 'SELECT * FROM hot_takes WHERE id = ?', args: [id] });
    await auditLog('CREATE', 'hot_take', id, take.trim().slice(0, 60));
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/hot-takes/:id', authenticateToken, async (req, res) => {
  const { take, article_slug, published } = req.body;
  try {
    await db.execute({
      sql: 'UPDATE hot_takes SET take = ?, article_slug = ?, published = ? WHERE id = ?',
      args: [take, article_slug || null, published ? 1 : 0, req.params.id],
    });
    const result = await db.execute({ sql: 'SELECT * FROM hot_takes WHERE id = ?', args: [req.params.id] });
    await auditLog('UPDATE', 'hot_take', req.params.id, (take || '').slice(0, 60));
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/admin/hot-takes/:id', authenticateToken, async (req, res) => {
  try {
    await db.execute({ sql: 'DELETE FROM hot_takes WHERE id = ?', args: [req.params.id] });
    await auditLog('DELETE', 'hot_take', req.params.id, req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Feature Flags (staged rollout switches) ────────────────────────────────
//
// Every optional feature on the public site is gated by a row in site_flags.
// Three states:
//   off    → hidden from everyone
//   canary → visible to the admin only (plus visitors using ?new-ui=1)
//   on     → visible to everyone
//
// Flip switches from the admin panel (Admin → Flags). No redeploy needed.

const KNOWN_FLAGS = ['instants_widget', 'instants_gallery_film', 'instants_home_section', 'instants_reactions', 'instants_capture', 'instants_crosslink'];

// Shared expiry durations — used by admin POST/PUT and the capture endpoint.
const DURATIONS = { '4h': 4 * 3600e3, '24h': 24 * 3600e3, '7d': 7 * 86400e3, never: null };

async function getFlagStates() {
  const result = await db.execute('SELECT key, state FROM site_flags');
  const states = {};
  for (const row of result.rows) states[row.key] = row.state;
  return states;
}

// Public — returns 'on' | 'canary' | 'off' per flag. 'canary' is not sensitive
// (the admin panel itself decides who counts as the admin client-side via the
// auth token; public visitors just see 'canary' and treat it as off, unless
// they opt in with ?new-ui=1 — that's the "try the new version" preview).
app.get('/api/flags', async (req, res) => {
  try {
    const states = await getFlagStates();
    const out = {};
    for (const key of KNOWN_FLAGS) out[key] = states[key] || 'off';
    // no-store: a client must never see yesterday's rollout state from cache
    res.set('Cache-Control', 'no-store');
    res.json(out);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin — list flags
app.get('/api/admin/flags', authenticateToken, async (req, res) => {
  try {
    const states = await getFlagStates();
    res.set('Cache-Control', 'no-store');
    res.json(KNOWN_FLAGS.map((key) => ({ key, state: states[key] || 'off' })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin — update one flag
app.put('/api/admin/flags/:key', authenticateToken, async (req, res) => {
  const { key } = req.params;
  const { state } = req.body;
  if (!KNOWN_FLAGS.includes(key)) return res.status(404).json({ error: 'Unknown flag' });
  if (!['off', 'canary', 'on'].includes(state)) return res.status(400).json({ error: 'state must be off | canary | on' });
  try {
    await db.execute({
      sql: `INSERT INTO site_flags (key, state, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT (key) DO UPDATE SET state = excluded.state, updated_at = CURRENT_TIMESTAMP`,
      args: [key, state],
    });
    await auditLog('UPDATE', 'flag', key, `${key} → ${state}`);
    res.json({ key, state });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Instants (Locket-style realtime captures) ─────────────────────────────

// SSE clients — one entry per open connection
const sseClients = new Set();
function broadcastInstants(event, payload) {
  const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of sseClients) {
    try { res.write(data); } catch { /* client gone; cleanup on close */ }
  }
}

// Public SSE stream — new/updated instants push to every open page instantly
app.get('/api/instants/stream', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders();
  res.write('event: connected\ndata: {}\n\n');
  sseClients.add(res);
  const keepAlive = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { /* noop */ }
  }, 25000);
  req.on('close', () => {
    clearInterval(keepAlive);
    sseClients.delete(res);
  });
});

// Public list (published, not expired, newest first)
app.get('/api/instants', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const result = await db.execute({
      sql: `SELECT * FROM instants
            WHERE published = 1
              AND (expires_at IS NULL OR expires_at > ?)
            ORDER BY created_at DESC, rowid DESC LIMIT ?`,
      args: [new Date().toISOString(), limit],
    });
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Recap — every published instant ever (the public archive, grouped client-side by month)
app.get('/api/instants/recap', async (req, res) => {
  try {
    const result = await db.execute({
      sql: 'SELECT * FROM instants WHERE published = 1 ORDER BY created_at DESC, rowid DESC LIMIT 500',
    });
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin list (everything — including expired, for the private archive)
app.get('/api/admin/instants', authenticateToken, async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM instants ORDER BY created_at DESC, rowid DESC');
    const now = new Date().toISOString();
    const rows = result.rows.map((r) => ({ ...r, expired: !!(r.expires_at && r.expires_at <= now) }));
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin create — broadcasts instantly.
// duration: '4h' | '24h' | '7d' | 'never' (default '24h', Instagram-style)
app.post('/api/admin/instants', authenticateToken, async (req, res) => {
  const { text, image_url, link_url, source, published, duration } = req.body;
  if (!text?.trim() && !image_url) {
    return res.status(400).json({ error: 'An instant needs text or an image' });
  }
  const ttl = DURATIONS[duration] !== undefined ? DURATIONS[duration] : DURATIONS['24h'];
  const expiresAt = ttl ? new Date(Date.now() + ttl).toISOString() : null;
  const id = uuidv4();
  try {
    await db.execute({
      sql: 'INSERT INTO instants (id, text, image_url, link_url, source, published, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [id, text?.trim() || null, image_url || null, link_url || null, source || null, published === false ? 0 : 1, expiresAt],
    });
    const row = (await db.execute({ sql: 'SELECT * FROM instants WHERE id = ?', args: [id] })).rows[0];
    await auditLog('CREATE', 'instant', id, (text || 'image').slice(0, 50));
    if (row.published) broadcastInstants('instant:new', row);
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin update — broadcast the change
app.put('/api/admin/instants/:id', authenticateToken, async (req, res) => {
  const { text, image_url, link_url, source, published, duration } = req.body;
  try {
    const existing = (await db.execute({ sql: 'SELECT * FROM instants WHERE id = ?', args: [req.params.id] })).rows[0];
    if (!existing) return res.status(404).json({ error: 'Instant not found' });
    // Only recompute expiry when a new duration is explicitly sent
    let expiresAt = existing.expires_at;
    if (duration !== undefined) {
      const ttl = DURATIONS[duration] !== undefined ? DURATIONS[duration] : DURATIONS['24h'];
      expiresAt = ttl ? new Date(Date.now() + ttl).toISOString() : null;
    }
    await db.execute({
      sql: 'UPDATE instants SET text = ?, image_url = ?, link_url = ?, source = ?, published = ?, expires_at = ? WHERE id = ?',
      args: [text?.trim() || null, image_url || null, link_url || null, source || null, published ? 1 : 0, expiresAt, req.params.id],
    });
    const row = (await db.execute({ sql: 'SELECT * FROM instants WHERE id = ?', args: [req.params.id] })).rows[0];
    await auditLog('UPDATE', 'instant', row.id, (row.text || 'image').slice(0, 50));
    broadcastInstants(row.published ? 'instant:update' : 'instant:remove', row);
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/admin/instants/:id', authenticateToken, async (req, res) => {
  try {
    await db.execute({ sql: 'DELETE FROM instants WHERE id = ?', args: [req.params.id] });
    await db.execute({ sql: 'DELETE FROM instant_thoughts WHERE instant_id = ?', args: [req.params.id] });
    await db.execute({ sql: 'DELETE FROM instant_reactions WHERE instant_id = ?', args: [req.params.id] });
    await auditLog('DELETE', 'instant', req.params.id, req.params.id);
    broadcastInstants('instant:remove', { id: req.params.id });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Moderation — remove a single note (free notes mean occasional cleanup)
app.delete('/api/admin/instants/:id/thoughts/:thoughtId', authenticateToken, async (req, res) => {
  try {
    await db.execute({ sql: 'DELETE FROM instant_thoughts WHERE id = ? AND instant_id = ?', args: [req.params.thoughtId, req.params.id] });
    await auditLog('DELETE', 'thought', req.params.thoughtId, req.params.id);
    broadcastInstants('thought:remove', { instantId: req.params.id, thoughtId: req.params.thoughtId });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Moderation — list notes across all instants (newest first), joined with
// instant context so the admin UI shows what each note sits on.
app.get('/api/admin/notes', authenticateToken, async (req, res) => {
  try {
    const result = await db.execute({
      sql: `SELECT t.*, i.text AS instant_text, i.image_url AS instant_image
            FROM instant_thoughts t
            LEFT JOIN instants i ON i.id = t.instant_id
            ORDER BY t.created_at DESC LIMIT 500`,
    });
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Capture — camera-first posting straight from the public widget, same auth
// shape as admin (the widget checks adminToken). Accepts a data URL (camera
// frame or picked file compressed client-side) and stores via R2.
app.post('/api/instants/capture', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const text = (req.body?.text || '').trim() || null;
    const duration = req.body?.duration || '24h';
    const ttl = DURATIONS[duration] !== undefined ? DURATIONS[duration] : DURATIONS['24h'];
    let imageUrl = null;
    if (req.file) {
      if (req.file.size > 8 * 1024 * 1024) return res.status(400).json({ error: 'Image too large (8MB max)' });
      if (!/^image\//.test(req.file.mimetype)) return res.status(400).json({ error: 'Only images' });
      imageUrl = await uploadFile(`instants/${uuidv4()}`, req.file.buffer, req.file.mimetype);
    }
    if (!imageUrl && !text) return res.status(400).json({ error: 'Nothing to post' });
    const id = uuidv4();
    const expiresAt = ttl ? new Date(Date.now() + ttl).toISOString() : null;
    await db.execute({
      sql: 'INSERT INTO instants (id, text, image_url, link_url, source, published, expires_at) VALUES (?, ?, ?, NULL, ?, 1, ?)',
      args: [id, text, imageUrl, 'capture', expiresAt],
    });
    const row = (await db.execute({ sql: 'SELECT * FROM instants WHERE id = ?', args: [id] })).rows[0];
    await auditLog('CREATE', 'instant-capture', id, (text || 'photo').slice(0, 50));
    broadcastInstants('instant:new', row);
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reaction rollup per instant — the creator reciprocity loop.
app.get('/api/admin/reaction-summary', authenticateToken, async (req, res) => {
  try {
    const result = await db.execute({
      sql: 'SELECT instant_id, emoji, COUNT(*) as count FROM instant_reactions GROUP BY instant_id, emoji',
    });
    const out = {};
    for (const r of result.rows) {
      (out[r.instant_id] ||= []).push({ emoji: r.emoji, count: Number(r.count) });
    }
    res.json(out);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Thoughts → free notes. No email, no name, no waitlist: anyone can leave a
// note and it goes live instantly. Moderation = admin delete (audit-logged).
// Light per-visitor rate limit keeps drive-by spam tolerable between deletes.
const noteBuckets = new Map(); // visitorId -> timestamps[]
function noteRateOk(visitorId) {
  const now = Date.now();
  const stamps = (noteBuckets.get(visitorId) || []).filter((t) => now - t < 60_000);
  if (stamps.length >= 8) return false;
  stamps.push(now);
  noteBuckets.set(visitorId, stamps);
  return true;
}

app.get('/api/instants/:id/thoughts', async (req, res) => {
  try {
    const result = await db.execute({
      sql: 'SELECT * FROM instant_thoughts WHERE instant_id = ? ORDER BY created_at ASC',
      args: [req.params.id],
    });
    res.set('Cache-Control', 'no-store');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/instants/:id/thoughts', async (req, res) => {
  const { body, visitor_id } = req.body;
  if (!body?.trim()) {
    return res.status(400).json({ error: 'Write something first' });
  }
  if (body.length > 1200) {
    return res.status(400).json({ error: 'That is a whole article — keep it a note (max 1200 chars)' });
  }
  const visitor = visitor_id?.trim() || 'anon';
  if (!noteRateOk(visitor)) {
    return res.status(429).json({ error: 'Easy there — try again in a minute' });
  }
  try {
    const instant = await db.execute({
      sql: 'SELECT id FROM instants WHERE id = ? AND published = 1',
      args: [req.params.id],
    });
    if (!instant.rows.length) return res.status(404).json({ error: 'Instant not found' });

    const author = (await db.execute({
      sql: 'SELECT username FROM admin_users LIMIT 1',
    })).rows[0]?.username || 'the blog';
    // Approved emails from the old waitlist can still sign their notes;
    // everyone else is "someone" (IG-instants vibes: content over identity).
    let authorName = null;
    if (visitor.startsWith('wl:')) {
      const wl = await db.execute({
        sql: "SELECT name, email FROM waitlist WHERE email = ? AND status = 'approved'",
        args: [visitor.slice(3).toLowerCase()],
      });
      authorName = wl.rows[0]?.name || wl.rows[0]?.email?.split('@')[0] || null;
    }

    const id = uuidv4();
    await db.execute({
      sql: 'INSERT INTO instant_thoughts (id, instant_id, author_name, body, approved) VALUES (?, ?, ?, ?, 1)',
      args: [id, req.params.id, authorName || 'someone', body.trim()],
    });
    const row = (await db.execute({ sql: 'SELECT * FROM instant_thoughts WHERE id = ?', args: [id] })).rows[0];
    broadcastInstants('thought:new', { instantId: req.params.id, thought: row });
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Reactions (IG-instants emoji row) ──────────────────────────────────────
// Anonymous: visitor_id is a random browser id, never an identity. One row per
// (instant, emoji, visitor) — reacting again removes (IG toggle behavior).

app.get('/api/instants/:id/reactions', async (req, res) => {
  try {
    const result = await db.execute({
      sql: 'SELECT emoji, COUNT(*) as count FROM instant_reactions WHERE instant_id = ? GROUP BY emoji',
      args: [req.params.id],
    });
    const visitor = req.query.visitor_id?.trim();
    let mine = [];
    if (visitor) {
      const m = await db.execute({
        sql: 'SELECT emoji FROM instant_reactions WHERE instant_id = ? AND visitor_id = ?',
        args: [req.params.id, visitor],
      });
      mine = m.rows.map((r) => r.emoji);
    }
    res.set('Cache-Control', 'no-store');
    res.json({ counts: result.rows, mine });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/instants/:id/reactions', async (req, res) => {
  const { emoji, visitor_id } = req.body;
  if (!emoji || typeof emoji !== 'string' || emoji.length > 8) {
    return res.status(400).json({ error: 'Bad emoji' });
  }
  if (!visitor_id?.trim()) return res.status(400).json({ error: 'Missing visitor id' });
  try {
    const instant = await db.execute({
      sql: 'SELECT id FROM instants WHERE id = ?',
      args: [req.params.id],
    });
    if (!instant.rows.length) return res.status(404).json({ error: 'Instant not found' });

    const existing = await db.execute({
      sql: 'SELECT id FROM instant_reactions WHERE instant_id = ? AND emoji = ? AND visitor_id = ?',
      args: [req.params.id, emoji, visitor_id.trim()],
    });
    let reacted;
    if (existing.rows.length) {
      await db.execute({ sql: 'DELETE FROM instant_reactions WHERE id = ?', args: [existing.rows[0].id] });
      reacted = false;
    } else {
      const count = await db.execute({
        sql: 'SELECT COUNT(*) as count FROM instant_reactions WHERE instant_id = ? AND visitor_id = ?',
        args: [req.params.id, visitor_id.trim()],
      });
      if (Number(count.rows[0].count) >= 6) {
        return res.status(400).json({ error: 'Max 6 different reactions per person' });
      }
      await db.execute({
        sql: 'INSERT INTO instant_reactions (id, instant_id, emoji, visitor_id) VALUES (?, ?, ?, ?)',
        args: [uuidv4(), req.params.id, emoji, visitor_id.trim()],
      });
      reacted = true;
    }
    const counts = await db.execute({
      sql: 'SELECT emoji, COUNT(*) as count FROM instant_reactions WHERE instant_id = ? GROUP BY emoji',
      args: [req.params.id],
    });
    res.json({ reacted, counts: counts.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Waitlist management
app.post('/api/waitlist', async (req, res) => {
  const { email, name } = req.body;
  if (!email?.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
    return res.status(400).json({ error: 'A valid email is required' });
  }
  try {
    const id = uuidv4();
    await db.execute({
      sql: 'INSERT INTO waitlist (id, email, name, status) VALUES (?, ?, ?, ?) ON CONFLICT(email) DO NOTHING',
      args: [id, email.trim().toLowerCase(), name?.trim() || null, 'pending'],
    });
    res.json({ success: true, message: "You're on the list!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/waitlist', authenticateToken, async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM waitlist ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/waitlist/:id', authenticateToken, async (req, res) => {
  const { status } = req.body;
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  try {
    await db.execute({ sql: 'UPDATE waitlist SET status = ? WHERE id = ?', args: [status, req.params.id] });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/admin/waitlist/:id', authenticateToken, async (req, res) => {
  try {
    await db.execute({ sql: 'DELETE FROM waitlist WHERE id = ?', args: [req.params.id] });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── File Upload ─────────────────────────────────────────────────────────────

app.post('/api/admin/upload', authenticateToken, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const ext = req.file.originalname.split('.').pop();
    const key = `${Date.now()}-${uuidv4().slice(0, 8)}.${ext}`;
    const url = await uploadFile(key, req.file.buffer, req.file.mimetype);
    res.json({ url, key });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Gallery Management ───────────────────────────────────────────────────────

app.post('/api/admin/gallery', authenticateToken, async (req, res) => {
  const { title, description, type, image_url, media, date } = req.body;
  const id = uuidv4();
  try {
    await db.execute({
      sql: 'INSERT INTO gallery (id, title, description, type, image_url, media, date) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [id, title, description, type, image_url, serializeMedia(media), date],
    });
    const result = await db.execute({ sql: 'SELECT * FROM gallery WHERE id = ?', args: [id] });
    await auditLog('CREATE', 'gallery', id, title);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/gallery/:id', authenticateToken, async (req, res) => {
  const { title, description, type, image_url, media, date } = req.body;
  try {
    await db.execute({
      sql: 'UPDATE gallery SET title = ?, description = ?, type = ?, image_url = ?, media = ?, date = ? WHERE id = ?',
      args: [title, description, type, image_url || null, serializeMedia(media), date, req.params.id],
    });
    const result = await db.execute({ sql: 'SELECT * FROM gallery WHERE id = ?', args: [req.params.id] });
    await auditLog('UPDATE', 'gallery', req.params.id, title);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/admin/gallery/:id', authenticateToken, async (req, res) => {
  try {
    const existing = await db.execute({ sql: 'SELECT title FROM gallery WHERE id = ?', args: [req.params.id] });
    await db.execute({ sql: 'DELETE FROM gallery WHERE id = ?', args: [req.params.id] });
    await auditLog('DELETE', 'gallery', req.params.id, existing.rows[0]?.title || req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Social Links Management ─────────────────────────────────────────────────

app.post('/api/admin/social-links', authenticateToken, async (req, res) => {
  const { name, url, icon, order_index } = req.body;
  if (!name || !url) return res.status(400).json({ error: 'Name and URL are required' });
  const id = uuidv4();
  try {
    await db.execute({
      sql: 'INSERT INTO social_links (id, name, url, icon, order_index) VALUES (?, ?, ?, ?, ?)',
      args: [id, name, url, icon || 'default', order_index ?? 0],
    });
    const result = await db.execute({ sql: 'SELECT * FROM social_links WHERE id = ?', args: [id] });
    await auditLog('CREATE', 'social_link', id, name);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/social-links/:id', authenticateToken, async (req, res) => {
  const { name, url, icon, order_index } = req.body;
  try {
    await db.execute({
      sql: 'UPDATE social_links SET name = ?, url = ?, icon = ?, order_index = ? WHERE id = ?',
      args: [name, url, icon || 'default', order_index ?? 0, req.params.id],
    });
    const result = await db.execute({ sql: 'SELECT * FROM social_links WHERE id = ?', args: [req.params.id] });
    await auditLog('UPDATE', 'social_link', req.params.id, name);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/admin/social-links/:id', authenticateToken, async (req, res) => {
  try {
    const existing = await db.execute({ sql: 'SELECT name FROM social_links WHERE id = ?', args: [req.params.id] });
    await db.execute({ sql: 'DELETE FROM social_links WHERE id = ?', args: [req.params.id] });
    await auditLog('DELETE', 'social_link', req.params.id, existing.rows[0]?.name || req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Audit Logs ──────────────────────────────────────────────────────────────

app.get('/api/admin/audit-logs', authenticateToken, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const result = await db.execute({
      sql: 'SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?',
      args: [limit],
    });
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── System Health ───────────────────────────────────────────────────────────

app.get('/api/health', authenticateToken, async (req, res) => {
  const start = Date.now();
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    memory: {
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      system: Math.round(os.totalmem() / 1024 / 1024),
      systemFree: Math.round(os.freemem() / 1024 / 1024),
    },
    database: { status: 'unknown', latencyMs: null },
    storage: { status: 'unknown', latencyMs: null },
    r2PublicUrl: process.env.R2_PUBLIC_URL || null,
    r2PublicUrlConfigured: !!(process.env.R2_PUBLIC_URL && process.env.R2_PUBLIC_URL.startsWith('http')),
  };

  // DB check
  try {
    const dbStart = Date.now();
    await db.execute('SELECT 1');
    health.database = { status: 'ok', latencyMs: Date.now() - dbStart };
  } catch (e) {
    health.database = { status: 'error', error: e.message };
    health.status = 'degraded';
  }

  // R2 check
  try {
    const r2Start = Date.now();
    const r2 = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
    await r2.send(new HeadBucketCommand({ Bucket: process.env.R2_BUCKET_NAME }));
    health.storage = { status: 'ok', latencyMs: Date.now() - r2Start };
  } catch (e) {
    health.storage = { status: 'error', error: e.message };
    health.status = 'degraded';
  }

  health.responseTimeMs = Date.now() - start;
  res.json(health);
});

// ─── Setup ───────────────────────────────────────────────────────────────────

app.post('/api/setup', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await db.execute({ sql: 'SELECT * FROM admin_users WHERE username = ?', args: [username] });
    if (result.rows[0]) return res.status(400).json({ error: 'User already exists' });
    const passwordHash = await bcrypt.hash(password, 10);
    const id = uuidv4();
    await db.execute({
      sql: 'INSERT INTO admin_users (id, username, password_hash) VALUES (?, ?, ?)',
      args: [id, username, passwordHash],
    });
    res.json({ message: 'Admin user created' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  log('info', 'Server listening', { port: PORT, pid: process.pid });
  checkConnections();
});

// Keep-alive cron job
cron.schedule('*/10 * * * *', async () => {
  try {
    const url = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
    await fetch(`${url}/api/articles`);
    log('info', 'Keep-alive ping sent', { url });
  } catch (error) {
    log('error', 'Keep-alive ping failed', { error: error.message });
  }
});
 
