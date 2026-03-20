import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Plus, Trash2, Edit2, Save, X, 
  LayoutDashboard, BookOpen, Video, 
  FileText, Link as LinkIcon, ChevronRight,
  PlusCircle, CheckCircle2, Upload, Loader2,
  ChevronLeft, Users, Shield, UserX, UserCheck,
  Search, Filter, MoreVertical, Building2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import { useAuth } from "../contexts/AuthContext";
import { useAssistant } from "../contexts/AssistantContext";
import { ConfirmModal } from "../components/ConfirmModal";

interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'admin' | 'user';
  status: 'active' | 'deactivated';
  lastLogin: string;
}

interface Course {
  _id: string;
  title: string;
  description: string;
  thumbnail: string;
}

interface Lesson {
  _id: string;
  courseId: string;
  videoNumber: number;
  title: string;
  youtubeUrl: string;
  transcript: string;
  summary: string;
  notesTitle?: string;
  notesDescription?: string;
}

interface Institution {
  _id: string;
  name: string;
  location?: string;
  logoUrl?: string;
  allowedEmails: string[];
  createdAt: string;
}

export default function AdminPage() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { theme } = useAssistant();
  const [activeTab, setActiveTab] = useState<"courses" | "users" | "institutions">("courses");
  const [courses, setCourses] = useState<Course[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedInstitution, setSelectedInstitution] = useState<Institution | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isEditingCourse, setIsEditingCourse] = useState(false);
  const [courseForm, setCourseForm] = useState({ title: "", description: "", thumbnail: "" });
  const [isUploading, setIsUploading] = useState(false);

  const [isEditingInstitution, setIsEditingInstitution] = useState(false);
  const [institutionForm, setInstitutionForm] = useState({
    name: "",
    location: "",
    logoUrl: "",
    allowedEmails: [] as string[]
  });
  const [emailInput, setEmailInput] = useState("");
  
  const [isEditingLesson, setIsEditingLesson] = useState(false);
  const [lessonForm, setLessonForm] = useState({
    videoNumber: 1,
    title: "",
    youtubeUrl: "",
    transcript: "",
    summary: "",
    notesTitle: "",
    notesDescription: ""
  });
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);

  // Confirm Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant: "danger" | "warning";
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
    variant: "danger"
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "user">("all");

  useEffect(() => {
    if (activeTab === "courses") {
      fetchCourses();
    } else if (activeTab === "users") {
      fetchUsers();
    } else if (activeTab === "institutions") {
      fetchInstitutions();
    }
  }, [activeTab]);

  const fetchInstitutions = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/institutions", {
        headers: { "x-user-uid": currentUser?.uid || "" }
      });
      const data = await res.json();
      setInstitutions(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveInstitution = async () => {
    try {
      const method = selectedInstitution && isEditingInstitution ? "PUT" : "POST";
      const url = selectedInstitution && isEditingInstitution 
        ? `/api/admin/institutions/${selectedInstitution._id}` 
        : "/api/admin/institutions";
      
      const res = await fetch(url, {
        method,
        headers: { 
          "Content-Type": "application/json",
          "x-user-uid": currentUser?.uid || ""
        },
        body: JSON.stringify(institutionForm),
      });
      
      if (res.ok) {
        fetchInstitutions();
        setIsEditingInstitution(false);
        setSelectedInstitution(null);
        setInstitutionForm({ name: "", location: "", logoUrl: "", allowedEmails: [] });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteInstitution = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Institution",
      message: "Are you sure you want to delete this institution? This will not delete users associated with it, but they will lose institutional access.",
      variant: "danger",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/admin/institutions/${id}`, { 
            method: "DELETE",
            headers: { "x-user-uid": currentUser?.uid || "" }
          });
          if (res.ok) {
            fetchInstitutions();
            if (selectedInstitution?._id === id) setSelectedInstitution(null);
          }
        } catch (err) {
          console.error(err);
        }
      }
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        setInstitutionForm({ ...institutionForm, logoUrl: reader.result as string });
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Upload failed:", err);
      setIsUploading(false);
    }
  };

  const addEmail = () => {
    if (emailInput && !institutionForm.allowedEmails.includes(emailInput)) {
      setInstitutionForm({
        ...institutionForm,
        allowedEmails: [...institutionForm.allowedEmails, emailInput]
      });
      setEmailInput("");
    }
  };

  const removeEmail = (email: string) => {
    setInstitutionForm({
      ...institutionForm,
      allowedEmails: institutionForm.allowedEmails.filter(e => e !== email)
    });
  };

  const handleBulkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      // Split by comma, newline, or semicolon and trim
      const emails = text.split(/[,\n;]/)
        .map(e => e.trim())
        .filter(e => e && e.includes('@') && !institutionForm.allowedEmails.includes(e));
      
      if (emails.length > 0) {
        setInstitutionForm({
          ...institutionForm,
          allowedEmails: [...institutionForm.allowedEmails, ...emails]
        });
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = "";
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/users", {
        headers: { "x-user-uid": currentUser?.uid || "" }
      });
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateUser = async (uid: string, updates: Partial<User>) => {
    try {
      const res = await fetch(`/api/admin/users/${uid}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "x-user-uid": currentUser?.uid || ""
        },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        fetchUsers();
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (selectedCourse) {
      fetchLessons(selectedCourse._id);
    }
  }, [selectedCourse]);

  const fetchCourses = async () => {
    try {
      const res = await fetch("/api/courses", {
        headers: { "x-user-uid": currentUser?.uid || "" }
      });
      const data = await res.json();
      setCourses(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLessons = async (courseId: string) => {
    try {
      const res = await fetch(`/api/courses/${courseId}/lessons`, {
        headers: { "x-user-uid": currentUser?.uid || "" }
      });
      const data = await res.json();
      setLessons(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setCourseForm({ ...courseForm, thumbnail: base64String });
        setIsUploading(false);
      };
      reader.onerror = () => {
        console.error("Failed to read file");
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Upload failed:", err);
      setIsUploading(false);
    }
  };

  const handleSaveCourse = async () => {
    try {
      const method = selectedCourse && isEditingCourse ? "PUT" : "POST";
      const url = selectedCourse && isEditingCourse ? `/api/courses/${selectedCourse._id}` : "/api/courses";
      
      const res = await fetch(url, {
        method,
        headers: { 
          "Content-Type": "application/json",
          "x-user-uid": currentUser?.uid || ""
        },
        body: JSON.stringify(courseForm),
      });
      
      if (res.ok) {
        fetchCourses();
        setIsEditingCourse(false);
        setCourseForm({ title: "", description: "", thumbnail: "" });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteCourse = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Course",
      message: "Are you sure you want to delete this course and all its lessons? This action cannot be undone.",
      variant: "danger",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/courses/${id}`, { 
            method: "DELETE",
            headers: { "x-user-uid": currentUser?.uid || "" }
          });
          if (res.ok) {
            fetchCourses();
            if (selectedCourse?._id === id) setSelectedCourse(null);
          }
        } catch (err) {
          console.error(err);
        }
      }
    });
  };

  const handleSaveLesson = async () => {
    if (!selectedCourse) return;
    try {
      const method = editingLessonId ? "PUT" : "POST";
      const url = editingLessonId ? `/api/lessons/${editingLessonId}` : "/api/lessons";
      
      const res = await fetch(url, {
        method,
        headers: { 
          "Content-Type": "application/json",
          "x-user-uid": currentUser?.uid || ""
        },
        body: JSON.stringify({ ...lessonForm, courseId: selectedCourse._id }),
      });
      
      if (res.ok) {
        fetchLessons(selectedCourse._id);
        setIsEditingLesson(false);
        setEditingLessonId(null);
        setLessonForm({
          videoNumber: lessons.length + 1,
          title: "",
          youtubeUrl: "",
          transcript: "",
          summary: "",
          notesTitle: "",
          notesDescription: ""
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteLesson = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Lesson",
      message: "Are you sure you want to delete this lesson? This action cannot be undone.",
      variant: "danger",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/lessons/${id}`, { 
            method: "DELETE",
            headers: { "x-user-uid": currentUser?.uid || "" }
          });
          if (res.ok && selectedCourse) {
            fetchLessons(selectedCourse._id);
          }
        } catch (err) {
          console.error(err);
        }
      }
    });
  };

  const openEditLesson = (lesson: Lesson) => {
    setEditingLessonId(lesson._id);
    setLessonForm({
      videoNumber: lesson.videoNumber,
      title: lesson.title,
      youtubeUrl: lesson.youtubeUrl,
      transcript: lesson.transcript,
      summary: lesson.summary,
      notesTitle: lesson.notesTitle || "",
      notesDescription: lesson.notesDescription || ""
    });
    setIsEditingLesson(true);
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="flex h-full bg-theme-bg">
      {/* Sidebar: Navigation */}
      <div className="w-80 border-r border-theme-border flex flex-col bg-theme-sidebar">
        <div className="p-6 border-b border-theme-border flex items-center justify-between">
          <div className="flex items-center gap-2 text-theme-text font-bold">
            <LayoutDashboard size={20} className="text-theme-accent" />
            <span>Admin Dashboard</span>
          </div>
        </div>

        <div className="p-4 border-b border-theme-border space-y-2">
          <button 
            onClick={() => setActiveTab("courses")}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-xl transition-all",
              activeTab === "courses" ? "bg-theme-accent/10 text-theme-accent" : "text-theme-text/40 hover:bg-theme-text/5"
            )}
          >
            <BookOpen size={18} />
            <span className="font-bold text-sm">Course Management</span>
          </button>
          <button 
            onClick={() => setActiveTab("users")}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-xl transition-all",
              activeTab === "users" ? "bg-theme-accent/10 text-theme-accent" : "text-theme-text/40 hover:bg-theme-text/5"
            )}
          >
            <Users size={18} />
            <span className="font-bold text-sm">User Management</span>
          </button>
          <button 
            onClick={() => setActiveTab("institutions")}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-xl transition-all",
              activeTab === "institutions" ? "bg-theme-accent/10 text-theme-accent" : "text-theme-text/40 hover:bg-theme-text/5"
            )}
          >
            <Building2 size={18} />
            <span className="font-bold text-sm">Institution Management</span>
          </button>
        </div>

        {activeTab === "courses" && (
          <>
            <div className="p-4 border-b border-theme-border flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-theme-text/20">All Courses</span>
              <button 
                onClick={() => {
                  setIsEditingCourse(true);
                  setSelectedCourse(null);
                  setCourseForm({ title: "", description: "", thumbnail: "" });
                }}
                className="p-1.5 hover:bg-theme-accent/10 rounded-lg text-theme-accent transition-colors"
              >
                <PlusCircle size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {courses.map(course => (
                <button
                  key={course._id}
                  onClick={() => setSelectedCourse(course)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl transition-all group",
                    selectedCourse?._id === course._id 
                      ? "bg-theme-accent/10 border border-theme-accent/20 text-theme-text" 
                      : "text-theme-text/40 hover:bg-theme-text/5 hover:text-theme-text"
                  )}
                >
                  <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                    <img src={course.thumbnail} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                  <span className="flex-1 text-left text-sm font-medium truncate">{course.title}</span>
                  <ChevronRight size={16} className={cn(
                    "transition-transform",
                    selectedCourse?._id === course._id ? "rotate-90 text-theme-accent" : "opacity-0 group-hover:opacity-100"
                  )} />
                </button>
              ))}
            </div>
          </>
        )}

        <div className="p-4 border-t border-theme-border">
          <button 
            onClick={() => navigate("/learntube")}
            className="w-full flex items-center gap-2 p-2 text-xs font-bold text-theme-text/40 hover:text-theme-text transition-colors"
          >
            <ChevronLeft size={14} />
            Back to LearnTube
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-10">
        <AnimatePresence mode="wait">
          {activeTab === "users" ? (
            <motion.div
              key="users-list"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-black tracking-tight">User Management</h2>
                  <p className="text-theme-text/40">Manage roles and access for all Learn-Z users.</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-text/40" size={16} />
                    <input 
                      type="text"
                      placeholder="Search users..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 pr-4 py-2 bg-theme-card border border-theme-border rounded-xl text-sm focus:ring-2 focus:ring-theme-accent/50 outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 bg-theme-card border border-theme-border rounded-xl text-xs font-bold text-theme-text/40">
                    <Users size={14} />
                    {users.length} Total Users
                  </div>
                </div>
              </div>

              <div className="bg-theme-card border border-theme-border rounded-[32px] overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-theme-border bg-theme-text/[0.02]">
                      <th className="p-6 text-[10px] font-black uppercase tracking-widest text-theme-text/40">User</th>
                      <th className="p-6 text-[10px] font-black uppercase tracking-widest text-theme-text/40">Role</th>
                      <th className="p-6 text-[10px] font-black uppercase tracking-widest text-theme-text/40">Status</th>
                      <th className="p-6 text-[10px] font-black uppercase tracking-widest text-theme-text/40">Last Login</th>
                      <th className="p-6 text-[10px] font-black uppercase tracking-widest text-theme-text/40 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(u => (
                      <tr key={u.uid} className="border-b border-theme-border hover:bg-theme-text/[0.02] transition-colors group">
                        <td className="p-6">
                          <div className="flex items-center gap-4">
                            <img src={u.photoURL} alt="" className="w-10 h-10 rounded-full border border-theme-border" referrerPolicy="no-referrer" />
                            <div>
                              <p className="font-bold text-theme-text">{u.displayName}</p>
                              <p className="text-xs text-theme-text/40">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-6">
                          <div className={cn(
                            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                            u.role === 'admin' ? "bg-emerald-500/10 text-emerald-500" : "bg-blue-500/10 text-blue-400"
                          )}>
                            <Shield size={10} />
                            {u.role}
                          </div>
                        </td>
                        <td className="p-6">
                          <div className={cn(
                            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                            u.status === 'active' ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-400"
                          )}>
                            <div className={cn("w-1.5 h-1.5 rounded-full", u.status === 'active' ? "bg-emerald-500" : "bg-red-500")} />
                            {u.status}
                          </div>
                        </td>
                        <td className="p-6 text-xs text-theme-text/40">
                          {new Date(u.lastLogin).toLocaleDateString()}
                        </td>
                        <td className="p-6">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => updateUser(u.uid, { role: u.role === 'admin' ? 'user' : 'admin' })}
                              className="p-2 hover:bg-theme-text/10 rounded-lg text-theme-text/40 hover:text-theme-text transition-colors"
                              title="Change Role"
                            >
                              <Shield size={18} />
                            </button>
                            <button 
                              onClick={() => updateUser(u.uid, { status: u.status === 'active' ? 'deactivated' : 'active' })}
                              className={cn(
                                "p-2 rounded-lg transition-colors",
                                u.status === 'active' ? "hover:bg-red-500/10 text-theme-text/40 hover:text-red-400" : "hover:bg-emerald-500/10 text-theme-text/40 hover:text-emerald-400"
                              )}
                              title={u.status === 'active' ? "Deactivate" : "Activate"}
                            >
                              {u.status === 'active' ? <UserX size={18} /> : <UserCheck size={18} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          ) : activeTab === "institutions" ? (
            <motion.div
              key="institutions-list"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-black tracking-tight">Institution Management</h2>
                  <p className="text-theme-text/40">Manage organizations and their allowed user lists.</p>
                </div>
                <button 
                  onClick={() => {
                    setSelectedInstitution(null);
                    setInstitutionForm({ name: "", location: "", logoUrl: "", allowedEmails: [] });
                    setIsEditingInstitution(true);
                  }}
                  className="flex items-center gap-2 px-6 py-3 bg-theme-accent text-white font-bold rounded-xl hover:opacity-90 transition-opacity"
                >
                  <Plus size={20} /> Add Institution
                </button>
              </div>

              {isEditingInstitution ? (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-theme-card border border-theme-border rounded-[32px] p-8 space-y-8 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold">{selectedInstitution ? "Edit Institution" : "New Institution"}</h3>
                    <button onClick={() => setIsEditingInstitution(false)} className="p-2 hover:bg-theme-text/5 rounded-full">
                      <X size={24} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-theme-text/40">Institution Name</label>
                        <input
                          type="text"
                          value={institutionForm.name}
                          onChange={e => setInstitutionForm({ ...institutionForm, name: e.target.value })}
                          className="w-full bg-theme-bg border border-theme-border rounded-xl p-4 focus:ring-2 focus:ring-theme-accent/50 outline-none"
                          placeholder="e.g. Stanford University"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-theme-text/40">Location</label>
                        <input
                          type="text"
                          value={institutionForm.location}
                          onChange={e => setInstitutionForm({ ...institutionForm, location: e.target.value })}
                          className="w-full bg-theme-bg border border-theme-border rounded-xl p-4 focus:ring-2 focus:ring-theme-accent/50 outline-none"
                          placeholder="e.g. California, USA"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-theme-text/40">Logo</label>
                        <div className="flex items-center gap-4">
                          <div className="w-20 h-20 rounded-2xl bg-theme-bg border border-theme-border flex items-center justify-center overflow-hidden relative group">
                            {institutionForm.logoUrl ? (
                              <img src={institutionForm.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                            ) : (
                              <Building2 className="w-8 h-8 text-theme-text/20" />
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleLogoUpload}
                              className="absolute inset-0 opacity-0 cursor-pointer"
                            />
                          </div>
                          <div className="flex-1">
                            <p className="text-xs text-theme-text/40 mb-2">Upload logo or paste URL</p>
                            <input
                              type="text"
                              value={institutionForm.logoUrl}
                              onChange={e => setInstitutionForm({ ...institutionForm, logoUrl: e.target.value })}
                              className="w-full bg-theme-bg border border-theme-border rounded-xl p-3 text-xs outline-none"
                              placeholder="Logo URL..."
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black uppercase tracking-widest text-theme-text/40">Allowed Emails</label>
                        <div className="relative">
                          <button className="text-[10px] font-black uppercase tracking-widest text-theme-accent hover:underline flex items-center gap-1">
                            <Upload size={10} />
                            Bulk Upload (CSV)
                          </button>
                          <input 
                            type="file" 
                            accept=".csv,.txt" 
                            onChange={handleBulkUpload}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="email"
                          value={emailInput}
                          onChange={e => setEmailInput(e.target.value)}
                          onKeyPress={e => e.key === 'Enter' && addEmail()}
                          className="flex-1 bg-theme-bg border border-theme-border rounded-xl p-4 focus:ring-2 focus:ring-theme-accent/50 outline-none"
                          placeholder="Add email address..."
                        />
                        <button 
                          onClick={addEmail}
                          className="px-6 bg-theme-accent text-white font-bold rounded-xl hover:opacity-90"
                        >
                          Add
                        </button>
                      </div>
                      <div className="bg-theme-bg border border-theme-border rounded-2xl p-4 h-[240px] overflow-y-auto space-y-2">
                        {institutionForm.allowedEmails.length > 0 ? (
                          institutionForm.allowedEmails.map(email => (
                            <div key={email} className="flex items-center justify-between p-3 bg-theme-card border border-theme-border rounded-xl group">
                              <span className="text-sm">{email}</span>
                              <button 
                                onClick={() => removeEmail(email)}
                                className="p-1 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          ))
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center text-theme-text/20">
                            <Users size={32} />
                            <p className="text-xs mt-2">No emails added yet</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-4 pt-4 border-t border-theme-border">
                    <button 
                      onClick={() => setIsEditingInstitution(false)}
                      className="px-8 py-3 rounded-xl text-theme-text/60 hover:text-theme-text"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleSaveInstitution}
                      className="px-12 py-3 bg-theme-accent text-white font-bold rounded-xl hover:opacity-90 flex items-center gap-2"
                    >
                      <Save size={20} />
                      {selectedInstitution ? "Update Institution" : "Create Institution"}
                    </button>
                  </div>
                </motion.div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {institutions.map(inst => (
                    <div 
                      key={inst._id}
                      className="bg-theme-card border border-theme-border rounded-[32px] p-6 space-y-6 group hover:border-theme-accent transition-all shadow-sm"
                    >
                      <div className="flex items-start justify-between">
                        <div className="w-16 h-16 rounded-2xl bg-theme-bg border border-theme-border flex items-center justify-center overflow-hidden">
                          {inst.logoUrl ? (
                            <img src={inst.logoUrl} alt={inst.name} className="w-full h-full object-cover" />
                          ) : (
                            <Building2 className="w-8 h-8 text-theme-text/20" />
                          )}
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => {
                              setSelectedInstitution(inst);
                              setInstitutionForm({
                                name: inst.name,
                                location: inst.location || "",
                                logoUrl: inst.logoUrl || "",
                                allowedEmails: inst.allowedEmails
                              });
                              setIsEditingInstitution(true);
                            }}
                            className="p-2 hover:bg-theme-accent/10 rounded-lg text-theme-accent"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={() => handleDeleteInstitution(inst._id)}
                            className="p-2 hover:bg-red-500/10 rounded-lg text-red-400"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold truncate">{inst.name}</h3>
                        <p className="text-sm text-theme-text/40 flex items-center gap-1">
                          <Filter size={12} />
                          {inst.location || "No location set"}
                        </p>
                      </div>
                      <div className="pt-4 border-t border-theme-border flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-bold text-theme-text/40">
                          <Users size={14} />
                          {inst.allowedEmails.length} Allowed Emails
                        </div>
                        <div className="text-[10px] uppercase tracking-widest text-theme-text/20">
                          ID: {inst._id.slice(-6)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ) : isEditingCourse ? (
            <motion.div
              key="course-form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-2xl space-y-8"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">{selectedCourse ? "Edit Course" : "New Course"}</h2>
                <button onClick={() => setIsEditingCourse(false)} className="p-2 hover:bg-theme-text/5 rounded-full">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-theme-text/40">Course Title</label>
                  <input
                    type="text"
                    value={courseForm.title}
                    onChange={e => setCourseForm({ ...courseForm, title: e.target.value })}
                    className="w-full bg-theme-card border border-theme-border rounded-xl p-4 focus:ring-2 focus:ring-theme-accent/50 outline-none"
                    placeholder="e.g. 100 Days of Python"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-theme-text/40">Description</label>
                  <textarea
                    value={courseForm.description}
                    onChange={e => setCourseForm({ ...courseForm, description: e.target.value })}
                    className="w-full bg-theme-card border border-theme-border rounded-xl p-4 h-32 focus:ring-2 focus:ring-theme-accent/50 outline-none resize-none"
                    placeholder="What will students learn?"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-theme-text/40">Course Thumbnail</label>
                  <div className="flex items-center gap-6">
                    <div className="w-32 h-32 rounded-2xl bg-theme-card border border-theme-border overflow-hidden flex items-center justify-center relative group">
                      {courseForm.thumbnail ? (
                        <>
                          <img src={courseForm.thumbnail} alt="Preview" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Upload size={24} className="text-white" />
                          </div>
                        </>
                      ) : (
                        <Upload size={32} className="text-theme-text/20" />
                      )}
                      {isUploading && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <Loader2 size={24} className="text-theme-accent animate-spin" />
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleThumbnailUpload}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        disabled={isUploading}
                      />
                    </div>
                    <div className="flex-1 space-y-2">
                      <p className="text-sm text-theme-text/40 leading-relaxed">
                        Upload a high-quality image for your course thumbnail. Recommended size: 1280x720px.
                      </p>
                      <input
                        type="text"
                        value={courseForm.thumbnail}
                        onChange={e => setCourseForm({ ...courseForm, thumbnail: e.target.value })}
                        className="w-full bg-theme-card border border-theme-border rounded-xl p-3 text-xs focus:ring-2 focus:ring-theme-accent/50 outline-none"
                        placeholder="Or paste image URL here..."
                      />
                    </div>
                  </div>
                </div>
                <button 
                  onClick={handleSaveCourse}
                  className="w-full py-4 bg-theme-accent text-white font-bold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  <Save size={20} />
                  Save Course
                </button>
              </div>
            </motion.div>
          ) : selectedCourse ? (
            <motion.div
              key="course-details"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-10"
            >
              <div className="flex items-start justify-between">
                <div className="flex gap-6">
                  <div className="w-32 h-32 rounded-3xl overflow-hidden border border-theme-border">
                    <img src={selectedCourse.thumbnail} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                  <div className="space-y-2">
                    <h1 className="text-4xl font-bold">{selectedCourse.title}</h1>
                    <p className="text-theme-text/50 max-w-xl">{selectedCourse.description}</p>
                    <div className="flex gap-2 pt-4">
                      <button 
                        onClick={() => {
                          setCourseForm({
                            title: selectedCourse.title,
                            description: selectedCourse.description,
                            thumbnail: selectedCourse.thumbnail
                          });
                          setIsEditingCourse(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-theme-text/5 hover:bg-theme-text/10 rounded-lg text-sm transition-colors"
                      >
                        <Edit2 size={16} /> Edit
                      </button>
                      <button 
                        onClick={() => handleDeleteCourse(selectedCourse._id)}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm transition-colors"
                      >
                        <Trash2 size={16} /> Delete
                      </button>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setEditingLessonId(null);
                    setLessonForm({
                      videoNumber: lessons.length + 1,
                      title: "",
                      youtubeUrl: "",
                      transcript: "",
                      summary: "",
                      notesTitle: "",
                      notesDescription: ""
                    });
                    setIsEditingLesson(true);
                  }}
                  className="flex items-center gap-2 px-6 py-3 bg-theme-accent text-white font-bold rounded-xl hover:opacity-90 transition-opacity"
                >
                  <Plus size={20} /> Add Lesson
                </button>
              </div>

              <div className="space-y-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Video size={20} className="text-theme-accent" />
                  Lessons ({lessons.length})
                </h3>
                <div className="grid gap-4">
                  {lessons.map(lesson => (
                    <div 
                      key={lesson._id}
                      className="flex items-center gap-6 p-4 bg-theme-card border border-theme-border rounded-2xl group hover:bg-theme-text/[0.02] transition-all"
                    >
                      <div className="w-12 h-12 rounded-xl bg-theme-accent/10 flex items-center justify-center text-theme-accent font-bold">
                        {lesson.videoNumber}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold">{lesson.title}</h4>
                        <p className="text-xs text-theme-text/40 truncate max-w-md">{lesson.youtubeUrl}</p>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEditLesson(lesson)} className="p-2 hover:bg-theme-text/10 rounded-lg text-theme-text/60"><Edit2 size={18} /></button>
                        <button onClick={() => handleDeleteLesson(lesson._id)} className="p-2 hover:bg-red-500/10 rounded-lg text-red-400"><Trash2 size={18} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
              <div className="w-20 h-20 bg-theme-text/5 rounded-full flex items-center justify-center">
                <BookOpen size={40} className="text-theme-text/20" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">Select a course to manage</h2>
                <p className="text-theme-text/40">Or create a new one using the plus icon in the sidebar.</p>
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Lesson Modal */}
      <AnimatePresence>
        {isEditingLesson && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditingLesson(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-theme-sidebar border border-theme-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-theme-border flex items-center justify-between bg-theme-text/[0.02]">
                <h3 className="text-xl font-bold">{editingLessonId ? "Edit Lesson" : "New Lesson"}</h3>
                <button onClick={() => setIsEditingLesson(false)} className="p-2 hover:bg-theme-text/10 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-theme-text/40">Lesson Number</label>
                    <input
                      type="number"
                      value={lessonForm.videoNumber}
                      onChange={e => setLessonForm({ ...lessonForm, videoNumber: parseInt(e.target.value) })}
                      className="w-full bg-theme-card border border-theme-border rounded-xl p-3 outline-none focus:ring-2 focus:ring-theme-accent/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-theme-text/40">Lesson Title</label>
                    <input
                      type="text"
                      value={lessonForm.title}
                      onChange={e => setLessonForm({ ...lessonForm, title: e.target.value })}
                      className="w-full bg-theme-card border border-theme-border rounded-xl p-3 outline-none focus:ring-2 focus:ring-theme-accent/50"
                      placeholder="e.g. Introduction to Variables"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-theme-text/40">YouTube URL</label>
                  <div className="relative">
                    <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-text/20" size={18} />
                    <input
                      type="text"
                      value={lessonForm.youtubeUrl}
                      onChange={e => setLessonForm({ ...lessonForm, youtubeUrl: e.target.value })}
                      className="w-full bg-theme-card border border-theme-border rounded-xl py-3 pl-12 pr-4 outline-none focus:ring-2 focus:ring-theme-accent/50"
                      placeholder="https://youtube.com/watch?v=..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-theme-text/40">Transcript</label>
                    <textarea
                      value={lessonForm.transcript}
                      onChange={e => setLessonForm({ ...lessonForm, transcript: e.target.value })}
                      className="w-full bg-theme-card border border-theme-border rounded-xl p-4 h-48 outline-none focus:ring-2 focus:ring-theme-accent/50 resize-none text-sm"
                      placeholder="Paste video transcript here..."
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-theme-text/40">Transcript Summary</label>
                    <textarea
                      value={lessonForm.summary}
                      onChange={e => setLessonForm({ ...lessonForm, summary: e.target.value })}
                      className="w-full bg-theme-card border border-theme-border rounded-xl p-4 h-48 outline-none focus:ring-2 focus:ring-theme-accent/50 resize-none text-sm"
                      placeholder="Brief summary for AI context..."
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-theme-border">
                  <h4 className="text-sm font-bold flex items-center gap-2">
                    <FileText size={18} className="text-theme-accent" />
                    Lesson Notes (Optional)
                  </h4>
                  <div className="space-y-4">
                    <input
                      type="text"
                      value={lessonForm.notesTitle}
                      onChange={e => setLessonForm({ ...lessonForm, notesTitle: e.target.value })}
                      className="w-full bg-theme-card border border-theme-border rounded-xl p-3 outline-none focus:ring-2 focus:ring-theme-accent/50"
                      placeholder="Notes Heading"
                    />
                    <textarea
                      value={lessonForm.notesDescription}
                      onChange={e => setLessonForm({ ...lessonForm, notesDescription: e.target.value })}
                      className="w-full bg-theme-card border border-theme-border rounded-xl p-4 h-32 outline-none focus:ring-2 focus:ring-theme-accent/50 resize-none text-sm"
                      placeholder="Detailed notes or instructions..."
                    />
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-theme-border bg-theme-text/[0.02] flex justify-end gap-4">
                <button 
                  onClick={() => setIsEditingLesson(false)}
                  className="px-6 py-2 rounded-xl text-theme-text/60 hover:text-theme-text transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveLesson}
                  className="px-8 py-2 bg-theme-accent text-white font-bold rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2"
                >
                  <CheckCircle2 size={18} />
                  {editingLessonId ? "Update Lesson" : "Create Lesson"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal 
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
      />
    </div>
  );
}
