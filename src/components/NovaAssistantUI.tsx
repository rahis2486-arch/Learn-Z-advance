import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  MessageSquare, 
  Maximize2, 
  Minimize2,
  Send,
  Brain,
  Sparkles,
  History,
  Settings,
  MoreVertical,
  Volume2,
  VolumeX,
  RefreshCw
} from 'lucide-react';
import { useAssistant } from '../contexts/AssistantContext';
import { NovaAvatar } from './NovaAvatar';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const NovaAssistantUI: React.FC = () => {
  const {
    isLive,
    isCameraOn,
    isMicOn,
    isSpeaking,
    isThinking,
    isMemoryAction,
    isConnecting,
    isSidebarOpen,
    messages,
    toggleSidebar,
    toggleCamera,
    toggleMic,
    startLiveSession,
    cleanupSession,
    setSidebarOpen,
    aiVolume,
    userVolume,
    theme,
    stream,
    switchCamera
  } = useAssistant();

  const [isDragging, setIsDragging] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const themeStyles = {
    dark: {
      sidebar: "bg-theme-sidebar border-theme-border",
      header: "bg-theme-header border-theme-border",
      chat: "bg-theme-card border-theme-border",
      controls: "bg-theme-card/50 border-theme-border",
      text: "text-theme-text",
      textMuted: "text-theme-text-muted",
      accent: "text-theme-accent",
      accentBg: "bg-theme-accent",
      btn: "bg-theme-text/5 text-theme-text-muted",
      input: "bg-theme-text/5 border-theme-border text-theme-text"
    },
    light: {
      sidebar: "bg-theme-sidebar border-theme-border",
      header: "bg-theme-header border-theme-border",
      chat: "bg-theme-card border-theme-border",
      controls: "bg-theme-card/50 border-theme-border",
      text: "text-theme-text",
      textMuted: "text-theme-text-muted",
      accent: "text-theme-accent",
      accentBg: "bg-theme-accent",
      btn: "bg-theme-text/5 text-theme-text-muted",
      input: "bg-theme-text/5 border-theme-border text-theme-text"
    }
  };

  const s = themeStyles[theme as 'dark' | 'light'] || themeStyles.dark;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <>
      {/* Floating Avatar */}
      <AnimatePresence mode="wait">
        {!isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1 }}
            drag
            dragMomentum={false}
            onDragStart={() => setIsDragging(true)}
            onDragEnd={() => setTimeout(() => setIsDragging(false), 100)}
            onClick={() => !isDragging && toggleSidebar()}
            className="fixed bottom-8 right-8 z-[9999] cursor-grab active:cursor-grabbing"
          >
            <div className="relative group">
              {/* Glow effect based on state */}
              <div className={cn(
                "absolute -inset-6 rounded-full blur-2xl transition-all duration-500 opacity-40",
                isSpeaking ? "bg-theme-accent/40 animate-pulse" : 
                isThinking ? "bg-amber-500/40 animate-pulse" : 
                isLive ? "bg-blue-500/40" : "bg-zinc-500/20"
              )} />
              
              <div className="relative w-20 h-20 flex items-center justify-center">
                <div className="w-full h-full">
                  <NovaAvatar 
                    isSpeaking={isSpeaking} 
                    isThinking={isThinking} 
                    isMemoryAction={isMemoryAction}
                    aiVolume={aiVolume}
                    userVolume={userVolume}
                    theme={theme}
                  />
                </div>
              </div>

              {/* Status Indicators */}
              <div className="absolute top-2 right-2 flex gap-2">
                {isMicOn && <div className="w-4 h-4 rounded-full border-2 animate-pulse shadow-lg bg-theme-accent border-theme-bg shadow-theme-accent/20" />}
                {isCameraOn && <div className="w-4 h-4 rounded-full border-2 animate-pulse shadow-lg bg-blue-500 border-theme-bg shadow-blue-500/20" />}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
            <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={cn("fixed top-0 right-0 h-full w-full sm:w-[400px] border-l z-[10000] shadow-2xl flex flex-col transition-colors duration-500", s.sidebar)}
          >
            {/* Header */}
            <div className={cn("p-5 border-b flex items-center justify-between backdrop-blur-xl transition-colors duration-500", s.header)}>
              <div className="flex items-center gap-4">
                <div 
                  className={cn("w-16 h-16 rounded-2xl border overflow-hidden shadow-xl transition-colors duration-500 bg-theme-card border-theme-border")}
                >
                  <NovaAvatar 
                    isSpeaking={isSpeaking} 
                    isThinking={isThinking} 
                    isMemoryAction={isMemoryAction}
                    aiVolume={aiVolume}
                    userVolume={userVolume}
                    theme={theme}
                  />
                </div>
                <div>
                  <h3 className={cn("text-base font-bold flex items-center gap-2 transition-colors duration-500", s.text)}>
                    Nova Assistant
                    {isLive && <div className="w-2.5 h-2.5 rounded-full animate-pulse shadow-lg bg-theme-accent shadow-theme-accent/50" />}
                  </h3>
                  <p className={cn("text-[10px] uppercase tracking-[0.2em] font-bold mt-0.5 transition-colors duration-500", s.textMuted)}>
                    {isLive ? 'Neural Core Online' : 'System Standby'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    toggleSidebar();
                    window.location.href = '/assistant';
                  }}
                  className={cn("p-2 hover:bg-white/5 rounded-lg transition-colors", s.textMuted, "hover:" + s.text)}
                  title="Open Full Screen"
                >
                  <Maximize2 size={18} />
                </button>
                <button 
                  onClick={toggleSidebar}
                  className={cn("p-2 hover:bg-white/5 rounded-lg transition-colors", s.textMuted, "hover:" + s.text)}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Chat Area */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide"
            >
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
                  <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center border transition-colors duration-500 bg-theme-card border-theme-border")}>
                    <Sparkles className={s.accent} size={32} />
                  </div>
                  <div>
                    <h4 className={cn("font-medium", s.text)}>How can I help today?</h4>
                    <p className={cn("text-xs max-w-[200px] mt-1", s.textMuted)}>
                      I can help you with your lessons, summarize content, or just chat.
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "flex flex-col max-w-[85%]",
                      msg.role === 'user' ? "ml-auto items-end" : "items-start"
                    )}
                  >
                    <div className={cn(
                      "px-4 py-3 rounded-2xl text-sm leading-relaxed transition-colors duration-500",
                      msg.role === 'user' 
                        ? "bg-theme-accent text-white shadow-lg shadow-theme-accent/10 rounded-tr-none" 
                        : s.chat + " rounded-tl-none"
                    )}>
                      {msg.content}
                    </div>
                    <span className={cn("text-[10px] mt-1 px-1", s.textMuted)}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </motion.div>
                ))
              )}
              {isThinking && (
                <div className={cn("flex items-center gap-2 text-xs italic px-2", s.textMuted)}>
                  <Brain size={14} className="animate-pulse" />
                  Nova is thinking...
                </div>
              )}
            </div>

            {/* Visual Feed (Hidden but active for vision) */}
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className={cn(
                "w-full aspect-video bg-black object-cover border-y transition-all duration-500",
                s.controls,
                isCameraOn ? "h-48 opacity-100" : "h-0 opacity-0"
              )}
            />

            {/* Controls */}
            <div className={cn("p-4 sm:p-6 border-t transition-colors duration-500", s.controls)}>
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <div className="flex gap-2">
                  <button
                    onClick={toggleMic}
                    className={cn(
                      "p-2.5 sm:p-3 rounded-xl transition-all duration-300",
                      isMicOn ? "bg-theme-accent/10 text-theme-accent" : s.btn
                    )}
                  >
                    {isMicOn ? <Mic size={18} className="sm:w-5 sm:h-5" /> : <MicOff size={18} className="sm:w-5 sm:h-5" />}
                  </button>
                  <button
                    onClick={toggleCamera}
                    className={cn(
                      "p-2.5 sm:p-3 rounded-xl transition-all duration-300",
                      isCameraOn ? "bg-blue-500/10 text-blue-500" : s.btn
                    )}
                  >
                    {isCameraOn ? <Video size={18} className="sm:w-5 sm:h-5" /> : <VideoOff size={18} className="sm:w-5 sm:h-5" />}
                  </button>
                  {isCameraOn && (
                    <button
                      onClick={switchCamera}
                      className={cn(
                        "p-2.5 sm:p-3 rounded-xl transition-all duration-300",
                        s.btn,
                        "hover:text-theme-accent"
                      )}
                      title="Switch Camera"
                    >
                      <RefreshCw size={18} className="sm:w-5 sm:h-5" />
                    </button>
                  )}
                </div>
                
                <button
                  onClick={isLive ? cleanupSession : startLiveSession}
                  disabled={isConnecting}
                  className={cn(
                    "px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-semibold text-xs sm:text-sm transition-all duration-300 flex items-center gap-2",
                    isConnecting ? "bg-zinc-800 text-zinc-500 cursor-not-allowed" :
                    isLive 
                      ? "bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white" 
                      : s.accentBg + " text-white hover:opacity-90 shadow-lg"
                  )}
                >
                  {isConnecting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin" />
                      <span className="hidden sm:inline">Connecting...</span>
                      <span className="sm:hidden">...</span>
                    </>
                  ) : isLive ? (
                    <>
                      <X size={16} className="sm:w-[18px] sm:h-[18px]" />
                      <span className="hidden sm:inline">End Session</span>
                      <span className="sm:hidden">End</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} className="sm:w-[18px] sm:h-[18px]" />
                      <span className="hidden sm:inline">Start Nova</span>
                      <span className="sm:hidden">Start</span>
                    </>
                  )}
                </button>
              </div>

              {/* Input Area (For text fallback) */}
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  const input = (e.target as any).message.value;
                  if (input.trim()) {
                    (e.target as any).message.value = '';
                  }
                }}
                className="relative"
              >
                <input 
                  name="message"
                  type="text"
                  placeholder="Type a message..."
                  className={cn("w-full border rounded-xl py-3 pl-4 pr-12 text-sm placeholder:text-zinc-500 focus:outline-none transition-colors", s.input, "focus:border-theme-accent/50")}
                />
                <button 
                  type="submit"
                  className={cn("absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-black/5 rounded-lg transition-colors", s.accent)}
                >
                  <Send size={18} />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default NovaAssistantUI;
