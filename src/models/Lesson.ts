import mongoose from 'mongoose';

const LessonSchema = new mongoose.Schema({
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  videoNumber: { type: Number, required: true },
  title: { type: String, required: true },
  youtubeUrl: { type: String, required: true },
  transcript: { type: String, required: true },
  summary: { type: String, required: true },
  notesTitle: { type: String },
  notesDescription: { type: String },
  attachments: [{ name: String, url: String }],
  createdAt: { type: Date, default: Date.now },
});

export const Lesson = mongoose.model('Lesson', LessonSchema);
