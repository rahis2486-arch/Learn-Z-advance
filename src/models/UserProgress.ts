import mongoose from 'mongoose';

const UserProgressSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  completedLessons: [{ type: String }],
  isCompleted: { type: Boolean, default: false },
  rating: { type: Number, default: 0 },
  enrollmentSource: { type: String, enum: ['personal', 'institution'], default: 'personal' },
  lastAccessed: { type: Date, default: Date.now },
});

UserProgressSchema.index({ userId: 1, courseId: 1, enrollmentSource: 1 }, { unique: true });

export const UserProgress = mongoose.model('UserProgress', UserProgressSchema);
