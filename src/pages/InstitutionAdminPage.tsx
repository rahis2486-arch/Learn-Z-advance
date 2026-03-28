import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  BarChart3, Users, BookOpen, Mail, 
  Search, Plus, Trash2, ChevronRight, 
  TrendingUp, Trophy, CheckCircle2, Clock,
  ShieldCheck, LayoutDashboard, Settings,
  Loader2, AlertCircle, Filter, Download,
  ExternalLink, User as UserIcon, PieChart as PieChartIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, LineChart, Line,
  PieChart, Pie, Cell
} from 'recharts';

type Tab = 'dashboard' | 'courses' | 'emails' | 'students';

export default function InstitutionAdminPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [stats, setStats] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [permittedEmails, setPermittedEmails] = useState<string[]>([]);
  const [institution, setInstitution] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search and filter states
  const [studentSearch, setStudentSearch] = useState('');
  const [emailSearch, setEmailSearch] = useState('');
  const [courseSearch, setCourseSearch] = useState('');
  const [courseResults, setCourseResults] = useState<any[]>([]);
  const [searchingCourses, setSearchingCourses] = useState(false);
  const [newEmail, setNewEmail] = useState('');

  useEffect(() => {
    if (user?.institutionId) {
      fetchAllData();
    }
  }, [user]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (courseSearch.trim()) {
        searchCourses();
      } else {
        setCourseResults([]);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [courseSearch]);

  const searchCourses = async () => {
    try {
      setSearchingCourses(true);
      const res = await fetch(`/api/courses?search=${encodeURIComponent(courseSearch)}&limit=5`);
      if (res.ok) {
        const data = await res.json();
        setCourseResults(data.courses || []);
      }
    } catch (err) {
      console.error("Failed to search courses:", err);
    } finally {
      setSearchingCourses(false);
    }
  };

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const headers = { 'x-user-uid': user?.uid || '' };
      
      const [statsRes, studentsRes, recsRes, detailsRes] = await Promise.all([
        fetch(`/api/institution/stats/${user?.institutionId}`, { headers }),
        fetch(`/api/institution/students/${user?.institutionId}`, { headers }),
        fetch(`/api/recommendations/${user?.institutionId}`, { headers }),
        fetch(`/api/institution/details/${user?.institutionId}`, { headers })
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (studentsRes.ok) setStudents(await studentsRes.json());
      if (recsRes.ok) setRecommendations(await recsRes.json());
      if (detailsRes.ok) {
        const data = await detailsRes.json();
        setInstitution(data);
        setPermittedEmails(data.allowedEmails || []);
      }
    } catch (err) {
      console.error("Failed to fetch institution data:", err);
      setError("Failed to load institution data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddEmail = async () => {
    if (!newEmail || !newEmail.includes('@')) return;
    if (permittedEmails.includes(newEmail)) return;

    const updatedEmails = [...permittedEmails, newEmail];
    try {
      const res = await fetch(`/api/institution/emails/${user?.institutionId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-uid': user?.uid || ''
        },
        body: JSON.stringify({ emails: updatedEmails })
      });
      if (res.ok) {
        setPermittedEmails(updatedEmails);
        setNewEmail('');
      }
    } catch (err) {
      console.error("Failed to add email:", err);
    }
  };

  const handleRemoveEmail = async (email: string) => {
    const updatedEmails = permittedEmails.filter(e => e !== email);
    try {
      const res = await fetch(`/api/institution/emails/${user?.institutionId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-uid': user?.uid || ''
        },
        body: JSON.stringify({ emails: updatedEmails })
      });
      if (res.ok) {
        setPermittedEmails(updatedEmails);
      }
    } catch (err) {
      console.error("Failed to remove email:", err);
    }
  };

  const handleRemoveRecommendation = async (courseId: string) => {
    try {
      const res = await fetch(`/api/recommendations/${user?.institutionId}/${courseId}`, {
        method: 'DELETE',
        headers: { 'x-user-uid': user?.uid || '' }
      });
      if (res.ok) {
        setRecommendations(recommendations.filter(r => r._id !== courseId));
      }
    } catch (err) {
      console.error("Failed to remove recommendation:", err);
    }
  };

  const handleAddRecommendation = async (courseId: string) => {
    try {
      const res = await fetch(`/api/recommendations`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-uid': user?.uid || ''
        },
        body: JSON.stringify({ 
          institutionId: user?.institutionId,
          courseId,
          recommendedBy: user?.uid
        })
      });
      if (res.ok) {
        const newRec = await res.json();
        // Since the backend returns the recommendation object, we need to fetch the course details or find it in results
        const course = courseResults.find(c => c._id === courseId);
        if (course) {
          setRecommendations([course, ...recommendations]);
        }
        setCourseSearch('');
        setCourseResults([]);
      } else {
        const errorData = await res.json();
        alert(errorData.error || "Failed to add recommendation");
      }
    } catch (err) {
      console.error("Failed to add recommendation:", err);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-12 h-12 text-theme-accent animate-spin" />
        <p className="text-sm font-bold text-theme-text/40 uppercase tracking-widest">Loading Institution Command Center...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-4">
        <AlertCircle className="w-16 h-16 text-red-500" />
        <h2 className="text-2xl font-black text-theme-text">Access Denied or Error</h2>
        <p className="text-theme-text/60 max-w-md">{error}</p>
      </div>
    );
  }

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="h-full flex flex-col bg-theme-bg overflow-hidden">
      {/* Header */}
      <header className="p-6 lg:p-8 border-b border-theme-border bg-theme-card/50 backdrop-blur-xl shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-theme-bg border border-theme-border p-2 flex items-center justify-center shadow-inner">
              {institution?.logoUrl ? (
                <img src={institution.logoUrl} alt="" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
              ) : (
                <ShieldCheck size={32} className="text-theme-accent" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-theme-text">{institution?.name}</h1>
              <p className="text-xs font-black uppercase tracking-widest text-theme-text/40">Institution Admin Command Center</p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-1 rounded-2xl bg-theme-bg border border-theme-border">
            {(['dashboard', 'courses', 'emails', 'students'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                  activeTab === tab 
                    ? "bg-theme-accent text-white shadow-lg shadow-theme-accent/20" 
                    : "text-theme-text/40 hover:text-theme-text hover:bg-theme-text/5"
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Content Area */}
      <main className="flex-1 overflow-y-auto p-6 lg:p-8">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard icon={Users} label="Total Students" value={stats?.totalStudents} color="text-emerald-500" />
                <StatCard icon={BookOpen} label="Total Enrollments" value={stats?.totalEnrollments} color="text-blue-500" />
                <StatCard icon={CheckCircle2} label="Completion Rate" value={`${Math.round(stats?.completionRate)}%`} color="text-amber-500" />
                <StatCard icon={TrendingUp} label="Avg. Quiz Score" value={`${Math.round(stats?.averageScore)}%`} color="text-purple-500" />
              </div>

              {/* Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="p-8 rounded-[2rem] bg-theme-card border border-theme-border space-y-6">
                  <h3 className="text-sm font-black uppercase tracking-widest text-theme-text/60 flex items-center gap-2">
                    <BarChart3 size={18} className="text-theme-accent" />
                    Course Enrollment Distribution
                  </h3>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats?.courseStats}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis 
                          dataKey="courseInfo.title" 
                          stroke="rgba(255,255,255,0.4)" 
                          fontSize={10} 
                          tickFormatter={(val) => val.length > 15 ? val.substring(0, 15) + '...' : val}
                        />
                        <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                          itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                        />
                        <Bar dataKey="enrollmentCount" fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="completionCount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="p-8 rounded-[2rem] bg-theme-card border border-theme-border space-y-6">
                  <h3 className="text-sm font-black uppercase tracking-widest text-theme-text/60 flex items-center gap-2">
                    <PieChartIcon size={18} className="text-theme-accent" />
                    Completion Status
                  </h3>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Completed', value: stats?.completions },
                            { name: 'In Progress', value: stats?.totalEnrollments - stats?.completions }
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          <Cell fill="#10b981" />
                          <Cell fill="rgba(255,255,255,0.05)" />
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'courses' && (
            <motion.div
              key="courses"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                  <h2 className="text-xl font-black text-theme-text">Recommended Courses</h2>
                  <p className="text-sm text-theme-text/40">{recommendations.length} Courses Recommended to Students</p>
                </div>

                <div className="relative w-full md:w-96">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-text/40" size={18} />
                    <input 
                      type="text"
                      value={courseSearch}
                      onChange={(e) => setCourseSearch(e.target.value)}
                      placeholder="Search courses to recommend..."
                      className="w-full pl-12 pr-6 py-4 rounded-2xl bg-theme-card border border-theme-border focus:border-theme-accent outline-none font-bold text-sm transition-all shadow-lg shadow-black/5"
                    />
                    {searchingCourses && (
                      <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-theme-accent animate-spin" />
                    )}
                  </div>

                  {/* Search Results Dropdown */}
                  <AnimatePresence>
                    {courseResults.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute top-full left-0 right-0 mt-2 p-2 rounded-2xl bg-theme-card border border-theme-border shadow-2xl z-50 overflow-hidden"
                      >
                        {courseResults.map((course) => {
                          const isAlreadyRecommended = recommendations.some(r => r._id === course._id);
                          return (
                            <div key={course._id} className="flex items-center justify-between p-3 rounded-xl hover:bg-theme-text/5 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg overflow-hidden border border-theme-border">
                                  <img src={course.thumbnail} alt="" className="w-full h-full object-cover" />
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-theme-text line-clamp-1">{course.title}</p>
                                  <p className="text-[10px] font-black uppercase tracking-widest text-theme-text/40">{course.category}</p>
                                </div>
                              </div>
                              <button
                                onClick={() => handleAddRecommendation(course._id)}
                                disabled={isAlreadyRecommended}
                                className={cn(
                                  "p-2 rounded-lg transition-all",
                                  isAlreadyRecommended 
                                    ? "text-emerald-500 bg-emerald-500/10 cursor-default" 
                                    : "text-theme-accent hover:bg-theme-accent/10"
                                )}
                              >
                                {isAlreadyRecommended ? <CheckCircle2 size={18} /> : <Plus size={18} />}
                              </button>
                            </div>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {recommendations.map((course) => (
                  <div key={course._id} className="group p-6 rounded-[2rem] bg-theme-card border border-theme-border hover:border-theme-accent/50 transition-all space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl overflow-hidden border border-theme-border shrink-0">
                          <img src={course.thumbnail} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <h3 className="font-bold text-theme-text line-clamp-1">{course.title}</h3>
                          <p className="text-[10px] font-black uppercase tracking-widest text-theme-text/40">{course.category}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleRemoveRecommendation(course._id)}
                        className="p-2 rounded-xl text-red-500 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-theme-border/5">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-theme-text/40">Enrolled</p>
                        <p className="text-sm font-bold text-theme-text">
                          {stats?.courseStats?.find((s: any) => s._id === course._id)?.enrollmentCount || 0} Students
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-theme-text/40">Completion</p>
                        <p className="text-sm font-bold text-emerald-500">
                          {stats?.courseStats?.find((s: any) => s._id === course._id)?.completionCount || 0} Finished
                        </p>
                      </div>
                    </div>
                  </div>
                ))}

                {recommendations.length === 0 && (
                  <div className="col-span-full p-12 rounded-[2rem] border-2 border-dashed border-theme-border flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-theme-text/5 flex items-center justify-center">
                      <BookOpen size={32} className="text-theme-text/20" />
                    </div>
                    <div>
                      <h3 className="font-bold text-theme-text">No recommendations yet</h3>
                      <p className="text-sm text-theme-text/40">Use Nova or the course browser to recommend courses to your students.</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'emails' && (
            <motion.div
              key="emails"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-3xl mx-auto space-y-8"
            >
              <div className="p-8 rounded-[2.5rem] bg-theme-card border border-theme-border space-y-8">
                <div className="space-y-2">
                  <h2 className="text-xl font-black text-theme-text">Permitted Gmail Management</h2>
                  <p className="text-sm text-theme-text/60">Manage which email addresses are authorized for institutional login.</p>
                </div>

                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-text/40" size={18} />
                    <input 
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="Enter student's Gmail address..."
                      className="w-full pl-12 pr-6 py-4 rounded-2xl bg-theme-bg border border-theme-border focus:border-theme-accent outline-none font-bold text-sm transition-all"
                    />
                  </div>
                  <button 
                    onClick={handleAddEmail}
                    className="px-8 py-4 rounded-2xl bg-theme-accent text-white font-black uppercase tracking-widest text-xs hover:scale-105 transition-transform shadow-xl shadow-theme-accent/20 flex items-center gap-2"
                  >
                    <Plus size={18} />
                    Add
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-theme-text/40">Authorized Emails ({permittedEmails.length})</h3>
                    <div className="relative w-48">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-text/40" size={14} />
                      <input 
                        type="text"
                        value={emailSearch}
                        onChange={(e) => setEmailSearch(e.target.value)}
                        placeholder="Filter list..."
                        className="w-full pl-9 pr-4 py-2 rounded-xl bg-theme-bg border border-theme-border text-xs outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {permittedEmails
                      .filter(e => e.toLowerCase().includes(emailSearch.toLowerCase()))
                      .map((email) => (
                        <div key={email} className="flex items-center justify-between p-4 rounded-2xl bg-theme-bg border border-theme-border group hover:border-theme-accent/30 transition-all">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-theme-accent/10 flex items-center justify-center text-theme-accent">
                              <Mail size={16} />
                            </div>
                            <span className="text-sm font-bold text-theme-text">{email}</span>
                          </div>
                          <button 
                            onClick={() => handleRemoveEmail(email)}
                            className="p-2 rounded-xl text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'students' && (
            <motion.div
              key="students"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h2 className="text-lg font-black text-theme-text">Student Management</h2>
                  <p className="text-xs font-bold text-theme-text/40">{students.length} Registered Students</p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative w-64">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-text/40" size={18} />
                    <input 
                      type="text"
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      placeholder="Search by name or email..."
                      className="w-full pl-12 pr-6 py-3 rounded-2xl bg-theme-card border border-theme-border focus:border-theme-accent outline-none font-bold text-sm transition-all"
                    />
                  </div>
                  <button className="p-3 rounded-2xl bg-theme-card border border-theme-border text-theme-text/60 hover:text-theme-text hover:bg-theme-text/5 transition-colors">
                    <Filter size={20} />
                  </button>
                  <button className="p-3 rounded-2xl bg-theme-card border border-theme-border text-theme-text/60 hover:text-theme-text hover:bg-theme-text/5 transition-colors">
                    <Download size={20} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {students
                  .filter(s => 
                    s.displayName?.toLowerCase().includes(studentSearch.toLowerCase()) || 
                    s.email?.toLowerCase().includes(studentSearch.toLowerCase())
                  )
                  .map((student) => (
                    <div key={student.uid} className="p-6 rounded-[2rem] bg-theme-card border border-theme-border hover:border-theme-accent/30 transition-all">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                        {/* Student Info */}
                        <div className="flex items-center gap-4 min-w-[300px]">
                          <div className="w-14 h-14 rounded-2xl overflow-hidden border border-theme-border shrink-0">
                            {student.photoURL ? (
                              <img src={student.photoURL} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-theme-accent/10 flex items-center justify-center text-theme-accent">
                                <UserIcon size={24} />
                              </div>
                            )}
                          </div>
                          <div>
                            <h3 className="font-bold text-theme-text">{student.displayName}</h3>
                            <p className="text-xs text-theme-text/40 font-medium">{student.email}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] font-black uppercase tracking-widest text-theme-accent">@{student.username}</span>
                              <span className="w-1 h-1 rounded-full bg-theme-border" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-theme-text/40">Joined {new Date(student.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>

                        {/* Enrollment Stats */}
                        <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-8">
                          <StudentMetric label="Enrollments" value={student.enrollments?.length || 0} />
                          <StudentMetric 
                            label="Completions" 
                            value={student.enrollments?.filter((e: any) => e.isCompleted).length || 0} 
                            color="text-emerald-500"
                          />
                          <StudentMetric 
                            label="Avg. Score" 
                            value={`${Math.round(student.enrollments?.reduce((acc: number, e: any) => {
                              const quizzes = e.lessonQuizzes || [];
                              if (quizzes.length === 0) return acc;
                              return acc + (quizzes.reduce((s: number, q: any) => s + (q.score / q.totalQuestions), 0) / quizzes.length) * 100;
                            }, 0) / (student.enrollments?.length || 1))}%`}
                            color="text-blue-500"
                          />
                          <StudentMetric label="Last Active" value={new Date(student.lastLogin || student.updatedAt).toLocaleDateString()} />
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          <button className="px-4 py-2 rounded-xl bg-theme-text/5 text-theme-text/60 text-[10px] font-black uppercase tracking-widest hover:bg-theme-text/10 hover:text-theme-text transition-all">
                            View Details
                          </button>
                          <button className="p-2 rounded-xl bg-theme-text/5 text-theme-text/60 hover:text-theme-accent transition-all">
                            <ExternalLink size={18} />
                          </button>
                        </div>
                      </div>

                      {/* Expanded View (Enrollments) */}
                      {student.enrollments?.length > 0 && (
                        <div className="mt-6 pt-6 border-t border-theme-border/5">
                          <div className="flex flex-wrap gap-4">
                            {student.enrollments.map((enrollment: any) => (
                              <div key={enrollment._id} className="flex items-center gap-3 p-3 rounded-2xl bg-theme-bg border border-theme-border">
                                <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0">
                                  <img src={enrollment.courseId?.thumbnail} alt="" className="w-full h-full object-cover" />
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold text-theme-text line-clamp-1">{enrollment.courseId?.title}</p>
                                  <div className="flex items-center gap-2">
                                    <div className="w-24 h-1 bg-theme-text/5 rounded-full overflow-hidden">
                                      <div 
                                        className="h-full bg-theme-accent" 
                                        style={{ width: `${Math.round(((enrollment.completedLessons?.length || 0) / 10) * 100)}%` }}
                                      />
                                    </div>
                                    <span className="text-[8px] font-black text-theme-text/40">
                                      {Math.round(((enrollment.completedLessons?.length || 0) / 10) * 100)}%
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: any) {
  return (
    <div className="p-8 rounded-[2.5rem] bg-theme-card border border-theme-border space-y-4">
      <div className={cn("w-12 h-12 rounded-2xl bg-theme-bg border border-theme-border flex items-center justify-center", color)}>
        <Icon size={24} />
      </div>
      <div>
        <p className="text-3xl font-black text-theme-text">{value}</p>
        <p className="text-[10px] font-black uppercase tracking-widest text-theme-text/40">{label}</p>
      </div>
    </div>
  );
}

function StudentMetric({ label, value, color }: any) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-theme-text/40 mb-1">{label}</p>
      <p className={cn("text-sm font-bold", color || "text-theme-text")}>{value}</p>
    </div>
  );
}
