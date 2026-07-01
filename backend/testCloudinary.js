import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';

dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const testUpload = async () => {
    try {
        // Create a dummy image
        const dummyPath = path.join(process.cwd(), 'dummy.png');
        // create a tiny 1x1 png file buffer
        const pngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==', 'base64');
        fs.writeFileSync(dummyPath, pngBuffer);

        console.log('Uploading to Cloudinary...');
        const result = await cloudinary.uploader.upload(dummyPath, { folder: 'gamified_learning_avatars' });
        console.log('Upload successful:', result.secure_url);
        
        fs.unlinkSync(dummyPath);
    } catch (err) {
        console.error('Upload failed:', err);
    }
};

testUpload();
