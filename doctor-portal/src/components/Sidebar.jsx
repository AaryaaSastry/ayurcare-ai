import {
  Home,
  User,
  LogOut,
  Stethoscope,
  ChevronRight,
  Calendar,
  Coffee,
  History,
  MessageSquare
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { logoutUser } from '../services/authService';
import { doctorService } from '../services/api';
import { useState, useEffect } from 'react';

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [onLeave, setOnLeave] = useState(false);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    doctorService.getProfile().then(profile => {
      if (profile) setOnLeave(!!profile.onLeave);
    }).catch(() => { });
  }, []);

  const toggleLeave = async () => {
    if (toggling) return;
    setToggling(true);
    try {
      const result = await doctorService.toggleLeave();
      if (result.success) {
        setOnLeave(result.onLeave);
      }
    } catch (err) {
      console.error('Toggle error:', err);
    }
    setToggling(false);
  };

  const menuItems = [
    { id: 'home', label: 'Home', icon: Home, path: '/dashboard' },
    { id: 'schedule', label: 'My Schedule', icon: Calendar, path: '/schedule' },
    { id: 'messages', label: 'Chat', icon: MessageSquare, path: '/messages' },
    { id: 'registry', label: 'Clinical Registry', icon: History, path: '/registry' },
    { id: 'profile', label: 'My Profile', icon: User, path: '/profile' },
  ];

  const handleLogout = () => {
    logoutUser();
    navigate('/login');
  };

  return (
    <div className="h-screen w-72 bg-white border-r border-slate-100 flex flex-col pt-10 pb-8 fixed left-0 top-0 z-50 shadow-sm">
      {/* BRANDING */}
      <div className="px-10 mb-14 flex items-center gap-3.5">
        <div className="h-11 w-11 bg-[#82a18d] rounded-xl flex items-center justify-center shadow-lg shadow-[#82a18d]/20">
          <Stethoscope className="h-6 w-6 text-white" />
        </div>
        <span className="text-2xl font-black text-black tracking-tighter">DocConnect</span>
      </div>

      {/* NAVIGATION */}
      <nav className="flex-1 px-6 space-y-1.5">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname.startsWith(item.path);

          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center justify-between px-5 py-4 rounded-xl transition-all duration-200 group ${isActive
                ? 'bg-[#82a18d] text-white shadow-md shadow-[#82a18d]/20'
                : 'text-black hover:bg-[#82a18d]/5 hover:text-[#82a18d]'
                }`}
            >
              <div className="flex items-center gap-4">
                <Icon className={`h-5 w-5 ${isActive ? 'text-white' : 'text-black group-hover:scale-105 transition-transform'}`} />
                <span className={`text-sm font-bold tracking-tight ${isActive ? 'text-white' : 'text-black'}`}>
                  {item.label}
                </span>
              </div>
              {isActive && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
            </button>
          );
        })}
      </nav>

      {/* LEAVE TOGGLE */}
      <div className="px-6 mb-4">
        <button
          onClick={toggleLeave}
          disabled={toggling}
          className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl border transition-all duration-300 ${onLeave 
            ? 'bg-amber-50 border-amber-200 text-amber-700' 
            : 'bg-[#82a18d]/5 border-[#82a18d]/10 text-black'}`}
        >
          <div className="flex items-center gap-3">
            <Coffee size={18} className={onLeave ? 'animate-bounce' : ''} />
            <span className="text-xs font-black uppercase tracking-widest text-black">
              {onLeave ? 'On Break' : 'Available'}
            </span>
          </div>
          <div className={`w-10 h-5 rounded-full relative transition-colors duration-300 ${onLeave ? 'bg-amber-400' : 'bg-[#82a18d]'}`}>
            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 ${onLeave ? 'left-6' : 'left-1'}`} />
          </div>
        </button>
      </div>

      {/* LOGOUT */}
      <div className="px-6">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-4 px-5 py-4 rounded-xl text-red-500 hover:bg-red-500/5 transition-colors group"
        >
          <LogOut className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-bold tracking-tight">Logout Platform</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
