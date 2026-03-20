import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { BookOpen, Plus, Search, Play, Star, Clock } from "lucide-react";
import { cn } from "../lib/utils";
import { useAuth } from "../contexts/AuthContext";
import LoginModal from "../components/LoginModal";

interface Course {
  _id: string;
  title: string;
  description: string;
  thumbnail: string;
  duration?: string;
  rating?: number;
  ratingCount?: number;
}

export default function LearnTubePage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [enrolledCourses, setEnrolledCourses] = useState<string[]>([]);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  useEffect(() => {
    fetchCourses();
    if (user) fetchEnrolled();
  }, [user]);

  const fetchCourses = async () => {
    try {
      const res = await fetch("/api/courses");
      if (!res.ok) throw new Error("Failed to fetch courses");
      const data = await res.json();
      if (Array.isArray(data)) {
        setCourses(data);
      }
    } catch (err) {
      console.error("Failed to fetch courses:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEnrolled = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/progress/${user.uid}`);
      if (!res.ok) throw new Error("Failed to fetch enrolled courses");
      const data = await res.json();
      if (Array.isArray(data)) {
        setEnrolledCourses(data.map((p: any) => p.courseId?._id).filter(Boolean));
      }
    } catch (err) {
      console.error("Failed to fetch enrolled courses:", err);
    }
  };

  const handleEnroll = async (courseId: string) => {
    if (!user) return;
    try {
      const res = await fetch("/api/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.uid, courseId }),
      });
      if (res.ok) {
        setEnrolledCourses([...enrolledCourses, courseId]);
      }
    } catch (err) {
      console.error("Failed to enroll:", err);
    }
  };

  const filteredCourses = courses.filter(c => 
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-10">
      <header className="space-y-4">
        <div className="flex items-center gap-3 text-theme-accent">
          <BookOpen size={24} />
          <h1 className="text-3xl font-bold tracking-tight text-theme-text">LearnTube</h1>
        </div>
        <p className="text-theme-text-muted max-w-2xl">
          Discover high-quality learning paths curated from YouTube. Add them to your AI Classroom to start learning with Nova.
        </p>
      </header>

      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-text-muted/50" size={20} />
        <input
          type="text"
          placeholder="Search courses..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-theme-card border border-theme-border rounded-2xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-theme-accent/50 transition-all text-theme-text"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-80 bg-theme-card rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {filteredCourses.map((course) => (
            <motion.div
              key={course._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="group bg-theme-card border border-theme-border rounded-[32px] overflow-hidden hover:border-theme-accent/30 transition-all duration-500 hover:shadow-2xl hover:shadow-theme-accent/10 flex flex-col"
            >
              <div className="aspect-video relative overflow-hidden">
                <img 
                  src={course.thumbnail} 
                  alt={course.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-theme-bg via-transparent to-transparent opacity-60" />
                <div className="absolute inset-0 bg-theme-accent/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-theme-accent flex items-center justify-center scale-75 group-hover:scale-100 transition-transform duration-500">
                    <Play className="text-theme-bg fill-theme-bg ml-1" size={32} />
                  </div>
                </div>
                <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-theme-bg/60 backdrop-blur-md border border-theme-border text-[10px] font-black uppercase tracking-widest text-theme-text">
                  Premium Path
                </div>
              </div>
              
              <div className="p-8 flex-1 flex flex-col space-y-6">
                <div className="space-y-3 flex-1">
                  <h3 className="text-xl font-semibold tracking-tight text-theme-text group-hover:text-theme-accent transition-colors line-clamp-2">
                    {course.title}
                  </h3>
                  <p className="text-sm text-theme-text-muted leading-relaxed line-clamp-2 font-medium">
                    {course.description}
                  </p>
                </div>

                <div className="flex flex-col gap-6 pt-6 border-t border-theme-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-theme-text-muted">
                        <Clock size={14} className="text-theme-accent" /> 
                        {course.duration || "0h 0m"}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-theme-text-muted">
                        <Star size={14} className="text-yellow-500 fill-yellow-500" /> 
                        {course.rating ? course.rating.toFixed(1) : "0.0"} Rating
                      </div>
                    </div>
                  </div>
                  
                  {enrolledCourses.includes(course._id) ? (
                    <Link 
                      to={`/classroom/${course._id}`}
                      className="w-full py-4 rounded-2xl bg-theme-text/5 border border-theme-border text-theme-text text-sm font-black uppercase tracking-widest hover:bg-theme-text/10 transition-all text-center"
                    >
                      Continue Learning
                    </Link>
                  ) : (
                    <button 
                      onClick={() => handleEnroll(course._id)}
                      className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-theme-accent text-theme-bg text-sm font-black uppercase tracking-widest hover:opacity-90 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-theme-accent/20"
                    >
                      <Plus size={18} />
                      Enroll Now
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {filteredCourses.length === 0 && !loading && (
        <div className="text-center py-20 space-y-4">
          <div className="w-16 h-16 bg-theme-card rounded-full flex items-center justify-center mx-auto">
            <Search size={24} className="text-theme-text-muted/50" />
          </div>
          <p className="text-theme-text-muted">No courses found matching your search.</p>
        </div>
      )}
    </div>
  );
}
