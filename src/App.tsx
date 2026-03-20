/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { 
  Camera, Settings, Menu, X,
  Activity, Sparkles, Brain, BookOpen, PlayCircle, ShieldCheck,
  Calculator, Bot, Sun, Moon, RefreshCw, MoreVertical, User, CreditCard
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "./lib/utils";
import ClassroomPage from "./pages/ClassroomPage";
import AssistantPage from "./pages/AssistantPage";
import LandingPage from "./pages/LandingPage";
import MemoryPage from "./pages/MemoryPage";
import LearnTubePage from "./pages/LearnTubePage";
import AdminPage from "./pages/AdminPage";
import LoginPage from "./pages/LoginPage";
import MathTutorPage from "./pages/MathTutorPage";
import SubscriptionPage from "./pages/SubscriptionPage";
import OnboardingPage from "./pages/OnboardingPage";

import { AssistantProvider, useAssistant } from "./contexts/AssistantContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import NovaAssistantUI from "./components/NovaAssistantUI";
import { LogIn, LogOut, ShieldAlert } from "lucide-react";
import LoginModal from "./components/LoginModal";

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode, adminOnly?: boolean }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-theme-bg">
        <div className={cn(
          "w-12 h-12 border-4 rounded-full animate-spin",
          "border-theme-accent/20 border-t-theme-accent"
        )} />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!user.onboardingCompleted && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  if (adminOnly && user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function GlobalThemeSwitcher() {
  const { theme, setTheme } = useAssistant();
  
  const themes = [
    { id: 'dark', name: 'Dark', icon: Moon, color: 'bg-emerald-500' },
    { id: 'light', name: 'Light', icon: Sun, color: 'bg-indigo-600' }
  ];

  return (
    <div className="flex items-center gap-1 p-1 rounded-full border border-theme-border bg-theme-card backdrop-blur-xl pointer-events-auto">
      {themes.map((t) => (
        <button
          key={t.id}
          onClick={() => setTheme(t.id as any)}
          className={cn(
            "p-1.5 rounded-full transition-all",
            theme === t.id 
              ? (t.color + " text-white shadow-lg") 
              : "text-theme-text-muted hover:text-theme-text hover:bg-theme-text/5"
          )}
          title={t.name}
        >
          <t.icon size={14} />
        </button>
      ))}
    </div>
  );
}

function Sidebar({ isOpen, setIsOpen }: { isOpen: boolean, setIsOpen: (v: boolean) => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, login, logout } = useAuth();
  const { theme } = useAssistant();
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  
  const navItems = [
    { icon: PlayCircle, label: "Classroom", path: "/classroom" },
    { icon: BookOpen, label: "LearnTube", path: "/learntube" },
    { icon: Calculator, label: "Math Tutor", path: "/math-tutor" },
    { icon: Bot, label: "Nova Assistant", path: "/assistant" },
    { icon: Brain, label: "Neural Core", path: "/memory" },
    { icon: ShieldCheck, label: "Admin Panel", path: "/admin", adminOnly: true },
  ].filter(item => !item.adminOnly || user?.role === 'admin');

  return (
    <>
      {/* Mobile Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={{ 
          width: isOpen ? 280 : 0,
          x: isOpen ? 0 : -280
        }}
        className={cn(
          "fixed top-0 left-0 h-full z-50 overflow-hidden flex flex-col transition-colors duration-500",
          "bg-theme-sidebar border-r border-theme-border",
          "lg:relative lg:translate-x-0 lg:w-72"
        )}
      >
        <div className="p-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", theme === 'light' ? "bg-indigo-600" : "bg-emerald-500")}>
              <Activity className={cn("w-5 h-5", theme === 'light' ? "text-white" : "text-black")} />
            </div>
            <span className="font-semibold tracking-tight text-theme-text">Learn-Z</span>
          </Link>
          <button onClick={() => setIsOpen(false)} className="lg:hidden text-theme-text-muted hover:text-theme-text">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => {
                if (window.innerWidth < 1024) setIsOpen(false);
              }}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                location.pathname === item.path 
                  ? "bg-theme-accent/10 text-theme-accent shadow-sm" 
                  : "text-theme-text-muted hover:bg-theme-text/5 hover:text-theme-text"
              )}
            >
              <item.icon size={20} className={cn(
                "transition-colors",
                location.pathname === item.path ? "text-theme-accent" : "group-hover:text-theme-accent"
              )} />
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-theme-border relative">
          {user ? (
            <>
              <AnimatePresence>
                {isAccountModalOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute bottom-full left-4 right-4 mb-2 p-2 rounded-2xl border border-theme-border bg-theme-card backdrop-blur-xl shadow-2xl z-50"
                  >
                    <button 
                      onClick={() => {
                        setIsAccountModalOpen(false);
                        login();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-theme-text hover:bg-theme-text/5 transition-colors"
                    >
                      <RefreshCw size={16} className="text-theme-accent" />
                      <span>Switch Account</span>
                    </button>
                    <button 
                      onClick={() => {
                        setIsAccountModalOpen(false);
                        navigate('/subscription');
                        if (window.innerWidth < 1024) setIsOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-theme-text hover:bg-theme-text/5 transition-colors"
                    >
                      <Sparkles size={16} className="text-amber-500" />
                      <span>Upgrade Plan</span>
                    </button>
                    <div className="h-px bg-theme-border my-1" />
                    <button 
                      onClick={() => {
                        setIsAccountModalOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-500/5 transition-colors"
                    >
                      <LogOut size={16} />
                      <span>Logout</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

                <div 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsAccountModalOpen(!isAccountModalOpen);
                  }}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-theme-text/5 cursor-pointer hover:bg-theme-text/10 transition-colors group relative z-[60]"
                >
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || ""} className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
                ) : (
                  <div className={cn("w-8 h-8 rounded-full bg-gradient-to-tr", theme === 'light' ? "from-indigo-500 to-blue-400" : "from-emerald-500 to-teal-400")} />
                )}
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm font-medium truncate text-theme-text">{user.displayName || user.email}</p>
                  <p className="text-xs truncate capitalize text-theme-text-muted">{user.role} Access</p>
                </div>
                <MoreVertical size={16} className="text-theme-text-muted group-hover:text-theme-text transition-colors" />
              </div>
            </>
          ) : (
            <button 
              onClick={() => login()}
              className={cn(
                "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold transition-colors",
                theme === 'light' ? "bg-indigo-600 text-white hover:bg-indigo-500" : "bg-emerald-500 text-black hover:bg-emerald-400"
              )}
            >
              <LogIn size={18} />
              <span>Login with Google</span>
            </button>
          )}
        </div>
      </motion.aside>
    </>
  );
}

export default function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <Router>
      <AuthProvider>
        <AssistantProvider>
          <AppContent isSidebarOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
          <AuthDependentUI />
        </AssistantProvider>
      </AuthProvider>
    </Router>
  );
}

function AuthDependentUI() {
  const { user } = useAuth();
  if (!user) return null;
  return <NovaAssistantUI />;
}

function AppContent({ isSidebarOpen, setIsOpen }: { isSidebarOpen: boolean, setIsOpen: (v: boolean) => void }) {
  const location = useLocation();
  const { setLocation, theme } = useAssistant();
  const isLandingPage = location.pathname === "/";
  const isLoginPage = location.pathname === "/login";
  const isOnboardingPage = location.pathname === "/onboarding";
  const isSpecificClassroomPage = location.pathname.startsWith("/classroom/");
  const isMathTutorPage = location.pathname === "/math-tutor";
  const isAdminPage = location.pathname === "/admin";

  useEffect(() => {
    setLocation(location.pathname);
  }, [location.pathname, setLocation]);

  const { user } = useAuth();
  const shouldShowSidebar = !isLandingPage && !isLoginPage && !isOnboardingPage && !isSpecificClassroomPage && !isAdminPage && !isMathTutorPage && !!user;
  const shouldShowHeader = !isLandingPage && !isLoginPage && !isOnboardingPage; // Show header on all pages except landing, login, and onboarding

  const [dbStatus, setDbStatus] = useState<'connected' | 'disconnected' | 'loading'>('loading');

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch("/api/health");
        const data = await res.json();
        setDbStatus(data.database === "connected" ? "connected" : "disconnected");
      } catch (err) {
        setDbStatus("disconnected");
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-screen transition-colors duration-500 bg-theme-bg text-theme-text">
      {shouldShowSidebar && <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsOpen} />}
      
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {shouldShowHeader && (
          <header className="h-16 border-b border-theme-border flex items-center px-6 lg:px-8 justify-between bg-theme-header backdrop-blur-xl sticky top-0 z-30 transition-colors duration-500">
            <div className="flex items-center gap-4">
              {shouldShowSidebar ? (
                <button 
                  onClick={() => setIsOpen(true)}
                  className={cn(
                    "p-2 hover:bg-theme-text/5 rounded-lg transition-colors",
                    isSidebarOpen && "lg:hidden",
                    "text-theme-text-muted hover:text-theme-text"
                  )}
                >
                  <Menu size={20} />
                </button>
              ) : (
                <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", theme === 'light' ? "bg-indigo-600" : "bg-emerald-500")}>
                    <BookOpen size={18} className={theme === 'light' ? "text-white" : "text-black"} />
                  </div>
                  <span className="font-black tracking-tighter text-xl text-theme-text">LEARN-Z</span>
                </Link>
              )}
            </div>
            
            <div className="flex items-center gap-4">
              {!shouldShowSidebar && (
                <div className="hidden md:flex items-center gap-4">
                  <Link 
                    to="/learntube" 
                    className="text-sm font-bold transition-colors px-4 py-2 rounded-xl hover:bg-theme-text/5 text-theme-text-muted hover:text-theme-text"
                  >
                    Browse Courses
                  </Link>
                </div>
              )}

              <GlobalThemeSwitcher />

              <div className={cn(
                "flex items-center gap-2 px-3 py-1 rounded-full border transition-all",
                dbStatus === 'connected' 
                  ? "bg-theme-accent/10 border-theme-accent/20 text-theme-accent" 
                  : "bg-red-500/10 border-red-500/20 text-red-400"
              )}>
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  dbStatus === 'connected' ? (theme === 'light' ? "bg-indigo-600" : "bg-emerald-500 animate-pulse") : "bg-red-500"
                )} />
                <span className="text-[10px] uppercase tracking-widest font-bold hidden sm:inline-block">
                  {dbStatus === 'connected' ? "Learn-Z Core Active" : "Neural Core Offline"}
                </span>
                <span className="text-[10px] uppercase tracking-widest font-bold sm:hidden">
                  {dbStatus === 'connected' ? "Active" : "Offline"}
                </span>
              </div>
            </div>
          </header>
        )}

        <div className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/onboarding" element={
              <ProtectedRoute>
                <OnboardingPage />
              </ProtectedRoute>
            } />
            <Route path="/assistant" element={
              <ProtectedRoute>
                <AssistantPage />
              </ProtectedRoute>
            } />
            <Route path="/classroom/:courseId" element={
              <ProtectedRoute>
                <ClassroomPage />
              </ProtectedRoute>
            } />
            <Route path="/classroom" element={
              <ProtectedRoute>
                <ClassroomPage />
              </ProtectedRoute>
            } />
            <Route path="/learntube" element={
              <ProtectedRoute>
                <LearnTubePage />
              </ProtectedRoute>
            } />
            <Route path="/memory" element={
              <ProtectedRoute>
                <MemoryPage />
              </ProtectedRoute>
            } />
            <Route path="/admin" element={
              <ProtectedRoute adminOnly>
                <AdminPage />
              </ProtectedRoute>
            } />
            <Route path="/math-tutor" element={
              <ProtectedRoute>
                <MathTutorPage />
              </ProtectedRoute>
            } />
            <Route path="/subscription" element={
              <ProtectedRoute>
                <SubscriptionPage />
              </ProtectedRoute>
            } />
          </Routes>
        </div>
      </main>
    </div>
  );
}
