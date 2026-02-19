# PhotoViewer Cloud Deployment Plan

## 🏗️ Architecture Overview

Your app is **too complex for Vercel alone**. Here's the proper cloud architecture:

```
┌─────────────────────────────────────────────────────────┐
│                    USER'S BROWSER                        │
└────────────────────┬────────────────────────────────────┘
                     │
                     ├──► Frontend (Vercel)
                     │    - React + Vite
                     │    - ONNX ML models (client-side)
                     │    - Static assets
                     │    - FREE forever
                     │    - UNLIMITED bandwidth ✅
                     │
                     └──► Backend API (Railway)
                          - Express.js server
                          - Photo processing
                          - Database queries
                          - $5 credit (1 month free)
                          - Then $5-8/month
                          │
                          ├──► Photos (Cloudinary)
                          │    - 25GB free storage
                          │    - CDN delivery
                          │    - Image transformations
                          │
                          └──► Database (Turso)
                               - Distributed SQLite
                               - 500MB free
                               - Perfect for metadata
```

---

## 📊 Why This Architecture?

### ❌ Why NOT Vercel for Backend?

Your backend has:
- **Native binaries** (Sharp, better-sqlite3, FFmpeg)
- **Long processing** (face detection, clustering)
- **File system** (SQLite database, temp files)
- **Cron jobs** (memory generation)

Vercel Serverless:
- ❌ 50MB deployment limit
- ❌ 10 second timeout
- ❌ No persistent file system
- ❌ No cron jobs support

### ✅ Why This Works:

**Frontend → Vercel:**
- ✅ Just React + Vite (small, static)
- ✅ ONNX models load in browser
- ✅ FREE forever
- ✅ UNLIMITED bandwidth
- ✅ Global CDN

**Backend → Railway:**
- ✅ Full Node.js environment
- ✅ Native binaries work
- ✅ 2GB RAM (enough for ML)
- ✅ Persistent disk for SQLite
- ✅ Background workers support

**Photos → Cloudinary:**
- ✅ 25GB free storage
- ✅ Automatic image optimization
- ✅ CDN worldwide
- ✅ Transformations API

---

## 💰 Cost Breakdown

| Service | Free Tier | After Free | Monthly Cost |
|---------|-----------|------------|--------------|
| **Vercel** | Unlimited | Forever | $0 ✅ |
| **Railway** | $5 credit | Usage-based | $5-8 |
| **Cloudinary** | 25GB | 25GB bandwidth/mo | $0 ✅ |
| **Turso** | 500MB | 9GB included | $0 ✅ |
| **TOTAL** | **Month 1: FREE** | **After: $5-8** | **$5-8/mo** |

---

## ⏱️ Deployment Timeline

### Total Time: 2-3 hours

1. **Setup Accounts** (15 min)
   - Vercel account
   - Railway account
   - Cloudinary account
   - Turso account

2. **Upload Photos** (30-60 min)
   - Upload to Cloudinary
   - Get URLs
   - Update database

3. **Deploy Backend** (30 min)
   - Push to GitHub
   - Connect Railway
   - Set environment variables
   - Deploy

4. **Deploy Frontend** (15 min)
   - Connect Vercel to GitHub
   - Set environment variables
   - Deploy

5. **Testing** (15 min)
   - Test all features
   - Fix any issues

---

## 🚀 Step-by-Step Guide

### Phase 1: Photo Upload (I'll help automate this)

**Option A: Cloudinary Auto-Upload Script**
- Script uploads all photos
- Maintains folder structure
- Saves URLs to database

**Option B: Manual Upload**
- Use Cloudinary dashboard
- Upload folders
- Copy URLs

### Phase 2: Database Migration

**Option A: Keep SQLite (Easier)**
- Upload database file to Railway
- No code changes needed
- Works immediately

**Option B: Migrate to Turso (Better)**
- Distributed SQLite
- Better for cloud
- Minimal code changes

### Phase 3: Backend Deployment

```bash
# 1. Create Railway project
# 2. Connect GitHub repo
# 3. Set environment variables:
PHOTOS_DIR=cloudinary  # Flag to use Cloudinary
CLOUDINARY_URL=your_cloudinary_url
DATABASE_URL=file:/data/faces.db  # Or Turso URL
CORS_ORIGIN=https://your-app.vercel.app
```

### Phase 4: Frontend Deployment

```bash
# 1. Create Vercel project
# 2. Connect GitHub repo
# 3. Set environment variable:
VITE_API_URL=https://your-backend.up.railway.app
```

---

## 🔧 Code Changes Needed

### 1. Photo Service (Minimal Changes)

**Current:** Reads from local file system
```typescript
fs.readFileSync(path.join(PHOTOS_DIR, photoPath))
```

**After:** Returns Cloudinary URL
```typescript
if (process.env.PHOTOS_DIR === 'cloudinary') {
  return cloudinaryUrl
} else {
  fs.readFileSync(path.join(PHOTOS_DIR, photoPath))
}
```

### 2. Frontend API URL

**Current:** `http://localhost:3002`
**After:** `https://your-backend.up.railway.app`

### 3. CORS Configuration

Add Railway domain to allowed origins.

---

## 📝 Files I'll Create for You

1. **vercel.json** - Vercel configuration
2. **railway.json** - Railway configuration
3. **upload-to-cloudinary.js** - Photo upload script
4. **DEPLOYMENT-GUIDE.md** - Step-by-step instructions
5. **photo-service-cloud.ts** - Modified photo service

---

## 🎯 Deployment Options

### Option 1: FULL Cloud Deployment (Recommended)
- **Time:** 2-3 hours
- **Cost:** $5-8/month after first month
- **Benefit:** Works 24/7, unlimited bandwidth, scalable

### Option 2: Backend Only on Railway + Ngrok
- **Time:** 1 hour
- **Keep:** Photos local, use Railway just for API
- **Cost:** $5-8/month
- **Benefit:** Less migration work

### Option 3: Use Your Existing Ngrok (Quickest)
- **Time:** 0 hours (already working!)
- **Cost:** FREE (1GB bandwidth)
- **Benefit:** Demo works NOW
- **Trade-off:** 1GB limit

---

## ✅ My Recommendation

For a **1-week to 1-month demo:**

**Option 3 (Ngrok)** - You already have it working!
- URL: `https://nonadaptable-uneffervescent-abbigail.ngrok-free.dev`
- 1GB is enough for short demos
- Works immediately
- Keep computer on

For **permanent production:**

**Option 1 (Full Cloud)** - Worth the 2-3 hours
- Works 24/7
- Unlimited bandwidth
- Professional setup
- Scalable

---

## 🤔 What Do You Want?

1. **Quick demo (1 week):** Use existing ngrok URL
2. **Demo (1 month):** Full cloud deployment
3. **Production app:** Full cloud deployment

Tell me which option you prefer and I'll guide you through it!

---

## 📞 Next Steps

If you choose **Full Cloud Deployment**, I will:

1. ✅ Create all configuration files
2. ✅ Modify code for cloud storage
3. ✅ Write photo upload script
4. ✅ Provide step-by-step deployment guide
5. ✅ Help troubleshoot any issues

**Ready to proceed?** Tell me:
- How long do you need the demo for?
- Do you want to invest 2-3 hours for cloud deployment?
- Or use the existing ngrok URL (works now, 1GB limit)?
