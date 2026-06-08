import { Router, Request, Response } from 'express';
import { upload } from '../middleware/fileUpload';
import { authenticateTokenHTTP } from '../middleware/auth';

const router = Router();

router.post('/', authenticateTokenHTTP, upload.single('file'), (req: Request, res: Response): void => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No file uploaded' });
            return;
        }

        const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

        res.json({
            url: fileUrl,
            filename: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'File upload failed' });
    }
});

export default router;
