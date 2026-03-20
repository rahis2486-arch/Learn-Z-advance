import mongoose from 'mongoose';

const CourseSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  thumbnail: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export const Course = mongoose.model('Course', CourseSchema);
