import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { 
  ChevronLeft, ChevronRight, Play, CheckCircle2, 
  BookOpen, Video, FileText, MessageSquare, 
  Maximize2, Volume2, Settings, List,
  Sparkles, BrainCircuit, Mic, Camera, X,
  Timer, AlertCircle, Trophy, RotateCcw,
  ArrowRight, Check, Info
} from "lucide-react";
import { cn } from "../lib/utils";
import { useAssistant } from "../contexts/AssistantContext";
import { useAuth } from "../contexts/AuthContext";
import { GoogleGenAI, Type } from "@google/genai";
import { apiFetch } from "../lib/api";

interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

interface QuizResult {
  score: number;
  totalQuestions: number;
  timeTaken: number;
  attempts?: number;
  answers: {
    question: string;
    userAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    explanation: string;
  }[];
  feedback: {
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
  };
}

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
  const [searchParams] = useSearchParams();
  const source = searchParams.get('source') || 'personal';
  const navigate = useNavigate();
  const { user } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [myCourses, setMyCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<"content" | "notes" | "transcript">("content");
  const [classroomTab, setClassroomTab] = useState<"personal" | "institution">("personal");
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [userProgress, setUserProgress] = useState<any>(null);

  // Quiz State
  const [isQuizOpen, setIsQuizOpen] = useState(false);
  const [quizType, setQuizType] = useState<"lesson" | "final">("lesson");
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [quizStartTime, setQuizStartTime] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState(20);
  const [quizResults, setQuizResults] = useState<QuizResult | null>(null);
  const [isSubmittingQuiz, setIsSubmittingQuiz] = useState(false);
  const [isApiReady, setIsApiReady] = useState(false);
  const playerRef = useRef<any>(null);
  const playerElementRef = useRef<HTMLDivElement>(null);

  const { setContext, toggleSidebar, isSidebarOpen, theme, lastAction } = useAssistant();

  // YouTube API initialization
  useEffect(() => {
    const checkApi = () => {
      if ((window as any).YT && (window as any).YT.Player) {
        console.log("[Classroom] YouTube API already ready");
        setIsApiReady(true);
        return true;
      }
      return false;
    };

    if (!checkApi()) {
      if (!(window as any).YT) {
        console.log("[Classroom] Loading YouTube IFrame API script...");
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      }

      const previousOnReady = (window as any).onYouTubeIframeAPIReady;
      (window as any).onYouTubeIframeAPIReady = () => {
        if (previousOnReady) previousOnReady();
        console.log("[Classroom] YouTube IFrame API Ready event fired");
        setIsApiReady(true);
      };

      // Fallback check in case the event doesn't fire but API loads
      const interval = setInterval(() => {
        if (checkApi()) clearInterval(interval);
      }, 500);
      return () => clearInterval(interval);
    }
  }, []);

  const extractVideoId = (url: string) => {
    if (!url) return null;
    console.log("[Classroom] Extracting ID from URL:", url);
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    const id = (match && match[2].length === 11) ? match[2] : (url.length === 11 ? url : null);
    console.log("[Classroom] Extracted ID:", id);
    return id;
  };

  const initPlayer = useCallback((videoId: string) => {
    if (!playerElementRef.current) {
      console.warn("[Classroom] YouTube player element ref not found yet");
      return;
    }

    try {
      // If player already exists, destroy it first
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        console.log("[Classroom] Destroying existing player before re-init");
        playerRef.current.destroy();
        playerRef.current = null;
      }

      console.log("[Classroom] Creating new YT.Player instance for:", videoId);
      new (window as any).YT.Player(playerElementRef.current, {
        height: '100%',
        width: '100%',
        videoId: videoId,
        playerVars: {
          'autoplay': 0,
          'controls': 1,
          'modestbranding': 1,
          'rel': 0,
          'fs': 1,
          'origin': window.location.origin
        },
        events: {
          'onReady': (event: any) => {
            console.log("[Classroom] Player Ready");
            playerRef.current = event.target;
          },
          'onError': (event: any) => {
            console.error("[Classroom] YouTube Player Error:", event.data);
          }
        }
      });
    } catch (err) {
      console.error("[Classroom] Error initializing YouTube player:", err);
    }
  }, []);

  const onPlayerElementRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      console.log("[Classroom] Player element ref mounted");
      playerElementRef.current = node;
      const videoId = currentLesson ? extractVideoId(currentLesson.youtubeUrl) : null;
      if (videoId && isApiReady) {
        initPlayer(videoId);
      }
    } else {
      console.log("[Classroom] Player element ref unmounted");
      playerElementRef.current = null;
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    }
  }, [currentLesson, isApiReady, initPlayer]);

  useEffect(() => {
    if (currentLesson) {
      console.log("[Classroom] Current Lesson Loaded:", currentLesson.title, "URL:", currentLesson.youtubeUrl);
    }
    if (currentLesson && isApiReady) {
      const videoId = extractVideoId(currentLesson.youtubeUrl);
      if (videoId) {
        if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
          try {
            console.log("[Classroom] Loading video by ID:", videoId);
            playerRef.current.loadVideoById(videoId);
          } catch (e) {
            console.error("[Classroom] Failed to load video by ID, re-initializing player", e);
            initPlayer(videoId);
          }
        } else {
          // If player doesn't exist, the callback ref will handle initialization
          console.log("[Classroom] Player not ready, waiting for ref or callback...");
        }
      } else {
        console.warn("[Classroom] No valid video ID found for URL:", currentLesson.youtubeUrl);
      }
    }
  }, [currentLesson, isApiReady, initPlayer]);

  const renderVideoPlayer = useMemo(() => {
    const videoId = currentLesson ? extractVideoId(currentLesson.youtubeUrl) : null;
    
    // Do not render player until videoId is available
    if (!videoId) {
      return (
        <div className="aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl border border-theme-border group relative flex items-center justify-center">
          <Play size={64} className="text-theme-text/10" />
        </div>
      );
    }

    return (
      <div className="aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl border border-theme-border group relative">
        <div key={currentLesson?._id} className="w-full h-full">
          <div ref={onPlayerElementRef} className="w-full h-full" />
        </div>
      </div>
    );
  }, [currentLesson, isApiReady, onPlayerElementRef]);

  // Video Progress Tracking
  useEffect(() => {
    let interval: any;
    if (playerRef.current && currentLesson && user && courseId) {
      interval = setInterval(async () => {
        try {
          if (typeof playerRef.current.getCurrentTime !== 'function') return;
          const currentTime = playerRef.current.getCurrentTime();
          const duration = playerRef.current.getDuration();
          if (duration > 0) {
            const percentage = (currentTime / duration) * 100;
            
            await apiFetch(`/api/progress/${user.uid}/${courseId}/video/${currentLesson._id}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                watchedTime: currentTime,
                totalDuration: duration,
                percentage,
                enrollmentSource: source
              })
            });
          }
        } catch (err) {
          // Silent error for background progress saving
        }
      }, 15000); // Every 15 seconds
    }
    return () => clearInterval(interval);
  }, [playerRef.current, currentLesson, user, courseId, source]);

  // AI Action Listener
  useEffect(() => {
    if (!lastAction) return;

    console.log("[Classroom] AI Action received:", lastAction);

    switch (lastAction.type) {
      case "PLAY_VIDEO":
        if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
          playerRef.current.playVideo();
        } else {
          console.warn("[Classroom] Attempted to play video before player was ready.");
        }
        break;
      case "PAUSE_VIDEO":
        if (playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
          playerRef.current.pauseVideo();
        } else {
          console.warn("[Classroom] Attempted to pause video before player was ready.");
        }
        break;
      case "SEEK_VIDEO":
        if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
          playerRef.current.seekTo(lastAction.payload.seconds, true);
        } else {
          console.warn("[Classroom] Attempted to seek video before player was ready.");
        }
        break;
      case "NEXT_LESSON":
        handleNextLesson();
        break;
      case "PREVIOUS_LESSON":
        handlePreviousLesson();
        break;
    }
  }, [lastAction]);

  const handleNextLesson = () => {
    if (!currentLesson || lessons.length === 0) return;
    const currentIndex = lessons.findIndex(l => l._id === currentLesson._id);
    if (currentIndex < lessons.length - 1) {
      setCurrentLesson(lessons[currentIndex + 1]);
    }
  };

  const handlePreviousLesson = () => {
    if (!currentLesson || lessons.length === 0) return;
    const currentIndex = lessons.findIndex(l => l._id === currentLesson._id);
    if (currentIndex > 0) {
      setCurrentLesson(lessons[currentIndex - 1]);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (playerRef.current && playerRef.current.getCurrentTime) {
        const time = playerRef.current.getCurrentTime();
        setContext((prev: any) => ({ ...prev, videoTimestamp: time }));
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [setContext]);

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
  }, [courseId, user, source]);

  const fetchMyCourses = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const res = await apiFetch(`/api/progress/${user.uid}`);
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
        apiFetch(`/api/courses/${courseId}`),
        apiFetch(`/api/courses/${courseId}/lessons`)
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
        const progressRes = await apiFetch(`/api/progress/${user.uid}`);
        if (progressRes.ok) {
          const allProgress = await progressRes.json();
          let currentProgress = allProgress.find((p: any) => 
            p.courseId?._id === courseId && (p.enrollmentSource || 'personal') === source
          );

          // If not found with current source, but user is enrolled in this course with another source
          if (!currentProgress) {
            const anyProgress = allProgress.find((p: any) => p.courseId?._id === courseId);
            if (anyProgress) {
              console.log(`[Classroom] Enrollment found with different source: ${anyProgress.enrollmentSource}. Redirecting...`);
              navigate(`/classroom/${courseId}?source=${anyProgress.enrollmentSource || 'personal'}`, { replace: true });
              return; // The effect will re-run with the new source
            }
          }
          
          // If still not found, and it's a personal course, auto-enroll
          if (!currentProgress && source === 'personal') {
            console.log(`[Classroom] No enrollment found for personal course. Enrolling...`);
            const enrollRes = await apiFetch("/api/enroll", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId: user.uid, courseId, enrollmentSource: 'personal' }),
            });
            if (enrollRes.ok) {
              currentProgress = await enrollRes.json();
              // Refresh my courses list
              fetchMyCourses();
            }
          }

          setUserProgress(currentProgress ? { ...currentProgress, courseId: courseData } : null);
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
      console.log(`[Classroom] Marking lesson ${currentLesson._id} complete for user ${user.uid}, course ${courseId}, source ${source}`);
      const res = await apiFetch(`/api/progress/${user.uid}/${courseId}/lesson/${currentLesson._id}?enrollmentSource=${source}`, {
        method: 'POST'
      });
      if (res.ok) {
        const updatedProgress = await res.json();
        console.log("[Classroom] Lesson completion successful, updated progress:", updatedProgress);
        // Ensure courseId is populated in the state
        setUserProgress({ ...updatedProgress, courseId: course });
      } else {
        const errorData = await res.json();
        console.error("[Classroom] Lesson completion failed:", errorData);
        alert(errorData.error || "Failed to mark lesson as complete. Please check your enrollment.");
      }
    } catch (err) {
      console.error("[Classroom] Lesson completion error:", err);
    }
  };

  const generateQuiz = async (type: "lesson" | "final") => {
    if (!user || !course || (type === "lesson" && !currentLesson)) return;
    
    setIsGeneratingQuiz(true);
    setQuizType(type);
    setIsQuizOpen(true);
    setQuizResults(null);
    setQuizQuestions([]);
    setCurrentQuestionIndex(0);
    setUserAnswers([]);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const model = ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{
          role: "user",
          parts: [{
            text: type === "lesson" 
              ? `Generate a 10-question multiple-choice quiz based on the following lesson summary: "${currentLesson?.summary}". 
                 Each question must have 4 options, one correct answer, and a brief explanation. 
                 Return the response as a JSON array of objects with the following structure: 
                 { "question": "string", "options": ["string", "string", "string", "string"], "correctAnswer": "string", "explanation": "string" }`
              : `Generate a 50-question multiple-choice final exam for the course: "${course.title}". 
                 The exam should cover various topics related to the course. 
                 Each question must have 4 options, one correct answer, and a brief explanation. 
                 Return the response as a JSON array of objects with the following structure: 
                 { "question": "string", "options": ["string", "string", "string", "string"], "correctAnswer": "string", "explanation": "string" }`
          }]
        }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctAnswer: { type: Type.STRING },
                explanation: { type: Type.STRING }
              },
              required: ["question", "options", "correctAnswer", "explanation"]
            }
          }
        }
      });

      const result = await model;
      if (!result.text) {
        throw new Error("Empty response from AI model");
      }
      const questions = JSON.parse(result.text);
      setQuizQuestions(questions);
      setQuizStartTime(Date.now());
      setTimeLeft(20);
    } catch (err: any) {
      console.error("Quiz generation error:", err);
      let errorMessage = "Failed to generate quiz. Please try again.";
      
      if (err.message?.includes("404") || err.message?.includes("NOT_FOUND")) {
        errorMessage = "AI Model not found. Please check configuration.";
      } else if (err.message?.includes("API_KEY")) {
        errorMessage = "Invalid API Key. Please check your settings.";
      } else if (err instanceof SyntaxError) {
        errorMessage = "Quiz generation failed due to invalid AI response format.";
      }
      
      alert(errorMessage);
      setIsQuizOpen(false);
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const handleViewResult = (type: "lesson" | "final") => {
    if (!userProgress) return;
    
    let storedResult = null;
    if (type === "lesson") {
      const quiz = userProgress.lessonQuizzes?.find((q: any) => q.lessonId === currentLesson?._id);
      if (quiz) {
        storedResult = {
          score: quiz.score,
          totalQuestions: quiz.totalQuestions,
          timeTaken: quiz.timeTaken,
          attempts: quiz.attempts,
          answers: quiz.answers,
          feedback: quiz.feedback
        };
      }
    } else {
      const test = userProgress.finalTest;
      if (test && test.completed) {
        storedResult = {
          score: test.score,
          totalQuestions: test.totalQuestions,
          timeTaken: test.timeTaken,
          attempts: test.attempts,
          answers: test.answers,
          feedback: test.feedback
        };
      }
    }

    if (storedResult) {
      setQuizType(type);
      setQuizResults(storedResult);
      setIsQuizOpen(true);
      setIsGeneratingQuiz(false);
    }
  };
  const handleAnswerSelect = (answer: string) => {
    const newAnswers = [...userAnswers];
    newAnswers[currentQuestionIndex] = answer;
    setUserAnswers(newAnswers);
    
    if (currentQuestionIndex < quizQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setTimeLeft(20);
    } else {
      submitQuiz(newAnswers);
    }
  };

  const submitQuiz = async (finalAnswers: string[]) => {
    if (!user || !courseId) return;
    setIsSubmittingQuiz(true);
    
    const timeTaken = Math.round((Date.now() - quizStartTime) / 1000);
    const results = quizQuestions.map((q, i) => ({
      question: q.question,
      userAnswer: finalAnswers[i] || "Skipped",
      correctAnswer: q.correctAnswer,
      isCorrect: finalAnswers[i] === q.correctAnswer,
      explanation: q.explanation
    }));

    const score = results.filter(r => r.isCorrect).length;

    try {
      // Generate AI Feedback
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const feedbackModel = ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{
          role: "user",
          parts: [{
            text: `Analyze the following quiz results and provide feedback on strengths, weaknesses, and suggestions for improvement. 
                   Score: ${score}/${quizQuestions.length}. 
                   Results: ${JSON.stringify(results.map(r => ({ q: r.question, correct: r.isCorrect })))}
                   Return as JSON: { "strengths": ["string"], "weaknesses": ["string"], "suggestions": ["string"] }`
          }]
        }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
              weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
              suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["strengths", "weaknesses", "suggestions"]
          }
        }
      });

      const feedbackResult = await feedbackModel;
      const feedback = JSON.parse(feedbackResult.text);

      const quizResult: QuizResult = {
        score,
        totalQuestions: quizQuestions.length,
        timeTaken,
        answers: results,
        feedback
      };

      setQuizResults(quizResult);

      // Save to backend
      const endpoint = quizType === "lesson" 
        ? `/api/progress/${user.uid}/${courseId}/quiz/${currentLesson?._id}`
        : `/api/progress/${user.uid}/${courseId}/final-test`;

      console.log(`Submitting quiz to ${endpoint} with source: ${source}`);
      const res = await apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score,
          totalQuestions: quizQuestions.length,
          timeTaken,
          answers: results,
          feedback,
          enrollmentSource: source
        })
      });

      if (res.ok) {
        const updatedProgress = await res.json();
        console.log("Quiz submission successful, updated progress:", updatedProgress);
        const updatedQuiz = quizType === "lesson" 
          ? updatedProgress.lessonQuizzes?.find((q: any) => q.lessonId === currentLesson?._id)
          : updatedProgress.finalTest;

        const finalResult: QuizResult = {
          ...quizResult,
          attempts: updatedQuiz?.attempts
        };
        
        setQuizResults(finalResult);
        setUserProgress({ ...updatedProgress, courseId: course });
      } else {
        const errorData = await res.json();
        console.error("Quiz submission failed:", errorData);
        alert(errorData.error || "Failed to save quiz result. Please check your enrollment.");
      }

    } catch (err) {
      console.error("Quiz submission error:", err);
    } finally {
      setIsSubmittingQuiz(false);
    }
  };

  useEffect(() => {
    let timer: any;
    if (isQuizOpen && !isGeneratingQuiz && !quizResults && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            // Auto skip to next question
            if (currentQuestionIndex < quizQuestions.length - 1) {
              const newAnswers = [...userAnswers];
              newAnswers[currentQuestionIndex] = "Skipped";
              setUserAnswers(newAnswers);
              setCurrentQuestionIndex(prevIdx => prevIdx + 1);
              return 20;
            } else {
              const newAnswers = [...userAnswers];
              newAnswers[currentQuestionIndex] = "Skipped";
              setUserAnswers(newAnswers);
              submitQuiz(newAnswers);
              return 0;
            }
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isQuizOpen, isGeneratingQuiz, quizResults, timeLeft, currentQuestionIndex, quizQuestions.length, userAnswers]);

  const handleMarkCourseComplete = async () => {
    if (!user || !courseId || !userProgress) return;
    
    const allLessonsCompleted = lessons.every(l => userProgress.completedLessons?.includes(l._id));
    const finalTestCompleted = userProgress.finalTest?.completed;

    if (!allLessonsCompleted) {
      alert("Please complete all lessons before finishing the course.");
      return;
    }

    if (!finalTestCompleted) {
      alert("Please complete the final test before finishing the course.");
      return;
    }

    setIsRatingModalOpen(true);
  };

  const handleSubmitRating = async () => {
    if (!user || !courseId) return;
    setIsSubmittingRating(true);
    try {
      console.log(`[Classroom] Finalizing course ${courseId} for user ${user.uid}, source ${source}`);
      const res = await apiFetch(`/api/progress/${user.uid}/${courseId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, enrollmentSource: source })
      });
      if (res.ok) {
        const updatedProgress = await res.json();
        console.log("[Classroom] Course completion successful, updated progress:", updatedProgress);
        setUserProgress({ ...updatedProgress, courseId: course });
        setIsRatingModalOpen(false);
      } else {
        const errorData = await res.json();
        console.error("[Classroom] Course completion failed:", errorData);
        alert(errorData.error || "Failed to complete course. Please check your enrollment.");
      }
    } catch (err) {
      console.error("[Classroom] Course completion error:", err);
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
        <div className="h-full flex flex-col bg-theme-bg p-6 lg:p-10">
          <header className="mb-10">
            <h1 className="text-3xl font-bold tracking-tight mb-2 text-theme-text">
              Welcome back, {user?.displayName?.split(' ')[0]}!
            </h1>
            <p className="text-theme-text-muted">Select a course to continue your learning journey.</p>
          </header>

          {user?.loginType === 'institutional' && (
            <div className="flex gap-1 p-1 bg-theme-text/5 rounded-2xl w-fit mb-8">
              <button
                onClick={() => setClassroomTab("personal")}
                className={cn(
                  "px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
                  classroomTab === "personal" ? "bg-theme-card text-theme-text shadow-lg" : "text-theme-text-muted hover:text-theme-text"
                )}
              >
                Personal Courses
              </button>
              <button
                onClick={() => setClassroomTab("institution")}
                className={cn(
                  "px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
                  classroomTab === "institution" ? "bg-theme-card text-theme-text shadow-lg" : "text-theme-text-muted hover:text-theme-text"
                )}
              >
                Institution Courses
              </button>
            </div>
          )}

          {myCourses.filter(p => {
            if (user?.loginType !== 'institutional') return true;
            const source = p.enrollmentSource || 'personal';
            return source === classroomTab;
          }).length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {myCourses.filter(p => {
                if (user?.loginType !== 'institutional') return true;
                const source = p.enrollmentSource || 'personal';
                return source === classroomTab;
              }).map((progress) => (
                <motion.div
                  key={progress._id}
                  whileHover={{ y: -5 }}
                  onClick={() => navigate(`/classroom/${progress.courseId?._id}?source=${progress.enrollmentSource || 'personal'}`)}
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
                        <span className="text-theme-accent">{Math.round(((progress.completedLessons?.length || 0) / (progress.totalLessons || 1)) * 100)}%</span>
                      </div>
                      <div className="h-1.5 bg-theme-text/5 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${((progress.completedLessons?.length || 0) / (progress.totalLessons || 1)) * 100}%` }}
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
              <div className="w-20 h-20 bg-theme-text/5 rounded-full flex items-center justify-center">
                <BookOpen size={40} className="text-theme-text/20" />
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-theme-text">No courses enrolled yet</h2>
                <p className="text-theme-text-muted">Head over to LearnTube to find your first course!</p>
              </div>
              <button 
                onClick={() => navigate("/learntube")}
                className={cn(
                  "px-6 py-2 font-bold rounded-xl transition-colors",
                  theme === 'light' ? "bg-indigo-600 text-white hover:bg-indigo-500" : "bg-emerald-500 text-black hover:bg-emerald-400"
                )}
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
            
            {lessons.length > 0 && userProgress?.completedLessons?.length === lessons.length ? (
              <div className="space-y-2">
                {userProgress?.finalTest?.completed && (
                  <button 
                    onClick={() => handleViewResult("final")}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold bg-theme-text/5 text-theme-text hover:bg-theme-text/10 transition-all border border-theme-border"
                  >
                    <FileText size={14} />
                    View Final Test Result
                  </button>
                )}
                <button
                  onClick={() => generateQuiz("final")}
                  disabled={userProgress?.isCompleted || userProgress?.finalTest?.completed}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all",
                    userProgress?.isCompleted || userProgress?.finalTest?.completed
                      ? "bg-emerald-500/10 text-emerald-500 cursor-default"
                      : "bg-theme-accent text-white hover:opacity-90"
                  )}
                >
                  <Trophy size={18} />
                  {userProgress?.isCompleted || userProgress?.finalTest?.completed ? "Course Completed" : "Take Final Test"}
                </button>
              </div>
            ) : (
              <button
                disabled
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-theme-text/5 text-theme-text/20 cursor-not-allowed"
              >
                <CheckCircle2 size={18} />
                Complete all lessons to finish
              </button>
            )}

            {userProgress?.finalTest?.completed && !userProgress?.isCompleted && (
              <button
                onClick={() => setIsRatingModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-emerald-500 text-white hover:bg-emerald-600 transition-all"
              >
                <CheckCircle2 size={18} />
                Finalize Course Completion
              </button>
            )}
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
            {currentLesson && (
              <div className="flex items-center gap-2">
                {userProgress?.lessonQuizzes?.find((q: any) => q.lessonId === currentLesson._id)?.completed ? (
                  <button 
                    onClick={() => handleViewResult("lesson")}
                    className="flex items-center gap-2 px-3 lg:px-4 py-2 bg-theme-text/5 hover:bg-theme-text/10 rounded-xl text-sm font-bold transition-all text-theme-text"
                  >
                    <FileText size={16} />
                    <span className="hidden sm:inline">View Result</span>
                  </button>
                ) : (
                  <button
                    onClick={() => generateQuiz("lesson")}
                    className="flex items-center gap-2 px-3 lg:px-4 py-2 bg-theme-accent/10 text-theme-accent hover:bg-theme-accent/20 rounded-xl text-sm font-bold transition-all"
                  >
                    <BrainCircuit size={16} />
                    <span className="hidden sm:inline">Take Lesson Quiz</span>
                  </button>
                )}
              </div>
            )}
            <button
              onClick={handleMarkLessonComplete}
              disabled={userProgress?.completedLessons?.includes(currentLesson?._id) || !userProgress?.lessonQuizzes?.find((q: any) => q.lessonId === currentLesson?._id)?.completed}
              className={cn(
                "flex items-center gap-2 px-3 lg:px-4 py-2 rounded-xl text-sm font-bold transition-all",
                userProgress?.completedLessons?.includes(currentLesson?._id)
                  ? "bg-emerald-500/10 text-emerald-500 cursor-default"
                  : !userProgress?.lessonQuizzes?.find((q: any) => q.lessonId === currentLesson?._id)?.completed
                    ? "bg-theme-text/5 text-theme-text/20 cursor-not-allowed"
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
            {renderVideoPlayer}

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
                      className={cn(
                        "prose max-w-none",
                        theme === 'dark' ? "prose-invert" : "prose-slate"
                      )}
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

      {/* Quiz Modal */}
      <AnimatePresence>
        {isQuizOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-6xl bg-theme-card border border-theme-border rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {isGeneratingQuiz || isSubmittingQuiz ? (
                <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-6">
                  <div className="relative">
                    <div className="w-20 h-20 border-4 border-theme-accent/20 border-t-theme-accent rounded-full animate-spin" />
                    {isSubmittingQuiz ? (
                      <Sparkles className="absolute inset-0 m-auto text-theme-accent animate-pulse" size={32} />
                    ) : (
                      <BrainCircuit className="absolute inset-0 m-auto text-theme-accent animate-pulse" size={32} />
                    )}
                  </div>
                  <div className="text-center space-y-2">
                    <h3 className="text-2xl font-bold">
                      {isSubmittingQuiz ? "Generating Your Results" : `Generating Your ${quizType === "lesson" ? "Lesson Quiz" : "Final Exam"}`}
                    </h3>
                    <p className="text-theme-text-muted">
                      {isSubmittingQuiz ? "Nova is analyzing your performance and providing personalized feedback..." : "Nova is analyzing the content to create a personalized assessment..."}
                    </p>
                  </div>
                </div>
              ) : quizResults ? (
                <div className="flex-1 overflow-y-auto p-8 space-y-8">
                  {/* Results Header */}
                  <div className="flex flex-col md:flex-row items-center justify-between gap-8 p-8 bg-theme-text/5 rounded-[32px]">
                    <div className="flex items-center gap-6">
                      <div className="w-24 h-24 rounded-full border-8 border-theme-accent flex items-center justify-center bg-theme-accent/10">
                        <span className="text-3xl font-black">{Math.round((quizResults.score / quizResults.totalQuestions) * 100)}%</span>
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-2xl font-bold">Assessment Complete!</h3>
                        <div className="flex items-center gap-3 text-theme-text-muted">
                          <p>
                            You scored {quizResults.score} out of {quizResults.totalQuestions} in {quizResults.timeTaken}s
                          </p>
                          {quizResults.attempts && (
                            <>
                              <div className="w-1 h-1 rounded-full bg-theme-text/20" />
                              <p className="flex items-center gap-1">
                                <RotateCcw size={12} />
                                Attempt {quizResults.attempts}
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <button 
                        onClick={() => generateQuiz(quizType)}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold bg-theme-text/5 hover:bg-theme-text/10 transition-all"
                      >
                        <RotateCcw size={18} />
                        Retake Test
                      </button>
                      <button 
                        onClick={async () => {
                          if (quizType === "final") {
                            await handleMarkCourseComplete();
                          }
                          setIsQuizOpen(false);
                        }}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold bg-theme-accent text-white hover:opacity-90 transition-all shadow-lg shadow-theme-accent/20"
                      >
                        <Check size={18} />
                        Complete Test
                      </button>
                    </div>
                  </div>

                  {/* AI Feedback */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-6 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl space-y-4">
                      <div className="flex items-center gap-2 text-emerald-500">
                        <Trophy size={20} />
                        <h4 className="font-bold uppercase tracking-widest text-xs">Strengths</h4>
                      </div>
                      <ul className="space-y-2">
                        {quizResults.feedback.strengths.map((s, i) => (
                          <li key={i} className="text-sm text-theme-text/60 flex gap-2">
                            <span className="text-emerald-500">•</span> {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="p-6 bg-amber-500/5 border border-amber-500/10 rounded-2xl space-y-4">
                      <div className="flex items-center gap-2 text-amber-500">
                        <AlertCircle size={20} />
                        <h4 className="font-bold uppercase tracking-widest text-xs">Weaknesses</h4>
                      </div>
                      <ul className="space-y-2">
                        {quizResults.feedback.weaknesses.map((w, i) => (
                          <li key={i} className="text-sm text-theme-text/60 flex gap-2">
                            <span className="text-amber-500">•</span> {w}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="p-6 bg-blue-500/5 border border-blue-500/10 rounded-2xl space-y-4">
                      <div className="flex items-center gap-2 text-blue-400">
                        <Sparkles size={20} />
                        <h4 className="font-bold uppercase tracking-widest text-xs">Suggestions</h4>
                      </div>
                      <ul className="space-y-2">
                        {quizResults.feedback.suggestions.map((s, i) => (
                          <li key={i} className="text-sm text-theme-text/60 flex gap-2">
                            <span className="text-blue-400">•</span> {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Detailed Answers */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h4 className="text-lg font-bold">Detailed Review</h4>
                      <div className="flex gap-4 text-[10px] font-black uppercase tracking-widest">
                        <div className="flex items-center gap-1.5 text-emerald-500">
                          <div className="w-2 h-2 rounded-full bg-current" />
                          Correct
                        </div>
                        <div className="flex items-center gap-1.5 text-red-500">
                          <div className="w-2 h-2 rounded-full bg-current" />
                          Incorrect
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-6">
                      {quizResults.answers.map((answer, i) => (
                        <div key={i} className={cn(
                          "p-8 rounded-[24px] border transition-all shadow-sm",
                          answer.isCorrect ? "bg-emerald-500/5 border-emerald-500/10" : "bg-red-500/5 border-red-500/10"
                        )}>
                          <div className="flex items-start justify-between gap-6 mb-6">
                            <div className="space-y-1">
                              <p className="text-[10px] font-black uppercase tracking-widest text-theme-text/20">Question {i+1}</p>
                              <p className="text-lg font-bold text-theme-text leading-tight">{answer.question}</p>
                            </div>
                            {answer.isCorrect ? (
                              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
                                <CheckCircle2 size={24} />
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 shrink-0">
                                <AlertCircle size={24} />
                              </div>
                            )}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-theme-text/5 rounded-2xl mb-6">
                            <div className="space-y-2">
                              <p className="text-theme-text-muted uppercase tracking-widest text-[10px] font-black">Your Answer</p>
                              <p className={cn("font-bold text-base", answer.isCorrect ? "text-emerald-500" : "text-red-500")}>{answer.userAnswer}</p>
                            </div>
                            <div className="space-y-2">
                              <p className="text-theme-text-muted uppercase tracking-widest text-[10px] font-black">Correct Answer</p>
                              <p className="text-emerald-500 font-bold text-base">{answer.correctAnswer}</p>
                            </div>
                          </div>
                          <div className="flex gap-4 p-4 bg-theme-text/5 rounded-xl">
                            <div className="w-8 h-8 rounded-lg bg-theme-text/5 flex items-center justify-center text-theme-text/40 shrink-0">
                              <Info size={16} />
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] font-black uppercase tracking-widest text-theme-text/40">Explanation</p>
                              <p className="text-sm text-theme-text/60 italic leading-relaxed">{answer.explanation}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Quiz Header */}
                  <div className="p-6 border-b border-theme-border flex items-center justify-between bg-theme-text/5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-theme-accent/10 flex items-center justify-center text-theme-accent">
                        <BrainCircuit size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold">{quizType === "lesson" ? "Lesson Quiz" : "Final Course Exam"}</h3>
                        <p className="text-[10px] text-theme-text-muted uppercase tracking-widest font-black">
                          Question {currentQuestionIndex + 1} of {quizQuestions.length}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2 px-4 py-2 bg-theme-card rounded-xl border border-theme-border">
                        <Timer size={16} className={cn(timeLeft < 5 ? "text-red-500 animate-pulse" : "text-theme-text-muted")} />
                        <span className={cn("font-mono font-bold", timeLeft < 5 ? "text-red-500" : "text-theme-text")}>
                          00:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}
                        </span>
                      </div>
                      <button 
                        onClick={() => setIsQuizOpen(false)}
                        className="p-2 hover:bg-theme-text/5 rounded-lg text-theme-text-muted hover:text-theme-text transition-colors"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="h-1 bg-theme-text/5">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${((currentQuestionIndex + 1) / quizQuestions.length) * 100}%` }}
                      className="h-full bg-theme-accent"
                    />
                  </div>

                  {/* Question Content */}
                  <div className="flex-1 overflow-y-auto p-8 lg:p-12">
                    <div className="max-w-2xl mx-auto space-y-12">
                      <motion.div
                        key={currentQuestionIndex}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="space-y-8"
                      >
                        <h2 className="text-2xl lg:text-3xl font-bold text-center leading-tight">
                          {quizQuestions[currentQuestionIndex]?.question}
                        </h2>

                        <div className="grid grid-cols-1 gap-4">
                          {quizQuestions[currentQuestionIndex]?.options.map((option, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleAnswerSelect(option)}
                              className="group relative flex items-center p-6 bg-theme-text/5 border border-theme-border rounded-2xl hover:border-theme-accent hover:bg-theme-accent/5 transition-all text-left"
                            >
                              <div className="w-8 h-8 rounded-lg bg-theme-card border border-theme-border flex items-center justify-center text-xs font-bold group-hover:bg-theme-accent group-hover:text-white group-hover:border-theme-accent transition-all mr-4">
                                {String.fromCharCode(65 + idx)}
                              </div>
                              <span className="text-lg font-medium">{option}</span>
                              <div className="absolute right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                                <ArrowRight size={20} className="text-theme-accent" />
                              </div>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    </div>
                  </div>

                  {/* Quiz Footer */}
                  <div className="p-6 border-t border-theme-border flex items-center justify-between bg-theme-text/5">
                    <p className="text-xs text-theme-text-muted flex items-center gap-2">
                      <AlertCircle size={14} />
                      No backward navigation allowed. Skipping a question counts as incorrect.
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-theme-text/20">Powered by Nova AI</span>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
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
