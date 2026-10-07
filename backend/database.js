import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'libsql://blogdb-isodevmate.aws-us-east-1.turso.io',
  authToken: process.env.TURSO_AUTH_TOKEN
});

// Initialize tables only if auth token exists
if (process.env.TURSO_AUTH_TOKEN) {
  await db.batch([
    `CREATE TABLE IF NOT EXISTS articles (
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
    )`,
    `CREATE TABLE IF NOT EXISTS gallery (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      type TEXT,
      image_url TEXT NOT NULL,
      date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS social_links (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      icon TEXT,
      order_index INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS admin_users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      author_email TEXT,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS likes (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      user_identifier TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(post_id, user_identifier)
    )`,
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      resource_type TEXT,
      resource_id TEXT,
      resource_title TEXT,
      detail TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS hot_takes (
      id TEXT PRIMARY KEY,
      take TEXT NOT NULL,
      article_slug TEXT,
      published INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
  ], 'write');

  // Column migrations — ALTER TABLE errors if the column already exists, so ignore those.
  const columnMigrations = [
    'ALTER TABLE articles ADD COLUMN tags TEXT',
    'ALTER TABLE articles ADD COLUMN show_toc INTEGER DEFAULT 1',
    'ALTER TABLE gallery ADD COLUMN media TEXT',
  ];
  for (const sql of columnMigrations) {
    try {
      await db.execute(sql);
      console.log('Migration applied:', sql);
    } catch (e) {
      if (!String(e.message).toLowerCase().includes('duplicate column')) {
        console.error('Migration failed:', sql, e.message);
      }
    }
  }
}

export default db;
