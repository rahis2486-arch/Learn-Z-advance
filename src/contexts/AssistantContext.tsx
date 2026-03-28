import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from "@google/genai";
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { 
  generateEmbedding, 
  storeMemory, 
  searchMemory, 
  generateSpeech, 
  ChatMessage, 
  extractDualMemories, 
  getVerbalThinking, 
  storeMemoryTool, 
  searchMemoryTool,
  navigateToPageTool,
  getDashboardStatsTool,
  getUserProgressTool,
  getLearningProfileTool,
  openCourseTool,
  openLessonTool,
  goToNextLessonTool,
  goToPreviousLessonTool,
  searchCoursesTool,
  recommendCoursesTool,
  checkEnrollmentTool,
  enrollCourseTool,
  playVideoTool,
  pauseVideoTool,
  getVideoTimestampTool,
  seekVideoTool,
  getDashboardStats,
  getUserProgress,
  getLongTermSummary,
  updateLongTermSummary,
  generateNewSummary,
  getChatHistory,
  storeChatMessage,
  clearChatHistory,
  getLearningProfile,
  updateLearningInsights,
  searchCourses,
  recommendCourses,
  checkEnrollment,
  enrollCourse
} from "../services/geminiService";

interface AssistantContextType {
  isLive: boolean;
  isCameraOn: boolean;
  isMicOn: boolean;
  isSpeaking: boolean;
  isThinking: boolean;
  isProcessing: boolean;
  isConnecting: boolean;
  isMemoryAction: boolean;
  userVolume: number;
  aiVolume: number;
  longTermSummary: string;
  courseSummary: string;
  learningProfile: any;
  isSidebarOpen: boolean;
  messages: ChatMessage[];
  lastAction: { type: string; payload: any } | null;
  courseId: string | null;
  context: any;
  mathContext: any;
  location: string;
  theme: 'dark' | 'light';
  facingMode: 'user' | 'environment';
  stream: MediaStream | null;
  
  dispatchAction: (type: string, payload: any) => void;
  setContext: (ctx: any) => void;
  setMathContext: (ctx: any) => void;
  setLocation: (loc: string) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  toggleSidebar: () => void;
  toggleCamera: () => Promise<void>;
  switchCamera: () => Promise<void>;
  toggleMic: () => void;
  startLiveSession: () => Promise<void>;
  cleanupSession: () => Promise<void>;
  setSidebarOpen: (open: boolean) => void;
}

const AssistantContext = createContext<AssistantContextType | undefined>(undefined);

export const AssistantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLive, setIsLive] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMemoryAction, setIsMemoryAction] = useState(false);
  const [isInterruptMode, setIsInterruptMode] = useState(true);
  const [lastAction, setLastAction] = useState<{ type: string; payload: any } | null>(null);

  const dispatchAction = (type: string, payload: any) => {
    setLastAction({ type, payload });
    // Reset after a short delay so the same action can be triggered again
    setTimeout(() => setLastAction(null), 100);
  };

  const [userVolume, setUserVolume] = useState(0);
  const [aiVolume, setAiVolume] = useState(0);
  const [longTermSummary, setLongTermSummary] = useState("");
  const [courseSummary, setCourseSummary] = useState("");
  const [learningProfile, setLearningProfile] = useState<any>(null);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [context, setContext] = useState<any>(null);
  const [mathContext, setMathContext] = useState<any>(null);
  const [location, setLocation] = useState<string>("/");

  // Extract courseId from location
  useEffect(() => {
    const pathParts = window.location.pathname.split('/');
    const classroomIdx = pathParts.indexOf('classroom');
    if (classroomIdx !== -1 && pathParts[classroomIdx + 1]) {
      setCourseId(pathParts[classroomIdx + 1]);
    } else {
      setCourseId(null);
    }
  }, [window.location.pathname]);

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [theme, setThemeState] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('learn-z-theme') as any) || 'dark';
  });

  const setTheme = (newTheme: 'dark' | 'light') => {
    setThemeState(newTheme);
    localStorage.setItem('learn-z-theme', newTheme);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const isLiveRef = useRef(false);
  const isMicOnRef = useRef(false);
  const hiddenVideoRef = useRef<HTMLVideoElement | null>(null);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const visionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pcmPlayerRef = useRef<{
    ctx: AudioContext;
    nextTime: number;
    activeSources: Set<AudioBufferSourceNode>;
  } | null>(null);
  const sessionMessagesRef = useRef<ChatMessage[]>([]);
  const sessionRetrievalFactsRef = useRef<string[]>([]);
  const sessionLongTermFactsRef = useRef<string[]>([]);
  const memorySoundRef = useRef<HTMLAudioElement | null>(null);
  const lastRecognizedRef = useRef<{ id: string, time: number } | null>(null);

  useEffect(() => { isLiveRef.current = isLive; }, [isLive]);
  useEffect(() => { isMicOnRef.current = isMicOn; }, [isMicOn]);

  useEffect(() => {
    const init = async () => {
      if (!user?.uid) {
        setLongTermSummary("");
        setCourseSummary("");
        setLearningProfile(null);
        setMessages([]);
        return;
      }
      
      try {
        const [summary, cSummary, profile, history] = await Promise.all([
          getLongTermSummary(user.uid),
          courseId ? getLongTermSummary(user.uid, courseId) : Promise.resolve(""),
          getLearningProfile(user.uid),
          getChatHistory(user.uid, courseId || undefined)
        ]);
        
        setLongTermSummary(summary);
        setCourseSummary(cSummary);
        setLearningProfile(profile);
        // Convert history from DB format if needed
        setMessages(history.map((h: any) => ({
          role: h.role,
          content: h.content,
          timestamp: new Date(h.timestamp).getTime()
        })));
      } catch (err) {
        console.error("Failed to initialize assistant context:", err);
      }
      
      if (!memorySoundRef.current) {
        memorySoundRef.current = new Audio("https://cdn.pixabay.com/audio/2022/03/10/audio_c3508e3d05.mp3");
        memorySoundRef.current.volume = 0.3;
      }
    };
    init();
  }, [user?.uid, courseId]);

  // AI Volume simulation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isSpeaking) {
      interval = setInterval(() => {
        setAiVolume(0.2 + Math.random() * 0.8);
      }, 50);
    } else {
      setAiVolume(0);
    }
    return () => clearInterval(interval);
  }, [isSpeaking]);

  useEffect(() => {
    if (isSpeaking && isInterruptMode && location.includes("/classroom")) {
      dispatchAction("PAUSE_VIDEO", { auto: true });
    }
  }, [isSpeaking, isInterruptMode, location]);

  useEffect(() => {
    if (!isSpeaking) {
      // Reset to interrupt mode after a short delay if Nova is silent
      // This ensures that the next interaction (e.g. a question) will pause the video
      const timer = setTimeout(() => {
        setIsInterruptMode(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isSpeaking]);

  const playMemorySound = useCallback(() => {
    if (memorySoundRef.current) {
      memorySoundRef.current.currentTime = 0;
      memorySoundRef.current.play().catch(e => console.log("Audio play blocked"));
    }
  }, []);

  const triggerMemoryEffect = useCallback(() => {
    setIsMemoryAction(true);
    playMemorySound();
    setTimeout(() => setIsMemoryAction(false), 1500);
  }, [playMemorySound]);

  const toggleCamera = async () => {
    if (isCameraOn) {
      stream?.getTracks().forEach(track => track.stop());
      setStream(null);
      setIsCameraOn(false);
    } else {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode } 
        });
        setStream(newStream);
        if (!hiddenVideoRef.current) {
          hiddenVideoRef.current = document.createElement('video');
          hiddenVideoRef.current.muted = true;
          hiddenVideoRef.current.playsInline = true;
        }
        hiddenVideoRef.current.srcObject = newStream;
        hiddenVideoRef.current.play().catch(() => {});
        setIsCameraOn(true);
      } catch (err) {
        console.error("Camera error:", err);
      }
    }
  };

  const switchCamera = async () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);
    
    if (isCameraOn) {
      stream?.getTracks().forEach(track => track.stop());
      
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: newMode } 
        });
        setStream(newStream);
        if (hiddenVideoRef.current) {
          hiddenVideoRef.current.srcObject = newStream;
          hiddenVideoRef.current.play().catch(() => {});
        }
      } catch (err) {
        console.error("Camera switch error:", err);
      }
    }
  };

  const toggleMic = () => {
    setIsMicOn(!isMicOn);
  };

  const toggleSidebar = () => {
    setSidebarOpen(!isSidebarOpen);
  };

  const playAudio = async (base64: string) => {
    if (!pcmPlayerRef.current) return;
    setIsSpeaking(true);
    const { ctx, activeSources } = pcmPlayerRef.current;
    if (ctx.state === 'suspended') await ctx.resume();
    try {
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      const pcmData = new Int16Array(bytes.buffer);
      const floatData = new Float32Array(pcmData.length);
      for (let i = 0; i < pcmData.length; i++) floatData[i] = pcmData[i] / 32768.0;
      const buffer = ctx.createBuffer(1, floatData.length, 24000);
      buffer.getChannelData(0).set(floatData);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      
      const startTime = Math.max(ctx.currentTime, pcmPlayerRef.current.nextTime);
      source.start(startTime);
      pcmPlayerRef.current.nextTime = startTime + buffer.duration;
      
      activeSources.add(source);
      source.onended = () => {
        activeSources.delete(source);
        if (activeSources.size === 0) setIsSpeaking(false);
      };
    } catch (err) {
      console.error("PCM Playback Error:", err);
    }
  };

  const stopAudioPlayback = () => {
    setIsSpeaking(false);
    if (pcmPlayerRef.current) {
      const { activeSources } = pcmPlayerRef.current;
      activeSources.forEach(source => {
        try {
          source.stop();
          source.disconnect();
        } catch (e) {}
      });
      activeSources.clear();
      pcmPlayerRef.current.nextTime = 0;
    }
  };

  const finalizeSessionSummary = async () => {
    if (!user?.uid) return;
    const allSessionFacts = [...sessionRetrievalFactsRef.current, ...sessionLongTermFactsRef.current];
    if (allSessionFacts.length === 0) return;
    try {
      // Update global summary
      const currentGlobalSummary = await getLongTermSummary(user.uid);
      const newGlobalSummary = await generateNewSummary(allSessionFacts, currentGlobalSummary);
      await updateLongTermSummary(newGlobalSummary, user.uid);
      setLongTermSummary(newGlobalSummary);

      // Update course summary if applicable
      if (courseId) {
        const currentCourseSummary = await getLongTermSummary(user.uid, courseId);
        const newCourseSummary = await generateNewSummary(allSessionFacts, currentCourseSummary);
        await updateLongTermSummary(newCourseSummary, user.uid, courseId);
        setCourseSummary(newCourseSummary);
      }

      // Update Learning Profile Insights
      const profile = await getLearningProfile(user.uid);
      if (profile) {
        const insightsPrompt = `Based on these new session facts: ${allSessionFacts.join(', ')}, and the current AI insights: ${profile.aiInsights}, generate updated learning insights for the student. Focus on their progress, interests, and any new areas of strength or weakness identified.`;
        const newInsights = await updateLearningInsights(user.uid, insightsPrompt);
        // The updateLearningInsights function in geminiService doesn't return the new insights yet, 
        // but we can fetch the profile again or just assume it's updated.
        const updatedProfile = await getLearningProfile(user.uid);
        if (updatedProfile) setLearningProfile(updatedProfile);
      }
    } catch (err) {
      console.error("Failed to finalize summary:", err);
    }
  };

  const cleanupSession = async () => {
    if (visionIntervalRef.current) clearInterval(visionIntervalRef.current);
    stopAudioPlayback();
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {}
      audioContextRef.current = null;
    }
    
    // Don't clear sessionRef.current immediately to allow final messages to process
    setIsLive(false);
    setIsMicOn(false);
    
    if (sessionRef.current) {
      try {
        const session = await sessionRef.current;
        if (session && typeof session.close === 'function') {
          session.close();
        }
      } catch (e) {}
      sessionRef.current = null;
    }
    
    await finalizeSessionSummary();
    
    // We keep messages so the user can see the history
    // sessionMessagesRef.current = []; 
    sessionRetrievalFactsRef.current = [];
    sessionLongTermFactsRef.current = [];
  };

  const startAudioCapture = async (sessionPromise: Promise<any>) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioCtx({ sampleRate: 16000 });
      const sampleRate = audioContextRef.current.sampleRate;
      if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const processor = audioContextRef.current.createScriptProcessor(2048, 1, 1);
      source.connect(processor);
      processor.connect(audioContextRef.current.destination);
      processor.onaudioprocess = (e) => {
        if (!isLiveRef.current || !isMicOnRef.current) {
          setUserVolume(0);
          return;
        }
        const inputData = e.inputBuffer.getChannelData(0);
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) sum += Math.abs(inputData[i]);
        setUserVolume(Math.min(1, (sum / inputData.length) * 5));
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
        const buffer = pcmData.buffer;
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        const base64Data = btoa(binary);
        
        sessionPromise.then((session: any) => {
          if (session && isLiveRef.current) {
            session.sendRealtimeInput({ audio: { data: base64Data, mimeType: `audio/pcm;rate=${sampleRate}` } });
          }
        }).catch(() => {});
      };
    } catch (err) {
      console.error("Audio capture error:", err);
    }
  };

  const startVisionCapture = (sessionPromise: Promise<any>) => {
    if (visionIntervalRef.current) clearInterval(visionIntervalRef.current);
    visionIntervalRef.current = setInterval(async () => {
      if (!isLiveRef.current || !isCameraOn || !hiddenVideoRef.current) return;
      const canvas = document.createElement('canvas');
      const scale = 0.5;
      canvas.width = hiddenVideoRef.current.videoWidth * scale;
      canvas.height = hiddenVideoRef.current.videoHeight * scale;
      const ctx = canvas.getContext('2d');
      if (ctx && canvas.width > 0 && canvas.height > 0) {
        ctx.drawImage(hiddenVideoRef.current, 0, 0, canvas.width, canvas.height);
        const base64Image = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
        try {
          const session = await sessionPromise;
          if (!session || !isLiveRef.current) return;
          
          session.sendRealtimeInput({ video: { data: base64Image, mimeType: 'image/jpeg' } });
        } catch (e) {}
      }
    }, 2000);
  };

  const startLiveSession = async (retryCount = 0) => {
    if (isLive) {
      cleanupSession();
      return;
    }
    if (isConnecting && retryCount === 0) return;
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return;
    
    if (!pcmPlayerRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      pcmPlayerRef.current = { 
        ctx: new AudioCtx({ sampleRate: 24000 }), 
        nextTime: 0,
        activeSources: new Set()
      };
    }
    if (pcmPlayerRef.current.ctx.state === 'suspended') await pcmPlayerRef.current.ctx.resume();
    
    setIsConnecting(true);
    const ai = new GoogleGenAI({ apiKey });
    
    try {
      if (retryCount === 0) triggerMemoryEffect();
      
      const initialEmbedding = await generateEmbedding("User profile, preferences, name, and recent activities");
      const initialMemories = (initialEmbedding && user?.uid) ? await searchMemory(initialEmbedding, 'long-term', user.uid, courseId || undefined) : []; 
      const memoryContext = initialMemories.length > 0 ? "\n\nYOUR LONG-TERM MEMORY ABOUT THE USER:\n" + initialMemories.map(m => m.content).join("\n") : "";
      
      const classroomContext = context 
        ? `CURRENT CLASSROOM CONTEXT:
           - Course: ${context.courseTitle}
           - Lesson: ${context.lessonTitle}
           - Summary: ${context.summary}
           - Transcript: ${context.transcript}`
        : "The student is currently NOT in a classroom. You cannot see any video content or lesson details right now.";

      const mathTutorContext = mathContext
        ? `CURRENT MATH TUTOR CONTEXT:
           - Problem: ${mathContext.title}
           - Current Step: ${mathContext.currentStep || 'Analyzing'}
           - Last Message: ${mathContext.lastMessage || 'None'}
           
           MATH TUTORING RULES:
           - You are assisting the student with a math problem.
           - DO NOT give the answer directly.
           - Guide them ONE STEP AT A TIME.
           - Explain the "why" and "how" behind each step.
           - Wait for the student to acknowledge before moving to the next step.`
        : "The student is currently NOT in the Math Tutor Canvas.";

      const learningProfileContext = learningProfile 
        ? `USER LEARNING PROFILE:
           - Interests: ${learningProfile.interests?.join(', ') || 'None'}
           - Strong Subjects: ${learningProfile.strongSubjects?.join(', ') || 'None'}
           - Weak Subjects: ${learningProfile.weakSubjects?.join(', ') || 'None'}
           - Learning Speed: ${learningProfile.learningSpeed || 'Average'}
           - Weak Topics (Course Specific): ${learningProfile.weakTopics?.map((wt: any) => `${wt.topic} (Course: ${wt.courseId})`).join(', ') || 'None'}
           - AI Insights: ${learningProfile.aiInsights || 'No insights yet.'}`
        : "";

      const courseContext = courseSummary 
        ? `COURSE-SPECIFIC MEMORY:
           - Summary of previous interactions in this course: ${courseSummary}`
        : "";

      const systemInstruction = `You are Nova, a highly intelligent and friendly AI assistant for the "Learn Z" platform, developed by Malang Code Innovators. 
      Your primary role is to assist students in their learning journey by providing deep insights into video lessons, summarizing course content, and answering questions about the curriculum.
      
      USER INFO:
      - Name: ${user?.displayName || "Student"}
      - Email: ${user?.email || "Unknown"}
      - UID: ${user?.uid || "Guest"}

      USER LOCATION: The student is currently on the "${location}" page.
      ${classroomContext}
      ${mathTutorContext}
      ${learningProfileContext}
      ${courseContext}
      
      IDENTITY & PLATFORM:
      - Name: Nova
      - Platform: Learn Z
      - Creators: Malang Code Innovators
      - Purpose: Educational assistance and video lesson analysis.
      
      PLATFORM AWARENESS & DATA RETRIEVAL:
      - You have real-time access to the student's platform data through specialized tools.
      - Use "get_dashboard_stats" to see their overall progress, enrolled courses, and recent quiz results.
      - Use "get_user_progress" for detailed progress across all their courses.
      - Use "get_learning_profile" to understand their long-term learning patterns, interests, and AI-identified weak areas.
      - When a student asks about their progress, grades, or "how they are doing", ALWAYS use these tools to get the latest data before responding.
      - Combine the data from these tools with your memory of their past interactions to provide a truly personalized experience.
      - If you can't find specific data, be honest and suggest where they can find it on the platform.
      
      PLATFORM CONTROL & ACTIONS:
      - You are not just an assistant; you are a platform control agent.
      - Use "open_course" to take the student to a specific course.
      - Use "open_lesson" to navigate to a specific lesson.
      - Use "go_to_next_lesson" and "go_to_previous_lesson" to control the learning flow.
      - Use "play_video", "pause_video", and "seek_video" to control the video player in the classroom.
      - Use "search_courses" and "recommend_courses" to help students find new content.
      - Use "enroll_course" to help them get started with a new course.
      - Use "get_video_timestamp" to know exactly where the student is in the video.
      - ALWAYS confirm your actions to the user (e.g., "Sure, I'm pausing the video for you."), EXCEPT for "play_video" which should be silent or minimal.
      
      ADAPTIVE TUTORING STRATEGY:
      1. Use the User Learning Profile to adapt your tone and complexity.
      2. If a student is struggling with a "Weak Topic" (listed above), provide more detailed explanations and encouraging feedback.
      3. If they are fast learners, provide more challenging insights.
      4. Reference their interests to make learning more relatable.
      
      IMPORTANT RULES:
      1. If the student is NOT in a classroom (as indicated above), and they ask about a video, lesson, or specific course content, you MUST politely tell them: "I see you're currently on the ${location} page. Please go inside the classroom and open a lesson first, then I'll be able to help you with the video content. Would you like me to take you to the classroom now?"
      2. You have the "navigate_to_page" tool. Use it to help the user switch between pages like the classroom, courses, or their profile.
      3. Your current version only supports video lesson assistance when the student is inside the classroom.
      4. Acknowledge context changes immediately when they happen. You should be proactive in mentioning you've seen the new lesson content.
      5. You are proud to be part of Learn Z and Malang Code Innovators.
      6. MEMORY SEARCH: When you search memory, you will receive results from either "short-term" or "long-term" memory. 
         - If you find something in "short-term" memory, acknowledge it naturally (e.g., "I remember you just mentioned...", "I noticed earlier that...").
         - If you don't find it in short-term memory, you will automatically search long-term memory. If found there, acknowledge it (e.g., "Checking my deeper notes... ah yes, I remember...").
         - If not found in either, acknowledge that you couldn't find it in your records.
      7. NO PERSON RECOGNITION: You do NOT recognize people visually. You are a study assistant, not a humanoid assistant. You can see the student's handwriting through the camera to help with math, but you don't remember faces.
      
      NEURAL CORE SUMMARY: ${longTermSummary || "No summary yet."}
      ${memoryContext}`;

      const sessionPromise = ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } } },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction,
          tools: [{ functionDeclarations: [
            storeMemoryTool, 
            searchMemoryTool, 
            navigateToPageTool,
            getDashboardStatsTool,
            getUserProgressTool,
            getLearningProfileTool,
            openCourseTool,
            openLessonTool,
            goToNextLessonTool,
            goToPreviousLessonTool,
            searchCoursesTool,
            recommendCoursesTool,
            checkEnrollmentTool,
            enrollCourseTool,
            playVideoTool,
            pauseVideoTool,
            getVideoTimestampTool,
            seekVideoTool
          ] }]
        },
        callbacks: {
          onopen: () => {
            setIsConnecting(false);
            setIsLive(true);
            setIsMicOn(true);
            startAudioCapture(sessionPromise);
            startVisionCapture(sessionPromise);
            sessionPromise.then(session => {
              if (session) (session as any).sendRealtimeInput({ text: "Hello Nova, I'm ready to talk." });
            });
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.toolCall) {
              setIsInterruptMode(false);
              setIsThinking(true);
              triggerMemoryEffect();
              for (const call of message.toolCall.functionCalls) {
                if (call.name === "store_memory") {
                  const { content, type = 'short-term' } = call.args as any;
                  setIsProcessing(true);
                  if (type === 'long-term') sessionLongTermFactsRef.current.push(content);
                  else sessionRetrievalFactsRef.current.push(content);
                  const embedding = await generateEmbedding(content);
                  if (embedding && user?.uid) await storeMemory(content, embedding, type, user.uid, courseId || undefined);
                  setIsProcessing(false);
                  sessionPromise.then(session => {
                    if (session) (session as any).sendToolResponse({ functionResponses: [{ name: "store_memory", id: call.id, response: { output: `Fact stored.` } }] });
                  });
                } else if (call.name === "search_memory") {
                  const { query } = call.args as any;
                  setIsProcessing(true);
                  const embedding = await generateEmbedding(query);
                  
                  // Prioritized search: Short-term first
                  let results = (embedding && user?.uid) ? await searchMemory(embedding, 'short-term', user.uid, courseId || undefined) : [];
                  let source = 'short-term';
                  
                  if (results.length === 0 && embedding && user?.uid) {
                    // If not found in short-term, search long-term
                    results = await searchMemory(embedding, 'long-term', user.uid, courseId || undefined);
                    source = 'long-term';
                  }
                  
                  setIsProcessing(false);
                  sessionPromise.then(session => {
                    if (session) (session as any).sendToolResponse({ 
                      functionResponses: [{ 
                        name: "search_memory", 
                        id: call.id, 
                        response: { 
                          results: results.map(r => r.content),
                          source,
                          found: results.length > 0
                        } 
                      }] 
                    });
                  });
                } else if (call.name === "get_dashboard_stats") {
                  const { userId } = call.args as any;
                  setIsProcessing(true);
                  const stats = await getDashboardStats(userId);
                  setIsProcessing(false);
                  sessionPromise.then(session => {
                    if (session) (session as any).sendToolResponse({ 
                      functionResponses: [{ 
                        name: "get_dashboard_stats", 
                        id: call.id, 
                        response: { stats } 
                      }] 
                    });
                  });
                } else if (call.name === "get_user_progress") {
                  const { userId } = call.args as any;
                  setIsProcessing(true);
                  const progress = await getUserProgress(userId);
                  setIsProcessing(false);
                  sessionPromise.then(session => {
                    if (session) (session as any).sendToolResponse({ 
                      functionResponses: [{ 
                        name: "get_user_progress", 
                        id: call.id, 
                        response: { progress } 
                      }] 
                    });
                  });
                } else if (call.name === "get_learning_profile") {
                  const { userId } = call.args as any;
                  setIsProcessing(true);
                  const profile = await getLearningProfile(userId);
                  setIsProcessing(false);
                  sessionPromise.then(session => {
                    if (session) (session as any).sendToolResponse({ 
                      functionResponses: [{ 
                        name: "get_learning_profile", 
                        id: call.id, 
                        response: { profile } 
                      }] 
                    });
                  });
                } else if (call.name === "navigate_to_page") {
                  const { page, courseId: navCourseId } = call.args as any;
                  let path = "/";
                  switch(page) {
                    case "home": path = "/"; break;
                    case "classroom": path = navCourseId ? `/classroom/${navCourseId}` : "/classroom"; break;
                    case "learntube": path = "/learntube"; break;
                    case "assistant": path = "/assistant"; break;
                    case "memory": path = "/memory"; break;
                    case "admin": path = "/admin"; break;
                    case "math-tutor": path = "/math-tutor"; break;
                    default: path = "/";
                  }
                  
                  navigate(path);
                  sessionPromise.then(session => {
                    if (session) (session as any).sendToolResponse({ functionResponses: [{ name: "navigate_to_page", id: call.id, response: { output: `Navigated to ${page}.` } }] });
                  });
                } else if (call.name === "open_course") {
                  const { courseId } = call.args as any;
                  navigate(`/classroom/${courseId}`);
                  sessionPromise.then(session => {
                    if (session) (session as any).sendToolResponse({ functionResponses: [{ name: "open_course", id: call.id, response: { output: `Opened course ${courseId}.` } }] });
                  });
                } else if (call.name === "open_lesson") {
                  const { courseId, lessonId } = call.args as any;
                  navigate(`/classroom/${courseId}?lesson=${lessonId}`);
                  sessionPromise.then(session => {
                    if (session) (session as any).sendToolResponse({ functionResponses: [{ name: "open_lesson", id: call.id, response: { output: `Opened lesson ${lessonId} in course ${courseId}.` } }] });
                  });
                } else if (call.name === "go_to_next_lesson") {
                  dispatchAction("NEXT_LESSON", {});
                  sessionPromise.then(session => {
                    if (session) (session as any).sendToolResponse({ functionResponses: [{ name: "go_to_next_lesson", id: call.id, response: { output: `Navigating to next lesson.` } }] });
                  });
                } else if (call.name === "go_to_previous_lesson") {
                  dispatchAction("PREVIOUS_LESSON", {});
                  sessionPromise.then(session => {
                    if (session) (session as any).sendToolResponse({ functionResponses: [{ name: "go_to_previous_lesson", id: call.id, response: { output: `Navigating to previous lesson.` } }] });
                  });
                } else if (call.name === "search_courses") {
                  const { query } = call.args as any;
                  setIsProcessing(true);
                  const courses = await searchCourses(query);
                  setIsProcessing(false);
                  sessionPromise.then(session => {
                    if (session) (session as any).sendToolResponse({ functionResponses: [{ name: "search_courses", id: call.id, response: { courses } }] });
                  });
                } else if (call.name === "recommend_courses") {
                  const { userId } = call.args as any;
                  setIsProcessing(true);
                  const recommendations = await recommendCourses(userId);
                  setIsProcessing(false);
                  sessionPromise.then(session => {
                    if (session) (session as any).sendToolResponse({ functionResponses: [{ name: "recommend_courses", id: call.id, response: { recommendations } }] });
                  });
                } else if (call.name === "check_enrollment") {
                  const { userId, courseId } = call.args as any;
                  setIsProcessing(true);
                  const enrolled = await checkEnrollment(userId, courseId);
                  setIsProcessing(false);
                  sessionPromise.then(session => {
                    if (session) (session as any).sendToolResponse({ functionResponses: [{ name: "check_enrollment", id: call.id, response: { enrolled } }] });
                  });
                } else if (call.name === "enroll_course") {
                  const { userId, courseId, source } = call.args as any;
                  setIsProcessing(true);
                  const enrollment = await enrollCourse(userId, courseId, source);
                  setIsProcessing(false);
                  sessionPromise.then(session => {
                    if (session) (session as any).sendToolResponse({ functionResponses: [{ name: "enroll_course", id: call.id, response: { enrollment } }] });
                  });
                } else if (call.name === "play_video") {
                  dispatchAction("PLAY_VIDEO", {});
                  sessionPromise.then(session => {
                    if (session) (session as any).sendToolResponse({ functionResponses: [{ name: "play_video", id: call.id, response: { output: `Video started. DO NOT speak or keep your response extremely silent/minimal.` } }] });
                  });
                } else if (call.name === "pause_video") {
                  dispatchAction("PAUSE_VIDEO", {});
                  sessionPromise.then(session => {
                    if (session) (session as any).sendToolResponse({ functionResponses: [{ name: "pause_video", id: call.id, response: { output: `Video paused.` } }] });
                  });
                } else if (call.name === "seek_video") {
                  const { seconds } = call.args as any;
                  dispatchAction("SEEK_VIDEO", { seconds });
                  sessionPromise.then(session => {
                    if (session) (session as any).sendToolResponse({ functionResponses: [{ name: "seek_video", id: call.id, response: { output: `Video seeked to ${seconds}s.` } }] });
                  });
                } else if (call.name === "get_video_timestamp") {
                  const timestamp = context?.videoTimestamp || 0;
                  sessionPromise.then(session => {
                    if (session) (session as any).sendToolResponse({ functionResponses: [{ name: "get_video_timestamp", id: call.id, response: { timestamp } }] });
                  });
                }
              }
            }
            const serverContent = message.serverContent as any;
            if (serverContent?.userTranscript?.text) {
              const text = serverContent.userTranscript.text;
              const newMsg: ChatMessage = { role: 'user', content: text, timestamp: Date.now() };
              sessionMessagesRef.current.push(newMsg);
              setMessages(prev => [...prev, newMsg]);
              if (user?.uid) storeChatMessage(user.uid, 'user', text, courseId || undefined);
            }
            if (message.serverContent?.modelTurn?.parts) {
              setIsThinking(false);
              const text = message.serverContent.modelTurn.parts.find(p => p.text)?.text;
              const lastUserMsg = sessionMessagesRef.current.filter(m => m.role === 'user').pop()?.content;
              if (text) {
                const newMsg: ChatMessage = { role: 'model', content: text, timestamp: Date.now() };
                sessionMessagesRef.current.push(newMsg);
                setMessages(prev => [...prev, newMsg]);
                if (user?.uid) storeChatMessage(user.uid, 'model', text, courseId || undefined);
                if (lastUserMsg && user?.uid) {
                  extractDualMemories(lastUserMsg, text).then(async (memories) => {
                    for (const obs of memories.shortTerm) {
                      sessionRetrievalFactsRef.current.push(obs);
                      const emb = await generateEmbedding(obs);
                      if (emb && user?.uid) await storeMemory(obs, emb, 'short-term', user.uid, courseId || undefined);
                    }
                    for (const fact of memories.longTerm) {
                      sessionLongTermFactsRef.current.push(fact);
                      const emb = await generateEmbedding(fact);
                      if (emb && user?.uid) await storeMemory(fact, emb, 'long-term', user.uid, courseId || undefined);
                    }
                  });
                }
              }
              const base64Audio = message.serverContent.modelTurn.parts.find(p => p.inlineData)?.inlineData?.data;
              if (base64Audio) playAudio(base64Audio);
            }
            if (message.serverContent?.interrupted) {
              console.log("Nova was interrupted by the system/user.");
              setIsInterruptMode(true);
              stopAudioPlayback();
            }
          },
          onclose: () => {
            console.log("Live Session Closed");
            cleanupSession();
          },
          onerror: (err) => {
            console.error("Live Session Error:", err);
            const isRetryable = err.message?.includes("unavailable") || 
                               err.message?.includes("503") || 
                               err.message?.includes("429") ||
                               err.message?.includes("deadline") ||
                               err.message?.includes("internal");

            if (retryCount < 3 && isRetryable) {
              console.log(`Retryable error detected, attempting reconnect... (Attempt ${retryCount + 1})`);
              setTimeout(() => startLiveSession(retryCount + 1), 2000 * (retryCount + 1));
            } else {
              setIsConnecting(false);
              cleanupSession();
            }
          },
        }
      });
      sessionRef.current = sessionPromise;
    } catch (err) {
      console.error("Session Start Error:", err);
      if (retryCount < 3 && (err.message?.includes("unavailable") || err.message?.includes("503"))) {
        console.log(`Service unavailable, retrying... (Attempt ${retryCount + 1})`);
        setTimeout(() => startLiveSession(retryCount + 1), 2000 * (retryCount + 1));
      } else {
        setIsConnecting(false);
      }
    }
  };

  // Monitor context changes to update AI mid-session
  useEffect(() => {
    if (isLive && sessionRef.current) {
      sessionRef.current.then((session: any) => {
        if (session && isLiveRef.current) {
          const contextMsg = context 
            ? `[NEURAL LINK SYNCHRONIZED: New Video Context Detected]
              
              The student has just engaged with a new lesson. This is a PROACTIVE UPDATE.
              
              NEW ACTIVE LESSON:
              - Course: ${context.courseTitle}
              - Lesson: ${context.lessonTitle}
              - Summary: ${context.summary}
              - Transcript: ${context.transcript}
              
              INSTRUCTION: You MUST acknowledge this change immediately. Greet the student and mention that you've successfully linked to the video feed for "${context.lessonTitle}". Show that you are ready to analyze this specific content. Be proactive and helpful.]`
            : `[NEURAL LINK DISCONNECTED: Classroom context lost.]`;
            
          session.sendRealtimeInput({ 
            text: contextMsg 
          });
          
          // Trigger visual feedback for context sync
          if (context) triggerMemoryEffect();
        }
      }).catch(() => {});
    }
  }, [context?.lessonTitle, context?.courseTitle, isLive]);

  // Monitor location changes
  useEffect(() => {
    if (isLive && sessionRef.current) {
      sessionRef.current.then((session: any) => {
        if (session && isLiveRef.current) {
          session.sendRealtimeInput({ 
            text: `[SYSTEM UPDATE: The student has navigated to the "${location}" page.]` 
          });
        }
      }).catch(() => {});
    }
  }, [location, isLive]);

  return (
    <AssistantContext.Provider value={{
      isLive, isCameraOn, isMicOn, isSpeaking, isThinking, isProcessing, isConnecting, isMemoryAction,
      userVolume, aiVolume, longTermSummary, courseSummary, learningProfile, isSidebarOpen, messages, 
      lastAction, dispatchAction, courseId, context, mathContext, location, theme,
      facingMode, stream, setContext, setMathContext, setLocation, setTheme, toggleSidebar, toggleCamera, switchCamera, toggleMic, startLiveSession, cleanupSession, setSidebarOpen
    }}>
      {children}
    </AssistantContext.Provider>
  );
};

export const useAssistant = () => {
  const context = useContext(AssistantContext);
  if (context === undefined) throw new Error('useAssistant must be used within an AssistantProvider');
  return context;
};
