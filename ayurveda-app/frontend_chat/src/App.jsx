import React, { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Chat from './Chat'
import Auth from './pages/Auth'
import PatientDashboard from './pages/dashboard/PatientDashboard'

import Consultations from './pages/dashboard/Consultations'
import Appointments from './pages/dashboard/Appointments'
import FindDoctors from './pages/dashboard/FindDoctors'
import Profile from './pages/dashboard/Profile'
import Messages from './pages/dashboard/Messages'

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token')
  if (!token) {
    return <Navigate to="/login" replace />
  }
  return children
}

export default function App() {
  const [, setIsAuthenticated] = useState(!!localStorage.getItem('token'))

  useEffect(() => {
    const handleStorageChange = () => {
      setIsAuthenticated(!!localStorage.getItem('token'))
    }
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  return (
    <Router>
      <div className="app-root h-screen w-screen overflow-hidden">
        <Routes>
          {/* Auth routes */}
          <Route
            path="/login"
            element={
              localStorage.getItem('token')
                ? <Navigate to="/chat" replace />
                : <Auth />
            }
          />
          <Route
            path="/signup"
            element={
              localStorage.getItem('token')
                ? <Navigate to="/chat" replace />
                : <Auth />
            }
          />

          {/* Protected Patient Dashboard routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <PatientDashboard />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/chat" replace />} />
            <Route path="consultations" element={<Consultations />} />
            <Route path="appointments" element={<Appointments />} />
            <Route path="find-doctors" element={<FindDoctors />} />
            <Route path="profile" element={<Profile />} />
            <Route path="messages" element={<Messages />} />
            <Route path="messages/:chatId" element={<Messages />} />
            <Route path="chat" element={<Chat />} />
            <Route path="chat/:sessionId" element={<Chat />} />
          </Route>

          {/* Catch-all */}
          <Route
            path="*"
            element={
              localStorage.getItem('token')
                ? <Navigate to="/chat" replace />
                : <Navigate to="/login" replace />
            }
          />
        </Routes>
      </div>
    </Router>
  )
}
