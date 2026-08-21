const currentAffairsService = require('../services/currentAffairsService');

class CurrentAffairsController {
  /**
   * POST /api/current-affairs/process
   * Process uploaded news list image using Multer, Cloudinary, and Gemini
   */
  async processImage(req, res, next) {
    try {
      // 1. Verify file was parsed and uploaded by Multer
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Please upload an image file using the field key 'image'",
          errorCode: "MISSING_IMAGE"
        });
      }

      // 2. Validate MIME type
      const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
      if (!allowedMimes.includes(req.file.mimetype)) {
        return res.status(400).json({
          success: false,
          message: "Unsupported file type. Please upload a JPEG, PNG or WebP image.",
          errorCode: "INVALID_FILE_TYPE"
        });
      }

      // 3. Process the file
      const result = await currentAffairsService.processImage(req.file);

      // 4. Return success response
      res.status(200).json({
        success: true,
        data: result
      });

    } catch (error) {
      console.error('[CurrentAffairsController] Full pipeline error stack:', error);
      // Standardize and map pipeline failures
      let statusCode = 500;
      let errorCode = "INTERNAL_SERVER_ERROR";
      let message = error.message;

      if (error.message.includes('Cloudinary')) {
        statusCode = 502;
        errorCode = "CLOUDINARY_UPLOAD_FAILED";
        message = "Failed to retrieve or store media in the cloud.";
      } else if (error.message.includes('Gemini') || error.message.includes('JSON response')) {
        statusCode = 502;
        errorCode = "GEMINI_PROCESSING_FAILED";
        message = "AI service failed to interpret or structure the news content.";
      } else if (error.message.includes('date')) {
        statusCode = 422;
        errorCode = "DATE_EXTRACTION_FAILED";
      } else if (error.message.includes('Database') || error.message.includes('validation')) {
        statusCode = 500;
        errorCode = "DATABASE_WRITE_FAILED";
      }

      res.status(statusCode).json({
        success: false,
        message: message,
        errorCode: errorCode
      });
    }
  }

  /**
   * GET /api/current-affairs/latest
   * Fetch the most recently saved day record
   */
  async getLatestCurrentAffairs(req, res, next) {
    try {
      const result = await currentAffairsService.getLatest();
      
      if (!result) {
        return res.status(404).json({
          success: false,
          message: "No current affairs records found in the database.",
          errorCode: "NOT_FOUND"
        });
      }

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message || "Failed to retrieve latest current affairs data.",
        errorCode: "DATABASE_ERROR"
      });
    }
  }

  /**
   * GET /api/current-affairs/:date
   * Retrieve current affairs details for a specific YYYY-MM-DD date
   */
  async getCurrentAffairsByDate(req, res, next) {
    try {
      const { date } = req.params;
      
      // Simple date format check (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date)) {
        return res.status(400).json({
          success: false,
          message: "Invalid date format parameter. Please use YYYY-MM-DD.",
          errorCode: "INVALID_DATE_FORMAT"
        });
      }

      const result = await currentAffairsService.getByDate(date);

      if (!result) {
        return res.status(404).json({
          success: false,
          message: `No current affairs found for the requested date: ${date}`,
          errorCode: "DATE_NOT_FOUND"
        });
      }

      res.status(200).json({
        success: true,
        data: result
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message || "Failed to query database for the requested date.",
        errorCode: "DATABASE_ERROR"
      });
    }
  }
}

class CurrentAffairsControllerPlaceholder {} // Fix for Mongoose exports reference matching standard style

module.exports = new CurrentAffairsController();
