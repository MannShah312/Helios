const express = require('express');
const cors = require('cors');
const articleRoutes = require('./routes/articleRoutes');
const currentAffairsRoutes = require('./routes/currentAffairsRoutes');

const app = express();

// Enable Cross-Origin Resource Sharing (CORS)
app.use(cors());

// Body parser to process JSON payloads
app.use(express.json());

// Root health check endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'News Tracker API is running',
    version: '1.0.0',
  });
});

// Register API Routes
app.use('/api/articles', articleRoutes);
app.use('/api/current-affairs', currentAffairsRoutes);

// Catch 404 Route Not Found
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Endpoint not found: ${req.method} ${req.originalUrl}`,
  });
});

// Central Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('\x1b[31m%s\x1b[0m', `Error processing request: ${err.message}`);
  if (err.stack) {
    console.error(err.stack);
  }

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((val) => val.message);
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors: messages,
    });
  }

  // Handle MongoDB duplicate key error
  if (err.code === 11000) {
    return res.status(400).json({
      success: false,
      message: 'Duplicate key error: A record with this unique value already exists.',
    });
  }

  // General server error fallback
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

module.exports = app;
