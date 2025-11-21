import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import path from 'path';
import fs from 'fs/promises';

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

/**
 * Video Compression Utility
 * Compresses videos asynchronously in background
 *
 * Features:
 * - Max resolution: 1080p (1920x1080)
 * - H.264 codec for compatibility
 * - 2-pass encoding for better quality
 * - AAC audio codec
 * - Bitrate optimization
 * - Replace original file
 * - Progress tracking
 */

interface VideoCompressionOptions {
  maxHeight?: number;
  videoBitrate?: string;
  audioBitrate?: string;
  codec?: string;
  audioCodec?: string;
}

const DEFAULT_OPTIONS: VideoCompressionOptions = {
  maxHeight: 1080,
  videoBitrate: '2500k', // Good quality for 1080p
  audioBitrate: '128k',
  codec: 'libx264',
  audioCodec: 'aac',
};

export interface VideoCompressionProgress {
  percent: number;
  currentFps: number;
  currentKbps: number;
  targetSize: string;
  timemark: string;
}

export interface VideoCompressionResult {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  newPath: string;
  duration: number;
}

/**
 * Compress a video file
 * @param filePath - Absolute path to the video file
 * @param options - Compression options
 * @param onProgress - Progress callback
 * @returns Promise with compressed file info
 */
export async function compressVideo(
  filePath: string,
  options: VideoCompressionOptions = {},
  onProgress?: (progress: VideoCompressionProgress) => void
): Promise<VideoCompressionResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return new Promise(async (resolve, reject) => {
    try {
      // Get original file size
      const stats = await fs.stat(filePath);
      const originalSize = stats.size;

      // Generate temporary output path
      const ext = '.mp4';
      const tempPath = filePath.replace(path.extname(filePath), `.temp${ext}`);

      console.log(`[Video Compression] Starting: ${path.basename(filePath)}`);
      console.log(`  Original size: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);

      const startTime = Date.now();

      // Probe video to get metadata
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          reject(new Error(`Failed to probe video: ${err.message}`));
          return;
        }

        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        if (!videoStream) {
          reject(new Error('No video stream found'));
          return;
        }

        const currentHeight = videoStream.height || 0;
        const currentWidth = videoStream.width || 0;

        // Calculate scale if needed (maintain aspect ratio)
        let scale: string | undefined;
        if (currentHeight > opts.maxHeight!) {
          const aspectRatio = currentWidth / currentHeight;
          const newWidth = Math.round(opts.maxHeight! * aspectRatio);
          // Ensure dimensions are divisible by 2 (required by H.264)
          const evenWidth = newWidth % 2 === 0 ? newWidth : newWidth - 1;
          scale = `${evenWidth}:${opts.maxHeight}`;
        }

        // Start compression
        let command = ffmpeg(filePath)
          .videoCodec(opts.codec!)
          .audioCodec(opts.audioCodec!)
          .videoBitrate(opts.videoBitrate!)
          .audioBitrate(opts.audioBitrate!)
          .format('mp4')
          // Optimize for web streaming
          .outputOptions([
            '-movflags', '+faststart', // Enable progressive download
            '-preset', 'medium', // Balance between speed and quality
            '-crf', '23', // Constant Rate Factor (18-28, lower = better quality)
          ]);

        // Apply scaling if needed
        if (scale) {
          command = command.size(scale);
          console.log(`  Scaling to: ${scale}`);
        }

        // Track progress
        command.on('progress', (progress) => {
          if (onProgress) {
            onProgress({
              percent: progress.percent || 0,
              currentFps: progress.currentFps || 0,
              currentKbps: progress.currentKbps || 0,
              targetSize: progress.targetSize || '0kB',
              timemark: progress.timemark || '00:00:00',
            });
          }

          // Log progress every 10%
          if (progress.percent && progress.percent % 10 < 1) {
            console.log(`  Progress: ${progress.percent.toFixed(1)}%`);
          }
        });

        // Handle completion
        command.on('end', async () => {
          try {
            // Get compressed file size
            const compressedStats = await fs.stat(tempPath);
            const compressedSize = compressedStats.size;

            // Calculate duration
            const duration = Date.now() - startTime;

            // Calculate compression ratio
            const compressionRatio = originalSize > 0
              ? ((originalSize - compressedSize) / originalSize) * 100
              : 0;

            console.log(`[Video Compression] Completed: ${path.basename(filePath)}`);
            console.log(`  Compressed: ${(compressedSize / 1024 / 1024).toFixed(2)} MB`);
            console.log(`  Saved: ${compressionRatio.toFixed(1)}%`);
            console.log(`  Duration: ${(duration / 1000).toFixed(1)}s`);

            // Replace original file
            await fs.unlink(filePath);

            // Generate final path
            const newPath = filePath.replace(path.extname(filePath), ext);
            await fs.rename(tempPath, newPath);

            resolve({
              originalSize,
              compressedSize,
              compressionRatio,
              newPath,
              duration,
            });
          } catch (error) {
            reject(error);
          }
        });

        // Handle errors
        command.on('error', (err) => {
          console.error(`[Video Compression Error] ${filePath}:`, err.message);
          reject(new Error(`Failed to compress video: ${err.message}`));
        });

        // Save to temp file
        command.save(tempPath);
      });
    } catch (error) {
      console.error(`[Video Compression Error] ${filePath}:`, error);
      reject(error);
    }
  });
}

/**
 * Check if a file is a video that should be compressed
 * @param mimeType - File MIME type
 * @returns boolean
 */
export function shouldCompressVideo(mimeType: string): boolean {
  const compressibleTypes = [
    'video/mp4',
    'video/quicktime', // .mov
    'video/x-m4v',
    'video/avi',
    'video/x-msvideo',
    'video/webm',
  ];

  return compressibleTypes.includes(mimeType.toLowerCase());
}

/**
 * Get video duration in seconds
 * @param filePath - Path to video file
 * @returns Duration in seconds
 */
export async function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(metadata.format.duration || 0);
    });
  });
}

/**
 * Generate video thumbnail
 * @param filePath - Path to video file
 * @param outputPath - Path to save thumbnail
 * @param timeInSeconds - Time to capture thumbnail (default: 1 second)
 * @returns Promise
 */
export async function generateThumbnail(
  filePath: string,
  outputPath: string,
  timeInSeconds: number = 1
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(filePath)
      .screenshots({
        timestamps: [timeInSeconds],
        filename: path.basename(outputPath),
        folder: path.dirname(outputPath),
        size: '320x240',
      })
      .on('end', () => resolve())
      .on('error', (err) => reject(err));
  });
}
