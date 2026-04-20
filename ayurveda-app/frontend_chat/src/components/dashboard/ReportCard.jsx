import React from 'react';
import { FileText, Download, Eye, Calendar, ShieldCheck, Loader2, Trash2 } from 'lucide-react';
import { downloadMedicalReportPDF } from '../../utils/pdfExport';
import { chatApi } from '../../services/api';

const ReportCard = ({ report, onView, onDelete, isListView = false }) => {
  const [downloading, setDownloading] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const extractReportPayload = (text) => {
    if (!text) return null;
    try {
      if (typeof text === 'object') return text;
      const raw = text.includes('---REPORT_DATA---') ? text.split('---REPORT_DATA---').pop() : text;
      const clean = raw.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(clean);
    } catch (_err) {
      return null;
    }
  };

  const normalizeReports = (payload) => {
    if (!payload) return [];
    if (payload.reports && Array.isArray(payload.reports)) {
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
  };

  const handleDownload = async (e) => {
    if (e) e.stopPropagation();
    if (downloading) return;
    setDownloading(true);
    try {
      if (report.reportData && typeof report.reportData === 'object') {
        downloadMedicalReportPDF(report.reportData, {
          reportType: report.reportType,
          reportTitle: report.reportTitle || report.reportType
        });
        return;
      }
      if (report.sessionId) {
        const res = await chatApi.getSession(report.sessionId);
        const sessionData = res.data;
        const payload = extractReportPayload(sessionData.diagnosis);
        const reports = normalizeReports(payload);
        const match = reports.find(r => r.reportType === report.reportType) || reports[0];
        if (match && match.reportData) {
          const diagObj = match.reportData;
          downloadMedicalReportPDF({
            ...diagObj,
            patientInfo: diagObj.patientInfo || sessionData.patientInfo || { name: 'Patient' },
            symptomsReported: diagObj.symptomsReported || diagObj.findings || [],
            dietaryGuide: diagObj.dietaryGuide || {},
            lifestyleChanges: diagObj.lifestyleChanges || diagObj.lifestyle_changes || [],
            herbalPreparations: diagObj.herbalPreparations || diagObj.herbal_preparations || [],
          }, { reportType: match.reportType, reportTitle: match.title });
        }
      } else {
        downloadMedicalReportPDF({
          diagnosis: report.diagnosis,
          findings: report.symptoms?.split(', ') || [],
          root_causes: report.recommendations?.split('\n') || [],
          dietaryGuide: { toConsume: [], toAvoid: [] },
          lifestyleChanges: report.recommendations || 'Holistic guidelines provided'
        });
      }
    } catch (err) {
      console.error('Failed to download report:', err);
      downloadMedicalReportPDF({ diagnosis: report.diagnosis });
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async (e) => {
    if (e) e.stopPropagation();
    if (!onDelete || deleting) return;
    if (!window.confirm('Hide this report from your list?')) return;
    setDeleting(true);
    try {
      await onDelete(report._id);
    } finally {
      setDeleting(false);
    }
  };

  if (isListView) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-5 hover:shadow-md hover:border-slate-300 transition-all duration-300 flex items-start justify-between gap-4 group">
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <div className="w-12 h-12 bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center text-slate-600 flex-shrink-0 group-hover:bg-slate-200 transition-colors">
            <FileText size={20} strokeWidth={2.5} />
          </div>
          
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 text-sm line-clamp-1">{report.diagnosis?.name || report.diagnosis}</h3>
              <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-full text-xs font-bold tracking-tight border border-emerald-100 flex items-center gap-1 flex-shrink-0">
                <ShieldCheck size={10} strokeWidth={3} />
                Verified
              </span>
            </div>

            {report.reportType && (
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{report.reportType}</span>
            )}
            
            <p className="text-xs text-slate-500 font-medium line-clamp-1">{(report.symptoms || "").split(',').slice(0, 2).join(', ')}</p>
            
            <div className="flex items-center gap-4 text-xs text-slate-400 font-medium">
              <div className="flex items-center gap-1">
                <Calendar size={12} strokeWidth={2.5} />
                <span>{report.date || new Date(report.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-shrink-0">
          <button 
            onClick={onView}
            className="p-2.5 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 active:scale-95 transition-all"
            title="View Report"
          >
            <Eye size={16} strokeWidth={2.5} />
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-2.5 bg-white border border-slate-200 text-slate-400 rounded-lg hover:bg-red-50 hover:text-red-500 active:scale-95 transition-all disabled:opacity-60"
            title="Remove Report"
          >
            {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} strokeWidth={2.5} />}
          </button>
          <button 
            onClick={handleDownload}
            disabled={downloading}
            className="p-2.5 bg-slate-900 text-white rounded-lg hover:bg-black active:scale-95 transition-all disabled:bg-slate-400"
            title="Download PDF"
          >
            {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} strokeWidth={2.5} />}
          </button>
        </div>
      </div>
    );
  }

  // Grid view - matches FindDoctors card style
  return (
    <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm hover:shadow-2xl hover:shadow-emerald-500/10 transition-all duration-500 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-bl-[100px] -z-0 transition-transform group-hover:scale-125"></div>
      
      <div className="relative z-10 flex flex-col items-center text-center">
        <div className="w-24 h-24 rounded-[32px] mb-5 ring-4 ring-white bg-slate-100 p-1 border border-slate-200 shadow-inner overflow-hidden relative transition-transform group-hover:scale-105 duration-500 flex items-center justify-center">
          <FileText size={48} className="text-slate-400" strokeWidth={2} />
          <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/10 to-transparent"></div>
          <div className="absolute bottom-2 right-2 w-4 h-4 border-4 bg-emerald-500 rounded-full border-white"></div>
        </div>
        
        <div className="space-y-1 mb-6">
          <div className="flex items-center justify-center gap-2">
            <h3 className="text-2xl font-bold text-slate-900 tracking-tight leading-none line-clamp-2">{report.diagnosis?.name || report.diagnosis || "Ayurvedic Assessment"}</h3>
            <ShieldCheck size={18} className="text-emerald-600 flex-shrink-0" />
          </div>
          <span className="text-[10px] font-bold uppercase text-emerald-600 tracking-[2px] block">{(report.symptoms || "").split(',')[0]?.trim() || (report.diagnosis?.name ? 'Clinical Symptoms' : 'Clinical Assessment')}</span>
          {report.reportType && (
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-[2px] block">{report.reportType}</span>
          )}
        </div>
        
        <div className="flex items-center gap-8 mb-8 py-4 border-y border-slate-100 w-full justify-center">
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-bold uppercase text-slate-400 tracking-widest">Date</span>
            <span className="text-base font-bold text-slate-900 tracking-tight leading-none">{report.date || new Date(report.createdAt).toLocaleDateString()}</span>
          </div>
          <div className="w-px h-6 bg-slate-200"></div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-bold uppercase text-slate-400 tracking-widest">Status</span>
            <span className="text-base font-bold text-emerald-600 tracking-tight leading-none">Verified</span>
          </div>
        </div>
        
        <p className="text-sm text-slate-600 leading-relaxed mb-6 line-clamp-2 max-w-xs">{report.recommendations || report.doshaRecommendation || 'Holistic guidelines provided'}</p>
        
        <div className="w-full grid grid-cols-2 gap-3">
          <button
            onClick={onView}
            className="w-full bg-slate-100 text-slate-900 py-4 rounded-3xl text-sm font-bold uppercase tracking-widest hover:bg-slate-200 active:scale-95 transition-all flex items-center justify-center gap-2 group/btn"
          >
            <Eye size={18} strokeWidth={2.5} />
            <span>View</span>
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="w-full bg-slate-900 text-white py-4 rounded-3xl text-sm font-bold uppercase tracking-widest shadow-lg shadow-slate-900/20 hover:bg-black active:scale-95 transition-all flex items-center justify-center gap-2 group/btn disabled:bg-slate-400"
          >
            {downloading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} strokeWidth={2.5} />}
            <span>{downloading ? 'Loading' : 'Download'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportCard;
