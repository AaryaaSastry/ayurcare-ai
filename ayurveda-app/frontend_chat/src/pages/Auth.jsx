import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup';
    try {
      const payload = isLogin ? { email, password } : { email, password, name };
      const response = await axios.post(`http://localhost:5001${endpoint}`, payload);

      const { token, user } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      // Redirect to home (chat)
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card glass-morphism">
        <div className="auth-header">
          <div className="auth-logo">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="20" cy="20" r="18" fill="white" stroke="#4e6c61" strokeWidth="1.5" />
              <path
                d="M20 8V32M10 18C10 18 13 14 20 14C27 14 30 18 30 18M10 22C10 22 13 26 20 26C27 26 30 22 30 22"
                stroke="#4e6c61"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path
                d="M20 14L20 26M14 20H26"
                stroke="#4e6c61"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <h1>{isLogin ? 'Welcome Back' : 'Join AyurvedaBot'}</h1>
          <p>{isLogin ? 'Sign in to continue your consultation' : 'Start your journey to holistic health'}</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && (
            <div className="form-group">
              <label htmlFor="name">Full Name</label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                required={!isLogin}
              />
            </div>
          )}
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="auth-submit-btn bg-emerald-600 text-white" disabled={isLoading}>
            {isLoading ? (
              <span className="loader"></span>
            ) : (
              isLogin ? 'Sign In' : 'Create Account'
            )}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
            <button
              type="button"
              className="auth-toggle-btn"
              onClick={() => setIsLogin(!isLogin)}
            >
              {isLogin ? 'Sign Up' : 'Log In'}
            </button>
          </p>
        </div>
      </div>

      {/* Decorative Elements */}
      <div className="auth-decoration auth-decoration-1"></div>
      <div className="auth-decoration auth-decoration-2"></div>
    </div>
  );
};

export default Auth;
