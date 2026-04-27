const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const { randomBytes } = require('crypto');
require('dotenv').config();

const User = require('./models/User');
const Doctor = require('./models/Doctor');
const Appointment = require('./models/Appointment');
const Report = require('./models/Report');
const Prescription = require('./models/Prescription');
const chatRoutes = require('./routes/chatRoutes');
const { registerChatSocket } = require('./sockets/chatSocket');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'doctor_portal_secret_key_123';
const JWT_FALLBACK_SECRETS = ['doctor_portal_secret_key_123'].filter((secret) => secret !== JWT_SECRET);

// CLOUD URI - Hardcoded to ensure connection
const MONGODB_URI = 'mongodb+srv://doc-connect:doc-connect@doc-connect.mpev56u.mongodb.net/doctor_portal?retryWrites=true&w=majority&appName=doc-connect';

// Middleware
app.use(cors());
app.use(express.json());
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

// Multer Setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH'],
  },
});
app.set('io', io);
app.set('chatRealtime', registerChatSocket({ io, jwtSecret: JWT_SECRET }));

// Global Logger for Debugging
app.use((req, res, next) => {
  console.log(`🔌 [${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Connect to MongoDB
console.log('⏳ Connecting to MongoDB Cloud...');
mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('✅ MongoDB Cloud Connected Successfully!');

    try {
      const collection = mongoose.connection.db.collection('chats');
      const indexes = await collection.indexes();
      const legacyIndex = indexes.find((index) => index.name === 'user1_id_1_user2_id_1');
      if (legacyIndex) {
        await collection.dropIndex('user1_id_1_user2_id_1');
        console.log('🧹 Dropped legacy chats index: user1_id_1_user2_id_1');
      }
    } catch (error) {
      console.warn('⚠️ Could not verify/drop legacy chats index:', error.message);
    }
  })
  .catch(err => console.error('❌ MongoDB Connection Error:', err.message));

// Auth Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    console.log('❌ No token provided for:', req.method, req.url);
    return res.sendStatus(401);
  }

  const verifyWithSecret = (secret) => new Promise((resolve, reject) => {
    jwt.verify(token, secret, (err, decoded) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(decoded);
    });
  });

  const verifyToken = async () => {
    try {
      const decoded = await verifyWithSecret(JWT_SECRET);
      req.userId = decoded.userId;
      next();
      return;
    } catch (primaryError) {
      for (const fallbackSecret of JWT_FALLBACK_SECRETS) {
        try {
          const decoded = await verifyWithSecret(fallbackSecret);
          req.userId = decoded.userId;
          next();
          return;
        } catch (_fallbackError) {
          // try next fallback
        }
      }

      console.log('❌ Token verification failed for:', req.method, req.url, '| Error:', primaryError.message);
      return res.sendStatus(403);
    }
  };

  verifyToken();
};

const normalizeMedicineRows = (rows) => {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const name = String(item.name || '').trim();
      const details = String(item.details || '').trim();
      if (!name && !details) return null;
      return { name, details };
    })
    .filter(Boolean);
};

const buildJitsiRoom = (appointmentId) => {
  const token = randomBytes(4).toString('hex');
  return `appt-${appointmentId}-${token}`.toLowerCase();
};

const buildJitsiLink = (roomId) => `https://meet.jit.si/${encodeURIComponent(roomId)}#config.prejoinPageEnabled=false`;

// ─── HEALTH CHECK (No auth required) ───
app.get('/api/health', (req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    dbConnected,
    port: PORT
  });
});

// Profile Image Upload
app.post('/api/upload-profile-image', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    
    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    
    // Update both User and Doctor if applicable
    const user = await User.findByIdAndUpdate(req.userId, { profileImage: imageUrl }, { new: true });
    
    const doctor = await Doctor.findOneAndUpdate(
      { userId: req.userId },
      { $set: { 'basicInfo.profileImage': imageUrl } },
      { new: true }
    );

    res.json({ imageUrl, user, doctor });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- AUTH ROUTES ---

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    const user = new User({ email, password, name });
    await user.save();

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({
      token, user: {
        id: user._id,
        email: user.email,
        name: user.name,
        isOnboarded: false
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token, user: {
        id: user._id,
        email: user.email,
        name: user.name,
        age: user.age,
        gender: user.gender,
        height: user.height,
        weight: user.weight,
        phone: user.phone,
        address: user.address,
        profileImage: user.profileImage,
        isOnboarded: user.isOnboarded
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- PATIENT DASHBOARD ROUTES ---

app.get('/api/patient/reports', authenticateToken, async (req, res) => {
  try {
    const reports = await Report.find({ patientId: req.userId, hiddenByPatient: { $ne: true } }).sort({ createdAt: -1 });
    res.json(reports);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.delete('/api/patient/reports/:id', authenticateToken, async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report || report.patientId.toString() !== req.userId) {
      return res.status(404).json({ message: 'Report not found' });
    }

    report.hiddenByPatient = true;
    await report.save();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/patient/appointments', authenticateToken, async (req, res) => {
  try {
    const appointments = await Appointment.find({ 
      patientId: req.userId, 
      hiddenByPatient: { $ne: true } 
    }).populate('doctorId').sort({ createdAt: -1 });
    const safeAppointments = appointments.map((appointmentDoc) => {
      const appointment = appointmentDoc.toObject();
      const status = String(appointment.meetingStatus || 'scheduled').toLowerCase();
      if (status !== 'live') {
        appointment.meetingLink = null;
      }
      return appointment;
    });
    res.json(safeAppointments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.delete('/api/patient/appointments/:id', authenticateToken, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment || appointment.patientId.toString() !== req.userId) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Soft hide for patient
    appointment.hiddenByPatient = true;
    appointment.status = 'cancelled';
    appointment.cancelledByPatient = true;
    appointment.cancelledAt = new Date();
    appointment.cancellationNote = 'Cancelled by patient';

    await appointment.save();
    console.log(`✅ Appointment ${req.params.id} cancelled by patient.`);
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Error hiding appointment:', err.message);
    res.status(500).json({ message: err.message });
  }
});

app.patch('/api/patient/profile', authenticateToken, async (req, res) => {
  try {
    console.log(`📝 [PATCH /api/patient/profile] Updating user: ${req.userId}`);
    const updateData = { ...req.body };
    delete updateData.password;
    
    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: updateData },
      { new: true }
    ).select('-password');
    
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error(`❌ PROFILE UPDATE ERROR: ${err.message}`);
    res.status(500).json({ message: err.message });
  }
});


// --- DOCTOR ROUTES ---

app.get('/api/doctor/profile', authenticateToken, async (req, res) => {
  try {
    console.log(`📍 [GET /api/doctor/profile] Fetching profile for userId: ${req.userId}`);
    
    const doctor = await Doctor.findOne({ userId: req.userId });
    if (!doctor) {
      console.log(`ℹ️ [GET /api/doctor/profile] No profile found for userId: ${req.userId} (might be a patient)`);
      return res.status(404).json({ message: 'Doctor profile not found', exists: false });
    }
    
    console.log(`✅ [GET /api/doctor/profile] Profile found: ${doctor._id}`);
    res.json({ ...doctor.toObject(), exists: true });
  } catch (err) {
    console.error(`❌ [GET /api/doctor/profile] Error: ${err.message}`);
    console.error(err.stack);
    res.status(500).json({ message: `Server error: ${err.message}` });
  }
});

app.patch('/api/doctor/profile', authenticateToken, async (req, res) => {
  try {
    const updateData = { ...req.body, updatedAt: Date.now() };
    if (req.body.location && Array.isArray(req.body.location)) {
      updateData.location = {
        type: 'Point',
        coordinates: [parseFloat(req.body.location[0]), parseFloat(req.body.location[1])]
      };
    }
    const doctor = await Doctor.findOneAndUpdate(
      { userId: req.userId },
      { $set: updateData },
      { new: true, upsert: true }
    );
    res.json(doctor);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.patch('/api/doctor/leave-toggle', authenticateToken, async (req, res) => {
  try {
    console.log('🔄 Leave toggle requested by user:', req.userId);
    const doctor = await Doctor.findOne({ userId: req.userId });
    if (!doctor) {
      console.log('❌ Doctor profile not found for userId:', req.userId);
      return res.status(404).json({ message: 'Doctor profile not found' });
    }
    const oldVal = doctor.onLeave;
    doctor.onLeave = !doctor.onLeave;
    doctor.updatedAt = Date.now();
    await doctor.save();
    console.log(`✅ Leave toggled: ${oldVal} → ${doctor.onLeave}`);
    res.json({ onLeave: doctor.onLeave });
  } catch (err) {
    console.error('❌ Leave toggle error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/doctor/onboarding', authenticateToken, async (req, res) => {
  try {
    const doctorData = { ...req.body, userId: req.userId };
    if (req.body.location && Array.isArray(req.body.location)) {
      doctorData.location = {
        type: 'Point',
        coordinates: [parseFloat(req.body.location[0]), parseFloat(req.body.location[1])]
      };
    }
    const doctor = new Doctor(doctorData);
    await doctor.save();
    await User.findByIdAndUpdate(req.userId, { isOnboarded: true });
    res.status(201).json({ success: true, doctor });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/doctor/appointments', authenticateToken, async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ userId: req.userId });
    if (!doctor) return res.status(404).json({ message: 'Doctor profile not found' });
    const appointments = await Appointment.find({ doctorId: doctor._id })
      .populate('patientId', 'name email profileImage')
      .populate('prescriptionId')
      .sort({ createdAt: -1 });
    res.json(appointments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/doctor/appointments/:id', authenticateToken, async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ userId: req.userId }).select('_id');
    if (!doctor) return res.status(404).json({ message: 'Doctor profile not found' });

    const appointment = await Appointment.findOne({ _id: req.params.id, doctorId: doctor._id })
      .populate('patientId', 'name email profileImage')
      .populate('prescriptionId');
    if (!appointment) return res.status(404).json({ message: 'Appointment not found' });

    res.json(appointment);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/doctor/consultation/start', authenticateToken, async (req, res) => {
  try {
    const { appointmentId } = req.body;
    if (!appointmentId) return res.status(400).json({ message: 'appointmentId is required' });

    const doctor = await Doctor.findOne({ userId: req.userId }).select('_id');
    if (!doctor) return res.status(404).json({ message: 'Doctor profile not found' });

    const appointment = await Appointment.findOne({ _id: appointmentId, doctorId: doctor._id });
    if (!appointment) return res.status(404).json({ message: 'Appointment not found' });
    if (String(appointment.status || '').toLowerCase() !== 'confirmed') {
      return res.status(409).json({ message: 'Only confirmed appointments can start consultation' });
    }
    if (String(appointment.type || '').toLowerCase() !== 'online') {
      return res.status(409).json({ message: 'Consultation workspace is only available for online appointments' });
    }

    if (!appointment.roomId) {
      appointment.roomId = buildJitsiRoom(appointment._id.toString());
    }
    appointment.meetingType = 'jitsi';
    appointment.meetingLink = buildJitsiLink(appointment.roomId);
    appointment.meetingStatus = 'live';
    appointment.startedAt = appointment.startedAt || new Date();
    appointment.endedAt = undefined;
    appointment.updatedAt = new Date();
    await appointment.save();

    res.json({
      success: true,
      appointment,
      meetingLink: appointment.meetingLink,
      roomId: appointment.roomId,
      meetingStatus: appointment.meetingStatus,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/doctor/consultation/end', authenticateToken, async (req, res) => {
  try {
    const { appointmentId } = req.body;
    if (!appointmentId) return res.status(400).json({ message: 'appointmentId is required' });

    const doctor = await Doctor.findOne({ userId: req.userId }).select('_id');
    if (!doctor) return res.status(404).json({ message: 'Doctor profile not found' });

    const appointment = await Appointment.findOne({ _id: appointmentId, doctorId: doctor._id });
    if (!appointment) return res.status(404).json({ message: 'Appointment not found' });

    appointment.meetingStatus = 'ended';
    appointment.endedAt = new Date();
    appointment.updatedAt = new Date();
    await appointment.save();

    res.json({ success: true, appointment });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/doctor/prescription/:appointmentId', authenticateToken, async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ userId: req.userId }).select('_id');
    if (!doctor) return res.status(404).json({ message: 'Doctor profile not found' });

    const appointment = await Appointment.findOne({
      _id: req.params.appointmentId,
      doctorId: doctor._id
    }).select('_id doctorId patientId meetingStatus consultationCompleted');
    if (!appointment) return res.status(404).json({ message: 'Appointment not found' });

    const prescription = await Prescription.findOne({ appointmentId: appointment._id });
    if (!prescription) {
      return res.json({
        appointmentId: appointment._id,
        doctorId: appointment.doctorId,
        patientId: appointment.patientId,
        notes: '',
        medicines: [],
        status: 'draft',
        meetingStatus: appointment.meetingStatus || 'scheduled',
        consultationCompleted: !!appointment.consultationCompleted,
        createdAt: null,
        updatedAt: null,
        finalizedAt: null,
      });
    }

    res.json({
      ...prescription.toObject(),
      meetingStatus: appointment.meetingStatus || 'scheduled',
      consultationCompleted: !!appointment.consultationCompleted,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/doctor/prescription/draft', authenticateToken, async (req, res) => {
  try {
    const { appointmentId, notes = '', medicines = [] } = req.body;
    if (!appointmentId) return res.status(400).json({ message: 'appointmentId is required' });

    const doctor = await Doctor.findOne({ userId: req.userId }).select('_id');
    if (!doctor) return res.status(404).json({ message: 'Doctor profile not found' });

    const appointment = await Appointment.findOne({
      _id: appointmentId,
      doctorId: doctor._id
    }).select('_id doctorId patientId meetingStatus consultationCompleted');
    if (!appointment) return res.status(404).json({ message: 'Appointment not found' });

    const draft = await Prescription.findOneAndUpdate(
      { appointmentId: appointment._id },
      {
        $set: {
          doctorId: appointment.doctorId,
          patientId: appointment.patientId,
          notes: String(notes || ''),
          medicines: normalizeMedicineRows(medicines),
          status: 'draft',
          updatedAt: new Date(),
        },
        $setOnInsert: {
          appointmentId: appointment._id,
          createdAt: new Date(),
        }
      },
      { upsert: true, new: true }
    );

    res.json(draft);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/doctor/prescription/finalize', authenticateToken, async (req, res) => {
  try {
    const { appointmentId, notes = '', medicines = [] } = req.body;
    if (!appointmentId) return res.status(400).json({ message: 'appointmentId is required' });

    const doctor = await Doctor.findOne({ userId: req.userId }).select('_id');
    if (!doctor) return res.status(404).json({ message: 'Doctor profile not found' });

    const appointment = await Appointment.findOne({
      _id: appointmentId,
      doctorId: doctor._id
    });
    if (!appointment) return res.status(404).json({ message: 'Appointment not found' });

    if ((appointment.meetingStatus || 'scheduled') === 'scheduled') {
      return res.status(409).json({ message: 'Consultation has not started yet' });
    }

    const finalizedAt = new Date();
    const prescription = await Prescription.findOneAndUpdate(
      { appointmentId: appointment._id },
      {
        $set: {
          doctorId: appointment.doctorId,
          patientId: appointment.patientId,
          notes: String(notes || ''),
          medicines: normalizeMedicineRows(medicines),
          status: 'finalized',
          finalizedAt,
          updatedAt: finalizedAt,
        },
        $setOnInsert: {
          appointmentId: appointment._id,
          createdAt: finalizedAt,
        }
      },
      { upsert: true, new: true }
    );

    appointment.prescriptionId = prescription._id;
    appointment.consultationCompleted = true;
    appointment.meetingStatus = 'ended';
    appointment.endedAt = finalizedAt;
    appointment.updatedAt = finalizedAt;
    await appointment.save();

    res.json({ success: true, prescription, appointment });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/patient/prescription/:appointmentId', authenticateToken, async (req, res) => {
  try {
    const appointment = await Appointment.findOne({
      _id: req.params.appointmentId,
      patientId: req.userId
    }).populate('prescriptionId');

    if (!appointment) return res.status(404).json({ message: 'Appointment not found' });
    if (!appointment.prescriptionId) return res.status(404).json({ message: 'Prescription not available yet' });
    if (appointment.prescriptionId.status !== 'finalized') {
      return res.status(403).json({ message: 'Prescription is still in draft mode' });
    }

    res.json({
      appointmentId: appointment._id,
      consultationCompleted: !!appointment.consultationCompleted,
      consultedAt: appointment.endedAt || appointment.updatedAt,
      prescription: appointment.prescriptionId
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


app.patch('/api/appointments/:id', authenticateToken, async (req, res) => {
  try {
    const updateData = { ...req.body, updatedAt: Date.now() };
    const appointment = await Appointment.findByIdAndUpdate(req.params.id, updateData, { new: true });
    res.json(appointment);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.patch('/api/appointments/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    const appointment = await Appointment.findByIdAndUpdate(req.params.id, { status }, { new: true });
    res.json(appointment);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});



app.use('/api/chat', authenticateToken, chatRoutes);

// --- PUBLIC/AI BOT ROUTES ---

app.get('/api/public/doctors/nearby', async (req, res) => {
  try {
    const { lat, lng, radius = 5000000, all } = req.query;
    const leaveFilter = { $in: [false, null] };
    if (all === 'true') {
      const allDoctors = await Doctor.find({ onLeave: leaveFilter });
      return res.json(allDoctors);
    }
    if (!lat || !lng) return res.status(400).json({ message: 'Latitude and Longitude required' });
    const doctors = await Doctor.find({
      onLeave: leaveFilter,
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: parseFloat(radius)
        }
      }
    });
    res.json(doctors);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/public/doctors/:id/availability', async (req, res) => {
  console.log('🔍 FETCHING AVAILABILITY for doctor:', req.params.id);
  try {
    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) {
      console.log('❌ Doctor NOT FOUND in DB');
      return res.status(404).json({ message: 'Doctor not found' });
    }
    
    // Return profile and confirmed appointments to calculate gaps
    const appointments = await Appointment.find({ 
      doctorId: req.params.id, 
      status: { $in: ['confirmed', 'scheduled'] } 
    }).select('startTime endTime duration status');
    
    res.json({
      doctor,
      appointments
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/public/appointments/book', async (req, res) => {
  console.log('📡 INCOMING BOOKING REQUEST:', req.body);
  try {
    const { doctorId, patientId, sessionData } = req.body;
    
    if (!doctorId || !patientId) {
      return res.status(418).json({ message: 'Both Doctor ID and Patient ID are required for booking.' });
    }

    if (doctorId.length !== 24 || patientId.length !== 24) {
      return res.status(418).json({ message: 'Invalid format for Doctor ID or Patient ID.' });
    }

    const appointment = new Appointment({ 
      doctorId, 
      patientId, 
      sessionData, 
      status: 'pending' 
    });
    await appointment.save();
    res.status(201).json({ success: true, appointment });
  } catch (err) {
    console.error('❌ BOOKING ERROR:', err);
    res.status(500).json({ message: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
