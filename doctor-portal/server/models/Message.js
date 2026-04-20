const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true },
  type: { type: String, enum: ['TEXT', 'NEGOTIATION'], default: 'TEXT' },
  senderId: { type: mongoose.Schema.Types.ObjectId, required: true },
  senderRole: { type: String, enum: ['DOCTOR', 'USER'], required: true },
  message: { type: String, required: true, trim: true },
  negotiationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Negotiation', default: null },
  timestamp: { type: Date, default: Date.now },
  read: { type: Boolean, default: false },
});

messageSchema.index({ chatId: 1, timestamp: 1 });
messageSchema.index({ chatId: 1, read: 1 });

module.exports = mongoose.model('Message', messageSchema);
