import { useState, useEffect, useCallback } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { 
  Plus, Trash2, Edit2, Save, X, 
  LayoutDashboard, BookOpen, Video, 
  FileText, Link as LinkIcon, ChevronRight,
  PlusCircle, CheckCircle2, Upload, Loader2,
  ChevronLeft, Users, Shield, UserX, UserCheck,
  Search, Filter, MoreVertical, Building2, Tag,
  BarChart3, TrendingUp, PieChart, Target, Award
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area
} from 'recharts';
import { cn } from "../lib/utils";
import { useAuth } from "../contexts/AuthContext";
import { useAssistant } from "../contexts/AssistantContext";
import { ConfirmModal } from "../components/ConfirmModal";
import { apiFetch } from "../lib/api";

interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'admin' | 'user' | 'institution_admin' | 'staff' | 'student' | 'institution_student';
  status: 'active' | 'deactivated';
  lastLogin: string;
  username?: string;
  institutionId?: string;
}

interface Course {
  _id: string;
  title: string;
  description: string;
  thumbnail: string;
  duration?: string;
  tags?: string[];
  category?: string;
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
  permittedEmails: string[];
  createdAt: string;
}

interface Category {
  _id: string;
  name: string;
  description?: string;
}

interface PreferenceOption {
  _id: string;
  type: 'interest' | 'learningPreference' | 'hobby';
  label: string;
  value: string;
  iconName?: string;
}

const CategorySelect = ({ value, onChange, categories }: { value: string, onChange: (val: string) => void, categories: Category[] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  
  const filtered = categories.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  
  return (
    <div className="relative">
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-theme-bg border border-theme-border rounded-xl p-4 flex items-center justify-between cursor-pointer"
      >
        <span className={value ? "text-theme-text" : "text-theme-text/40"}>
          {value || "Select Category"}
        </span>
        <ChevronRight size={16} className={cn("transition-transform", isOpen && "rotate-90")} />
      </div>
      
      {isOpen && (
        <div className="absolute z-50 top-full left-0 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search categories..."
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-lg text-sm text-black outline-none focus:ring-2 focus:ring-blue-500/20"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {filtered.length > 0 ? (
              filtered.map(cat => (
                <button
                  key={cat._id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(cat.name);
                    setIsOpen(false);
                    setSearch("");
                  }}
                  className={cn(
                    "w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    value === cat.name 
                      ? "bg-blue-600 text-white" 
                      : "text-gray-700 hover:bg-gray-100"
                  )}
                >
                  {cat.name}
                </button>
              ))
            ) : (
              <div className="p-4 text-center text-gray-400 text-xs">No categories found</div>
            )}
          </div>
        </div>
      )}
      
      {isOpen && <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />}
    </div>
  );
};

export default function AdminPage() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { theme } = useAssistant();
  const [activeTab, setActiveTab] = useState<"courses" | "users" | "institutions" | "categories" | "analytics" | "preferences">("courses");
  const [courses, setCourses] = useState<Course[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [preferenceOptions, setPreferenceOptions] = useState<PreferenceOption[]>([]);
  const [institutionSearchQuery, setInstitutionSearchQuery] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedInstitution, setSelectedInstitution] = useState<Institution | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedPreference, setSelectedPreference] = useState<PreferenceOption | null>(null);
  const [isEditingPreference, setIsEditingPreference] = useState(false);
  const [preferenceForm, setPreferenceForm] = useState({ type: 'interest' as PreferenceOption['type'], label: '', value: '', iconName: '' });
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [analyticsRange, setAnalyticsRange] = useState("30");
  const [analyticsInterval, setAnalyticsInterval] = useState<"daily" | "weekly" | "monthly">("daily");
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false);
  const [topCourseFilter, setTopCourseFilter] = useState<"enrollment" | "rating" | "engagement">("enrollment");
  const [institutionSearch, setInstitutionSearch] = useState("");
  const [selectedInstAnalytics, setSelectedInstAnalytics] = useState<any>(null);
  const [isInstAnalyticsLoading, setIsInstAnalyticsLoading] = useState(false);
  const [comparisonData, setComparisonData] = useState<any[]>([]);

  const fetchAnalytics = useCallback(async () => {
    setIsAnalyticsLoading(true);
    try {
      const [analyticsRes, comparisonRes] = await Promise.all([
        apiFetch(`/api/admin/analytics?range=${analyticsRange}&interval=${analyticsInterval}`),
        apiFetch(`/api/admin/analytics/institutions-comparison`)
      ]);
      
      const data = await analyticsRes.json();
      const comparison = await comparisonRes.json();
      
      setAnalyticsData(data);
      setComparisonData(comparison);
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
    } finally {
      setIsAnalyticsLoading(false);
    }
  }, [currentUser?.uid, analyticsRange, analyticsInterval]);

  const fetchInstitutionAnalytics = async (instId: string) => {
    setIsInstAnalyticsLoading(true);
    try {
      const res = await apiFetch(`/api/admin/analytics/institution/${instId}`);
      const data = await res.json();
      setSelectedInstAnalytics(data);
    } catch (error) {
      console.error("Failed to fetch institution analytics:", error);
    } finally {
      setIsInstAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'analytics') {
      fetchAnalytics();
      fetchInstitutions();
    }
  }, [activeTab, fetchAnalytics]);
  
  const [isEditingCourse, setIsEditingCourse] = useState(false);
  const [courseForm, setCourseForm] = useState({ title: "", description: "", thumbnail: "", duration: "", tags: "", category: "" });
  const [isUploading, setIsUploading] = useState(false);

  const [isEditingInstitution, setIsEditingInstitution] = useState(false);
  const [institutionForm, setInstitutionForm] = useState({
    name: "",
    location: "",
    logoUrl: "",
    permittedEmails: [] as string[]
  });
  const [emailInput, setEmailInput] = useState("");

  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: "", description: "" });
  
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
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "user" | "institution_admin" | "staff" | "student" | "institution_student">("all");
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({ displayName: "", username: "", role: "user" as User['role'], status: "active" as User['status'], institutionId: "" });

  useEffect(() => {
    if (activeTab === "courses") {
      fetchCourses();
      fetchCategories();
    } else if (activeTab === "users") {
      fetchUsers();
      fetchInstitutions();
    } else if (activeTab === "institutions") {
      fetchInstitutions();
    } else if (activeTab === "categories") {
      fetchCategories();
    } else if (activeTab === "preferences") {
      fetchPreferenceOptions();
    }
  }, [activeTab]);

  if (!currentUser || currentUser.role !== 'admin') {
    return <Navigate to="/learntube" replace />;
  }

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/api/categories");
      const data = await res.json();
      setCategories(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPreferenceOptions = async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/api/preference-options");
      const data = await res.json();
      setPreferenceOptions(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePreference = async () => {
    try {
      const method = selectedPreference ? "PUT" : "POST";
      const url = selectedPreference ? `/api/admin/preference-options/${selectedPreference._id}` : "/api/admin/preference-options";
      
      const res = await apiFetch(url, {
        method,
        headers: { 
          "Content-Type": "application/json"
        },
        body: JSON.stringify(preferenceForm),
      });
      
      if (res.ok) {
        fetchPreferenceOptions();
        setIsEditingPreference(false);
        setSelectedPreference(null);
        setPreferenceForm({ type: 'interest', label: '', value: '', iconName: '' });
      } else {
        const data = await res.json();
        alert(data.error || "Failed to save preference option");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeletePreference = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Preference Option",
      message: "Are you sure you want to delete this preference option? This will remove it from onboarding for new users.",
      variant: "danger",
      onConfirm: async () => {
        try {
          const res = await apiFetch(`/api/admin/preference-options/${id}`, { 
            method: "DELETE"
          });
          if (res.ok) {
            fetchPreferenceOptions();
          }
        } catch (err) {
          console.error(err);
        }
      }
    });
  };

  const handleSaveCategory = async () => {
    try {
      const method = selectedCategory ? "PUT" : "POST";
      const url = selectedCategory ? `/api/categories/${selectedCategory._id}` : "/api/categories";
      
      const res = await apiFetch(url, {
        method,
        headers: { 
          "Content-Type": "application/json"
        },
        body: JSON.stringify(categoryForm),
      });
      
      if (res.ok) {
        fetchCategories();
        setIsEditingCategory(false);
        setSelectedCategory(null);
        setCategoryForm({ name: "", description: "" });
      } else {
        const data = await res.json();
        alert(data.error || "Failed to save category");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Category",
      message: "Are you sure you want to delete this category? This will not delete courses in this category, but they will lose their category association.",
      variant: "danger",
      onConfirm: async () => {
        try {
          const res = await apiFetch(`/api/categories/${id}`, { 
            method: "DELETE"
          });
          if (res.ok) {
            fetchCategories();
          }
        } catch (err) {
          console.error(err);
        }
      }
    });
  };

  const fetchInstitutions = async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/api/admin/institutions", {
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
      
      const res = await apiFetch(url, {
        method,
        headers: { 
          "Content-Type": "application/json"
        },
        body: JSON.stringify(institutionForm),
      });
      
      if (res.ok) {
        fetchInstitutions();
        setIsEditingInstitution(false);
        setSelectedInstitution(null);
        setInstitutionForm({ name: "", location: "", logoUrl: "", permittedEmails: [] });
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
          const res = await apiFetch(`/api/admin/institutions/${id}`, { 
            method: "DELETE"
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
    if (emailInput && !institutionForm.permittedEmails.includes(emailInput)) {
      setInstitutionForm({
        ...institutionForm,
        permittedEmails: [...institutionForm.permittedEmails, emailInput]
      });
      setEmailInput("");
    }
  };

  const removeEmail = (email: string) => {
    setInstitutionForm({
      ...institutionForm,
      permittedEmails: institutionForm.permittedEmails.filter(e => e !== email)
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
        .filter(e => e && e.includes('@') && !institutionForm.permittedEmails.includes(e));
      
      if (emails.length > 0) {
        setInstitutionForm({
          ...institutionForm,
          permittedEmails: [...institutionForm.permittedEmails, ...emails]
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
      const res = await apiFetch("/api/admin/users", {
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
    if ((updates.role === 'institution_admin' || updates.role === 'institution_student') && !updates.institutionId) {
      alert("Please select an institution for institutional roles.");
      return;
    }
    try {
      const res = await apiFetch(`/api/admin/users/${uid}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json"
        },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        fetchUsers();
        setIsEditingUser(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditUser = (u: User) => {
    setSelectedUserForEdit(u);
    setUserForm({
      displayName: u.displayName || "",
      username: u.username || "",
      role: u.role,
      status: u.status,
      institutionId: u.institutionId || ""
    });
    setIsEditingUser(true);
  };

  const handleDeleteUser = async (uid: string, email: string) => {
    if (email === 'rahis2486@gmail.com') {
      alert("You cannot delete the main administrator account.");
      return;
    }

    if (!confirm(`Are you sure you want to delete user ${email} and ALL their related data? This action is irreversible.`)) {
      return;
    }

    try {
      const res = await apiFetch(`/api/admin/users/${uid}`, {
        method: "DELETE"
      });
      if (res.ok) {
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete user");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred while deleting the user.");
    }
  };

  const handleCleanupUsers = async () => {
    if (!confirm("DANGER: This will delete EVERY user and their related data except the main administrator (rahis2486@gmail.com). Are you absolutely sure?")) {
      return;
    }

    try {
      const res = await apiFetch("/api/admin/users-cleanup", {
        method: "DELETE",
        headers: { "x-user-uid": currentUser?.uid || "" }
      });
      if (res.ok) {
        const data = await res.json();
        alert(data.message);
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to perform cleanup");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred while performing cleanup.");
    }
  };

  useEffect(() => {
    if (selectedCourse) {
      fetchLessons(selectedCourse._id);
    }
  }, [selectedCourse]);

  const fetchCourses = async () => {
    try {
      const res = await apiFetch("/api/courses?limit=100", {
        headers: { "x-user-uid": currentUser?.uid || "" }
      });
      const data = await res.json();
      setCourses(data.courses || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLessons = async (courseId: string) => {
    try {
      const res = await apiFetch(`/api/courses/${courseId}/lessons`);
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
      
      const res = await apiFetch(url, {
        method,
        headers: { 
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...courseForm,
          tags: courseForm.tags.split(",").map(t => t.trim()).filter(Boolean)
        }),
      });
      
      if (res.ok) {
        fetchCourses();
        setIsEditingCourse(false);
        setCourseForm({ title: "", description: "", thumbnail: "", duration: "", tags: "", category: "" });
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
          const res = await apiFetch(`/api/courses/${id}`, { 
            method: "DELETE"
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
      
      const res = await apiFetch(url, {
        method,
        headers: { 
          "Content-Type": "application/json"
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
          const res = await apiFetch(`/api/lessons/${id}`, { 
            method: "DELETE"
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
          <button 
            onClick={() => setActiveTab("categories")}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-xl transition-all",
              activeTab === "categories" ? "bg-theme-accent/10 text-theme-accent" : "text-theme-text/40 hover:bg-theme-text/5"
            )}
          >
            <Tag size={18} />
            <span className="font-bold text-sm">Category Management</span>
          </button>
          <button 
            onClick={() => setActiveTab("analytics")}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-xl transition-all",
              activeTab === "analytics" ? "bg-theme-accent/10 text-theme-accent" : "text-theme-text/40 hover:bg-theme-text/5"
            )}
          >
            <BarChart3 size={18} />
            <span className="font-bold text-sm">Platform Analytics</span>
          </button>
          <button 
            onClick={() => setActiveTab("preferences")}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-xl transition-all",
              activeTab === "preferences" ? "bg-theme-accent/10 text-theme-accent" : "text-theme-text/40 hover:bg-theme-text/5"
            )}
          >
            <Target size={18} />
            <span className="font-bold text-sm">Preferences Management</span>
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
                  setCourseForm({ title: "", description: "", thumbnail: "", duration: "", tags: "", category: "" });
                }}
                className="p-1.5 hover:bg-theme-accent/10 rounded-lg text-theme-accent transition-colors"
              >
                <PlusCircle size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {Array.isArray(courses) && courses.map(course => (
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
                  <button
                    onClick={handleCleanupUsers}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl text-xs font-bold hover:bg-red-500/20 transition-colors"
                    title="Delete all users except main admin"
                  >
                    <Trash2 size={14} />
                    Cleanup Users
                  </button>
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
                  <select 
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value as any)}
                    className="px-4 py-2 bg-theme-card border border-theme-border rounded-xl text-xs font-bold text-theme-text/60 focus:ring-2 focus:ring-theme-accent/50 outline-none appearance-none cursor-pointer hover:bg-theme-text/5 transition-colors"
                  >
                    <option value="all">All Roles</option>
                    <option value="user">User</option>
                    <option value="staff">Staff</option>
                    <option value="institution_admin">Institution Admin</option>
                    <option value="institution_student">Institution Student</option>
                    <option value="student">Student</option>
                    <option value="admin">Admin</option>
                  </select>
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
                            u.role === 'admin' ? "bg-emerald-500/10 text-emerald-500" : 
                            u.role === 'institution_admin' ? "bg-amber-500/10 text-amber-500" :
                            u.role === 'staff' ? "bg-purple-500/10 text-purple-400" :
                            "bg-blue-500/10 text-blue-400"
                          )}>
                            <Shield size={10} />
                            {u.role.replace('-', ' ')}
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
                              onClick={() => handleEditUser(u)}
                              className="p-2 hover:bg-theme-text/10 rounded-lg text-theme-text/40 hover:text-theme-text transition-colors"
                              title="Edit User"
                            >
                              <Edit2 size={18} />
                            </button>
                            {u.email !== 'rahis2486@gmail.com' && (
                              <button 
                                onClick={() => handleDeleteUser(u.uid, u.email)}
                                className="p-2 hover:bg-red-500/10 rounded-lg text-theme-text/40 hover:text-red-500 transition-colors"
                                title="Delete User"
                              >
                                <Trash2 size={18} />
                              </button>
                            )}
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
                    setInstitutionForm({ name: "", location: "", logoUrl: "", permittedEmails: [] });
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
                        <label className="text-[10px] font-black uppercase tracking-widest text-theme-text/40">Permitted Emails</label>
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
                        {institutionForm.permittedEmails.length > 0 ? (
                          institutionForm.permittedEmails.map(email => (
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
                                permittedEmails: inst.permittedEmails || []
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
                          {inst.permittedEmails?.length || 0} Permitted Emails
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
          ) : activeTab === "analytics" ? (
            <motion.div
              key="analytics-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8 pb-20"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-black tracking-tight">Platform Analytics</h2>
                  <p className="text-theme-text/40">Real-time overview of Learn-Z platform and institutional performance.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {/* Custom Filter Dropdown */}
                  <div className="relative group">
                    <div className="flex items-center gap-2 px-4 py-2 bg-theme-card border border-theme-border rounded-xl text-xs font-bold text-theme-text/60 hover:bg-theme-text/5 transition-colors cursor-pointer">
                      <Filter size={14} />
                      <span>
                        {analyticsRange === "7" ? "Last Week" : 
                         analyticsRange === "60" ? "Last 60 Days" : 
                         analyticsRange === "90" ? "Last 90 Days" : 
                         analyticsRange === "365" ? "Last 365 Days" : "Last 30 Days"}
                        {analyticsInterval !== "daily" && ` (${analyticsInterval.charAt(0).toUpperCase() + analyticsInterval.slice(1)})`}
                      </span>
                    </div>
                    <div className="absolute right-0 top-full mt-2 w-56 bg-theme-card border border-theme-border rounded-2xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 p-2 space-y-1">
                      {[
                        { label: "Last Week (Daily)", range: "7", interval: "daily" },
                        { label: "Last 30 Days (Daily)", range: "30", interval: "daily" },
                        { label: "Last 60 Days (Daily)", range: "60", interval: "daily" },
                        { label: "Last 90 Days (Weekly)", range: "90", interval: "weekly" },
                        { label: "Last 365 Days (Monthly)", range: "365", interval: "monthly" },
                      ].map((opt) => (
                        <button
                          key={opt.label}
                          onClick={() => {
                            setAnalyticsRange(opt.range);
                            setAnalyticsInterval(opt.interval as any);
                          }}
                          className={cn(
                            "w-full text-left px-4 py-2 rounded-xl text-xs font-bold transition-colors",
                            analyticsRange === opt.range && analyticsInterval === opt.interval
                              ? "bg-theme-accent text-white"
                              : "hover:bg-theme-text/5 text-theme-text/60"
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button 
                    onClick={fetchAnalytics}
                    disabled={isAnalyticsLoading}
                    className="p-2 hover:bg-theme-accent/10 rounded-xl text-theme-accent transition-colors disabled:opacity-50"
                  >
                    <Loader2 size={20} className={cn(isAnalyticsLoading && "animate-spin")} />
                  </button>
                </div>
              </div>

              {analyticsData ? (
                <div className="space-y-8">
                  {/* Personal Analytics Summary */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-black uppercase tracking-widest text-theme-text/40 flex items-center gap-2">
                      <LayoutDashboard size={14} /> Platform Overview
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      {[
                        { label: "Total Courses", value: analyticsData.metrics.totalCourses, icon: BookOpen, color: "text-blue-500", bg: "bg-blue-500/10" },
                        { label: "Total Enrollments", value: analyticsData.metrics.totalEnrollments, icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-500/10" },
                        { label: "Unique Students", value: analyticsData.metrics.uniqueStudents, icon: Users, color: "text-purple-500", bg: "bg-purple-500/10" },
                        { label: "Completed Courses", value: analyticsData.metrics.completedCourses, icon: CheckCircle2, color: "text-amber-500", bg: "bg-amber-500/10" },
                      ].map((stat, i) => (
                        <motion.div
                          key={stat.label}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className="bg-theme-card border border-theme-border rounded-[32px] p-6 space-y-4 shadow-sm"
                        >
                          <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", stat.bg, stat.color)}>
                            <stat.icon size={24} />
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-theme-text/40">{stat.label}</p>
                            <h3 className="text-3xl font-black mt-1">{stat.value.toLocaleString()}</h3>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Institutional Analytics Summary */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-black uppercase tracking-widest text-theme-text/40 flex items-center gap-2">
                      <Building2 size={14} /> Institutional Insights
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      {[
                        { label: "Recommended Courses", value: analyticsData.metrics.totalInstitutionalCourses, icon: Award, color: "text-indigo-500", bg: "bg-indigo-500/10" },
                        { label: "Inst. Enrollments", value: analyticsData.metrics.totalInstitutionalEnrollments, icon: TrendingUp, color: "text-rose-500", bg: "bg-rose-500/10" },
                        { label: "Inst. Students", value: analyticsData.metrics.totalInstitutionalStudents, icon: Users, color: "text-cyan-500", bg: "bg-cyan-500/10" },
                        { label: "Completion Rate", value: `${analyticsData.metrics.institutionalCompletionRate.toFixed(1)}%`, icon: Target, color: "text-orange-500", bg: "bg-orange-500/10" },
                      ].map((stat, i) => (
                        <motion.div
                          key={stat.label}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: (i + 4) * 0.1 }}
                          className="bg-theme-card border border-theme-border rounded-[32px] p-6 space-y-4 shadow-sm"
                        >
                          <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", stat.bg, stat.color)}>
                            <stat.icon size={24} />
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-theme-text/40">{stat.label}</p>
                            <h3 className="text-3xl font-black mt-1">{stat.value}</h3>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Enrollment Trend Graph */}
                    <div className="bg-theme-card border border-theme-border rounded-[32px] p-8 shadow-sm">
                      <div className="flex items-center justify-between mb-8">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                          <TrendingUp size={20} className="text-theme-accent" />
                          Enrollment Trend
                        </h3>
                      </div>
                      <div className="h-[300px] w-full">
                        {analyticsData.trendData.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={analyticsData.trendData}>
                              <defs>
                                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="var(--theme-accent)" stopOpacity={0.3}/>
                                  <stop offset="95%" stopColor="var(--theme-accent)" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(var(--theme-text-rgb), 0.05)" />
                              <XAxis 
                                dataKey="date" 
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.4 }}
                                dy={10}
                              />
                              <YAxis 
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.4 }}
                              />
                              <Tooltip 
                                contentStyle={{ 
                                  backgroundColor: 'var(--theme-card)', 
                                  borderColor: 'var(--theme-border)',
                                  borderRadius: '16px',
                                  fontSize: '12px',
                                  fontWeight: 'bold'
                                }}
                              />
                              <Area 
                                type="monotone" 
                                dataKey="count" 
                                stroke="var(--theme-accent)" 
                                strokeWidth={3}
                                fillOpacity={1} 
                                fill="url(#colorCount)" 
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center text-theme-text/20">
                            <TrendingUp size={48} />
                            <p className="mt-2 font-bold">No enrollment data available yet</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Institution Comparison Bar Chart */}
                    <div className="bg-theme-card border border-theme-border rounded-[32px] p-8 shadow-sm">
                      <div className="flex items-center justify-between mb-8">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                          <BarChart3 size={20} className="text-indigo-500" />
                          Institution Comparison
                        </h3>
                      </div>
                      <div className="h-[300px] w-full">
                        {comparisonData.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={comparisonData}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(var(--theme-text-rgb), 0.05)" />
                              <XAxis 
                                dataKey="name" 
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.4 }}
                                dy={10}
                              />
                              <YAxis 
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.4 }}
                              />
                              <Tooltip 
                                contentStyle={{ 
                                  backgroundColor: 'var(--theme-card)', 
                                  borderColor: 'var(--theme-border)',
                                  borderRadius: '16px',
                                  fontSize: '12px',
                                  fontWeight: 'bold'
                                }}
                              />
                              <Bar 
                                dataKey="count" 
                                fill="var(--theme-accent)" 
                                radius={[8, 8, 0, 0]}
                                barSize={40}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center text-theme-text/20">
                            <Building2 size={48} />
                            <p className="mt-2 font-bold">No institutional data to compare</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Unified Top Courses Section */}
                  <div className="bg-theme-card border border-theme-border rounded-[32px] p-8 shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                      <h3 className="text-xl font-bold flex items-center gap-2">
                        <Award size={20} className="text-theme-accent" />
                        Top Performing Courses
                      </h3>
                      <div className="flex items-center bg-theme-bg p-1 rounded-2xl border border-theme-border">
                        {[
                          { id: "enrollment", label: "Enrollment", icon: TrendingUp },
                          { id: "rating", label: "Rating", icon: Target },
                          { id: "engagement", label: "Engagement", icon: Award },
                        ].map((filter) => (
                          <button
                            key={filter.id}
                            onClick={() => setTopCourseFilter(filter.id as any)}
                            className={cn(
                              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                              topCourseFilter === filter.id
                                ? "bg-theme-card text-theme-accent shadow-sm"
                                : "text-theme-text/40 hover:text-theme-text/60"
                            )}
                          >
                            <filter.icon size={14} />
                            {filter.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(topCourseFilter === 'enrollment' ? analyticsData.topEnrollments : 
                        topCourseFilter === 'rating' ? analyticsData.topRatings : 
                        analyticsData.topEngagement).map((course: any, i: number) => (
                        <div key={course._id} className="flex items-center gap-4 p-4 bg-theme-bg/50 border border-theme-border rounded-2xl hover:border-theme-accent/50 transition-all group">
                          <div className="w-10 h-10 rounded-xl bg-theme-card border border-theme-border flex items-center justify-center text-sm font-black text-theme-text/20 group-hover:text-theme-accent transition-colors">
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold truncate text-sm">{course.title}</p>
                            <div className="flex items-center gap-3 mt-1">
                              {topCourseFilter === 'enrollment' ? (
                                <p className="text-[10px] text-theme-text/40 font-black uppercase tracking-widest">{course.count} Enrollments</p>
                              ) : topCourseFilter === 'rating' ? (
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-0.5">
                                    {[...Array(5)].map((_, star) => (
                                      <div 
                                        key={star} 
                                        className={cn(
                                          "w-1.5 h-1.5 rounded-full",
                                          star < Math.round(course.avgRating) ? "bg-amber-500" : "bg-theme-text/10"
                                        )} 
                                      />
                                    ))}
                                  </div>
                                  <span className="text-[10px] font-black text-amber-500">{course.avgRating.toFixed(1)}</span>
                                </div>
                              ) : (
                                <p className="text-[10px] text-theme-text/40 font-black uppercase tracking-widest">{course.avgEngagement.toFixed(1)}% Engagement</p>
                              )}
                            </div>
                          </div>
                          <div className="h-1.5 w-24 bg-theme-bg rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full transition-all duration-500",
                                topCourseFilter === 'enrollment' ? "bg-emerald-500" : 
                                topCourseFilter === 'rating' ? "bg-amber-500" : "bg-purple-500"
                              )} 
                              style={{ 
                                width: `${
                                  topCourseFilter === 'enrollment' ? (course.count / (analyticsData.topEnrollments[0]?.count || 1)) * 100 :
                                  topCourseFilter === 'rating' ? (course.avgRating / 5) * 100 :
                                  course.avgEngagement
                                }%` 
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Institution-Wise Analytics Section */}
                  <div className="bg-theme-card border border-theme-border rounded-[32px] p-8 shadow-sm space-y-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div>
                        <h3 className="text-xl font-bold flex items-center gap-2">
                          <Building2 size={20} className="text-indigo-500" />
                          Institution-Wise Analytics
                        </h3>
                        <p className="text-sm text-theme-text/40">Drill down into specific institutional performance.</p>
                      </div>
                      <div className="relative w-full md:w-72">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-text/20" />
                        <input
                          type="text"
                          value={institutionSearch}
                          onChange={(e) => setInstitutionSearch(e.target.value)}
                          placeholder="Search institutions..."
                          className="w-full pl-12 pr-4 py-3 bg-theme-bg border border-theme-border rounded-xl focus:ring-2 focus:ring-theme-accent/50 outline-none text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {institutions
                        .filter(inst => inst.name.toLowerCase().includes(institutionSearch.toLowerCase()))
                        .slice(0, 6)
                        .map(inst => (
                        <button
                          key={inst._id}
                          onClick={() => fetchInstitutionAnalytics(inst._id)}
                          className={cn(
                            "flex items-center justify-between p-4 rounded-2xl border transition-all text-left",
                            selectedInstAnalytics?.institution?._id === inst._id
                              ? "bg-theme-accent/5 border-theme-accent shadow-sm"
                              : "bg-theme-bg/50 border-theme-border hover:border-theme-accent/30"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-theme-card border border-theme-border flex items-center justify-center text-theme-accent">
                              <Building2 size={20} />
                            </div>
                            <div>
                              <p className="font-bold text-sm">{inst.name}</p>
                              <p className="text-[10px] text-theme-text/40 font-black uppercase tracking-widest">{inst.location || "Global"}</p>
                            </div>
                          </div>
                          <ChevronRight size={16} className="text-theme-text/20" />
                        </button>
                      ))}
                    </div>

                    <AnimatePresence mode="wait">
                      {isInstAnalyticsLoading ? (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="h-64 flex flex-col items-center justify-center text-theme-text/20"
                        >
                          <Loader2 size={48} className="animate-spin" />
                          <p className="mt-4 font-bold">Fetching institution data...</p>
                        </motion.div>
                      ) : selectedInstAnalytics ? (
                        <motion.div
                          key={selectedInstAnalytics.institution._id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          className="pt-8 border-t border-theme-border space-y-8"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-[24px] bg-theme-accent/10 flex items-center justify-center text-theme-accent">
                              <Building2 size={32} />
                            </div>
                            <div>
                              <h4 className="text-2xl font-black">{selectedInstAnalytics.institution.name}</h4>
                              <p className="text-theme-text/40 font-bold">{selectedInstAnalytics.institution.location || "Global Institution"}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {[
                              { label: "Students", value: selectedInstAnalytics.metrics.totalStudents, icon: Users, color: "text-blue-500" },
                              { label: "Recommended", value: selectedInstAnalytics.metrics.recommendedCourses, icon: Award, color: "text-indigo-500" },
                              { label: "Enrollments", value: selectedInstAnalytics.metrics.totalEnrollments, icon: TrendingUp, color: "text-emerald-500" },
                              { label: "Completion", value: `${selectedInstAnalytics.metrics.completionRate.toFixed(1)}%`, icon: Target, color: "text-orange-500" },
                            ].map((stat) => (
                              <div key={stat.label} className="bg-theme-bg/50 border border-theme-border rounded-2xl p-4 flex items-center gap-4">
                                <div className={cn("w-10 h-10 rounded-xl bg-theme-card border border-theme-border flex items-center justify-center", stat.color)}>
                                  <stat.icon size={20} />
                                </div>
                                <div>
                                  <p className="text-[10px] font-black uppercase tracking-widest text-theme-text/40">{stat.label}</p>
                                  <p className="text-lg font-black">{stat.value}</p>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="h-[200px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={selectedInstAnalytics.trendData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(var(--theme-text-rgb), 0.05)" />
                                <XAxis dataKey="date" hide />
                                <YAxis hide />
                                <Tooltip 
                                  contentStyle={{ 
                                    backgroundColor: 'var(--theme-card)', 
                                    borderColor: 'var(--theme-border)',
                                    borderRadius: '12px',
                                    fontSize: '10px'
                                  }}
                                />
                                <Area type="monotone" dataKey="count" stroke="var(--theme-accent)" fill="var(--theme-accent)" fillOpacity={0.1} strokeWidth={2} />
                              </AreaChart>
                            </ResponsiveContainer>
                            <p className="text-center text-[10px] font-black uppercase tracking-widest text-theme-text/20 mt-2">30-Day Enrollment Trend</p>
                          </div>
                        </motion.div>
                      ) : (
                        <div className="h-64 flex flex-col items-center justify-center text-theme-text/10 border-2 border-dashed border-theme-border rounded-[32px]">
                          <Building2 size={48} />
                          <p className="mt-4 font-bold">Select an institution to view detailed analytics</p>
                        </div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              ) : (
                <div className="h-[400px] flex flex-col items-center justify-center text-theme-text/20">
                  <PieChart size={64} className="animate-pulse" />
                  <p className="mt-4 font-bold">Synthesizing platform data...</p>
                </div>
              )}
            </motion.div>
          ) : activeTab === "preferences" ? (
            <motion.div
              key="preferences-list"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-black tracking-tight">Preferences Management</h2>
                  <p className="text-theme-text/40">Manage dynamic options for interests, hobbies, and learning styles.</p>
                </div>
                <button 
                  onClick={() => {
                    setSelectedPreference(null);
                    setPreferenceForm({ type: 'interest', label: '', value: '', iconName: '' });
                    setIsEditingPreference(true);
                  }}
                  className="flex items-center gap-2 px-6 py-3 bg-theme-accent text-white font-bold rounded-xl hover:opacity-90 transition-opacity"
                >
                  <Plus size={20} /> Add Option
                </button>
              </div>

              {isEditingPreference ? (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-theme-card border border-theme-border rounded-[32px] p-8 space-y-8 shadow-sm max-w-2xl"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold">{selectedPreference ? "Edit Option" : "New Option"}</h3>
                    <button onClick={() => setIsEditingPreference(false)} className="p-2 hover:bg-theme-text/5 rounded-full">
                      <X size={24} />
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-theme-text/40">Option Type</label>
                      <select
                        value={preferenceForm.type}
                        onChange={e => setPreferenceForm({ ...preferenceForm, type: e.target.value as any })}
                        className="w-full bg-theme-bg border border-theme-border rounded-xl p-4 focus:ring-2 focus:ring-theme-accent/50 outline-none"
                      >
                        <option value="interest">Interest</option>
                        <option value="hobby">Hobby</option>
                        <option value="learningPreference">Learning Style</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-theme-text/40">Label</label>
                      <input
                        type="text"
                        value={preferenceForm.label}
                        onChange={e => setPreferenceForm({ ...preferenceForm, label: e.target.value })}
                        className="w-full bg-theme-bg border border-theme-border rounded-xl p-4 focus:ring-2 focus:ring-theme-accent/50 outline-none"
                        placeholder="e.g. Photography"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-theme-text/40">Value (Unique Key)</label>
                      <input
                        type="text"
                        value={preferenceForm.value}
                        onChange={e => setPreferenceForm({ ...preferenceForm, value: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                        className="w-full bg-theme-bg border border-theme-border rounded-xl p-4 focus:ring-2 focus:ring-theme-accent/50 outline-none"
                        placeholder="e.g. photography"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-4 pt-4 border-t border-theme-border">
                    <button 
                      onClick={() => setIsEditingPreference(false)}
                      className="px-8 py-3 rounded-xl text-theme-text/60 hover:text-theme-text"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleSavePreference}
                      className="px-8 py-3 bg-theme-accent text-white font-bold rounded-xl hover:opacity-90 transition-opacity"
                    >
                      {selectedPreference ? "Update Option" : "Create Option"}
                    </button>
                  </div>
                </motion.div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {['interest', 'hobby', 'learningPreference'].map(type => (
                    <div key={type} className="space-y-4">
                      <h3 className="text-sm font-black uppercase tracking-widest text-theme-text/40 px-2">
                        {type === 'interest' ? 'Interests' : type === 'hobby' ? 'Hobbies' : 'Learning Styles'}
                      </h3>
                      <div className="space-y-2">
                        {preferenceOptions.filter(opt => opt.type === type).map(opt => (
                          <div key={opt._id} className="bg-theme-card border border-theme-border rounded-2xl p-4 flex items-center justify-between group hover:border-theme-accent/30 transition-all">
                            <div>
                              <p className="font-bold">{opt.label}</p>
                              <p className="text-[10px] text-theme-text/40 font-mono">{opt.value}</p>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => {
                                  setSelectedPreference(opt);
                                  setPreferenceForm({ type: opt.type, label: opt.label, value: opt.value, iconName: opt.iconName || '' });
                                  setIsEditingPreference(true);
                                }}
                                className="p-2 hover:bg-theme-accent/10 text-theme-accent rounded-lg transition-colors"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button 
                                onClick={() => handleDeletePreference(opt._id)}
                                className="p-2 hover:bg-red-500/10 text-red-500 rounded-lg transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
                        {preferenceOptions.filter(opt => opt.type === type).length === 0 && (
                          <div className="p-8 text-center border-2 border-dashed border-theme-border rounded-2xl text-theme-text/20">
                            <p className="text-xs font-bold">No options added yet</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ) : activeTab === "categories" ? (
            <motion.div
              key="categories-list"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-black tracking-tight">Category Management</h2>
                  <p className="text-theme-text/40">Manage categories for course organization.</p>
                </div>
                <button 
                  onClick={() => {
                    setSelectedCategory(null);
                    setCategoryForm({ name: "", description: "" });
                    setIsEditingCategory(true);
                  }}
                  className="flex items-center gap-2 px-6 py-3 bg-theme-accent text-white font-bold rounded-xl hover:opacity-90 transition-opacity"
                >
                  <Plus size={20} /> Add Category
                </button>
              </div>

              {isEditingCategory ? (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-theme-card border border-theme-border rounded-[32px] p-8 space-y-8 shadow-sm max-w-2xl"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold">{selectedCategory ? "Edit Category" : "New Category"}</h3>
                    <button onClick={() => setIsEditingCategory(false)} className="p-2 hover:bg-theme-text/5 rounded-full">
                      <X size={24} />
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-theme-text/40">Category Name</label>
                      <input
                        type="text"
                        value={categoryForm.name}
                        onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })}
                        className="w-full bg-theme-bg border border-theme-border rounded-xl p-4 focus:ring-2 focus:ring-theme-accent/50 outline-none"
                        placeholder="e.g. Web Development"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-theme-text/40">Description</label>
                      <textarea
                        value={categoryForm.description}
                        onChange={e => setCategoryForm({ ...categoryForm, description: e.target.value })}
                        className="w-full bg-theme-bg border border-theme-border rounded-xl p-4 h-32 focus:ring-2 focus:ring-theme-accent/50 outline-none resize-none"
                        placeholder="Brief description of the category..."
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-4 pt-4 border-t border-theme-border">
                    <button 
                      onClick={() => setIsEditingCategory(false)}
                      className="px-8 py-3 rounded-xl text-theme-text/60 hover:text-theme-text"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleSaveCategory}
                      className="px-12 py-3 bg-theme-accent text-white font-bold rounded-xl hover:opacity-90 flex items-center gap-2"
                    >
                      <Save size={20} />
                      {selectedCategory ? "Update Category" : "Create Category"}
                    </button>
                  </div>
                </motion.div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {categories.map(cat => (
                    <div 
                      key={cat._id}
                      className="bg-theme-card border border-theme-border rounded-[32px] p-6 space-y-6 group hover:border-theme-accent transition-all shadow-sm"
                    >
                      <div className="flex items-start justify-between">
                        <div className="w-12 h-12 rounded-xl bg-theme-accent/10 flex items-center justify-center text-theme-accent">
                          <Tag size={24} />
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => {
                              setSelectedCategory(cat);
                              setCategoryForm({
                                name: cat.name,
                                description: cat.description || ""
                              });
                              setIsEditingCategory(true);
                            }}
                            className="p-2 hover:bg-theme-accent/10 rounded-lg text-theme-accent"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={() => handleDeleteCategory(cat._id)}
                            className="p-2 hover:bg-red-500/10 rounded-lg text-red-400"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold truncate">{cat.name}</h3>
                        <p className="text-sm text-theme-text/40 line-clamp-2">
                          {cat.description || "No description set"}
                        </p>
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
                  <label className="text-xs font-bold uppercase tracking-widest text-theme-text/40">Content Duration</label>
                  <input
                    type="text"
                    value={courseForm.duration}
                    onChange={e => setCourseForm({ ...courseForm, duration: e.target.value })}
                    className="w-full bg-theme-card border border-theme-border rounded-xl p-4 focus:ring-2 focus:ring-theme-accent/50 outline-none"
                    placeholder="e.g. 5h 30m"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-theme-text/40">Category</label>
                  <CategorySelect 
                    value={courseForm.category} 
                    onChange={(val) => setCourseForm({ ...courseForm, category: val })}
                    categories={categories}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-theme-text/40">Tags (comma separated)</label>
                  <input
                    type="text"
                    value={courseForm.tags}
                    onChange={e => setCourseForm({ ...courseForm, tags: e.target.value })}
                    className="w-full bg-theme-card border border-theme-border rounded-xl p-4 focus:ring-2 focus:ring-theme-accent/50 outline-none"
                    placeholder="e.g. AI, Python, Beginner"
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
                            thumbnail: selectedCourse.thumbnail,
                            duration: selectedCourse.duration || "",
                            tags: selectedCourse.tags?.join(", ") || "",
                            category: selectedCourse.category || "General"
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

      <AnimatePresence>
        {isEditingUser && selectedUserForEdit && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditingUser(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-4xl bg-theme-card border border-theme-border rounded-[32px] shadow-2xl overflow-hidden flex flex-col h-[85vh]"
            >
              <div className="p-8 border-b border-theme-border flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-theme-accent/10 flex items-center justify-center">
                    <Edit2 size={24} className="text-theme-accent" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black tracking-tight">Edit User</h3>
                    <p className="text-xs text-theme-text/40 font-bold uppercase tracking-widest">{selectedUserForEdit.email}</p>
                  </div>
                </div>
                <button onClick={() => setIsEditingUser(false)} className="p-2 hover:bg-theme-text/5 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 space-y-8 overflow-y-auto flex-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-theme-text/40">User Information</h4>
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-theme-text/60 ml-1">Full Name</label>
                          <input 
                            type="text"
                            value={userForm.displayName}
                            onChange={(e) => setUserForm({ ...userForm, displayName: e.target.value })}
                            className="w-full px-4 py-3 bg-theme-bg border border-theme-border rounded-xl text-sm focus:ring-2 focus:ring-theme-accent/50 outline-none"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-theme-text/60 ml-1">Username</label>
                          <input 
                            type="text"
                            value={userForm.username}
                            onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                            className="w-full px-4 py-3 bg-theme-bg border border-theme-border rounded-xl text-sm focus:ring-2 focus:ring-theme-accent/50 outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-theme-text/40">Status & Role</h4>
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-theme-text/60 ml-1">Role</label>
                          <select 
                            value={userForm.role}
                            onChange={(e) => setUserForm({ ...userForm, role: e.target.value as User['role'] })}
                            className="w-full px-4 py-3 bg-theme-bg border border-theme-border rounded-xl text-sm focus:ring-2 focus:ring-theme-accent/50 outline-none appearance-none"
                          >
                            <option value="user">User</option>
                            <option value="staff">Staff</option>
                            <option value="institution_admin">Institution Admin</option>
                            <option value="institution_student">Institution Student</option>
                            <option value="student">Student</option>
                            <option value="admin">Admin</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-theme-text/60 ml-1">Status</label>
                          <select 
                            value={userForm.status}
                            onChange={(e) => setUserForm({ ...userForm, status: e.target.value as User['status'] })}
                            className="w-full px-4 py-3 bg-theme-bg border border-theme-border rounded-xl text-sm focus:ring-2 focus:ring-theme-accent/50 outline-none appearance-none"
                          >
                            <option value="active">Active</option>
                            <option value="deactivated">Deactivated</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {(userForm.role === 'institution_admin' || userForm.role === 'institution_student') && (
                      <div className="space-y-4 h-full flex flex-col">
                        <div className="flex items-center justify-between">
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-theme-text/40">Linked Institution (Required)</h4>
                        </div>
                        
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-text/30" size={14} />
                          <input 
                            type="text"
                            placeholder="Search institutions..."
                            value={institutionSearchQuery}
                            onChange={(e) => setInstitutionSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-theme-bg border border-theme-border rounded-xl text-xs focus:ring-2 focus:ring-theme-accent/50 outline-none"
                          />
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto flex-1 pr-2">
                          {institutions
                            .filter(inst => inst.name.toLowerCase().includes(institutionSearchQuery.toLowerCase()))
                            .map(inst => (
                              <button
                                key={inst._id}
                                onClick={() => setUserForm({ ...userForm, institutionId: inst._id })}
                                className={cn(
                                  "flex items-center p-3 rounded-2xl border transition-all text-left gap-3",
                                  userForm.institutionId === inst._id
                                    ? "bg-theme-accent/10 border-theme-accent ring-1 ring-theme-accent/20"
                                    : "bg-theme-bg border-theme-border hover:border-theme-text/30"
                                )}
                              >
                                <div className="w-10 h-10 rounded-xl bg-white p-1.5 flex items-center justify-center border border-theme-border shrink-0">
                                  {inst.logoUrl ? (
                                    <img src={inst.logoUrl} alt={inst.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                                  ) : (
                                    <Building2 size={20} className="text-theme-text/20" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold truncate">{inst.name}</p>
                                  {inst.location && (
                                    <p className="text-[10px] text-theme-text/40 font-medium truncate">{inst.location}</p>
                                  )}
                                </div>
                              </button>
                            ))}
                          {institutions.length === 0 && (
                            <div className="col-span-full py-10 text-center text-theme-text/40 text-xs italic">
                              No institutions found.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {!(userForm.role === 'institution_admin' || userForm.role === 'institution_student') && (
                      <div className="h-full flex items-center justify-center border-2 border-dashed border-theme-border rounded-[32px] p-8 text-center bg-theme-text/[0.01]">
                        <div className="space-y-2">
                          <Building2 size={32} className="mx-auto text-theme-text/10" />
                          <p className="text-xs text-theme-text/40 font-medium">Institution selection is only required for Institution Admin role.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-8 bg-theme-text/[0.02] border-t border-theme-border flex gap-3">
                <button 
                  onClick={() => setIsEditingUser(false)}
                  className="flex-1 px-6 py-3 border border-theme-border rounded-xl font-bold text-sm hover:bg-theme-text/5 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => updateUser(selectedUserForEdit.uid, userForm)}
                  className="flex-1 px-6 py-3 bg-theme-accent text-white font-bold rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-theme-accent/20"
                >
                  Save Changes
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
