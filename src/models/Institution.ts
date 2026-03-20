import mongoose from 'mongoose';

const InstitutionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: String,
  logoUrl: String,
  allowedEmails: [{ type: String }],
  createdAt: { type: Date, default: Date.now }
});

export const Institution = mongoose.model('Institution', InstitutionSchema);
