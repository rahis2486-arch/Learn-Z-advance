import mongoose from 'mongoose';

const CourseSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  thumbnail: { type: String, required: true },
  duration: { type: String, default: "0h 0m" },
  tags: { type: [String], default: [] },
  category: { type: String, default: "General" },
  rating: { type: Number, default: 0 },
  ratingCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

export const Course = mongoose.model('Course', CourseSchema);
