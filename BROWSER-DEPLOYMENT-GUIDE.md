# 🌐 Browser-Based Production Deployment Guide

This guide shows you how to deploy your Photo Viewer application so users can access it through a web browser in production.

## 🎯 What You're Deploying

```
Users' Browser (Chrome, Firefox, etc.)
         ↓
    Your Domain (yourdomain.com)
         ↓
    Your Server (DigitalOcean, AWS, etc.)
         ↓
    Your Application (Node.js + Python + React)
```

---

## ✅ Recommended: DigitalOcean Deployment

### **Total Cost:** ~$24-34/month
- Server: $24/month (4GB RAM, 2 CPUs)
- Domain: $10/year (~$1/month)

### **Time to Deploy:** 30-60 minutes

---

## 📋 Complete Deployment Process

### **Part 1: Prepare Your Code** (On Your Computer)

#### Step 1: Commit to Git

First, provide your git information:

```bash
cd "/mnt/d/Photos Ai/photo-viewer"

# Configure git user (REPLACE WITH YOUR INFO)
git config user.name "Your Name"
git config user.email "your@email.com"

# Commit changes
git add .
git commit -m "Production-ready deployment with dynamic configuration"
```

#### Step 2: Push to GitHub

**Option A: Using GitHub CLI**
```bash
# Install GitHub CLI: https://cli.github.com/
gh auth login
gh repo create photo-viewer --private --source=. --remote=origin --push
```

**Option B: Manual**
```bash
# 1. Go to github.com
# 2. Click "New Repository"
# 3. Name: photo-viewer
# 4. Make it Private
# 5. Don't initialize with README
# 6. Create repository

# Then push:
git remote add origin https://github.com/YOUR_USERNAME/photo-viewer.git
git branch -M main
git push -u origin main
```

---

### **Part 2: Setup Server** (Cloud Provider)

#### Step 1: Create DigitalOcean Account

1. Go to https://www.digitalocean.com/
2. Sign up (you get $200 free credit for 60 days)
3. Add payment method

#### Step 2: Create Droplet (Server)

1. Click **"Create" → "Droplets"**
2. Choose:
   ```
   Image: Ubuntu 22.04 LTS
   Droplet Type: Basic
   CPU Options: Regular
   Plan: $24/month (4GB RAM / 2 CPUs / 80GB SSD)
   Datacenter: Choose closest to you
   Authentication: Password (easier) or SSH Key (more secure)
   Hostname: photo-viewer
   ```
3. Click **"Create Droplet"**
4. Wait 1-2 minutes for creation
5. **Note your IP address:** e.g., `142.93.123.45`

#### Step 3: Get Domain Name (Optional but Recommended)

**Option A: Use IP Address** (Free, works immediately)
- Access via `http://142.93.123.45`
- No SSL certificate
- Hard to remember

**Option B: Buy Domain** ($10/year, professional)
1. Go to https://www.namecheap.com/
2. Search for domain: `myphotos.com`
3. Purchase (~$10/year)
4. In DNS settings, add:
   ```
   Type: A Record
   Host: @
   Value: 142.93.123.45 (your server IP)

   Type: A Record
   Host: www
   Value: 142.93.123.45
   ```
5. Wait 5-30 minutes for DNS propagation

---

### **Part 3: Deploy Application** (On Server)

#### Method A: Automated Script (Recommended) ⭐

**Step 1: Connect to Server**

**On Windows (PowerShell):**
```powershell
ssh root@142.93.123.45
# Enter password when prompted
```

**On Mac/Linux (Terminal):**
```bash
ssh root@142.93.123.45
```

**Step 2: Run Deployment Script**

```bash
# Download deployment script
curl -o deploy.sh https://raw.githubusercontent.com/YOUR_USERNAME/photo-viewer/main/deploy-to-server.sh

# Make executable
chmod +x deploy.sh

# Run script
./deploy.sh
```

The script will ask you:
- Your GitHub username
- Repository name (photo-viewer)
- Your domain (or press Enter to use IP)

**That's it!** The script handles everything:
- ✅ Installs Node.js, Python, Nginx
- ✅ Clones your repository
- ✅ Installs dependencies
- ✅ Builds application
- ✅ Configures environment
- ✅ Starts application with PM2
- ✅ Sets up Nginx reverse proxy
- ✅ Installs SSL certificate (if domain provided)
- ✅ Configures firewall

---

#### Method B: Manual Deployment

If automated script fails, use manual steps:

<details>
<summary>Click to expand manual deployment steps</summary>

```bash
# 1. Update system
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Install Python
sudo apt install -y python3 python3-pip python3-venv

# 4. Install dependencies
sudo apt install -y git nginx build-essential

# 5. Install PM2
sudo npm install -g pm2

# 6. Clone repository
cd /opt
sudo mkdir photo-viewer
sudo chown $USER:$USER photo-viewer
git clone https://github.com/YOUR_USERNAME/photo-viewer.git photo-viewer
cd photo-viewer

# 7. Install dependencies
npm run install:all

# 8. Setup Python
python3 -m venv venv_onnx
source venv_onnx/bin/activate
pip install -r requirements_onnx.txt

# 9. Build application
npm run build

# 10. Create directories
sudo mkdir -p /data/photos
sudo mkdir -p /var/lib/photo-viewer/data
sudo chown $USER:$USER /var/lib/photo-viewer/data

# 11. Create .env
cp .env.example .env
nano .env
# Edit PHOTOS_DIR=/data/photos
# Edit CORS_ORIGIN=https://yourdomain.com

# 12. Start with PM2
pm2 start server/dist/index.js --name photo-viewer
pm2 save
pm2 startup

# 13. Configure Nginx
sudo nano /etc/nginx/sites-available/photo-viewer
# Paste nginx configuration from DEPLOYMENT.md

sudo ln -s /etc/nginx/sites-available/photo-viewer /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# 14. Install SSL (if using domain)
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

</details>

---

### **Part 4: Upload Photos** (From Your Computer)

**Windows (PowerShell/Command Prompt):**

```powershell
# Using WinSCP (GUI - Easiest for Windows)
# 1. Download WinSCP: https://winscp.net
# 2. Connect:
#    - File protocol: SCP
#    - Host: 142.93.123.45
#    - Username: root
#    - Password: your_password
# 3. Navigate to /data/photos
# 4. Drag and drop from D:\Photos Ai\mobile

# Or using Command Line:
scp -r "D:\Photos Ai\mobile\*" root@142.93.123.45:/data/photos/
```

**Linux/Mac (Terminal):**

```bash
# Using rsync (recommended - faster, resumable)
rsync -avz --progress "/mnt/d/Photos Ai/mobile/" root@142.93.123.45:/data/photos/

# Or using scp
scp -r "/mnt/d/Photos Ai/mobile/"* root@142.93.123.45:/data/photos/
```

**Upload Progress:**
- First upload might take 10-60 minutes depending on library size
- Subsequent updates only upload changed files (much faster with rsync)

---

## ✅ Verify Deployment

### 1. Check Application Health

```bash
# If using domain:
curl https://yourdomain.com/api/health

# If using IP:
curl http://142.93.123.45/api/health

# Expected response:
{
  "status": "ok",
  "environment": "production",
  "timestamp": "2026-01-27T...",
  "checks": {
    "photosDirectory": "accessible",
    "databaseDirectory": "accessible"
  }
}
```

### 2. Access in Browser

**Open browser and go to:**
- With domain: `https://yourdomain.com/api/health`
- With IP: `http://142.93.123.45/api/health`

You should see the JSON health response.

### 3. Test API Endpoints

```bash
# List photos
curl https://yourdomain.com/api/photos?page=1&limit=10

# Get memories
curl https://yourdomain.com/api/memories

# Get faces
curl https://yourdomain.com/api/faces
```

---

## 🎨 Access Frontend

Currently, the API is deployed. To make the frontend accessible:

### Option 1: Serve Frontend from Same Server

**On Server:**
```bash
cd /opt/photo-viewer

# Update Nginx to serve frontend
sudo nano /etc/nginx/sites-available/photo-viewer
```

Add this to your Nginx config:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Serve frontend (React app)
    location / {
        root /opt/photo-viewer/client/dist;
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests
    location /api {
        proxy_pass http://localhost:3002;
        # ... rest of proxy config
    }
}
```

Restart Nginx:
```bash
sudo systemctl restart nginx
```

**Now access:**
- Frontend: `https://yourdomain.com`
- API: `https://yourdomain.com/api`

### Option 2: Deploy Frontend Separately (Vercel/Netlify)

If you want to use Vercel/Netlify for frontend:

1. **Update client to use production API**
2. **Deploy client folder to Vercel/Netlify**
3. **Update CORS_ORIGIN** on server to allow Vercel domain

---

## 🔄 Updating Your Application

When you make changes:

**On Your Computer:**
```bash
# Make changes
# Test locally

# Commit and push
git add .
git commit -m "Fixed memory tab"
git push origin main
```

**On Server:**
```bash
ssh root@142.93.123.45

cd /opt/photo-viewer
git pull origin main
npm run build
pm2 restart photo-viewer

# View logs
pm2 logs photo-viewer
```

---

## 📊 Monitoring & Management

### View Logs

```bash
# Real-time logs
pm2 logs photo-viewer

# Last 100 lines
pm2 logs photo-viewer --lines 100

# Nginx logs
sudo tail -f /var/log/nginx/error.log
```

### Application Management

```bash
# Check status
pm2 status

# Restart application
pm2 restart photo-viewer

# Stop application
pm2 stop photo-viewer

# Monitor resources
pm2 monit
```

### Server Resources

```bash
# Disk usage
df -h

# Memory usage
free -h

# CPU usage
htop  # or: top
```

---

## 🆘 Common Issues & Solutions

### Issue: "PHOTOS_DIR environment variable is required"

**Solution:**
```bash
cd /opt/photo-viewer
nano .env
# Add: PHOTOS_DIR=/data/photos
pm2 restart photo-viewer
```

### Issue: "CORS Error" in Browser

**Solution:**
```bash
cd /opt/photo-viewer
nano .env
# Update: CORS_ORIGIN=https://yourdomain.com
pm2 restart photo-viewer
```

### Issue: "502 Bad Gateway" in Browser

**Solution:**
```bash
# Check if application is running
pm2 status

# Check application logs
pm2 logs photo-viewer

# Restart application
pm2 restart photo-viewer

# Check Nginx
sudo systemctl status nginx
```

### Issue: Photos Not Loading

**Solution:**
```bash
# Check photos directory
ls -la /data/photos

# Check permissions
sudo chown -R $USER:$USER /data/photos

# Verify PHOTOS_DIR in environment
pm2 env photo-viewer | grep PHOTOS
```

---

## 💰 Cost Breakdown

**Monthly Costs:**

| Service | Cost | Notes |
|---------|------|-------|
| DigitalOcean Droplet | $24 | 4GB RAM, 2 CPUs |
| Domain Name | ~$1 | $10-12/year |
| **Total** | **$25/month** | All-inclusive |

**Free Alternatives:**
- Railway.app: Free tier (limited)
- Render.com: Free tier (spins down after inactivity)
- Fly.io: Free tier (limited resources)

---

## 🎯 Summary Checklist

- [ ] Code committed to GitHub
- [ ] Server created (DigitalOcean/AWS/etc.)
- [ ] Domain purchased and DNS configured (optional)
- [ ] Deployed using automated script
- [ ] Photos uploaded to /data/photos
- [ ] Application accessible via browser
- [ ] SSL certificate installed (HTTPS)
- [ ] Health check passes
- [ ] API endpoints working

---

## 📞 Getting Help

**If deployment fails:**

1. Check logs: `pm2 logs photo-viewer`
2. Check server: `pm2 status`
3. Check Nginx: `sudo nginx -t`
4. Review DEPLOYMENT.md for troubleshooting
5. Check GitHub issues

**Application is now accessible to anyone via:**
- `https://yourdomain.com` (with domain)
- `http://YOUR_SERVER_IP` (without domain)

---

**🎉 Congratulations! Your application is now live on the internet!**

Users can access it from any device with a web browser. 🌐
