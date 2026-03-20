import { motion } from "motion/react";
import { LogIn, Activity, ShieldCheck, Sparkles, Brain } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useAssistant } from "../contexts/AssistantContext";
import { cn } from "../lib/utils";

export default function LoginPage() {
  const { user, login, loading } = useAuth();
  const { theme } = useAssistant();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname || "/learntube";

  useEffect(() => {
    if (user) {
      if (!user.onboardingCompleted) {
        navigate("/onboarding", { replace: true });
      } else {
        navigate(from, { replace: true });
      }
    }
  }, [user, navigate, from]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-theme-bg">
        <div className="w-12 h-12 border-4 rounded-full animate-spin border-theme-accent/20 border-t-theme-accent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden transition-colors duration-500 bg-theme-bg">
      {/* Background Glows */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 blur-[120px] rounded-full opacity-20 bg-theme-accent/10" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 blur-[120px] rounded-full opacity-20 bg-blue-500/10" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full space-y-8 relative z-10"
      >
        <div className="text-center space-y-4">
          <div className="inline-flex p-4 rounded-3xl border mb-4 bg-theme-accent/10 border-theme-accent/20">
            <Activity className="w-12 h-12 text-theme-accent" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-theme-text">Welcome to Learn-Z</h1>
          <p className="text-lg text-theme-text-muted">Your personalized AI-driven learning ecosystem awaits. Sign in to continue your journey.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {[
            { icon: Sparkles, label: "AI Assistant" },
            { icon: Brain, label: "Neural Core" },
            { icon: ShieldCheck, label: "Admin Tools" },
            { icon: Activity, label: "Smart Progress" }
          ].map((item, i) => (
            <div key={i} className="p-4 border rounded-2xl flex flex-col items-center gap-2 bg-theme-card border-theme-border">
              <item.icon className="w-5 h-5 text-theme-accent" />
              <span className="text-[10px] font-black uppercase tracking-widest text-theme-text-muted">{item.label}</span>
            </div>
          ))}
        </div>

        <div className="space-y-4 pt-4">
          <button 
            onClick={login}
            className={cn(
              "w-full flex items-center justify-center gap-3 px-8 py-4 font-black rounded-2xl transition-all duration-300 group shadow-xl bg-theme-accent shadow-theme-accent/20",
              theme === 'light' ? "text-white hover:bg-indigo-700" : "text-black hover:bg-emerald-400"
            )}
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5 group-hover:scale-110 transition-transform" />
            Continue with Google
          </button>
          
          <button 
            onClick={() => navigate("/")}
            className="w-full py-4 font-bold transition-colors text-theme-text-muted hover:text-theme-text"
          >
            Back to Home
          </button>
        </div>

        <p className="text-center text-[10px] uppercase tracking-[0.2em] font-black text-theme-text-muted/50">
          Secure Authentication Powered by Firebase
        </p>
      </motion.div>
    </div>
  );
}
