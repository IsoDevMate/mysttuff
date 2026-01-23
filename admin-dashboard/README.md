# Barack Blog Admin Dashboard

A dedicated React admin dashboard for managing your blog content with a rich writing experience.

## Features

- **Rich Article Editor** with live Markdown preview
- **Image Upload** with drag & drop to Cloudflare R2
- **Category Management** and article organization
- **Draft/Publish** workflow
- **Responsive Design** for desktop and mobile
- **Secure Authentication** with JWT tokens

## Setup

1. **Install dependencies:**
   ```bash
   cd admin-dashboard
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env if your backend runs on different port
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

4. **Access dashboard:**
   - Open http://localhost:3002
   - Login with your admin credentials

## Features Overview

### Article Editor
- Split-screen Markdown editor with live preview
- Syntax highlighting for code blocks
- Auto-generated slugs from titles
- Category selection and publishing controls
- Image upload integration

### Image Management
- Drag & drop image upload
- Automatic Cloudflare R2 integration
- One-click Markdown insertion
- Image preview and management

### Article Management
- List all articles with status indicators
- Filter by published/draft status
- Quick edit and delete actions
- View published articles directly

## Deployment

Build for production:
```bash
npm run build
```

Deploy the `dist` folder to your preferred hosting service (Vercel, Netlify, etc.)

## Security

- JWT-based authentication
- Separate from public blog frontend
- Can be hosted on different domain/subdomain
- Environment-based API configuration
