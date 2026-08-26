const express = require('express');
const router = express.Router();
const {
  getSubjectsOverview,
  getTodayNote,
  getNoteByOrder,
  getAllNotes,
  generateNote
} = require('../controllers/dailyNotesController');

// GET /api/daily-notes/subjects — all subjects with today's topic + stats
router.get('/subjects', getSubjectsOverview);

// POST /api/daily-notes/generate — manual trigger (admin/dev)
router.post('/generate', generateNote);

// GET /api/daily-notes/:subject/today — today's lesson for a subject
router.get('/:subject/today', getTodayNote);

// GET /api/daily-notes/:subject/all — all generated lessons (for topic grid)
router.get('/:subject/all', getAllNotes);

// GET /api/daily-notes/:subject/topic/:order — specific lesson by order (prev/next)
router.get('/:subject/topic/:order', getNoteByOrder);

module.exports = router;
