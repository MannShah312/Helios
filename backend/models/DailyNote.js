const mongoose = require('mongoose');

const quickCheckSchema = new mongoose.Schema({
  question: { type: String, required: true },
  answer: { type: String, required: true }
}, { _id: false });

const connectingSchema = new mongoose.Schema({
  prevTitle: { type: String, default: null },
  prevOrder: { type: Number, default: null },
  nextTitle: { type: String, default: null },
  nextOrder: { type: Number, default: null },
  connectionText: { type: String, required: true }
}, { _id: false });

const upscTakeawaysSchema = new mongoose.Schema({
  prelims: [String],  // 3-6 key facts
  mains: [String]     // 2-4 analytical angles
}, { _id: false });

const dailyNoteSchema = new mongoose.Schema({
  subject: {
    type: String,
    required: true,
    enum: ['modern-history', 'polity', 'geography', 'economy', 'environment', 'science-tech', 'ethics'],
    index: true
  },
  topicOrder: {
    type: Number,
    required: true
  },
  scheduledDate: {
    type: Date,
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  syllabusRef: {
    type: String,  // maps to syllabus topic id, e.g. 'battle-of-plassey'
    default: null
  },
  part: {
    type: String,   // e.g. 'Part 1 of 2' or null
    default: null
  },
  quickGlimpse: {
    flow: [String]  // ["Cause phrase", "Event", "Outcome", "Next development"]
  },
  story: {
    type: String,   // main narrative (300-800 words)
    required: true
  },
  connecting: connectingSchema,
  upscTakeaways: upscTakeawaysSchema,
  quickCheck: [quickCheckSchema],  // exactly 3
  generationStatus: {
    type: String,
    enum: ['PENDING', 'COMPLETED', 'FAILED'],
    default: 'PENDING',
    required: true
  },
  processingError: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Compound index: one lesson per subject per day
dailyNoteSchema.index({ subject: 1, scheduledDate: 1 }, { unique: true });
// Index for ordered browsing
dailyNoteSchema.index({ subject: 1, topicOrder: 1 }, { unique: true });

module.exports = mongoose.model('DailyNote', dailyNoteSchema);
