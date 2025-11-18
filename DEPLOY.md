# PocketBase Backend Deployment on Railway

## Quick Setup (5 minutes)

### 1. Deploy to Railway

1. Go to [Railway.app](https://railway.app) and sign up/login
2. Click "Deploy from GitHub repo"
3. Connect your GitHub account and select this repository
4. Choose "Deploy from subfolder" and enter: `backend`
5. Railway will automatically detect the Dockerfile and deploy

### 2. Configure Environment (optional)

In Railway dashboard:
- Go to Variables tab
- Add environment variables if needed (see backend/.env.example)
- Default setup works without any environment variables

### 3. Get Your Backend URL

- After deployment, Railway will provide a URL like: `https://your-app-name.railway.app`
- This is your POCKETBASE_URL for the frontend

### 4. Update Frontend Configuration

Edit `auth.js` and replace the development URL:

```javascript
// Replace this line:
this.pb = new PocketBase('http://localhost:8090');

// With your Railway URL:
this.pb = new PocketBase('https://your-app-name.railway.app');
```

### 5. Access Admin Panel

- Go to `https://your-app-name.railway.app/_/`
- Create admin account on first visit
- Import schema if needed (should be automatic)

## Cost

- Railway free tier: $0/month (with limitations)
- Hobby plan: $5/month (recommended)
- Includes hosting + database + file storage

## Features Included

- ✅ User authentication
- ✅ Data persistence 
- ✅ File uploads (bank statements)
- ✅ Real-time sync
- ✅ Automatic categorization
- ✅ Mobile optimized
- ✅ Offline fallback

## Database Schema

The backend includes these collections:
- `users` - User accounts
- `categories` - Expense categories
- `category_rules` - Auto-categorization rules  
- `transactions` - Bank transactions
- `file_uploads` - Uploaded bank statements

All data is isolated per user with Row Level Security.

## Development vs Production

**Development (localStorage):**
- Works offline
- Data stays on device
- No backend needed

**Production (PocketBase):**
- Cloud sync across devices
- Shared family budgets
- File uploads
- Real-time updates
- Data backup

The app automatically detects if PocketBase is available and falls back to localStorage if needed.