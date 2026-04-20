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
  Building2
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
    const statusMatch = statusFilter === 'all' || apt.status === statusFilter;
    
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
  });

  return (
    <div className="min-h-screen w-full bg-[#f8fafc] flex">
      <Sidebar />

      <main className="flex-1 ml-72 p-10 max-w-[1600px]">
        <header className="mb-12">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-5">
            <div className="h-16 w-16 bg-white border border-slate-100 rounded-[2rem] flex items-center justify-center text-primary-600 shadow-xl shadow-primary-500/10">
              <History className="h-8 w-8 text-primary-600" />
            </div>
            <div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tight">
                Clinical <span className="text-primary-600">Registry</span>
              </h1>
              <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">Unified historical audit of all patient consultations</p>
            </div>
          </motion.div>
        </header>

        {/* TOOLBAR */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col gap-6 mb-10">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1 relative group">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-primary-500 transition-colors" />
              <input
                type="text"
                placeholder="Search patient name, email or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50/50 border border-slate-200 rounded-3xl py-4 pl-16 pr-8 text-sm font-bold focus:border-primary-500/30 focus:bg-white outline-none transition-all shadow-inner"
              />
            </div>
            <div className="flex bg-slate-100 p-1.5 rounded-[1.5rem] border border-slate-200 overflow-x-auto">
              {['confirmed', 'pending', 'cancelled', 'all'].map(f => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-8 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${statusFilter === f ? 'bg-white text-primary-600 shadow-md border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  {f === 'all' ? 'All Status' : f}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex flex-wrap gap-4 pt-2 border-t border-slate-100 mt-2">
            <select
              value={dateRangeFilter}
              onChange={(e) => setDateRangeFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-600 text-xs font-bold rounded-2xl px-4 py-3 outline-none focus:border-primary-500/50"
            >
              <option value="all">All Dates</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="ytd">Year-to-Date</option>
            </select>

            <select
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-600 text-xs font-bold rounded-2xl px-4 py-3 outline-none focus:border-primary-500/50"
            >
              <option value="all">All Modes</option>
              <option value="video">Video Call</option>
              <option value="audio">Audio Call</option>
              <option value="text">Text Chat</option>
              <option value="clinic">In-Clinic</option>
            </select>

            <select
              value={apptTypeFilter}
              onChange={(e) => setApptTypeFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-600 text-xs font-bold rounded-2xl px-4 py-3 outline-none focus:border-primary-500/50"
            >
              <option value="all">All Appt Types</option>
              <option value="initial">Initial Consultations</option>
              <option value="follow-up">Follow-ups</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="py-40 flex flex-col items-center justify-center space-y-4">
            <div className="h-12 w-12 border-4 border-slate-100 border-t-primary-600 rounded-full animate-spin"></div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Syncing Registry...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAppointments.length > 0 ? filteredAppointments.map((apt, idx) => (
              <motion.div
                key={apt._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-primary-600/5 hover:border-primary-100 transition-all flex flex-col md:flex-row md:items-center gap-8 group relative overflow-hidden"
              >
                <div className="flex items-center gap-6 md:w-80">
                  <div className="h-16 w-16 rounded-3xl bg-slate-50 flex items-center justify-center group-hover:bg-primary-50 transition-colors">
                    <User className="h-8 w-8 text-slate-300 group-hover:text-primary-600 transition-colors" />
                  </div>
                  <div>
                    <h4 className="text-base font-black text-slate-900 group-hover:text-primary-700 transition-colors">{getPatientName(apt)}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded-md">ID: {apt._id?.slice(-6)}</span>
                      {apt.type && <span className="text-[9px] font-black text-primary-600 uppercase tracking-widest bg-primary-50 px-2 py-0.5 rounded-md">{apt.type}</span>}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-2 gap-10 flex-1">
                  <div className="flex flex-col">
                    <label className="text-[9px] font-black uppercase tracking-[2px] text-slate-300 mb-2">Registration Date</label>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 bg-slate-50 rounded-xl flex items-center justify-center">
                        <Calendar className="h-4 w-4 text-slate-400" />
                      </div>
                      <span className="text-sm font-bold text-slate-800">{new Date(apt.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <label className="text-[9px] font-black uppercase tracking-[2px] text-slate-300 mb-2">Status Flag</label>
                    <div className={`flex items-center gap-3 px-4 py-2 rounded-2xl w-fit border ${apt.status === 'confirmed' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
                        apt.status === 'cancelled' ? 'bg-rose-50 border-rose-100 text-rose-600' :
                          'bg-primary-50 border-primary-100 text-primary-600'
                      } text-[10px] font-black uppercase tracking-widest`}>
                      <div className={`h-1.5 w-1.5 rounded-full ${apt.status === 'confirmed' ? 'bg-emerald-600' : apt.status === 'cancelled' ? 'bg-rose-600' : 'bg-primary-600'} animate-pulse`} />
                      {apt.status}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 md:opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => handleDownload(apt)}
                    className="h-12 w-12 flex items-center justify-center bg-slate-50 text-slate-400 rounded-2xl hover:bg-white hover:text-primary-600 hover:shadow-lg transition-all border border-transparent hover:border-slate-100"
                  >
                    <Download size={18} />
                  </button>
                  <button 
                    onClick={() => setSelectedAudit(apt)}
                    className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary-600 active:scale-95 transition-all flex items-center gap-2 shadow-xl shadow-slate-900/10 hover:shadow-primary-600/20"
                  >
                    Full Audit <ChevronRight size={14} strokeWidth={3} />
                  </button>
                </div>
              </motion.div>
            )) : (
              <div className="py-40 bg-white rounded-[4rem] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-center space-y-6">
                <div className="h-24 w-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center">
                  <History size={40} className="text-slate-200" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 italic">No Registry Records</h3>
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-2 max-w-xs leading-relaxed">We couldn't find any historical data matching your current search parameters.</p>
                </div>
                <button
                  onClick={() => { 
                    setSearchTerm(''); 
                    setStatusFilter('confirmed'); 
                    setDateRangeFilter('all');
                    setModeFilter('all');
                    setApptTypeFilter('all');
                  }}
                  className="px-8 py-3.5 bg-primary-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary-500/20"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        )}

        <AnimatePresence>
          {selectedAudit && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setSelectedAudit(null)}
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden relative z-10 flex flex-col max-h-[85vh]"
              >
                <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                      <History className="h-6 w-6 text-primary-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-900 leading-tight">Clinical Audit Log</h3>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Historical Session Data</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedAudit(null)} className="h-10 w-10 flex items-center justify-center rounded-xl hover:bg-white transition-colors text-slate-400"><X size={20} /></button>
                </div>

                <div className="p-8 overflow-y-auto space-y-8 flex-1">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100">
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-2">Patient</label>
                      <div className="flex items-center gap-3">
                         <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center shadow-sm"><User size={18} className="text-primary-500" /></div>
                         <span className="text-sm font-bold text-slate-800">{getPatientName(selectedAudit)}</span>
                      </div>
                    </div>
                    <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100">
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-2">Session Type</label>
                      <div className="flex items-center gap-3">
                         <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
                           {selectedAudit.type === 'online' ? <Video size={18} className="text-indigo-500" /> : <Building2 size={18} className="text-emerald-500" />}
                         </div>
                         <span className="text-sm font-bold text-slate-800 uppercase tracking-widest">{selectedAudit.type || 'In-Person'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-[3px] text-slate-300 block ml-1 text-center">Diagnostic Summary</label>
                    {parseDiagnosis(selectedAudit.sessionData?.diagnosis).map((report, i) => (
                      <div key={i} className="p-6 rounded-[2rem] bg-indigo-50/30 border border-indigo-100 flex flex-col gap-4">
                         <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-indigo-700 uppercase tracking-widest">{report.title}</span>
                            <button 
                              onClick={() => downloadMedicalReportPDF(report.reportData, { reportType: report.reportType, reportTitle: report.title })}
                              className="text-[9px] font-black uppercase tracking-widest text-indigo-600 underline"
                            >
                              Download PDF
                            </button>
                         </div>
                         <div className="bg-white/80 p-5 rounded-2xl border border-white text-sm text-slate-600 leading-relaxed max-h-40 overflow-y-auto">
                            {report.reportData?.diagnosis?.reasoning || report.reportData?.lifestyleChanges || "No detailed clinical summary available in this record."}
                         </div>
                      </div>
                    ))}
                    {!selectedAudit.sessionData?.diagnosis && (
                       <div className="py-12 text-center bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
                          <Info className="h-8 w-8 text-slate-200 mx-auto mb-3" />
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No clinical notes recorded for this session</p>
                       </div>
                    )}
                  </div>
                </div>

                <div className="p-8 bg-slate-50 border-t border-slate-100">
                   <button 
                    onClick={() => setSelectedAudit(null)}
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-slate-900/10"
                   >
                     Close Registry Audit
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
