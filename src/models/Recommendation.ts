import mongoose from 'mongoose';

const RecommendationSchema = new mongoose.Schema({
  institutionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  recommendedBy: { type: String, required: true }, // userId (uid)
  createdAt: { type: Date, default: Date.now }
});

// Ensure a course is only recommended once per institution
RecommendationSchema.index({ institutionId: 1, courseId: 1 }, { unique: true });

export const Recommendation = mongoose.model('Recommendation', RecommendationSchema);
