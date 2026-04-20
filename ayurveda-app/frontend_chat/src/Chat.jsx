import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import {
  Send,
  Plus,
  User,
  Bot,
  Download,
  ChevronRight,
  MessageSquare,
  CheckCircle2,
  Stethoscope,
  Heart,
  Calendar,
  Zap,
  MoreVertical,
  Loader2,
  Activity,
  X,
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import './report.css';
import ReportRenderer from './ReportRenderer';
import PDFChartContainer from './components/PDFChartContainer';
import RecipesView from './pages/RecipesView';
import FindDoctors from './pages/dashboard/FindDoctors';
import { sanitizeMarkdownText } from './utils/textUtils';
import { downloadMedicalReportPDF } from './utils/pdfExport';
import { chatApi } from './services/api';
const Chat = () => {
  const { sessionId: routeSessionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(routeSessionId);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [activeSidePanel, setActiveSidePanel] = useState(null);
  const [panelWidth, setPanelWidth] = useState(480);
  const [diagnosisCompleted, setDiagnosisCompleted] = useState(false);
  const [diseaseName, setDiseaseName] = useState("");

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const startResizingPanel = useCallback((e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = panelWidth;

    const onMouseMove = (moveEvent) => {
      const newWidth = startWidth - (moveEvent.clientX - startX);
      if (newWidth >= 360 && newWidth <= 800) setPanelWidth(newWidth);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'default';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
  }, [panelWidth]);

  const userData = JSON.parse(localStorage.getItem('user') || '{}');
  const userId = userData.id || userData._id;
  const activeSession = sessions.find(s => s._id === (activeSessionId || routeSessionId));

  const extractReportPayload = (text) => {
    if (!text) return null;
    try {
      if (typeof text === 'object') return text;
      const raw = text.includes('---REPORT_DATA---') ? text.split('---REPORT_DATA---').pop() : text;
      const clean = raw.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(clean);
    } catch (err) {
      console.error('Failed to parse report JSON:', err);
      return null;
    }
  };

  const normalizeReports = (payload) => {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
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

  const getSessionReports = (session) => {
    if (!session) return [];
    if (Array.isArray(session.reports) && session.reports.length > 0) {
      return session.reports.map(r => ({
        reportType: r.reportType || 'Diagnosis Report',
        title: r.title || r.reportTitle || r.reportType || 'Clinical Report',
        reportData: r.reportData || r
      }));
    }
    const payload = extractReportPayload(session.diagnosis);
    return normalizeReports(payload);
  };

  const downloadReports = (reports) => {
    if (!reports || reports.length === 0) return;
    reports.forEach((r) => {
      if (!r) return;
      const reportData = r.reportData && typeof r.reportData === 'object' ? r.reportData : r;
      downloadMedicalReportPDF(reportData, {
        reportType: r.reportType,
        reportTitle: r.title
      });
    });
  };

  useEffect(() => {
    const reports = getSessionReports(activeSession);
    if (reports.length > 0 || activeSession?.diagnosis) {
      setDiagnosisCompleted(true);
      const firstReport = reports[0]?.reportData || null;
      const title = firstReport?.diagnosis?.name || activeSession?.title || "Wellness Plan";
      setDiseaseName(title);
    } else {
      setDiagnosisCompleted(false);
      setDiseaseName("");
    }
  }, [activeSession?.diagnosis, activeSession?.title, activeSession?.reports]);

  // Sync activeSessionId with route
  useEffect(() => {
    if (routeSessionId && routeSessionId !== activeSessionId) {
      setActiveSessionId(routeSessionId);
    }
  }, [routeSessionId]);

  // Load basic session list
  useEffect(() => {
    if (!userId) return;
    const loadSessions = async () => {
      try {
        const res = await chatApi.getSessions(userId);
        setSessions(prev => {
          // Merge to avoid overwriting a session that just loaded its messages
          const merged = res.data.map(summary => {
            const existing = prev.find(p => p._id === summary._id);
            if (existing?.messagesLoaded) {
              return {
                ...summary,
                messages: existing.messages,
                messagesLoaded: true,
                diagnosis: existing.diagnosis || summary.diagnosis,
                reports: existing.reports || summary.reports
              };
            }
            return summary;
          });
          return merged;
        });

        if (!routeSessionId && res.data.length > 0) {
          navigate(`/chat/${res.data[0]._id}`, { replace: true });
        } else if (!routeSessionId && res.data.length === 0) {
          handleNewSession();
        }
      } catch (_err) { }
    };
    loadSessions();
  }, [userId]);

  // Load detailed messages
  useEffect(() => {
    const sid = routeSessionId;
    if (!sid) return;

    const sess = sessions.find(s => s._id === sid);
    if (sess?.messagesLoaded) return;

    const loadFull = async () => {
      setIsMessagesLoading(true);
      try {
        const res = await chatApi.getSession(sid);
        setSessions(prev => {
          const index = prev.findIndex(s => s._id === sid);
          if (index !== -1) {
            const next = [...prev];
            next[index] = { ...res.data, messagesLoaded: true };
            return next;
          } else {
            return [{ ...res.data, messagesLoaded: true }, ...prev];
          }
        });
      } catch (_err) { }
      finally { setIsMessagesLoading(false); }
    };
    loadFull();
  }, [routeSessionId, sessions.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages, isLoading, isMessagesLoading]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  const handleNewSession = async () => {
    if (!userId || isLoading) return;
    setIsLoading(true);
    try {
      const res = await chatApi.createSession(userId);
      const newSess = res.data;
      setSessions(prev => [newSess, ...prev]);
      navigate(`/chat/${newSess._id}`, { replace: true, state: {} });
      window.dispatchEvent(new CustomEvent('refresh-sessions'));
    } catch (_err) { }
    finally { setIsLoading(false); }
  };

  useEffect(() => {
    if (location.state?.forceNew) {
      handleNewSession();
      // Clear the state so we don't recreate on re-renders
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  useEffect(() => {
    const onNewSession = () => handleNewSession();
    window.addEventListener('new-session-requested', onNewSession);
    return () => window.removeEventListener('new-session-requested', onNewSession);
  }, [userId, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading || !activeSession) return;
    const sessId = activeSession._id;
    const userText = input.trim();
    setInput('');
    setIsLoading(true);

    setSessions(prev => prev.map(s => s._id === sessId ? {
      ...s,
      messages: [...(s.messages || []), { role: 'user', text: userText }, { role: 'bot', text: '', isThinking: true }]
    } : s));

    try {
      const res = await chatApi.ask(sessId, userText, activeSession.diagnosis || '');
      const data = res.data;

      if (data.type === 'diagnosis') {
        const payload = extractReportPayload(data.content);
        const reports = normalizeReports(payload);
        setSessions(prev => prev.map(s => s._id === sessId ? {
          ...s,
          diagnosis: data.content,
          reports,
          messages: s.messages.slice(0, -1).concat({ role: 'report', text: data.content })
        } : s));
        setTimeout(() => {
          setSessions(prev => prev.map(s => s._id === sessId ? {
            ...s,
            messages: [...s.messages, { role: 'bot', text: 'Diagnostic analysis complete. A personalized wellness plan with custom recipes will be generated according to your report. I have also compiled a list of recommended doctors based on the required treatments. You can access these by clicking the buttons next to your report.' }]
          } : s));
        }, 1000);
      } else {
        const botText = data.content || data.question;
        const bubbles = botText.includes('---NEXT_BUBBLE---')
          ? botText.split('---NEXT_BUBBLE---').filter(Boolean).map(t => ({ role: 'bot', text: t.trim() }))
          : [{ role: 'bot', text: botText }];

        setSessions(prev => prev.map(s => s._id === sessId ? {
          ...s,
          messages: s.messages.slice(0, -1).concat(bubbles)
        } : s));
      }
    } catch (_err) { }
    finally { setIsLoading(false); }
  };

  useEffect(() => {
    const handleGlobalShowPlan = () => setActiveSidePanel('recipes');
    window.addEventListener('show-wellness-plan', handleGlobalShowPlan);
    return () => window.removeEventListener('show-wellness-plan', handleGlobalShowPlan);
  }, []);

  useEffect(() => {
    if (activeSession?.diagnosis || (activeSession?.reports && activeSession.reports.length > 0)) {
      const reports = getSessionReports(activeSession);
      const firstReport = reports[0]?.reportData || null;
      if (firstReport) {
        localStorage.setItem('active_report', JSON.stringify({ ...firstReport, hasPlan: !!activeSession.recipesText }));
        window.dispatchEvent(new CustomEvent('diagnosis-updated'));
      }
    } else {
      localStorage.removeItem('active_report');
      window.dispatchEvent(new CustomEvent('diagnosis-updated'));
    }
  }, [activeSession?.diagnosis, activeSession?.reports, activeSession?.recipesText]);

  const handleRecipes = async () => {
    if (isLoading || !activeSession?.diagnosis) return;
    if (activeSession.recipesText) {
      setActiveSidePanel('recipes');
      return;
    }
    setIsLoading(true);
    setActiveSidePanel('recipes');
    try {
      const res = await chatApi.getRecipes(activeSession._id, activeSession.diagnosis);
      setSessions(prev => prev.map(s => s._id === activeSession._id ? { ...s, recipesText: res.data.recipes } : s));
    } catch (_err) { }
    finally { setIsLoading(false); }
  };


  return (
    <div className="flex h-full w-full bg-[#fdfdfd] relative overflow-hidden font-sans">
      <div className="flex-1 flex flex-col h-full relative">
        
        {/* Top Bar (Section A) */}
        <div className="w-full h-[60px] md:h-[70px] bg-white border-b border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex items-center justify-between px-4 md:px-6 flex-shrink-0 z-10 transition-all duration-300 relative overflow-hidden">
           
           <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-[90px] md:px-[220px]">
             <h1 className="text-gray-800 font-semibold text-[15px] md:text-xl text-center truncate w-full pointer-events-auto">
               {!diagnosisCompleted ? "New Consultation" : diseaseName}
             </h1>
           </div>

           <div className="flex-1 pointer-events-none"></div>

           <div className="flex-shrink-0 flex justify-end gap-2 md:gap-3 z-20 relative">
             {diagnosisCompleted && (
                <button
                  onClick={() => downloadReports(getSessionReports(activeSession))}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-900 rounded-lg text-xs font-bold tracking-tight shadow-sm hover:bg-slate-50 active:scale-95 transition-all pointer-events-auto whitespace-nowrap"
                  title="Download Report"
                >
                  <Download size={14} strokeWidth={2.5} />
                  <span>Reports</span>
                </button>
             )}
             {diagnosisCompleted && (
                <button
                  onClick={handleRecipes}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-900 rounded-lg text-xs font-bold tracking-tight shadow-sm hover:bg-slate-50 active:scale-95 transition-all pointer-events-auto whitespace-nowrap"
                  title="View Wellness Plan"
                >
                  <Sparkles size={14} className="text-emerald-600" />
                  <span>Plan</span>
                </button>
             )}
             {diagnosisCompleted && (
                <button
                  onClick={() => setActiveSidePanel('doctors')}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-900 rounded-lg text-xs font-bold tracking-tight shadow-sm hover:bg-slate-50 active:scale-95 transition-all pointer-events-auto whitespace-nowrap"
                  title="Recommended Doctors"
                >
                  <Stethoscope size={14} className="text-blue-600" />
                  <span>Doctors</span>
                </button>
             )}
           </div>
        </div>

        {/* Messages area */}
        <div className={`flex-1 w-full overflow-y-auto scroll-smooth pb-[160px] custom-scrollbar ${activeSession?.diagnosis ? 'pt-8' : ''}`}>
          <div className="max-w-[800px] mx-auto px-6 py-12 space-y-10">

            {isMessagesLoading ? (
              <div className="py-24 flex flex-col items-center justify-center space-y-6">
                <div className="relative">
                   <div className="w-8 h-8 border-2 border-gray-200 border-t-ayur-forest rounded-full animate-spin"></div>
                   <Activity size={12} className="absolute inset-0 m-auto text-ayur-forest animate-pulse" />
                </div>
                <p className="text-[11px] font-normal text-gray-400 capitalize tracking-wide">Syncing clinical records...</p>
              </div>
            ) : (!activeSession?.messages || activeSession.messages.length === 0) ? (
              <div className="py-20 flex flex-col items-center text-center space-y-10 animate-fade-in">
                <div className="relative">
                   <div className="w-24 h-24 bg-white rounded-[32px] shadow-2xl border border-slate-200 flex items-center justify-center text-emerald-600 transform -rotate-3 transition-transform hover:rotate-0">
                     <Activity size={48} />
                   </div>
                   <div className="absolute -top-2 -right-2 w-8 h-8 bg-emerald-500 rounded-full border-4 border-white shadow-lg flex items-center justify-center">
                      <ShieldCheck size={16} className="text-white" />
                   </div>
                </div>
                <div className="space-y-4 max-w-[500px]">
                  <h2 className="text-5xl font-bold text-slate-900 tracking-tight leading-tight">
                    How are you feeling <span className="text-emerald-600">today?</span>
                  </h2>
                  <p className="text-black font-semibold text-lg opacity-80 leading-relaxed">
                    Start a private consultation with our Ayurvedic AI. We analyze your symptoms through traditional principles and modern data.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4 w-full">
                   {['Persistent Digestion Issues', 'Sleep Cycle Analysis', 'Seasonal Allergy Care', 'Energy & Stress Management'].map(tip => (
                      <button 
                        key={tip}
                        onClick={() => { setInput(tip); inputRef.current?.focus(); }}
                        className="px-6 py-4 bg-white border border-emerald-200 rounded-[20px] text-[13px] font-bold text-emerald-600 hover:border-emerald-400 hover:bg-emerald-50/40 transition-all text-left shadow-sm group"
                      >
                         <span className="opacity-40 group-hover:opacity-100 transition-opacity mr-2">✦</span>
                         {tip}
                      </button>
                   ))}
                </div>
              </div>
            ) : (
              activeSession?.messages?.map((msg, idx) => (
                <div key={idx} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}>
                  {msg.role === 'report' ? (
                    (() => {
                      const payload = extractReportPayload(msg.text);
                      const reports = normalizeReports(payload);
                      const primaryReport = reports[0]?.reportData || null;
                      return (
                        <div className="w-full relative py-8 space-y-10">
                          {primaryReport ? (
                            <>
                              {primaryReport && <PDFChartContainer report={primaryReport} />}
                              <div className="space-y-8">
                                <div className="bg-white border-2 border-slate-100 rounded-[28px] p-10 space-y-4 shadow-sm relative group overflow-hidden transition-all hover:border-black cursor-default">
                                  <div className="absolute top-0 right-0 w-24 h-1 bg-emerald-500"></div>
                                  <div className="flex items-center justify-between gap-3 text-emerald-600 mb-2">
                                    <div className="flex items-center gap-3">
                                      <ShieldCheck size={18} strokeWidth={2.5} />
                                      <span className="text-xs font-bold tracking-tight">Biological Synthesis Verified</span>
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{reports[0]?.reportType || 'Clinical Report'}</span>
                                  </div>
                                  <h3 className="text-3xl font-bold text-slate-900 tracking-tight leading-none">{reports[0]?.title || primaryReport.diagnosis?.name || 'Ayurvedic Assessment'}</h3>
                                  <p className="text-slate-600 font-medium text-lg leading-relaxed opacity-70 line-clamp-2">
                                    "{primaryReport.diagnosis?.reasoning || 'Systemic restoration of bodily equilibrium through focused Ayurvedic protocols.'}"
                                  </p>
                                </div>
                                <div className="flex flex-wrap justify-center gap-4">
                                  <button
                                    onClick={() => downloadMedicalReportPDF(primaryReport, { reportType: reports[0]?.reportType, reportTitle: reports[0]?.title })}
                                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-900 rounded-lg text-xs font-bold tracking-tight shadow-sm hover:bg-slate-50 active:scale-95 transition-all"
                                  >
                                    <Download size={16} strokeWidth={3} />
                                    <span>Download</span>
                                  </button>
                                  <button
                                    onClick={handleRecipes}
                                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-900 rounded-lg text-xs font-bold tracking-tight shadow-sm hover:bg-slate-50 active:scale-95 transition-all"
                                  >
                                    <Sparkles size={16} fill="currentColor" className="text-emerald-600" />
                                    <span>Wellness Plan</span>
                                  </button>
                                  <button
                                    onClick={() => setActiveSidePanel('doctors')}
                                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-900 rounded-lg text-xs font-bold tracking-tight shadow-sm hover:bg-slate-50 active:scale-95 transition-all"
                                  >
                                    <Stethoscope size={16} fill="currentColor" className="text-blue-600" />
                                    <span>Doctors</span>
                                  </button>
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="bg-red-50 border border-red-100 rounded-[32px] p-10 text-center space-y-3">
                              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-500 mx-auto">
                                <Activity size={24} />
                              </div>
                              <h4 className="text-red-900 font-bold uppercase text-xs tracking-widest">Analysis Failure</h4>
                              <p className="text-red-600/60 text-sm font-medium">Internal engine could not synthesize the diagnostic data.</p>
                            </div>
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    <div className={`flex gap-6 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center shadow-md border-2 transition-transform hover:scale-105 ${msg.role === 'user' ? 'bg-slate-100 border-slate-200 text-slate-900' : 'bg-white border-slate-200 text-emerald-600'}`}>
                        {msg.role === 'user' ? (
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="opacity-90">
                            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                          </svg>
                        ) : <Bot size={20} strokeWidth={2.5} />}
                      </div>
                      <div className={`flex flex-col gap-2.5 ${msg.role === 'user' ? 'items-end' : ''}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-black uppercase tracking-widest ${msg.role === 'user' ? 'text-slate-400' : 'text-emerald-500'}`}>
                            {msg.role === 'user' ? `User ${userId?.toString().slice(-4) || '1'}` : `Doc AI`}
                          </span>
                        </div>
                        <div className={`rounded-[22px] text-[15px] leading-relaxed font-normal shadow-sm max-w-full overflow-hidden ${msg.role === 'user'
                          ? 'bg-slate-100 text-slate-900 border-2 border-transparent rounded-tr-none px-6 py-4.5'
                          : msg.isThinking 
                            ? 'bg-white border-2 border-slate-200 text-slate-900 rounded-tl-none px-5 py-4'
                            : 'bg-white border-2 border-slate-200 text-slate-900 rounded-tl-none px-6 py-4.5'
                          }`}>
                          {msg.isThinking ? (
                            <div className="flex gap-1.5 items-center justify-center">
                               <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"></span>
                               <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                               <span className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                            </div>
                          ) : (
                            <div className="prose prose-slate max-w-none text-black font-normal break-words" dangerouslySetInnerHTML={{ __html: sanitizeMarkdownText(msg.text) }} />
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="absolute bottom-0 left-0 right-0 p-8 pt-0 z-40 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none">
          <div className="max-w-[800px] mx-auto pointer-events-auto mt-12 mb-4">
            <div className="relative group">
               <div className="absolute -inset-1 bg-gray-100 rounded-[34px] blur-sm opacity-0 group-focus-within:opacity-100 transition-opacity duration-300"></div>
               <div className="relative bg-white border-2 border-gray-100 rounded-[32px] shadow-[0_15px_40px_rgba(0,0,0,0.05)] focus-within:border-ayur-forest/30 p-2 pr-4 flex items-center transition-all duration-300">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="Describe your symptoms in detail..."
                  className="flex-1 bg-transparent border-none outline-none py-4 pl-6 pr-4 text-[16px] font-normal text-black placeholder:text-gray-300 resize-none min-h-[58px] max-h-[160px] custom-scrollbar selection:bg-ayur-sage/20"
                  rows={1}
                  disabled={isMessagesLoading}
                />
                <button
                  onClick={handleSend}
                  disabled={isLoading || !input.trim() || isMessagesLoading}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 border-2 ${input.trim() ? 'bg-black border-black text-white shadow-xl scale-100' : 'bg-gray-50 text-gray-200 border-gray-100 scale-95 opacity-50 cursor-not-allowed'}`}
                >
                  {isLoading ? <Loader2 size={16} strokeWidth={2.5} className="animate-spin text-white" /> : <Send size={20} strokeWidth={2.5} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Side Panel */}
      {activeSidePanel && (
        <div style={{ width: `${panelWidth}px` }} className="bg-white border-l border-gray-100 h-full animate-fade-in flex flex-col shadow-[0_0_100px_rgba(0,0,0,0.1)] relative z-50 flex-shrink-0 transition-none">
          <div 
            className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-ayur-sage/30 active:bg-ayur-sage/60 z-50 transition-colors"
            onMouseDown={startResizingPanel}
          ></div>
          <div className="p-8 border-b border-gray-50 flex items-center justify-between bg-white relative shrink-0">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-ayur-sage to-ayur-forest"></div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                 {activeSidePanel === 'recipes' ? <Sparkles size={14} className="text-emerald-500" /> : <Stethoscope size={14} className="text-blue-500" />}
                 <h4 className="text-[10px] font-black uppercase text-ayur-sage tracking-[3px]">{activeSidePanel === 'recipes' ? 'Wellness Strategy' : 'Practitioners'}</h4>
              </div>
              <h3 className="text-2xl font-black text-ayur-forest capitalize tracking-tight">{activeSidePanel === 'recipes' ? 'Wellness Plan' : 'Recommended Doctors'}</h3>
            </div>
            <button onClick={() => setActiveSidePanel(null)} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-600 rounded-2xl transition-all active:scale-90">
              <X size={24} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto bg-gray-50/50">
            {activeSidePanel === 'recipes' ? (
              <div className="p-2">
                 <RecipesView embedded recipes={activeSession?.recipesText || ''} />
              </div>
            ) : (
              <div className="p-2 h-full">
                 <FindDoctors embedded diagnosis={activeSession?.diagnosis} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Chat;
