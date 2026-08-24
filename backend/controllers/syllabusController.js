const syllabusService = require('../services/syllabusService');

class SyllabusController {
  /**
   * GET /api/syllabus
   * Retrieve UPSC syllabus mapped with news data
   */
  async getSyllabus(req, res, next) {
    try {
      const data = await syllabusService.getSyllabusWithNews();
      res.status(200).json(data);
    } catch (error) {
      console.error('[SyllabusController] Error retrieving syllabus:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve UPSC syllabus data.',
        errorCode: 'DATABASE_ERROR'
      });
    }
  }
}

module.exports = new SyllabusController();
