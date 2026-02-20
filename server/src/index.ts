import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { rateLimit } from 'express-rate-limit';
import slowDown from 'express-slow-down';
import cron from 'node-cron';
import path from 'path';
import { fileURLToPath } from 'url';
import photosRouter from './routes/photos.js';
import videosRouter from './routes/videos.js';
import facesRouter from './routes/faces.js';
import memoriesRouter from './routes/memories.js';
import semanticSearchRouter from './routes/semanticSearch.js';
import smartAlbumsRouter from './routes/smartAlbums.js';
import documentIntelligenceRouter from './routes/documentIntelligence.js';
import indexingRouter from './routes/indexing.js';
import locationsRouter from './routes/locations.js';
import { generateDailyMemories, generateWeeklyMemories, generateMonthlyMemories } from './services/memoryService.js';
import { initAutoIndexing } from './services/autoIndexService.js';
import { preloadAllThumbnails } from './services/thumbnailPreloader.js';
// import { startPeriodicPhotoCheck } from './services/photoService.js'; // Not exported in cloud version
import { initLocationTables } from './services/locationDb.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============ Environment Variable Validation ============

const NODE_ENV = process.env.NODE_ENV || 'development';

// Validate required environment variables
if (!process.env.PHOTOS_DIR) {
  console.error('❌ FATAL: PHOTOS_DIR environment variable is required!');
  console.error('Please set PHOTOS_DIR to your photos directory.');
  console.error('Example: PHOTOS_DIR=/home/user/photos');
  process.exit(1);
}

// CORS origin configuration
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
const corsOrigins = CORS_ORIGIN.split(',').map(origin => origin.trim());

console.log('🚀 Starting Photo Viewer Server...');
console.log(`📝 Environment: ${NODE_ENV}`);
console.log(`📁 Photos Directory: ${process.env.PHOTOS_DIR}`);
console.log(`🌐 CORS Origins: ${corsOrigins.join(', ')}`);

const app = express();
const PORT = parseInt(process.env.PORT || '3002');
const HOST = process.env.HOST || '0.0.0.0';

// ============ Middleware ============

// Security headers with Helmet
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow loading images from API
  contentSecurityPolicy: NODE_ENV === 'production' ? undefined : false // Disable in dev for easier debugging
}));

// CORS Configuration - supports multiple origins
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    // Check if origin is allowed
    if (corsOrigins.includes('*') || corsOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true
}));

// Response compression (gzip/deflate)
app.use(compression({
  filter: (req, res) => {
    // Don't compress images (already compressed)
    if (req.path.includes('/thumbnail/') || req.path.includes('/full/')) {
      return false;
    }
    // Compress everything else
    return compression.filter(req, res);
  },
  level: 6 // Balance between speed and compression ratio
}));

// Rate limiting - protect against abuse
const ENABLE_RATE_LIMITING = process.env.ENABLE_RATE_LIMITING !== 'false';

if (ENABLE_RATE_LIMITING) {
  // General API rate limit - ultra-high for local file access
  const apiLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes default
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '1000000'), // 1M requests per window for local files
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    // Skip rate limiting for frequently polled endpoints and status checks
    skip: (req) => {
      const exemptPaths = [
        '/api/smart-albums/generate',
        '/api/faces/scan',
        '/api/faces/cluster',
        '/api/faces/scan/status',
        '/api/faces/persons',
        '/api/faces/stats',
        '/api/semantic-search/index',
        '/api/indexing/status',
        '/api/photos',
        '/api/memories',
        '/api/locations',
        '/api/smart-albums'
      ];
      return exemptPaths.some(path => req.path.includes(path));
    }
  });

  // Stricter limits for expensive operations (relaxed for development)
  const expensiveOpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes (was 1 hour)
    max: NODE_ENV === 'production' ? 100 : 100000, // 100k for dev, 100 for production
    message: 'Too many requests, please try again later',
  });

  // Speed limiter - disabled for local file access (no delay)
  const speedLimiter = slowDown({
    windowMs: 15 * 60 * 1000, // 15 minutes
    delayAfter: 1000000, // Allow 1M requests at full speed
    delayMs: () => 0, // No delay for local files
  });

  app.use('/api', apiLimiter);
  app.use('/api', speedLimiter);
  app.use('/api/faces/scan', expensiveOpLimiter);
  app.use('/api/faces/cluster', expensiveOpLimiter);
  app.use('/api/smart-albums/generate', expensiveOpLimiter);

  console.log('🛡️  Rate limiting enabled (relaxed for local files)');
}

app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/photos', photosRouter);
app.use('/api/videos', videosRouter);
app.use('/api/faces', facesRouter);
app.use('/api/memories', memoriesRouter);
app.use('/api/semantic-search', semanticSearchRouter);
app.use('/api/smart-albums', smartAlbumsRouter);
app.use('/api/documents', documentIntelligenceRouter);
app.use('/api/indexing', indexingRouter);
app.use('/api/locations', locationsRouter);

// Health check endpoint with detailed status
app.get('/health', async (req, res) => {
  const fs = await import('fs/promises');

  try {
    // Check photos directory
    const photosDir = process.env.PHOTOS_DIR!;
    await fs.access(photosDir);

    // Check database directory
    const dbDir = process.env.DB_DIR || path.join(__dirname, '../data');
    await fs.access(dbDir);

    res.json({
      status: 'ok',
      environment: NODE_ENV,
      timestamp: new Date().toISOString(),
      checks: {
        photosDirectory: 'accessible',
        databaseDirectory: 'accessible'
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'degraded',
      environment: NODE_ENV,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Health check failed'
    });
  }
});

// ============ Scheduled Tasks for Smart Memories ============

// Get cron schedules from environment variables or use defaults
const CRON_DAILY = process.env.CRON_DAILY_MEMORIES || '0 6 * * *';
const CRON_WEEKLY = process.env.CRON_WEEKLY_MEMORIES || '0 7 * * MON';
const CRON_MONTHLY = process.env.CRON_MONTHLY_MEMORIES || '0 8 1 * *';

// Run daily - Generate "On This Day" memories
cron.schedule(CRON_DAILY, async () => {
  console.log('[CRON] Running daily memory generation (On This Day)...');
  try {
    await generateDailyMemories();
    console.log('[CRON] ✅ Daily memories generated successfully');
  } catch (error) {
    console.error('[CRON] ❌ Error generating daily memories:', error);
  }
});

// Run weekly - Generate weekly highlights
cron.schedule(CRON_WEEKLY, async () => {
  console.log('[CRON] Running weekly memory generation...');
  try {
    await generateWeeklyMemories();
    console.log('[CRON] ✅ Weekly memories generated successfully');
  } catch (error) {
    console.error('[CRON] ❌ Error generating weekly memories:', error);
  }
});

// Run monthly - Generate monthly highlights
cron.schedule(CRON_MONTHLY, async () => {
  console.log('[CRON] Running monthly memory generation...');
  try {
    await generateMonthlyMemories();
    console.log('[CRON] ✅ Monthly memories generated successfully');
  } catch (error) {
    console.error('[CRON] ❌ Error generating monthly memories:', error);
  }
});

console.log('⏰ Scheduled tasks initialized:');
console.log(`  - Daily memories: ${CRON_DAILY}`);
console.log(`  - Weekly highlights: ${CRON_WEEKLY}`);
console.log(`  - Monthly highlights: ${CRON_MONTHLY}`);

// ============ Start Server ============

const server = app.listen(PORT, HOST, () => {
  console.log(`\n✅ Server running on http://${HOST}:${PORT}`);
  console.log(`📊 Health check: http://${HOST}:${PORT}/health\n`);

  // Initialize location tables if they don't exist
  initLocationTables();

  // Initialize auto-indexing in background
  initAutoIndexing();

  // Pre-generate all thumbnails in background (async, doesn't block)
  setTimeout(() => {
    preloadAllThumbnails().catch(err =>
      console.error('Thumbnail preload error:', err)
    );
  }, 5000); // Wait 5 seconds after server starts

  // Start periodic check for new photos (every 2 minutes)
  // Disabled for cloud deployment - photos are on Cloudinary
  // setTimeout(() => {
  //   startPeriodicPhotoCheck(2 * 60 * 1000);
  // }, 10000); // Wait 10 seconds after server starts
});

// Enable HTTP keep-alive for persistent connections - optimized for local file access
server.keepAliveTimeout = 300000; // 5 minutes - ultra-long keep-alive for local files
server.headersTimeout = 301000; // Slightly longer than keepAliveTimeout
server.maxHeadersCount = 10000; // Allow 10k concurrent requests for instant thumbnail loading
