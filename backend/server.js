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
