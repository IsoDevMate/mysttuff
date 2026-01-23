import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Use D1 in production, SQLite locally
const isDevelopment = process.env.NODE_ENV !== 'production';
let db;

if (isDevelopment) {
  // Local SQLite
  db = new Database(join(__dirname, 'blog.db'));
  
  // Create tables for local development
  db.exec(`
    CREATE TABLE IF NOT EXISTS articles (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      content TEXT NOT NULL,
      excerpt TEXT,
      category TEXT,
      published BOOLEAN DEFAULT 0,
      image_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS gallery (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      type TEXT,
      image_url TEXT NOT NULL,
      date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS social_links (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      icon TEXT,
      order_index INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS admin_users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
} else {
  // Production: Use D1 via HTTP API
  const D1_API_TOKEN = process.env.D1_API_TOKEN;
  const D1_ACCOUNT_ID = process.env.D1_ACCOUNT_ID;
  const D1_DATABASE_ID = process.env.D1_DATABASE_ID;
  
  db = {
    prepare: (sql) => ({
      all: async (params = []) => {
        const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${D1_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${D1_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sql, params }),
        });
        const result = await response.json();
        return result.result[0].results;
      },
      get: async (params = []) => {
        const results = await this.all(params);
        return results[0] || null;
      },
      run: async (params = []) => {
        const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${D1_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${D1_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sql, params }),
        });
        const result = await response.json();
        return result.result[0];
      }
    })
  };
}

export default db;
