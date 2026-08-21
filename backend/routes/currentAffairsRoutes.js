const express = require('express');
const router = express.Router();
const currentAffairsController = require('../controllers/currentAffairsController');
const { upload } = require('../config/cloudinary');

// Route configurations

// POST /api/current-affairs/process
// Process and ground news headline list from an image upload
router.post('/process', upload.single('image'), (req, res, next) => {
  currentAffairsController.processImage(req, res, next);
});

// GET /api/current-affairs/latest
// Fetch the most recently processed current affairs document
router.get('/latest', (req, res, next) => {
  currentAffairsController.getLatestCurrentAffairs(req, res, next);
});

// GET /api/current-affairs/:date (date in YYYY-MM-DD format)
// Fetch current affairs for a specific date
router.get('/:date', (req, res, next) => {
  currentAffairsController.getCurrentAffairsByDate(req, res, next);
});

module.exports = router;
