import { motion, AnimatePresence } from "motion/react";
import { LogIn, Activity, ShieldCheck, Sparkles, Brain, Search, Building2, ChevronRight, ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAssistant } from "../contexts/AssistantContext";
import { cn } from "../lib/utils";
import { apiFetch } from "../lib/api";

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

  const [loginStep, setLoginStep] = useState<'entry' | 'institution-select' | 'google-auth'>('entry');
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
    if (loginStep === 'institution-select') {
      apiFetch("/api/institutions")
        .then(res => res.json())
        .then(data => setInstitutions(data))
        .catch(err => console.error("Failed to fetch institutions", err));
    }
  }, [loginStep]);

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
        className="max-w-2xl w-full relative z-10"
      >
        <AnimatePresence mode="wait">
          {loginStep === 'entry' && (
            <motion.div
              key="entry"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="space-y-12"
            >
              <div className="text-center space-y-6">
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", damping: 12 }}
                  className="inline-flex p-5 rounded-[2.5rem] border bg-theme-accent/10 border-theme-accent/20 shadow-2xl shadow-theme-accent/10"
                >
                  <Activity className="w-16 h-16 text-theme-accent" />
                </motion.div>
                <div className="space-y-2">
                  <h1 className="text-5xl md:text-6xl font-black tracking-tighter text-theme-text">
                    Unlock Your Potential <br /> with <span className="text-theme-accent">Learn-Z</span>
                  </h1>
                  <p className="text-xl text-theme-text-muted max-w-lg mx-auto leading-relaxed">
                    The AI-powered learning platform that adapts to your unique journey. 
                    Choose your path to get started.
                  </p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <motion.button 
                  whileHover={{ y: -8, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setLoginStep('google-auth')}
                  className={cn(
                    "flex flex-col items-start p-8 rounded-[2rem] border transition-all duration-500 text-left group relative overflow-hidden",
                    theme === 'light' ? "bg-white border-slate-200 hover:border-theme-accent" : "bg-white/5 border-white/10 hover:border-theme-accent"
                  )}
                >
                  <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Sparkles className="w-24 h-24 text-theme-accent" />
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-theme-accent/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <Sparkles className="w-7 h-7 text-theme-accent" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black text-theme-text">Personal Login</h3>
                    <p className="text-sm text-theme-text-muted leading-relaxed">
                      For individual learners looking for a personalized AI-driven curriculum.
                    </p>
                  </div>
                  <div className="mt-8 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-theme-accent opacity-0 group-hover:opacity-100 transition-all">
                    Get Started <ChevronRight className="w-4 h-4" />
                  </div>
                </motion.button>

                <motion.button 
                  whileHover={{ y: -8, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setLoginStep('institution-select')}
                  className={cn(
                    "flex flex-col items-start p-8 rounded-[2rem] border transition-all duration-500 text-left group relative overflow-hidden",
                    theme === 'light' ? "bg-white border-slate-200 hover:border-blue-500" : "bg-white/5 border-white/10 hover:border-blue-500"
                  )}
                >
                  <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Building2 className="w-24 h-24 text-blue-500" />
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <Building2 className="w-7 h-7 text-blue-500" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black text-theme-text">Institutional Login</h3>
                    <p className="text-sm text-theme-text-muted leading-relaxed">
                      Connect with your school or organization to access shared resources.
                    </p>
                  </div>
                  <div className="mt-8 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-blue-500 opacity-0 group-hover:opacity-100 transition-all">
                    Find Institution <ChevronRight className="w-4 h-4" />
                  </div>
                </motion.button>
              </div>

              <div className="text-center">
                <button 
                  onClick={() => navigate("/")}
                  className="text-xs font-black uppercase tracking-widest text-theme-text-muted hover:text-theme-text transition-colors"
                >
                  Back to Home
                </button>
              </div>
            </motion.div>
          )}

          {loginStep === 'google-auth' && (
            <motion.div
              key="google-auth"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-md mx-auto w-full space-y-8 text-center"
            >
              <div className="space-y-6">
                <button 
                  onClick={() => setLoginStep('entry')}
                  className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-theme-text-muted hover:text-theme-text transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Go Back
                </button>
                <div className="space-y-2">
                  <h2 className="text-4xl font-black tracking-tight text-theme-text">Sign In</h2>
                  <p className="text-theme-text-muted">Continue with your Google account to access Learn-Z</p>
                </div>
              </div>

              <div className="p-8 rounded-[2.5rem] border bg-theme-card border-theme-border shadow-2xl space-y-6">
                <div className="w-20 h-20 mx-auto rounded-3xl bg-theme-accent/10 flex items-center justify-center mb-4">
                  <LogIn className="w-10 h-10 text-theme-accent" />
                </div>

                <button
                  onClick={selectedInstitution ? () => handleInstitutionalLogin(selectedInstitution._id) : handlePersonalLogin}
                  disabled={isLoggingIn}
                  className={cn(
                    "w-full flex items-center justify-center gap-4 px-8 py-5 rounded-2xl font-black transition-all shadow-xl disabled:opacity-50 relative overflow-hidden group",
                    theme === 'light' ? "bg-slate-900 text-white" : "bg-white text-black"
                  )}
                >
                  {isLoggingIn ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      <svg className="w-6 h-6" viewBox="0 0 24 24">
                        <path
                          fill="currentColor"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="currentColor"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      Sign in with Google
                    </>
                  )}
                </button>

                {error && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-left"
                  >
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-500 font-medium leading-relaxed">{error}</p>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

          {loginStep === 'institution-select' && (
            <motion.div
              key="institution-select"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-xl mx-auto w-full space-y-8"
            >
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => {
                    setLoginStep('entry');
                    setError(null);
                  }}
                  className="p-3 rounded-2xl hover:bg-theme-card transition-colors text-theme-text-muted border border-transparent hover:border-theme-border"
                >
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <div className="space-y-1">
                  <h2 className="text-3xl font-black tracking-tight text-theme-text">Select Institution</h2>
                  <p className="text-sm text-theme-text-muted">Search and select your organization to continue</p>
                </div>
              </div>

              <div className="relative group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-theme-text-muted group-focus-within:text-theme-accent transition-colors" />
                <input 
                  type="text"
                  placeholder="Search institution by name or location..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-14 pr-6 py-5 rounded-[2rem] border bg-theme-card border-theme-border text-theme-text focus:border-theme-accent outline-none transition-all shadow-xl"
                />
              </div>

              <div className="max-h-[450px] overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                {filteredInstitutions.length > 0 ? (
                  filteredInstitutions.map(inst => (
                    <motion.button
                      key={inst._id}
                      whileHover={{ scale: 1.01, x: 4 }}
                      onClick={() => {
                        setSelectedInstitution(inst);
                        setLoginStep('google-auth');
                      }}
                      disabled={isLoggingIn}
                      className={cn(
                        "w-full flex items-center gap-5 p-5 rounded-[1.5rem] border transition-all text-left group",
                        theme === 'light' ? "bg-white border-slate-200 hover:border-blue-500" : "bg-white/5 border-white/10 hover:border-blue-500"
                      )}
                    >
                      <div className="w-16 h-16 rounded-2xl bg-theme-bg flex items-center justify-center overflow-hidden border border-theme-border group-hover:border-blue-500/50 transition-colors">
                        {inst.logoUrl ? (
                          <img src={inst.logoUrl} alt={inst.name} className="w-full h-full object-cover" />
                        ) : (
                          <Building2 className="w-8 h-8 text-theme-text-muted" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-black text-lg text-theme-text truncate">{inst.name}</div>
                        {inst.location && (
                          <div className="flex items-center gap-1.5 text-xs text-theme-text-muted truncate mt-1">
                            <Activity className="w-3 h-3" /> {inst.location}
                          </div>
                        )}
                      </div>
                      <ChevronRight className="w-6 h-6 text-theme-text-muted group-hover:translate-x-1 transition-transform" />
                    </motion.button>
                  ))
                ) : (
                  <div className="text-center py-16 space-y-4">
                    <div className="w-20 h-20 rounded-3xl bg-theme-card flex items-center justify-center mx-auto border border-theme-border">
                      <Search className="w-10 h-10 text-theme-text-muted opacity-20" />
                    </div>
                    <p className="text-theme-text-muted">No institutions found matching your search.</p>
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
                        setLoginStep('entry');
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
