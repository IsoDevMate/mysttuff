import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import cron from 'node-cron';
import db from './database.js';
import { uploadFile, deleteFile } from './storage.js';
import { authenticateToken, generateToken } from './auth.js';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

// Public API Routes
app.get('/api/articles', async (req, res) => {
  const result = await db.execute('SELECT * FROM articles WHERE published = 1 ORDER BY created_at DESC');
  res.json(result.rows);
});

app.get('/api/articles/:slug', async (req, res) => {
  const result = await db.execute({ sql: 'SELECT * FROM articles WHERE slug = ? AND published = 1', args: [req.params.slug] });
  if (!result.rows[0]) return res.status(404).json({ error: 'Article not found' });
  res.json(result.rows[0]);
});

app.get('/api/gallery', async (req, res) => {
  const result = await db.execute('SELECT * FROM gallery ORDER BY date DESC');
  res.json(result.rows);
});

app.get('/api/social-links', async (req, res) => {
  const result = await db.execute('SELECT * FROM social_links ORDER BY order_index');
  res.json(result.rows);
});

// Auth Routes
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const result = await db.execute({ sql: 'SELECT * FROM admin_users WHERE username = ?', args: [username] });
  const user = result.rows[0];
  
  if (!user || !await bcrypt.compare(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const token = generateToken(user);
  res.json({ token, user: { id: user.id, username: user.username } });
});

// Admin Routes (Protected)
app.get('/api/admin/articles', authenticateToken, async (req, res) => {
  const result = await db.execute('SELECT * FROM articles ORDER BY created_at DESC');
  res.json(result.rows);
});

app.post('/api/admin/articles', authenticateToken, async (req, res) => {
  const { title, slug, content, excerpt, category, published } = req.body;
  const id = uuidv4();
  
  try {
    await db.execute({
      sql: 'INSERT INTO articles (id, title, slug, content, excerpt, category, published) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [id, title, slug, content, excerpt, category, published ? 1 : 0]
    });
    
    const result = await db.execute({ sql: 'SELECT * FROM articles WHERE id = ?', args: [id] });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/admin/articles/:id', authenticateToken, async (req, res) => {
  const { title, slug, content, excerpt, category, published } = req.body;
  
  try {
    await db.execute({
      sql: 'UPDATE articles SET title = ?, slug = ?, content = ?, excerpt = ?, category = ?, published = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      args: [title, slug, content, excerpt, category, published ? 1 : 0, req.params.id]
    });
    
    const result = await db.execute({ sql: 'SELECT * FROM articles WHERE id = ?', args: [req.params.id] });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/admin/articles/:id', authenticateToken, async (req, res) => {
  await db.execute({ sql: 'DELETE FROM articles WHERE id = ?', args: [req.params.id] });
  res.json({ success: true });
});

// File Upload
app.post('/api/admin/upload', authenticateToken, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  
  try {
    const key = `${Date.now()}-${req.file.originalname}`;
    const url = await uploadFile(key, req.file.buffer, req.file.mimetype);
    res.json({ url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Gallery Management
app.post('/api/admin/gallery', authenticateToken, async (req, res) => {
  const { title, description, type, image_url, date } = req.body;
  const id = uuidv4();
  
  await db.execute({
    sql: 'INSERT INTO gallery (id, title, description, type, image_url, date) VALUES (?, ?, ?, ?, ?, ?)',
    args: [id, title, description, type, image_url, date]
  });
  
  const result = await db.execute({ sql: 'SELECT * FROM gallery WHERE id = ?', args: [id] });
  res.json(result.rows[0]);
});

app.delete('/api/admin/gallery/:id', authenticateToken, async (req, res) => {
  await db.execute({ sql: 'DELETE FROM gallery WHERE id = ?', args: [req.params.id] });
  res.json({ success: true });
});

// Create default admin user (run once)
app.post('/api/setup', async (req, res) => {
  const { username, password } = req.body;
  const result = await db.execute({ sql: 'SELECT * FROM admin_users WHERE username = ?', args: [username] });
  
  if (result.rows[0]) {
    return res.status(400).json({ error: 'User already exists' });
  }
  
  const passwordHash = await bcrypt.hash(password, 10);
  const id = uuidv4();
  
  await db.execute({
    sql: 'INSERT INTO admin_users (id, username, password_hash) VALUES (?, ?, ?)',
    args: [id, username, passwordHash]
  });
  
  res.json({ message: 'Admin user created' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Keep-alive cron job - pings every 10 minutes
cron.schedule('*/10 * * * *', async () => {
  try {
    const url = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
    await fetch(`${url}/api/articles`);
    console.log('Keep-alive ping sent');
  } catch (error) {
    console.error('Keep-alive ping failed:', error.message);
  }
});
