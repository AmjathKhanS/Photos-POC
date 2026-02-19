import { Router } from 'express';
import { getVideoList, getVideoPath, getVideoStats } from '../services/videoService.js';
import { generateVideoThumbnail, generatePlaceholderThumbnail } from '../services/videoThumbnailService.js';
import { validateFilename } from '../middleware/validation.js';
import fs from 'fs';
import path from 'path';

const router = Router();

// GET /api/videos - List all videos
router.get('/', async (req, res) => {
  try {
    const videos = await getVideoList();
    res.json({
      videos,
      total: videos.length,
    });
  } catch (error) {
    console.error('Error fetching videos:', error);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

// GET /api/videos/stream/:filename - Stream video with range support
router.get('/stream/:filename', validateFilename, async (req, res) => {
  try {
    const { filename } = req.params;
    const videoPath = await getVideoPath(filename);
    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      // Parse range header
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = (end - start) + 1;
      const file = fs.createReadStream(videoPath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': 'video/mp4',
      };

      res.writeHead(206, head);
      file.pipe(res);
    } else {
      // No range requested, send entire file
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
      };
      res.writeHead(200, head);
      fs.createReadStream(videoPath).pipe(res);
    }
  } catch (error) {
    console.error('Error streaming video:', error);
    res.status(500).json({ error: 'Failed to stream video' });
  }
});

// GET /api/videos/thumbnail/:filename - Generate video thumbnail
router.get('/thumbnail/:filename', validateFilename, async (req, res) => {
  try {
    const { filename } = req.params;
    const videoPath = await getVideoPath(filename);

    // Try to generate real thumbnail using ffmpeg
    const thumbnailBuffer = await generateVideoThumbnail(videoPath, filename);

    if (thumbnailBuffer) {
      // Real thumbnail generated successfully
      res.set('Content-Type', 'image/jpeg');
      res.set('Cache-Control', 'public, max-age=31536000, immutable');
      res.send(thumbnailBuffer);
    } else {
      // Fall back to placeholder
      const placeholderSvg = generatePlaceholderThumbnail(filename);
      res.set('Content-Type', 'image/svg+xml');
      res.set('Cache-Control', 'public, max-age=31536000, immutable');
      res.send(placeholderSvg);
    }
  } catch (error) {
    console.error('Error generating video thumbnail:', error);
    res.status(500).json({ error: 'Failed to generate thumbnail' });
  }
});

// GET /api/videos/info/:filename - Get video metadata
router.get('/info/:filename', validateFilename, async (req, res) => {
  try {
    const { filename } = req.params;
    const stats = await getVideoStats(filename);

    res.json({
      success: true,
      filename,
      size: stats.size,
      sizeFormatted: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
      mimeType: stats.mimeType,
    });
  } catch (error) {
    console.error('Error getting video info:', error);
    res.status(500).json({ error: 'Failed to get video info' });
  }
});

export default router;
