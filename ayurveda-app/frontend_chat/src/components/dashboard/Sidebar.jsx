import React, { useState, useEffect, useCallback } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  FileText,
  Calendar,
  MessageSquare,
  Search,
  User,
  LogOut,
  ChevronRight,
  Plus,
  Trash2,
  Clock,
  Activity,
  Sparkles
} from 'lucide-react';
import { chatApi } from '../../services/api';

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(280);

  const startResizingSidebar = useCallback((e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const onMouseMove = (moveEvent) => {
      const newWidth = startWidth + (moveEvent.clientX - startX);
      if (newWidth >= 240 && newWidth <= 500) setSidebarWidth(newWidth);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'default';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
  }, [sidebarWidth]);

  // Load sessions from API
  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) return;
    const userId = JSON.parse(userData).id || JSON.parse(userData)._id;

    const loadSessions = async () => {
      setLoading(true);
      try {
        const res = await chatApi.getSessions(userId);
        setSessions(res.data.slice(0, 10)); // Show recent 10
      } catch (err) {
        console.error('Failed to load sessions for sidebar:', err);
      } finally {
        setLoading(false);
      }
    };

    loadSessions();

    const handleRefresh = () => loadSessions();
    window.addEventListener('refresh-sessions', handleRefresh);
    window.addEventListener('storage', handleRefresh); // Catch login/logout
    return () => {
      window.removeEventListener('refresh-sessions', handleRefresh);
      window.removeEventListener('storage', handleRefresh);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  const clearSession = async (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await chatApi.deleteSession(id);
    } catch (err) {
      console.warn('Delete failed on server (likely already gone or ghost session), updating UI only:', err);
    } finally {
      // Always remove from local UI regardless of server response result (avoids 404 block)
      setSessions(sessions.filter(s => s._id !== id));
      if (location.pathname.includes(id)) {
        navigate('/chat');
      }
    }
  };

  const menuItems = [
    { name: 'Messages', icon: <MessageSquare size={18} />, path: '/messages' },
    { name: 'My Reports', icon: <FileText size={18} />, path: '/consultations' },
    { name: 'My Appointments', icon: <Calendar size={18} />, path: '/appointments' },
    { name: 'Find Doctors', icon: <Search size={18} />, path: '/find-doctors' },
  ];

  return (
    <aside style={{ width: `${sidebarWidth}px` }} className="flex-shrink-0 h-screen bg-white text-black flex flex-col font-sans border-r-2 border-gray-100 relative z-50 transition-none">
      <div
        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-ayur-sage/30 active:bg-ayur-sage/60 z-50 transition-colors"
        onMouseDown={startResizingSidebar}
      ></div>
      {/* Brand Header */}
      <div className="p-7 mb-4">
        <NavLink to="/chat" className="flex items-center gap-3.5 group">
          <div className="w-10 h-10 bg-white border-2 border-gray-100 rounded-2xl flex items-center justify-center text-black shadow-sm group-hover:scale-105 transition-all duration-300">
            <Activity size={22} strokeWidth={2.5} className="group-hover:rotate-6 transition-transform text-emerald-500" />
          </div>
          <div className="flex flex-col">
            <h1 className="font-black text-slate-900 text-[20px] tracking-tighter leading-none">AyurCare <span className="text-emerald-600 font-medium tracking-normal">ai</span></h1>
            <div className="flex items-center gap-1.5 mt-2">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_8px_#10b981]"></div>
              <span className="text-[10px] text-slate-500 font-bold tracking-tight">Clinical Portal</span>
            </div>
          </div>
        </NavLink>
      </div>

      {/* Action Button */}
      <div className="px-5 mb-8">
        <button
          onClick={() => {
            // Force navigate to chat and let it handle new session logic
            navigate('/chat', { state: { forceNew: true } });
            window.dispatchEvent(new CustomEvent('new-session-requested'));
          }}
          className="flex items-center justify-center gap-2.5 w-full py-3 bg-slate-900 hover:bg-black text-white rounded-lg transition-all duration-300 shadow-lg shadow-slate-900/20 group relative overflow-hidden active:scale-95"
        >
          <Plus size={18} strokeWidth={3} className="text-emerald-400" />
          <span className="font-bold text-sm tracking-tight">New Inquiry</span>
          <Sparkles size={14} className="text-emerald-400 ml-1" />
        </button>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 px-5 space-y-10 overflow-y-auto pb-10 custom-scrollbar scroll-smooth">
        {/* Top Links */}
        <nav className="space-y-2">
          <div className="px-3 mb-4 text-xs font-bold text-slate-400 tracking-tight">Main Directory</div>
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.name}
                to={item.path}
                className={`flex items-center justify-between px-5 py-3 rounded-lg transition-all duration-300 group border-2 ${isActive
                  ? 'bg-[#f1f7f4] border-transparent text-slate-900 shadow-sm'
                  : 'text-gray-400 border-transparent hover:bg-[#f8faf9] hover:text-black hover:border-gray-100'
                  }`}
              >
                <div className="flex items-center gap-4">
                  <span className={`transition-all duration-300 ${isActive ? 'scale-110 text-emerald-500' : 'group-hover:scale-110 group-hover:text-black'}`}>
                    {item.icon}
                  </span>
                  <span className="font-bold text-sm tracking-tight">{item.name}</span>
                </div>
                {isActive && <ChevronRight size={14} strokeWidth={3} className="text-emerald-600" />}
              </NavLink>
            );
          })}
        </nav>

        {/* Chat Sessions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-3">
            <span className="text-xs font-bold text-slate-400 tracking-tight">Recent Cases</span>
          </div>

          <div className="space-y-2 invisible-scrollbar font-medium">
            {sessions.map((session) => {
              const isActive = location.pathname.includes(session._id);
              return (
                <NavLink
                  key={session._id}
                  to={`/chat/${session._id}`}
                  className={`flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-300 group relative border-2 ${isActive
                    ? 'bg-[#f1f7f4] border-transparent text-slate-900 shadow-sm'
                    : 'text-gray-400 border-transparent hover:bg-[#f8faf9] hover:border-gray-100 hover:text-black'
                    }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                      <div className={`p-1.5 rounded-lg border-2 flex-shrink-0 transition-colors ${isActive ? 'bg-emerald-100/60 border-transparent text-emerald-700' : 'bg-white border-gray-100 group-hover:bg-gray-50 text-gray-400 group-hover:text-black'}`}>
                      <MessageSquare size={13} fill={isActive ? "currentColor" : "none"} strokeWidth={isActive ? 2 : 2.5} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-black text-[13px] truncate pr-1 tracking-tight">
                        {session.title || 'Anonymous Case...'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => clearSession(e, session._id)}
                    className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-500 transition-all rounded-lg hover:bg-red-50 active:scale-90"
                  >
                    <Trash2 size={13} strokeWidth={2.5} />
                  </button>
                </NavLink>
              )
            })}

            {loading && [1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-gray-50 rounded-[18px] animate-pulse mx-1 mb-2 border border-gray-100"></div>
            ))}
          </div>
        </div>
      </div>

      {/* Profile Section */}
      <div className="p-6 border-t-2 border-gray-50 bg-[#fafcfb] space-y-2">
        <button
          onClick={() => navigate('/profile')}
          className={`flex items-center gap-3 w-full px-5 py-3 rounded-lg transition-all text-sm font-medium tracking-tight border-2 active:scale-95 ${
            location.pathname === '/profile'
              ? 'bg-[#f1f7f4] border-transparent text-slate-900 shadow-sm'
              : 'text-slate-600 border-transparent hover:bg-[#f1f7f4] hover:text-slate-900 shadow-sm shadow-slate-200'
          }`}
        >
          <User size={16} strokeWidth={2.5} />
          <span>Update Profile</span>
        </button>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-5 py-3 text-red-500/80 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all text-sm font-bold tracking-tight border border-transparent hover:border-red-100 active:scale-95"
        >
          <LogOut size={16} />
          <span>Terminate Session</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
