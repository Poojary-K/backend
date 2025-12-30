import multer from 'multer';
import type { RequestHandler } from 'express';
import { HttpError } from './errorHandler.js';
import { getConfig } from '../config/env.js';

const { gdriveMaxFileSizeMb, gdriveMaxFiles } = getConfig();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: gdriveMaxFileSizeMb * 1024 * 1024,
    files: gdriveMaxFiles,
  },
  fileFilter: (_req, file, callback) => {
    if (!file.mimetype.startsWith('image/')) {
      callback(new HttpError('Only image files are allowed', 400));
      return;
    }
    callback(null, true);
  },
});

const mapUploadError = (error: unknown): HttpError => {
  if (error instanceof HttpError) {
    return error;
  }
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return new HttpError('Image file size exceeds the limit', 400);
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return new HttpError('Too many images in one request', 400);
    }
    return new HttpError(error.message, 400);
  }
  return new HttpError('Failed to process uploaded file', 400);
};

export const uploadImages = (fieldName: string, maxFiles = gdriveMaxFiles): RequestHandler => {
  return (req, res, next) => {
    upload.array(fieldName, maxFiles)(req, res, (error) => {
      if (error) {
        next(mapUploadError(error));
        return;
      }
      next();
    });
  };
};

export const uploadSingleImage = (fieldName: string): RequestHandler => {
  return (req, res, next) => {
    upload.single(fieldName)(req, res, (error) => {
      if (error) {
        next(mapUploadError(error));
        return;
      }
      next();
    });
  };
};
