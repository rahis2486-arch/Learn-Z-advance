import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronRight, 
  ChevronLeft, 
  Sparkles, 
  User as UserIcon, 
  Globe, 
  Youtube, 
  Share2, 
  Users, 
  Megaphone, 
  MoreHorizontal,
  Code,
  Brain,
  Briefcase,
  DollarSign,
  Palette,
  TrendingUp,
  Heart,
  Gamepad2,
  BookOpen,
  Video,
  MousePointer2,
  Target,
  Rocket,
  Loader2,
  Check
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useAssistant } from '../contexts/AssistantContext';

const STEPS = [
  'Welcome',
  'Basic Info',
  'Discovery',
  'Interests',
  'Goals & Commitment',
  'Completion'
];

export default function OnboardingPage() {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const { theme } = useAssistant();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    displayName: user?.displayName || '',
    age: '',
    country: '',
    discoverySource: '',
    interests: [] as string[],
    primaryGoal: '',
    customGoal: '',
    dailyCommitment: ''
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
    if (user?.onboardingCompleted) {
      navigate('/learntube');
    }
  }, [user, authLoading, navigate]);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      navigate('/learntube');
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/users/${user?.uid}/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          age: formData.age ? parseInt(formData.age) : undefined,
          onboardingCompleted: true
        })
      });

      if (res.ok) {
        await refreshUser();
        handleNext();
      } else {
        setIsSubmitting(false);
        alert("Failed to save onboarding data. Please try again.");
      }
    } catch (error) {
      console.error("Onboarding error:", error);
      setIsSubmitting(false);
      alert("An error occurred. Please try again.");
    }
  };

  const toggleInterest = (value: string) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.includes(value)
        ? prev.interests.filter(i => i !== value)
        : [...prev.interests, value]
    }));
  };

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  if (authLoading || !user) return null;

  return (
    <div className={cn(
      "min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden transition-colors duration-500",
      theme === 'light' ? "bg-slate-50" : "bg-[#050505]"
    )}>
      {/* Background Glows */}
      <div className={cn(
        "absolute top-1/4 -left-20 w-96 h-96 blur-[120px] rounded-full opacity-20",
        theme === 'light' ? "bg-indigo-500/10" : "bg-emerald-500/10"
      )} />
      <div className={cn(
        "absolute bottom-1/4 -right-20 w-96 h-96 blur-[120px] rounded-full opacity-20",
        theme === 'light' ? "bg-blue-500/10" : "bg-blue-500/10"
      )} />

      {/* Progress Bar */}
      <div className="fixed top-0 left-0 w-full h-1 bg-white/5 z-50">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          className={cn(
            "h-full transition-all duration-500",
            theme === 'light' ? "bg-indigo-600" : "bg-emerald-500"
          )}
        />
      </div>

      <div className="max-w-xl w-full relative z-10">
        <AnimatePresence mode="wait">
          {currentStep === 0 && (
            <motion.div 
              key="step0"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center space-y-8"
            >
              <div className={cn(
                "w-20 h-20 mx-auto rounded-3xl flex items-center justify-center border",
                theme === 'light' ? "bg-indigo-500/10 border-indigo-500/20" : "bg-emerald-500/10 border-emerald-500/20"
              )}>
                <Rocket className={cn("w-10 h-10", theme === 'light' ? "text-indigo-600" : "text-emerald-500")} />
              </div>
              <div className="space-y-4">
                <h1 className={cn(
                  "text-5xl font-black tracking-tighter",
                  theme === 'light' ? "text-slate-900" : "text-white"
                )}>Welcome to Learn-Z 🚀</h1>
                <p className={cn(
                  "text-xl leading-relaxed",
                  theme === 'light' ? "text-slate-500" : "text-white/40"
                )}>Your AI-powered personalized learning journey starts here. Let's build your perfect curriculum.</p>
              </div>
              <button 
                onClick={handleNext}
                className={cn(
                  "px-12 py-5 font-black rounded-2xl transition-all hover:scale-105 active:scale-95 shadow-2xl",
                  theme === 'light' ? "bg-indigo-600 text-white shadow-indigo-500/20" : "bg-emerald-500 text-black shadow-emerald-500/20"
                )}
              >
                Let’s get started
              </button>
            </motion.div>
          )}

          {currentStep === 1 && (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="space-y-2">
                <h2 className={cn("text-3xl font-black tracking-tight", theme === 'light' ? "text-slate-900" : "text-white")}>Basic Info</h2>
                <p className={theme === 'light' ? "text-slate-500" : "text-white/40"}>Help us get to know you better.</p>
              </div>
              
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className={cn("text-xs font-black uppercase tracking-widest", theme === 'light' ? "text-slate-400" : "text-white/20")}>Full Name</label>
                  <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
                    <input 
                      type="text"
                      value={formData.displayName}
                      onChange={e => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
                      className={cn(
                        "w-full pl-12 pr-4 py-4 rounded-2xl border transition-all outline-none",
                        theme === 'light' ? "bg-white border-slate-200 focus:border-indigo-500" : "bg-white/5 border-white/10 focus:border-emerald-500 text-white"
                      )}
                      placeholder="Your Name"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className={cn("text-xs font-black uppercase tracking-widest", theme === 'light' ? "text-slate-400" : "text-white/20")}>Age (Optional)</label>
                    <input 
                      type="number"
                      value={formData.age}
                      onChange={e => setFormData(prev => ({ ...prev, age: e.target.value }))}
                      className={cn(
                        "w-full px-4 py-4 rounded-2xl border transition-all outline-none",
                        theme === 'light' ? "bg-white border-slate-200 focus:border-indigo-500" : "bg-white/5 border-white/10 focus:border-emerald-500 text-white"
                      )}
                      placeholder="25"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className={cn("text-xs font-black uppercase tracking-widest", theme === 'light' ? "text-slate-400" : "text-white/20")}>Country</label>
                    <div className="relative">
                      <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
                      <input 
                        type="text"
                        value={formData.country}
                        onChange={e => setFormData(prev => ({ ...prev, country: e.target.value }))}
                        className={cn(
                          "w-full pl-12 pr-4 py-4 rounded-2xl border transition-all outline-none",
                          theme === 'light' ? "bg-white border-slate-200 focus:border-indigo-500" : "bg-white/5 border-white/10 focus:border-emerald-500 text-white"
                        )}
                        placeholder="Nepal"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button onClick={handleBack} className={cn("flex-1 py-4 font-bold rounded-2xl transition-all", theme === 'light' ? "bg-slate-200 text-slate-600" : "bg-white/5 text-white/40 hover:bg-white/10")}>Back</button>
                <button 
                  onClick={handleNext} 
                  disabled={!formData.displayName || !formData.country}
                  className={cn(
                    "flex-[2] py-4 font-black rounded-2xl transition-all shadow-xl disabled:opacity-50",
                    theme === 'light' ? "bg-indigo-600 text-white" : "bg-emerald-500 text-black"
                  )}
                >
                  Continue
                </button>
              </div>
            </motion.div>
          )}

          {currentStep === 2 && (
            <motion.div 
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="space-y-2">
                <h2 className={cn("text-3xl font-black tracking-tight", theme === 'light' ? "text-slate-900" : "text-white")}>Discovery Source</h2>
                <p className={theme === 'light' ? "text-slate-500" : "text-white/40"}>How did you hear about us?</p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {[
                  { id: 'tiktok', label: 'TikTok', icon: Share2 },
                  { id: 'youtube', label: 'YouTube', icon: Youtube },
                  { id: 'referral', label: 'Friends / Referral', icon: Users },
                  { id: 'ads', label: 'Ads', icon: Megaphone },
                  { id: 'other', label: 'Other', icon: MoreHorizontal }
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => setFormData(prev => ({ ...prev, discoverySource: item.id }))}
                    className={cn(
                      "flex items-center gap-4 p-5 rounded-2xl border transition-all text-left group",
                      formData.discoverySource === item.id
                        ? (theme === 'light' ? "bg-indigo-600 border-indigo-600 text-white" : "bg-emerald-500 border-emerald-500 text-black")
                        : (theme === 'light' ? "bg-white border-slate-200 hover:border-indigo-500/50" : "bg-white/5 border-white/10 hover:border-emerald-500/50 text-white")
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                      formData.discoverySource === item.id
                        ? "bg-white/20"
                        : (theme === 'light' ? "bg-indigo-500/10 text-indigo-600" : "bg-emerald-500/10 text-emerald-500")
                    )}>
                      <item.icon size={20} />
                    </div>
                    <span className="font-bold">{item.label}</span>
                  </button>
                ))}
              </div>

              <div className="flex gap-4 pt-4">
                <button onClick={handleBack} className={cn("flex-1 py-4 font-bold rounded-2xl transition-all", theme === 'light' ? "bg-slate-200 text-slate-600" : "bg-white/5 text-white/40 hover:bg-white/10")}>Back</button>
                <button 
                  onClick={handleNext} 
                  disabled={!formData.discoverySource}
                  className={cn(
                    "flex-[2] py-4 font-black rounded-2xl transition-all shadow-xl disabled:opacity-50",
                    theme === 'light' ? "bg-indigo-600 text-white" : "bg-emerald-500 text-black"
                  )}
                >
                  Continue
                </button>
              </div>
            </motion.div>
          )}

          {currentStep === 3 && (
            <motion.div 
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="space-y-2">
                <h2 className={cn("text-3xl font-black tracking-tight", theme === 'light' ? "text-slate-900" : "text-white")}>Interests & Fields</h2>
                <p className={theme === 'light' ? "text-slate-500" : "text-white/40"}>What fields are you interested in?</p>
              </div>

              <div className="flex flex-wrap gap-3">
                {[
                  { id: 'programming', label: 'Programming', icon: Code },
                  { id: 'ai', label: 'AI / Machine Learning', icon: Brain },
                  { id: 'business', label: 'Business', icon: Briefcase },
                  { id: 'finance', label: 'Finance', icon: DollarSign },
                  { id: 'design', label: 'Design', icon: Palette },
                  { id: 'marketing', label: 'Marketing', icon: TrendingUp },
                  { id: 'personal', label: 'Personal Development', icon: Heart }
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => toggleInterest(item.id)}
                    className={cn(
                      "flex items-center gap-2 px-5 py-3 rounded-full border transition-all",
                      formData.interests.includes(item.id)
                        ? (theme === 'light' ? "bg-indigo-600 border-indigo-600 text-white" : "bg-emerald-500 border-emerald-500 text-black")
                        : (theme === 'light' ? "bg-white border-slate-200 text-slate-600" : "bg-white/5 border-white/10 text-white/60")
                    )}
                  >
                    <item.icon size={16} />
                    <span className="font-bold text-sm">{item.label}</span>
                  </button>
                ))}
              </div>

              <div className="flex gap-4 pt-4">
                <button onClick={handleBack} className={cn("flex-1 py-4 font-bold rounded-2xl transition-all", theme === 'light' ? "bg-slate-200 text-slate-600" : "bg-white/5 text-white/40 hover:bg-white/10")}>Back</button>
                <button 
                  onClick={handleNext} 
                  disabled={formData.interests.length === 0}
                  className={cn(
                    "flex-[2] py-4 font-black rounded-2xl transition-all shadow-xl disabled:opacity-50",
                    theme === 'light' ? "bg-indigo-600 text-white" : "bg-emerald-500 text-black"
                  )}
                >
                  Continue
                </button>
              </div>
            </motion.div>
          )}

          {currentStep === 4 && (
            <motion.div 
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="space-y-2">
                <h2 className={cn("text-3xl font-black tracking-tight", theme === 'light' ? "text-slate-900" : "text-white")}>Goals & Commitment</h2>
                <p className={theme === 'light' ? "text-slate-500" : "text-white/40"}>Tell us about your learning goals.</p>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <label className={cn("text-xs font-black uppercase tracking-widest", theme === 'light' ? "text-slate-400" : "text-white/20")}>Primary Goal</label>
                  <div className="grid grid-cols-1 gap-2">
                    {['Career Switch', 'Skill Upgrading', 'Academic Support', 'Just for Fun', 'Other'].map(goal => (
                      <button
                        key={goal}
                        onClick={() => setFormData(prev => ({ ...prev, primaryGoal: goal }))}
                        className={cn(
                          "p-4 rounded-2xl border transition-all font-bold text-left",
                          formData.primaryGoal === goal
                            ? (theme === 'light' ? "bg-indigo-600 border-indigo-600 text-white" : "bg-emerald-500 border-emerald-500 text-black")
                            : (theme === 'light' ? "bg-white border-slate-200 text-slate-600" : "bg-white/5 border-white/10 text-white/60")
                        )}
                      >
                        {goal}
                      </button>
                    ))}
                  </div>
                  {formData.primaryGoal === 'Other' && (
                    <input 
                      type="text"
                      value={formData.customGoal}
                      onChange={e => setFormData(prev => ({ ...prev, customGoal: e.target.value }))}
                      className={cn(
                        "w-full px-4 py-4 rounded-2xl border transition-all outline-none",
                        theme === 'light' ? "bg-white border-slate-200 focus:border-indigo-500" : "bg-white/5 border-white/10 focus:border-emerald-500 text-white"
                      )}
                      placeholder="Tell us your goal..."
                    />
                  )}
                </div>

                <div className="space-y-3">
                  <label className={cn("text-xs font-black uppercase tracking-widest", theme === 'light' ? "text-slate-400" : "text-white/20")}>Daily Commitment</label>
                  <div className="grid grid-cols-2 gap-3">
                    {['15-30 mins', '30-60 mins', '1-2 hours', '2+ hours'].map(time => (
                      <button
                        key={time}
                        onClick={() => setFormData(prev => ({ ...prev, dailyCommitment: time }))}
                        className={cn(
                          "p-4 rounded-2xl border transition-all font-bold text-sm",
                          formData.dailyCommitment === time
                            ? (theme === 'light' ? "bg-indigo-600 border-indigo-600 text-white" : "bg-emerald-500 border-emerald-500 text-black")
                            : (theme === 'light' ? "bg-white border-slate-200 text-slate-600" : "bg-white/5 border-white/10 text-white/60")
                        )}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button onClick={handleBack} className={cn("flex-1 py-4 font-bold rounded-2xl transition-all", theme === 'light' ? "bg-slate-200 text-slate-600" : "bg-white/5 text-white/40 hover:bg-white/10")}>Back</button>
                <button 
                  onClick={handleSubmit} 
                  disabled={isSubmitting || !formData.primaryGoal || !formData.dailyCommitment || (formData.primaryGoal === 'Other' && !formData.customGoal)}
                  className={cn(
                    "flex-[2] py-4 font-black rounded-2xl transition-all shadow-xl disabled:opacity-50 flex items-center justify-center gap-2",
                    theme === 'light' ? "bg-indigo-600 text-white" : "bg-emerald-500 text-black"
                  )}
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Build My Path"}
                </button>
              </div>
            </motion.div>
          )}

          {currentStep === 5 && (
            <motion.div 
              key="step5"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-8"
            >
              <div className={cn(
                "w-24 h-24 mx-auto rounded-full flex items-center justify-center border-4",
                theme === 'light' ? "bg-indigo-500/10 border-indigo-500/20" : "bg-emerald-500/10 border-emerald-500/20"
              )}>
                <Check className={cn("w-12 h-12", theme === 'light' ? "text-indigo-600" : "text-emerald-500")} />
              </div>
              
              <div className="space-y-4">
                <h2 className={cn("text-4xl font-black tracking-tight", theme === 'light' ? "text-slate-900" : "text-white")}>You're all set! 🚀</h2>
                <p className={cn(
                  "text-xl leading-relaxed",
                  theme === 'light' ? "text-slate-500" : "text-white/40"
                )}>
                  We've personalized your learning journey based on your goals and interests.
                </p>
              </div>

              <button 
                onClick={handleNext}
                className={cn(
                  "px-12 py-5 font-black rounded-2xl transition-all hover:scale-105 active:scale-95 shadow-2xl",
                  theme === 'light' ? "bg-indigo-600 text-white shadow-indigo-500/20" : "bg-emerald-500 text-black shadow-emerald-500/20"
                )}
              >
                Go to Dashboard
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="fixed bottom-8 left-0 w-full text-center">
        <p className={cn(
          "text-[10px] font-black uppercase tracking-[0.3em]",
          theme === 'light' ? "text-slate-300" : "text-white/10"
        )}>
          Step {currentStep + 1} of {STEPS.length} • {STEPS[currentStep]}
        </p>
      </div>
    </div>
  );
}
