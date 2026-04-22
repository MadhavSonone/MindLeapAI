import { useState } from 'react';
import { useUserStore } from '../store/useStore';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Loader2, Zap, Shield } from 'lucide-react';
import axios from 'axios';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const { setToken, setUserId, setUserName, setIsOnboarded } = useUserStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const url = isLogin ? 'http://localhost:8000/auth/login' : 'http://localhost:8000/auth/register';

    try {
      const res = await axios.post(url, formData);
      setToken(res.data.token);
      setUserId(res.data.user_id);
      setUserName(res.data.email.split('@')[0]); 
      setIsOnboarded(res.data.is_onboarded);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Authentication Failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen bg-white flex items-center justify-center p-8">
      <div className="max-w-md w-full">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-12"
        >
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-black flex items-center justify-center mb-8">
              <Shield size={32} className="text-white" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-300">AUTHENTICATION</span>
            <h1 className="text-4xl font-black uppercase tracking-tighter mt-2 leading-none">
              {isLogin ? 'LOG IN.' : 'SIGN UP.'}
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <input
                type="email"
                required
                className="w-full text-2xl font-bold border-b-2 border-neutral-200 focus:border-black outline-none py-4 text-black placeholder:text-neutral-400 transition-colors"
                placeholder="Email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
              <input
                type="password"
                required
                className="w-full text-2xl font-bold border-b-2 border-neutral-200 focus:border-black outline-none py-4 text-black placeholder:text-neutral-400 transition-colors"
                placeholder="Password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>

            {error && (
              <p className="text-[10px] font-black uppercase text-red-500 tracking-widest text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-minimal w-full flex items-center justify-between group"
            >
              <span>{isLogin ? 'Log In' : 'Sign Up'}</span>
              {loading ? <Loader2 className="animate-spin" size={14} /> : <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />}
            </button>
          </form>

          <div className="text-center pt-8 border-t border-neutral-50">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 hover:text-black transition-colors"
            >
              {isLogin ? "Don't have an identity? [ REGISTER ]" : "Already verified? [ LOGIN ]"}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Auth;
