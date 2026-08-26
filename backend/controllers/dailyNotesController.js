const dailyNotesService = require('../services/dailyNotesService');

/**
 * GET /api/daily-notes/subjects
 * Returns all subjects with today's lesson info and coverage stats
 */
const getSubjectsOverview = async (req, res, next) => {
  try {
    const data = await dailyNotesService.getSubjectsOverview();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/daily-notes/:subject/today
 * Returns today's lesson for a subject (or most recent if not yet generated)
 */
const getTodayNote = async (req, res, next) => {
  try {
    const { subject } = req.params;
    const note = await dailyNotesService.getTodayNote(subject);
    if (!note) {
      return res.status(404).json({
        success: false,
        message: `No notes generated yet for subject: ${subject}`
      });
    }
    res.json({ success: true, data: note });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/daily-notes/:subject/topic/:order
 * Returns a specific topic by its order number (for prev/next navigation)
 */
const getNoteByOrder = async (req, res, next) => {
  try {
    const { subject, order } = req.params;
    const orderNum = parseInt(order, 10);
    if (isNaN(orderNum) || orderNum < 1) {
      return res.status(400).json({ success: false, message: 'Invalid topic order number.' });
    }
    const note = await dailyNotesService.getNoteByOrder(subject, orderNum);
    if (!note) {
      return res.status(404).json({
        success: false,
        message: `Topic order ${orderNum} not found for subject: ${subject}`
      });
    }
    res.json({ success: true, data: note });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/daily-notes/:subject/all
 * Returns all generated lessons for a subject (ordered list, for the topic grid)
 */
const getAllNotes = async (req, res, next) => {
  try {
    const { subject } = req.params;
    const notes = await dailyNotesService.getAllNotes(subject);
    res.json({ success: true, data: notes, count: notes.length });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/daily-notes/generate
 * Manually trigger generation for all subjects (or a specific one)
 * Body: { subject?: 'modern-history', order?: 3 }
 */
const generateNote = async (req, res, next) => {
  try {
    const { subject, order } = req.body || {};

    if (subject && order) {
      // Generate a specific topic
      const result = await dailyNotesService.generateSpecificNote(subject, parseInt(order, 10));
      return res.json({ success: true, data: result, message: 'Specific note generated.' });
    }

    // Generate next note for all subjects (or just the one specified)
    const results = await dailyNotesService.generateDailyNotes();
    res.json({
      success: true,
      data: results,
      message: `Generation cycle complete. ${results.filter(r => r.status === 'success').length} notes created.`
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getSubjectsOverview,
  getTodayNote,
  getNoteByOrder,
  getAllNotes,
  generateNote
};
