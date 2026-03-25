import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { BookOpen, Plus, Search, Play, Star, Clock, Sparkles, Filter, Tag } from "lucide-react";
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
  tags?: string[];
  category?: string;
}

export default function LearnTubePage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [enrolledPersonal, setEnrolledPersonal] = useState<string[]>([]);
  const [enrolledInstitution, setEnrolledInstitution] = useState<string[]>([]);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [recommendedByInst, setRecommendedByInst] = useState<string[]>([]);
  
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "recommended">("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [categories, setCategories] = useState<string[]>(["All"]);

  const observer = useRef<IntersectionObserver | null>(null);
  const lastCourseElementRef = useCallback((node: HTMLDivElement | null) => {
    if (loading || loadingMore) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prevPage => prevPage + 1);
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, loadingMore, hasMore]);

  useEffect(() => {
    setCourses([]);
    setPage(1);
    setHasMore(true);
    fetchCourses(1, true);
  }, [searchQuery, activeTab, selectedCategory]);

  useEffect(() => {
    if (page > 1) {
      fetchCourses(page, false);
    }
  }, [page]);

  useEffect(() => {
    if (user) {
      fetchEnrolled();
      if ((user.role === 'admin' || user.role === 'institution-admin') && user.loginType === 'institutional') {
        fetchInstitutionRecommendations();
      }
    }
  }, [user]);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/categories");
      if (res.ok) {
        const data = await res.json();
        const names = data.map((c: any) => c.name);
        setCategories(["All", ...names]);
      }
    } catch (err) {
      console.error("Failed to fetch categories:", err);
    }
  };

  const fetchCourses = async (pageNum: number, isInitial: boolean) => {
    try {
      if (isInitial) setLoading(true);
      else setLoadingMore(true);

      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: "9",
        search: searchQuery,
        recommend: activeTab === "recommended" ? "true" : "false",
        userId: user?.uid || ""
      });

      if (selectedCategory !== "All") {
        params.append("category", selectedCategory);
      }

      const res = await fetch(`/api/courses?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch courses");
      const data = await res.json();
      
      if (isInitial) {
        setCourses(data.courses || []);
      } else {
        setCourses(prev => [...prev, ...(data.courses || [])]);
      }
      setHasMore(data.hasMore);
    } catch (err) {
      console.error("Failed to fetch courses:", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const fetchEnrolled = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/progress/${user.uid}`);
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

  const fetchInstitutionRecommendations = async () => {
    if (!user?.institutionId) return;
    try {
      const res = await fetch(`/api/recommendations/${user.institutionId}`);
      if (res.ok) {
        const data = await res.json();
        setRecommendedByInst(data.map((c: any) => c._id));
      }
    } catch (err) {
      console.error("Failed to fetch institution recommendations:", err);
    }
  };

  const handleRecommend = async (courseId: string) => {
    if (!user?.institutionId) return;
    try {
      const isRecommended = recommendedByInst.includes(courseId);
      const method = isRecommended ? "DELETE" : "POST";
      const url = isRecommended 
        ? `/api/recommendations/${user.institutionId}/${courseId}`
        : "/api/recommendations";
      
      const body = isRecommended ? undefined : JSON.stringify({
        institutionId: user.institutionId,
        courseId,
        recommendedBy: user.uid
      });

      const res = await fetch(url, {
        method,
        headers: { 
          "Content-Type": "application/json",
          "x-user-uid": user.uid
        },
        body
      });

      if (res.ok) {
        if (isRecommended) {
          setRecommendedByInst(prev => prev.filter(id => id !== courseId));
        } else {
          setRecommendedByInst(prev => [...prev, courseId]);
        }
      }
    } catch (err) {
      console.error("Failed to update recommendation:", err);
    }
  };

  const handleEnroll = async (courseId: string) => {
    if (!user) {
      setIsLoginModalOpen(true);
      return;
    }
    try {
      const res = await fetch("/api/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.uid, courseId, enrollmentSource: 'personal' }),
      });
      if (res.ok) {
        setEnrolledPersonal([...enrolledPersonal, courseId]);
      }
    } catch (err) {
      console.error("Failed to enroll:", err);
    }
  };

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

      <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-text-muted/50" size={20} />
          <input
            type="text"
            placeholder="Search courses, tags, or categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-theme-card border border-theme-border rounded-2xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-theme-accent/50 transition-all text-theme-text"
          />
        </div>

        <div className="flex items-center gap-2 bg-theme-card p-1 rounded-2xl border border-theme-border">
          <button
            onClick={() => setActiveTab("all")}
            className={cn(
              "px-6 py-2 rounded-xl text-sm font-bold transition-all",
              activeTab === "all" ? "bg-theme-accent text-theme-bg" : "text-theme-text-muted hover:text-theme-text"
            )}
          >
            All Courses
          </button>
          <button
            onClick={() => setActiveTab("recommended")}
            className={cn(
              "px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all",
              activeTab === "recommended" ? "bg-theme-accent text-theme-bg" : "text-theme-text-muted hover:text-theme-text"
            )}
          >
            <Sparkles size={16} />
            Recommended
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 overflow-x-auto pb-4 no-scrollbar">
        <Filter size={18} className="text-theme-text-muted shrink-0" />
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={cn(
              "px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border",
              selectedCategory === cat 
                ? "bg-theme-text text-theme-bg border-theme-text" 
                : "bg-theme-card text-theme-text-muted border-theme-border hover:border-theme-text/30"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-80 bg-theme-card rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {Array.isArray(courses) && courses.map((course, index) => {
            if (!course) return null;
            return (
              <motion.div
                key={course._id}
                ref={index === (Array.isArray(courses) ? courses.length : 0) - 1 ? lastCourseElementRef : null}
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
                  {enrolledInstitution.includes(course._id) && (
                    <div className="px-3 py-1 rounded-full bg-amber-500/20 backdrop-blur-md border border-amber-500/30 text-[10px] font-black uppercase tracking-widest text-amber-500">
                      Already enrolled via Institution
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
                  
                  {course.tags && course.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {course.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="flex items-center gap-1 px-2 py-1 rounded-md bg-theme-text/5 text-[10px] font-bold text-theme-text/40">
                          <Tag size={10} />
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
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
                  
                  {enrolledPersonal.includes(course._id) ? (
                    <Link 
                      to={`/classroom/${course._id}?source=personal`}
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

                  {user?.role === 'institution-admin' && user?.loginType === 'institutional' && (
                    <button 
                      onClick={() => handleRecommend(course._id)}
                      className={cn(
                        "w-full py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all border",
                        recommendedByInst.includes(course._id)
                          ? "bg-theme-text text-theme-bg border-theme-text"
                          : "bg-transparent text-theme-text-muted border-theme-border hover:border-theme-text/30"
                      )}
                    >
                      {recommendedByInst.includes(course._id) ? "Recommended to Students" : "Recommend to Students"}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
      )}

      {loadingMore && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-80 bg-theme-card rounded-3xl animate-pulse" />
          ))}
        </div>
      )}

      {courses.length === 0 && !loading && (
        <div className="text-center py-20 space-y-4">
          <div className="w-16 h-16 bg-theme-card rounded-full flex items-center justify-center mx-auto">
            <Search size={24} className="text-theme-text-muted/50" />
          </div>
          <p className="text-theme-text-muted">No courses found matching your criteria.</p>
        </div>
      )}

      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
    </div>
  );
}
