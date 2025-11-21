import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';

/**
 * Image Compression Utility
 * Compresses images synchronously during upload
 *
 * Features:
 * - Resize to max 1920px width (maintains aspect ratio)
 * - High quality JPEG compression (90%)
 * - Convert PNG/WebP to JPEG for consistency
 * - Convert HEIC to JPEG
 * - Strip metadata to save space
 * - Replace original file
 */

interface CompressionOptions {
  maxWidth?: number;
  quality?: number;
  format?: 'jpeg' | 'webp' | 'png';
}

const DEFAULT_OPTIONS: CompressionOptions = {
  maxWidth: 1920,
  quality: 90,
  format: 'jpeg',
};

/**
 * Compress an image file
 * @param filePath - Absolute path to the image file
 * @param options - Compression options
 * @returns Promise with compressed file info
 */
export async function compressImage(
  filePath: string,
  options: CompressionOptions = {}
): Promise<{
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  newPath: string;
}> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  try {
    // Get original file size
    const stats = await fs.stat(filePath);
    const originalSize = stats.size;

    // Read image metadata
    const metadata = await sharp(filePath).metadata();

    // Determine if resizing is needed
    const needsResize = metadata.width && metadata.width > opts.maxWidth!;

    // Process image
    let pipeline = sharp(filePath);

    // Resize if needed
    if (needsResize) {
      pipeline = pipeline.resize({
        width: opts.maxWidth,
        height: undefined, // Maintain aspect ratio
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    // Apply format-specific compression
    switch (opts.format) {
      case 'jpeg':
        pipeline = pipeline.jpeg({
          quality: opts.quality,
          mozjpeg: true, // Better compression
        });
        break;
      case 'webp':
        pipeline = pipeline.webp({
          quality: opts.quality,
        });
        break;
      case 'png':
        pipeline = pipeline.png({
          compressionLevel: 9,
          quality: opts.quality,
        });
        break;
    }

    // Strip metadata
    pipeline = pipeline.withMetadata({
      exif: {}, // Remove EXIF data
    });

    // Generate temporary output path
    const ext = opts.format === 'jpeg' ? '.jpg' : `.${opts.format}`;
    const tempPath = filePath.replace(path.extname(filePath), `.temp${ext}`);

    // Save compressed image
    await pipeline.toFile(tempPath);

    // Get compressed file size
    const compressedStats = await fs.stat(tempPath);
    const compressedSize = compressedStats.size;

    // Replace original file
    await fs.unlink(filePath);

    // Generate final path (may have different extension)
    const newPath = filePath.replace(path.extname(filePath), ext);
    await fs.rename(tempPath, newPath);

    // Calculate compression ratio
    const compressionRatio = originalSize > 0
      ? ((originalSize - compressedSize) / originalSize) * 100
      : 0;

    console.log(`[Image Compression] ${path.basename(filePath)}`);
    console.log(`  Original: ${(originalSize / 1024).toFixed(2)} KB`);
    console.log(`  Compressed: ${(compressedSize / 1024).toFixed(2)} KB`);
    console.log(`  Saved: ${compressionRatio.toFixed(1)}%`);

    return {
      originalSize,
      compressedSize,
      compressionRatio,
      newPath,
    };
  } catch (error) {
    console.error(`[Image Compression Error] ${filePath}:`, error);
    throw new Error(`Failed to compress image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if a file is an image that should be compressed
 * @param mimeType - File MIME type
 * @returns boolean
 */
export function shouldCompressImage(mimeType: string): boolean {
  const compressibleTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'image/tiff',
  ];

  return compressibleTypes.includes(mimeType.toLowerCase());
}

/**
 * Get file size in KB
 * @param filePath - Path to file
 * @returns File size in KB
 */
export async function getFileSizeKB(filePath: string): Promise<number> {
  try {
    const stats = await fs.stat(filePath);
    return stats.size / 1024;
  } catch (error) {
    return 0;
  }
}
