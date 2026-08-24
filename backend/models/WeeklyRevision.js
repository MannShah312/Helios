const mongoose = require('mongoose');

const weeklyRevisionTopicSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  revisionSummary: {
    type: String,
    required: true,
    trim: true,
  },
  whyItMatters: {
    type: String,
    required: true,
    trim: true,
  },
  factsKeywords: {
    type: [String],
    default: [],
  },
  classification: {
    gsPaper: {
      type: String,
      enum: ['GS-I', 'GS-II', 'GS-III', 'GS-IV'],
      required: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    }
  },
  importance: {
    type: String,
    enum: ['HIGH', 'MEDIUM', 'LOW'],
    required: true,
  },
  currentAffairsDate: {
    type: Date,
    required: true,
  },
  currentAffairsTopicNumber: {
    type: Number,
    required: true,
  },
  completed: {
    type: Boolean,
    default: false,
  }
});

const weeklyRevisionSchema = new mongoose.Schema({
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
  topics: [weeklyRevisionTopicSchema],
}, {
  timestamps: true,
});

// Index to ensure unique weekly revision for each date range
weeklyRevisionSchema.index({ startDate: 1, endDate: 1 }, { unique: true });

module.exports = mongoose.model('WeeklyRevision', weeklyRevisionSchema);
