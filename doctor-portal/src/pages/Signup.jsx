import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signupUser } from '../services/authService';
import FormInput from '../components/FormInput';
import { Stethoscope, UserPlus, Loader2, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

const Signup = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { user, error: signupError } = await signupUser(email, password);
    if (user) {
      navigate('/onboarding');
    } else {
      setError(signupError);
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-6 bg-gradient-to-br from-primary-50 to-white">
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md glass p-10 rounded-3xl shadow-2xl border border-white/50"
      >
        <div className="flex flex-col items-center gap-4 mb-10">
          <div className="h-16 w-16 bg-primary-100 rounded-2xl flex items-center justify-center border-2 border-white/50 shadow-inner">
            <Stethoscope className="h-8 w-8 text-primary-600" />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Join DocConnect</h1>
            <p className="text-slate-500 mt-2 font-medium">Register as a healthcare professional</p>
          </div>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="p-4 bg-red-50 text-red-600 rounded-xl mb-6 text-sm border border-red-100 flex items-center gap-3"
          >
            <div className="h-2 w-2 rounded-full bg-red-600 animate-pulse" />
            {error}
          </motion.div>
        )}

        <form onSubmit={handleSignup} className="space-y-6">
          <FormInput 
            label="Professional Email" 
            type="email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            placeholder="dr.smith@hospital.com"
            required
          />
          <FormInput 
            label="Secure Password" 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            placeholder="••••••••••••"
            required
          />
          <button 
            type="submit" 
            disabled={loading}
            className="w-full btn btn-primary py-4 flex items-center justify-center gap-2 group text-lg"
          >
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <UserPlus className="h-5 w-5" />
                <span>Create Professional Account</span>
                <ArrowRight className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity translate-x-1 group-hover:translate-x-2 duration-300" />
              </>
            )}
          </button>
        </form>

        <p className="text-center mt-8 text-slate-500 font-medium">
          Already a member?{' '}
          <Link to="/login" className="text-primary-600 hover:text-primary-700 font-bold decoration-2 underline-offset-4 hover:underline transition-all">
            Login here
          </Link>
        </p>
      </motion.div>
    </div>
  );
};

export default Signup;
