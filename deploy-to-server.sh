#!/bin/bash
# Complete deployment script for photo-viewer application
# Run this on your Ubuntu server

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Photo Viewer Production Deployment${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Get user inputs
echo -e "${YELLOW}Please provide the following information:${NC}"
read -p "Your GitHub username: " GITHUB_USER
read -p "Repository name (photo-viewer): " REPO_NAME
REPO_NAME=${REPO_NAME:-photo-viewer}
read -p "Your domain (or press Enter for IP access): " DOMAIN

# Update system
echo -e "\n${GREEN}📦 Step 1: Updating system...${NC}"
sudo apt update
sudo apt upgrade -y

# Install Node.js 20
echo -e "\n${GREEN}📦 Step 2: Installing Node.js 20...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Python and dependencies
echo -e "\n${GREEN}🐍 Step 3: Installing Python...${NC}"
sudo apt install -y python3 python3-pip python3-venv python3-dev
sudo apt install -y build-essential libgl1-mesa-glx libglib2.0-0

# Install Git
echo -e "\n${GREEN}📦 Step 4: Installing Git...${NC}"
sudo apt install -y git

# Install PM2
echo -e "\n${GREEN}📦 Step 5: Installing PM2 process manager...${NC}"
sudo npm install -g pm2

# Install Nginx
echo -e "\n${GREEN}📦 Step 6: Installing Nginx...${NC}"
sudo apt install -y nginx

# Create application directory
echo -e "\n${GREEN}📁 Step 7: Creating application directory...${NC}"
sudo mkdir -p /opt/photo-viewer
sudo chown $USER:$USER /opt/photo-viewer

# Clone repository
echo -e "\n${GREEN}📥 Step 8: Cloning repository...${NC}"
cd /opt/photo-viewer
if [ -d ".git" ]; then
    echo "Repository already exists, pulling latest changes..."
    git pull origin main
else
    git clone "https://github.com/$GITHUB_USER/$REPO_NAME.git" .
fi

# Install Node dependencies
echo -e "\n${GREEN}📦 Step 9: Installing Node.js dependencies...${NC}"
npm run install:all

# Setup Python virtual environment
echo -e "\n${GREEN}🐍 Step 10: Setting up Python environment...${NC}"
python3 -m venv venv_onnx
source venv_onnx/bin/activate
pip install --upgrade pip
pip install -r requirements_onnx.txt

# Build application
echo -e "\n${GREEN}🏗️  Step 11: Building application...${NC}"
npm run build

# Create data directories
echo -e "\n${GREEN}📁 Step 12: Creating data directories...${NC}"
sudo mkdir -p /data/photos
sudo mkdir -p /var/lib/photo-viewer/data
sudo mkdir -p /var/cache/photo-viewer
sudo mkdir -p /var/log/photo-viewer

# Set permissions
sudo chown -R $USER:$USER /var/lib/photo-viewer
sudo chown -R $USER:$USER /var/cache/photo-viewer
sudo chown -R $USER:$USER /var/log/photo-viewer
sudo chmod 755 /data/photos

# Create .env file
echo -e "\n${GREEN}⚙️  Step 13: Creating environment configuration...${NC}"
cat > .env <<EOF
# Production Environment Configuration
NODE_ENV=production
PORT=3002
HOST=0.0.0.0

# CORS Configuration
CORS_ORIGIN=http://localhost:3002

# Paths
PHOTOS_DIR=/data/photos
DB_DIR=/var/lib/photo-viewer/data
CACHE_DIR=/var/cache/photo-viewer
LOG_DIR=/var/log/photo-viewer

# Python Configuration
PYTHON_EXECUTABLE=python3
PYTHON_VENV_PATH=/opt/photo-viewer/venv_onnx
FACE_SERVICE_PATH=/opt/photo-viewer/server/face-service

# Face Detection
MIN_FACE_CONFIDENCE=0.95
ONNX_EXECUTION_PROVIDER=CPUExecutionProvider

# Performance
MAX_THUMBNAIL_SIZE=200
THUMBNAIL_QUALITY=60
MAX_IMAGE_SIZE=2400

# Security
ENABLE_RATE_LIMITING=true
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=900000
EOF

# Update CORS origin if domain provided
if [ ! -z "$DOMAIN" ]; then
    sed -i "s|CORS_ORIGIN=.*|CORS_ORIGIN=https://$DOMAIN|" .env
fi

# Start application with PM2
echo -e "\n${GREEN}🚀 Step 14: Starting application...${NC}"
pm2 delete photo-viewer 2>/dev/null || true
pm2 start server/dist/index.js --name photo-viewer
pm2 save
pm2 startup | tail -n 1 | sudo bash

# Configure Nginx
echo -e "\n${GREEN}🌐 Step 15: Configuring Nginx...${NC}"
if [ ! -z "$DOMAIN" ]; then
    # With domain
    sudo tee /etc/nginx/sites-available/photo-viewer > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    location /api {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
else
    # Without domain (IP access)
    SERVER_IP=$(curl -s ifconfig.me)
    sudo tee /etc/nginx/sites-available/photo-viewer > /dev/null <<EOF
server {
    listen 80;
    server_name $SERVER_IP;

    location /api {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
EOF
fi

sudo ln -sf /etc/nginx/sites-available/photo-viewer /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx

# Install SSL certificate if domain provided
if [ ! -z "$DOMAIN" ]; then
    echo -e "\n${GREEN}🔒 Step 16: Installing SSL certificate...${NC}"
    sudo apt install -y certbot python3-certbot-nginx
    sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN || echo "SSL setup skipped (manual configuration required)"
fi

# Configure firewall
echo -e "\n${GREEN}🔥 Step 17: Configuring firewall...${NC}"
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
echo "y" | sudo ufw enable || true

# Print summary
echo -e "\n${BLUE}========================================${NC}"
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo -e "${BLUE}========================================${NC}\n"

echo -e "${YELLOW}📝 Next Steps:${NC}"
echo -e "1. Upload your photos to /data/photos:"
echo -e "   ${GREEN}rsync -avz --progress /path/to/photos/ user@server:/data/photos/${NC}\n"

if [ ! -z "$DOMAIN" ]; then
    echo -e "2. Access your application:"
    echo -e "   ${GREEN}https://$DOMAIN/api/health${NC}"
else
    SERVER_IP=$(curl -s ifconfig.me)
    echo -e "2. Access your application:"
    echo -e "   ${GREEN}http://$SERVER_IP/api/health${NC}"
fi

echo -e "\n3. View application logs:"
echo -e "   ${GREEN}pm2 logs photo-viewer${NC}"

echo -e "\n4. Monitor application:"
echo -e "   ${GREEN}pm2 monit${NC}"

echo -e "\n${YELLOW}⚠️  Important:${NC}"
echo -e "- Application is running on port 3002"
echo -e "- Nginx proxies requests from port 80/443 to 3002"
echo -e "- Logs: pm2 logs photo-viewer"
echo -e "- Restart: pm2 restart photo-viewer"
echo -e "- Stop: pm2 stop photo-viewer"

echo -e "\n${GREEN}Happy photo viewing! 📸${NC}\n"
