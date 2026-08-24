const express = require('express');
const router = express.Router();
const syllabusController = require('../controllers/syllabusController');

// GET /api/syllabus
router.get('/', (req, res, next) => {
  syllabusController.getSyllabus(req, res, next);
});

module.exports = router;
