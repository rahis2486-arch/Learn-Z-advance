import { useState, useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import { motion } from "motion/react";
import { BookOpen, Plus, Play, Star, Clock, Sparkles, Search } from "lucide-react";
import { cn } from "../lib/utils";
import { useAuth } from "../contexts/AuthContext";
import { apiFetch } from "../lib/api";

interface Course {
  _id: string;
  title: string;
  description: string;
  thumbnail: string;
  duration?: string;
  rating?: number;
  ratingCount?: number;
  tags?: string[];
  category?: string;
}

export default function InstuTubePage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolledPersonal, setEnrolledPersonal] = useState<string[]>([]);
  const [enrolledInstitution, setEnrolledInstitution] = useState<string[]>([]);

  // Access Control: Only for institutional users
  if (!user || user.loginType !== 'institutional') {
    return <Navigate to="/learntube" replace />;
  }

  useEffect(() => {
    fetchRecommendations();
    fetchEnrolled();
  }, [user]);

  const fetchRecommendations = async () => {
    if (!user?.institutionId) return;
    try {
      setLoading(true);
      const res = await apiFetch(`/api/recommendations/${user.institutionId}`);
      if (!res.ok) throw new Error("Failed to fetch recommendations");
      const data = await res.json();
      setCourses(data);
    } catch (err) {
      console.error("Failed to fetch recommendations:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEnrolled = async () => {
    if (!user) return;
    try {
      const res = await apiFetch(`/api/progress/${user.uid}`);
      if (!res.ok) throw new Error("Failed to fetch enrolled courses");
      const data = await res.json();
      if (Array.isArray(data)) {
        setEnrolledPersonal(data.filter((p: any) => (p.enrollmentSource || 'personal') === 'personal').map((p: any) => p.courseId?._id).filter(Boolean));
        setEnrolledInstitution(data.filter((p: any) => p.enrollmentSource === 'institution').map((p: any) => p.courseId?._id).filter(Boolean));
      }
    } catch (err) {
      console.error("Failed to fetch enrolled courses:", err);
    }
  };

  const handleEnroll = async (courseId: string) => {
    try {
      const res = await apiFetch("/api/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          userId: user.uid, 
          courseId,
          enrollmentSource: 'institution'
        }),
      });
      if (res.ok) {
        setEnrolledInstitution([...enrolledInstitution, courseId]);
      }
    } catch (err) {
      console.error("Failed to enroll:", err);
    }
  };

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-10">
      <header className="space-y-4">
        <div className="flex items-center gap-3 text-theme-accent">
          <Sparkles size={24} />
          <h1 className="text-3xl font-bold tracking-tight text-theme-text">InstuTube</h1>
        </div>
        <p className="text-theme-text-muted max-w-2xl">
          Exclusive courses recommended by your institution. Add them to your Classroom to start learning.
        </p>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-80 bg-theme-card rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="text-center py-20 space-y-4 bg-theme-card rounded-[32px] border border-theme-border">
          <div className="w-16 h-16 bg-theme-bg rounded-full flex items-center justify-center mx-auto">
            <BookOpen size={24} className="text-theme-text-muted/50" />
          </div>
          <p className="text-theme-text-muted">No recommendations from your institution yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {courses.map((course) => {
            if (!course) return null;
            return (
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
                <div className="absolute top-4 right-4 flex flex-col gap-2 items-end">
                  <div className="px-3 py-1 rounded-full bg-theme-bg/60 backdrop-blur-md border border-theme-border text-[10px] font-black uppercase tracking-widest text-theme-text">
                    {course.category || "General"}
                  </div>
                  {enrolledPersonal.includes(course._id) && (
                    <div className="px-3 py-1 rounded-full bg-emerald-500/20 backdrop-blur-md border border-emerald-500/30 text-[10px] font-black uppercase tracking-widest text-emerald-500">
                      Already enrolled personally
                    </div>
                  )}
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
                        {course.rating ? course.rating.toFixed(1) : "0.0"}
                      </div>
                    </div>
                  </div>
                  
                  {enrolledInstitution.includes(course._id) ? (
                    <Link 
                      to={`/classroom/${course._id}?source=institution`}
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
                      Add to Classroom
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
      )}
    </div>
  );
}
