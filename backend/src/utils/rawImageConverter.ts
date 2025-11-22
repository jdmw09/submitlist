import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';

const execAsync = promisify(exec);

/**
 * RAW Image Converter Utility
 * Converts RAW image formats (DNG, CR2, NEF, ARW) to JPEG
 * Uses dcraw for RAW decoding and sharp for final compression
 */

/**
 * Check if a file is a RAW image that needs conversion
 */
export function isRawImage(mimeType: string): boolean {
  const rawTypes = [
    'image/x-adobe-dng',
    'image/dng',
    'image/x-canon-cr2',
    'image/x-nikon-nef',
    'image/x-sony-arw',
    'application/octet-stream', // iOS sometimes sends RAW as this
  ];
  return rawTypes.includes(mimeType.toLowerCase());
}

/**
 * Check if file extension is a RAW format
 */
export function isRawExtension(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ['.dng', '.cr2', '.nef', '.arw'].includes(ext);
}

/**
 * Convert a RAW image to JPEG
 * @param inputPath - Path to the RAW image file
 * @returns Promise with the new JPEG file path
 */
export async function convertRawToJpeg(inputPath: string): Promise<{
  newPath: string;
  originalSize: number;
  convertedSize: number;
}> {
  const originalStats = await fs.stat(inputPath);
  const originalSize = originalStats.size;

  const dir = path.dirname(inputPath);
  const baseName = path.basename(inputPath, path.extname(inputPath));
  const ppmPath = path.join(dir, `${baseName}.ppm`);
  const jpegPath = path.join(dir, `${baseName}.jpg`);

  console.log(`[RAW Converter] Converting: ${path.basename(inputPath)}`);
  console.log(`  Original size: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);

  try {
    // Step 1: Use dcraw to convert RAW to PPM (portable pixmap)
    // -c outputs to stdout, -w uses camera white balance, -q 3 is high quality
    await execAsync(`dcraw -c -w -q 3 "${inputPath}" > "${ppmPath}"`, {
      timeout: 60000, // 60 second timeout
    });

    // Step 2: Use sharp to convert PPM to optimized JPEG
    await sharp(ppmPath)
      .resize({
        width: 1920,
        height: undefined,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({
        quality: 90,
        mozjpeg: true,
      })
      .withMetadata({
        exif: {},
      })
      .toFile(jpegPath);

    // Step 3: Clean up intermediate PPM file
    await fs.unlink(ppmPath).catch(() => {});

    // Step 4: Remove original RAW file
    await fs.unlink(inputPath).catch(() => {});

    const convertedStats = await fs.stat(jpegPath);
    const convertedSize = convertedStats.size;

    console.log(`  Converted size: ${(convertedSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Output: ${path.basename(jpegPath)}`);

    return {
      newPath: jpegPath,
      originalSize,
      convertedSize,
    };
  } catch (error) {
    // Clean up any partial files
    await fs.unlink(ppmPath).catch(() => {});
    await fs.unlink(jpegPath).catch(() => {});

    console.error(`[RAW Converter] Error converting ${inputPath}:`, error);
    throw new Error(`Failed to convert RAW image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Process RAW image and update database path
 * Similar to video compression flow
 */
export async function processRawImage(
  fullPath: string,
  completionId: number,
  updateDbCallback: (completionId: number, oldPath: string, newPath: string) => Promise<void>
): Promise<void> {
  try {
    const result = await convertRawToJpeg(fullPath);

    // Convert paths to relative format for database
    const oldRelativePath = fullPath.replace(/^.*\/uploads/, '/uploads');
    const newRelativePath = result.newPath.replace(/^.*\/uploads/, '/uploads');

    // Update database with new path
    await updateDbCallback(completionId, oldRelativePath, newRelativePath);

    console.log(`[RAW Converter] Database updated for completion ${completionId}`);
  } catch (error) {
    console.error(`[RAW Converter] Failed to process RAW image:`, error);
    // Don't throw - we want the completion to remain even if conversion fails
  }
}
