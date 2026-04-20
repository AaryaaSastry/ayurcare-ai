import React from 'react';
import { useNavigate } from 'react-router-dom';
import { logoutUser } from '../services/authService';
import { Stethoscope, LogOut } from 'lucide-react';

const Navbar = ({ user }) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logoutUser();
    navigate('/login');
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-16 glass flex items-center justify-between px-6 border-b border-white/20">
      <div className="flex items-center gap-2 text-primary-600 font-bold text-xl">
        <Stethoscope className="h-6 w-6" />
        <span>DocConnect</span>
      </div>

      {user && (
        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 text-slate-600 hover:text-red-500 transition-colors font-medium px-4 py-2 rounded-lg hover:bg-red-50"
        >
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </button>
      )}
    </nav>
  );
};

export default Navbar;
