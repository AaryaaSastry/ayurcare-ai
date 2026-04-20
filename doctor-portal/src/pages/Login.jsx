import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginUser } from '../services/authService';
import FormInput from '../components/FormInput';
import { LogIn, Loader2, Hospital } from 'lucide-react';
import { motion } from 'framer-motion';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { user, error: loginError } = await loginUser(email, password);
    
    if (user) {
      // Check onboarding status directly from the user object returned by MongoDB
      if (user.isOnboarded) {
        navigate('/dashboard');
      } else {
        navigate('/onboarding');
      }
    } else {
      setError(loginError);
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-6 bg-gradient-to-br from-primary-50 to-white">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md glass p-10 rounded-3xl shadow-2xl border border-white/50"
      >
        <div className="flex flex-col items-center gap-4 mb-10">
          <div className="h-16 w-16 bg-primary-100/50 rounded-full flex items-center justify-center border-2 border-white shadow-lg overflow-hidden relative group">
            <Hospital className="h-8 w-8 text-primary-600 transition-transform group-hover:scale-110" />
            <div className="absolute inset-0 bg-primary-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">DocConnect</h1>
            <p className="text-slate-500 mt-2 font-medium italic">Welcome back, Doctor</p>
          </div>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-red-50 text-red-600 rounded-xl mb-6 text-sm border border-red-100 flex items-center gap-3"
          >
            <div className="h-2 w-2 rounded-full bg-red-600 animate-pulse" />
            {error}
          </motion.div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <FormInput 
            label="Email Address" 
            type="email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            placeholder="dr.miller@hospital.com"
            required
          />
          <FormInput 
            label="Password" 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            placeholder="••••••••••••"
            required
          />
          <button 
            type="submit" 
            disabled={loading}
            className="w-full btn btn-primary py-4 flex items-center justify-center gap-2 text-lg shadow-lg shadow-primary-500/20"
          >
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <LogIn className="h-5 w-5" />
                <span>Login to Portal</span>
              </>
            )}
          </button>
        </form>

        <p className="text-center mt-8 text-slate-500 font-medium">
          New to the portal?{' '}
          <Link to="/signup" className="text-primary-600 hover:text-primary-700 font-bold decoration-2 underline-offset-4 hover:underline transition-all">
            Join Now
          </Link>
        </p>
      </motion.div>
    </div>
  );
};

export default Login;
