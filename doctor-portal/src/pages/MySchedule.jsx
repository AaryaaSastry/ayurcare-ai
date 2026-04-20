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
   }, [now]);

   return (
      <div className="min-h-screen w-full bg-[#f8fafc] flex font-sans">
         <Sidebar />

         <main className="flex-1 ml-72 flex flex-col h-screen overflow-hidden">
            {/* ENHANCED HEADER SECTION */}
            <header className="flex-none px-10 pt-10 pb-6 bg-white/80 backdrop-blur-md border-b border-slate-100 z-30 shadow-sm">
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-8">
                     <div className="flex items-center gap-3">
                        <div className="h-14 w-14 bg-primary-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-600/20">
                           <CalIcon className="h-7 w-7 text-white" />
                        </div>
                        <div>
                           <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">My Schedule</h1>
                           <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Clinical Agenda</span>
                              <span className="h-1 w-1 rounded-full bg-slate-300" />
                              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-600">
                                 {weekDays[0].toLocaleDateString('default', { month: 'long', year: 'numeric' })}
                              </span>
                           </div>
                        </div>
                     </div>

                     {/* CALENDAR NAVIGATION */}
                     <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-[1.25rem] border border-slate-200 shadow-inner">
                        <button onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() - 7)))} className="h-10 w-10 flex items-center justify-center hover:bg-white hover:shadow-md rounded-xl text-slate-500 hover:text-primary-600 transition-all">
                           <ChevronLeft size={20} />
                        </button>
                        <button onClick={() => setCurrentDate(new Date())} className="px-6 h-10 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-primary-600 hover:bg-white hover:shadow-sm rounded-xl transition-all">
                           Today
                        </button>
                        <button onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() + 7)))} className="h-10 w-10 flex items-center justify-center hover:bg-white hover:shadow-md rounded-xl text-slate-500 hover:text-primary-600 transition-all">
                           <ChevronRight size={20} />
                        </button>
                     </div>
                  </div>

                  <div className="flex items-center gap-4">
                     <div className="hidden xl:flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm">
                        <RefreshCcw size={14} className="text-emerald-500 animate-spin-slow" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Working:</span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">{doctorProfile?.availability?.timings || 'Not Set'}</span>
                     </div>
                     <div className="h-12 w-px bg-slate-100 mx-2" />
                     <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
                        {['all', 'online', 'clinic'].map(f => (
                           <button 
                              key={f}
                              onClick={() => setTypeFilter(f)}
                              className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${typeFilter === f ? 'bg-white text-primary-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                           >
                              {f}
                           </button>
                        ))}
                     </div>
                  </div>
               </div>
            </header>

            {/* MAIN CALENDAR SURFACE */}
            <div className="flex-1 overflow-auto bg-white relative custom-scrollbar snap-y" ref={scrollRef}>
               
               {/* STICKY DAY HEADERS */}
               <div className="sticky top-0 z-40 flex bg-white/95 backdrop-blur-xl border-b border-slate-100/50">
                  <div className="w-24 shrink-0 bg-transparent flex flex-col items-center justify-center border-r border-slate-100/50">
                     <Clock size={16} className="text-slate-300" />
                  </div>
                  {weekDays.map((day, idx) => {
                     const isToday = isDateToday(day);
                     return (
                        <div key={idx} className={`flex-1 min-w-[160px] py-6 px-4 text-center transition-colors border-l border-slate-50 ${isToday ? 'bg-primary-50/20' : ''}`}>
                           <div className={`text-[10px] font-black uppercase tracking-[0.25em] mb-2 ${isToday ? 'text-primary-600' : 'text-slate-400'}`}>
                              {day.toLocaleDateString('en-US', { weekday: 'short' })}
                           </div>
                           <div className="flex justify-center">
                              <span className={`h-12 w-12 flex items-center justify-center text-2xl font-black rounded-2xl transition-all ${isToday ? 'bg-primary-600 text-white shadow-xl shadow-primary-200 ring-4 ring-primary-50' : 'text-slate-900 group-hover:bg-slate-50'}`}>
                                 {day.getDate()}
                              </span>
                           </div>
                        </div>
                     );
                  })}
               </div>

               {/* CALENDAR BODY */}
               <div className="flex relative min-w-max">
                  {/* TIME LABELS COLUMN */}
                  <div className="w-24 shrink-0 sticky left-0 bg-white/80 backdrop-blur z-30 border-r border-slate-100">
                     {hours.map((hour) => {
                        const isWorking = hour >= WORK_START && hour < WORK_END;
                        return (
                           <div key={hour} className="relative" style={{ height: HOUR_HEIGHT }}>
                              <div className={`absolute -top-3 right-4 text-[10px] font-black tracking-widest ${isWorking ? 'text-slate-400' : 'text-slate-200'}`}>
                                 {hour % 12 === 0 ? '12' : hour % 12} {hour >= 12 ? 'PM' : 'AM'}
                              </div>
                           </div>
                        );
                     })}
                  </div>

                  {/* EVENT GRID */}
                  <div className="flex-1 flex w-full relative">
                     {/* HORIZONTAL GRID LINES & WORKING SHADES */}
                     <div className="absolute inset-0 pointer-events-none">
                        {hours.map((hour, idx) => {
                           const isWorking = hour >= WORK_START && hour < WORK_END;
                           return (
                              <div key={idx} className={`border-b border-slate-50/50 w-full ${isWorking ? 'bg-transparent' : 'bg-slate-50/30'}`} style={{ height: HOUR_HEIGHT }} />
                           );
                        })}
                        {/* THE 'NOW' INDICATOR */}
                        {nowLinePos && (
                           <div className="absolute left-0 right-0 z-20 flex items-center pointer-events-none" style={{ top: nowLinePos }}>
                              <div className="h-3 w-3 rounded-full bg-rose-500 shadow-xl ring-4 ring-rose-100 ml-[-6px]" />
                              <div className="flex-1 h-[2px] bg-gradient-to-r from-rose-500 via-rose-300 to-transparent" />
                              <div className="mr-4 px-2 py-0.5 bg-rose-500 text-[8px] font-black text-white rounded-md shadow-lg">LIVE</div>
                           </div>
                        )}
                     </div>

                     {/* DAY COLUMNS */}
                     {weekDays.map((date, colIdx) => {
                        const dayApts = appointments.filter(a => {
                           if (!a.startTime || a.status === 'scheduled' || a.status === 'pending') return false; 
                           if (typeFilter !== 'all' && a.type !== typeFilter) return false;
                           const d = new Date(a.startTime);
                           return d.toDateString() === date.toDateString();
                        });

                        return (
                           <div key={colIdx} className="flex-1 min-w-[160px] relative border-l border-slate-50 group hover:bg-slate-50/20 transition-colors">
                              {dayApts.map(apt => {
                                 const start = new Date(apt.startTime);
                                 const duration = apt.duration || 30;
                                 const top = ((start.getHours() - CALENDAR_START) * 60 + start.getMinutes()) / 60 * HOUR_HEIGHT;
                                 const height = (duration / 60) * HOUR_HEIGHT;
                                 const isCancelled = apt.status === 'cancelled';
                                 const isOnline = apt.type === 'online';
                                 
                                 return (
                                    <motion.div
                                       key={apt._id}
                                       initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                       animate={{ opacity: 1, y: 0, scale: 1 }}
                                       className={`absolute left-2 right-2 rounded-[1.25rem] border border-l-[6px] p-4 flex flex-col shadow-sm transition-all z-10 group/card cursor-pointer overflow-hidden ${
                                          isCancelled ? 'bg-rose-50/60 border-rose-100 border-l-rose-400 opacity-60 grayscale-[0.5]' :
                                          isOnline ? 'bg-indigo-50 border-indigo-100 border-l-indigo-600 hover:shadow-xl hover:shadow-indigo-100/50 hover:-translate-y-1' :
                                          'bg-emerald-50 border-emerald-100 border-l-emerald-600 hover:shadow-xl hover:shadow-emerald-100/50 hover:-translate-y-1'
                                       }`}
                                       style={{ top, height: Math.max(70, height - 4) }}
                                    >
                                       <div className="flex items-start justify-between gap-3 mb-auto">
                                          <div className="min-w-0">
                                             <div className={`text-xs font-black truncate ${isCancelled ? 'text-rose-900' : isOnline ? 'text-indigo-900' : 'text-emerald-900'}`}>{getPatientName(apt)}</div>
                                             <div className="flex items-center gap-1.5 mt-1">
                                                {isOnline ? <Video size={10} className="text-indigo-400" /> : <Building2 size={10} className="text-emerald-400" />}
                                                <span className="text-[8px] font-black uppercase tracking-widest opacity-50">{apt.type}</span>
                                             </div>
                                          </div>
                                          {!isCancelled && (
                                             <div className="flex gap-1.5 opacity-0 group-hover/card:opacity-100 transition-opacity">
                                                <button onClick={(e) => { e.stopPropagation(); openPatientChat(apt.patientId?._id || apt.patientId); }} className="h-8 w-8 rounded-xl bg-white/80 hover:bg-white flex items-center justify-center text-slate-600 shadow-sm border border-white"><MessageSquare size={14} /></button>
                                                <button onClick={(e) => { e.stopPropagation(); handleDownloadPDF(apt); }} className="h-8 w-8 rounded-xl bg-white/80 hover:bg-white flex items-center justify-center text-slate-600 shadow-sm border border-white"><Download size={14} /></button>
                                             </div>
                                          )}
                                       </div>
                                       
                                       <div className="flex items-center justify-between mt-2">
                                          <div className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 ${isCancelled ? 'bg-rose-100 text-rose-600' : isOnline ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                             {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                          </div>
                                          {isCancelled && <span className="text-[8px] font-black text-rose-500 uppercase tracking-widest">Cancelled</span>}
                                       </div>
                                    </motion.div>
                                 );
                              })}
                           </div>
                        );
                     })}
                  </div>
               </div>

               {loading && (
                  <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-[100] flex items-center justify-center">
                     <div className="flex flex-col items-center gap-4">
                        <div className="h-12 w-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Syncing Agenda...</span>
                     </div>
                  </div>
               )}
            </div>
         </main>
      </div>
   );
};

export default MySchedule;
