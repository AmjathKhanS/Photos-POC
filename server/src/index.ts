import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import photosRouter from './routes/photos.js';
import facesRouter from './routes/faces.js';
import memoriesRouter from './routes/memories.js';
import { generateDailyMemories, generateWeeklyMemories, generateMonthlyMemories } from './services/memoryService.js';

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/photos', photosRouter);
app.use('/api/faces', facesRouter);
app.use('/api/memories', memoriesRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ============ Scheduled Tasks for Smart Memories ============

// Run daily at 6:00 AM - Generate "On This Day" memories
cron.schedule('0 6 * * *', async () => {
  console.log('[CRON] Running daily memory generation (On This Day)...');
  try {
    await generateDailyMemories();
    console.log('[CRON] Daily memories generated successfully');
  } catch (error) {
    console.error('[CRON] Error generating daily memories:', error);
  }
});

// Run weekly on Monday at 7:00 AM - Generate weekly highlights
cron.schedule('0 7 * * MON', async () => {
  console.log('[CRON] Running weekly memory generation...');
  try {
    await generateWeeklyMemories();
    console.log('[CRON] Weekly memories generated successfully');
  } catch (error) {
    console.error('[CRON] Error generating weekly memories:', error);
  }
});

// Run monthly on 1st day at 8:00 AM - Generate monthly highlights
cron.schedule('0 8 1 * *', async () => {
  console.log('[CRON] Running monthly memory generation...');
  try {
    await generateMonthlyMemories();
    console.log('[CRON] Monthly memories generated successfully');
  } catch (error) {
    console.error('[CRON] Error generating monthly memories:', error);
  }
});

console.log('[CRON] Scheduled tasks initialized:');
console.log('  - Daily memories: Every day at 6:00 AM');
console.log('  - Weekly highlights: Every Monday at 7:00 AM');
console.log('  - Monthly highlights: 1st of each month at 8:00 AM');

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
