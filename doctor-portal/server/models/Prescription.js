const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '' },
    details: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const prescriptionSchema = new mongoose.Schema({
  appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true, unique: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  notes: { type: String, default: '' },
  medicines: { type: [medicineSchema], default: [] },
  status: { type: String, enum: ['draft', 'finalized'], default: 'draft' },
  finalizedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

prescriptionSchema.index({ appointmentId: 1 }, { unique: true });
prescriptionSchema.index({ patientId: 1, status: 1, updatedAt: -1 });

module.exports = mongoose.model('Prescription', prescriptionSchema);
