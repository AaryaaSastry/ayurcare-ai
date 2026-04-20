import React, { useState, useEffect } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import Sidebar from '../../components/dashboard/Sidebar';
import Navbar from '../../components/dashboard/Navbar';
import { motion, AnimatePresence } from 'framer-motion';

const PatientDashboard = () => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const location = useLocation();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen bg-white overflow-hidden font-sans selection:bg-ayur-sage/20">
      {/* ChatGPT-style Fixed Sidebar */}
      <Sidebar />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative overflow-hidden">
        {/* Navigation Layer */}
        <Navbar
          patientName={user?.name || 'Patient'}
          onSearch={(val) => console.log('Searching for:', val)}
        />

        {/* Content Area - No outer scrollbar so pages can have fixed elements */}
        <main className="flex-1 h-full bg-[#fafafa] relative overflow-hidden">
          <div className="w-full h-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                className="w-full h-full"
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        {/* Global Floating Action removed as requested */}
      </div>
    </div>
  );
};

export default PatientDashboard;
