const weeklyRevisionService = require('../services/weeklyRevisionService');

class WeeklyRevisionController {
  /**
   * GET /api/weekly-revision/current
   * Fetch the latest completed weekly revision cycle. Auto-generates if it doesn't exist.
   */
  async getCurrentWeeklyRevision(req, res, next) {
    try {
      const result = await weeklyRevisionService.getLatestWeeklyRevision();
      
      if (!result) {
        return res.status(200).json({
          success: true,
          message: "No current affairs records found to generate a Weekly Revision for this cycle.",
          data: { topics: [] }
        });
      }

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('[WeeklyRevisionController] Error fetching current revision:', error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to retrieve latest weekly revision.",
        errorCode: "SERVER_ERROR"
      });
    }
  }

  /**
   * POST /api/weekly-revision/generate
   * Force generate or regenerate a weekly revision for a range or current cycle.
   */
  async generateWeeklyRevision(req, res, next) {
    try {
      const { startDate, endDate, force } = req.body;

      let start, end;
      if (startDate && endDate) {
        start = new Date(startDate);
        end = new Date(endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid custom date format provided.",
            errorCode: "INVALID_DATES"
          });
        }
      } else {
        const range = weeklyRevisionService.getCycleRange();
        start = range.startDate;
        end = range.endDate;
      }

      console.log(`[WeeklyRevisionController] Generating revision from ${start.toISOString()} to ${end.toISOString()}`);
      const result = await weeklyRevisionService.generateWeeklyRevision(start, end);

      if (!result) {
        return res.status(404).json({
          success: false,
          message: "No completed daily current affairs documents found in the requested range to generate a weekly revision.",
          errorCode: "NO_DATA"
        });
      }

      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('[WeeklyRevisionController] Generation failed:', error);
      res.status(500).json({
        success: false,
        message: error.message || "Weekly revision generation failed.",
        errorCode: "GENERATION_FAILED"
      });
    }
  }

  /**
   * PATCH /api/weekly-revision/:revisionId/topics/:topicId/toggle
   * Toggle completion status of a specific revision topic.
   */
  async toggleTopicCompletion(req, res, next) {
    try {
      const { revisionId, topicId } = req.params;

      if (!revisionId || !topicId) {
        return res.status(400).json({
          success: false,
          message: "Revision ID and Topic ID are required parameters.",
          errorCode: "MISSING_PARAMS"
        });
      }

      const updatedRevision = await weeklyRevisionService.toggleTopicCompletion(revisionId, topicId);

      res.status(200).json({
        success: true,
        message: "Topic completion status toggled successfully.",
        data: updatedRevision
      });
    } catch (error) {
      console.error('[WeeklyRevisionController] Toggle completion failed:', error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to update completion status.",
        errorCode: "UPDATE_FAILED"
      });
    }
  }
}

module.exports = new WeeklyRevisionController();
