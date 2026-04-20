const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sessionId: { type: mongoose.Schema.Types.ObjectId },
  reportType: { type: String },
  reportTitle: { type: String },
  reportData: { type: mongoose.Schema.Types.Mixed },
  diagnosis: { type: String, required: true },
  symptoms: { type: String },
  recommendations: { type: String },
  date: { type: String },
  createdAt: { type: Date, default: Date.now },
  hiddenByPatient: { type: Boolean, default: false },
});

module.exports = mongoose.model('Report', reportSchema);
