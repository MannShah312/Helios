const mongoose = require('mongoose');

const sourceSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  url: {
    type: String,
    required: true,
    trim: true,
  },
  sourceType: {
    type: String,
    enum: ['official', 'media', 'other'],
    required: true,
  }
}, { _id: false });

const topicSchema = new mongoose.Schema({
  topicNumber: {
    type: Number,
    required: true,
  },
  originalHeadline: {
    type: String,
    required: true,
    trim: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  shortDescription: {
    type: String,
    required: true,
    trim: true,
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
    },
    subSubject: {
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
  analysis: {
    whatHappened: {
      type: String,
      required: true,
    },
    background: {
      type: String,
      required: true,
    },
    whyImportant: {
      type: String,
      required: true,
    },
    keyPoints: [String],
    governmentMeasures: [String],
    challenges: [String],
    wayForward: [String]
  },
  prelims: {
    facts: [String],
    keywords: [String]
  },
  revision: {
    question: {
      type: String,
      required: true,
    },
    answer: {
      type: String,
      required: true,
    }
  },
  sources: [sourceSchema]
}, { _id: false });

const currentAffairsSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    unique: true, // Ensures one document per normalized day
  },
  sourceImage: {
    url: {
      type: String,
      required: true,
    },
    publicId: {
      type: String,
      required: true,
    }
  },
  topicCount: {
    type: Number,
    required: true,
  },
  topics: [topicSchema],
  processingStatus: {
    type: String,
    enum: ['PENDING', 'COMPLETED', 'FAILED'],
    default: 'PENDING',
    required: true,
  }
}, {
  timestamps: true,
});

module.exports = mongoose.model('CurrentAffairs', currentAffairsSchema);
