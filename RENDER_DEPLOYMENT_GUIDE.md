# Render.com Deployment Guide - Step by Step

This guide will help you deploy your tournament application to Render.com's free tier.

## Prerequisites

- A GitHub account (free)
- Your code pushed to a GitHub repository
- About 15-20 minutes

---

## Step 1: Prepare Your Code for GitHub

### 1.1 Create a GitHub Repository

1. Go to https://github.com
2. Click the **"+"** icon → **"New repository"**
3. Name it: `bedrijventoernooi-app` (or any name you prefer)
4. Make it **Public** (required for free tier) or **Private** (if you have GitHub Pro)
5. Click **"Create repository"**

### 1.2 Push Your Code to GitHub

**If you have Git installed:**

```bash
# Navigate to your project folder
cd "c:\Users\rick_\Documents\Labyellov\Bedrijventoernooi\2026\BedrijventoernooiApplicatie"

# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - Tournament app"

# Add your GitHub repository as remote
git remote add origin https://github.com/YOUR_USERNAME/bedrijventoernooi-app.git

# Push to GitHub
git branch -M main
git push -u origin main
```

**If you don't have Git installed:**

1. Download GitHub Desktop: https://desktop.github.com
2. Install and sign in
3. Click **"File"** → **"Add Local Repository"**
4. Select your project folder
5. Click **"Publish repository"** and choose your GitHub account

---

## Step 2: Sign Up for Render.com

1. Go to https://render.com
2. Click **"Get Started for Free"**
3. Sign up with your **GitHub account** (recommended - easier setup)
4. Authorize Render to access your GitHub repositories

---

## Step 3: Create a New Web Service

1. In Render dashboard, click **"New +"** → **"Web Service"**
2. Connect your GitHub account if prompted
3. Find and select your repository: `bedrijventoernooi-app`
4. Click **"Connect"**

---

## Step 4: Configure Your Service

Fill in the following settings:

### Basic Settings:
- **Name**: `bedrijventoernooi-app` (or any name)
- **Region**: Choose closest to you (e.g., `Frankfurt` for Europe)
- **Branch**: `main` (or `master` if that's your branch)
- **Root Directory**: Leave empty (uses root)
- **Runtime**: `Python 3`
- **Build Command**: 
  ```
  pip install -r requirements.txt
  ```
- **Start Command**: 
  ```
  uvicorn backend.main:app --host 0.0.0.0 --port $PORT
  ```
- **Plan**: Select **"Free"**

### Advanced Settings (Click "Advanced"):

**Environment Variables** - Click "Add Environment Variable" for each:

1. **JWT_SECRET_KEY**
   - Value: Generate a secure key:
     - Windows PowerShell: `python -c "import secrets; print(secrets.token_urlsafe(32))"`
     - Or use: `your-super-secret-random-key-here-change-this`
   - **Important**: Use a long random string!

2. **CORS_ORIGINS**
   - Value: `*` (allows all origins - fine for free tier)
   - Or your Render URL: `https://your-app-name.onrender.com`

3. **DEBUG**
   - Value: `False`

4. **CREATE_DEFAULT_ADMIN**
   - Value: `False`

5. **DATABASE_URL** (Optional - SQLite works fine)
   - Value: `sqlite:///./tournament.db`
   - Or leave default

**Note**: Don't set `DEFAULT_ADMIN_PASSWORD` - we'll create admin user manually.

---

## Step 5: Deploy

1. Scroll down and click **"Create Web Service"**
2. Render will start building your application
3. Wait 3-5 minutes for the first deployment
4. You'll see build logs - watch for any errors

---

## Step 6: Create Admin User

Once deployment is complete:

1. Your app will be available at: `https://your-app-name.onrender.com`
2. Go to: `https://your-app-name.onrender.com/frontend/index.html`
3. You'll need to create an admin user

**Option A: Using Render Shell (Recommended)**

1. In Render dashboard, go to your service
2. Click **"Shell"** tab
3. Run:
   ```bash
   python -m backend.create_admin YOUR_USERNAME YOUR_PASSWORD
   ```
   Example:
   ```bash
   python -m backend.create_admin admin MySecurePassword123!
   ```

**Option B: Using Local Script (If Shell doesn't work)**

1. Download your database file from Render (if possible)
2. Or use a local script to create user and upload DB
3. Or temporarily enable admin creation, create user, then disable

**Option C: Temporary Admin Creation**

1. In Render dashboard → Environment → Add:
   - `CREATE_DEFAULT_ADMIN` = `true`
   - `DEFAULT_ADMIN_USERNAME` = `admin`
   - `DEFAULT_ADMIN_PASSWORD` = `YourSecurePassword`
2. Save changes (triggers redeploy)
3. Once admin is created, remove these variables
4. Redeploy

---

## Step 7: Test Your Deployment

1. Visit: `https://your-app-name.onrender.com/frontend/index.html`
2. Test login with your admin credentials
3. Create a test tournament
4. Share the URL with players

**Player Access:**
- Players can access: `https://your-app-name.onrender.com/frontend/index.html`
- They can view schedules and standings without login
- Only you (admin) can manage tournaments

---

## Important Notes

### Free Tier Limitations:

1. **Spins Down After Inactivity**
   - After 15 minutes of no traffic, the service sleeps
   - First request after sleep takes ~30 seconds to wake up
   - Subsequent requests are fast
   - **Solution**: For tournaments, you can "ping" the site every 10 minutes to keep it awake

2. **750 Hours/Month**
   - Free tier includes 750 hours/month
   - That's enough for ~31 days of continuous uptime
   - More than enough for a tournament!

3. **Database Persistence**
   - SQLite file persists between deployments
   - Data is saved in Render's filesystem
   - **Backup**: Export your database before important tournaments

### Keeping Service Awake (Optional):

Create a simple ping script or use a service like:
- **UptimeRobot** (free): https://uptimerobot.com
- Set it to ping your URL every 10 minutes

---

## Troubleshooting

### Build Fails

**Error: "Module not found"**
- Check `requirements.txt` includes all dependencies
- Make sure Python version is correct (3.8+)

**Error: "Port not found"**
- Make sure start command uses `$PORT` environment variable
- Render sets this automatically

### App Doesn't Load

**404 Errors:**
- Check that static files path is correct: `/frontend/index.html`
- Make sure `frontend` folder is in your repository

**CORS Errors:**
- Set `CORS_ORIGINS` to `*` or your Render URL
- Check browser console for specific errors

### Can't Create Admin User

**Shell Access:**
- Try using Render's Shell feature
- Or use temporary environment variables method

### Database Issues

**SQLite Lock Errors:**
- SQLite works fine for your use case (16 teams, ~100 users)
- If you need more, consider PostgreSQL (free tier available)

---

## Updating Your App

1. Make changes locally
2. Commit and push to GitHub:
   ```bash
   git add .
   git commit -m "Your changes"
   git push
   ```
3. Render automatically detects changes and redeploys
4. Wait 2-3 minutes for new deployment

---

## Security Checklist

- ✅ Set strong `JWT_SECRET_KEY`
- ✅ Set `DEBUG=False`
- ✅ Set `CREATE_DEFAULT_ADMIN=False`
- ✅ Use strong admin password
- ✅ HTTPS is automatic (Render provides SSL)
- ✅ Consider setting `CORS_ORIGINS` to your specific domain

---

## Cost

**Free Tier Includes:**
- 750 hours/month (enough for continuous uptime)
- 512 MB RAM
- 0.1 CPU
- SSL certificate (HTTPS)
- Automatic deployments

**Upgrade Options** (if needed):
- Starter Plan: $7/month - Always on, no spin-down
- Professional: $25/month - More resources

For your use case (one tournament), free tier is perfect!

---

## Quick Reference

**Your App URL:**
```
https://your-app-name.onrender.com/frontend/index.html
```

**Admin Login:**
```
https://your-app-name.onrender.com/frontend/login.html
```

**API Base:**
```
https://your-app-name.onrender.com
```

---

## Need Help?

- Render Docs: https://render.com/docs
- Render Support: support@render.com
- Check build logs in Render dashboard for errors

Good luck with your tournament! 🏐
