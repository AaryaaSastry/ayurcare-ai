import axios from 'axios';

const API_BASE_URL = 'http://localhost:5001/api';
const CHAT_API_BASE_URL = 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Add a request interceptor to include the JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Create a separate instance for chat API with token support
const chatApiInstance = axios.create({
  baseURL: CHAT_API_BASE_URL,
});

chatApiInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export const patientApi = {
  getReports: () => api.get('/patient/reports'),
  getAppointments: () => api.get('/patient/appointments'),
  updateProfile: (data) => api.patch('/patient/profile', data),
  hideAppointment: (id) => api.delete(`/patient/appointments/${id}`),
  deleteReport: (id) => api.delete(`/patient/reports/${id}`),
};

export const publicApi = {
  getNearbyDoctors: (lat, lng) => api.get(`/public/doctors/nearby?lat=${lat}&lng=${lng}`),
  getAllDoctors: () => api.get('/public/doctors/nearby?all=true'),
  getDoctorAvailability: (id) => api.get(`/public/doctors/${id}/availability`),
  bookAppointment: (data) => api.post('/public/appointments/book', data),
};

export const doctorChatApi = {
  listChats: () => api.get('/chat/list'),
  initiateChat: ({ doctorId, userId }) => api.post('/chat/initiate', { doctorId, userId }),
  getMessages: (chatId) => api.get(`/chat/${chatId}/messages`),
  sendMessage: ({ chatId, message, doctorId, userId }) => api.post('/chat/messages', { chatId, message, doctorId, userId }),
  markRead: (chatId) => api.patch(`/chat/${chatId}/read`),
  deleteChat: (chatId) => api.delete(`/chat/${chatId}`),
  createNegotiation: ({ chatId, date, time, amount, mode }) => api.post('/chat/negotiations', { chatId, date, time, amount, mode }),
  acceptNegotiation: (negotiationId) => api.post(`/chat/negotiations/${negotiationId}/accept`),
  counterNegotiation: ({ negotiationId, date, time, amount, mode }) => api.post(`/chat/negotiations/${negotiationId}/counter`, { date, time, amount, mode }),
};

// Chat API (FastAPI with JWT auth)
export const chatApi = {
  getSessions: (userId) => chatApiInstance.get(`/api/chat/sessions/${userId}`),
  getSession: (sessionId) => chatApiInstance.get(`/api/chat/session/${sessionId}`),
  createSession: (userId) => chatApiInstance.post(`/api/chat/create`, { userId }),
  deleteSession: (sessionId) => chatApiInstance.delete(`/api/chat/session/${sessionId}`),
  ask: (sessionId, message, diagnosis) => chatApiInstance.post(`/ask?user_id=${encodeURIComponent(sessionId)}`, { message, diagnosis }),
  getRecipes: (sessionId, diagnosis) => chatApiInstance.post(`/recipes?user_id=${encodeURIComponent(sessionId)}`, { diagnosis }),
};

export default api;
