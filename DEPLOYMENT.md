# Photo Viewer - Production Deployment Guide

This guide covers deploying the AI-powered Photo Viewer application to a production server.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Quick Start with Docker](#quick-start-with-docker)
- [Manual Deployment](#manual-deployment)
- [Environment Configuration](#environment-configuration)
- [Security Considerations](#security-considerations)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements
- **CPU**: 2+ cores recommended
- **RAM**: 4GB minimum, 8GB recommended
- **Disk**: 10GB+ (depends on photo library size)
- **OS**: Linux (Ubuntu 20.04+), Windows Server, or macOS

### Software Requirements
- **Node.js**: 20.x or higher
- **Python**: 3.10+ with pip
- **Docker** (optional but recommended): 24.x+
- **Docker Compose** (optional): 2.x+

---

## Quick Start with Docker

The easiest way to deploy is using Docker.

### 1. Clone and Configure

```bash
# Clone repository
git clone <your-repo-url>
cd photo-viewer

# Copy environment template
cp .env.example .env

# Edit .env file
nano .env
```

### 2. Configure Environment Variables

**Required settings in `.env`:**

```bash
# CORS - Set to your domain
CORS_ORIGIN=https://yourdomain.com

# Photos directory - Point to your photos
PHOTOS_PATH=/path/to/your/photos
```

### 3. Start with Docker Compose

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Check health
curl http://localhost:3002/health
```

### 4. Access Application

- **API**: http://localhost:3002
- **Health Check**: http://localhost:3002/health

---

## Manual Deployment

For deployment without Docker:

### 1. Install Dependencies

```bash
# Install Node.js dependencies
npm run install:all

# Setup Python virtual environment
python3 -m venv venv_onnx
source venv_onnx/bin/activate  # Linux/Mac
# or
venv_onnx\Scripts\activate  # Windows

# Install Python dependencies
pip install -r requirements_onnx.txt
```

### 2. Configure Environment

```bash
# Copy template
cp .env.example .env

# Edit configuration
nano .env
```

**Required .env variables:**

```bash
NODE_ENV=production
PORT=3002
CORS_ORIGIN=https://yourdomain.com
PHOTOS_DIR=/path/to/photos
PYTHON_VENV_PATH=/path/to/venv_onnx
```

### 3. Build Application

```bash
# Build client and server
npm run build

# Verify build
ls -la client/dist
ls -la server/dist
```

### 4. Start Server

#### Option A: Direct Node.js

```bash
npm run start:prod
```

#### Option B: PM2 (Recommended)

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start server/dist/index.js --name photo-viewer

# Save PM2 configuration
pm2 save

# Setup auto-start on boot
pm2 startup
```

#### Option C: Systemd Service

Create `/etc/systemd/system/photo-viewer.service`:

```ini
[Unit]
Description=Photo Viewer Application
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/opt/photo-viewer
EnvironmentFile=/opt/photo-viewer/.env
ExecStart=/usr/bin/node server/dist/index.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable photo-viewer
sudo systemctl start photo-viewer
sudo systemctl status photo-viewer
```

---

## Environment Configuration

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PHOTOS_DIR` | Path to photos directory | `/data/photos` |
| `CORS_ORIGIN` | Allowed CORS origins | `https://yourdomain.com` |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3002` | Server port |
| `NODE_ENV` | `development` | Environment mode |
| `DB_DIR` | `./server/data` | Database directory |
| `CACHE_DIR` | System temp | Thumbnail cache |
| `PYTHON_VENV_PATH` | (none) | Python venv path |
| `MIN_FACE_CONFIDENCE` | `0.95` | Face detection threshold |
| `ENABLE_RATE_LIMITING` | `true` | Enable rate limiting |

### Cron Schedules

| Variable | Default | Description |
|----------|---------|-------------|
| `CRON_DAILY_MEMORIES` | `0 6 * * *` | Daily at 6 AM |
| `CRON_WEEKLY_MEMORIES` | `0 7 * * MON` | Monday at 7 AM |
| `CRON_MONTHLY_MEMORIES` | `0 8 1 * *` | 1st at 8 AM |

---

## Reverse Proxy Setup

### Nginx Configuration

Create `/etc/nginx/sites-available/photo-viewer`:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # API proxy
    location /api {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Static files (if serving client from nginx)
    location / {
        root /opt/photo-viewer/client/dist;
        try_files $uri $uri/ /index.html;
    }
}
```

Enable and restart:

```bash
sudo ln -s /etc/nginx/sites-available/photo-viewer /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### SSL with Let's Encrypt

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal is configured automatically
```

---

## Security Considerations

### 1. File Permissions

```bash
# Application files
chmod -R 755 /opt/photo-viewer
chown -R photoviewer:photoviewer /opt/photo-viewer

# Database directory (writable)
chmod 770 /opt/photo-viewer/server/data
chown photoviewer:photoviewer /opt/photo-viewer/server/data

# Photos directory (read-only)
chmod 755 /data/photos
```

### 2. Firewall

```bash
# Allow only necessary ports
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 3. Environment Variables

```bash
# Never commit .env file
# Use secrets management in production
# Rotate API keys regularly
```

### 4. Rate Limiting

Configure in `.env`:

```bash
ENABLE_RATE_LIMITING=true
RATE_LIMIT_MAX_REQUESTS=100  # per 15 minutes
RATE_LIMIT_WINDOW_MS=900000
```

---

##troubleshooting

### Server Won't Start

**Error**: `PHOTOS_DIR environment variable is required`

**Solution**: Set `PHOTOS_DIR` in `.env` file

```bash
echo "PHOTOS_DIR=/path/to/photos" >> .env
```

### CORS Errors

**Error**: `Origin not allowed by CORS`

**Solution**: Update `CORS_ORIGIN` in `.env`

```bash
# Single origin
CORS_ORIGIN=https://yourdomain.com

# Multiple origins
CORS_ORIGIN=https://app.com,https://admin.app.com
```

### Face Detection Not Working

**Error**: Python script fails

**Solution**: Check Python environment

```bash
# Verify Python installation
which python3

# Test Python packages
python3 -c "import cv2, insightface; print('OK')"

# Set PYTHON_VENV_PATH if using venv
PYTHON_VENV_PATH=/opt/photo-viewer/venv_onnx
```

### Photos Not Loading

**Error**: `Failed to fetch photos`

**Solution**: Check permissions

```bash
# Verify photos directory is accessible
ls -la /path/to/photos

# Check server can read photos
sudo -u photoviewer ls /path/to/photos
```

### Memory Issues

**Error**: `JavaScript heap out of memory`

**Solution**: Increase Node.js memory

```bash
# Set Node.js memory limit
NODE_OPTIONS=--max-old-space-size=4096 node server/dist/index.js

# Or in PM2
pm2 start server/dist/index.js --node-args="--max-old-space-size=4096"
```

---

## Monitoring

### Health Check

```bash
# Check application health
curl http://localhost:3002/health

# Expected response
{
  "status": "ok",
  "environment": "production",
  "timestamp": "2026-01-27T12:00:00.000Z",
  "checks": {
    "photosDirectory": "accessible",
    "databaseDirectory": "accessible"
  }
}
```

### Logs

```bash
# Docker logs
docker-compose logs -f

# PM2 logs
pm2 logs photo-viewer

# Systemd logs
sudo journalctl -u photo-viewer -f
```

### Performance Monitoring

```bash
# With PM2
pm2 monit

# System resources
htop
```

---

## Backup Strategy

### Database Backup

```bash
# Backup faces database
cp server/data/faces.db server/data/faces.db.backup-$(date +%Y%m%d)

# Automated backup script
#!/bin/bash
BACKUP_DIR="/backups/photo-viewer"
DATE=$(date +%Y%m%d-%H%M%S)
mkdir -p $BACKUP_DIR
cp server/data/faces.db "$BACKUP_DIR/faces-$DATE.db"
# Keep only last 7 days
find $BACKUP_DIR -name "faces-*.db" -mtime +7 -delete
```

### Photo Backup

Photos should be backed up separately using your preferred backup solution (rsync, Backblaze, AWS S3, etc.)

---

## Scaling

### Horizontal Scaling

Use load balancer with multiple instances:

```yaml
# docker-compose.yml for scaling
services:
  photo-viewer:
    deploy:
      replicas: 3
```

### Database Optimization

For large libraries (>10,000 photos):
- Consider PostgreSQL instead of SQLite
- Implement database connection pooling
- Add read replicas for face queries

---

## Support

For issues and questions:
- Check logs first
- Review environment configuration
- Consult troubleshooting section
- Open GitHub issue with:
  - Environment details
  - Error logs
  - Steps to reproduce

---

Generated with Claude Code - https://claude.com/claude-code
