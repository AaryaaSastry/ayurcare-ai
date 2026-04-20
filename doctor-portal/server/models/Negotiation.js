const mongoose = require('mongoose');

const negotiationSchema = new mongoose.Schema({
  chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  time: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0 },
  mode: {
    type: String,
    enum: ['VIDEO', 'AUDIO', 'CHAT'],
    required: true,
  },
  status: {
    type: String,
    enum: ['PENDING', 'ACCEPTED', 'LOCKED', 'COUNTERED'],
    default: 'PENDING',
  },
  acceptedByDoctor: { type: Boolean, default: false },
  acceptedByUser: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

negotiationSchema.index({ chatId: 1, createdAt: -1 });
negotiationSchema.index(
  { chatId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'PENDING' },
  }
);

module.exports = mongoose.model('Negotiation', negotiationSchema);
