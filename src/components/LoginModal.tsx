import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, LogIn, Sparkles, ShieldCheck, BookOpen } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  message?: string;
}

export default function LoginModal({ isOpen, onClose, message }: LoginModalProps) {
  const { login } = useAuth();

  const handleLogin = async () => {
    await login();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-md bg-[#0D0D0D] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl"
          >
            <button 
              onClick={onClose}
              className="absolute top-6 right-6 p-2 hover:bg-white/5 rounded-full text-white/40 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>

            <div className="p-8 pt-12 text-center space-y-6">
              <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center mx-auto text-emerald-500">
                <Sparkles size={40} />
              </div>

              <div className="space-y-2">
                <h2 className="text-3xl font-black tracking-tight text-white">Join Learn-Z</h2>
                <p className="text-white/40 leading-relaxed">
                  {message || "Login to unlock personalized AI assistance, track your progress, and access the full classroom experience."}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 text-left py-4">
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                    <ShieldCheck size={18} />
                  </div>
                  <span className="text-sm font-medium text-white/60">Secure Role-Based Access</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                    <BookOpen size={18} />
                  </div>
                  <span className="text-sm font-medium text-white/60">Personalized Learning Paths</span>
                </div>
              </div>

              <button
                onClick={handleLogin}
                className="w-full flex items-center justify-center gap-3 px-8 py-5 bg-emerald-500 text-black font-black rounded-2xl hover:bg-emerald-400 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-emerald-500/20"
              >
                <LogIn size={24} />
                <span>Continue with Google</span>
              </button>

              <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold">
                By continuing, you agree to our Terms of Service
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
