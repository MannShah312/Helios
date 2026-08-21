const articleService = require('../services/articleService');

// Helper to check for Mongoose CastError (invalid ObjectId)
const isValidObjectId = (id) => {
  return /^[0-9a-fA-F]{24}$/.test(id);
};

class ArticleController {
  /**
   * Create a new article
   * @route POST /api/articles
   */
  async createArticle(req, res, next) {
    try {
      // Extract file details if Multer uploaded an image
      if (req.file) {
        req.body.imageUrl = req.file.path;
        req.body.imagePublicId = req.file.filename;
      }

      const { title, content } = req.body;
      
      if (!title || !content) {
        return res.status(400).json({
          success: false,
          message: 'Please provide both title and content for the article',
        });
      }

      const newArticle = await articleService.createArticle(req.body);
      
      res.status(201).json({
        success: true,
        data: newArticle,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all articles (with optional query filters)
   * @route GET /api/articles
   */
  async getAllArticles(req, res, next) {
    try {
      const articles = await articleService.getAllArticles(req.query);
      
      res.status(200).json({
        success: true,
        count: articles.length,
        data: articles,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a single article by ID
   * @route GET /api/articles/:id
   */
  async getArticleById(req, res, next) {
    try {
      const { id } = req.params;
      
      if (!isValidObjectId(id)) {
        return res.status(400).json({
          success: false,
          message: `Invalid article ID format: ${id}`,
        });
      }

      const article = await articleService.getArticleById(id);
      
      if (!article) {
        return res.status(404).json({
          success: false,
          message: `Article not found with ID: ${id}`,
        });
      }

      res.status(200).json({
        success: true,
        data: article,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update an article by ID
   * @route PUT /api/articles/:id
   */
  async updateArticle(req, res, next) {
    try {
      const { id } = req.params;
      
      if (!isValidObjectId(id)) {
        return res.status(400).json({
          success: false,
          message: `Invalid article ID format: ${id}`,
        });
      }

      // Extract file details if Multer uploaded a new image
      if (req.file) {
        req.body.imageUrl = req.file.path;
        req.body.imagePublicId = req.file.filename;
      }

      const updatedArticle = await articleService.updateArticle(id, req.body);
      
      if (!updatedArticle) {
        return res.status(404).json({
          success: false,
          message: `Article not found with ID: ${id}`,
        });
      }

      res.status(200).json({
        success: true,
        data: updatedArticle,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete an article by ID
   * @route DELETE /api/articles/:id
   */
  async deleteArticle(req, res, next) {
    try {
      const { id } = req.params;
      
      if (!isValidObjectId(id)) {
        return res.status(400).json({
          success: false,
          message: `Invalid article ID format: ${id}`,
        });
      }

      const deletedArticle = await articleService.deleteArticle(id);
      
      if (!deletedArticle) {
        return res.status(404).json({
          success: false,
          message: `Article not found with ID: ${id}`,
        });
      }

      res.status(200).json({
        success: true,
        message: 'Article successfully deleted',
        data: deletedArticle,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ArticleController();
