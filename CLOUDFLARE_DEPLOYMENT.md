# 🚀 Cloudflare Pages Deployment Guide

## ✅ Pre-requisites
- ✅ Backend deployed to Render: https://photos-poc.onrender.com
- ✅ Photos uploaded to Cloudinary (564/565 photos)
- ✅ Database with face embeddings ready
- ✅ Configuration files created

## 📋 Deployment Steps

### 1️⃣ **Push to GitHub**
```bash
git add .
git commit -m "Configure for Cloudflare Pages deployment"
git push origin ngroksetup
```

### 2️⃣ **Create Cloudflare Pages Project**

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com)
2. Click **"Workers & Pages"** in the sidebar
3. Click **"Create application"** → **"Pages"** → **"Connect to Git"**

### 3️⃣ **Connect GitHub Repository**

1. Click **"Connect GitHub"** (or **"Connect GitLab"**)
2. Authorize Cloudflare to access your repositories
3. Select your **photo-viewer** repository
4. Click **"Begin setup"**

### 4️⃣ **Configure Build Settings**

**Important:** Set these values:

- **Project name:** `photo-viewer` (or any name you prefer)
- **Production branch:** `ngroksetup` ⚠️ IMPORTANT: Change from `main` to `ngroksetup`
- **Build command:** `cd client && npm install && npm run build`
- **Build output directory:** `client/dist`
- **Root directory:** `/` (leave empty or set to root)

**Environment Variables (Build time):**
- Click **"Add variable"**
- Name: `VITE_API_URL`
- Value: `https://photos-poc.onrender.com`
- Click **"Save"**

### 5️⃣ **Deploy!**

1. Click **"Save and Deploy"**
2. Wait 2-5 minutes for build to complete
3. You'll get a URL like: `https://photo-viewer.pages.dev`

### 6️⃣ **Verify Deployment**

Once deployed, test these URLs (replace with your actual URL):

- **Frontend:** `https://photo-viewer.pages.dev`
- **API Proxy:** `https://photo-viewer.pages.dev/api/photos`
- **Health Check:** `https://photo-viewer.pages.dev/health`

## 🎯 **Features That Will Work:**

✅ **Photo Gallery** - Browse 564 photos from Cloudinary CDN
✅ **Face Clustering** - 1,499 faces, 38 persons (InsightFace Buffalo model)
✅ **Location Browsing** - Filter by city/country (11 locations)
✅ **Smart Albums** - AI-generated photo albums
✅ **Memories** - "On This Day" and weekly/monthly highlights
✅ **Semantic Search** - Search photos by text
✅ **Document Intelligence** - Extract text from photos

## 📝 **Files Created:**

- ✅ `client/public/_redirects` - API proxy configuration
- ✅ `wrangler.toml` - Cloudflare Pages config (optional)
- ✅ `client/.env.production` - Production environment variables
- ✅ This guide!

## 🔧 **Troubleshooting:**

### API requests failing?
- Check `_redirects` file is in `client/public/` folder
- Verify it was copied to `client/dist/` during build
- Check browser console for CORS errors

### Build failing?
- Verify build command: `cd client && npm install && npm run build`
- Verify output directory: `client/dist`
- Check Cloudflare Pages build logs

### Environment variables not working?
- Make sure `VITE_API_URL` is set in Cloudflare dashboard
- Rebuild the project after adding env vars

## 🎉 **After Deployment:**

Share the Cloudflare Pages URL with your manager:
`https://your-app.pages.dev`

**No bandwidth limits! Unlimited deploys! Lightning fast CDN!** ⚡

---

**Need help?** Check the Cloudflare Pages documentation:
https://developers.cloudflare.com/pages/
