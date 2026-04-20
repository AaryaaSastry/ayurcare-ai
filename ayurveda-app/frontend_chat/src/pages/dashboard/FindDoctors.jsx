import React, { useState, useEffect } from 'react';
import { Search, MapPin, Star, ShieldCheck, Clock, ArrowRight, Filter, Activity, User, Loader2, MessageSquare } from 'lucide-react';
import { publicApi, patientApi, chatApi, doctorChatApi } from '../../services/api';
import { useNavigate } from 'react-router-dom';

const FindDoctors = ({ embedded, diagnosis }) => {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [location, setLocation] = useState({ lat: 19.0760, lng: 72.8777 }); // Default: Mumbai
  const [isSearching, setIsSearching] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (embedded) {
      fetchAllDoctors();
    } else {
      // Try to get user's location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setLocation(loc);
            fetchDoctors(loc.lat, loc.lng);
          },
          () => fetchDoctors(location.lat, location.lng)
        );
      } else {
        fetchDoctors(location.lat, location.lng);
      }
    }
  }, [embedded]);

  const fetchAllDoctors = async () => {
    setLoading(true);
    setIsSearching(true);
    try {
      const res = await publicApi.getAllDoctors();
      setDoctors(res.data);
    } catch (err) {
      console.error('Failed to fetch all doctors:', err);
    } finally {
      setLoading(false);
      setIsSearching(false);
    }
  };

  const fetchDoctors = async (lat, lng) => {
    setLoading(true);
    setIsSearching(true);
    try {
      const res = await publicApi.getNearbyDoctors(lat, lng);
      setDoctors(res.data);
    } catch (err) {
      console.error('Failed to fetch doctors:', err);
    } finally {
      setLoading(false);
      setIsSearching(false);
    }
  };

  const filteredDoctors = doctors.filter(doctor =>
    doctor.basicInfo?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doctor.professionalInfo?.specialization?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // If embedded, try to boost or just show them as recommended
  const displayDoctors = React.useMemo(() => {
    let sorted = [...filteredDoctors];
    if (embedded && diagnosis) {
      try {
        let diagData = diagnosis;
        if (typeof diagnosis === 'string') {
          const raw = diagnosis.includes('---REPORT_DATA---') ? diagnosis.split('---REPORT_DATA---').pop() : diagnosis;
          const clean = raw.replace(/```json/g, '').replace(/```/g, '').trim();
          diagData = JSON.parse(clean);
        }
        // Safely extract treatments array
        let rawTreatments = diagData?.treatments;
        if (!rawTreatments) {
          rawTreatments = [diagData?.diagnosis?.name || ''];
        } else if (!Array.isArray(rawTreatments)) {
          // If the AI generated a string instead of an array
          rawTreatments = typeof rawTreatments === 'string' ? rawTreatments.split(',') : [diagData?.diagnosis?.name || ''];
        }

        const recommendedTreatments = rawTreatments.map(t => String(t).toLowerCase()).filter(t => t.trim().length > 0);

        const isMatch = (t, rt) => {
          t = t.trim(); rt = rt.trim();
          if (t === rt || t === 'all') return true;
          // Protect against short substrings like "ent" matching "treatment" or "supplement"
          if (t.length <= 3) return rt.split(/[^a-z0-9]/).includes(t);
          if (rt.length <= 3) return t.split(/[^a-z0-9]/).includes(rt);
          return rt.includes(t) || t.includes(rt);
        };

        if (recommendedTreatments.length > 0) {
          // 1. Strictly filter out doctors who don't have matching treatments
          sorted = sorted.filter((doc) => {
            const docTreatments = (doc.professionalInfo?.treatments || []).map(t => String(t).toLowerCase());
            const isGeneral = docTreatments.some(t => isMatch(t, 'general'));

            return isGeneral || docTreatments.some(t => recommendedTreatments.some(rt => isMatch(t, rt)));
          });

          // 2. Sort by match quality (most matches first)
          sorted = sorted.sort((a, b) => {
            const aTreatments = (a.professionalInfo?.treatments || []).map(t => String(t).toLowerCase());
            const bTreatments = (b.professionalInfo?.treatments || []).map(t => String(t).toLowerCase());

            // Check for partial matches or exact matches
            const aMatches = aTreatments.filter(t => recommendedTreatments.some(rt => isMatch(t, rt))).length;
            const bMatches = bTreatments.filter(t => recommendedTreatments.some(rt => isMatch(t, rt))).length;

            return bMatches - aMatches; // Highest match first
          });
        } else {
          // Absolute fallback if length is 0 (i.e. empty report): show empty state instead of ALL doctors.
          sorted = [];
        }
      } catch (err) {
        console.error("Diagnosis parse error in FindDoctors:", err);
        return []; // Prevents the 'displaying ALL doctors' silent bug
      }
    }
    return sorted;
  }, [filteredDoctors, embedded, diagnosis]);

  const handleBook = async (doctorId) => {
    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    const patientId = userData.id || userData._id;
    if (!patientId) {
      alert('You must be logged in to book an appointment.');
      return;
    }

    try {
      // Find the LATEST chat session that has a diagnosis to include in the booking
      let diagContent = 'General Consultation Inquiry';
      let diagTitle = 'Ayurvedic Checkup';

      try {
        const resp = await chatApi.getSessions(patientId);
        if (resp.data && resp.data.length > 0) {
          // Find the first session that has a diagnosis field
          const sessionWithDiag = resp.data.find(s => s.diagnosis);
          if (sessionWithDiag) {
            // Re-fetch regular session to get the full diagnosis text if needed, 
            // but the summary response might have it.
            diagContent = sessionWithDiag.diagnosis;
            diagTitle = sessionWithDiag.title || 'Clinical Synthesis';
          }
        }
      } catch (e) {
        console.warn("Failed to attach latest AI context:", e);
      }

      await publicApi.bookAppointment({
        doctorId,
        patientId,
        sessionData: {
          diagnosis: diagContent,
          title: diagTitle
        }
      });
      alert('Booking request sent! The doctor will confirm shortly.');
    } catch (err) {
      console.error('Failed to book:', err);
      alert('Booking failed. Please try again.');
    }
  };

  const handleMessage = async (doctorId) => {
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
    <div className={`h-full overflow-y-auto custom-scrollbar ${embedded ? 'px-2 py-4' : 'px-4 sm:px-6 md:px-8 lg:px-12 py-8'}`}>
      <div className={`${embedded ? 'w-full space-y-4' : 'max-w-[1240px] space-y-8'} mx-auto pb-20`}>
        {!embedded ? (
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-10 pb-4 border-b border-[#f0f1f3]">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-ayur-sage font-black uppercase text-[10px] tracking-[4px]">
                <MapPin size={14} />
                <span>Practitioner Finder</span>
              </div>
              <h1 className="text-4xl font-bold text-ayur-forest tracking-tighter">Nearby Specialists</h1>
              <p className="text-[#6d7b74] font-medium text-lg leading-snug">Connect with verified Ayurvedic doctors in your locality.</p>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative group/search min-w-[340px]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within/search:text-ayur-sage transition-colors" size={16} />
                <input
                  type="text"
                  placeholder="Search specialty or doctor name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-5 py-3 bg-[#f4f7f6] border border-transparent focus:border-ayur-sage/30 focus:bg-white rounded-full outline-none text-sm font-medium transition-all duration-300"
                />
              </div>
              <button className="p-3 bg-white border border-gray-100 text-gray-400 rounded-full hover:text-ayur-sage hover:border-ayur-sage transition-all shadow-sm active:scale-95 group">
                <Filter size={18} className="group-hover:rotate-12 transition-transform" />
              </button>
            </div>
          </header>
        ) : null}

        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4 animate-pulse">
            <Loader2 size={32} className="text-ayur-sage animate-spin" />
            <p className="text-xs font-black uppercase tracking-[3px] text-ayur-sage/40">Scanning nearby clinics...</p>
          </div>
        ) : displayDoctors.length === 0 ? (
          <div className={`col-span-full ${embedded ? 'py-10' : 'py-40'} bg-[#fbfcfc] border-2 border-dashed border-[#f0f1f3] rounded-[48px] flex flex-col items-center justify-center text-center space-y-4`}>
            {embedded ? <Star size={64} className="text-ayur-sage/10 mb-2" /> : <MapPin size={64} className="text-ayur-sage/10 mb-2" />}
            <h3 className="text-2xl font-bold text-ayur-forest">{embedded ? 'No specialists found' : 'No doctors found nearby'}</h3>
            <p className="text-gray-400 font-medium max-w-[320px]">{embedded ? 'We couldn\'t find practitioners offering the specific treatments recommended for your plan.' : 'We couldn\'t find any certified practitioners matching your location. Try expanding your search radius.'}</p>
          </div>
        ) : (
          <div className={`grid grid-cols-1 ${embedded ? '' : 'md:grid-cols-2 lg:grid-cols-3'} ${embedded ? 'gap-4' : 'gap-6'}`}>
            {displayDoctors.map((doctor, idx) => (
              <div key={doctor._id} className={`bg-white ${embedded ? 'p-5 rounded-3xl' : 'p-8 rounded-[40px]'} border border-[#f0f1f3] shadow-sm hover:shadow-2xl hover:shadow-ayur-sage/10 transition-all duration-500 relative overflow-hidden group animate-fade-in-up`} style={{ animationDelay: `${idx * 100}ms` }}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-ayur-sage/5 rounded-bl-[100px] -z-0 transition-transform group-hover:scale-125"></div>
                <div className="relative z-10 flex flex-col items-center text-center">
                  <div className={`${embedded ? 'w-16 h-16 rounded-2xl mb-3 ring-2' : 'w-24 h-24 rounded-[32px] mb-5 ring-4'} bg-gray-50 p-1 border border-gray-100 shadow-inner overflow-hidden relative ring-white shadow-xl transition-transform group-hover:scale-105 duration-500`}>
                    <User size={embedded ? 40 : 64} className={`text-gray-200 ${embedded ? 'mt-2' : 'mt-4'} mx-auto`} />
                    <div className="absolute inset-0 bg-gradient-to-tr from-ayur-sage/10 to-transparent"></div>
                    <div className={`absolute bottom-2 right-2 ${embedded ? 'w-3 h-3 border-2' : 'w-4 h-4 border-4'} bg-emerald-500 rounded-full border-white`}></div>
                  </div>

                  <div className={`space-y-1 ${embedded ? 'mb-4' : 'mb-6'}`}>
                    <div className="flex items-center justify-center gap-2">
                      <h3 className={`${embedded ? 'text-lg' : 'text-2xl'} font-bold text-ayur-forest tracking-tight leading-none truncate`}>Dr. {doctor.basicInfo?.name || 'Ayur Practitioner'}</h3>
                      <ShieldCheck size={embedded ? 14 : 18} className="text-emerald-500" />
                    </div>
                    <span className="text-[10px] font-black uppercase text-ayur-sage tracking-[2px] block">{doctor.professionalInfo?.specialization || 'Ayurvedic Specialist'}</span>
                  </div>

                  <div className={`flex items-center gap-6 ${embedded ? 'mb-5 py-3' : 'mb-8 py-4'} border-y border-gray-50 w-full justify-center`}>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] font-black uppercase text-[#aaaaaa] tracking-widest">Fees</span>
                      <span className={`${embedded ? 'text-sm' : 'text-base'} font-bold text-ayur-forest tracking-tight leading-none`}>₹{doctor.availability?.fees || 'N/A'}</span>
                    </div>
                    <div className="w-px h-6 bg-gray-100"></div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] font-black uppercase text-[#aaaaaa] tracking-widest">Experience</span>
                      <span className={`${embedded ? 'text-sm' : 'text-base'} font-bold text-ayur-forest tracking-tight leading-none`}>{doctor.professionalInfo?.experience || '5'}+ Yr</span>
                    </div>
                  </div>

                  <div className="w-full grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleMessage(doctor._id)}
                      className={`w-full bg-white border border-[#dfe7e3] text-[#2d4038] ${embedded ? 'py-3 rounded-[14px] text-[10px]' : 'py-4 rounded-3xl text-sm'} font-bold uppercase tracking-widest hover:bg-[#f7faf8] active:scale-95 transition-all flex items-center justify-center gap-2`}
                    >
                      <MessageSquare size={14} />
                      <span>Chat</span>
                    </button>
                    <button
                      onClick={() => handleBook(doctor._id)}
                      className={`w-full bg-[#2d4038] text-white ${embedded ? 'py-3 rounded-[14px] text-[10px]' : 'py-4 rounded-3xl text-sm'} font-bold uppercase tracking-widest shadow-xl shadow-[#2d4038]/20 hover:bg-[#1a231f] active:scale-95 transition-all flex items-center justify-center gap-2 group/btn`}
                    >
                      <span>Book</span>
                      <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FindDoctors;
