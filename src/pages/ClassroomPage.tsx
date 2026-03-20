import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { 
  ChevronLeft, ChevronRight, Play, CheckCircle2, 
  BookOpen, Video, FileText, MessageSquare, 
  Maximize2, Volume2, Settings, List,
  Sparkles, BrainCircuit, Mic, Camera, X
} from "lucide-react";
import { cn } from "../lib/utils";
import { useAssistant } from "../contexts/AssistantContext";
import { useAuth } from "../contexts/AuthContext";
import { LogIn } from "lucide-react";

interface Course {
  _id: string;
  title: string;
  description: string;
  thumbnail: string;
  tags?: string[];
  category?: string;
}

interface Lesson {
  _id: string;
  videoNumber: number;
  title: string;
  youtubeUrl: string;
  transcript: string;
  summary: string;
  notesTitle?: string;
  notesDescription?: string;
}

export default function ClassroomPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [myCourses, setMyCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<"content" | "notes" | "transcript">("content");
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [userProgress, setUserProgress] = useState<any>(null);

  const { setContext, toggleSidebar, isSidebarOpen, theme } = useAssistant();

  useEffect(() => {
    if (course && currentLesson) {
      setContext({
        courseTitle: course.title,
        lessonTitle: currentLesson.title,
        transcript: currentLesson.transcript,
        summary: currentLesson.summary
      });
    }
  }, [course, currentLesson, setContext]);

  useEffect(() => {
    return () => setContext(null);
  }, [setContext]);

  useEffect(() => {
    if (courseId) {
      fetchCourseData();
    } else if (user) {
      fetchMyCourses();
    }
  }, [courseId, user]);

  const fetchMyCourses = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/progress/${user.uid}`);
      if (res.ok) {
        const data = await res.json();
        setMyCourses(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCourseData = async () => {
    try {
      setLoading(true);
      setContext(null); // Clear context for clean transition
      const [courseRes, lessonsRes] = await Promise.all([
        fetch(`/api/courses/${courseId}`),
        fetch(`/api/courses/${courseId}/lessons`)
      ]);
      
      if (!courseRes.ok) throw new Error("Course not found");
      
      const courseData = await courseRes.json();
      const lessonsData = await lessonsRes.json();
      
      setCourse(courseData);
      setLessons(lessonsData);
      if (lessonsData.length > 0) {
        setCurrentLesson(lessonsData[0]);
      }

      // Fetch user progress for this course
      if (user) {
        const progressRes = await fetch(`/api/progress/${user.uid}`);
        if (progressRes.ok) {
          const allProgress = await progressRes.json();
          const currentProgress = allProgress.find((p: any) => p.courseId?._id === courseId);
          setUserProgress(currentProgress);
        }
      }
    } catch (err) {
      console.error(err);
      setCourse(null);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkLessonComplete = async () => {
    if (!user || !courseId || !currentLesson) return;
    try {
      const res = await fetch(`/api/progress/${user.uid}/${courseId}/lesson/${currentLesson._id}`, {
        method: 'POST'
      });
      if (res.ok) {
        const updatedProgress = await res.json();
        // Since the backend doesn't populate courseId in the return, we need to handle it
        setUserProgress({ ...updatedProgress, courseId: course });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkCourseComplete = async () => {
    if (!user || !courseId) return;
    setIsRatingModalOpen(true);
  };

  const handleSubmitRating = async () => {
    if (!user || !courseId) return;
    setIsSubmittingRating(true);
    try {
      const res = await fetch(`/api/progress/${user.uid}/${courseId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating })
      });
      if (res.ok) {
        const updatedProgress = await res.json();
        setUserProgress({ ...updatedProgress, courseId: course });
        setIsRatingModalOpen(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const getYoutubeEmbedUrl = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : null;
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-theme-bg">
        <div className="space-y-4 text-center">
          <div className="w-12 h-12 border-4 border-theme-accent/20 border-t-theme-accent rounded-full animate-spin mx-auto" />
          <p className="text-theme-text-muted font-medium">Entering Classroom...</p>
        </div>
      </div>
    );
  }

  if (!course) {
    if (!courseId) {
      return (
        <div className="h-full flex flex-col bg-[#050505] p-6 lg:p-10">
          <header className="mb-10">
            <h1 className="text-3xl font-bold tracking-tight mb-2">
              Welcome back, {user?.displayName?.split(' ')[0]}!
            </h1>
            <p className="text-white/40">Select a course to continue your learning journey.</p>
          </header>

          {myCourses.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {myCourses.map((progress) => (
                <motion.div
                  key={progress._id}
                  whileHover={{ y: -5 }}
                  onClick={() => navigate(`/classroom/${progress.courseId?._id}`)}
                  className="bg-theme-card border border-theme-border rounded-[32px] overflow-hidden cursor-pointer hover:border-theme-accent/30 transition-all duration-500 group flex flex-col"
                >
                  <div className="aspect-video relative overflow-hidden">
                    <img 
                      src={progress.courseId?.thumbnail} 
                      alt="" 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-theme-card via-transparent to-transparent opacity-60" />
                    <div className="absolute inset-0 bg-theme-accent/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-theme-accent flex items-center justify-center scale-75 group-hover:scale-100 transition-transform duration-500">
                        <Play className={cn("ml-1", theme === 'light' ? "text-white" : "text-black fill-black")} size={24} />
                      </div>
                    </div>
                  </div>
                  <div className="p-8 flex-1 flex flex-col space-y-4">
                    <h3 className="text-lg font-semibold text-theme-text group-hover:text-theme-accent transition-colors line-clamp-2">
                      {progress.courseId?.title}
                    </h3>
                    <div className="space-y-3 pt-4 border-t border-theme-border/5">
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                        <span className="text-theme-text-muted">Progress</span>
                        <span className="text-theme-accent">{Math.round(((progress.completedLessons?.length || 0) / 10) * 100)}%</span>
                      </div>
                      <div className="h-1.5 bg-theme-text/5 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${((progress.completedLessons?.length || 0) / 10) * 100}%` }}
                          className="h-full bg-theme-accent rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                        />
                      </div>
                      <div className="flex items-center justify-between pt-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-theme-text/20">
                          {progress.completedLessons?.length || 0} Lessons Done
                        </span>
                        <div className="w-8 h-8 rounded-full bg-theme-text/5 flex items-center justify-center group-hover:bg-theme-accent group-hover:text-theme-bg transition-all">
                          <ChevronRight size={16} />
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center space-y-6">
              <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center">
                <BookOpen size={40} className="text-white/20" />
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold">No courses enrolled yet</h2>
                <p className="text-white/40">Head over to LearnTube to find your first course!</p>
              </div>
              <button 
                onClick={() => navigate("/learntube")}
                className="px-6 py-2 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-colors"
              >
                Browse Courses
              </button>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col items-center justify-center bg-theme-bg space-y-6">
        <div className="w-20 h-20 bg-theme-text/5 rounded-full flex items-center justify-center">
          <BookOpen size={40} className="text-theme-text/20" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">Course not found</h2>
          <p className="text-theme-text-muted">The course you're looking for doesn't exist or has been removed.</p>
        </div>
        <button 
          onClick={() => navigate("/learntube")}
          className={cn(
            "px-6 py-2 font-bold rounded-xl transition-colors",
            theme === 'light' ? "bg-indigo-600 text-white hover:bg-indigo-500" : "bg-emerald-500 text-black hover:bg-emerald-400"
          )}
        >
          Back to LearnTube
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-theme-bg overflow-hidden relative">
      {/* Left Sidebar: Lesson Navigation */}
      <motion.div 
        initial={false}
        animate={{ 
          width: sidebarOpen ? (window.innerWidth < 1024 ? "100%" : 320) : 0, 
          opacity: sidebarOpen ? 1 : 0,
          x: sidebarOpen ? 0 : -320
        }}
        className={cn(
          "fixed lg:relative inset-y-0 left-0 z-40 border-r border-theme-border bg-theme-card flex flex-col overflow-hidden transition-all duration-300",
          !sidebarOpen && "lg:border-none"
        )}
      >
        <div className="p-6 border-b border-theme-border space-y-4">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => navigate("/classroom")}
              className="flex items-center gap-2 text-xs font-bold text-theme-text-muted hover:text-theme-text transition-colors"
            >
              <ChevronLeft size={14} />
              Back to Classroom
            </button>
            <button 
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 text-theme-text-muted hover:text-theme-text"
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex items-center gap-2 text-theme-accent">
            <Video size={18} />
            <span className="text-xs font-black uppercase tracking-widest">Course Content</span>
          </div>
          <h2 className="text-base font-semibold line-clamp-2">{course.title}</h2>
          <div className="flex flex-wrap gap-1.5">
            <span className="px-2 py-0.5 rounded-md bg-theme-accent/10 text-theme-accent text-[10px] font-black uppercase tracking-widest">
              {course.category || "General"}
            </span>
            {course.tags?.map(tag => (
              <span key={tag} className="px-2 py-0.5 rounded-md bg-theme-text/5 text-theme-text/40 text-[10px] font-bold">
                #{tag}
              </span>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {lessons.map((lesson) => (
            <button
              key={lesson._id}
              onClick={() => {
                setCurrentLesson(lesson);
                if (window.innerWidth < 1024) setSidebarOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-4 p-4 rounded-2xl transition-all group relative",
                currentLesson?._id === lesson._id 
                  ? "bg-theme-accent/10 border border-theme-accent/20 text-theme-text" 
                  : "text-theme-text-muted hover:bg-theme-text/5 hover:text-theme-text"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-colors",
                currentLesson?._id === lesson._id 
                  ? (theme === 'light' ? "bg-indigo-600 text-white" : "bg-emerald-500 text-black") 
                  : "bg-theme-text/5 group-hover:bg-theme-text/10"
              )}>
                {lesson.videoNumber}
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium line-clamp-1">{lesson.title}</p>
                <p className="text-[10px] opacity-50 uppercase tracking-wider">12:45</p>
              </div>
              {userProgress?.completedLessons?.includes(lesson._id) && (
                <CheckCircle2 size={16} className="text-theme-accent" />
              )}
              {currentLesson?._id === lesson._id && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-theme-accent rounded-r-full" />
              )}
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-theme-border space-y-4">
          <div className="bg-theme-text/5 rounded-2xl p-4 space-y-3">
            <div className="flex justify-between text-xs">
              <span className="text-theme-text-muted">Your Progress</span>
              <span className="text-theme-accent font-bold">
                {lessons.length > 0 ? Math.round(((userProgress?.completedLessons?.length || 0) / lessons.length) * 100) : 0}%
              </span>
            </div>
            <div className="h-1.5 bg-theme-text/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-theme-accent rounded-full transition-all duration-500" 
                style={{ width: `${lessons.length > 0 ? ((userProgress?.completedLessons?.length || 0) / lessons.length) * 100 : 0}%` }}
              />
            </div>
          </div>
          
          <button
            onClick={handleMarkCourseComplete}
            disabled={userProgress?.isCompleted}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all",
              userProgress?.isCompleted
                ? "bg-emerald-500/10 text-emerald-500 cursor-default"
                : "bg-theme-accent text-white hover:opacity-90"
            )}
          >
            <CheckCircle2 size={18} />
            {userProgress?.isCompleted ? "Course Completed" : "Mark Course as Completed"}
          </button>
        </div>
      </motion.div>

      {/* Center Canvas: Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 border-b border-theme-border flex items-center justify-between px-4 lg:px-6 bg-theme-header backdrop-blur-md z-10">
          <div className="flex items-center gap-2 lg:gap-4">
            <button 
              onClick={() => navigate("/learntube")}
              className="p-2 hover:bg-theme-text/5 rounded-lg text-theme-text-muted hover:text-theme-text transition-colors"
              title="Exit Classroom"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="hidden sm:block h-4 w-px bg-theme-border" />
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-theme-text/5 rounded-lg text-theme-text-muted hover:text-theme-text transition-colors"
            >
              <List size={20} />
            </button>
            <div className="hidden sm:block h-4 w-px bg-theme-border" />
            <h3 className="font-bold truncate max-w-[150px] sm:max-w-md">{currentLesson?.title}</h3>
          </div>

          <div className="flex items-center gap-2 lg:gap-4">
            <button
              onClick={handleMarkLessonComplete}
              disabled={userProgress?.completedLessons?.includes(currentLesson?._id)}
              className={cn(
                "flex items-center gap-2 px-3 lg:px-4 py-2 rounded-xl text-sm font-bold transition-all",
                userProgress?.completedLessons?.includes(currentLesson?._id)
                  ? "bg-emerald-500/10 text-emerald-500 cursor-default"
                  : "bg-theme-text/5 text-theme-text hover:bg-theme-text/10"
              )}
            >
              <CheckCircle2 size={16} />
              <span className="hidden sm:inline">
                {userProgress?.completedLessons?.includes(currentLesson?._id) ? "Lesson Completed" : "Mark Lesson as Completed"}
              </span>
            </button>
            <button 
              onClick={toggleSidebar}
              className={cn(
                "flex items-center gap-2 px-3 lg:px-4 py-2 rounded-xl text-sm font-bold transition-all",
                isSidebarOpen 
                  ? (theme === 'light' ? "bg-indigo-600 text-white" : "bg-emerald-500 text-black") 
                  : "bg-theme-text/5 text-theme-accent hover:bg-theme-text/10"
              )}
            >
              <Sparkles size={16} />
              <span className="hidden sm:inline">{isSidebarOpen ? "Close Nova" : "Ask Nova"}</span>
            </button>
          </div>
        </header>

        {/* Workspace Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto p-6 lg:p-10 space-y-8">
            {/* Video Player */}
            <div className="aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl border border-theme-border group relative">
              {currentLesson ? (
                <iframe
                  src={getYoutubeEmbedUrl(currentLesson.youtubeUrl) || ""}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Play size={64} className="text-theme-text/10" />
                </div>
              )}
            </div>

            {/* Tabs & Content */}
            <div className="space-y-6">
              <div className="flex gap-1 p-1 bg-theme-text/5 rounded-2xl w-fit">
                {[
                  { id: "content", icon: Video, label: "Lesson Content" },
                  { id: "notes", icon: FileText, label: "Notes" },
                  { id: "transcript", icon: MessageSquare, label: "Transcript" }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={cn(
                      "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
                      activeTab === tab.id ? "bg-theme-text/10 text-theme-text shadow-lg" : "text-theme-text-muted hover:text-theme-text"
                    )}
                  >
                    <tab.icon size={16} />
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="bg-theme-card border border-theme-border rounded-3xl p-8 min-h-[400px]">
                <AnimatePresence mode="wait">
                  {activeTab === "content" && (
                    <motion.div
                      key="content"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="prose prose-invert max-w-none"
                    >
                      <h2 className="text-2xl font-bold mb-4">{currentLesson?.title}</h2>
                      <p className="text-theme-text/60 leading-relaxed">
                        {currentLesson?.summary || "No summary available for this lesson."}
                      </p>
                      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-6 bg-theme-accent/5 border border-theme-accent/10 rounded-2xl space-y-3">
                          <BrainCircuit className="text-theme-accent" />
                          <h4 className="font-bold">Key Learning Objectives</h4>
                          <ul className="text-sm text-theme-text/50 space-y-2">
                            <li>• Understand the core concepts of this lesson</li>
                            <li>• Apply practical examples in your projects</li>
                            <li>• Master the advanced techniques discussed</li>
                          </ul>
                        </div>
                        <div className="p-6 bg-blue-500/5 border border-blue-500/10 rounded-2xl space-y-3">
                          <Sparkles className="text-blue-400" />
                          <h4 className="font-bold">Nova's Insight</h4>
                          <p className="text-sm text-theme-text/50">
                            "This lesson is fundamental for the next module. Pay close attention to the implementation details at 05:30."
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === "notes" && (
                    <motion.div
                      key="notes"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-6"
                    >
                      <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold">{currentLesson?.notesTitle || "Lesson Notes"}</h2>
                        <button className="text-theme-accent text-sm font-bold hover:underline">Download PDF</button>
                      </div>
                      <div className="text-theme-text/60 leading-relaxed whitespace-pre-wrap">
                        {currentLesson?.notesDescription || "No additional notes for this lesson."}
                      </div>
                    </motion.div>
                  )}

                  {activeTab === "transcript" && (
                    <motion.div
                      key="transcript"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-6"
                    >
                      <h2 className="text-2xl font-bold">Video Transcript</h2>
                      <div className="space-y-4">
                        {currentLesson?.transcript ? (
                          currentLesson.transcript.split('\n').map((line, i) => (
                            <div key={i} className="flex gap-4 group">
                              <span className="text-theme-accent/40 text-xs font-mono pt-1">00:{i < 10 ? '0'+i : i}</span>
                              <p className="text-theme-text/60 group-hover:text-theme-text transition-colors cursor-pointer">{line}</p>
                            </div>
                          ))
                        ) : (
                          <p className="text-theme-text-muted italic">Transcript not available for this lesson.</p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rating Modal */}
      <AnimatePresence>
        {isRatingModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsRatingModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-theme-sidebar border border-theme-border rounded-[32px] shadow-2xl p-8 space-y-8"
            >
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={32} className="text-emerald-500" />
                </div>
                <h3 className="text-2xl font-bold">Congratulations!</h3>
                <p className="text-theme-text-muted">You've completed the course. How would you rate your experience?</p>
              </div>

              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setRating(star)}
                    className="p-1 transition-transform hover:scale-110"
                  >
                    <Sparkles 
                      size={32} 
                      className={cn(
                        "transition-colors",
                        star <= rating ? "text-amber-500 fill-amber-500" : "text-theme-text/10"
                      )}
                    />
                  </button>
                ))}
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setIsRatingModalOpen(false)}
                  className="flex-1 py-3 rounded-xl font-bold text-theme-text-muted hover:bg-theme-text/5 transition-colors"
                >
                  Skip
                </button>
                <button
                  onClick={handleSubmitRating}
                  disabled={rating === 0 || isSubmittingRating}
                  className="flex-1 py-3 bg-theme-accent text-white font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmittingRating ? <Loader2 size={18} className="animate-spin" /> : "Submit Rating"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

const Loader2 = ({ size, className }: { size: number, className?: string }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);
