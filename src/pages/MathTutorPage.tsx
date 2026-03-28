import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, MessageSquare, Send, Image as ImageIcon, 
  Trash2, ChevronLeft, ChevronRight, Loader2,
  Sparkles, Brain, Lightbulb, History, Camera,
  ArrowLeft, Menu, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAssistant } from '../contexts/AssistantContext';
import { 
  getMathSessions, 
  createMathSession, 
  updateMathSession, 
  deleteMathSession, 
  generateMathTutorResponse,
  MathSession,
  MathMessage
} from '../services/geminiService';
import { cn } from '../lib/utils';
import ReactMarkdown from 'react-markdown';

export default function MathTutorPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setMathContext } = useAssistant();
  const [sessions, setSessions] = useState<MathSession[]>([]);
  const [currentSession, setCurrentSession] = useState<MathSession | null>(null);
  const [input, setInput] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 1024);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      loadSessions();
    }
  }, [user]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentSession?.messages]);

  useEffect(() => {
    if (currentSession) {
      setMathContext({
        title: currentSession.title,
        lastMessage: currentSession.messages[currentSession.messages.length - 1]?.content,
        currentStep: currentSession.messages.length
      });
    } else {
      setMathContext(null);
    }
  }, [currentSession, setMathContext]);

  const loadSessions = async () => {
    if (!user) return;
    const data = await getMathSessions(user.uid);
    setSessions(data);
  };

  const handleNewSession = async () => {
    if (!user) return;
    const newSession = await createMathSession({
      userId: user.uid,
      title: "New Math Problem",
      messages: [],
      createdAt: new Date().toISOString()
    });
    if (newSession) {
      setSessions([newSession, ...sessions]);
      setCurrentSession(newSession);
      if (window.innerWidth < 1024) setMobileSidebarOpen(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!input.trim() && !image) || !currentSession || loading) return;

    const userMsg: MathMessage = {
      role: 'user',
      content: input,
      image: image || undefined,
      timestamp: new Date().toISOString()
    };

    const updatedMessages = [...currentSession.messages, userMsg];
    const tempSession = { ...currentSession, messages: updatedMessages };
    setCurrentSession(tempSession);
    setInput('');
    setImage(null);
    setLoading(true);

    try {
      const aiResponse = await generateMathTutorResponse(input, currentSession.messages, image || undefined);
      const modelMsg: MathMessage = {
        role: 'model',
        content: aiResponse,
        timestamp: new Date().toISOString()
      };

      const finalMessages = [...updatedMessages, modelMsg];
      const finalSession = await updateMathSession(currentSession._id, {
        userId: user.uid,
        messages: finalMessages,
        title: input.slice(0, 30) || currentSession.title
      });

      if (finalSession) {
        setCurrentSession(finalSession);
        setSessions(sessions.map(s => s._id === finalSession._id ? finalSession : s));
      }
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
    if (!user?.uid) return;
    e.stopPropagation();
    await deleteMathSession(id, user.uid);
    setSessions(sessions.filter(s => s._id !== id));
    if (currentSession?._id === id) setCurrentSession(null);
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-theme-sidebar">
      <div className="p-4 flex items-center justify-between border-b border-theme-border">
        <h2 className="text-lg font-semibold text-theme-text flex items-center gap-2">
          <History size={18} className="text-theme-accent" />
          Sessions
        </h2>
        <button 
          onClick={handleNewSession}
          className="p-2 rounded-lg bg-theme-accent/10 text-theme-accent hover:bg-theme-accent/20 transition-colors"
        >
          <Plus size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {sessions.map(session => (
          <div
            key={session._id}
            onClick={() => {
              setCurrentSession(session);
              if (window.innerWidth < 1024) setMobileSidebarOpen(false);
            }}
            className={cn(
              "group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all duration-200",
              currentSession?._id === session._id 
                ? "bg-theme-accent/10 text-theme-accent" 
                : "text-theme-text-muted hover:bg-theme-text/5 hover:text-theme-text"
            )}
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <MessageSquare size={16} className={currentSession?._id === session._id ? "text-theme-accent" : ""} />
              <span className="truncate text-sm font-medium">{session.title}</span>
            </div>
            <button 
              onClick={(e) => handleDeleteSession(e, session._id)}
              className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-all"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  const { theme } = useAssistant();

  return (
    <div className="flex h-[calc(100vh-64px)] bg-theme-bg overflow-hidden relative">
      {/* Desktop Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 300 : 0 }}
        className={cn(
          "hidden lg:flex flex-col border-r border-theme-border transition-all duration-300 overflow-hidden",
          !sidebarOpen && "border-none"
        )}
      >
        <div className="w-[300px] h-full">
          <SidebarContent />
        </div>
      </motion.aside>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileSidebarOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            />
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              className="fixed inset-y-0 left-0 w-[280px] z-50 lg:hidden"
            >
              <SidebarContent />
              <button 
                onClick={() => setMobileSidebarOpen(false)}
                className="absolute top-4 right-4 p-2 text-theme-text-muted hover:text-theme-text"
              >
                <X size={20} />
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative min-w-0">
        {/* Header Bar */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-theme-border bg-theme-header backdrop-blur-xl z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-lg hover:bg-theme-text/5 text-theme-text-muted hover:text-theme-text transition-all"
              title="Back"
            >
              <ArrowLeft size={20} />
            </button>
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-theme-text/5 text-theme-text-muted hover:text-theme-text transition-all"
            >
              <Menu size={20} />
            </button>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hidden lg:flex p-2 rounded-lg hover:bg-theme-text/5 text-theme-text-muted hover:text-theme-text transition-all"
            >
              {sidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
            </button>
            <div className="flex flex-col">
              <h1 className="text-sm font-bold text-theme-text truncate max-w-[150px] md:max-w-xs">
                {currentSession?.title || "Math Tutor Canvas"}
              </h1>
              <span className="text-[10px] text-theme-accent uppercase tracking-widest font-bold">
                Neural Learning Engine
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-theme-accent/10 border border-theme-accent/20">
              <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", theme === 'light' ? "bg-indigo-600" : "bg-emerald-500")} />
              <span className="text-[10px] text-theme-accent font-bold uppercase tracking-tighter">Live Session</span>
            </div>
          </div>
        </div>

        {!currentSession ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-20 h-20 rounded-3xl bg-theme-accent/20 flex items-center justify-center mb-6 animate-pulse">
              <Sparkles className="text-theme-accent w-10 h-10" />
            </div>
            <h1 className="text-3xl font-bold text-theme-text mb-4">Math Tutor Canvas</h1>
            <p className="text-theme-text-muted max-w-md mb-8">
              Welcome to your intelligent math workspace. Upload a problem or type it out, and let's explore the "why" and "how" together.
            </p>
            <button
              onClick={handleNewSession}
              className={cn(
                "px-8 py-3 rounded-2xl font-bold transition-all shadow-lg",
                theme === 'light' ? "bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-600/20" : "bg-emerald-500 text-black hover:bg-emerald-400 shadow-emerald-500/20"
              )}
            >
              Start New Session
            </button>
          </div>
        ) : (
          <>
            {/* Chat Area */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 md:p-6 space-y-8 scroll-smooth pb-40 md:pb-32"
            >
              <div className="max-w-4xl mx-auto space-y-8">
                {currentSession.messages.length === 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                    {[
                      { icon: Brain, title: "Understand the Story", desc: "Learn the real-life context of equations." },
                      { icon: Lightbulb, title: "Step-by-Step", desc: "Get guided through each logical step." },
                      { icon: Camera, title: "Visual Analysis", desc: "Upload photos of your handwritten work." },
                      { icon: Sparkles, title: "Nova Integration", desc: "Nova assists you with voice and vision." }
                    ].map((item, i) => (
                      <div key={i} className="p-6 rounded-2xl bg-theme-card border border-theme-border hover:border-theme-accent/30 transition-all group">
                        <item.icon className="text-theme-accent mb-4 group-hover:scale-110 transition-transform" size={24} />
                        <h3 className="text-theme-text font-semibold mb-2">{item.title}</h3>
                        <p className="text-theme-text-muted text-sm">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                )}

                {currentSession.messages.map((msg, i) => (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={i}
                    className={cn(
                      "flex gap-3 md:gap-4",
                      msg.role === 'user' ? "flex-row-reverse" : "flex-row"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                      msg.role === 'user' 
                        ? (theme === 'light' ? "bg-indigo-600 text-white" : "bg-emerald-500 text-black") 
                        : "bg-theme-text/10 text-theme-accent"
                    )}>
                      {msg.role === 'user' ? user?.displayName?.[0] : <Sparkles size={16} />}
                    </div>
                    <div className={cn(
                      "max-w-[85%] md:max-w-[80%] space-y-2",
                      msg.role === 'user' ? "items-end" : "items-start"
                    )}>
                      {msg.image && (
                        <div className="rounded-2xl overflow-hidden border border-theme-border mb-2">
                          <img src={msg.image} alt="Math Problem" className="max-h-64 object-contain bg-black/40" />
                        </div>
                      )}
                      <div className={cn(
                        "p-4 rounded-2xl text-sm leading-relaxed",
                        msg.role === 'user' 
                          ? "bg-theme-accent/10 text-theme-text border border-theme-accent/20" 
                          : "bg-theme-card text-theme-text/90 border border-theme-border backdrop-blur-md"
                      )}>
                        <div className={cn(
                          "markdown-body prose prose-sm max-w-none",
                          theme === 'dark' ? "prose-invert" : "prose-slate"
                        )}>
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
                {loading && (
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-lg bg-theme-text/10 flex items-center justify-center animate-pulse">
                      <Sparkles size={16} className="text-theme-accent" />
                    </div>
                    <div className="bg-theme-card p-4 rounded-2xl border border-theme-border flex items-center gap-3">
                      <Loader2 size={16} className="animate-spin text-theme-accent" />
                      <span className="text-theme-text-muted text-sm">Nova is analyzing...</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Input Area */}
            <div className="absolute bottom-0 left-0 right-0 p-2 md:p-6 bg-gradient-to-t from-theme-bg via-theme-bg/90 to-transparent z-20">
              <div className="max-w-4xl mx-auto">
                <form 
                  onSubmit={handleSendMessage}
                  className="relative bg-theme-card border border-theme-border rounded-[1.5rem] md:rounded-[2rem] p-1 md:p-2 backdrop-blur-2xl focus-within:border-theme-accent/50 transition-all shadow-2xl"
                >
                  <AnimatePresence>
                    {image && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.9 }}
                        className="absolute bottom-full left-4 mb-4 p-2 bg-theme-card rounded-2xl border border-theme-border backdrop-blur-xl shadow-2xl"
                      >
                        <img src={image} alt="Preview" className="h-24 md:h-32 rounded-lg object-contain" />
                        <button 
                          type="button"
                          onClick={() => setImage(null)}
                          className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
                        >
                          <Trash2 size={12} />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex items-center gap-1 md:gap-2 px-1 md:px-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 md:p-3 text-theme-text-muted hover:text-theme-accent transition-colors shrink-0"
                    >
                      <Camera size={20} className="md:w-[22px] md:h-[22px]" />
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleImageUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder="Ask a math question..."
                      className="flex-1 bg-transparent border-none focus:ring-0 text-theme-text placeholder:text-theme-text-muted py-2 md:py-3 resize-none max-h-32 text-sm md:text-base"
                      rows={1}
                    />
                    <button
                      type="submit"
                      disabled={(!input.trim() && !image) || loading}
                      className={cn(
                        "p-2 md:p-3 rounded-xl md:rounded-2xl transition-all shrink-0",
                        (!input.trim() && !image) || loading
                          ? "text-theme-text-muted/20 cursor-not-allowed"
                          : (theme === 'light' ? "bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-600/20" : "bg-emerald-500 text-black hover:bg-emerald-400 shadow-emerald-500/20")
                      )}
                    >
                      <Send size={20} className="md:w-[22px] md:h-[22px]" />
                    </button>
                  </div>
                </form>
                <div className="flex items-center justify-center gap-4 mt-3">
                  <span className="text-[10px] text-theme-text-muted uppercase tracking-widest font-medium">
                    Nova Math Engine
                  </span>
                  <div className="w-1 h-1 rounded-full bg-theme-border" />
                  <span className="text-[10px] text-theme-text-muted uppercase tracking-widest font-medium">
                    Malang Code Innovators
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

