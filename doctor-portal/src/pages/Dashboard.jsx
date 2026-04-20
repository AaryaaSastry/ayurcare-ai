import React, { useEffect, useState } from 'react';
import { authService, doctorService, doctorChatService } from '../services/api';
import Sidebar from '../components/Sidebar';
import {
  Users,
  Calendar,
  DollarSign,
  Clock,
  User,
  Plus,
  MoreVertical,
  History,
  Building2,
  FileText,
  CalendarDays,
  Video,
  MapPin,
  RefreshCcw,
  CheckCircle2,
  Trash2,
  X,
  Download,
  Bell,
  AlertCircle,
  Activity,
  ArrowRight,
  MessageSquare,
  Lock,
  ChevronLeft,
  ChevronRight,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const [user, setUser] = useState(authService.getCurrentUser());
  const [doctorData, setDoctorData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState([]); // Empty appointments for today
  const [activeFilter, setActiveFilter] = useState('pending');
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [schedulingApt, setSchedulingApt] = useState(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [dismissedNotifications, setDismissedNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem('dismissed_doctor_notifications');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const navigate = useNavigate();

  const [scheduleData, setScheduleData] = useState({
    type: 'online',
    date: new Date().toISOString().split('T')[0],
    time: '10:00',
    duration: 30,
    notes: '',
    fee: 0
  });

  const openPatientChat = async (userId) => {
    if (!userId) return;
    try {
      const chat = await doctorChatService.initiateChat({ userId });
      if (!chat?._id) throw new Error('Missing chat id');
      navigate(`/messages/${chat._id}`);
    } catch (err) {
      console.error('Failed to open patient chat:', err);
    }
  };

  const normalizeStatus = (status) => String(status || '').toLowerCase().trim();

  const parseDiagnosis = (diag) => {
    try {
      if (typeof diag === 'string') return JSON.parse(diag);
      return diag || {};
    } catch (e) {
      return {};
    }
  };

  // Parse "10 AM - 6 PM" or "10:00 AM – 5:30 PM" style strings → { startHour, endHour, minTime, maxTime }
  const parseTimingsString = (str) => {
    if (!str) return { startHour: 8, endHour: 20, minTime: '08:00', maxTime: '20:00' };
    try {
      const match = str.match(/(\d+)(?::(\d+))?\s*(AM|PM)\s*[-–]\s*(\d+)(?::(\d+))?\s*(AM|PM)/i);
      if (!match) return { startHour: 8, endHour: 20, minTime: '08:00', maxTime: '20:00' };
      let sh = parseInt(match[1]), sm = parseInt(match[2] || '0'), sap = match[3].toUpperCase();
      let eh = parseInt(match[4]), em = parseInt(match[5] || '0'), eap = match[6].toUpperCase();
      if (sap === 'PM' && sh !== 12) sh += 12; if (sap === 'AM' && sh === 12) sh = 0;
      if (eap === 'PM' && eh !== 12) eh += 12; if (eap === 'AM' && eh === 12) eh = 0;
      const minTime = `${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}`;
      const maxTime = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
      return { startHour: sh, endHour: eh, minTime, maxTime };
    } catch { return { startHour: 8, endHour: 20, minTime: '08:00', maxTime: '20:00' }; }
  };

  const getPatientName = (apt) => {
    if (!apt) return "Anonymous User";
    if (apt.patientId && typeof apt.patientId === 'object') {
      const user = apt.patientId;
      if (user.name && user.name !== "Patient") return user.name;
      if (user.email) return `User ${user.email.split('@')[0]}`;
    }
    if (typeof apt.patientId === 'string' && apt.patientId.includes('@')) {
      return `User ${apt.patientId.split('@')[0]}`;
    }
    const report = parseDiagnosis(apt.sessionData?.diagnosis);
    if (report?.patientInfo?.name && report.patientInfo.name !== "Patient") return report.patientInfo.name;
    const idStr = apt.patientId?._id || apt.patientId || '';
    const cleanId = idStr.toString();
    return cleanId && cleanId.length > 4 ? `User #${cleanId.slice(-4)}` : "New Lead";
  };

  const getPatientEmail = (apt) => {
    if (apt?.patientId && typeof apt.patientId === 'object') {
      return apt.patientId.email;
    }
    return null;
  };

  const fetchData = async () => {
    const profile = await doctorService.getProfile();
    setDoctorData(profile);

    const apts = await doctorService.getAppointments();
    setAppointments(apts);

    setLoading(false);
  };

  useEffect(() => {
    if (user) {
      fetchData();
      // Set up polling for real-time notifications
      const interval = setInterval(fetchData, 30000); 
      return () => clearInterval(interval);
    } else {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (doctorData) {
      setScheduleData(prev => ({ ...prev, fee: doctorData.availability.fees }));
    }
  }, [doctorData]);

  const availableDays = React.useMemo(() => {
    const days = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  }, []);

  const timeSlots = React.useMemo(() => {
    if (!doctorData?.availability?.timings || !scheduleData.date) return [];
    
    // Parse doctor working hours
    const { minTime, maxTime } = parseTimingsString(doctorData.availability.timings);
    const [startH, startM] = minTime.split(':').map(Number);
    const [endH, endM] = maxTime.split(':').map(Number);
    
    const slots = [];
    const baseDate = scheduleData.date; 

    // Create current day's working window in local time
    let curr = new Date(`${baseDate}T00:00:00`);
    curr.setHours(startH, startM, 0, 0);
    const end = new Date(`${baseDate}T00:00:00`);
    end.setHours(endH, endM, 0, 0);
    
    // Convert duration to number
    const requestedDuration = Number(scheduleData.duration) || 30;
    const now = new Date();
    let foundRecommended = false;

    while (curr < end) {
      const timeStr = curr.toTimeString().slice(0, 5);
      
      const sStart = new Date(curr.getTime());
      const sEnd = new Date(sStart.getTime() + requestedDuration * 60 * 1000);

      // Check overlap against all confirmed/scheduled appointments
      const isBooked = appointments.some(apt => {
        const status = normalizeStatus(apt.status);
        if (status !== 'confirmed' && status !== 'scheduled') return false;
        const aStart = new Date(apt.startTime);
        let aEnd;
        if (apt.endTime) {
          aEnd = new Date(apt.endTime);
        } else {
          const duration = apt.duration || 30;
          aEnd = new Date(aStart.getTime() + duration * 60 * 1000);
        }
        return (sStart < aEnd && sEnd > aStart);
      });
      
      // A slot is recommended if it is the first available slot 
      // AND (if today) it is at least 30 minutes in the future
      let isRecommended = false;
      const isPast = sStart < new Date(now.getTime() + 15 * 60 * 1000);
      const isToday = baseDate === new Date().toISOString().split('T')[0];

      if (!isBooked && !foundRecommended) {
        if (!isToday || !isPast) {
          isRecommended = true;
          foundRecommended = true;
        }
      }

      slots.push({
        time: timeStr,
        label: curr.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isBooked,
        isRecommended: isRecommended && !isBooked
      });
      
      curr = new Date(curr.getTime() + 15 * 60 * 1000); 
    }
    return slots;
  }, [doctorData, scheduleData.date, scheduleData.duration, appointments]);

  const handleUpdateStatus = async (id, status) => {
    try {
      if (status === 'confirmed') {
        const apt = appointments.find(a => a._id === id);
        setSchedulingApt(apt);
        setIsScheduleModalOpen(true);
        return;
      }
      const success = await doctorService.updateAppointmentStatus(id, status);
      if (success) {
        await fetchData();
      }
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  

  const handleScheduleConfirm = async (e) => {
    e.preventDefault();
    if (!schedulingApt) return;

    try {
      const start = new Date(`${scheduleData.date}T${scheduleData.time}`);
      const end = new Date(start.getTime() + scheduleData.duration * 60000);

      const updateData = {
        status: 'confirmed',
        type: scheduleData.type,
        startTime: start,
        endTime: end,
        duration: scheduleData.duration,
        notes: scheduleData.notes,
        fee: scheduleData.fee,
        meetingLink: scheduleData.type === 'online' ? `https://meet.google.com/${Math.random().toString(36).substring(2, 5)}-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 5)}` : null
      };

      const success = await doctorService.updateAppointment(schedulingApt._id, updateData);
      if (success) {
        setIsScheduleModalOpen(false);
        setSchedulingApt(null);
        await fetchData();
      } else {
        alert('Failed to schedule the appointment. Please ensure the server is running correctly.');
      }
    } catch (err) {
      console.error('Failed to schedule', err);
      alert('Error scheduling appointment');
    }
  };

  const activeAppointments = appointments.filter(a => {
    const s = normalizeStatus(a.status);
    return s !== 'cancelled' && s !== 'canceled';
  });
  const cancelledByPatient = appointments.filter(a => {
    const s = normalizeStatus(a.status);
    return (s === 'cancelled' || s === 'canceled') && a.cancelledByPatient;
  });
  const pendingAppointments = appointments.filter(a => ['pending', 'scheduled'].includes(normalizeStatus(a.status)));
  
  const isRecent = (date) => {
    if (!date) return false;
    const d = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    return d >= yesterday;
  };

  const latestPending = pendingAppointments.find(a => 
    !dismissedNotifications.includes(a._id) && 
    isRecent(a.startTime || a.createdAt)
  );
  
  const latestCancelled = cancelledByPatient.find(a => 
    !dismissedNotifications.includes(a._id) && 
    isRecent(a.cancelledAt || a.updatedAt || a.createdAt)
  );

  const handleMarkAsRead = () => {
    const ids = [
      ...pendingAppointments.map(a => a._id),
      ...cancelledByPatient.map(a => a._id)
    ];
    
    const updated = Array.from(new Set([...dismissedNotifications, ...ids]));
    setDismissedNotifications(updated);
    try {
      localStorage.setItem('dismissed_doctor_notifications', JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to save dismissed notifications", e);
    }
    setIsNotificationsOpen(false); // Close dropdown after marking as read
  };

  const filteredAppointments = activeAppointments.filter((apt) => {
    // Filter by date for the main panels
    const aptDate = apt.startTime ? new Date(apt.startTime) : new Date(apt.createdAt);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    // If it's before yesterday, hide from main panels
    if (aptDate < yesterday) return false;

    if (activeFilter === 'all') return true;
    return apt.status === activeFilter;
  });

  // Daily Schedule List (Confirmed & Today only, and not ended yet)
  const todayStr = new Date().toISOString().split('T')[0];
  const dailySchedule = activeAppointments.filter(a => {
    if (a.status !== 'confirmed') return false;
    if (!a.startTime) return false;
    
    const startTime = new Date(a.startTime);
    const duration = a.duration || 30;
    const endTime = a.endTime ? new Date(a.endTime) : new Date(startTime.getTime() + duration * 60000);
    const now = new Date();

    const aptDateStr = startTime.toISOString().split('T')[0];
    return aptDateStr === todayStr && endTime > now;
  }).sort((a, b) => new Date(a.startTime) - new Date(b.startTime));



  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  const StatBox = ({ icon: Icon, label, value, colorClass, trend }) => (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex items-center gap-4">
      <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${colorClass} bg-opacity-10 shrink-0`}>
        <Icon className={`h-6 w-6 text-${colorClass.replace('bg-', '')}`} />
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-0.5">{label}</span>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-black text-slate-900 leading-none">{value}</span>
          {trend && <span className="text-[10px] font-bold text-emerald-500">+{trend}%</span>}
        </div>
      </div>
    </div>
  );


  return (
    <div className="min-h-screen w-full bg-[#f8fafc] flex">
      {/* SIDEBAR NAVIGATION */}
      <Sidebar />

      {/* MAIN DASHBOARD CONTENT */}
      <main className="flex-1 ml-72 p-10 max-w-[1600px]">

        {/* HEADER */}
        <div className="flex items-center justify-between mb-12">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">
              Hello, Dr. {doctorData?.basicInfo.name.split(' ').slice(-1)[0]}
              <span className="ml-3 text-3xl">🩺</span>
            </h1>
            <p className="text-slate-500 mt-2 font-medium">Welcome to your daily clinical overview.</p>
          </motion.div>

          <div className="flex items-center gap-4 relative">
             <button 
               onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
               className="h-14 w-14 rounded-2xl bg-white border border-slate-100 flex items-center justify-center relative hover:bg-slate-50 transition-colors shadow-sm"
             >
                <Bell className="h-6 w-6 text-slate-600" />
                {(latestPending || latestCancelled) && (
                  <span className="absolute top-3 right-3 h-3 w-3 bg-rose-500 rounded-full border-2 border-white" />
                )}
             </button>

             <AnimatePresence>
                {isNotificationsOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute top-full right-0 mt-4 w-96 bg-white rounded-3xl shadow-2xl border border-slate-100 z-[100] overflow-hidden"
                  >
                    <div className="px-6 py-5 border-b border-slate-50 flex items-center justify-between">
                      <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Clinical Alerts</h3>
                      <button onClick={() => setIsNotificationsOpen(false)}><X className="h-4 w-4 text-slate-400" /></button>
                    </div>
                    <div className="p-2 max-h-[400px] overflow-y-auto">
                      {latestPending ? (
                        <div className="p-4 rounded-2xl hover:bg-emerald-50/50 transition-colors flex gap-4 border border-transparent hover:border-emerald-100 mb-1">
                          <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                            <Plus className="h-5 w-5 text-emerald-600" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-slate-900">New Appointment Request</span>
                            <span className="text-[11px] text-slate-500 font-medium">From {getPatientName(latestPending)}</span>
                            <button 
                              onClick={() => { setActiveFilter('pending'); setIsNotificationsOpen(false); }}
                              className="mt-2 text-[10px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-1"
                            >
                              Review Lead <ArrowRight className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {latestCancelled ? (
                        <div className="p-4 rounded-2xl hover:bg-rose-50/50 transition-colors flex gap-4 border border-transparent hover:border-rose-100">
                          <div className="h-10 w-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                            <AlertCircle className="h-5 w-5 text-rose-600" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-slate-900">Appointment Cancelled</span>
                            <span className="text-[11px] text-slate-500 font-medium">{getPatientName(latestCancelled)} cancelled their session.</span>
                            <span className="mt-2 text-[10px] font-bold text-rose-400">Occurred recently</span>
                          </div>
                        </div>
                      ) : null}

                      {!latestPending && !latestCancelled && (
                        <div className="py-12 text-center text-slate-400">
                          <Activity className="h-8 w-8 mx-auto mb-3 opacity-20" />
                          <p className="text-xs font-bold">No new clinical alerts</p>
                        </div>
                      )}
                    </div>
                    <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 text-center">
                      <button 
                         onClick={handleMarkAsRead}
                         className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-800 transition-colors"
                      >
                         Mark all as read
                      </button>
                    </div>
                  </motion.div>
                )}
             </AnimatePresence>
          </div>
        </div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-[2.5rem] p-8 shadow-2xl shadow-slate-200/50 border border-slate-100 flex flex-col lg:flex-row gap-10"
          >
            <div className="flex-1">
              <div className="flex items-center justify-between mb-10 px-2">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 bg-primary-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-600/20">
                    <CalendarDays className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Today's Agenda</h2>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mt-1">Confirmed Clinical Slots</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/schedule')}
                  className="px-6 py-3 rounded-2xl bg-slate-50 text-slate-600 text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all border border-slate-200/50"
                >
                  Full Timetable
                </button>
              </div>

              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {dailySchedule.length > 0 ? dailySchedule.map((apt, index) => (
                  <motion.div
                    key={apt._id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center gap-6 p-5 rounded-[1.5rem] bg-slate-50/50 border border-slate-100 hover:bg-white hover:shadow-xl hover:shadow-slate-200/40 hover:border-primary-100 transition-all group cursor-pointer"
                  >
                    <div className="w-20 shrink-0 flex flex-col items-center">
                      <span className="text-sm font-black text-slate-900">{new Date(apt.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <div className="h-4 w-[2px] bg-slate-200 my-1" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Start</span>
                    </div>
                    
                    <div className="h-10 w-px bg-slate-200" />

                    <div className="flex-1 flex items-center justify-between">
                      <div>
                        <h4 className="text-base font-black text-slate-900 group-hover:text-primary-700 transition-colors uppercase tracking-tight">{getPatientName(apt)}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest ${apt.type === 'online' ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>{apt.type}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">• {apt.duration || 30} mins</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 opacity-20 group-hover:opacity-100 transition-opacity">
                         <button onClick={() => openPatientChat(apt.patientId?._id || apt.patientId)} className="h-10 w-10 rounded-xl bg-white flex items-center justify-center text-slate-600 border border-slate-200 hover:border-primary-500 hover:text-primary-600 shadow-sm"><MessageSquare size={16} /></button>
                         <button onClick={() => navigate('/schedule')} className="h-10 w-10 rounded-xl bg-white flex items-center justify-center text-slate-600 border border-slate-200 hover:border-primary-500 hover:text-primary-600 shadow-sm"><ArrowRight size={16} /></button>
                      </div>
                    </div>
                  </motion.div>
                )) : (
                  <div className="py-20 flex flex-col items-center justify-center bg-slate-50/30 rounded-[2rem] border border-dashed border-slate-200">
                    <CalendarDays className="h-12 w-12 text-slate-200 mb-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Clinical schedule is empty today</span>
                  </div>
                )}
              </div>
            </div>

            {/* NEXT SESSION SPOTLIGHT CARD */}
            <div className="lg:w-[360px] shrink-0">
               <div className="h-full bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl flex flex-col">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none" />
                  <div className="relative z-10">
                    <span className="text-[10px] font-black uppercase tracking-[0.25em] text-primary-400">Coming Up Next</span>
                    
                    {dailySchedule.length > 0 ? (
                      <div className="mt-8 flex flex-col h-full">
                        <div className="flex items-center gap-5 mb-8">
                          <div className="h-20 w-20 bg-white/10 rounded-3xl flex items-center justify-center backdrop-blur shadow-inner ring-1 ring-white/10">
                            <User className="h-10 w-10 text-white opacity-90" />
                          </div>
                          <div>
                            <h3 className="text-xl font-black tracking-tight">{getPatientName(dailySchedule[0])}</h3>
                            <div className="flex items-center gap-2 mt-1">
                               <Clock className="h-3 w-3 text-primary-400" />
                               <span className="text-xs font-black text-primary-400 uppercase">{new Date(dailySchedule[0].startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3 mt-auto">
                           <button
                             onClick={() => openPatientChat(dailySchedule[0].patientId?._id || dailySchedule[0].patientId)}
                             className="w-full py-5 bg-white/10 hover:bg-white/20 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all border border-white/5"
                           >
                             Quick Message
                           </button>
                           <button
                             className="w-full py-5 bg-primary-600 hover:bg-primary-500 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-primary-600/30 flex items-center justify-center gap-3"
                           >
                             Launch Consultation <ArrowRight size={14} />
                           </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-12 text-center py-10">
                        <Activity className="h-12 w-12 text-slate-700 mx-auto mb-4" />
                        <p className="text-sm font-bold text-slate-500 italic">No more sessions today. Good work, Doctor.</p>
                      </div>
                    )}
                  </div>
               </div>
            </div>
          </motion.div>

        {/* TOP STATS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <StatBox icon={Calendar} label="All Active Leads" value={activeAppointments.length} colorClass="bg-primary-600" />
          <StatBox icon={Users} label="Pending Leads" value={activeAppointments.filter(a => a.status === 'pending').length} colorClass="bg-indigo-600" />
          <StatBox icon={Clock} label="Confirmed Bookings" value={activeAppointments.filter(a => a.status === 'confirmed').length} colorClass="bg-rose-600" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

          {/* DAILY TIMETABLE */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between px-4">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                Manage Patient Leads
              </h2>
              <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                {['pending', 'confirmed'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setActiveFilter(f)}
                    className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${activeFilter === f
                      ? 'bg-white text-primary-600 shadow-md'
                      : 'text-slate-400 hover:text-slate-600'
                      }`}
                  >
                    {f}
                    <span className={`ml-3 py-0.5 px-2.5 rounded-lg text-[10px] ${activeFilter === f ? 'bg-primary-50 text-primary-600' : 'bg-slate-200/50 text-slate-400'}`}>
                      {activeAppointments.filter(a => {
                        const aptDate = a.startTime ? new Date(a.startTime) : new Date(a.createdAt);
                        const yesterday = new Date();
                        yesterday.setDate(new Date().getDate() - 1);
                        yesterday.setHours(0, 0, 0, 0);
                        return a.status === f && aptDate >= yesterday;
                      }).length}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {filteredAppointments.length > 0 ? (
              <div className="space-y-4">
                {filteredAppointments.map((apt, index) => (
                  <motion.div
                    key={apt._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col md:flex-row md:items-center gap-6 shadow-sm hover:shadow-md hover:border-primary-200 transition-all relative group"
                  >
                    <div className="md:w-32 flex flex-col gap-1 shrink-0">
                      <span className="text-[10px] uppercase font-black text-slate-400 tracking-widest leading-none">Status</span>
                      <span className={`text-xs font-black uppercase tracking-widest ${apt.status === 'confirmed' ? 'text-emerald-500' :
                        apt.status === 'cancelled' ? 'text-red-600' : 'text-primary-500 animate-pulse'
                        }`}>{apt.status}</span>
                    </div>

                    <div className="flex items-center gap-5 flex-1 cursor-pointer">
                      <div className="h-14 w-14 rounded-2xl bg-indigo-50 flex items-center justify-center">
                        <User className="h-7 w-7 text-indigo-500" />
                      </div>
                      <div className="flex flex-col">
                        <h4 className="text-base font-black text-slate-900 truncate max-w-[200px]">{getPatientName(apt)}</h4>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            {apt.sessionData?.title || 'Unknown Diagnosis'}
                          </span>
                          {getPatientEmail(apt) && (
                            <span className="text-[9px] font-bold text-primary-600/60 lowercase tracking-tight">
                              {getPatientEmail(apt)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-3 ml-auto">
                      {apt.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleUpdateStatus(apt._id, 'confirmed')}
                            className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-colors"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(apt._id, 'cancelled')}
                            className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest hover:bg-rose-50 hover:text-rose-600 transition-colors"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => openPatientChat(apt.patientId?._id || apt.patientId)}
                        className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-widest hover:border-primary-300 hover:text-primary-600 transition-colors flex items-center gap-2"
                      >
                        <MessageSquare size={12} />
                        Chat
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="bg-white p-16 rounded-3xl border border-dashed border-slate-200 text-center flex flex-col items-center">
                <div className="h-20 w-20 bg-slate-50 rounded-full flex items-center justify-center mb-5">
                  <Users className="h-8 w-8 text-slate-200" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 tracking-tight">No leads yet</h3>
                <p className="text-sm text-slate-400 mt-2 max-w-xs font-medium leading-relaxed">Patient requests from the AI chatbot in your area will appear here as leads.</p>
              </div>
            )}
          </div>


          {/* DOCTOR PROFILE SIDE OVERVIEW */}
          <div className="lg:col-span-1 space-y-8">
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 text-center">
              <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-primary-500 to-indigo-700 flex items-center justify-center mb-6 shadow-xl mx-auto rotate-3 hover:rotate-0 transition-transform">
                <User className="h-12 w-12 text-white" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-1">{doctorData?.basicInfo?.name}</h3>
              <p className="text-primary-600 text-[10px] font-black uppercase tracking-widest mb-8 bg-primary-50 w-fit mx-auto px-4 py-1.5 rounded-full border border-primary-100">{doctorData?.professionalInfo?.specialization}</p>

              <div className="space-y-4 text-left">
                <div className="p-5 bg-slate-50/50 rounded-3xl border border-white flex gap-4 transition-colors hover:bg-white active:scale-95">
                  <div className="h-10 w-10 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
                    <Building2 className="h-5 w-5 text-indigo-500" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Clinic</span>
                    <span className="text-sm font-bold text-slate-800 truncate">{doctorData?.clinicInfo?.clinicName}</span>
                  </div>
                </div>
                <div className="p-5 bg-slate-50/50 rounded-3xl border border-white flex gap-4 transition-colors hover:bg-white active:scale-95">
                  <div className="h-10 w-10 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Degrees</span>
                    <span className="text-sm font-bold text-slate-800">{doctorData?.professionalInfo?.qualification}</span>
                  </div>
                </div>

              </div>
            </motion.div>
          </div>
        </div>

        {/* SCHEDULE APPOINTMENT MODAL */}
        <AnimatePresence>
          {isScheduleModalOpen && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                onClick={() => setIsScheduleModalOpen(false)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden relative z-10 flex flex-col border border-slate-200"
              >
                <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <CalendarDays className="h-6 w-6 text-primary-600" />
                    <h3 className="text-lg font-black text-slate-900 leading-none">Schedule Appointment</h3>
                  </div>
                  <button onClick={() => setIsScheduleModalOpen(false)}><X className="h-5 w-5 text-slate-400" /></button>
                </div>

                <form onSubmit={handleScheduleConfirm} className="p-8 space-y-6 overflow-y-auto max-h-[70vh]">
                  <div className="p-4 bg-primary-50 border border-primary-100 rounded-2xl flex items-center gap-4">
                    <User className="h-10 w-10 text-primary-600 bg-white p-2 rounded-xl" />
                    <div className="flex-1 flex flex-col min-w-0">
                      <span className="text-[10px] font-black text-primary-700 uppercase tracking-widest">Patient</span>
                      {schedulingApt ? (
                        <span className="text-sm font-bold text-slate-900 underline">{getPatientName(schedulingApt)}</span>
                      ) : (
                        <select
                          className="w-full bg-transparent text-sm font-bold text-slate-900 outline-none h-8"
                          onChange={(e) => {
                            const apt = appointments.find(a => a._id === e.target.value);
                            setSchedulingApt(apt);
                          }}
                          value={schedulingApt?._id || ''}
                        >
                          <option value="">Choose a patient...</option>
                          {appointments.map(a => (
                            <option key={a._id} value={a._id}>{getPatientName(a)}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Type</label>
                      <select
                        value={scheduleData.type}
                        onChange={(e) => setScheduleData({ ...scheduleData, type: e.target.value })}
                        className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold focus:ring-2 focus:ring-primary-500/20 outline-none"
                      >
                        <option value="online">Online</option>
                        <option value="clinic">In-Clinic</option>
                        <option value="follow-up">Follow-up</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Duration</label>
                      <select
                        value={scheduleData.duration}
                        onChange={(e) => setScheduleData({ ...scheduleData, duration: parseInt(e.target.value) })}
                        className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold focus:ring-2 focus:ring-primary-500/20 outline-none"
                      >
                        <option value={15}>15 m</option>
                        <option value={30}>30 m</option>
                        <option value={45}>45 m</option>
                        <option value={60}>60 m</option>
                      </select>
                    </div>
                  </div>

                  {/* Availability Hint Badge */}
                  {doctorData?.availability?.timings && (() => {
                    const { minTime, maxTime } = parseTimingsString(doctorData.availability.timings);
                    return (
                      <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-100 rounded-xl">
                        <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        <span className="text-xs font-bold text-amber-700">
                          Your working hours: <span className="font-black">{doctorData.availability.timings}</span>. Time selection is restricted to this window.
                        </span>
                      </div>
                    );
                  })()}

                  {/* Date Carousel */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Date</label>
                      <span className="text-[10px] font-bold text-primary-600">{new Date(scheduleData.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none snap-x">
                      {availableDays.map((date, i) => {
                        const dateStr = date.toISOString().split('T')[0];
                        const isSelected = scheduleData.date === dateStr;
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setScheduleData({ ...scheduleData, date: dateStr })}
                            className={`flex flex-col items-center justify-center min-w-[70px] h-20 rounded-2xl border-2 transition-all p-2 snap-start ${isSelected 
                              ? 'bg-primary-600 border-primary-600 text-white shadow-lg shadow-primary-200' 
                              : 'bg-white border-slate-100 text-slate-600 hover:border-primary-200'}`}
                          >
                            <span className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isSelected ? 'text-primary-100' : 'text-slate-400'}`}>
                              {date.toLocaleDateString('en-US', { weekday: 'short' })}
                            </span>
                            <span className="text-xl font-black">{date.getDate()}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Time Grid */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Time Slot</label>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <div className="h-2 w-2 rounded-full bg-slate-100 border border-slate-200" />
                          <span className="text-[9px] font-bold text-slate-400 uppercase">Available</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="h-2 w-2 rounded-full bg-rose-100 border border-rose-200" />
                          <span className="text-[9px] font-bold text-rose-400 uppercase">Booked</span>
                        </div>
                      </div>
                    </div>
                    {timeSlots.length > 0 ? (
                      <div className="grid grid-cols-4 gap-2">
                        {timeSlots.map((slot, i) => (
                          <button
                            key={i}
                            type="button"
                            disabled={slot.isBooked}
                            onClick={() => setScheduleData({ ...scheduleData, time: slot.time })}
                            className={`relative py-3 rounded-xl text-xs font-black transition-all flex flex-col items-center gap-1 ${slot.isBooked
                              ? 'bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed'
                              : scheduleData.time === slot.time
                                ? 'bg-primary-600 text-white shadow-lg shadow-primary-100 border border-primary-600'
                                : 'bg-white border border-slate-200 text-slate-600 hover:border-primary-400 hover:bg-primary-50/30'
                              } ${slot.isRecommended && !slot.isBooked && scheduleData.time !== slot.time ? 'ring-2 ring-emerald-400 ring-offset-1' : ''}`}
                          >
                            {slot.isRecommended && !slot.isBooked && scheduleData.time !== slot.time && (
                              <div className="absolute -top-1.5 -right-1 bg-emerald-500 text-white text-[7px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded-full shadow-sm z-10 border border-emerald-400">Best</div>
                            )}
                            <span>{slot.label}</span>
                            {slot.isBooked && (
                              <Lock className="h-2.5 w-2.5 text-slate-300" />
                            )}
                            {scheduleData.time === slot.time && !slot.isBooked && (
                              <Check className="h-2.5 w-2.5 text-primary-200" />
                            )}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <Clock className="h-6 w-6 text-slate-300 mx-auto mb-2" />
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No slots available for this day</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Fee (₹)</label>
                    <input
                      type="number"
                      value={scheduleData.fee}
                      onChange={(e) => setScheduleData({ ...scheduleData, fee: e.target.value })}
                      className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-4 bg-primary-600 text-white rounded-2xl font-black shadow-lg shadow-primary-500/20"
                  >
                    Confirm Schedule
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>



      </main>
    </div>
  );
};

export default Dashboard;
