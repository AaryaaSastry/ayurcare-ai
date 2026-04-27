import React, { useEffect, useState, useMemo, useRef } from 'react';
import { doctorService, doctorChatService } from '../services/api';
import Sidebar from '../components/Sidebar';
import {
   ChevronLeft,
   ChevronRight,
   Calendar as CalIcon,
   Plus,
   Video,
   Building2,
   RefreshCcw,
   MessageSquare,
   Download,
   Clock,
   Search,
   Filter,
   X,
   MoreVertical
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { downloadMedicalReportPDF } from '../utils/pdfExport';
import { useNavigate } from 'react-router-dom';

const parseDiagnosis = (content) => {
   if (!content) return [];
   try {
      const parts = content.split('---REPORT_DATA---');
      let jsonStr = (parts.length > 1 ? parts[1] : content);
      jsonStr = jsonStr.replace(/```json/gi, '').replace(/```/gi, '').trim();
      const start = jsonStr.indexOf('{');
      const end = jsonStr.lastIndexOf('}');
      const payload = JSON.parse(start !== -1 && end !== -1 ? jsonStr.substring(start, end + 1) : jsonStr);
      if (payload && Array.isArray(payload.reports)) {
         return payload.reports
            .filter(r => r && typeof r === 'object')
            .map(r => ({
               reportType: r.reportType || 'Diagnosis Report',
               title: r.title || r.reportType || 'Clinical Report',
               reportData: r.reportData || {}
            }));
      }
      return [{
         reportType: 'Diagnosis Report',
         title: 'Clinical Diagnosis',
         reportData: payload
      }];
   } catch (e) {
      return [];
   }
};

const MySchedule = () => {
   const navigate = useNavigate();
   const scrollRef = useRef(null);
   const [currentDate, setCurrentDate] = useState(new Date());
   const [appointments, setAppointments] = useState([]);
   const [loading, setLoading] = useState(true);
   const [typeFilter, setTypeFilter] = useState('all');
   const [statusFilter, setStatusFilter] = useState('confirmed');
   const [doctorProfile, setDoctorProfile] = useState(null);
   const [now, setNow] = useState(new Date());

   useEffect(() => {
      const timer = setInterval(() => setNow(new Date()), 60000);
      return () => clearInterval(timer);
   }, []);

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

   const openConsultationWorkspace = (appointmentId) => {
      if (!appointmentId) return;
      navigate(`/consultation/${appointmentId}`);
   };

   const parseTimingsString = (str) => {
      if (!str) return { startHour: 8, endHour: 18 };
      try {
         const match = str.match(/(\d+)(?::(\d+))?\s*(AM|PM)\s*[-–]\s*(\d+)(?::(\d+))?\s*(AM|PM)/i);
         if (!match) return { startHour: 8, endHour: 18 };
         let sh = parseInt(match[1]), sap = match[3].toUpperCase();
         let eh = parseInt(match[4]), eap = match[6].toUpperCase();
         if (sap === 'PM' && sh !== 12) sh += 12; if (sap === 'AM' && sh === 12) sh = 0;
         if (eap === 'PM' && eh !== 12) eh += 12; if (eap === 'AM' && eh === 12) eh = 0;
         return { startHour: sh, endHour: eh };
      } catch { return { startHour: 8, endHour: 18 }; }
   };

   const CALENDAR_START = 7;
   const CALENDAR_END = 21;
   const HOUR_HEIGHT = 100;

   const { startHour: WORK_START, endHour: WORK_END } = useMemo(() => 
      parseTimingsString(doctorProfile?.availability?.timings), 
      [doctorProfile]
   );

   useEffect(() => {
      fetchAppointments();
      doctorService.getProfile().then(p => setDoctorProfile(p)).catch(() => {});
   }, [currentDate]);

   const fetchAppointments = async () => {
      setLoading(true);
      try {
         const apts = await doctorService.getAppointments();
         setAppointments(apts);
      } catch (err) {
         console.error('Failed to load appointments', err);
      } finally {
         setLoading(false);
      }
   };

   const getWeekDates = () => {
      const curr = new Date(currentDate);
      const day = curr.getDay() || 7;
      curr.setDate(curr.getDate() - day + 1);
      return Array.from({ length: 7 }).map((_, i) => {
         const d = new Date(curr);
         d.setDate(d.getDate() + i);
         return d;
      });
   };

   const weekDays = useMemo(() => getWeekDates(), [currentDate]);
   const hours = Array.from({ length: CALENDAR_END - CALENDAR_START + 1 }).map((_, i) => i + CALENDAR_START);

   const getPatientName = (apt) => {
      if (!apt) return "Patient";
      if (apt.patientId && typeof apt.patientId === 'object') {
         const user = apt.patientId;
         if (user.name && user.name !== "Patient") return user.name;
         if (user.email) return user.email.split('@')[0];
      }
      if (typeof apt.patientId === 'string' && apt.patientId.includes('@')) {
         return apt.patientId.split('@')[0];
      }
      const idStr = apt.patientId?._id || apt.patientId || '';
      return idStr.toString().length > 4 ? `Patient #${idStr.toString().slice(-4)}` : "Lead";
   };

   const normalizeStatus = (status) => String(status || '').toLowerCase().trim();

   const getAppointmentEndTime = (apt) => {
      if (!apt?.startTime) return null;
      const start = new Date(apt.startTime);
      const duration = Number(apt.duration) || 30;
      return apt.endTime ? new Date(apt.endTime) : new Date(start.getTime() + duration * 60000);
   };

   const getStatusBucket = (apt) => {
      const status = normalizeStatus(apt?.status);
      if (status === 'cancelled' || status === 'canceled') return 'cancelled';
      if (status === 'finished' || status === 'completed') return 'finished';
      if (status === 'pending' || status === 'scheduled') return 'pending';
      if (status === 'confirmed') {
         const end = getAppointmentEndTime(apt);
         return end && end <= now ? 'finished' : 'confirmed';
      }
      return status || 'pending';
   };

   const handleDownloadPDF = (apt) => {
      const reports = parseDiagnosis(apt?.sessionData?.diagnosis);
      if (!reports.length) return alert("No clinical data available.");
      reports.forEach(r => downloadMedicalReportPDF(r.reportData, { reportType: r.reportType, reportTitle: r.title }));
   };

   const isDateToday = (date) => {
      const d = new Date();
      return date.getDate() === d.getDate() && date.getMonth() === d.getMonth() && date.getFullYear() === d.getFullYear();
   };

   const nowLinePos = useMemo(() => {
      const h = now.getHours();
      const m = now.getMinutes();
      if (h < CALENDAR_START || h >= CALENDAR_END + 1) return null;
      return ((h - CALENDAR_START) * 60 + m) / 60 * HOUR_HEIGHT;
   }, [now]);   const statusCounts = useMemo(() => {
      return {
         confirmed: appointments.filter(a => getStatusBucket(a) === 'confirmed').length,
         pending: appointments.filter(a => getStatusBucket(a) === 'pending').length,
         cancelled: appointments.filter(a => getStatusBucket(a) === 'cancelled').length,
         finished: appointments.filter(a => getStatusBucket(a) === 'finished').length,
      };
   }, [appointments, now]);

   const hasScrolled = useRef(false);

   // AUTO-SCROLL TO CURRENT HOUR ON LOAD
   useEffect(() => {
      if (!loading && scrollRef.current && !hasScrolled.current) {
         const container = scrollRef.current;
         const currentHour = now.getHours();
         // Align precisely to the start of the current hour
         const scrollAmount = Math.max(0, (currentHour - CALENDAR_START) * 280);
         
         setTimeout(() => {
            container.scrollTo({ left: scrollAmount, behavior: 'smooth' });
            hasScrolled.current = true;
         }, 500);
      }
   }, [loading]);   return (
      <div className="min-h-screen w-full bg-[#f8fafc] flex font-sans">
         <Sidebar />

         <main className="flex-1 ml-72 flex flex-col h-screen overflow-hidden">
            {/* TEAMS-STYLE COMMAND CENTER HEADER (EMERALD THEME) */}
            <header className="flex-none px-10 pt-10 pb-8 bg-white border-b border-slate-200 z-30">
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                     <div className="h-14 w-14 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-600/20">
                        <CalIcon className="h-7 w-7 text-white" />
                     </div>
                     <div>
                        <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-tight">My Schedule</h1>
                        <div className="flex items-center gap-2 mt-2">
                           <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Clinical Agenda</span>
                           <span className="h-1 w-1 rounded-full bg-slate-300" />
                           <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-600">
                              {weekDays[0].toLocaleDateString('default', { month: 'long', year: 'numeric' })}
                           </span>
                        </div>
                     </div>
                  </div>

                  <div className="flex items-center gap-3 px-6 py-3.5 bg-emerald-50/30 border border-emerald-100 rounded-xl">
                     <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                     <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Working:</span>
                     <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">{doctorProfile?.availability?.timings || 'Not Set'}</span>
                  </div>
               </div>
            </header>            
            
            {/* DUAL-COLUMN ENTERPRISE LAYOUT (GUARANTEED PERSISTENCE) */}
            <div className="flex-1 flex overflow-hidden bg-white">
               
               {/* FIXED LEFT DATE AXIS (NOT SCROLLABLE HORIZONTALLY) */}
               <div className="w-32 shrink-0 flex flex-col border-r border-slate-200 bg-white z-40">
                  {/* Corner Header */}
                  <div className="h-12 shrink-0 border-b border-slate-200 bg-[#f5f5f5] flex items-center justify-center sticky top-0 z-50">
                     <Clock size={14} className="text-slate-400" />
                  </div>
                  
                  {/* Day Label Rows */}
                  <div className="flex-1">
                     {weekDays.map((date, idx) => {
                        const isToday = isDateToday(date);
                        return (
                           <div key={idx} className={`h-32 border-b border-slate-100 flex flex-col items-center justify-center transition-all ${isToday ? 'bg-emerald-50' : 'bg-white'}`}>
                              <div className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isToday ? 'text-emerald-600' : 'text-slate-500'}`}>
                                 {date.toLocaleDateString('en-US', { weekday: 'short' })}
                              </div>
                              <div className={`text-xl font-bold ${isToday ? 'text-emerald-700' : 'text-slate-900'}`}>
                                 {date.getDate()}
                              </div>
                              {isToday && <div className="mt-1 h-1 w-1 rounded-full bg-emerald-600" />}
                           </div>
                        );
                     })}
                  </div>
               </div>

               {/* HORIZONTALLY SCROLLABLE TIMELINE SURFACE */}
               <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar relative bg-white" ref={scrollRef}>
                  {/* Time Ruler (Sticky Top) */}
                  <div className="sticky top-0 z-50 flex bg-[#f5f5f5] border-b border-slate-200 min-w-max h-12">
                     {hours.map((hour) => (
                        <div key={hour} className="shrink-0 border-l border-slate-200/60 relative" style={{ width: 280 }}>
                           <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-500">
                              {hour % 12 === 0 ? '12' : hour % 12} {hour >= 12 ? 'PM' : 'AM'}
                           </div>
                        </div>
                     ))}
                  </div>

                  {/* Appointment Grid Surface */}
                  <div className="min-w-max pb-20 relative">
                     {weekDays.map((date, rowIdx) => {
                        const isToday = isDateToday(date);
                        const dayApts = appointments
                           .filter(a => {
                              if (!a.startTime) return false;
                              if (typeFilter !== 'all' && a.type !== typeFilter) return false;
                              if (getStatusBucket(a) !== statusFilter) return false;
                              const d = new Date(a.startTime);
                              return d.toDateString() === date.toDateString();
                           })
                           .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

                        return (
                           <div key={rowIdx} className={`flex h-32 border-b border-slate-100 relative group transition-all ${isToday ? 'bg-emerald-50/10' : 'bg-white hover:bg-slate-50/20'}`}>
                              {/* CRISP GRID LINES */}
                              <div className="absolute inset-0 flex pointer-events-none">
                                 {hours.map((hour, idx) => (
                                    <div key={idx} className="h-full border-l border-slate-100" style={{ width: 280 }} />
                                 ))}
                              </div>

                              {/* THE 'NOW' INDICATOR (TEAMS STYLE RED LINE) */}
                              {isToday && nowLinePos && (
                                 <div className="absolute top-0 bottom-0 z-40 flex flex-col items-center pointer-events-none" style={{ left: ((now.getHours() - CALENDAR_START) * 60 + now.getMinutes()) / 60 * 280 }}>
                                    <div className="h-2.5 w-2.5 rounded-full bg-[#d83b01] -mt-1.25" />
                                    <div className="flex-1 w-[1.5px] bg-[#d83b01]" />
                                 </div>
                              )}

                              {/* APPOINTMENT CARDS (EMERALD) */}
                              <div className="relative h-full flex items-center w-full">
                                 {dayApts.map(apt => {
                                    const start = new Date(apt.startTime);
                                    const duration = apt.duration || 30;
                                    const left = ((start.getHours() - CALENDAR_START) * 60 + start.getMinutes()) / 60 * 280;
                                    const width = (duration / 60) * 280;
                                    const statusBucket = getStatusBucket(apt);
                                    const isCancelled = statusBucket === 'cancelled';
                                    const isOnline = apt.type === 'online';
                                    const isFinished = statusBucket === 'finished';
                                    
                                    return (
                                       <motion.div
                                          key={apt._id}
                                          initial={{ opacity: 0 }}
                                          animate={{ opacity: 1 }}
                                          className={`absolute rounded-md border-l-[4px] px-4 py-3 flex flex-col shadow-sm transition-all z-10 group/card cursor-pointer ${
                                             isCancelled ? 'bg-rose-50 border-rose-500 text-rose-700' :
                                             isFinished ? 'bg-slate-100 border-slate-400 text-slate-600' :
                                             isOnline ? 'bg-emerald-50 border-emerald-500 text-emerald-700' :
                                             'bg-teal-50 border-teal-600 text-teal-800'
                                          }`}
                                          style={{ left: left + 4, width: Math.max(240, width - 8), height: '85%' }}
                                          onClick={() => openPatientChat(apt.patientId?._id || apt.patientId)}
                                       >
                                          <div className="flex items-center justify-between gap-3 mb-1">
                                             <div className="text-[13px] font-bold truncate text-slate-900">{getPatientName(apt)}</div>
                                             <div className="text-[10px] font-semibold opacity-70">
                                                {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                             </div>
                                          </div>
                                          <div className="text-[11px] font-medium opacity-80 truncate">
                                             {isOnline ? 'Virtual Session' : 'Clinic Consultation'}
                                          </div>

                                          <div className="mt-auto flex gap-2 opacity-0 group-hover/card:opacity-100 transition-opacity">
                                             <button className="text-[10px] font-bold hover:underline">Launch</button>
                                             <button className="text-[10px] font-bold hover:underline">Patient Info</button>
                                          </div>
                                       </motion.div>
                                    );
                                 })}
                              </div>
                           </div>
                        );
                     })}
                  </div>

                  {loading && (
                     <div className="absolute inset-0 bg-white/40 backdrop-blur-sm z-[100] flex items-center justify-center">
                        <div className="flex flex-col items-center gap-4">
                           <div className="h-14 w-14 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                           <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Syncing Agenda...</span>
                        </div>
                     </div>
                  )}
               </div>
            </div>
         </main>
      </div>
   );
};

export default MySchedule;

