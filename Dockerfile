# Multi-stage Dockerfile for Photo Viewer Application
# Optimized for production deployment

# ===================================
# Stage 1: Build Client
# ===================================
FROM node:20-alpine AS client-builder

WORKDIR /app/client

# Copy client package files
COPY client/package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy client source
COPY client/ ./

# Build client
RUN npm run build

# ===================================
# Stage 2: Build Server
# ===================================
FROM node:20-alpine AS server-builder

WORKDIR /app/server

# Copy server package files
COPY server/package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy server source
COPY server/ ./

# Build server
RUN npm run build

# ===================================
# Stage 3: Setup Python Environment
# ===================================
FROM python:3.12-slim AS python-builder

WORKDIR /app

# Install system dependencies for Python packages
RUN apt-get update && apt-get install -y \
    build-essential \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy Python requirements
COPY requirements_onnx.txt ./
COPY server/face-service/requirements.txt ./face-service-requirements.txt

# Create virtual environment and install packages
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements_onnx.txt

# ===================================
# Stage 4: Production Runtime
# ===================================
FROM node:20-alpine

# Install Python and system dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    libstdc++ \
    libgomp \
    && ln -sf python3 /usr/bin/python

# Create app user
RUN addgroup -g 1001 -S photoviewer && \
    adduser -S -D -H -u 1001 -h /app -s /sbin/nologin -G photoviewer -g photoviewer photoviewer

WORKDIR /app

# Copy Python virtual environment from builder
COPY --from=python-builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy built server from builder
COPY --from=server-builder /app/server/dist ./server/dist
COPY --from=server-builder /app/server/node_modules ./server/node_modules
COPY --from=server-builder /app/server/package.json ./server/

# Copy Python scripts
COPY server/face-service ./server/face-service

# Copy built client from builder
COPY --from=client-builder /app/client/dist ./client/dist

# Create necessary directories
RUN mkdir -p /data/photos /data/db /var/cache/photo-viewer /var/log/photo-viewer && \
    chown -R photoviewer:photoviewer /app /data /var/cache/photo-viewer /var/log/photo-viewer

# Switch to non-root user
USER photoviewer

# Expose port
EXPOSE 3002

# Environment variables
ENV NODE_ENV=production \
    PORT=3002 \
    HOST=0.0.0.0 \
    PHOTOS_DIR=/data/photos \
    DB_DIR=/data/db \
    CACHE_DIR=/var/cache/photo-viewer \
    LOG_DIR=/var/log/photo-viewer \
    PYTHON_VENV_PATH=/opt/venv \
    FACE_SERVICE_PATH=/app/server/face-service

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3002/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start server
CMD ["node", "server/dist/index.js"]
