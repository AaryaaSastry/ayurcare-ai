const API_URL = 'http://localhost:5001/api';

/**
 * AUTH SERVICE
 */
export const authService = {
  // Signup
  signup: async (email, password) => {
    try {
      const response = await fetch(`${API_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Signup failed');

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      return { user: data.user, error: null };
    } catch (err) {
      return { user: null, error: err.message };
    }
  },

  // Login
  login: async (email, password) => {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Login failed');

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      return { user: data.user, error: null };
    } catch (err) {
      return { user: null, error: err.message };
    }
  },

  // Logout
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  // Get Current User (Local)
  getCurrentUser: () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  // Verify Auth with Backend
  verifyAuth: async () => {
    const token = localStorage.getItem('token');
    if (!token) return null;
    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) return await response.json();
      return null;
    } catch (err) {
      return null;
    }
  }
};

/**
 * DOCTOR SERVICE
 */
export const doctorService = {
  // Get Doctor Profile
  getProfile: async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_URL}/doctor/profile?t=${Date.now()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });
      if (response.ok) return await response.json();
      return null;
    } catch (err) {
      return null;
    }
  },

  updateProfile: async (formData) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_URL}/doctor/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Profile update failed');
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  toggleLeave: async () => {
    const token = localStorage.getItem('token');
    try {
      // Try dedicated toggle endpoint first
      const response = await fetch(`${API_URL}/doctor/leave-toggle`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      });
      if (response.ok) {
        const data = await response.json();
        return { success: true, onLeave: data.onLeave };
      }
      // Fallback: use profile endpoint
      throw new Error('Toggle endpoint not available');
    } catch (err) {
      // Fallback: read current state then toggle via profile endpoint
      try {
        const profileRes = await fetch(`${API_URL}/doctor/profile`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (profileRes.ok) {
          const profile = await profileRes.json();
          const newVal = !profile.onLeave;
          const updateRes = await fetch(`${API_URL}/doctor/profile`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ onLeave: newVal }),
          });
          if (updateRes.ok) {
            return { success: true, onLeave: newVal };
          }
        }
        return { success: false, error: 'Failed to update leave status' };
      } catch (fallbackErr) {
        return { success: false, error: fallbackErr.message };
      }
    }
  },

  // Onboarding
  onboard: async (formData) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_URL}/doctor/onboarding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Onboarding failed');

      // Update local storage status
      const user = JSON.parse(localStorage.getItem('user'));
      user.isOnboarded = true;
      localStorage.setItem('user', JSON.stringify(user));

      return { success: true, error: null };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // Get Appointments (Leads)
  getAppointments: async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_URL}/doctor/appointments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) return await response.json();
      return [];
    } catch (err) {
      return [];
    }
  },

  // Update Status
  updateAppointmentStatus: async (appointmentId, status) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_URL}/appointments/${appointmentId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status }),
      });
      return response.ok;
    } catch (err) {
      return false;
    }
  },

  // Update Appointment (General)
  updateAppointment: async (appointmentId, updateData) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_URL}/appointments/${appointmentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updateData),
      });
      return response.ok;
    } catch (err) {
      return false;
    }
  }
};

export const doctorChatService = {
  listChats: async () => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/chat/list`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to load chats');
    return response.json();
  },

  initiateChat: async ({ userId }) => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/chat/initiate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ userId }),
    });
    if (!response.ok) throw new Error('Failed to initiate chat');
    return response.json();
  },

  getMessages: async (chatId) => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/chat/${chatId}/messages`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to load messages');
    return response.json();
  },

  sendMessage: async ({ chatId, message, userId }) => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/chat/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ chatId, message, userId }),
    });
    if (!response.ok) throw new Error('Failed to send message');
    return response.json();
  },

  markRead: async (chatId) => {
    const token = localStorage.getItem('token');
    await fetch(`${API_URL}/chat/${chatId}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  createNegotiation: async ({ chatId, date, time, amount, mode }) => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/chat/negotiations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ chatId, date, time, amount, mode }),
    });
    if (!response.ok) throw new Error('Failed to create negotiation');
    return response.json();
  },

  acceptNegotiation: async (negotiationId) => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/chat/negotiations/${negotiationId}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to accept negotiation');
    return response.json();
  },

  counterNegotiation: async ({ negotiationId, date, time, amount, mode }) => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/chat/negotiations/${negotiationId}/counter`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ date, time, amount, mode }),
    });
    if (!response.ok) throw new Error('Failed to counter negotiation');
    return response.json();  },
  deleteChat: async (chatId) => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/chat/${chatId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to delete chat');
    return response.json();  }
};
