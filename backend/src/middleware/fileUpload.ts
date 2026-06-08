import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
        // Generate unique filename: timestamp-uuid-originalName
        const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

// File filter
const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    // Allow all file types as per requirement, but we can restrict if needed
    // For now, we allow everything but maybe block executables for security
    if (file.mimetype === 'application/x-msdownload' || file.mimetype === 'application/x-exe') {
        cb(null, false);
        return;
    }
    cb(null, true);
};

// Limits
const limits = {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
};

export const upload = multer({
    storage,
    fileFilter,
    limits
});
