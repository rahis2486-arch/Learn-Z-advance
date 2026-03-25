import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  User as UserIcon, Mail, Hash, Shield, 
  Target, Heart, BookOpen, Clock, 
  Zap, Search, Upload, Camera, Check, AlertCircle,
  Edit2, X as CloseIcon, Save, Loader2,
  Trophy, BrainCircuit, Timer, Star, TrendingUp,
  ChevronRight, BarChart3
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [usernameSuggestion, setUsernameSuggestion] = useState<string | null>(null);
  const [userProgress, setUserProgress] = useState<any[]>([]);
  const [loadingProgress, setLoadingProgress] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      fetchUserProgress();
    }
  }, [user]);

  const fetchUserProgress = async () => {
    try {
      setLoadingProgress(true);
      const res = await fetch(`/api/progress/${user?.uid}`);
      if (res.ok) {
        const data = await res.json();
        setUserProgress(data);
      }
    } catch (err) {
      console.error("Failed to fetch progress:", err);
    } finally {
      setLoadingProgress(false);
    }
  };

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const [editForm, setEditForm] = useState({
    displayName: user?.displayName || '',
    username: user?.username || '',
    interests: user?.interests?.join(', ') || '',
    hobbies: user?.hobbies?.join(', ') || '',
    learningPreferences: user?.learningPreferences?.join(', ') || '',
    dailyCommitment: user?.dailyCommitment || '',
    motivation: user?.motivation || '',
    discoverySource: user?.discoverySource || ''
  });

  useEffect(() => {
    if (user) {
      setEditForm({
        displayName: user.displayName || '',
        username: user.username || '',
        interests: user.interests?.join(', ') || '',
        hobbies: user.hobbies?.join(', ') || '',
        learningPreferences: user.learningPreferences?.join(', ') || '',
        dailyCommitment: user.dailyCommitment || '',
        motivation: user.motivation || '',
        discoverySource: user.discoverySource || ''
      });
    }
  }, [user]);

  if (!user) return null;

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setEditError(null);
    setUsernameSuggestion(null);

    try {
      const res = await fetch(`/api/users/${user.uid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          interests: editForm.interests.split(',').map(i => i.trim()).filter(Boolean),
          hobbies: editForm.hobbies.split(',').map(i => i.trim()).filter(Boolean),
          learningPreferences: editForm.learningPreferences.split(',').map(i => i.trim()).filter(Boolean)
        })
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.suggestion) {
          setUsernameSuggestion(data.suggestion);
        }
        throw new Error(data.error || 'Failed to update profile');
      }

      await refreshUser();
      setIsEditModalOpen(false);
    } catch (err: any) {
      setEditError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type and size
    if (!file.type.startsWith('image/')) {
      setUploadError('Please upload an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File size must be less than 5MB.');
      return;
    }

    // Set instant preview
    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);

    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('photo', file);

    try {
      const res = await fetch(`/api/users/${user.uid}/profile-picture`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Failed to upload image');
      
      await refreshUser();
      setPreviewUrl(null); // Clear preview once sync is done
    } catch (err) {
      setUploadError('Failed to update profile picture. Please try again.');
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  const InfoCard = ({ icon: Icon, label, value, className }: any) => (
    <div className={cn("p-4 rounded-2xl bg-theme-card border border-theme-border flex items-start gap-4", className)}>
      <div className="w-10 h-10 rounded-xl bg-theme-accent/10 flex items-center justify-center shrink-0">
        <Icon size={20} className="text-theme-accent" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-theme-text/40 mb-1">{label}</p>
        <p className="text-sm font-bold text-theme-text truncate">{value || 'Not set'}</p>
      </div>
    </div>
  );

  const TagList = ({ icon: Icon, label, tags }: any) => (
    <div className="p-6 rounded-3xl bg-theme-card border border-theme-border">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-lg bg-theme-accent/10 flex items-center justify-center">
          <Icon size={16} className="text-theme-accent" />
        </div>
        <h3 className="text-xs font-black uppercase tracking-widest text-theme-text/60">{label}</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {tags && tags.length > 0 ? (
          tags.map((tag: string, i: number) => (
            <span key={i} className="px-3 py-1.5 rounded-full bg-theme-text/5 text-xs font-medium text-theme-text/80">
              {tag}
            </span>
          ))
        ) : (
          <span className="text-xs italic text-theme-text/30">No data provided</span>
        )}
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-6 lg:p-12 space-y-12">
      {/* Header & Profile Picture Section */}
      <section className="flex flex-col items-center text-center space-y-6">
        <div className="relative group">
          <div className="w-40 h-40 rounded-full border-4 border-theme-accent/20 p-1 bg-theme-bg overflow-hidden relative">
            {(previewUrl || user.photoURL) ? (
              <img 
                src={previewUrl || user.photoURL || ""} 
                alt={user.displayName || ""} 
                className="w-full h-full rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full rounded-full bg-gradient-to-tr from-theme-accent to-theme-accent/40 flex items-center justify-center">
                <UserIcon size={64} className="text-white opacity-50" />
              </div>
            )}
            
            {isUploading && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              </div>
            )}
          </div>

          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-theme-accent text-white shadow-xl flex items-center justify-center hover:scale-110 transition-transform disabled:opacity-50 disabled:scale-100"
            title="Update Profile Picture"
          >
            <Camera size={20} />
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
            accept="image/*"
          />
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-black tracking-tight text-theme-text">{user.displayName}</h1>
            <p className="text-theme-text/60 font-medium">@{user.username || 'user'}</p>
          </div>
          
          <button 
            onClick={() => setIsEditModalOpen(true)}
            className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-theme-accent text-white font-bold text-sm hover:scale-105 transition-transform shadow-lg shadow-theme-accent/20"
          >
            <Edit2 size={16} />
            Edit Profile
          </button>
        </div>

        {uploadError && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 text-red-500 text-xs font-bold">
            <AlertCircle size={14} />
            {uploadError}
          </div>
        )}
      </section>

      {/* Basic Information Section */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-theme-border" />
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-theme-text/40">Basic Information</h2>
          <div className="h-px flex-1 bg-theme-border" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoCard icon={UserIcon} label="Full Name" value={user.displayName} />
          <InfoCard icon={Mail} label="Email Address" value={user.email} />
          <InfoCard icon={Hash} label="Username" value={user.username} />
          <InfoCard icon={Shield} label="User ID" value={user.uid} className="md:col-span-2" />
        </div>
      </section>

      {/* User Preferences Section */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-theme-border" />
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-theme-text/40">Learning Preferences</h2>
          <div className="h-px flex-1 bg-theme-border" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <TagList icon={Heart} label="Interests" tags={user.interests} />
          <TagList icon={Zap} label="Hobbies" tags={user.hobbies} />
          <TagList icon={BookOpen} label="Learning Preferences" tags={user.learningPreferences} />
          
          <div className="p-6 rounded-3xl bg-theme-card border border-theme-border space-y-6 md:col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={14} className="text-theme-accent" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-theme-text/40">Daily Study Goal</p>
                </div>
                <p className="text-sm font-bold text-theme-text">{user.dailyCommitment || 'Not set'}</p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Target size={14} className="text-theme-accent" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-theme-text/40">Motivation</p>
                </div>
                <p className="text-sm font-bold text-theme-text">{user.motivation || 'Not set'}</p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Search size={14} className="text-theme-accent" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-theme-text/40">Discovery Source</p>
                </div>
                <p className="text-sm font-bold text-theme-text">{user.discoverySource || 'Not set'}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Learning Analytics Section */}
      <section className="space-y-8">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-theme-border" />
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-theme-text/40">Learning Analytics</h2>
          <div className="h-px flex-1 bg-theme-border" />
        </div>

        {loadingProgress ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="animate-spin text-theme-accent" size={32} />
          </div>
        ) : userProgress.length > 0 ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-6 bg-theme-card border border-theme-border rounded-3xl space-y-2">
                <Trophy className="text-amber-500" size={24} />
                <p className="text-2xl font-black">{userProgress.filter(p => p.isCompleted).length}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-theme-text/40">Courses Completed</p>
              </div>
              <div className="p-6 bg-theme-card border border-theme-border rounded-3xl space-y-2">
                <BrainCircuit className="text-theme-accent" size={24} />
                <p className="text-2xl font-black">
                  {userProgress.reduce((acc, p) => acc + (p.lessonQuizzes?.length || 0), 0)}
                </p>
                <p className="text-[10px] font-black uppercase tracking-widest text-theme-text/40">Quizzes Passed</p>
              </div>
              <div className="p-6 bg-theme-card border border-theme-border rounded-3xl space-y-2">
                <TrendingUp className="text-blue-500" size={24} />
                <p className="text-2xl font-black">
                  {Math.round(userProgress.reduce((acc, p) => {
                    const quizzes = p.lessonQuizzes || [];
                    if (quizzes.length === 0) return acc;
                    const avg = quizzes.reduce((s: number, q: any) => s + (q.score / q.totalQuestions), 0) / quizzes.length;
                    return acc + (avg * 100);
                  }, 0) / (userProgress.filter(p => p.lessonQuizzes?.length > 0).length || 1))}%
                </p>
                <p className="text-[10px] font-black uppercase tracking-widest text-theme-text/40">Average Score</p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-theme-text/60 ml-2">Recent Course Progress</h3>
              {userProgress.slice(0, 3).map((progress) => {
                // Skip if course is deleted and no snapshot exists
                if (!progress.courseId) return null;

                return (
                  <div key={progress._id} className="p-6 bg-theme-card border border-theme-border rounded-3xl space-y-6">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl overflow-hidden border border-theme-border shrink-0 bg-theme-text/5 flex items-center justify-center">
                          {progress.courseId?.thumbnail ? (
                            <img src={progress.courseId.thumbnail} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-full h-full bg-theme-accent/10 flex items-center justify-center text-theme-accent">
                              <BookOpen size={20} />
                            </div>
                          )}
                        </div>
                        <div>
                          <h4 className="font-bold text-theme-text line-clamp-1">
                            {progress.courseId?.title || "Deleted Course"}
                            {progress.courseId?.deleted && (
                              <span className="ml-2 text-[8px] px-1.5 py-0.5 rounded bg-theme-text/10 text-theme-text/40 uppercase tracking-tighter">Deleted</span>
                            )}
                          </h4>
                          <p className="text-[10px] text-theme-text/40 uppercase tracking-widest font-black">
                            {progress.enrollmentSource === 'institution' ? 'Institutional' : 'Personal'} Enrollment
                          </p>
                        </div>
                      </div>
                      {progress.isCompleted && (
                        <div className="px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                          <Check size={12} />
                          Completed
                        </div>
                      )}
                    </div>

                  <div className="space-y-4">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                      <span className="text-theme-text-muted">Course Completion</span>
                      <span className="text-theme-accent">{Math.round(((progress.completedLessons?.length || 0) / 10) * 100)}%</span>
                    </div>
                    <div className="h-1.5 bg-theme-text/5 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-theme-accent rounded-full" 
                        style={{ width: `${((progress.completedLessons?.length || 0) / 10) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-theme-border/5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-theme-accent/5 flex items-center justify-center text-theme-accent">
                        <BrainCircuit size={16} />
                      </div>
                      <div>
                        <p className="text-[10px] text-theme-text/40 uppercase tracking-widest font-black">Lesson Quizzes</p>
                        <p className="text-xs font-bold">{progress.lessonQuizzes?.length || 0} Passed</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/5 flex items-center justify-center text-blue-500">
                        <BarChart3 size={16} />
                      </div>
                      <div>
                        <p className="text-[10px] text-theme-text/40 uppercase tracking-widest font-black">Final Test</p>
                        <p className="text-xs font-bold">
                          {progress.finalTest?.completed ? `${Math.round((progress.finalTest.score / progress.finalTest.totalQuestions) * 100)}% Score` : 'Not Taken'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        ) : (
          <div className="p-12 bg-theme-card border border-theme-border rounded-[32px] text-center space-y-4">
            <div className="w-16 h-16 bg-theme-text/5 rounded-full flex items-center justify-center mx-auto">
              <BarChart3 size={32} className="text-theme-text/20" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold">No progress data yet</h3>
              <p className="text-sm text-theme-text/40">Start learning to see your analytics here!</p>
            </div>
          </div>
        )}
      </section>

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-theme-card border border-theme-border rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-theme-border flex items-center justify-between bg-theme-bg/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-theme-accent/10 flex items-center justify-center">
                    <Edit2 size={20} className="text-theme-accent" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black tracking-tight text-theme-text">Edit Profile</h2>
                    <p className="text-xs text-theme-text/40 font-bold uppercase tracking-widest">Update your learning identity</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsEditModalOpen(false)}
                  className="w-10 h-10 rounded-full hover:bg-theme-text/5 flex items-center justify-center transition-colors text-theme-text/40 hover:text-theme-text"
                >
                  <CloseIcon size={20} />
                </button>
              </div>

              <form onSubmit={handleUpdateProfile} className="flex-1 overflow-y-auto p-8 space-y-8">
                {editError && (
                  <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-500 text-sm font-bold">
                    <AlertCircle size={18} />
                    {editError}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-theme-text/40 ml-2">Full Name</label>
                    <input 
                      type="text"
                      value={editForm.displayName}
                      onChange={e => setEditForm({...editForm, displayName: e.target.value})}
                      className="w-full px-5 py-3.5 rounded-2xl bg-theme-bg border border-theme-border focus:border-theme-accent outline-none font-bold text-sm transition-all"
                      placeholder="Enter your full name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-theme-text/40 ml-2">Username</label>
                    <input 
                      type="text"
                      value={editForm.username}
                      onChange={e => {
                        setEditForm({...editForm, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')});
                        setUsernameSuggestion(null);
                      }}
                      className={cn(
                        "w-full px-5 py-3.5 rounded-2xl bg-theme-bg border outline-none font-bold text-sm transition-all",
                        editError?.includes('Username') ? "border-red-500" : "border-theme-border focus:border-theme-accent"
                      )}
                      placeholder="Choose a unique username"
                      required
                    />
                    {usernameSuggestion && (
                      <div className="mt-2 p-3 rounded-xl bg-theme-accent/5 border border-theme-accent/10 flex items-center justify-between">
                        <p className="text-xs font-bold text-theme-text/60">
                          Try: <span className="text-theme-accent">{usernameSuggestion}</span>
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setEditForm({ ...editForm, username: usernameSuggestion });
                            setUsernameSuggestion(null);
                            setEditError(null);
                          }}
                          className="text-[10px] font-black uppercase tracking-widest text-theme-accent hover:underline"
                        >
                          Use this
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-theme-text/40 ml-2">Interests (comma separated)</label>
                    <input 
                      type="text"
                      value={editForm.interests}
                      onChange={e => setEditForm({...editForm, interests: e.target.value})}
                      className="w-full px-5 py-3.5 rounded-2xl bg-theme-bg border border-theme-border focus:border-theme-accent outline-none font-bold text-sm transition-all"
                      placeholder="e.g. AI, Physics, Music"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-theme-text/40 ml-2">Hobbies (comma separated)</label>
                    <input 
                      type="text"
                      value={editForm.hobbies}
                      onChange={e => setEditForm({...editForm, hobbies: e.target.value})}
                      className="w-full px-5 py-3.5 rounded-2xl bg-theme-bg border border-theme-border focus:border-theme-accent outline-none font-bold text-sm transition-all"
                      placeholder="e.g. Reading, Coding, Gaming"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-theme-text/40 ml-2">Learning Preferences (comma separated)</label>
                    <input 
                      type="text"
                      value={editForm.learningPreferences}
                      onChange={e => setEditForm({...editForm, learningPreferences: e.target.value})}
                      className="w-full px-5 py-3.5 rounded-2xl bg-theme-bg border border-theme-border focus:border-theme-accent outline-none font-bold text-sm transition-all"
                      placeholder="e.g. Visual, Practical, Auditory"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-theme-text/40 ml-2">Daily Study Goal</label>
                    <select 
                      value={editForm.dailyCommitment}
                      onChange={e => setEditForm({...editForm, dailyCommitment: e.target.value})}
                      className="w-full px-5 py-3.5 rounded-2xl bg-theme-bg border border-theme-border focus:border-theme-accent outline-none font-bold text-sm transition-all appearance-none"
                    >
                      <option value="">Select a goal</option>
                      <option value="15 mins/day">15 mins/day</option>
                      <option value="30 mins/day">30 mins/day</option>
                      <option value="1 hour/day">1 hour/day</option>
                      <option value="2+ hours/day">2+ hours/day</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-theme-text/40 ml-2">Motivation</label>
                    <input 
                      type="text"
                      value={editForm.motivation}
                      onChange={e => setEditForm({...editForm, motivation: e.target.value})}
                      className="w-full px-5 py-3.5 rounded-2xl bg-theme-bg border border-theme-border focus:border-theme-accent outline-none font-bold text-sm transition-all"
                      placeholder="What drives you to learn?"
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="flex-1 px-6 py-4 rounded-2xl border border-theme-border font-bold text-sm hover:bg-theme-text/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={isSaving}
                    className="flex-[2] px-6 py-4 rounded-2xl bg-theme-accent text-white font-bold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-xl shadow-theme-accent/20 disabled:opacity-50 disabled:scale-100"
                  >
                    {isSaving ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Save size={18} />
                    )}
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
