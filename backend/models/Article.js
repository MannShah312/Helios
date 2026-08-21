const mongoose = require('mongoose');

const articleSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please add a title for the article'],
      trim: true,
    },
    content: {
      type: String,
      required: [true, 'Please add the article content'],
      trim: true,
    },
    author: {
      type: String,
      default: 'Unknown',
      trim: true,
    },
    source: {
      type: String,
      default: 'General',
      trim: true,
    },
    url: {
      type: String,
      trim: true,
      sparse: true, // Allows null/missing values but ensures uniqueness for values present
      unique: true,
    },
    imageUrl: {
      type: String,
      trim: true,
    },
    imagePublicId: {
      type: String,
      trim: true,
    },
    publishedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true, // Automatically manages createdAt and updatedAt fields
  }
);

module.exports = mongoose.model('Article', articleSchema);
