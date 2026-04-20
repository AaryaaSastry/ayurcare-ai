import { authService } from './api';

export const signupUser = async (email, password) => {
  return await authService.signup(email, password);
};

export const loginUser = async (email, password) => {
  return await authService.login(email, password);
};

export const logoutUser = () => {
  authService.logout();
  return { error: null };
};

export const subscribeToAuthChanges = (callback) => {
  // Simple periodic check for login status or local storage monitor
  // This replaces onAuthStateChanged for our simple MongoDB setup
  const interval = setInterval(() => {
    callback(authService.getCurrentUser());
  }, 1000);
  callback(authService.getCurrentUser());
  return () => clearInterval(interval);
};
