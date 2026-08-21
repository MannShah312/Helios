const mongoose = require('mongoose');

const connectDB = async () => {
  const mongoURI = process.env.MONGO_URI;
  if (!mongoURI || mongoURI.includes('<username>') || mongoURI.includes('<password>')) {
    console.error('\x1b[31m%s\x1b[0m', '==================================================================');
    console.error('\x1b[31m%s\x1b[0m', 'CRITICAL ERROR: MongoDB Atlas URI is not configured in backend/.env');
    console.error('\x1b[31m%s\x1b[0m', '==================================================================');
    process.exit(1);
  }
  try {
    const conn = await mongoose.connect(mongoURI);
    console.log(`\x1b[32mMongoDB Connected: ${conn.connection.host}\x1b[0m`);
  } catch (error) {
    console.error(`\x1b[31mError connecting to MongoDB: ${error.message}\x1b[0m`);
    process.exit(1);
  }
};

module.exports = connectDB;
