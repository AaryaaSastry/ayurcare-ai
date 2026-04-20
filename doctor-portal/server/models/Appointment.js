const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: {
    type: String,
    enum: ['pending', 'scheduled', 'confirmed', 'cancelled', 'completed', 'no-show'],
    default: 'pending'
  },
  type: {
    type: String,
    enum: ['online', 'clinic', 'follow-up'],
    default: 'clinic'
  },
  startTime: { type: Date },
  endTime: { type: Date },
  duration: { type: Number, default: 30 }, // in minutes
  notes: { type: String },
  fee: { type: Number },
  meetingLink: { type: String },
  sessionData: {
    diagnosis: String,
    title: String,
  },
  cancelledByPatient: { type: Boolean, default: false },
  cancelledAt: { type: Date },
  cancellationNote: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  hiddenByPatient: { type: Boolean, default: false },
});

module.exports = mongoose.model('Appointment', appointmentSchema);
