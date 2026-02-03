import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import slowDown from 'express-slow-down';
import cron from 'node-cron';
import path from 'path';
import { fileURLToPath } from 'url';
import photosRouter from './routes/photos.js';
import facesRouter from './routes/faces.js';
import memoriesRouter from './routes/memories.js';
import semanticSearchRouter from './routes/semanticSearch.js';
import smartAlbumsRouter from './routes/smartAlbums.js';
import documentIntelligenceRouter from './routes/documentIntelligence.js';
import indexingRouter from './routes/indexing.js';
import { generateDailyMemories, generateWeeklyMemories, generateMonthlyMemories } from './services/memoryService.js';
import { initAutoIndexing } from './services/autoIndexService.js';

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

// Rate limiting - protect against abuse
const ENABLE_RATE_LIMITING = process.env.ENABLE_RATE_LIMITING !== 'false';

if (ENABLE_RATE_LIMITING) {
  // General API rate limit
  const apiLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes default
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // 100 requests per window
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Stricter limits for expensive operations
  const expensiveOpLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // Only 10 requests per hour
    message: 'Too many face scanning requests, please try again later',
  });

  // Speed limiter - slow down repeated requests
  const speedLimiter = slowDown({
    windowMs: 15 * 60 * 1000, // 15 minutes
    delayAfter: 50, // Allow 50 requests per 15 minutes at full speed
    delayMs: (hits) => hits * 100, // Add 100ms delay per request above 50
  });

  app.use('/api', apiLimiter);
  app.use('/api', speedLimiter);
  app.use('/api/faces/scan', expensiveOpLimiter);
  app.use('/api/faces/cluster', expensiveOpLimiter);

  console.log('🛡️  Rate limiting enabled');
}

app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/photos', photosRouter);
app.use('/api/faces', facesRouter);
app.use('/api/memories', memoriesRouter);
app.use('/api/semantic-search', semanticSearchRouter);
app.use('/api/smart-albums', smartAlbumsRouter);
app.use('/api/documents', documentIntelligenceRouter);
app.use('/api/indexing', indexingRouter);

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

app.listen(PORT, HOST, () => {
  console.log(`\n✅ Server running on http://${HOST}:${PORT}`);
  console.log(`📊 Health check: http://${HOST}:${PORT}/health\n`);

  // Initialize auto-indexing in background
  initAutoIndexing();
});
