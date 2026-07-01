import multer from 'multer';
import path from 'path';

import dotenv from 'dotenv';
dotenv.config();

import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Office / archive MIME types (treated as Cloudinary `raw` so they don't get
// pushed through the image pipeline, which would 415 on anything non-image).
const OFFICE_MIMES = new Set([
    'application/pdf',
    'application/zip',
    'application/x-zip-compressed',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
]);

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        const isRaw = OFFICE_MIMES.has(file.mimetype);
        const ext = path.extname(file.originalname);
        const basename = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_\.]/g, '_');

        return {
            folder: 'gamified_learning_avatars',
            // Explicitly route documents/archives to raw delivery so the browser
            // gets a proper download / inline render instead of a 415 from
            // Cloudinary's image transform pipeline.
            resource_type: isRaw ? 'raw' : 'image',
            allowedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'zip', 'doc', 'docx', 'ppt', 'pptx'],
            // Raw types need the extension in the public_id so Cloudinary serves
            // the right Content-Type. Images don't — Cloudinary derives it.
            public_id: isRaw ? `${basename}_${Date.now()}${ext}` : `${basename}_${Date.now()}`
        };
    }
});

// Allow images, PDFs, ZIPs, Word docs, and PowerPoint decks.
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || OFFICE_MIMES.has(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Allowed file types: image, PDF, ZIP, DOC/DOCX, PPT/PPTX'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    }
});

export default upload;
