import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  displayName: String,
  photoURL: String,
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  status: { type: String, enum: ['active', 'deactivated'], default: 'active' },
  onboardingCompleted: { type: Boolean, default: false },
  loginType: { type: String, enum: ['personal', 'institutional'], default: 'personal' },
  institutionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', default: null },
  age: Number,
  country: String,
  discoverySource: String,
  interests: [String],
  primaryGoal: String,
  customGoal: String,
  dailyCommitment: String,
  subscription: {
    plan: { type: String, enum: ['Basic', 'Pro', 'Institution'], default: 'Basic' },
    status: { type: String, enum: ['active', 'expired', 'canceled'], default: 'active' },
    expiryDate: Date,
    paymentMethod: String,
    transactionId: String
  },
  createdAt: { type: Date, default: Date.now },
  lastLogin: { type: Date, default: Date.now }
});

export const User = mongoose.model('User', UserSchema);
