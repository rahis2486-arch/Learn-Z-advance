import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  BarChart3, TrendingUp, PieChart, BookOpen, 
  CheckCircle2, Clock, BrainCircuit, Sparkles,
  Target, Zap, Award, ChevronRight, Search,
  Filter, LayoutDashboard, History, MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart as RePieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { cn } from '../lib/utils';

interface DashboardStats {
  totalEnrolled: number;
  completedCourses: number;
  inProgressCourses: number;
  retentionMetrics: {
    courseId: string;
    title: string;
    retentionRate: number;
    engagementScore: number;
    quizPerformance: number;
  }[];
  activityHistory: {
    date: string;
    score: number;
    courseTitle: string;
  }[];
  courseScores: {
    id: string;
    title: string;
    averageScore: number;
    completedLessons: number;
    totalQuizzes: number;
    isCompleted: boolean;
    finalTest?: {
      score: number;
      totalQuestions: number;
      completed: boolean;
      attempts: number;
      feedback?: {
        strengths: string[];
        weaknesses: string[];
        suggestions: string[];
      };
    };
  }[];
  lessonResults: {
    id: string;
    courseTitle: string;
    lessonId: string;
    score: number;
    totalQuestions: number;
    percentage: number;
    feedback: {
      strengths: string[];
      weaknesses: string[];
      suggestions: string[];
    };
    completed: boolean;
    attempts: number;
  }[];
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'results' | 'feedback' | 'retention'>('overview');
  const [selectedCourse, setSelectedCourse] = useState<DashboardStats['courseScores'][0] | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;
      try {
        const res = await fetch(`/api/dashboard/stats/${user.uid}`);
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err) {
        console.error("Failed to fetch dashboard stats:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [user]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-theme-bg">
        <div className="w-12 h-12 border-4 border-theme-accent/20 border-t-theme-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (!stats) return null;

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];
  const pieData = [
    { name: 'Completed', value: stats.completedCourses },
    { name: 'In Progress', value: stats.inProgressCourses }
  ];

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-theme-accent">
            <LayoutDashboard size={24} />
            <h1 className="text-3xl font-bold tracking-tight text-theme-text">Student Dashboard</h1>
          </div>
          <p className="text-theme-text-muted">
            Track your learning journey, analyze your performance, and get AI-powered feedback.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-theme-card p-1 rounded-2xl border border-theme-border">
          {(['overview', 'results', 'feedback', 'retention'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-6 py-2 rounded-xl text-sm font-bold capitalize transition-all",
                activeTab === tab 
                  ? "bg-theme-accent text-theme-bg" 
                  : "text-theme-text-muted hover:text-theme-text hover:bg-theme-text/5"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: "Total Enrolled", value: stats.totalEnrolled, icon: BookOpen, color: "text-blue-500", bg: "bg-blue-500/10" },
          { label: "Completed", value: stats.completedCourses, icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "In Progress", value: stats.inProgressCourses, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
          { label: "Retention Avg.", value: `${Math.round(stats.retentionMetrics.reduce((acc, m) => acc + m.retentionRate, 0) / (stats.retentionMetrics.length || 1))}%`, icon: Target, color: "text-purple-500", bg: "bg-purple-500/10" }
        ].map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-theme-card border border-theme-border p-6 rounded-[32px] space-y-4"
          >
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", card.bg, card.color)}>
              <card.icon size={24} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-theme-text-muted">{card.label}</p>
              <p className="text-2xl font-bold text-theme-text">{card.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-8"
          >
            {/* Progress Over Time */}
            <div className="bg-theme-card border border-theme-border p-8 rounded-[32px] space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <TrendingUp size={20} className="text-theme-accent" />
                  Performance Over Time
                </h3>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.activityHistory.slice(-10)}>
                    <defs>
                      <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      stroke="#666" 
                      fontSize={10}
                      tickFormatter={(str) => new Date(str).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    />
                    <YAxis stroke="#666" fontSize={10} domain={[0, 100]} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '12px' }}
                      itemStyle={{ color: '#10b981' }}
                    />
                    <Area type="monotone" dataKey="score" stroke="#10b981" fillOpacity={1} fill="url(#colorScore)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Scores Per Course */}
            <div className="bg-theme-card border border-theme-border p-8 rounded-[32px] space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <BarChart3 size={20} className="text-theme-accent" />
                  Scores Per Course
                </h3>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.courseScores}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                    <XAxis dataKey="title" stroke="#666" fontSize={10} />
                    <YAxis stroke="#666" fontSize={10} domain={[0, 100]} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '12px' }}
                    />
                    <Bar dataKey="averageScore" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Completion Status */}
            <div className="bg-theme-card border border-theme-border p-8 rounded-[32px] space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <PieChart size={20} className="text-theme-accent" />
                  Completion Status
                </h3>
              </div>
              <div className="h-[300px] w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '12px' }}
                    />
                  </RePieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {pieData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="text-xs text-theme-text-muted">{entry.name}: {entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Course Enrollment Summary */}
            <div className="bg-theme-card border border-theme-border p-8 rounded-[32px] space-y-6">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <History size={20} className="text-theme-accent" />
                Course Summary
              </h3>
              <div className="space-y-4">
                {stats.courseScores.map((course) => (
                  <button 
                    key={course.id} 
                    onClick={() => setSelectedCourse(course)}
                    className="w-full text-left p-4 bg-theme-bg/50 rounded-2xl border border-theme-border/50 flex items-center justify-between hover:border-theme-accent transition-colors"
                  >
                    <div className="space-y-1">
                      <p className="font-bold text-sm">{course.title}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] text-theme-text-muted uppercase tracking-widest">
                          {course.completedLessons} Lessons Completed
                        </p>
                        {course.isCompleted && (
                          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 rounded text-[8px] font-bold uppercase">Completed</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-theme-accent">{Math.round(course.averageScore)}%</p>
                      <p className="text-[10px] text-theme-text-muted uppercase tracking-widest">Avg. Score</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'retention' && (
          <motion.div
            key="retention"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-8"
          >
            <div className="bg-theme-card border border-theme-border p-8 rounded-[32px] space-y-6">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Target size={24} className="text-theme-accent" />
                Retention & Engagement Metrics
              </h3>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.retentionMetrics}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                    <XAxis dataKey="title" stroke="#666" fontSize={10} />
                    <YAxis stroke="#666" fontSize={10} domain={[0, 100]} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '12px' }}
                    />
                    <Bar dataKey="retentionRate" name="Retention Rate" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="engagementScore" name="Engagement (Video)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="quizPerformance" name="Quiz Performance" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {stats.retentionMetrics.map((m) => (
                <div key={m.courseId} className="bg-theme-card border border-theme-border p-6 rounded-[32px] space-y-4">
                  <h4 className="font-bold text-theme-text truncate">{m.title}</h4>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-[10px] uppercase font-black mb-1">
                        <span className="text-theme-text-muted">Retention Rate</span>
                        <span className="text-emerald-500">{Math.round(m.retentionRate)}%</span>
                      </div>
                      <div className="h-1.5 bg-theme-text/5 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: `${m.retentionRate}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] uppercase font-black mb-1">
                        <span className="text-theme-text-muted">Engagement</span>
                        <span className="text-blue-500">{Math.round(m.engagementScore)}%</span>
                      </div>
                      <div className="h-1.5 bg-theme-text/5 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500" style={{ width: `${m.engagementScore}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'results' && (
          <motion.div
            key="results"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {stats.lessonResults.map((result, i) => (
                <div key={result.id} className="bg-theme-card border border-theme-border p-6 rounded-[32px] space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="px-3 py-1 bg-theme-accent/10 text-theme-accent rounded-full text-[10px] font-black uppercase tracking-widest">
                      {result.courseTitle}
                    </div>
                    <div className="flex items-center gap-1 text-theme-text-muted">
                      <History size={12} />
                      <span className="text-[10px] font-bold">{result.attempts} Attempts</span>
                    </div>
                  </div>
                  <h4 className="font-bold text-theme-text">Lesson {result.lessonId}</h4>
                  <div className="flex items-end justify-between">
                    <div className="space-y-1">
                      <p className="text-3xl font-bold text-theme-text">{result.score}/{result.totalQuestions}</p>
                      <p className="text-[10px] text-theme-text-muted uppercase tracking-widest font-black">Quiz Score</p>
                    </div>
                    <div className={cn(
                      "px-4 py-2 rounded-xl text-lg font-bold",
                      result.percentage >= 80 ? "bg-emerald-500/10 text-emerald-500" : 
                      result.percentage >= 50 ? "bg-amber-500/10 text-amber-500" : "bg-red-500/10 text-red-500"
                    )}>
                      {Math.round(result.percentage)}%
                    </div>
                  </div>
                  <div className="h-1.5 bg-theme-text/5 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all duration-1000",
                        result.percentage >= 80 ? "bg-emerald-500" : 
                        result.percentage >= 50 ? "bg-amber-500" : "bg-red-500"
                      )}
                      style={{ width: `${result.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'feedback' && (
          <motion.div
            key="feedback"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-8"
          >
            {stats.lessonResults.filter(r => r.feedback).map((result) => (
              <div key={`${result.id}-feedback`} className="bg-theme-card border border-theme-border p-8 rounded-[32px] space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-theme-border pb-6">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold text-theme-text">{result.courseTitle}</h3>
                      <span className="px-2 py-0.5 bg-theme-accent/10 text-theme-accent rounded-md text-[10px] font-black uppercase tracking-widest">
                        Lesson {result.lessonId}
                      </span>
                    </div>
                    <p className="text-sm text-theme-text-muted">AI-Generated Feedback based on your latest attempt</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-2xl font-bold text-theme-text">{Math.round(result.percentage)}%</p>
                      <p className="text-[10px] text-theme-text-muted uppercase tracking-widest font-black">Score</p>
                    </div>
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center",
                      result.percentage >= 80 ? "bg-emerald-500/10 text-emerald-500" : 
                      result.percentage >= 50 ? "bg-amber-500/10 text-amber-500" : "bg-red-500/10 text-red-500"
                    )}>
                      <Award size={24} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-emerald-500">
                      <CheckCircle2 size={18} />
                      <h4 className="text-xs font-black uppercase tracking-widest">Strengths</h4>
                    </div>
                    <ul className="space-y-2">
                      {result.feedback.strengths.map((s, i) => (
                        <li key={i} className="text-sm text-theme-text-muted flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-red-500">
                      <Zap size={18} />
                      <h4 className="text-xs font-black uppercase tracking-widest">Weaknesses</h4>
                    </div>
                    <ul className="space-y-2">
                      {result.feedback.weaknesses.map((w, i) => (
                        <li key={i} className="text-sm text-theme-text-muted flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                          {w}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-theme-accent">
                      <Sparkles size={18} />
                      <h4 className="text-xs font-black uppercase tracking-widest">AI Suggestions</h4>
                    </div>
                    <ul className="space-y-2">
                      {result.feedback.suggestions.map((s, i) => (
                        <li key={i} className="text-sm text-theme-text-muted flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-theme-accent mt-1.5 shrink-0" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Course Detail Modal */}
      <AnimatePresence>
        {selectedCourse && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-theme-card border border-theme-border w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-[40px] shadow-2xl"
            >
              <div className="p-8 space-y-8">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <h2 className="text-3xl font-bold text-theme-text">{selectedCourse.title}</h2>
                    <div className="flex items-center gap-4">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                        selectedCourse.isCompleted ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
                      )}>
                        {selectedCourse.isCompleted ? "Completed" : "In Progress"}
                      </span>
                      <span className="text-theme-text-muted text-sm">{selectedCourse.completedLessons} Lessons Completed</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedCourse(null)}
                    className="w-10 h-10 rounded-full bg-theme-bg flex items-center justify-center text-theme-text-muted hover:text-theme-text transition-colors"
                  >
                    <Zap size={20} className="rotate-45" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Quizzes Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <BrainCircuit size={20} className="text-theme-accent" />
                      Lesson Quizzes
                    </h3>
                    <div className="space-y-3">
                      {stats.lessonResults.filter(r => r.courseTitle === selectedCourse.title).map(result => (
                        <div key={result.id} className="p-4 bg-theme-bg/50 rounded-2xl border border-theme-border/50 flex items-center justify-between">
                          <div>
                            <p className="font-bold text-sm">Lesson {result.lessonId}</p>
                            <p className="text-[10px] text-theme-text-muted uppercase tracking-widest">{result.attempts} Attempts</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-theme-accent">{result.score}/{result.totalQuestions}</p>
                            <p className="text-[10px] text-theme-text-muted uppercase tracking-widest">{Math.round(result.percentage)}%</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Final Test Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <Award size={20} className="text-theme-accent" />
                      Final Test Results
                    </h3>
                    {selectedCourse.finalTest ? (
                      <div className="p-6 bg-theme-accent/5 rounded-3xl border border-theme-accent/20 space-y-6">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <p className="text-4xl font-bold text-theme-text">{selectedCourse.finalTest.score}/{selectedCourse.finalTest.totalQuestions}</p>
                            <p className="text-[10px] text-theme-text-muted uppercase tracking-widest font-black">Final Score</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-bold text-theme-accent">{selectedCourse.finalTest.attempts}</p>
                            <p className="text-[10px] text-theme-text-muted uppercase tracking-widest font-black">Attempts</p>
                          </div>
                        </div>

                        {selectedCourse.finalTest.feedback && (
                          <div className="space-y-4 pt-4 border-t border-theme-accent/10">
                            <div className="flex items-center gap-2 text-theme-accent">
                              <Sparkles size={16} />
                              <h4 className="text-[10px] font-black uppercase tracking-widest">AI Feedback</h4>
                            </div>
                            <div className="grid grid-cols-1 gap-4">
                              <div className="space-y-2">
                                <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Strengths</p>
                                <p className="text-xs text-theme-text-muted leading-relaxed">{selectedCourse.finalTest.feedback.strengths[0]}</p>
                              </div>
                              <div className="space-y-2">
                                <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Weaknesses</p>
                                <p className="text-xs text-theme-text-muted leading-relaxed">{selectedCourse.finalTest.feedback.weaknesses[0]}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-8 bg-theme-bg/50 rounded-3xl border border-theme-border/50 border-dashed flex flex-col items-center justify-center text-center space-y-2">
                        <Clock size={32} className="text-theme-text-muted" />
                        <p className="text-sm font-bold text-theme-text">Final Test Not Taken</p>
                        <p className="text-xs text-theme-text-muted">Complete all lessons to unlock the final test.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
