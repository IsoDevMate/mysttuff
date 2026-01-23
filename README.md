# Blog Management System

## Local Development
```bash
# Backend
cd backend && npm start

# Frontend  
cd admin-dashboard && npm run dev
```

## Database
- Local: SQLite (blog.db)
- Production: Cloudflare D1

## Environment Variables
```
# Backend (.env)
R2_ENDPOINT=your-r2-endpoint
R2_ACCESS_KEY_ID=your-key
R2_SECRET_ACCESS_KEY=your-secret
R2_BUCKET_NAME=your-bucket
R2_PUBLIC_URL=your-public-url
DATABASE_URL=your-d1-url (production)
```

## Deployment
- Backend: Render/Railway
- Frontend: Vercel/Netlify
- Database: Cloudflare D1
- Storage: Cloudflare R2
