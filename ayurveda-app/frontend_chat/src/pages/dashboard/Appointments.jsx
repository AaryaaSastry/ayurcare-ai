import React, { useState, useEffect } from 'react';
import AppointmentCard from '../../components/dashboard/AppointmentCard';
import { Calendar as CalendarIcon, LayoutGrid, List, Activity, Video, MapPin, X, ExternalLink, Navigation, ArrowRight, ChevronRight, Trash2, PlusCircle, Loader2 } from 'lucide-react';
import { patientApi, doctorChatApi } from '../../services/api';
import { Link, useNavigate } from 'react-router-dom';

const Appointments = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list');
  const [selectedAppt, setSelectedAppt] = useState(null);
  const navigate = useNavigate();

  const formatTime = (date) => {
    if (!date) return null;
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const res = await patientApi.getAppointments();
      setAppointments(res.data);
    } catch (err) {
      console.error('Failed to fetch appointments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAppointment = async (id) => {
    console.log('🗑 Attempting to hide appointment:', id);
    try {
      const res = await patientApi.hideAppointment(id);
      console.log('✅ Backend hide successful:', res.data);
      setAppointments(prev => {
        const filtered = prev.filter(appt => {
          const apptId = appt._id?.toString() || appt.id?.toString();
          return apptId !== id.toString();
        });
        console.log(`📊 Filtered list from ${prev.length} to ${filtered.length} items`);
        return filtered;
      });
    } catch (err) {
      console.error('❌ Failed to hide appointment:', err);
    }
  };

  const handleMessageDoctor = async (appointment) => {
    const doctorId = appointment?.doctorId?._id;
    if (!doctorId) return;
    try {
      const res = await doctorChatApi.initiateChat({ doctorId });
      const chatId = res?.data?._id;
      if (!chatId) throw new Error('Missing chat id');
      navigate(`/messages/${chatId}`);
    } catch (err) {
      console.error('Failed to open doctor chat:', err);
    }
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar px-4 sm:px-6 md:px-8 lg:px-12 py-10">
      <div className="max-w-[1400px] mx-auto space-y-10 pb-20">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-10 pb-6 border-b border-slate-200">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-emerald-600 font-bold uppercase text-[10px] tracking-[2px]">
              <CalendarIcon size={14} strokeWidth={2.5} />
              <span>Your Medical Timeline</span>
            </div>
            <h1 className="text-5xl font-bold text-slate-900 tracking-tight">Appointments</h1>
            <p className="text-slate-600 font-medium text-base leading-snug max-w-2xl">Manage and access all your scheduled health sessions in one place.</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 border border-slate-200">
              <button 
                onClick={() => setView('grid')}
                className={`p-2 rounded-md transition-all duration-300 ${view === 'grid' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-900'}`}
                title="Grid view"
              >
                <LayoutGrid size={18} strokeWidth={2.5} />
              </button>
              <button 
                onClick={() => setView('list')}
                className={`p-2 rounded-md transition-all duration-300 ${view === 'list' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-900'}`}
                title="List view"
              >
                <List size={18} strokeWidth={2.5} />
              </button>
            </div>
            <Link to="/find-doctors" className="flex items-center gap-2 px-12 py-2.5 bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 active:scale-95 transition-all text-xs tracking-tight">
              <PlusCircle size={16} strokeWidth={2.5} />
              <span>Book Now</span>
            </Link>
          </div>
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[300px] space-y-6">
             <div className="relative">
                <div className="w-16 h-16 border-4 border-emerald-500/10 border-t-emerald-500 rounded-full animate-spin"></div>
                <Activity size={24} className="absolute inset-0 m-auto text-emerald-500 animate-pulse" />
             </div>
             <p className="text-xs font-bold tracking-tight text-slate-400">Loading appointments...</p>
          </div>
        ) : appointments.length === 0 ? (
          <div className="py-40 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center space-y-8 bg-slate-50 shadow-inner">
             <div className="w-24 h-24 bg-white border-2 border-slate-200 rounded-full flex items-center justify-center text-slate-300 shadow-sm">
                <CalendarIcon size={48} strokeWidth={2.5} />
             </div>
             <div className="space-y-2">
               <h3 className="text-2xl font-bold text-slate-900 tracking-tight">No Appointments Scheduled</h3>
               <p className="text-slate-500 font-medium text-sm">Begin by booking your first health session.</p>
             </div>
             <Link to="/find-doctors" className="px-12 py-3 bg-slate-900 text-white rounded-lg font-bold shadow-lg shadow-slate-900/20 tracking-tight text-sm hover:bg-black active:scale-95 transition-all">Find a Doctor</Link>
          </div>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {appointments.map(appt => (
               <AppointmentCard 
                 key={appt._id} 
                 appointment={appt} 
                 onDelete={handleDeleteAppointment}
                 onMessage={handleMessageDoctor}
                 isListView={false}
               />
             ))}
          </div>
        ) : (
          <div className="space-y-4">
             {appointments.map(appt => (
               <AppointmentCard 
                 key={appt._id} 
                 appointment={appt} 
                 onDelete={handleDeleteAppointment}
                 onMessage={handleMessageDoctor}
                 isListView={true}
               />
             ))}
          </div>
        )}

        {/* Shared Session Access Modal */}
      {selectedAppt && (() => {
        const type = (selectedAppt.type || selectedAppt.appointmentType || 'online').toLowerCase();
        const isOnline = type === 'online';
        const clinicInfo = selectedAppt.doctorId?.clinicInfo || {};
        const fullAddress = [clinicInfo.address, clinicInfo.city, clinicInfo.state, clinicInfo.pincode].filter(Boolean).join(', ');
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clinicInfo.clinicName + ' ' + fullAddress)}`;
        const meetingLink = selectedAppt.meetingLink || '#';

        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-300">
            <div 
              className="bg-white w-full max-w-md rounded-[40px] p-10 relative shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-10 duration-300 border-2 border-gray-100"
              onMouseLeave={() => setSelectedAppt(null)}
            >
               <div className="space-y-8">
                  <div className="space-y-3">
                     <div className="flex items-center gap-2 text-slate-500 font-bold text-xs tracking-tight">
                        {isOnline ? <Video size={16} className="text-emerald-500" /> : <MapPin size={16} className="text-emerald-500" />}
                        <span>{isOnline ? 'Virtual Hub' : 'Physical Clinic'}</span>
                     </div>
                     <h2 className="text-4xl font-bold text-slate-900 tracking-tight leading-none">
                        {isOnline ? 'Access' : 'Visit'} <span className="text-emerald-600">{isOnline ? 'Session' : 'Hospital'}</span>
                     </h2>
                  </div>

                  {isOnline ? (
                     <div className="space-y-6">
                        <div className="p-8 bg-[#f8faf9] border-2 border-gray-100 rounded-[32px] space-y-6">
                           <div className="flex items-center gap-4">
                              <div className="w-14 h-14 bg-white border-2 border-gray-100 rounded-2xl flex items-center justify-center text-emerald-500 shadow-sm">
                                 <Video size={24} strokeWidth={2.5} />
                              </div>
                              <div>
                                 <h4 className="font-bold text-slate-900 text-lg tracking-tight">Google Meet</h4>
                                 <p className="text-xs font-bold tracking-tight text-slate-400">Secured Clinical Line</p>
                              </div>
                           </div>
                           
                           {selectedAppt.meetingLink ? (
                             <a 
                               href={meetingLink} 
                               target="_blank" 
                               rel="noopener noreferrer"
                               className="w-full flex items-center justify-between p-5 bg-white border-2 border-gray-100 rounded-2xl hover:border-emerald-500/30 transition-all group/link"
                             >
                                <span className="text-[12px] font-bold text-gray-400 truncate max-w-[200px]">{meetingLink}</span>
                                <ExternalLink size={16} className="text-emerald-500 group-hover/link:translate-x-1 group-hover/link:-translate-y-1 transition-transform" />
                             </a>
                           ) : (
                             <div className="p-5 bg-amber-50 border-2 border-amber-100 rounded-lg">
                                <p className="text-xs font-bold tracking-tight text-amber-600 text-center">Waiting for practitioner to generate session link...</p>
                             </div>
                           )}
                        </div>
                        
                        <button 
                          disabled={!selectedAppt.meetingLink}
                          onClick={() => window.open(meetingLink, '_blank')}
                          className={`w-full py-5 rounded-lg font-bold tracking-tight text-sm flex items-center justify-center gap-4 transition-all shadow-lg ${
                            selectedAppt.meetingLink 
                              ? 'bg-slate-900 text-white hover:bg-slate-800 active:scale-95 shadow-slate-900/20' 
                              : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                          }`}
                        >
                           <span>Join Consultation</span>
                           <ArrowRight size={18} strokeWidth={3} />
                        </button>
                     </div>
                  ) : (
                     <div className="space-y-6">
                        <div className="p-8 bg-[#f8faf9] border-2 border-gray-100 rounded-[32px] space-y-6">
                           <div className="space-y-4">
                              <div className="flex items-center gap-4">
                                 <div className="w-14 h-14 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                                    <Navigation size={24} strokeWidth={2.5} />
                                 </div>
                                 <div>
                                    <h4 className="font-bold text-slate-900 text-lg tracking-tight">{clinicInfo.clinicName || 'The Wellness Center'}</h4>
                                    <p className="text-xs font-bold tracking-tight text-emerald-600">Physical Assessment Hub</p>
                                 </div>
                              </div>
                              
                              <div className="p-6 bg-white border-2 border-gray-100 rounded-2xl space-y-2">
                                 <p className="text-base font-bold text-slate-900 leading-tight tracking-tight">{clinicInfo.address}</p>
                                 <p className="text-xs font-bold text-slate-400 tracking-tight">{clinicInfo.city}, {clinicInfo.state} {clinicInfo.pincode}</p>
                              </div>
                           </div>
                        </div>
                        
                        <a 
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-5 bg-slate-900 text-white rounded-lg font-bold tracking-tight text-sm flex items-center justify-center gap-4 hover:bg-slate-800 active:scale-95 transition-all shadow-lg shadow-slate-900/20"
                        >
                           <span>View on Google Maps</span>
                           <MapPin size={18} strokeWidth={3} />
                        </a>
                     </div>
                  )}

                  <p className="text-center text-xs font-bold tracking-tight text-slate-400">
                     Move cursor away to close
                  </p>
               </div>
            </div>
          </div>
        );
      })()}
      </div>
    </div>
  );
};

export default Appointments;
