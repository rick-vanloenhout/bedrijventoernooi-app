# Quick Start: Deploy to Render.com (5 Minutes)

## 🚀 Fastest Way to Deploy

### Step 1: Push to GitHub (2 min)
1. Create repo at https://github.com/new
2. Push your code (use GitHub Desktop if needed)

### Step 2: Deploy on Render (3 min)
1. Go to https://render.com → Sign up with GitHub
2. Click **"New +"** → **"Web Service"**
3. Select your repository
4. Use these settings:

**Build Command:**
```
pip install -r requirements.txt
```

**Start Command:**
```
uvicorn backend.main:app --host 0.0.0.0 --port $PORT
```

**Environment Variables:**
- `JWT_SECRET_KEY`: `your-random-secret-key-here` (use a long random string!)
- `CORS_ORIGINS`: `*`
- `DEBUG`: `False`
- `CREATE_DEFAULT_ADMIN`: `False`

5. Click **"Create Web Service"**
6. Wait 3-5 minutes

### Step 3: Create Admin User

Once deployed, use Render Shell:
1. Go to your service → **"Shell"** tab
2. Run:
   ```bash
   python -m backend.create_admin admin YourPassword123!
   ```

### Step 4: Access Your App

Your app will be at:
```
https://your-app-name.onrender.com/frontend/index.html
```

Or just:
```
https://your-app-name.onrender.com
```
(It redirects automatically)

---

## 📝 Full Guide

See `RENDER_DEPLOYMENT_GUIDE.md` for detailed instructions.

---

## ⚠️ Important Notes

1. **Free tier spins down** after 15 min inactivity
   - First request takes ~30 seconds
   - Use UptimeRobot (free) to ping every 10 min

2. **750 hours/month** = enough for continuous uptime

3. **Share URL** with players:
   ```
   https://your-app-name.onrender.com
   ```

---

## 🎯 That's It!

Your tournament app is now live and accessible from anywhere!
