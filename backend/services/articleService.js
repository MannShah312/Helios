const Article = require('../models/Article');
const { cloudinary } = require('../config/cloudinary');

class ArticleService {
  /**
   * Create a new article
   * @param {Object} articleData 
   * @returns {Promise<Object>} Created article
   */
  async createArticle(articleData) {
    const article = new Article(articleData);
    return await article.save();
  }

  /**
   * Retrieve all articles (with optional filtering)
   * @param {Object} queryParams filters (e.g. source, author)
   * @returns {Promise<Array>} List of articles
   */
  async getAllArticles(queryParams = {}) {
    const filter = {};
    
    // Example filters
    if (queryParams.source) {
      filter.source = { $regex: queryParams.source, $options: 'i' };
    }
    if (queryParams.author) {
      filter.author = { $regex: queryParams.author, $options: 'i' };
    }
    
    return await Article.find(filter).sort({ publishedAt: -1 });
  }

  /**
   * Retrieve a single article by ID
   * @param {string} id 
   * @returns {Promise<Object|null>} Article if found, null otherwise
   */
  async getArticleById(id) {
    return await Article.findById(id);
  }

  /**
   * Update an article by ID
   * @param {string} id 
   * @param {Object} updateData 
   * @returns {Promise<Object|null>} Updated article, null if not found
   */
  async updateArticle(id, updateData) {
    // If a new image was uploaded, clean up the old image from Cloudinary to avoid orphans
    if (updateData.imagePublicId) {
      const oldArticle = await Article.findById(id);
      if (oldArticle && oldArticle.imagePublicId && oldArticle.imagePublicId !== updateData.imagePublicId) {
        try {
          await cloudinary.uploader.destroy(oldArticle.imagePublicId);
        } catch (error) {
          console.error(`Failed to delete old image ${oldArticle.imagePublicId} from Cloudinary: ${error.message}`);
        }
      }
    }

    return await Article.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true } // Return the updated doc and run schema validators
    );
  }

  /**
   * Delete an article by ID
   * @param {string} id 
   * @returns {Promise<Object|null>} Deleted article, null if not found
   */
  async deleteArticle(id) {
    const article = await Article.findById(id);
    if (article && article.imagePublicId) {
      try {
        await cloudinary.uploader.destroy(article.imagePublicId);
      } catch (error) {
        console.error(`Failed to delete image ${article.imagePublicId} from Cloudinary: ${error.message}`);
      }
    }
    return await Article.findByIdAndDelete(id);
  }
}

module.exports = new ArticleService();
