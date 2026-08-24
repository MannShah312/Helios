const express = require('express');
const router = express.Router();
const weeklyRevisionController = require('../controllers/weeklyRevisionController');

// GET /api/weekly-revision/current
router.get('/current', (req, res, next) => {
  weeklyRevisionController.getCurrentWeeklyRevision(req, res, next);
});

// POST /api/weekly-revision/generate
router.post('/generate', (req, res, next) => {
  weeklyRevisionController.generateWeeklyRevision(req, res, next);
});

// PATCH /api/weekly-revision/:revisionId/topics/:topicId/toggle
router.patch('/:revisionId/topics/:topicId/toggle', (req, res, next) => {
  weeklyRevisionController.toggleTopicCompletion(req, res, next);
});

module.exports = router;
