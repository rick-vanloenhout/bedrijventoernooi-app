# Cloud Hosting Guide (Free/Cheap Options)

## Option 1: Render.com (Recommended - Free Tier)

### Steps:

1. **Create GitHub Repository**
   - Push your code to GitHub (make sure `.env` is in `.gitignore`)

2. **Sign up at Render.com**
   - Go to https://render.com
   - Sign up with GitHub

3. **Create New Web Service**
   - Click "New" → "Web Service"
   - Connect your GitHub repository
   - Settings:
     - **Name**: `bedrijventoernooi-app`
     - **Environment**: `Python 3`
     - **Build Command**: `pip install -r requirements.txt`
     - **Start Command**: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
     - **Plan**: Free

4. **Set Environment Variables**
   - Go to "Environment" tab
   - Add:
     - `JWT_SECRET_KEY`: (generate a random secret key)
     - `DATABASE_URL`: `sqlite:///./tournament.db` (or use PostgreSQL)
     - `CORS_ORIGINS`: `*` (or your domain)
     - `DEBUG`: `False`
     - `CREATE_DEFAULT_ADMIN`: `False`

5. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment
   - Your app will be available at: `https://your-app-name.onrender.com`

### Pros:
- ✅ Free tier (750 hours/month)
- ✅ HTTPS included
- ✅ Auto-deploys from GitHub
- ✅ Easy setup

### Cons:
- ⚠️ Free tier spins down after inactivity (takes ~30s to wake up)
- ⚠️ Limited to 750 hours/month

---

## Option 2: Railway.app ($5/month credit)

### Steps:

1. **Sign up at Railway.app**
   - Go to https://railway.app
   - Sign up with GitHub

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository

3. **Configure**
   - Railway auto-detects Python
   - Set start command: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
   - Add environment variables (same as Render)

4. **Deploy**
   - Railway auto-deploys
   - Get your URL: `https://your-app-name.up.railway.app`

### Pros:
- ✅ $5/month free credit
- ✅ No spin-down (always available)
- ✅ Very easy setup
- ✅ HTTPS included

### Cons:
- ⚠️ Costs money after free credit runs out (~$5-10/month)

---

## Option 3: Fly.io (Free Tier)

### Steps:

1. **Install Fly CLI**
   ```bash
   # Windows (PowerShell)
   iwr https://fly.io/install.ps1 -useb | iex
   
   # Mac/Linux
   curl -L https://fly.io/install.sh | sh
   ```

2. **Create `fly.toml`**
   ```toml
   app = "your-app-name"
   primary_region = "ams"  # Amsterdam, or choose closest
   
   [build]
   
   [http_service]
     internal_port = 8000
     force_https = true
     auto_stop_machines = true
     auto_start_machines = true
     min_machines_running = 0
   
   [[services]]
     protocol = "tcp"
     internal_port = 8000
   ```

3. **Deploy**
   ```bash
   fly auth login
   fly launch
   fly secrets set JWT_SECRET_KEY=your-secret-key
   fly deploy
   ```

### Pros:
- ✅ Free tier available
- ✅ Good performance
- ✅ Global CDN

### Cons:
- ⚠️ More complex setup
- ⚠️ Requires CLI usage

---

## Security Checklist for Cloud Hosting

1. ✅ Set strong `JWT_SECRET_KEY` (use a random string)
2. ✅ Set `DEBUG=False` in production
3. ✅ Set `CREATE_DEFAULT_ADMIN=False`
4. ✅ Use HTTPS (most hosts provide this automatically)
5. ✅ Set `CORS_ORIGINS` to your domain (not `*` in production)
6. ✅ Create admin user using CLI script before deployment

---

## Recommendation

**For your use case (local tournament):**
- **Best option**: Local network hosting (free, simple, fast)
- **If you need cloud access**: Render.com free tier

**For production/long-term:**
- Railway.app ($5/month) - most reliable
- Or upgrade Render.com plan if you need always-on

---

## Quick Comparison

| Option | Cost | Setup Difficulty | Always On | Best For |
|--------|------|------------------|-----------|----------|
| **Local Network** | Free | Easy | Yes | Local tournaments |
| **Render.com** | Free | Easy | No (spins down) | Testing, small projects |
| **Railway.app** | $5/mo | Very Easy | Yes | Production apps |
| **Fly.io** | Free | Medium | Yes | Advanced users |
