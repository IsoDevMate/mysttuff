# Barack Server Backend

A minimal Node.js backend for your blog with Cloudflare R2 storage and SQLite database.

## Setup

1. **Install dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your Cloudflare R2 credentials
   ```

3. **Create admin user:**
   ```bash
   curl -X POST http://localhost:3001/api/setup \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"your-password"}'
   ```

4. **Start server:**
   ```bash
   npm run dev
   ```

## Cloudflare R2 Setup

1. Create R2 bucket in Cloudflare dashboard
2. Generate API tokens with R2 permissions
3. Set up custom domain for public access (optional)
4. Update .env with your credentials

## API Endpoints

### Public
- `GET /api/articles` - List published articles
- `GET /api/articles/:slug` - Get article by slug
- `GET /api/gallery` - List gallery items
- `GET /api/social-links` - List social links

### Admin (requires auth)
- `POST /api/auth/login` - Login
- `GET /api/admin/articles` - List all articles
- `POST /api/admin/articles` - Create article
- `PUT /api/admin/articles/:id` - Update article
- `DELETE /api/admin/articles/:id` - Delete article
- `POST /api/admin/upload` - Upload file to R2

## Database

SQLite database with tables:
- `articles` - Blog posts
- `gallery` - Gallery items
- `social_links` - Social media links
- `admin_users` - Admin authentication

## Usage

1. Access admin dashboard at `http://localhost:3000/admin`
2. Login with your admin credentials
3. Create and publish articles
4. Upload images via the upload endpoint
5. Articles are automatically available via public API
