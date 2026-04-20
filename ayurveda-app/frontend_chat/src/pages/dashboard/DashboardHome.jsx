import React, { useState, useEffect } from 'react';
import {
  FileText,
  Calendar,
  CheckCircle2,
  MessageSquare,
  Eye,
  Download,
  Clock,
  MapPin,
  User,
  ArrowRight,
  TrendingUp,
  Activity,
  Heart,
  Loader2,
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { patientApi } from '../../services/api';
import { Link } from 'react-router-dom';

const DashboardHome = () => {
  const [stats, setStats] = useState({
    totalConsultations: 0,
    upcomingAppointments: 0,
    confirmedAppointments: 0,
    unreadMessages: 0,
  });

  const [recentReports, setRecentReports] = useState([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const [reportsRes, appointmentsRes] = await Promise.all([
          patientApi.getReports(),
          patientApi.getAppointments()
        ]);

        const reports = reportsRes.data;
        const appointments = appointmentsRes.data;

        setRecentReports(reports.slice(0, 3));
        setUpcomingAppointments(appointments.filter(a => a.status === 'pending' || a.status === 'confirmed').slice(0, 2));

        setStats({
          totalConsultations: reports.length,
          upcomingAppointments: appointments.filter(a => a.status === 'pending').length,
          confirmedAppointments: appointments.filter(a => a.status === 'confirmed').length,
          unreadMessages: 0, // Placeholder if no unread count available yet
        });
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6">
      <div className="relative">
        <div className="w-12 h-12 border-4 border-ayur-sage/10 border-t-ayur-sage rounded-full animate-spin"></div>
        <Activity size={16} className="absolute inset-0 m-auto text-ayur-sage animate-pulse" />
      </div>
      <p className="text-[10px] font-black text-ayur-sage/40 uppercase tracking-[4px]">Synthesizing health data...</p>
    </div>
  );

  return (
    <div className="h-full overflow-y-auto custom-scrollbar px-6 sm:px-8 md:px-12 py-10 bg-white">
      <div className="max-w-[1200px] mx-auto space-y-12">

        {/* Welcome Header */}
        <div className="relative overflow-hidden bg-[#f8faf9] border-2 border-gray-100 rounded-[40px] p-10 flex flex-col md:flex-row md:items-center justify-between gap-10">
          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-[400px] h-[400px] bg-ayur-sage/10 rounded-full blur-[100px] -z-10"></div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 text-black font-black uppercase text-[10px] tracking-[4px]">
              <Sparkles size={14} className="text-emerald-500" />
              <span>Personalized CareHub</span>
            </div>
            <h1 className="text-5xl font-black text-black tracking-tighter leading-none italic uppercase">Namaste, <span className="text-ayur-sage">Patient</span></h1>
            <p className="text-black font-semibold text-lg max-w-[500px] opacity-70">Everything looks balanced in your prakriti today. Remember to stay hydrated and mindful.</p>
          </div>

          <div className="flex items-center gap-4">
            <Link to="/chat" className="flex items-center gap-4 px-10 py-5 bg-black text-white rounded-[24px] font-black shadow-2xl shadow-black/20 hover:scale-[1.03] active:scale-95 transition-all group overflow-hidden relative">
              <span className="relative z-10 text-[13px] uppercase tracking-[2px]">Start New Inquiry</span>
              <Activity size={20} className="relative z-10 text-emerald-500" strokeWidth={3} />
            </Link>
            <Link to="/messages" className="flex items-center gap-4 px-8 py-5 bg-white border border-slate-200 text-slate-900 rounded-[24px] font-black shadow-sm hover:border-slate-300 active:scale-95 transition-all">
              <span className="text-[13px] uppercase tracking-[2px]">Doctor Chat</span>
              <MessageSquare size={18} className="text-emerald-600" strokeWidth={2.5} />
            </Link>
          </div>
        </div>

        {/* Main Content Grid Removed */}
      </div>
    </div>
  );
};

export default DashboardHome;
