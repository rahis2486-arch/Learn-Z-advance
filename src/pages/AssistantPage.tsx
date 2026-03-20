import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mic, MicOff, Camera, CameraOff, Brain, Power, X, Sparkles, RefreshCw } from "lucide-react";
import { cn } from "../lib/utils";
import { useAssistant } from "../contexts/AssistantContext";
import { NovaAvatar } from "../components/NovaAvatar";
import { ConfirmModal } from "../components/ConfirmModal";
import { clearAllMemories, updateLongTermSummary } from "../services/geminiService";

export default function AssistantPage() {
  const {
    isLive,
    isCameraOn,
    isMicOn,
    isSpeaking,
    isThinking,
    isProcessing,
    isMemoryAction,
    userVolume,
    aiVolume,
    longTermSummary,
    messages,
    theme,
    stream,
    setTheme,
    toggleCamera,
    switchCamera,
    toggleMic,
    startLiveSession,
    cleanupSession,
  } = useAssistant();

  const videoRef = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const [showClearConfirm, setShowClearConfirm] = React.useState(false);

  const themes = [
    { id: 'glass', name: 'Glass', icon: Sparkles },
    { id: 'gradient', name: 'Gradient', icon: Brain },
    { id: 'light', name: 'Light', icon: Power }
  ];

  const themeStyles = {
    glass: {
      bg: "bg-theme-bg",
      accent: "text-theme-accent",
      accentBg: "bg-theme-accent/10",
      accentBorder: "border-theme-accent/20",
      glass: "bg-theme-card backdrop-blur-xl border-theme-border",
      text: "text-theme-text",
      textMuted: "text-theme-text-muted",
      btn: "bg-theme-text/5 border-theme-border text-theme-text-muted hover:text-theme-text",
      status: {
        memory: "bg-purple-400",
        thinking: "bg-amber-400",
        speaking: "bg-purple-500",
        live: "bg-blue-500",
        standby: "bg-zinc-600"
      }
    },
    dark: {
      bg: "bg-theme-bg",
      accent: "text-theme-accent",
      accentBg: "bg-theme-accent/10",
      accentBorder: "border-theme-accent/20",
      glass: "bg-theme-card backdrop-blur-xl border-theme-border",
      text: "text-theme-text",
      textMuted: "text-theme-text-muted",
      btn: "bg-theme-text/5 border-theme-border text-theme-text-muted hover:text-theme-text",
      status: {
        memory: "bg-emerald-400",
        thinking: "bg-amber-400",
        speaking: "bg-emerald-500",
        live: "bg-emerald-400",
        standby: "bg-zinc-800"
      }
    },
    light: {
      bg: "bg-theme-bg",
      accent: "text-theme-accent",
      accentBg: "bg-theme-accent/10",
      accentBorder: "border-theme-accent/20",
      glass: "bg-theme-card backdrop-blur-xl border-theme-border",
      text: "text-theme-text",
      textMuted: "text-theme-text-muted",
      btn: "bg-theme-text/5 border-theme-border text-theme-text-muted hover:text-theme-text",
      status: {
        memory: "bg-indigo-600",
        thinking: "bg-amber-500",
        speaking: "bg-indigo-500",
        live: "bg-blue-600",
        standby: "bg-zinc-400"
      }
    }
  };

  const s = themeStyles[theme] || themeStyles.dark;

  const handleClearMemories = async () => {
    try {
      await clearAllMemories();
      await updateLongTermSummary("");
      window.location.reload(); // Refresh to clear state
    } catch (err) {
      console.error("Failed to clear memories:", err);
    }
  };

  return (
    <div className={cn("relative flex flex-col h-full w-full overflow-hidden select-none transition-colors duration-700", s.bg)}>
      <ConfirmModal 
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={handleClearMemories}
        title="Wipe Neural Core?"
        message="This will permanently erase ALL stored memories, preferences, and facts Nova has learned about you. She will start fresh as if meeting you for the first time."
        confirmText="Wipe Everything"
      />

      {/* Neural Processing Indicator */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={cn("fixed top-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 backdrop-blur-xl px-6 py-3 rounded-2xl shadow-2xl border", s.accentBg, s.accentBorder)}
          >
            <div className="relative w-3 h-3">
              <div className="absolute inset-0 rounded-full animate-ping bg-theme-accent" />
              <div className="absolute inset-0 rounded-full bg-theme-accent" />
            </div>
            <span className={cn("text-xs font-bold uppercase tracking-widest", s.accent)}>Neural Processing...</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3D Avatar Center Stage */}
      <div className="absolute inset-0 flex items-center justify-center z-0">
        <div className="w-full h-full max-w-screen-2xl mx-auto flex items-center justify-center">
          <div className="w-full aspect-square max-w-[56vh] md:max-w-none">
            <NovaAvatar 
              isSpeaking={isSpeaking} 
              isThinking={isThinking} 
              isMemoryAction={isMemoryAction}
              aiVolume={aiVolume}
              userVolume={userVolume}
              theme={theme}
              scale={[0.7, 0.7, 0.7]}
            />
          </div>
        </div>
      </div>

      {/* Top Status Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 md:p-8 flex justify-between items-center z-20 pointer-events-none">
        <div className="flex items-center gap-3 pointer-events-auto">
          <div className={cn(
            "flex items-center gap-2 md:gap-3 backdrop-blur-xl px-3 md:px-5 py-2 md:py-2.5 rounded-full border shadow-2xl transition-all duration-300",
            s.glass,
            isMemoryAction && "border-theme-accent/50 bg-theme-accent/10 shadow-[0_0_20px_rgba(var(--accent-rgb),0.2)]"
          )}>
            <div className={cn(
              "w-1.5 md:w-2 h-1.5 md:h-2 rounded-full",
              isMemoryAction ? s.status.memory + " animate-ping" : 
              isThinking ? s.status.thinking + " animate-pulse" : 
              isSpeaking ? s.status.speaking : 
              isLive ? s.status.live + " animate-pulse" : s.status.standby
            )} />
            <span className={cn("text-[8px] md:text-[10px] uppercase tracking-[0.2em] font-black", s.text)}>
              {isMemoryAction ? "Neural Core Access" : 
               isThinking ? "Processing Thought" : 
               isSpeaking ? "Nova Speaking" : 
               isLive ? "Listening..." : "System Standby"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4 pointer-events-auto">
          <button 
            onClick={() => setShowClearConfirm(true)}
            className={cn("p-2 md:p-3 rounded-full border transition-all group", s.btn)}
            title="Wipe Neural Core"
          >
            <Brain size={18} className="md:w-5 md:h-5 group-hover:scale-110 transition-transform" />
          </button>
        </div>
      </div>

      {/* Camera Feed Overlay */}
      <AnimatePresence>
        {isCameraOn && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, x: 20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.9, x: 20 }}
            className={cn("absolute top-20 md:top-8 right-4 md:right-8 w-40 md:w-64 aspect-video rounded-2xl md:rounded-3xl overflow-hidden border shadow-2xl z-20 group", s.accentBorder)}
          >
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-2 md:p-4">
              <span className="text-[8px] md:text-[10px] text-white/80 font-bold uppercase tracking-widest">Visual Input Active</span>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  switchCamera();
                }}
                className="p-1.5 md:p-2 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-md border border-white/20 transition-colors"
                title="Switch Camera"
              >
                <RefreshCw size={14} className="text-white" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10 flex flex-col items-center gap-4 md:gap-8 z-20 pointer-events-none">
        {/* Neural Core Summary Preview */}
        {longTermSummary && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn("max-w-xs md:max-w-xl backdrop-blur-xl border p-3 md:p-4 rounded-2xl text-center pointer-events-auto shadow-xl", s.glass)}
          >
            <p className={cn("text-[8px] md:text-[10px] uppercase tracking-widest font-bold mb-1 md:mb-2", s.accent)}>Neural Core Summary</p>
            <p className={cn("text-[10px] md:text-xs italic line-clamp-2 leading-relaxed", s.textMuted)}>"{longTermSummary}"</p>
          </motion.div>
        )}

        <div className="flex items-center gap-4 md:gap-6 pointer-events-auto">
          <button 
            onClick={toggleCamera}
            className={cn(
              "p-4 md:p-5 rounded-full border transition-all duration-500 group",
              isCameraOn ? "bg-theme-accent text-white" : s.btn
            )}
          >
            {isCameraOn ? <Camera size={20} className="md:w-6 md:h-6" /> : <CameraOff size={20} className="md:w-6 md:h-6" />}
          </button>

          <button 
            onClick={isLive ? cleanupSession : startLiveSession}
            className={cn(
              "w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl group relative",
              isLive ? "bg-red-500 text-white shadow-red-500/20" : "bg-theme-accent text-white shadow-theme-accent/20 hover:scale-105"
            )}
          >
            <div className={cn(
              "absolute inset-0 rounded-full border-4 border-white/20 transition-transform duration-500",
              isLive ? "scale-110 animate-pulse" : "scale-100 group-hover:scale-110"
            )} />
            {isLive ? <Power size={28} className="md:w-8 md:h-8" /> : <Sparkles size={28} className="md:w-8 md:h-8" />}
          </button>

          <button 
            onClick={toggleMic}
            className={cn(
              "p-4 md:p-5 rounded-full border transition-all duration-500",
              isMicOn ? "bg-theme-accent text-white" : s.btn
            )}
          >
            {isMicOn ? <Mic size={20} className="md:w-6 md:h-6" /> : <MicOff size={20} className="md:w-6 md:h-6" />}
          </button>
        </div>
      </div>

      {/* Chat History Sidebar */}
      <div className="hidden md:block absolute left-8 top-1/2 -translate-y-1/2 w-80 max-h-[60vh] overflow-y-auto space-y-4 z-10 pointer-events-none scrollbar-hide mask-fade-y">
        {messages.slice(-5).map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className={cn(
              "p-4 rounded-2xl text-xs leading-relaxed backdrop-blur-md border shadow-lg",
              msg.role === 'user' 
                ? "bg-theme-accent/10 border-theme-accent/20 text-theme-text ml-8" 
                : "bg-theme-card border-theme-border text-theme-text-muted mr-8"
            )}
          >
            {msg.content}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
