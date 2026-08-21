const express = require('express');
const router = express.Router();
const articleController = require('../controllers/articleController');
const { upload } = require('../config/cloudinary');

// Map CRUD routes for Articles
router.route('/')
  .get((req, res, next) => articleController.getAllArticles(req, res, next))
  .post(upload.single('image'), (req, res, next) => articleController.createArticle(req, res, next));

router.route('/:id')
  .get((req, res, next) => articleController.getArticleById(req, res, next))
  .put(upload.single('image'), (req, res, next) => articleController.updateArticle(req, res, next))
  .delete((req, res, next) => articleController.deleteArticle(req, res, next));

module.exports = router;
