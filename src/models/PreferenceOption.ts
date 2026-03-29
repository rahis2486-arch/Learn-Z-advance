import mongoose from 'mongoose';

const PreferenceOptionSchema = new mongoose.Schema({
  type: { type: String, enum: ['interest', 'learningPreference', 'hobby'], required: true },
  label: { type: String, required: true },
  value: { type: String, required: true },
  iconName: { type: String }, // For lucide icons
  createdAt: { type: Date, default: Date.now }
});

// Ensure uniqueness of value within a type
PreferenceOptionSchema.index({ type: 1, value: 1 }, { unique: true });

export const PreferenceOption = mongoose.model('PreferenceOption', PreferenceOptionSchema);
