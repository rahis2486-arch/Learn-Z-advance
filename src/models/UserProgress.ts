import mongoose from 'mongoose';

const UserProgressSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  completedLessons: [{ type: String }],
  isCompleted: { type: Boolean, default: false },
  rating: { type: Number, default: 0 },
  enrollmentSource: { type: String, enum: ['personal', 'institution'], default: 'personal' },
  lastAccessed: { type: Date, default: Date.now },
  courseSnapshot: {
    title: String,
    thumbnail: String
  },
  lessonQuizzes: [{
    lessonId: { type: String, required: true },
    score: { type: Number, required: true },
    totalQuestions: { type: Number, required: true },
    timeTaken: { type: Number, required: true },
    attempts: { type: Number, default: 1 },
    completed: { type: Boolean, default: false },
    answers: [{
      question: String,
      userAnswer: String,
      correctAnswer: String,
      isCorrect: Boolean,
      explanation: String
    }],
    feedback: {
      strengths: [String],
      weaknesses: [String],
      suggestions: [String]
    },
    history: [{
      score: Number,
      timeTaken: Number,
      date: { type: Date, default: Date.now }
    }]
  }],
  videoProgress: [{
    lessonId: { type: String, required: true },
    watchedTime: { type: Number, required: true },
    totalDuration: { type: Number, required: true },
    percentage: { type: Number, required: true },
    lastUpdated: { type: Date, default: Date.now }
  }],
  finalTest: {
    score: { type: Number },
    totalQuestions: { type: Number },
    timeTaken: { type: Number },
    attempts: { type: Number, default: 0 },
    completed: { type: Boolean, default: false },
    answers: [{
      question: String,
      userAnswer: String,
      correctAnswer: String,
      isCorrect: Boolean,
      explanation: String
    }],
    feedback: {
      strengths: [String],
      weaknesses: [String],
      suggestions: [String]
    },
    history: [{
      score: Number,
      timeTaken: Number,
      date: { type: Date, default: Date.now }
    }]
  }
});

UserProgressSchema.index({ userId: 1, courseId: 1, enrollmentSource: 1 }, { unique: true });

export const UserProgress = mongoose.model('UserProgress', UserProgressSchema);
