import { motion, AnimatePresence } from "motion/react";
import { LogIn, Activity, ShieldCheck, Sparkles, Brain, Search, Building2, ChevronRight, ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAssistant } from "../contexts/AssistantContext";
import { cn } from "../lib/utils";

interface Institution {
  _id: string;
  name: string;
  location?: string;
  logoUrl?: string;
}

export default function LoginPage() {
  const { user, login, loading: authLoading } = useAuth();
  const { theme } = useAssistant();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname || "/learntube";

  const [loginMode, setLoginMode] = useState<'entry' | 'institution-select'>('entry');
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInstitution, setSelectedInstitution] = useState<Institution | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      if (!user.onboardingCompleted) {
        navigate("/onboarding", { replace: true });
      } else {
        navigate(from, { replace: true });
      }
    }
  }, [user, navigate, from]);

  useEffect(() => {
    if (loginMode === 'institution-select') {
      fetch("/api/institutions")
        .then(res => res.json())
        .then(data => setInstitutions(data))
        .catch(err => console.error("Failed to fetch institutions", err));
    }
  }, [loginMode]);

  const handlePersonalLogin = async () => {
    setIsLoggingIn(true);
    setError(null);
    try {
      await login();
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleInstitutionalLogin = async (instId: string) => {
    setIsLoggingIn(true);
    setError(null);
    try {
      await login(instId);
    } catch (err: any) {
      setError(err.message || "Institutional login failed");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const filteredInstitutions = institutions.filter(inst => 
    inst.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inst.location?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (authLoading) {
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
        <AnimatePresence mode="wait">
          {loginMode === 'entry' ? (
            <motion.div
              key="entry"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-8"
            >
              <div className="text-center space-y-4">
                <div className="inline-flex p-4 rounded-3xl border mb-4 bg-theme-accent/10 border-theme-accent/20">
                  <Activity className="w-12 h-12 text-theme-accent" />
                </div>
                <h1 className="text-4xl font-black tracking-tighter text-theme-text">Welcome to Learn-Z 🚀</h1>
                <p className="text-lg text-theme-text-muted">Choose how you want to continue your learning journey</p>
              </div>

              <div className="space-y-4">
                <button 
                  onClick={handlePersonalLogin}
                  disabled={isLoggingIn}
                  className={cn(
                    "w-full flex items-center justify-between px-6 py-5 font-black rounded-2xl transition-all duration-300 group shadow-xl border border-theme-border bg-theme-card hover:border-theme-accent",
                    theme === 'light' ? "text-slate-900" : "text-white"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-theme-accent/10 flex items-center justify-center">
                      <Sparkles className="w-6 h-6 text-theme-accent" />
                    </div>
                    <div className="text-left">
                      <div className="text-sm">Continue as Individual</div>
                      <div className="text-[10px] uppercase tracking-widest text-theme-text-muted">Personal Account</div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-theme-text-muted group-hover:translate-x-1 transition-transform" />
                </button>

                <button 
                  onClick={() => setLoginMode('institution-select')}
                  disabled={isLoggingIn}
                  className={cn(
                    "w-full flex items-center justify-between px-6 py-5 font-black rounded-2xl transition-all duration-300 group shadow-xl border border-theme-border bg-theme-card hover:border-theme-accent",
                    theme === 'light' ? "text-slate-900" : "text-white"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-blue-500" />
                    </div>
                    <div className="text-left">
                      <div className="text-sm">Continue with Institution</div>
                      <div className="text-[10px] uppercase tracking-widest text-theme-text-muted">Organization Account</div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-theme-text-muted group-hover:translate-x-1 transition-transform" />
                </button>
              </div>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3"
                >
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-500 font-medium leading-relaxed">{error}</p>
                </motion.div>
              )}

              <div className="text-center">
                <button 
                  onClick={() => navigate("/")}
                  className="text-xs font-black uppercase tracking-widest text-theme-text-muted hover:text-theme-text transition-colors"
                >
                  Back to Home
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="institution-select"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => {
                    setLoginMode('entry');
                    setError(null);
                  }}
                  className="p-2 rounded-xl hover:bg-theme-card transition-colors text-theme-text-muted"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h2 className="text-2xl font-black tracking-tight text-theme-text">Select Your Institution</h2>
              </div>

              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-theme-text-muted" />
                <input 
                  type="text"
                  placeholder="Search institution by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 rounded-2xl border bg-theme-card border-theme-border text-theme-text focus:border-theme-accent outline-none transition-all"
                />
              </div>

              <div className="max-h-[400px] overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                {filteredInstitutions.length > 0 ? (
                  filteredInstitutions.map(inst => (
                    <button
                      key={inst._id}
                      onClick={() => handleInstitutionalLogin(inst._id)}
                      disabled={isLoggingIn}
                      className={cn(
                        "w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left group",
                        theme === 'light' ? "bg-white border-slate-200 hover:border-indigo-500" : "bg-white/5 border-white/10 hover:border-emerald-500"
                      )}
                    >
                      <div className="w-12 h-12 rounded-xl bg-theme-bg flex items-center justify-center overflow-hidden border border-theme-border">
                        {inst.logoUrl ? (
                          <img src={inst.logoUrl} alt={inst.name} className="w-full h-full object-cover" />
                        ) : (
                          <Building2 className="w-6 h-6 text-theme-text-muted" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-black text-sm text-theme-text truncate">{inst.name}</div>
                        {inst.location && <div className="text-[10px] text-theme-text-muted truncate">{inst.location}</div>}
                      </div>
                      {isLoggingIn ? (
                        <Loader2 className="w-5 h-5 animate-spin text-theme-accent" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-theme-text-muted group-hover:translate-x-1 transition-transform" />
                      )}
                    </button>
                  ))
                ) : (
                  <div className="text-center py-12 space-y-4">
                    <div className="w-16 h-16 rounded-full bg-theme-card flex items-center justify-center mx-auto">
                      <Search className="w-8 h-8 text-theme-text-muted opacity-20" />
                    </div>
                    <p className="text-sm text-theme-text-muted">No institutions found matching your search.</p>
                  </div>
                )}
              </div>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3"
                >
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <p className="text-xs text-red-500 font-medium leading-relaxed">{error}</p>
                    <button 
                      onClick={() => {
                        setLoginMode('entry');
                        setError(null);
                      }}
                      className="text-[10px] font-black uppercase tracking-widest text-red-500 hover:underline"
                    >
                      Switch to Personal Login
                    </button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-center text-[10px] uppercase tracking-[0.2em] font-black text-theme-text-muted/50">
          Secure Authentication Powered by Firebase
        </p>
      </motion.div>
    </div>
  );
}
