import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import db from './database.js';
import { uploadFile, deleteFile } from './storage.js';
import { authenticateToken, generateToken } from './auth.js';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

// Public API Routes
app.get('/api/articles', (req, res) => {
  const articles = db.prepare('SELECT * FROM articles WHERE published = 1 ORDER BY created_at DESC').all();
  res.json(articles);
});

app.get('/api/articles/:slug', (req, res) => {
  const article = db.prepare('SELECT * FROM articles WHERE slug = ? AND published = 1').get(req.params.slug);
  if (!article) return res.status(404).json({ error: 'Article not found' });
  res.json(article);
});

app.get('/api/gallery', (req, res) => {
  const items = db.prepare('SELECT * FROM gallery ORDER BY date DESC').all();
  res.json(items);
});

app.get('/api/social-links', (req, res) => {
  const links = db.prepare('SELECT * FROM social_links ORDER BY order_index').all();
  res.json(links);
});

// Auth Routes
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);
  
  if (!user || !await bcrypt.compare(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const token = generateToken(user);
  res.json({ token, user: { id: user.id, username: user.username } });
});

// Admin Routes (Protected)
app.get('/api/admin/articles', authenticateToken, (req, res) => {
  const articles = db.prepare('SELECT * FROM articles ORDER BY created_at DESC').all();
  res.json(articles);
});

app.post('/api/admin/articles', authenticateToken, (req, res) => {
  const { title, slug, content, excerpt, category, published } = req.body;
  const id = uuidv4();
  
  try {
    const stmt = db.prepare(`
      INSERT INTO articles (id, title, slug, content, excerpt, category, published)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, title, slug, content, excerpt, category, published ? 1 : 0);
    
    const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(id);
    res.json(article);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/admin/articles/:id', authenticateToken, (req, res) => {
  const { title, slug, content, excerpt, category, published } = req.body;
  
  try {
    const stmt = db.prepare(`
      UPDATE articles 
      SET title = ?, slug = ?, content = ?, excerpt = ?, category = ?, published = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(title, slug, content, excerpt, category, published ? 1 : 0, req.params.id);
    
    const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id);
    res.json(article);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/admin/articles/:id', authenticateToken, (req, res) => {
  const stmt = db.prepare('DELETE FROM articles WHERE id = ?');
  stmt.run(req.params.id);
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
app.post('/api/admin/gallery', authenticateToken, (req, res) => {
  const { title, description, type, image_url, date } = req.body;
  const id = uuidv4();
  
  const stmt = db.prepare(`
    INSERT INTO gallery (id, title, description, type, image_url, date)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, title, description, type, image_url, date);
  
  const item = db.prepare('SELECT * FROM gallery WHERE id = ?').get(id);
  res.json(item);
});

app.delete('/api/admin/gallery/:id', authenticateToken, (req, res) => {
  const stmt = db.prepare('DELETE FROM gallery WHERE id = ?');
  stmt.run(req.params.id);
  res.json({ success: true });
});

// Create default admin user (run once)
app.post('/api/setup', async (req, res) => {
  const { username, password } = req.body;
  const existingUser = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);
  
  if (existingUser) {
    return res.status(400).json({ error: 'User already exists' });
  }
  
  const passwordHash = await bcrypt.hash(password, 10);
  const id = uuidv4();
  
  const stmt = db.prepare('INSERT INTO admin_users (id, username, password_hash) VALUES (?, ?, ?)');
  stmt.run(id, username, passwordHash);
  
  res.json({ message: 'Admin user created' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
