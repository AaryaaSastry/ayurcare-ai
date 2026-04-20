const Chat = require('../models/Chat');
const Message = require('../models/Message');
const Negotiation = require('../models/Negotiation');
const Doctor = require('../models/Doctor');
const User = require('../models/User');
const Appointment = require('../models/Appointment');
const mongoose = require('mongoose');

const serializeNegotiation = (negotiationDoc) => {
  if (!negotiationDoc) return null;

  return {
    _id: negotiationDoc._id,
    chatId: negotiationDoc.chatId,
    doctorId: negotiationDoc.doctorId,
    userId: negotiationDoc.userId,
    date: negotiationDoc.date,
    time: negotiationDoc.time,
    amount: negotiationDoc.amount,
    mode: negotiationDoc.mode,
    status: negotiationDoc.status,
    acceptedByDoctor: negotiationDoc.acceptedByDoctor,
    acceptedByUser: negotiationDoc.acceptedByUser,
    createdAt: negotiationDoc.createdAt,
    updatedAt: negotiationDoc.updatedAt,
  };
};

const serializeMessage = (messageDoc) => ({
  _id: messageDoc._id,
  chatId: messageDoc.chatId,
  type: messageDoc.type || 'TEXT',
  senderId: messageDoc.senderId,
  senderRole: messageDoc.senderRole,
  message: messageDoc.message,
  negotiationId: messageDoc.negotiationId?._id || messageDoc.negotiationId || null,
  negotiation: serializeNegotiation(messageDoc.negotiationId),
  timestamp: messageDoc.timestamp,
  read: messageDoc.read,
});

const getRealtime = (req) => req.app.get('chatRealtime');
const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const NEGOTIATION_MODE_LABELS = {
  VIDEO: 'Video Call',
  AUDIO: 'Audio Call',
  CHAT: 'Chat',
};

const buildNegotiationMessageText = ({ amount, mode, date, time }) => {
  const dateText = new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return `Consultation offer: ${NEGOTIATION_MODE_LABELS[mode] || mode} on ${dateText} at ${time} for Rs. ${amount}`;
};

const getActorContext = async (authUserId) => {
  const doctor = await Doctor.findOne({ userId: authUserId }).select('_id userId basicInfo');
  if (doctor) {
    return {
      authUserId: String(authUserId),
      actorRole: 'DOCTOR',
      actorId: doctor._id,
      doctorProfile: doctor,
    };
  }

  const user = await User.findById(authUserId).select('_id name email');
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  return {
    authUserId: String(authUserId),
    actorRole: 'USER',
    actorId: user._id,
    user,
  };
};

const resolveDoctorIdentifier = async (doctorId) => {
  if (!doctorId) {
    throw createHttpError('doctorId is required', 400);
  }

  if (!isValidObjectId(doctorId)) {
    throw createHttpError('Invalid doctorId format', 400);
  }

  const byDoctorProfileId = await Doctor.findById(doctorId).select('_id userId basicInfo');
  if (byDoctorProfileId) {
    return byDoctorProfileId;
  }

  const byDoctorUserId = await Doctor.findOne({ userId: doctorId }).select('_id userId basicInfo');
  if (byDoctorUserId) {
    return byDoctorUserId;
  }

  throw createHttpError('Doctor not found', 404);
};

const resolveUserIdentifier = async (userId) => {
  if (!userId) {
    throw createHttpError('userId is required', 400);
  }

  if (!isValidObjectId(userId)) {
    throw createHttpError('Invalid userId format', 400);
  }

  const user = await User.findById(userId).select('_id name email');
  if (!user) {
    throw createHttpError('User not found', 404);
  }

  return user;
};

const validateDoctorUserRelationship = async ({ doctorId, userId, actorRole }) => {
  const hasAppointment = await Appointment.exists({
    doctorId,
    patientId: userId,
  });

  if (hasAppointment) {
    return;
  }

  const hasExistingChat = await Chat.exists({ doctorId, userId });
  if (hasExistingChat) {
    return;
  }

  if (actorRole === 'USER') {
    return;
  }

  const error = new Error('Doctor-patient relationship not found');
  error.statusCode = 403;
  throw error;
};

const createOrReuseChat = async (doctorId, userId) => {
  const now = new Date();
  const filter = { doctorId, userId };

  let chat = await Chat.findOneAndUpdate(
    filter,
    {
      $set: { updatedAt: now },
      $setOnInsert: { doctorId, userId, createdAt: now },
    },
    { upsert: true, returnDocument: 'after' }
  );

  if (chat) {
    return chat;
  }

  chat = await Chat.findOne(filter);
  if (chat) {
    chat.updatedAt = now;
    await chat.save();
    return chat;
  }

  try {
    return await Chat.create({
      doctorId,
      userId,
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return Chat.findOne(filter);
    }
    throw error;
  }
};

const ensureChatAccess = async (chatId, actor) => {
  const chat = await Chat.findById(chatId)
    .populate('doctorId', 'basicInfo userId')
    .populate('userId', 'name email');

  if (!chat) {
    const error = new Error('Chat not found');
    error.statusCode = 404;
    throw error;
  }

  const hasAccess = actor.actorRole === 'DOCTOR'
    ? String(chat.doctorId?._id || chat.doctorId) === String(actor.actorId)
    : String(chat.userId?._id || chat.userId) === String(actor.actorId);

  if (!hasAccess) {
    const error = new Error('Unauthorized chat access');
    error.statusCode = 403;
    throw error;
  }

  return chat;
};

const ensureNegotiationAccess = async (negotiationId, actor) => {
  const negotiation = await Negotiation.findById(negotiationId);
  if (!negotiation) {
    throw createHttpError('Negotiation not found', 404);
  }

  const hasAccess = actor.actorRole === 'DOCTOR'
    ? String(negotiation.doctorId) === String(actor.actorId)
    : String(negotiation.userId) === String(actor.actorId);

  if (!hasAccess) {
    throw createHttpError('Unauthorized negotiation access', 403);
  }

  return negotiation;
};

const ensureNoActiveNegotiation = async (chatId) => {
  const existing = await Negotiation.findOne({ chatId, status: 'PENDING' }).select('_id');
  if (existing) {
    throw createHttpError('Only one active negotiation is allowed per chat', 409);
  }
};

const mapChatSummary = async (chatDoc, actor, unreadCount = 0, realtime = null) => {
  const doctor = chatDoc.doctorId;
  const user = chatDoc.userId;
  const isDoctorView = actor.actorRole === 'DOCTOR';
  const counterpartName = isDoctorView
    ? (user?.name || user?.email?.split('@')[0] || 'Patient')
    : (doctor?.basicInfo?.name || 'Doctor');
  const counterpartUserId = isDoctorView
    ? String(user?._id || '')
    : String(doctor?.userId || '');

  return {
    _id: chatDoc._id,
    doctorId: String(doctor?._id || chatDoc.doctorId),
    userId: String(user?._id || chatDoc.userId),
    participantName: counterpartName,
    participantLabel: isDoctorView ? 'USER' : 'DOCTOR',
    participantUserId: counterpartUserId,
    participantIsOnline: realtime ? realtime.isUserOnline(counterpartUserId) : false,
    lastMessage: chatDoc.lastMessage || '',
    unreadCount,
    createdAt: chatDoc.createdAt,
    updatedAt: chatDoc.updatedAt,
  };
};

const emitNegotiationUpdate = (req, chat, negotiation) => {
  const realtime = getRealtime(req);
  if (!realtime) return;
  realtime.emitToRoom(realtime.buildRoomId(chat), 'negotiation:update', serializeNegotiation(negotiation));
  realtime.emitToRoom(String(chat.doctorId?._id || chat.doctorId), 'chat:updated', { chatId: String(chat._id) });
  realtime.emitToRoom(String(chat.userId?._id || chat.userId), 'chat:updated', { chatId: String(chat._id) });
};

const emitChatMessage = (req, chat, message) => {
  const realtime = getRealtime(req);
  if (!realtime) return;
  realtime.emitToRoom(realtime.buildRoomId(chat), 'message:new', serializeMessage(message));
  realtime.emitToRoom(String(chat.doctorId?._id || chat.doctorId), 'chat:updated', { chatId: String(chat._id) });
  realtime.emitToRoom(String(chat.userId?._id || chat.userId), 'chat:updated', { chatId: String(chat._id) });
};

const emitReadUpdate = (req, chat, readerRole) => {
  const realtime = getRealtime(req);
  if (!realtime) return;
  realtime.emitToRoom(realtime.buildRoomId(chat), 'message:read', {
    chatId: String(chat._id),
    readerRole,
  });
};

const handleChatError = (res, error, fallbackMessage) => {
  console.error(`[chat] ${fallbackMessage}:`, error);

  if (error?.name === 'CastError') {
    return res.status(400).json({ message: 'Invalid chat or participant id' });
  }

  if (error?.code === 11000) {
    return res.status(409).json({ message: 'Only one active negotiation is allowed per chat' });
  }

  return res.status(error.statusCode || 500).json({
    message: error.message || fallbackMessage,
  });
};

const initiateChat = async (req, res) => {
  try {
    const actor = await getActorContext(req.userId);
    const requestedDoctorId = req.body.doctorId;
    const requestedUserId = req.body.userId;

    const doctorProfile = actor.actorRole === 'DOCTOR'
      ? actor.doctorProfile
      : await resolveDoctorIdentifier(requestedDoctorId);
    const user = actor.actorRole === 'USER'
      ? actor.user
      : await resolveUserIdentifier(requestedUserId);

    const doctorId = doctorProfile._id;
    const userId = user._id;

    if (!doctorId || !userId) {
      return res.status(400).json({ message: 'doctorId and userId are required' });
    }

    await validateDoctorUserRelationship({ doctorId, userId, actorRole: actor.actorRole });
    const chat = await createOrReuseChat(doctorId, userId);
    if (!chat) {
      throw createHttpError('Unable to create or locate chat', 500);
    }
    const hydratedChat = await Chat.findById(chat._id)
      .populate('doctorId', 'basicInfo userId')
      .populate('userId', 'name email');

    const summary = await mapChatSummary(hydratedChat, actor, 0, getRealtime(req));
    res.json(summary);
  } catch (error) {
    handleChatError(res, error, 'Failed to initiate chat');
  }
};

const listChats = async (req, res) => {
  try {
    const actor = await getActorContext(req.userId);
    const query = actor.actorRole === 'DOCTOR'
      ? { doctorId: actor.actorId }
      : { userId: actor.actorId };

    const chats = await Chat.find(query)
      .sort({ updatedAt: -1 })
      .populate('doctorId', 'basicInfo userId')
      .populate('userId', 'name email');

    const unreadCounts = await Message.aggregate([
      {
        $match: {
          chatId: { $in: chats.map((chat) => chat._id) },
          read: false,
          senderRole: actor.actorRole === 'DOCTOR' ? 'USER' : 'DOCTOR',
        },
      },
      {
        $group: {
          _id: '$chatId',
          count: { $sum: 1 },
        },
      },
    ]);

    const unreadMap = new Map(unreadCounts.map((item) => [String(item._id), item.count]));
    const realtime = getRealtime(req);
    const payload = await Promise.all(
      chats.map((chat) => mapChatSummary(chat, actor, unreadMap.get(String(chat._id)) || 0, realtime))
    );

    res.json(payload);
  } catch (error) {
    handleChatError(res, error, 'Failed to list chats');
  }
};

const getMessages = async (req, res) => {
  try {
    const actor = await getActorContext(req.userId);
    const chat = await ensureChatAccess(req.params.chatId, actor);
    const messages = await Message.find({ chatId: chat._id })
      .sort({ timestamp: 1 })
      .populate('negotiationId');
    res.json(messages.map(serializeMessage));
  } catch (error) {
    handleChatError(res, error, 'Failed to load messages');
  }
};

const markChatAsRead = async (req, res) => {
  try {
    const actor = await getActorContext(req.userId);
    const chat = await ensureChatAccess(req.params.chatId, actor);

    await Message.updateMany(
      {
        chatId: chat._id,
        senderRole: actor.actorRole === 'DOCTOR' ? 'USER' : 'DOCTOR',
        read: false,
      },
      { $set: { read: true } }
    );

    emitReadUpdate(req, chat, actor.actorRole);
    res.json({ success: true });
  } catch (error) {
    handleChatError(res, error, 'Failed to update read status');
  }
};

const sendMessage = async (req, res) => {
  try {
    const actor = await getActorContext(req.userId);
    const text = String(req.body.message || '').trim();
    if (!text) {
      return res.status(400).json({ message: 'message is required' });
    }

    let chat = null;
    if (req.body.chatId) {
      chat = await ensureChatAccess(req.body.chatId, actor);
    } else {
      const doctorProfile = actor.actorRole === 'DOCTOR'
        ? actor.doctorProfile
        : await resolveDoctorIdentifier(req.body.doctorId);
      const user = actor.actorRole === 'USER'
        ? actor.user
        : await resolveUserIdentifier(req.body.userId);

      const doctorId = doctorProfile._id;
      const userId = user._id;

      if (!doctorId || !userId) {
        return res.status(400).json({ message: 'chatId or doctorId/userId is required' });
      }

      await validateDoctorUserRelationship({ doctorId, userId, actorRole: actor.actorRole });
      const chatDoc = await createOrReuseChat(doctorId, userId);
      if (!chatDoc) {
        throw createHttpError('Unable to create or locate chat', 500);
      }
      chat = await Chat.findById(chatDoc._id)
        .populate('doctorId', 'basicInfo userId')
        .populate('userId', 'name email');
    }

    const now = new Date();
    const message = await Message.create({
      chatId: chat._id,
      type: 'TEXT',
      senderId: actor.actorId,
      senderRole: actor.actorRole,
      message: text,
      timestamp: now,
      read: false,
    });

    await Chat.updateOne(
      { _id: chat._id },
      {
        $set: {
          lastMessage: text,
          updatedAt: now,
        },
      }
    );

    emitChatMessage(req, chat, message);
    res.status(201).json(serializeMessage(message));
  } catch (error) {
    handleChatError(res, error, 'Failed to send message');
  }
};

const createNegotiation = async (req, res) => {
  try {
    const actor = await getActorContext(req.userId);
    const chat = await ensureChatAccess(req.body.chatId, actor);
    const { date, time, amount, mode } = req.body;

    const parsedDate = date ? new Date(date) : null;
    const parsedAmount = Number(amount);

    if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
      return res.status(400).json({ message: 'A valid date is required' });
    }

    if (!String(time || '').trim()) {
      return res.status(400).json({ message: 'time is required' });
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      return res.status(400).json({ message: 'A valid amount is required' });
    }

    if (!['VIDEO', 'AUDIO', 'CHAT'].includes(mode)) {
      return res.status(400).json({ message: 'mode must be VIDEO, AUDIO, or CHAT' });
    }

    await ensureNoActiveNegotiation(chat._id);

    const now = new Date();
    const negotiation = await Negotiation.create({
      chatId: chat._id,
      doctorId: chat.doctorId?._id || chat.doctorId,
      userId: chat.userId?._id || chat.userId,
      date: parsedDate,
      time: String(time).trim(),
      amount: parsedAmount,
      mode,
      status: 'PENDING',
      acceptedByDoctor: false,
      acceptedByUser: false,
      createdAt: now,
      updatedAt: now,
    });

    const messageText = buildNegotiationMessageText({
      amount: parsedAmount,
      mode,
      date: parsedDate,
      time: String(time).trim(),
    });

    const message = await Message.create({
      chatId: chat._id,
      type: 'NEGOTIATION',
      senderId: actor.actorId,
      senderRole: actor.actorRole,
      message: messageText,
      negotiationId: negotiation._id,
      timestamp: now,
      read: false,
    });

    await Chat.updateOne(
      { _id: chat._id },
      {
        $set: {
          lastMessage: messageText,
          updatedAt: now,
        },
      }
    );

    const hydratedMessage = await Message.findById(message._id).populate('negotiationId');
    emitChatMessage(req, chat, hydratedMessage);
    res.status(201).json(serializeMessage(hydratedMessage));
  } catch (error) {
    handleChatError(res, error, 'Failed to create negotiation');
  }
};

const acceptNegotiation = async (req, res) => {
  try {
    const actor = await getActorContext(req.userId);
    const negotiation = await ensureNegotiationAccess(req.params.negotiationId, actor);
    const chat = await ensureChatAccess(negotiation.chatId, actor);

    if (negotiation.status === 'LOCKED') {
      return res.json(serializeNegotiation(negotiation));
    }

    const alreadyAccepted = actor.actorRole === 'DOCTOR'
      ? negotiation.acceptedByDoctor
      : negotiation.acceptedByUser;

    if (!alreadyAccepted) {
      if (actor.actorRole === 'DOCTOR') {
        negotiation.acceptedByDoctor = true;
      } else {
        negotiation.acceptedByUser = true;
      }

      negotiation.updatedAt = new Date();
      if (negotiation.acceptedByDoctor && negotiation.acceptedByUser) {
        negotiation.status = 'ACCEPTED';
        negotiation.status = 'LOCKED';
      }

      await negotiation.save();
      emitNegotiationUpdate(req, chat, negotiation);
    }

    res.json(serializeNegotiation(negotiation));
  } catch (error) {
    handleChatError(res, error, 'Failed to accept negotiation');
  }
};

const counterNegotiation = async (req, res) => {
  try {
    const actor = await getActorContext(req.userId);
    const oldNegotiation = await ensureNegotiationAccess(req.params.negotiationId, actor);
    const chat = await ensureChatAccess(oldNegotiation.chatId, actor);
    const { date, time, amount, mode } = req.body;

    if (oldNegotiation.status !== 'PENDING') {
      return res.status(400).json({ message: 'Only pending negotiations can be countered.' });
    }

    const parsedDate = date ? new Date(date) : null;
    const parsedAmount = Number(amount);

    if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
      return res.status(400).json({ message: 'A valid date is required' });
    }

    if (!String(time || '').trim()) {
      return res.status(400).json({ message: 'time is required' });
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      return res.status(400).json({ message: 'A valid amount is required' });
    }

    if (!['VIDEO', 'AUDIO', 'CHAT'].includes(mode)) {
      return res.status(400).json({ message: 'mode must be VIDEO, AUDIO, or CHAT' });
    }

    // Cancel old negotiation
    oldNegotiation.status = 'COUNTERED';
    oldNegotiation.updatedAt = new Date();
    await oldNegotiation.save();
    emitNegotiationUpdate(req, chat, oldNegotiation);

    const now = new Date();
    const newNegotiation = await Negotiation.create({
      chatId: chat._id,
      doctorId: chat.doctorId?._id || chat.doctorId,
      userId: chat.userId?._id || chat.userId,
      date: parsedDate,
      time: String(time).trim(),
      amount: parsedAmount,
      mode,
      status: 'PENDING',
      acceptedByDoctor: false,
      acceptedByUser: false,
      createdAt: now,
      updatedAt: now,
    });

    const messageText = buildNegotiationMessageText({
      amount: parsedAmount,
      mode,
      date: parsedDate,
      time: String(time).trim(),
    });

    const message = await Message.create({
      chatId: chat._id,
      type: 'NEGOTIATION',
      senderId: actor.actorId,
      senderRole: actor.actorRole,
      message: messageText,
      negotiationId: newNegotiation._id,
      timestamp: now,
      read: false,
    });

    await Chat.updateOne(
      { _id: chat._id },
      {
        $set: {
          lastMessage: messageText,
          updatedAt: now,
        },
      }
    );

    const hydratedMessage = await Message.findById(message._id).populate('negotiationId');
    emitChatMessage(req, chat, hydratedMessage);
    res.status(201).json({
      oldNegotiation: serializeNegotiation(oldNegotiation),
      newMessage: serializeMessage(hydratedMessage)
    });
  } catch (error) {
    handleChatError(res, error, 'Failed to counter negotiation');
  }
};

const deleteChat = async (req, res) => {
  try {
    const actor = await getActorContext(req.userId);
    const chat = await ensureChatAccess(req.params.chatId, actor);
    
    // Clear chat data
    await Message.deleteMany({ chatId: chat._id });
    await Negotiation.deleteMany({ chatId: chat._id });
    await Chat.deleteOne({ _id: chat._id });

    // Notify other party
    const realtime = getRealtime(req);
    if (realtime) {
      realtime.emitToRoom(String(chat.doctorId?._id || chat.doctorId), 'chat:deleted', { chatId: String(chat._id) });
      realtime.emitToRoom(String(chat.userId?._id || chat.userId), 'chat:deleted', { chatId: String(chat._id) });
    }

    res.json({ success: true });
  } catch (error) {
    handleChatError(res, error, 'Failed to delete chat');
  }
};

module.exports = {
  getActorContext,
  ensureChatAccess,
  initiateChat,
  listChats,
  getMessages,
  markChatAsRead,
  sendMessage,
  createNegotiation,
  acceptNegotiation,
  counterNegotiation,
  deleteChat,
};
