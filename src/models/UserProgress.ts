import mongoose from 'mongoose';

const UserProgressSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  completedLessons: [{ type: String }],
  isCompleted: { type: Boolean, default: false },
  rating: { type: Number, default: 0 },
  lastAccessed: { type: Date, default: Date.now },
});

export const UserProgress = mongoose.model('UserProgress', UserProgressSchema);
