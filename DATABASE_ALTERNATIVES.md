# Database Migration Options (Without Cloudflare D1)

## Option 1: Turso (LibSQL) - Recommended
```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Create database
turso db create blog-db

# Get connection URL
turso db show blog-db

# Create schema
turso db shell blog-db < schema.sql
```

**Pros**: SQLite-compatible, generous free tier, edge replicas
**Cons**: Newer service

## Option 2: PlanetScale (MySQL)
```bash
# Install PlanetScale CLI
brew install planetscale/tap/pscale  # or download from website

# Create database
pscale database create blog-db

# Create branch
pscale branch create blog-db main

# Connect
pscale connect blog-db main --port 3309
```

**Pros**: Mature, branching, good free tier
**Cons**: MySQL syntax (need to adapt queries)

## Option 3: Supabase (PostgreSQL)
```bash
# Create project at supabase.com
# Use SQL editor to run schema
```

**Pros**: Full PostgreSQL, real-time features, good free tier
**Cons**: PostgreSQL syntax (need to adapt queries)

## Option 4: Railway PostgreSQL
```bash
# Create project at railway.app
# Add PostgreSQL service
# Use provided connection string
```

**Pros**: Simple deployment, good for small projects
**Cons**: Limited free tier

## Option 5: Migrate Local SQLite to Production

### Using Litestream (SQLite Replication)
```bash
# Install Litestream
curl -sSfL https://github.com/benbjohnson/litestream/releases/latest/download/litestream-linux-amd64-static.tar.gz | tar -xzf - -C /usr/local/bin

# Configure litestream.yml
replicas:
  - url: s3://your-bucket/db
    access-key-id: $AWS_ACCESS_KEY_ID
    secret-access-key: $AWS_SECRET_ACCESS_KEY

# Start replication
litestream replicate
```

### Using SQLite Cloud
```bash
# Sign up at sqlitecloud.io
# Upload your database
# Use connection string in production
```

## Migration Script (SQLite to Any)
```javascript
// migrate.js
import Database from 'better-sqlite3';
import { Client } from 'pg'; // or mysql2, etc.

const source = new Database('blog.db');
const target = new Client({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  await target.connect();
  
  // Get all articles
  const articles = source.prepare('SELECT * FROM articles').all();
  
  // Insert into target
  for (const article of articles) {
    await target.query(
      'INSERT INTO articles (id, title, slug, content, excerpt, category, published, image_url, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [article.id, article.title, article.slug, article.content, article.excerpt, article.category, article.published, article.image_url, article.created_at, article.updated_at]
    );
  }
  
  console.log(`Migrated ${articles.length} articles`);
  await target.end();
}

migrate().catch(console.error);
```
