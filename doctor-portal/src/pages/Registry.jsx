import React, { useEffect, useState } from 'react';
import { doctorService } from '../services/api';
import Sidebar from '../components/Sidebar';
import {
  History,
  Search,
  User,
  Calendar,
  ChevronRight,
  Download,
  Info,
  X,
  Video,
  Building2,
  SlidersHorizontal
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { downloadMedicalReportPDF } from '../utils/pdfExport';

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

const Registry = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('confirmed');
  const [dateRangeFilter, setDateRangeFilter] = useState('all');
  const [modeFilter, setModeFilter] = useState('all');
  const [apptTypeFilter, setApptTypeFilter] = useState('all');
  const [selectedAudit, setSelectedAudit] = useState(null);
  const now = new Date();

   const fetchData = async () => {
     try {
       const apts = await doctorService.getAppointments();
       setAppointments(apts);
     } catch (err) {
       console.error('Failed to fetch appointments', err);
     } finally {
       setLoading(false);
     }
   };

  useEffect(() => {
    fetchData();
  }, []);

  const getPatientName = (apt) => {
    if (apt.patientId && typeof apt.patientId === 'object') {
      const user = apt.patientId;
      if (user.name && user.name !== "Patient") return user.name;
      if (user.email) return ` ${user.email.split('@')[0]}`;
    }
    const cleanId = (apt.patientId?._id || apt.patientId || '').toString();
    return cleanId && cleanId.length > 4 ? `User #${cleanId.slice(-4)}` : "User";
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

  const handleDownload = (apt) => {
    const diagnosisData = apt.sessionData?.diagnosis;
    if (!diagnosisData) {
      alert("No diagnostic data found for this entry.");
      return;
    }
    const reports = parseDiagnosis(diagnosisData);
    if (reports.length === 0) {
      alert("Structured clinical report not found.");
      return;
    }
    reports.forEach(r => {
      downloadMedicalReportPDF(r.reportData, { reportType: r.reportType, reportTitle: r.title });
    });
  };

  const filteredAppointments = appointments.filter(apt => {
    const nameMatch = getPatientName(apt).toLowerCase().includes(searchTerm.toLowerCase());
    const statusMatch = getStatusBucket(apt) === statusFilter;
    
    // Date Range Filter
    let dateMatch = true;
    if (dateRangeFilter !== 'all') {
      const aptDate = new Date(apt.createdAt);
      const now = new Date();
      const diffDays = (now - aptDate) / (1000 * 60 * 60 * 24);
      if (dateRangeFilter === '7days') dateMatch = diffDays <= 7;
      else if (dateRangeFilter === '30days') dateMatch = diffDays <= 30;
      else if (dateRangeFilter === 'ytd') dateMatch = aptDate.getFullYear() === now.getFullYear();
    }

    // Consultation Mode Filter
    let modeMatch = true;
    if (modeFilter !== 'all') {
      const aptMode = (apt.sessionData?.mode || apt.type || '').toLowerCase();
      if (modeFilter === 'video') modeMatch = aptMode.includes('video') || aptMode.includes('online');
      else if (modeFilter === 'audio') modeMatch = aptMode.includes('audio');
      else if (modeFilter === 'text') modeMatch = aptMode.includes('chat') || aptMode.includes('text');
      else if (modeFilter === 'clinic') modeMatch = aptMode.includes('clinic') || aptMode.includes('in-person');
    }

    // Appointment Type Filter
    let typeMatch = true;
    if (apptTypeFilter !== 'all') {
      if (apptTypeFilter === 'initial') typeMatch = apt.type !== 'follow-up';
      else if (apptTypeFilter === 'follow-up') typeMatch = apt.type === 'follow-up';
    }

    return nameMatch && statusMatch && dateMatch && modeMatch && typeMatch;
  }).sort((a, b) => {
    const aStart = a.startTime ? new Date(a.startTime) : new Date(a.createdAt || 0);
    const bStart = b.startTime ? new Date(b.startTime) : new Date(b.createdAt || 0);
    if (statusFilter !== 'confirmed') return bStart - aStart;
    const aUpcoming = aStart >= now ? 1 : 0;
    const bUpcoming = bStart >= now ? 1 : 0;
    if (aUpcoming !== bUpcoming) return bUpcoming - aUpcoming;
    return aStart - bStart;
  });

  const statusCounts = {
    confirmed: appointments.filter(a => getStatusBucket(a) === 'confirmed').length,
    pending: appointments.filter(a => getStatusBucket(a) === 'pending').length,
    cancelled: appointments.filter(a => getStatusBucket(a) === 'cancelled').length,
    finished: appointments.filter(a => getStatusBucket(a) === 'finished').length,
  };

  return (
    <div className="min-h-screen w-full bg-[#f8fafc] flex">
      <Sidebar />

      <main className="flex-1 ml-72 p-12 max-w-[1600px]">
        <header className="mb-8 flex items-center justify-between">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4">
            <div className="h-12 w-12 bg-primary-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary-600/20">
              <History className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none">Clinical Registry</h1>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">Unified Historical Audit Trail</p>
            </div>
          </motion.div>
        </header>

        {/* ENHANCED COMMAND CENTER - LARGER PRESENCE */}
        <div className="bg-white p-3 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/30 mb-12 flex items-center gap-6">
          {/* Integrated Search */}
          <div className="relative group w-80">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-primary-500 transition-colors" />
            <input
              type="text"
              placeholder="Search patients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-transparent rounded-[1.5rem] py-4 pl-13 pr-6 text-sm font-bold text-slate-700 placeholder:text-slate-300 focus:bg-white focus:border-primary-500/20 outline-none transition-all h-14"
            />
          </div>

          <div className="h-8 w-[1px] bg-slate-100" />

          {/* Analytics Tabs */}
          <div className="flex bg-slate-50/80 p-1.5 rounded-[1.8rem] items-center h-14">
            {['confirmed', 'pending', 'cancelled', 'finished'].map(f => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-7 py-2 rounded-[1.2rem] flex items-center gap-3.5 transition-all whitespace-nowrap h-11 ${
                  statusFilter === f 
                    ? 'bg-white text-primary-600 shadow-sm border border-slate-100' 
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <span className="text-[10px] font-black uppercase tracking-widest">{f}</span>
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg ${
                  statusFilter === f ? 'bg-primary-50 text-primary-600' : 'bg-slate-200 text-slate-400'
                }`}>
                  {statusCounts[f]}
                </span>
              </button>
            ))}
          </div>

          <div className="h-8 w-[1px] bg-slate-100" />

          {/* Secondary Filters - Pill Style */}
          <div className="flex items-center gap-3 flex-1 justify-end pr-3">
            <div className="relative group/filter h-14 flex items-center">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary-600/50" />
              <select
                value={dateRangeFilter}
                onChange={(e) => setDateRangeFilter(e.target.value)}
                className="bg-slate-50 border border-transparent text-slate-500 text-[10px] font-black uppercase tracking-widest rounded-2xl pl-11 pr-8 h-11 outline-none focus:bg-white focus:border-primary-500/20 appearance-none cursor-pointer hover:bg-slate-100 transition-all"
              >
                <option value="all">Any Date</option>
                <option value="7days">7 Days</option>
                <option value="30days">30 Days</option>
                <option value="ytd">Yearly</option>
              </select>
            </div>

            <div className="relative group/filter h-14 flex items-center">
              <Video className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-500/50" />
              <select
                value={modeFilter}
                onChange={(e) => setModeFilter(e.target.value)}
                className="bg-slate-50 border border-transparent text-slate-500 text-[10px] font-black uppercase tracking-widest rounded-2xl pl-11 pr-8 h-11 outline-none focus:bg-white focus:border-primary-500/20 appearance-none cursor-pointer hover:bg-slate-100 transition-all"
              >
                <option value="all">Any Mode</option>
                <option value="video">Video</option>
                <option value="audio">Audio</option>
                <option value="clinic">Clinic</option>
              </select>
            </div>

            {(searchTerm || dateRangeFilter !== 'all' || modeFilter !== 'all' || apptTypeFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setDateRangeFilter('all');
                  setModeFilter('all');
                  setApptTypeFilter('all');
                }}
                className="h-11 w-11 flex items-center justify-center bg-rose-50 text-rose-500 rounded-2xl hover:bg-rose-500 hover:text-white transition-all group/clear border border-rose-100 shadow-sm"
                title="Clear All Filters"
              >
                <X className="h-4 w-4 transition-transform group-hover:rotate-90" />
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="py-40 flex flex-col items-center justify-center space-y-4">
            <div className="h-10 w-10 border-4 border-slate-100 border-t-primary-600 rounded-full animate-spin"></div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Syncing Data...</span>
          </div>
        ) : (
          <div className="space-y-4 pb-20">
            {filteredAppointments.length > 0 ? filteredAppointments.map((apt, idx) => (
              <motion.div
                key={apt._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                onClick={() => setSelectedAudit(apt)}
                className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-primary-600/5 hover:border-primary-200 transition-all flex flex-col md:flex-row md:items-center gap-8 group relative cursor-pointer"
              >
                {/* Visual Accent */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 bg-primary-600 rounded-r-full opacity-0 group-hover:opacity-100 transition-all" />

                <div className="flex items-center gap-6 md:w-80">
                  <div className="h-16 w-16 rounded-3xl bg-slate-50 flex items-center justify-center border border-slate-100 group-hover:bg-primary-50 group-hover:border-primary-100 transition-all">
                    <User className="h-8 w-8 text-slate-200 group-hover:text-primary-600 transition-all" />
                  </div>
                  <div>
                    <h4 className="text-base font-black text-slate-900 group-hover:text-primary-700 transition-colors">{getPatientName(apt)}</h4>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">#{apt._id?.slice(-6)}</span>
                      {apt.type && <span className="text-[9px] font-black text-primary-500 uppercase tracking-widest bg-primary-50/50 px-2 py-0.5 rounded-md border border-primary-100/50">{apt.type}</span>}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-12 flex-1">
                  <div className="flex flex-col">
                    <label className="text-[9px] font-black uppercase tracking-[2px] text-slate-300 mb-3">Registration Date</label>
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-primary-600/40" />
                      <span className="text-sm font-bold text-slate-700">{new Date(apt.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <label className="text-[9px] font-black uppercase tracking-[2px] text-slate-300 mb-3">Status Flag</label>
                    <div className={`flex items-center gap-3 px-4 py-2 rounded-2xl w-fit border ${
                      getStatusBucket(apt) === 'confirmed' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
                      getStatusBucket(apt) === 'cancelled' ? 'bg-rose-50 border-rose-100 text-rose-600' :
                      getStatusBucket(apt) === 'finished' ? 'bg-slate-100 border-slate-200 text-slate-600' :
                      'bg-primary-50 border-primary-100 text-primary-600'
                    } text-[10px] font-black uppercase tracking-widest`}>
                      <div className={`h-1.5 w-1.5 rounded-full ${
                        getStatusBucket(apt) === 'confirmed' ? 'bg-emerald-500' : 
                        getStatusBucket(apt) === 'cancelled' ? 'bg-rose-500' : 
                        getStatusBucket(apt) === 'finished' ? 'bg-slate-400' : 
                        'bg-primary-500'
                      }`} />
                      {getStatusBucket(apt)}
                    </div>
                  </div>
                </div>

                <div className="opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center h-12 w-12 bg-primary-50 text-primary-600 rounded-2xl border border-primary-100">
                  <ChevronRight className="h-5 w-5" />
                </div>
              </motion.div>
            )) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-32 text-center bg-white rounded-[3rem] border border-slate-100 shadow-sm">
                <div className="h-20 w-20 bg-slate-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                  <Search className="h-8 w-8 text-slate-200" />
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-2">No Matching Records</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Adjust your filters or search terms to try again</p>
              </motion.div>
            )}
          </div>
        )}

        <AnimatePresence>
          {selectedAudit && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 md:p-12">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedAudit(null)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-4xl bg-white rounded-[3.5rem] shadow-2xl flex flex-col border border-slate-100 overflow-hidden max-h-[90vh]"
              >
                <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-5">
                    <div className="h-14 w-14 bg-primary-600 rounded-[1.4rem] flex items-center justify-center shadow-lg shadow-primary-600/20 text-white">
                      <History className="h-7 w-7" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-1.5">Clinical Session Audit</h3>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">Session ID: #{selectedAudit._id}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedAudit(null)} className="h-12 w-12 flex items-center justify-center rounded-2xl bg-white hover:bg-rose-50 hover:text-rose-500 transition-all text-slate-400 border border-slate-100"><X size={20} /></button>
                </div>

                <div className="p-10 overflow-y-auto custom-scrollbar flex-1 space-y-10">
                  {/* Patient Header Card */}
                  <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-sm flex items-center gap-8">
                    <div className="h-20 w-20 rounded-[1.8rem] bg-slate-50 flex items-center justify-center border border-slate-100">
                      <User className="h-10 w-10 text-slate-200" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-2xl font-black text-slate-900">{getPatientName(selectedAudit)}</h4>
                        <div className="flex items-center gap-2 px-4 py-1.5 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 text-[10px] font-black uppercase tracking-widest">
                          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Authenticated Session
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-8">
                        <div>
                          <label className="text-[9px] font-black uppercase tracking-widest text-slate-300 block mb-1">Date</label>
                          <span className="text-xs font-bold text-slate-600">{new Date(selectedAudit.createdAt).toLocaleDateString(undefined, { dateStyle: 'full' })}</span>
                        </div>
                        <div>
                          <label className="text-[9px] font-black uppercase tracking-widest text-slate-300 block mb-1">Mode</label>
                          <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                            {selectedAudit.type === 'online' ? <Video size={14} className="text-indigo-500" /> : <Building2 size={14} className="text-emerald-500" />}
                            <span className="uppercase">{selectedAudit.type || 'In-Person'}</span>
                          </div>
                        </div>
                        <div>
                          <label className="text-[9px] font-black uppercase tracking-widest text-slate-300 block mb-1">Duration</label>
                          <span className="text-xs font-bold text-slate-600">{selectedAudit.duration || '30'} Minutes</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Diagnosis Section */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="h-[1px] flex-1 bg-slate-100" />
                      <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-300">Clinical Findings</span>
                      <div className="h-[1px] flex-1 bg-slate-100" />
                    </div>

                    <div className="space-y-4">
                      {parseDiagnosis(selectedAudit.sessionData?.diagnosis).length > 0 ? (
                        parseDiagnosis(selectedAudit.sessionData?.diagnosis).map((report, i) => (
                          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="group/report p-8 rounded-[2.5rem] bg-slate-50 border border-slate-100 hover:bg-white hover:shadow-xl hover:shadow-primary-600/5 hover:border-primary-100 transition-all">
                            <div className="flex items-center justify-between mb-6">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-white rounded-xl flex items-center justify-center text-primary-600 shadow-sm border border-slate-100">
                                  <Info size={20} />
                                </div>
                                <span className="text-sm font-black text-slate-900 uppercase tracking-widest">{report.title}</span>
                              </div>
                              <button 
                                onClick={() => downloadMedicalReportPDF(report.reportData, { reportType: report.reportType, reportTitle: report.title })}
                                className="flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-primary-600 hover:text-white text-primary-600 rounded-xl border border-slate-100 transition-all text-[10px] font-black uppercase tracking-widest shadow-sm"
                              >
                                <Download size={14} />
                                Download Report
                              </button>
                            </div>
                            <div className="bg-white p-6 rounded-2xl border border-slate-100 text-sm text-slate-600 leading-relaxed font-medium">
                              {report.reportData?.diagnosis?.reasoning || report.reportData?.lifestyleChanges || "Detailed clinical analysis summary is available in the attached PDF document."}
                            </div>
                          </motion.div>
                        ))
                      ) : (
                        <div className="py-20 text-center bg-slate-50 rounded-[3rem] border border-dashed border-slate-200">
                          <div className="h-16 w-16 bg-white rounded-[1.5rem] flex items-center justify-center mx-auto mb-4 border border-slate-100">
                            <Info className="h-8 w-8 text-slate-200" />
                          </div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">No clinical reports found for this session</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-10 bg-slate-50/50 border-t border-slate-100 flex items-center gap-4">
                  <button 
                    onClick={() => setSelectedAudit(null)}
                    className="flex-1 py-4.5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-slate-900/10 hover:bg-slate-800 transition-all"
                  >
                    Archive & Close Registry Audit
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default Registry;
