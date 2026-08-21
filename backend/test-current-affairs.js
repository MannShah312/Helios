// Integration Test Script for Current Affairs Pipeline
require('dotenv').config();

const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const connectDB = require('./config/db');
const currentAffairsService = require('./services/currentAffairsService');

const LOCAL_TEST_IMAGE = 'C:\\Users\\manns\\.gemini\\antigravity-ide\\brain\\8d04ae38-8c7a-4a48-b073-03210b257cb0\\sample_image_1787335718621.jpg';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function runTest() {
  try {
    // 1. Establish database connection
    console.log('Connecting to MongoDB Atlas...');
    await connectDB();
    console.log('Connected to Database successfully!');

    // 2. Upload test image to Cloudinary (simulating Multer upload)
    console.log('Uploading test image to Cloudinary...');
    const uploadResult = await cloudinary.uploader.upload(LOCAL_TEST_IMAGE, {
      folder: 'upsc-current-affairs-test',
    });
    console.log('Cloudinary Upload Done. Secure URL:', uploadResult.secure_url);

    // 3. Mock file object populated by Multer
    const mockFile = {
      path: uploadResult.secure_url,
      filename: uploadResult.public_id,
      mimetype: 'image/jpeg',
    };

    // 4. Trigger the service pipeline
    console.log('Running Current Affairs service pipeline (this will run Gemini and Search grounding)...');
    const result = await currentAffairsService.processImage(mockFile);

    console.log('\x1b[32m%s\x1b[0m', 'TEST SUCCESSFUL!');
    console.log('Date Detected:', result.date);
    console.log('Topics Detected Count:', result.topicCount);
    
    // Print a sample topic analysis for review
    if (result.topics && result.topics.length > 0) {
      const sample = result.topics[0];
      console.log('\n--- Sample Topic Analysis ---');
      console.log(`Topic #${sample.topicNumber}: ${sample.title}`);
      console.log(`Original Headline: ${sample.originalHeadline}`);
      console.log(`Short Description: ${sample.shortDescription}`);
      console.log(`Classification: ${sample.classification.gsPaper} | ${sample.classification.subject} | ${sample.classification.subSubject}`);
      console.log(`Importance: ${sample.importance}`);
      console.log('Sources:', JSON.stringify(sample.sources, null, 2));
      console.log('Revision Question:', sample.revision.question);
      console.log('Revision Answer:', sample.revision.answer);
      console.log('-------------------------------\n');
    }

  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', 'TEST FAILED:');
    console.error(error);
  } finally {
    // Terminate DB connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed.');
    process.exit(0);
  }
}

runTest();
