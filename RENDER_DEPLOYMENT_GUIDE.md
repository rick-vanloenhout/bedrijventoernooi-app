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

5. **DATABASE_URL** (⚠️ **IMPORTANT - Use PostgreSQL for data persistence**)
   
   **Option A: PostgreSQL (Recommended - Data Persists)**
   - First, create a PostgreSQL database:
     1. In Render dashboard, click **"New +"** → **"PostgreSQL"**
     2. Name it: `bedrijventoernooi-db` (or any name)
     3. Select **"Free"** plan
     4. Choose same region as your web service
     5. Click **"Create Database"**
     6. Wait 1-2 minutes for it to be ready
   - Copy the **"Internal Database URL"** (starts with `postgresql://`)
   - Set `DATABASE_URL` environment variable to this URL
   - ✅ **Data will persist between deployments!**
   
   **Option B: SQLite (Not Recommended - Data Can Be Lost)**
   - Value: `sqlite:///./tournament.db`
   - ⚠️ **Warning:** SQLite files on Render's free tier can be wiped during deployments
   - Only use for testing, not production

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

**Option A: Using Render Shell (Not Available on Free Tier)**

⚠️ **Note:** Shell access requires a paid Render plan. Free tier users should use **Option B** instead.

If you have shell access:
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

**Option B: Create User Account via Environment Variables (For Free Tier Users)**

This is the recommended method if you don't have shell access (free tier limitation).

**Note:** You can create ANY user account with ANY username using this method. All users have the same permissions (they're all organizers who can manage tournaments). The "admin" naming is just convention - feel free to use any username you prefer!

**Step 1: Add Environment Variables**
1. In Render dashboard, go to your service
2. Click on **"Environment"** tab (in the left sidebar)
3. Click **"Add Environment Variable"** button
4. Add these three variables one by one:

   **Variable 1:**
   - Key: `CREATE_DEFAULT_ADMIN`
   - Value: `true`
   - Click **"Save Changes"**

   **Variable 2:**
   - Key: `DEFAULT_ADMIN_USERNAME`
   - Value: `admin` (or any username you want, e.g., `organizer`, `john`, `tournament_manager`)
   - Click **"Save Changes"**

   **Variable 3:**
   - Key: `DEFAULT_ADMIN_PASSWORD`
   - Value: `YourSecurePassword123!` (use a strong password!)
   - Click **"Save Changes"**

**Step 2: Wait for Redeploy**
- Render will automatically detect the environment variable changes
- It will trigger a new deployment (you'll see "Deploying..." status)
- Wait 2-3 minutes for the deployment to complete
- Check the **"Logs"** tab to see when it finishes

**Step 3: Verify User Account Was Created**
1. Once deployment is complete, try logging in:
   - Go to: `https://your-app-name.onrender.com/frontend/login.html`
   - Username: The username you set in `DEFAULT_ADMIN_USERNAME` (e.g., `admin`, `organizer`, etc.)
   - Password: The password you set in `DEFAULT_ADMIN_PASSWORD`
2. If login works, proceed to Step 4

**Step 4: Remove Environment Variables (IMPORTANT for Security)**

⚠️ **CRITICAL:** Only use **"Save Changes"** - DO NOT use "Rebuild" or "Rebuild & Deploy" as this will wipe your database!

1. Go back to **"Environment"** tab in Render dashboard
2. Click the **trash icon** (🗑️) next to each of these three variables:
   - `CREATE_DEFAULT_ADMIN`
   - `DEFAULT_ADMIN_USERNAME`
   - `DEFAULT_ADMIN_PASSWORD`
3. Click **"Save Changes"** (NOT "Rebuild"!)
4. Render will automatically redeploy (this is normal and safe)
5. Wait 2-3 minutes for the deployment to complete

**Step 5: Verify Everything Still Works**
- Your user account should still be in the database
- The environment variables are removed (more secure)
- Try logging in again - it should still work!

**⚠️ Important Note About Database Persistence:**
- On Render's free tier, SQLite database files persist between normal deployments
- However, using **"Rebuild"** or **"Rebuild & Deploy"** will wipe the filesystem and delete your database
- Always use **"Save Changes"** instead, which triggers a normal redeploy without wiping data
- If your database gets wiped, simply repeat Steps 1-3 to recreate your user account

**Why This Works:**
- When `CREATE_DEFAULT_ADMIN=true` and `DEFAULT_ADMIN_PASSWORD` is set, the app automatically creates a user account on startup
- Once created, the user exists in the database permanently
- Removing the variables prevents accidental recreation and improves security

**Creating Multiple Users:**
- You can repeat this process to create multiple user accounts
- Just change the `DEFAULT_ADMIN_USERNAME` value each time
- Each user will have the same permissions (all can manage tournaments)


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
   - ✅ **PostgreSQL (Recommended):** Data persists reliably between all deployments
   - ⚠️ **SQLite:** Files can be wiped during deployments on free tier
   - ⚠️ **"Rebuild" or "Rebuild & Deploy" will wipe SQLite database!**
   - **Solution:** Use Render's free PostgreSQL database (see Step 4, Environment Variables)
   - **Backup**: Export your database before important tournaments
   - **Always use "Save Changes" instead of "Rebuild"**

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

**Database Wiped / Data Lost After Deployment:**
- ⚠️ **This is a known issue with SQLite on Render's free tier**
- SQLite files can be wiped during deployments (even normal ones)
- **Solution:** Switch to PostgreSQL (free tier available)
  1. Create a PostgreSQL database in Render dashboard
  2. Copy the "Internal Database URL"
  3. Set `DATABASE_URL` environment variable to the PostgreSQL URL
  4. Redeploy your app
  5. Your data will now persist reliably!

**Database Wiped / Can't Login After Removing Environment Variables:**
- ⚠️ **This happens if you used "Rebuild" instead of "Save Changes"**
- "Rebuild" wipes the entire filesystem, including your SQLite database
- **Solution:** Recreate your user account by repeating Option B (Steps 1-3)
- Add the environment variables back, wait for deploy, verify login works
- Then remove them using **"Save Changes"** (NOT "Rebuild"!)
- **Prevention:** Always use "Save Changes" for environment variable changes

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
