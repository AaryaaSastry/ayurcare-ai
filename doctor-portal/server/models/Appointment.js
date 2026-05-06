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
  meetingType: { type: String, enum: ['google_meet', 'jitsi', 'custom'], default: 'custom' },
  roomId: { type: String },
  meetingLink: { type: String },
  meetingStatus: {
    type: String,
    enum: ['scheduled', 'live', 'ended'],
    default: 'scheduled'
  },
  startedAt: { type: Date },
  endedAt: { type: Date },
  consultationCompleted: { type: Boolean, default: false },
  prescriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Prescription' },
  sessionData: {
    diagnosis: String,
    title: String,
  },
  cancelledByPatient: { type: Boolean, default: false },
  cancelledAt: { type: Date },
  cancellationNote: { type: String },
  attachments: [{
    originalName: { type: String },
    fileName: { type: String },
    mimeType: { type: String },
    size: { type: Number },
    url: { type: String },
    uploadedAt: { type: Date, default: Date.now },
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  hiddenByPatient: { type: Boolean, default: false },
});

module.exports = mongoose.model('Appointment', appointmentSchema);
