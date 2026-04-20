const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  basicInfo: {
    name: { type: String, required: true },
    age: Number,
    gender: String,
    phone: String,
    email: { type: String, required: true },
  },
  professionalInfo: {
    qualification: String,
    specialization: String,
    experience: Number,
    treatments: [String],
  },
  clinicInfo: {
    clinicName: String,
    address: String,
    city: String,
    state: String,
    pincode: String,
  },
  availability: {
    timings: String,
    fees: Number,
    languages: String,
  },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], index: '2dsphere' } // [longitude, latitude]
  },
  status: { type: String, enum: ['available', 'busy', 'unavailable'], default: 'available' },
  onLeave: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Create 2dsphere index for location
doctorSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Doctor', doctorSchema);
