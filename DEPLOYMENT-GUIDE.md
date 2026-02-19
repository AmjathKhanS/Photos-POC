# 🚀 PhotoViewer Cloud Deployment Guide

**Complete step-by-step guide to deploy your PhotoViewer app to the cloud with UNLIMITED bandwidth!**

**Total Time:** 2-3 hours
**Cost:** FREE Month 1, then $5-8/month
**Result:** 24/7 uptime, unlimited bandwidth, professional setup

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Phase 1: Setup Accounts](#phase-1-setup-accounts-15-minutes)
3. [Phase 2: Upload Photos to Cloudinary](#phase-2-upload-photos-to-cloudinary-30-60-minutes)
4. [Phase 3: Deploy Backend to Railway](#phase-3-deploy-backend-to-railway-30-minutes)
5. [Phase 4: Deploy Frontend to Vercel](#phase-4-deploy-frontend-to-vercel-15-minutes)
6. [Phase 5: Testing](#phase-5-testing-15-minutes)
7. [Troubleshooting](#troubleshooting)
8. [Post-Deployment](#post-deployment)

---

## Prerequisites

✅ Your PhotoViewer app is working locally
✅ Photos are in: `D:\Photos Ai\`
✅ Database exists: `server/data/faces.db`
✅ Git installed
✅ Node.js installed
✅ GitHub account

---

## Phase 1: Setup Accounts (15 minutes)

### 1.1 Create Cloudinary Account

1. Go to: https://cloudinary.com/users/register/free
2. Sign up with email
3. Verify email
4. Go to Dashboard: https://cloudinary.com/console
5. **Copy these credentials:**
   - Cloud Name: `your-cloud-name`
   - API Key: `123456789012345`
   - API Secret: `abcdefghijklmnopqrstuvwxyz`

**Save these! You'll need them later.**

---

### 1.2 Create Railway Account

1. Go to: https://railway.app
2. Click "Start a New Project"
3. Sign up with GitHub
4. You get **$5 free credit** (no credit card needed!)

---

### 1.3 Create Vercel Account

1. Go to: https://vercel.com/signup
2. Sign up with GitHub
3. Authorize Vercel to access your repositories

---

### 1.4 Push Code to GitHub

**If you haven't already:**

```bash
# Open PowerShell in your project directory
cd "D:\Photos Ai\photo-viewer"

# Initialize git (if not done)
git init

# Add all files
git add .

# Create first commit
git commit -m "Initial commit - PhotoViewer app"

# Create GitHub repository at: https://github.com/new
# Name it: photo-viewer

# Add remote and push
git remote add origin https://github.com/YOUR_USERNAME/photo-viewer.git
git branch -M main
git push -u origin main
```

✅ **Checkpoint:** Code is now on GitHub!

---

## Phase 2: Upload Photos to Cloudinary (30-60 minutes)

### 2.1 Install Upload Script Dependencies

```powershell
cd "D:\Photos Ai\photo-viewer\scripts"
npm install
```

### 2.2 Configure Cloudinary Credentials

Create `.env` file in project root (`D:\Photos Ai\photo-viewer\.env`):

```env
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

PHOTOS_DIR=D:/Photos Ai
SQLITE_DB_PATH=D:/Photos Ai/photo-viewer/server/data/faces.db
```

**Replace with YOUR actual Cloudinary credentials!**

### 2.3 Run Upload Script

```powershell
cd "D:\Photos Ai\photo-viewer"
node scripts/upload-to-cloudinary.js
```

**What happens:**
- Script finds all photos from database
- Uploads to Cloudinary (batched, ~5 at a time)
- Saves Cloudinary URLs to database
- Shows progress

**Time:** Depends on photo count
- 100 photos: ~5 minutes
- 500 photos: ~20 minutes
- 1000+ photos: ~45-60 minutes

**Cloudinary Free Tier:** 25GB storage - should be enough!

✅ **Checkpoint:** All photos uploaded to Cloudinary!

---

## Phase 3: Deploy Backend to Railway (30 minutes)

### 3.1 Create New Railway Project

1. Go to: https://railway.app/dashboard
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your `photo-viewer` repository
5. Railway will detect it and start deploying

### 3.2 Configure Environment Variables

In Railway Dashboard → Variables, add these:

**Copy from `.env.railway.example` and fill in YOUR values:**

```env
# Storage
PHOTOS_DIR=cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME

# Database
SQLITE_DB_PATH=/data/faces.db
DB_DIR=/data

# CORS (add your Vercel URL after deploying frontend)
CORS_ORIGIN=*

# Server
PORT=3002
NODE_ENV=production

# Python
PYTHON_EXECUTABLE=python3
PYTHON_VENV_PATH=/app/venv_onnx
```

### 3.3 Upload Database

Railway needs your SQLite database file:

**Option A: Use Railway CLI (Recommended)**

```powershell
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Upload database
railway volume create
railway volume attach /data
railway volume upload server/data/faces.db /data/faces.db
```

**Option B: Manual Upload via Dashboard**

1. Go to Railway project → Volumes
2. Create new volume: `/data`
3. Upload `faces.db` file

### 3.4 Trigger Deployment

1. Click "Deploy" in Railway
2. Wait for build to complete (~5-10 minutes)
3. Check logs for errors

### 3.5 Get Backend URL

Once deployed:
1. Go to Settings → Generate Domain
2. You'll get: `https://your-backend.up.railway.app`

**Copy this URL!**

✅ **Checkpoint:** Backend is live!

**Test it:**
```
https://your-backend.up.railway.app/health
```

Should return: `{"status":"ok"}`

---

## Phase 4: Deploy Frontend to Vercel (15 minutes)

### 4.1 Create Vercel Project

1. Go to: https://vercel.com/dashboard
2. Click "Add New..." → "Project"
3. Import your `photo-viewer` repository
4. Vercel detects it's a Vite app

### 4.2 Configure Build Settings

**Root Directory:** `client`

**Build Command:** `npm run build`

**Output Directory:** `dist`

**Install Command:** `npm install`

### 4.3 Set Environment Variable

Add this environment variable:

```
VITE_API_URL=https://your-backend.up.railway.app
```

**Replace with your actual Railway URL from Phase 3!**

### 4.4 Deploy

1. Click "Deploy"
2. Vercel builds and deploys (~2-3 minutes)
3. You get a URL: `https://your-app.vercel.app`

✅ **Checkpoint:** Frontend is live!

### 4.5 Update Railway CORS

Go back to Railway → Environment Variables:

Update:
```env
CORS_ORIGIN=https://your-app.vercel.app
```

Redeploy Railway backend.

---

## Phase 5: Testing (15 minutes)

### 5.1 Test Frontend

Open: `https://your-app.vercel.app`

**Should see:**
- ✅ Photo gallery loads
- ✅ Thumbnails display
- ✅ Full images open
- ✅ AI search works
- ✅ People tab works
- ✅ Places tab works

### 5.2 Test ML Models

1. Click on a photo
2. Face detection should work (runs in browser)
3. Try semantic search
4. Check People tab for face grouping

### 5.3 Check Performance

- Thumbnails should load fast (Cloudinary CDN)
- Images should be optimized
- No 500 errors in console

---

## 🎉 Deployment Complete!

Your PhotoViewer is now live with:

✅ **UNLIMITED Bandwidth** (Vercel + Cloudinary)
✅ **24/7 Uptime**
✅ **Global CDN** (fast worldwide)
✅ **Professional Setup**
✅ **Scalable Architecture**

---

## 📧 Share with Your Manager

```
Hi [Manager Name],

PhotoViewer is now deployed and ready for demo!

🔗 URL: https://your-app.vercel.app

Features:
✅ AI-powered photo gallery
✅ Semantic search - try: "red shirt", "beach", "documents"
✅ Automatic face recognition & grouping (People tab)
✅ GPS-based photo locations (Places tab)
✅ Smart auto-categorized albums
✅ Memory timeline

The app is live 24/7 with unlimited bandwidth.

Let me know what you think!

Best regards,
[Your Name]
```

---

## 💰 Cost Summary

| Month | Service | Cost |
|-------|---------|------|
| **Month 1** | Railway ($5 credit) | $0 |
| | Vercel | $0 |
| | Cloudinary | $0 |
| | **TOTAL** | **$0** ✅ |
| **Month 2+** | Railway | $5-8 |
| | Vercel | $0 |
| | Cloudinary | $0 |
| | **TOTAL** | **$5-8/mo** |

**Free Tier Limits:**
- Vercel: UNLIMITED bandwidth ✅
- Cloudinary: 25GB storage, 25GB bandwidth/month
- Railway: Usage-based after $5 credit

---

## 🔧 Troubleshooting

### Frontend shows "Failed to fetch"

**Problem:** Frontend can't reach backend

**Solution:**
1. Check `VITE_API_URL` in Vercel
2. Check `CORS_ORIGIN` in Railway
3. Make sure Railway backend is running

---

### Photos not loading

**Problem:** Cloudinary URLs not working

**Solution:**
1. Check upload script completed successfully
2. Verify `CLOUDINARY_URL` in Railway
3. Check database has cloudinary_urls table

---

### Backend fails to start

**Problem:** Missing environment variables or database

**Solution:**
1. Check all required env vars in Railway
2. Verify database file uploaded to `/data/faces.db`
3. Check Railway logs for specific error

---

### "Module not found" errors

**Problem:** Dependencies not installed

**Solution:**
1. Check `nixpacks.toml` exists
2. Trigger manual redeploy in Railway
3. Check build logs

---

## 🎯 Post-Deployment

### Monitor Usage

**Vercel:**
- Dashboard → Usage
- Track bandwidth, build minutes

**Railway:**
- Dashboard → Usage
- Monitor $5 credit consumption
- Typical usage: $0.02-0.05/hour = $15-36/month
- With $5 credit = ~10-25 days free

**Cloudinary:**
- Dashboard → Usage
- 25GB storage + 25GB bandwidth/month free
- Should be enough for demos

### Custom Domain (Optional)

**Vercel:**
1. Go to Project → Settings → Domains
2. Add your domain
3. Update DNS records

**Railway:**
1. Settings → Custom Domain
2. Add domain
3. Update CORS in environment

### Scaling

If you get high traffic:
- Vercel: Auto-scales (FREE)
- Railway: Increase resources (paid)
- Cloudinary: Upgrade plan if needed

---

## 📞 Need Help?

**Common Issues:**

1. **Build fails:** Check logs, verify all files committed
2. **404 errors:** Check routes, verify build output
3. **Slow loading:** Check Cloudinary CDN, optimize images
4. **Database errors:** Verify upload, check paths

**Resources:**
- Vercel Docs: https://vercel.com/docs
- Railway Docs: https://docs.railway.app
- Cloudinary Docs: https://cloudinary.com/documentation

---

## ✅ Final Checklist

- [ ] GitHub repository created and pushed
- [ ] Cloudinary account created
- [ ] Photos uploaded to Cloudinary (all)
- [ ] Railway account created
- [ ] Backend deployed to Railway
- [ ] Database uploaded to Railway
- [ ] Environment variables set in Railway
- [ ] Vercel account created
- [ ] Frontend deployed to Vercel
- [ ] Environment variable set in Vercel
- [ ] CORS updated in Railway
- [ ] Tested: Photos load
- [ ] Tested: AI search works
- [ ] Tested: Face detection works
- [ ] Shared URL with manager

---

## 🎉 Congratulations!

You've successfully deployed PhotoViewer to the cloud!

**Your app now has:**
- ✅ UNLIMITED bandwidth (Vercel + Cloudinary)
- ✅ Global CDN (fast worldwide)
- ✅ 24/7 uptime
- ✅ Professional infrastructure
- ✅ Scalable architecture

**Enjoy your cloud-deployed PhotoViewer!** 🚀
