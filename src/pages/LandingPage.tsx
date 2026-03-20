import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { Sparkles, BookOpen, Video, Brain, ArrowRight, PlayCircle } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useAssistant } from "../contexts/AssistantContext";
import { cn } from "../lib/utils";

export default function LandingPage() {
  const { user } = useAuth();
  const { theme } = useAssistant();

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6 text-center space-y-12 bg-theme-bg relative overflow-hidden transition-colors duration-500">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] blur-[120px] rounded-full pointer-events-none opacity-20 bg-theme-accent/10" />

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="space-y-6 max-w-4xl relative z-10"
      >
        <div className="inline-flex flex-col items-center gap-2">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-theme-accent/20 bg-theme-accent/10 text-theme-accent text-sm font-bold tracking-widest uppercase mb-2">
            <Sparkles size={16} />
            AI-Powered Learning Platform
          </div>
          {user && (
            <motion.p 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-medium text-lg text-theme-accent"
            >
              Welcome back, {user.displayName?.split(' ')[0]}! Ready to continue?
            </motion.p>
          )}
        </div>
        
        <h1 className="text-5xl md:text-7xl lg:text-9xl font-black tracking-tighter leading-[0.85] text-theme-text">
          LEARN.<br />
          <span className="text-theme-accent">EVOLVE.</span><br />
          MASTER.
        </h1>
        
        <p className="text-xl max-w-2xl mx-auto leading-relaxed pt-4 text-theme-text-muted">
          Learn-Z is the future of education. An AI-powered classroom where Nova, your personal tutor, guides you through every lesson with real-time insights and memory.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-8">
          {user ? (
            <>
              <Link 
                to="/learntube"
                className={cn(
                  "px-10 py-5 font-bold rounded-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-3 text-xl shadow-2xl bg-theme-accent shadow-theme-accent/20",
                  theme === 'light' ? "text-white" : "text-black"
                )}
              >
                Explore Courses <ArrowRight size={24} />
              </Link>
              <Link 
                to="/classroom"
                className="px-10 py-5 border border-theme-border font-bold rounded-2xl transition-all text-xl bg-theme-card text-theme-text hover:bg-theme-text/10"
              >
                Enter Classroom
              </Link>
            </>
          ) : (
            <Link 
              to="/login"
              className={cn(
                "px-10 py-5 font-bold rounded-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-3 text-xl shadow-2xl bg-theme-accent shadow-theme-accent/20",
                theme === 'light' ? "text-white" : "text-black"
              )}
            >
              Get Started <ArrowRight size={24} />
            </Link>
          )}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-6xl relative z-10">
        {[
          { icon: PlayCircle, title: "AI Classroom", desc: "Interactive workspace with video lessons and real-time AI assistance." },
          { icon: BookOpen, title: "LearnTube", desc: "Curated learning paths from the best educational content on YouTube." },
          { icon: Brain, title: "Neural Memory", desc: "Nova remembers your progress, questions, and learning style forever." }
        ].map((feature, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + i * 0.1 }}
            className="p-10 border border-theme-border rounded-[40px] text-left space-y-4 transition-all group bg-theme-card hover:border-theme-accent/30 hover:bg-theme-text/5"
          >
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform bg-theme-accent/10 text-theme-accent">
              <feature.icon size={28} />
            </div>
            <h3 className="text-2xl font-bold text-theme-text">{feature.title}</h3>
            <p className="text-base leading-relaxed text-theme-text-muted">{feature.desc}</p>
          </motion.div>
        ))}
      </div>

      <footer className="pt-20 text-[10px] font-black tracking-[0.3em] uppercase text-theme-text-muted/50">
        Developed by Malang Code Innovators
      </footer>
    </div>
  );
}
