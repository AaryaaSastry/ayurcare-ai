import React, { useState } from 'react';
import { Calendar, Clock, MapPin, User, ArrowRight, Video, Stethoscope, ChevronRight, Activity, X, ExternalLink, Navigation, Loader2, Trash2, Eye, MessageSquare } from 'lucide-react';

const AppointmentCard = ({ appointment, onDelete, onMessage, isListView = false }) => {
   const [loading, setLoading] = useState(false);
   const [showSessionInfo, setShowSessionInfo] = useState(false);
   const isConfirmed = (appointment.status || "").toLowerCase() === 'confirmed';
   const isPending = (appointment.status || "").toLowerCase() === 'pending';
   const isCancelled = (appointment.status || "").toLowerCase() === 'cancelled';

   const formatTime = (date) => {
      if (!date) return null;
      return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
   };

   const doctorName = appointment.doctor || (appointment.doctorId?.basicInfo?.name ? `Dr. ${appointment.doctorId.basicInfo.name}` : 'Practitioner');
   const specialty = appointment.specialty || appointment.doctorId?.professionalInfo?.specialization || 'Clinical Expert';
   const apptDate = appointment.date || (appointment.startTime ? new Date(appointment.startTime).toLocaleDateString() : appointment.createdAt ? new Date(appointment.createdAt).toLocaleDateString() : 'TBD');
   const apptTime = formatTime(appointment.startTime) || appointment.time || 'TBD';

   // Robust type detection based on model
   const type = (appointment.type || appointment.appointmentType || 'online').toLowerCase();
   const isOnline = type === 'online';
   const displayType = isOnline ? 'Virtual Session' : (type === 'clinic' ? 'Clinical Visit' : 'Follow-up');

   const clinicInfo = appointment.doctorId?.clinicInfo || {};
   const fullAddress = [clinicInfo.address, clinicInfo.city, clinicInfo.state, clinicInfo.pincode].filter(Boolean).join(', ');
   const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clinicInfo.clinicName + ' ' + fullAddress)}`;
   const meetingLink = appointment.meetingLink || '#';

   if (isListView) {
      return (
         <div className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-lg hover:border-slate-300 hover:shadow-emerald-500/5 transition-all duration-300 flex items-center justify-between gap-6 group relative overflow-hidden">
            {/* Gradient accent on hover */}
            <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
            
            {/* Left section: Doctor info */}
            <div className="flex items-center gap-5 flex-1 min-w-0 relative z-10">
               <div className={`w-14 h-14 rounded-2xl ring-2 ring-white border border-slate-200 flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:scale-110 ${isConfirmed ? 'bg-emerald-50 text-emerald-600' : isPending ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-600'}`}>
                  <Activity size={22} strokeWidth={2.5} />
               </div>
               
               <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900 text-sm leading-none mb-1">{doctorName}</h3>
                  <p className="text-xs font-medium text-slate-500 truncate">{specialty}</p>
               </div>
            </div>

            {/* Middle section: Date & Time */}
            <div className="flex items-center gap-6 flex-shrink-0 relative z-10">
               <div className="flex items-center gap-2 text-slate-600">
                  <div className="p-1.5 bg-slate-100 rounded-lg">
                     <Calendar size={14} strokeWidth={2.5} className="text-slate-600" />
                  </div>
                  <span className="text-xs font-bold text-slate-900">{apptDate}</span>
               </div>
               <div className="w-px h-6 bg-slate-200"></div>
               <div className="flex items-center gap-2 text-slate-600">
                  <div className="p-1.5 bg-slate-100 rounded-lg">
                     <Clock size={14} strokeWidth={2.5} className="text-slate-600" />
                  </div>
                  <span className="text-xs font-bold text-slate-900">{apptTime}</span>
               </div>
            </div>

            {/* Status badge */}
            <div className="flex-shrink-0 relative z-10">
               <span className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-2 ${isConfirmed ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : isPending ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-slate-50 text-slate-400 border border-slate-200'}`}>
                  <div className={`w-2 h-2 rounded-full ${isConfirmed ? 'bg-emerald-500 animate-pulse' : isPending ? 'bg-amber-500' : 'bg-slate-300'}`}></div>
                  {appointment.status || 'Scheduled'}
               </span>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 flex-shrink-0 relative z-10">
               <button
                  onClick={() => onMessage?.(appointment)}
                  className="p-2.5 bg-white border border-slate-200 text-slate-500 rounded-xl hover:bg-slate-50 hover:text-emerald-600 transition-all duration-300"
                  title="Message doctor"
               >
                  <MessageSquare size={16} strokeWidth={2.5} />
               </button>
               <button
                  onClick={async (e) => {
                     e.stopPropagation();
                     if (window.confirm('Cancel and hide this appointment?')) {
                        setLoading(true);
                        try {
                           await onDelete(appointment._id);
                        } finally {
                           setLoading(false);
                        }
                     }
                  }}
                  disabled={loading}
                  className="p-2.5 bg-white border border-slate-200 text-slate-400 rounded-xl hover:bg-red-50 hover:text-red-500 transition-all duration-300 disabled:opacity-60"
                  title="Cancel appointment"
               >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} strokeWidth={2.5} />}
               </button>
               <button 
                  onClick={() => setShowSessionInfo(true)}
                  className="p-2.5 bg-slate-900 text-white rounded-xl hover:bg-emerald-600 transition-all duration-300 group/access shadow-md shadow-slate-900/20"
                  title="Access appointment"
               >
                  <ChevronRight size={16} strokeWidth={2.5} />
               </button>
            </div>

            {showSessionInfo && (
               <div className="absolute inset-0 z-50 bg-white rounded-2xl border border-slate-200 flex flex-col shadow-2xl p-8 overflow-y-auto">
                  <button onClick={() => setShowSessionInfo(false)} className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-lg transition-all">
                     <X size={20} className="text-slate-400" />
                  </button>
                  <div className="space-y-8">
                     {/* Header */}
                     <div>
                        <div className="flex items-center gap-3 mb-4">
                           <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isOnline ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'}`}>
                              {isOnline ? <Video size={24} strokeWidth={2.5} /> : <MapPin size={24} strokeWidth={2.5} />}
                           </div>
                           <div>
                              <p className="text-xs font-bold uppercase text-slate-500 tracking-wide">Appointment Details</p>
                              <h2 className="text-2xl font-bold text-slate-900">{isOnline ? 'Virtual Session' : 'Clinic Visit'}</h2>
                           </div>
                        </div>
                     </div>

                     {/* Doctor Info */}
                     <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                        <p className="text-xs font-bold uppercase text-slate-500 tracking-wide mb-3">Medical Professional</p>
                        <div className="space-y-1">
                           <h3 className="text-lg font-bold text-slate-900">{doctorName}</h3>
                           <p className="text-sm text-slate-600 font-medium">{specialty}</p>
                        </div>
                     </div>

                     {/* Appointment Date & Time */}
                     <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                           <div className="flex items-center gap-2 mb-2">
                              <Calendar size={16} className="text-slate-600" />
                              <p className="text-xs font-bold uppercase text-slate-500 tracking-wide">Date</p>
                           </div>
                           <p className="text-base font-bold text-slate-900">{apptDate}</p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                           <div className="flex items-center gap-2 mb-2">
                              <Clock size={16} className="text-slate-600" />
                              <p className="text-xs font-bold uppercase text-slate-500 tracking-wide">Time</p>
                           </div>
                           <p className="text-base font-bold text-slate-900">{apptTime}</p>
                        </div>
                     </div>

                     {/* Status Badge */}
                     <div className="flex items-center gap-3 px-5 py-4 bg-slate-50 rounded-xl border border-slate-200">
                        <div className={`w-3 h-3 rounded-full ${isConfirmed ? 'bg-emerald-500 animate-pulse' : isPending ? 'bg-amber-500' : 'bg-slate-400'}`}></div>
                        <span className={`font-bold uppercase tracking-wide text-sm ${isConfirmed ? 'text-emerald-600' : isPending ? 'text-amber-600' : 'text-slate-600'}`}>
                           {appointment.status === 'confirmed' ? 'Confirmed - Ready to proceed' : appointment.status === 'pending' ? 'Pending - Awaiting confirmation' : 'Scheduled'}
                        </span>
                     </div>

                     {isOnline ? (
                        /* Virtual Session Info */
                        <div className="space-y-4">
                           {appointment.meetingLink ? (
                              <>
                                 <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                                    <p className="text-xs font-bold uppercase text-blue-600 tracking-wide mb-3">Meeting Link</p>
                                    <a href={meetingLink} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-blue-600 hover:text-blue-700 truncate break-all flex items-center gap-2">
                                       {meetingLink}
                                       <ExternalLink size={14} className="flex-shrink-0" />
                                    </a>
                                 </div>
                                 <a href={meetingLink} target="_blank" rel="noopener noreferrer" className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 active:scale-95">
                                    <Video size={18} strokeWidth={2.5} />
                                    <span>Join Video Session</span>
                                 </a>
                              </>
                           ) : (
                              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
                                 <p className="text-sm font-bold text-amber-600">Meeting link will be shared by the doctor before your scheduled time.</p>
                              </div>
                           )}
                        </div>
                     ) : (
                        /* Clinic Visit Info */
                        <div className="space-y-4">
                           <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
                              <p className="text-xs font-bold uppercase text-emerald-600 tracking-wide mb-3">Clinic Information</p>
                              <div className="space-y-3">
                                 <div>
                                    <p className="text-xs font-bold uppercase text-emerald-600/70 tracking-wide mb-1">Clinic Name</p>
                                    <p className="text-base font-bold text-slate-900">{clinicInfo.clinicName || 'The Wellness Center'}</p>
                                 </div>
                                 <div>
                                    <p className="text-xs font-bold uppercase text-emerald-600/70 tracking-wide mb-1">Address</p>
                                    <p className="text-sm font-medium text-slate-600">{clinicInfo.address || 'Address not available'}, {clinicInfo.city || ''}</p>
                                 </div>
                              </div>
                           </div>
                           <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 active:scale-95">
                              <Navigation size={18} strokeWidth={2.5} />
                              <span>Open in Maps</span>
                           </a>
                        </div>
                     )}

                     <button
                        onClick={() => onMessage?.(appointment)}
                        className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-black transition-all shadow-lg shadow-slate-900/20 active:scale-95"
                     >
                        <MessageSquare size={18} strokeWidth={2.5} />
                        <span>Open Doctor Chat</span>
                     </button>

                     {/* Footer Note */}
                     <p className="text-xs font-medium text-slate-500 text-center">Click the X button or outside to close</p>
                  </div>
               </div>
            )}
         </div>
      );
   }

   // Grid view - matches FindDoctors card style
   return (
      <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm hover:shadow-2xl hover:shadow-slate-500/10 transition-all duration-500 relative overflow-hidden group"
         onMouseLeave={() => setShowSessionInfo(false)}
      >
         <div className={`absolute top-0 right-0 w-32 h-32 rounded-bl-[100px] -z-0 transition-transform group-hover:scale-125 ${isConfirmed ? 'bg-emerald-500/5' : isPending ? 'bg-amber-500/5' : 'bg-slate-500/5'}`}></div>

         <button
            onClick={async (e) => {
               e.stopPropagation();
               if (window.confirm('Hide this appointment from your schedule?')) {
                  setLoading(true);
                  try {
                     await onDelete(appointment._id);
                  } finally {
                     setLoading(false);
                  }
               }
            }}
            disabled={loading}
            className="absolute top-4 right-4 w-8 h-8 bg-white/80 backdrop-blur-md border border-slate-200 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-100 hover:bg-red-50 transition-all z-20 shadow-sm opacity-0 group-hover:opacity-100 disabled:opacity-50"
         >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
         </button>

         <div className="relative z-10 flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-[32px] mb-5 ring-4 ring-white bg-slate-100 p-1 border border-slate-200 shadow-inner overflow-hidden relative transition-transform group-hover:scale-105 duration-500 flex items-center justify-center">
               <Activity size={48} className={`${isConfirmed ? 'text-emerald-600' : isPending ? 'text-amber-600' : 'text-slate-400'}`} strokeWidth={2} />
               <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/10 to-transparent"></div>
               <div className={`absolute bottom-2 right-2 w-4 h-4 border-4 rounded-full border-white ${isConfirmed ? 'bg-emerald-500 animate-pulse' : isPending ? 'bg-amber-500' : 'bg-slate-400'}`}></div>
            </div>
            
            <div className="space-y-1 mb-6">
               <div className="flex items-center justify-center gap-2">
                  <h3 className="text-2xl font-bold text-slate-900 tracking-tight leading-none">{doctorName}</h3>
                  <span className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-[2px] ${isConfirmed ? 'bg-emerald-50 text-emerald-600' : isPending ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-400'}`}>
                     {appointment.status || 'Scheduled'}
                  </span>
               </div>
               <span className="text-[10px] font-bold uppercase text-slate-600 tracking-[2px] block">{specialty}</span>
            </div>
            
            <div className="flex items-center gap-8 mb-6 py-4 border-y border-slate-100 w-full justify-center">
               <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] font-bold uppercase text-slate-400 tracking-widest">Date</span>
                  <span className="text-base font-bold text-slate-900 tracking-tight leading-none">{apptDate}</span>
               </div>
               <div className="w-px h-6 bg-slate-200"></div>
               <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] font-bold uppercase text-slate-400 tracking-widest">Time</span>
                  <span className="text-base font-bold text-slate-900 tracking-tight leading-none">{apptTime}</span>
               </div>
            </div>
            
            <div className="flex items-center justify-center gap-2 mb-6 px-3 py-1.5 bg-slate-100 rounded-full">
               {isOnline ? <Video size={14} className="text-emerald-600" /> : <MapPin size={14} className="text-emerald-600" />}
               <span className="text-xs font-bold text-slate-600 tracking-tight">{displayType}</span>
            </div>
            
            <div className="w-full">
               <div className="grid grid-cols-2 gap-3">
                  <button
                     onClick={() => onMessage?.(appointment)}
                     className="w-full bg-white border border-slate-200 text-slate-900 py-4 rounded-3xl text-sm font-bold uppercase tracking-widest hover:bg-slate-50 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                     <MessageSquare size={16} strokeWidth={2.5} />
                     <span>Chat</span>
                  </button>
                  <button
                     onClick={() => setShowSessionInfo(true)}
                     className="w-full bg-slate-100 text-slate-900 py-4 rounded-3xl text-sm font-bold uppercase tracking-widest hover:bg-slate-200 active:scale-95 transition-all flex items-center justify-center gap-2 group/btn"
                  >
                     <Eye size={18} strokeWidth={2.5} />
                     <span>Access</span>
                  </button>
               </div>
            </div>
         </div>

         {/* Session Access Overlay */}
         {showSessionInfo && (
            <div className="absolute inset-0 z-50 bg-white p-8 rounded-[40px] border border-slate-200 flex flex-col justify-center animate-in slide-in-from-bottom-full duration-500 shadow-2xl">
               <button onClick={() => setShowSessionInfo(false)} className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-lg transition-all">
                  <X size={20} className="text-slate-400" />
               </button>
               
               <div className="space-y-6">
                  <div className="space-y-2">
                     <div className="flex items-center justify-center gap-2 text-slate-600 font-bold text-xs uppercase tracking-[2px]">
                        {isOnline ? <Video size={16} className="text-emerald-600" /> : <MapPin size={16} className="text-emerald-600" />}
                        <span>{isOnline ? 'Virtual Hub' : 'Clinic Info'}</span>
                     </div>
                     <h2 className="text-2xl font-bold text-slate-900 tracking-tight text-center">
                        {isOnline ? 'Join Session' : 'Clinic Details'}
                     </h2>
                  </div>

                  {isOnline ? (
                     <div className="space-y-4">
                        {appointment.meetingLink ? (
                           <a
                              href={meetingLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full flex items-center justify-between p-4 bg-slate-100 border border-slate-200 rounded-lg hover:border-emerald-400 transition-all"
                           >
                              <span className="text-xs font-bold text-slate-600 truncate max-w-[180px]">{meetingLink}</span>
                              <ExternalLink size={16} className="text-emerald-600 flex-shrink-0" />
                           </a>
                        ) : (
                           <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                              <p className="text-xs font-bold uppercase tracking-wide text-amber-600 text-center">Awaiting session link...</p>
                           </div>
                        )}
                        <button
                           disabled={!appointment.meetingLink}
                           onClick={() => window.open(meetingLink, '_blank')}
                           className={`w-full py-3 rounded-lg font-bold tracking-tight text-sm flex items-center justify-center gap-2 transition-all ${appointment.meetingLink
                              ? 'bg-slate-900 text-white hover:bg-black shadow-lg shadow-slate-900/20'
                              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                           }`}
                        >
                           <span>Join Now</span>
                           <ArrowRight size={18} />
                        </button>
                     </div>
                  ) : (
                     <div className="space-y-4">
                        <div className="p-4 bg-slate-100 border border-slate-200 rounded-lg">
                           <h4 className="font-bold text-slate-900 text-sm mb-2">{clinicInfo.clinicName || 'The Wellness Center'}</h4>
                           <p className="text-xs text-slate-600 font-medium">{clinicInfo.address}, {clinicInfo.city}</p>
                        </div>
                        <a
                           href={mapsUrl}
                           target="_blank"
                           rel="noopener noreferrer"
                           className="w-full py-3 bg-slate-900 text-white rounded-lg font-bold tracking-tight text-sm flex items-center justify-center gap-2 hover:bg-black active:scale-95 transition-all shadow-lg shadow-slate-900/20"
                        >
                           <span>Open Maps</span>
                           <MapPin size={18} />
                        </a>
                     </div>
                  )}

                  <button
                     onClick={() => onMessage?.(appointment)}
                     className="w-full py-3 bg-slate-900 text-white rounded-lg font-bold tracking-tight text-sm flex items-center justify-center gap-2 hover:bg-black active:scale-95 transition-all shadow-lg shadow-slate-900/20"
                  >
                     <MessageSquare size={16} strokeWidth={2.5} />
                     <span>Open Doctor Chat</span>
                  </button>
               </div>
            </div>
         )}
      </div>
   );
};

export default AppointmentCard;
