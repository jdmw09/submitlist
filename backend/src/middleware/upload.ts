import multer from 'multer';
import path from 'path';
import { Request } from 'express';

const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Log all incoming files for debugging iOS issues
  console.log(`[Upload] Incoming file: ${file.originalname}, MIME: ${file.mimetype}, size: ${file.size || 'unknown'}`);

  // Support standard and Apple-specific formats, plus CSV
  // Added dng for iPhone RAW photos, cr2/nef/arw for other camera RAW formats
  const allowedTypes = /jpeg|jpg|png|gif|webp|heic|heif|tiff|tif|dng|cr2|nef|arw|mp4|mov|m4v|avi|webm|pdf|doc|docx|csv/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());

  // MIME types for Apple formats: image/heic, image/heif, video/x-m4v, video/quicktime (mov)
  // Added x-adobe-dng, x-canon-cr2, x-nikon-nef, x-sony-arw for RAW camera formats
  // Also allow application/octet-stream as iOS Safari sometimes sends this for video/RAW files
  const allowedMimes = /(image|video)\/(jpeg|jpg|png|gif|webp|heic|heif|tiff|x-tiff|x-adobe-dng|dng|x-canon-cr2|x-nikon-nef|x-sony-arw|mp4|quicktime|x-m4v|x-quicktime|avi|webm|x-msvideo)|(application)\/(octet-stream|pdf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document)|(text)\/(csv|plain)/;
  const mimetype = allowedMimes.test(file.mimetype);

  if (mimetype || extname) {
    return cb(null, true);
  } else {
    // Log rejected files for debugging
    console.error(`[Upload] Rejected file: ${file.originalname}, MIME: ${file.mimetype}, ext: ${path.extname(file.originalname)}`);
    cb(new Error('Invalid file type. Only images, videos, documents, and CSV files are allowed.'));
  }
};

export const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '209715200'), // 200MB default (free accounts have 250MB storage)
  },
  fileFilter: fileFilter,
});
