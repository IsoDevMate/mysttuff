# Deployment Guide

## 1. Setup Cloudflare D1 Database

```bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Create D1 database
wrangler d1 create blog-db

# Note the database ID from output
```

## 2. Initialize Database Schema

```bash
# Run schema on D1
wrangler d1 execute blog-db --file=./schema.sql
```

## 3. Deploy Backend to Render

1. Push code to GitHub
2. Connect Render to your repo
3. Set environment variables:
   ```
   NODE_ENV=production
   D1_API_TOKEN=your-d1-token
   D1_ACCOUNT_ID=your-account-id
   D1_DATABASE_ID=your-database-id
   R2_ENDPOINT=your-r2-endpoint
   R2_ACCESS_KEY_ID=your-key
   R2_SECRET_ACCESS_KEY=your-secret
   R2_BUCKET_NAME=your-bucket
   R2_PUBLIC_URL=your-public-url
   JWT_SECRET=your-jwt-secret
   ```

## 4. Deploy Frontend to Vercel

1. Push admin-dashboard to GitHub
2. Connect Vercel to your repo
3. Set environment variable:
   ```
   VITE_API_URL=https://your-backend.onrender.com/api
   ```

## 5. Create Admin User

```bash
curl -X POST https://your-backend.onrender.com/api/setup \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-secure-password"}'
```
