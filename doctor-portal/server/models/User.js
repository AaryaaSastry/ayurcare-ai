const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, default: 'Patient' },
  age: { type: Number },
  gender: { type: String },
  height: { type: String },
  weight: { type: String },
  phone: { type: String },
  isOnboarded: { type: Boolean, default: false },
  role: { type: String, enum: ['patient', 'doctor'], default: 'patient' },
  createdAt: { type: Date, default: Date.now }
});

// Hash password before saving
// Refactored to avoid "next" conflict in async hooks
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
