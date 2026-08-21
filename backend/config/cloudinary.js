const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary credentials
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Helper check to verify if Cloudinary credentials are valid
const isCloudinaryConfigured = () => {
  const name = process.env.CLOUDINARY_CLOUD_NAME;
  const key = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;
  
  return (
    name && name !== 'your_cloud_name' &&
    key && key !== 'your_api_key' &&
    secret && secret !== 'your_api_secret'
  );
};

if (!isCloudinaryConfigured()) {
  console.log('\x1b[33m%s\x1b[0m', '==================================================================');
  console.log('\x1b[33m%s\x1b[0m', 'WARNING: Cloudinary is not fully configured in your .env file.');
  console.log('\x1b[33m%s\x1b[0m', 'Image uploads will fail until valid credentials are provided.');
  console.log('\x1b[33m%s\x1b[0m', '==================================================================');
}

// Setup Cloudinary storage engine for Multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'news_tracker',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1000, height: 1000, crop: 'limit' }], // Limit max size to protect storage
  },
});

// Multer upload middleware configuration
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // Limit files to 5MB
  },
  fileFilter: (req, file, cb) => {
    // Double-check configuration before starting the stream
    if (!isCloudinaryConfigured()) {
      return cb(new Error('Cloudinary credentials are not configured in backend/.env'));
    }
    cb(null, true);
  }
});

module.exports = {
  upload,
  cloudinary,
};
