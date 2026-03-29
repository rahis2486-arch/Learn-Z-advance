import mongoose from 'mongoose';

const InstitutionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: String,
  logoUrl: String,
  permittedEmails: [{ type: String }],
  createdAt: { type: Date, default: Date.now }
});

export const Institution = mongoose.model('Institution', InstitutionSchema);
