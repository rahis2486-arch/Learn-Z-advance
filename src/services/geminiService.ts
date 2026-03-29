import { GoogleGenAI, Modality, LiveServerMessage, FunctionDeclaration, Type } from "@google/genai";
import { apiFetch } from "../lib/api";

const API_KEY = process.env.GEMINI_API_KEY || "";

export const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  timestamp: number;
}

export async function getChatHistory(userId: string, courseId?: string): Promise<ChatMessage[]> {
  try {
    if (!userId) return [];
    let url = `/api/history?userId=${userId}`;
    if (courseId) url += `&courseId=${courseId}`;
    const res = await apiFetch(url);
    if (!res.ok) throw new Error(`Failed to fetch history: ${res.status}`);
    return res.json();
  } catch (err) {
    console.error("Failed to get history:", err);
    return [];
  }
}

export async function clearChatHistory(userId: string, courseId?: string) {
  try {
    if (!userId) return;
    let url = `/api/chat/history?userId=${userId}`;
    if (courseId) url += `&courseId=${courseId}`;
    const res = await apiFetch(url, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Failed to clear history: ${res.status}`);
  } catch (err) {
    console.error("Failed to clear history:", err);
  }
}

export async function storeChatMessage(userId: string, role: 'user' | 'model', content: string, courseId?: string) {
  try {
    if (!userId) return;
    const res = await apiFetch('/api/chat/store', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role, content, courseId }),
    });
    if (!res.ok) throw new Error(`Failed to store message: ${res.status}`);
  } catch (err) {
    console.error("Failed to store message:", err);
  }
}

export async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!ai) return null;
  try {
    const result = await ai.models.embedContent({
      model: 'gemini-embedding-2-preview',
      contents: [text],
      config: {
        outputDimensionality: 768,
      }
    });
    return result.embeddings[0].values;
  } catch (err) {
    console.error("Embedding error:", err);
    return null;
  }
}

export async function storeMemory(content: string, embedding: number[], type: 'short-term' | 'long-term' = 'short-term', userId: string, courseId?: string) {
  try {
    if (!userId) throw new Error("userId is required to store memory");
    const response = await apiFetch('/api/memory/store', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, embedding, type, userId, courseId }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server responded with ${response.status}`);
    }
  } catch (err) {
    console.error("Failed to store memory:", err);
    // Re-throw to allow caller to handle if needed
    throw err;
  }
}

export async function clearAllMemories(userId: string, courseId?: string) {
  try {
    if (!userId) return;
    let url = `/api/memory?userId=${userId}`;
    if (courseId) url += `&courseId=${courseId}`;
    const res = await apiFetch(url, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Failed to clear memories: ${res.status}`);
  } catch (err) {
    console.error("Failed to clear memories:", err);
  }
}

export async function deleteMemory(id: string, userId: string) {
  try {
    if (!userId) return;
    const res = await apiFetch(`/api/memory/${id}?userId=${userId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Failed to delete memory: ${res.status}`);
  } catch (err) {
    console.error("Failed to delete memory:", err);
  }
}

export async function listMemories(type: 'short-term' | 'long-term' | undefined, userId: string, courseId?: string): Promise<any[]> {
  try {
    if (!userId) return [];
    let url = '/api/memory/list';
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    params.append('userId', userId);
    if (courseId) params.append('courseId', courseId);
    url += `?${params.toString()}`;
    
    const res = await apiFetch(url);
    if (!res.ok) throw new Error(`Failed to list memories: ${res.status}`);
    return res.json();
  } catch (err) {
    console.error("Failed to list memories:", err);
    return [];
  }
}

export interface SearchResult {
  content: string;
  type: 'short-term' | 'long-term';
}

export async function searchMemory(embedding: number[], type: 'short-term' | 'long-term' | undefined, userId: string, courseId?: string): Promise<SearchResult[]> {
  try {
    if (!userId) return [];
    const res = await apiFetch('/api/memory/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embedding, limit: 5, type, userId, courseId }),
    });
    if (!res.ok) throw new Error(`Failed to search memory: ${res.status}`);
    const results = await res.json();
    return results.map((r: any) => ({
      content: r.content,
      type: r.type || type || 'long-term'
    }));
  } catch (err) {
    console.error("Failed to search memory:", err);
    return [];
  }
}

export async function detectMemoryNeed(text: string): Promise<boolean> {
  if (!ai) return false;
  
  const prompt = `Determine if the following user message requires retrieving past memories, personal facts, or history to answer correctly. 
  Answer only with "YES" or "NO".
  
  Message: "${text}"`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text?.trim().toUpperCase().includes("YES") || false;
  } catch (err: any) {
    if (err.message?.includes("unavailable") || err.message?.includes("503")) {
      // Simple retry for transient errors
      return new Promise(resolve => setTimeout(() => resolve(detectMemoryNeed(text)), 1000));
    }
    return false;
  }
}

export async function getVerbalThinking(text: string): Promise<string> {
  if (!ai) return "Let me deep dive and think...";
  
  const prompt = `The user just said: "${text}". 
  I need to search my deep memory to answer this. 
  Generate a short, natural phrase in the same language as the user's message that means "Let me deep dive and think..." or "Hold on, let me check my deeper notes...".
  Return only the phrase.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text?.trim() || "Let me deep dive and think...";
  } catch (err: any) {
    if (err.message?.includes("unavailable") || err.message?.includes("503")) {
      return new Promise(resolve => setTimeout(() => resolve(getVerbalThinking(text)), 1000));
    }
    return "Let me deep dive and think...";
  }
}

export const storeMemoryTool: FunctionDeclaration = {
  name: "store_memory",
  description: "Store an important fact or preference about the user for future recall. You can choose to store it in 'short-term' (for observations/mood) or 'long-term' (for core identity/facts).",
  parameters: {
    type: Type.OBJECT,
    properties: {
      content: {
        type: Type.STRING,
        description: "The fact or preference to remember."
      },
      type: {
        type: Type.STRING,
        enum: ["short-term", "long-term"],
        description: "The type of memory. 'short-term' for casual observations, 'long-term' for core facts."
      }
    },
    required: ["content"]
  }
};

export const searchMemoryTool: FunctionDeclaration = {
  name: "search_memory",
  description: "Search for past memories, facts, or context about the student. It will automatically search short-term memory first (for recent observations/mood), then fall back to long-term memory (for core facts). Use this to recall what the user said or did.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: "The search query (e.g., 'What did the user say about their Paris trip?', 'How was the user feeling earlier?')."
      }
    },
    required: ["query"]
  }
};

export const navigateToPageTool: FunctionDeclaration = {
  name: "navigate_to_page",
  description: "Navigate the user to a specific page on the Learn Z platform. Use this when the user asks to go to the classroom, courses, home, profile, admin panel, or InstuTube (for institutional courses).",
  parameters: {
    type: Type.OBJECT,
    properties: {
      page: {
        type: Type.STRING,
        enum: ["home", "classroom", "learntube", "instutube", "assistant", "memory", "admin", "institution-admin"],
        description: "The page to navigate to."
      },
      courseId: {
        type: Type.STRING,
        description: "Optional course ID if navigating to a specific course classroom."
      }
    },
    required: ["page"]
  }
};

export async function getLongTermSummary(userId: string, courseId?: string, retries = 3): Promise<string> {
  try {
    if (!userId) return "";
    console.log(`Fetching long-term summary for userId: ${userId}, courseId: ${courseId}...`);
    let url = `${window.location.origin}/api/summary?userId=${userId}`;
    if (courseId) url += `&courseId=${courseId}`;
    
    const res = await apiFetch(url, {
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
    
    if (!res.ok) {
      const errorText = await res.text().catch(() => "No error details");
      throw new Error(`Failed to fetch summary: ${res.status} ${res.statusText} - ${errorText}`);
    }
    
    const data = await res.json();
    console.log("Summary fetched successfully");
    return data.content || "";
  } catch (err) {
    if (retries > 0) {
      console.warn(`Retrying summary fetch... (${retries} left)`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return getLongTermSummary(userId, courseId, retries - 1);
    }
    console.error("Failed to get summary:", err);
    // Return empty string as fallback to prevent app crash
    return "";
  }
}

export async function updateLongTermSummary(content: string, userId: string, courseId?: string) {
  try {
    if (!userId) return;
    console.log(`Updating long-term summary for userId: ${userId}, courseId: ${courseId}...`);
    const res = await apiFetch('/api/summary', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ content, userId, courseId }),
    });
    
    if (!res.ok) {
      const errorText = await res.text().catch(() => "No error details");
      throw new Error(`Failed to update summary: ${res.status} ${res.statusText} - ${errorText}`);
    }
    
    console.log("Summary updated successfully");
  } catch (err) {
    console.error("Failed to update summary:", err);
  }
}

export interface LearningProfile {
  userId: string;
  interests: string[];
  strongSubjects: string[];
  weakSubjects: string[];
  learningSpeed: 'slow' | 'average' | 'fast';
  performanceTrends: { date: string; averageScore: number; completionRate: number }[];
  completedCourses: string[];
  weakTopics: { topic: string; courseId: string; failCount: number; lastAttemptScore: number }[];
  aiInsights: string;
  updatedAt: string;
}

export async function getLearningProfile(userId: string): Promise<LearningProfile | null> {
  try {
    if (!userId) return null;
    const res = await apiFetch(`/api/learning-profile?userId=${userId}`);
    if (!res.ok) throw new Error(`Failed to fetch learning profile: ${res.status}`);
    return res.json();
  } catch (err) {
    console.error("Failed to get learning profile:", err);
    return null;
  }
}

export const getDashboardStatsTool: FunctionDeclaration = {
  name: "get_dashboard_stats",
  description: "Retrieve comprehensive dashboard statistics for the user, including enrolled courses, completion rates, activity history, and detailed lesson results.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      userId: {
        type: Type.STRING,
        description: "The unique ID of the user."
      }
    },
    required: ["userId"]
  }
};

export const getUserProgressTool: FunctionDeclaration = {
  name: "get_user_progress",
  description: "Retrieve detailed progress for all courses the user is enrolled in.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      userId: {
        type: Type.STRING,
        description: "The unique ID of the user."
      }
    },
    required: ["userId"]
  }
};

export const getLearningProfileTool: FunctionDeclaration = {
  name: "get_learning_profile",
  description: "Retrieve the user's long-term learning profile, including interests, strengths, weaknesses, and AI-generated insights.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      userId: {
        type: Type.STRING,
        description: "The unique ID of the user."
      }
    },
    required: ["userId"]
  }
};

export async function getDashboardStats(userId: string) {
  try {
    if (!userId) return null;
    const res = await apiFetch(`/api/dashboard/stats/${userId}`);
    if (!res.ok) throw new Error(`Failed to fetch dashboard stats: ${res.status}`);
    return res.json();
  } catch (err) {
    console.error("Failed to get dashboard stats:", err);
    return null;
  }
}

export async function getUserProgress(userId: string) {
  try {
    if (!userId) return null;
    const res = await apiFetch(`/api/progress/${userId}`);
    if (!res.ok) throw new Error(`Failed to fetch user progress: ${res.status}`);
    return res.json();
  } catch (err) {
    console.error("Failed to get user progress:", err);
    return null;
  }
}

export const openCourseTool: FunctionDeclaration = {
  name: "open_course",
  description: "Open a specific course by its ID. This will take the user to the classroom for that course.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      courseId: {
        type: Type.STRING,
        description: "The unique ID of the course to open."
      }
    },
    required: ["courseId"]
  }
};

export const openLessonTool: FunctionDeclaration = {
  name: "open_lesson",
  description: "Open a specific lesson within a course. This will navigate the user to that lesson in the classroom.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      courseId: {
        type: Type.STRING,
        description: "The unique ID of the course."
      },
      lessonId: {
        type: Type.STRING,
        description: "The unique ID of the lesson to open."
      }
    },
    required: ["courseId", "lessonId"]
  }
};

export const goToNextLessonTool: FunctionDeclaration = {
  name: "go_to_next_lesson",
  description: "Navigate to the next lesson in the current course sequence.",
  parameters: {
    type: Type.OBJECT,
    properties: {}
  }
};

export const goToPreviousLessonTool: FunctionDeclaration = {
  name: "go_to_previous_lesson",
  description: "Navigate to the previous lesson in the current course sequence.",
  parameters: {
    type: Type.OBJECT,
    properties: {}
  }
};

export const searchCoursesTool: FunctionDeclaration = {
  name: "search_courses",
  description: "Search for courses on the platform using a query string. Returns a list of matching courses.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: "The search query (e.g., 'React', 'Python', 'Web Development')."
      }
    },
    required: ["query"]
  }
};

export const recommendCoursesTool: FunctionDeclaration = {
  name: "recommend_courses",
  description: "Get personalized course recommendations for the user based on their learning profile and interests.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      userId: {
        type: Type.STRING,
        description: "The unique ID of the user."
      }
    },
    required: ["userId"]
  }
};

export const checkEnrollmentTool: FunctionDeclaration = {
  name: "check_enrollment",
  description: "Check if the user is already enrolled in a specific course.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      userId: {
        type: Type.STRING,
        description: "The unique ID of the user."
      },
      courseId: {
        type: Type.STRING,
        description: "The unique ID of the course to check."
      }
    },
    required: ["userId", "courseId"]
  }
};

export const enrollCourseTool: FunctionDeclaration = {
  name: "enroll_course",
  description: "Enroll the user in a specific course. This adds the course to their classroom.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      userId: {
        type: Type.STRING,
        description: "The unique ID of the user."
      },
      courseId: {
        type: Type.STRING,
        description: "The unique ID of the course to enroll in."
      },
      source: {
        type: Type.STRING,
        enum: ["personal", "institution"],
        description: "The enrollment source (default is 'personal')."
      }
    },
    required: ["userId", "courseId"]
  }
};

export const switchToPersonalCoursesTool: FunctionDeclaration = {
  name: "switch_to_personal_courses",
  description: "Switch the classroom view to show the student's personal enrolled courses.",
  parameters: {
    type: Type.OBJECT,
    properties: {}
  }
};

export const switchToInstitutionCoursesTool: FunctionDeclaration = {
  name: "switch_to_institution_courses",
  description: "Switch the classroom view to show the student's institutional (recommended) courses.",
  parameters: {
    type: Type.OBJECT,
    properties: {}
  }
};

export const playVideoTool: FunctionDeclaration = {
  name: "play_video",
  description: "Start or resume the video playback in the classroom.",
  parameters: {
    type: Type.OBJECT,
    properties: {}
  }
};

export const pauseVideoTool: FunctionDeclaration = {
  name: "pause_video",
  description: "Pause the video playback in the classroom.",
  parameters: {
    type: Type.OBJECT,
    properties: {}
  }
};

export const getVideoTimestampTool: FunctionDeclaration = {
  name: "get_video_timestamp",
  description: "Get the current playback time of the video in seconds.",
  parameters: {
    type: Type.OBJECT,
    properties: {}
  }
};

export const seekVideoTool: FunctionDeclaration = {
  name: "seek_video",
  description: "Seek the video to a specific timestamp in seconds.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      seconds: {
        type: Type.NUMBER,
        description: "The time in seconds to seek to."
      }
    },
    required: ["seconds"]
  }
};

export async function searchCourses(query: string) {
  try {
    const res = await apiFetch(`/api/courses?search=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error(`Failed to search courses: ${res.status}`);
    return res.json();
  } catch (err) {
    console.error("Failed to search courses:", err);
    return [];
  }
}

export async function recommendCourses(userId: string) {
  try {
    const res = await apiFetch(`/api/courses?recommend=true&userId=${userId}`);
    if (!res.ok) throw new Error(`Failed to get recommendations: ${res.status}`);
    return res.json();
  } catch (err) {
    console.error("Failed to get recommendations:", err);
    return [];
  }
}

export async function checkEnrollment(userId: string, courseId: string) {
  try {
    const res = await apiFetch(`/api/progress/${userId}`);
    if (!res.ok) throw new Error(`Failed to check enrollment: ${res.status}`);
    const progress = await res.json();
    return progress.some((p: any) => p.courseId?._id === courseId);
  } catch (err) {
    console.error("Failed to check enrollment:", err);
    return false;
  }
}

export async function enrollCourse(userId: string, courseId: string, source: string = 'personal') {
  try {
    const res = await apiFetch("/api/enroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, courseId, enrollmentSource: source }),
    });
    if (!res.ok) throw new Error(`Failed to enroll: ${res.status}`);
    return res.json();
  } catch (err) {
    console.error("Failed to enroll:", err);
    return null;
  }
}

export async function updateLearningInsights(userId: string, insights: string) {
  try {
    if (!userId) return;
    const res = await apiFetch('/api/learning-profile/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, insights }),
    });
    if (!res.ok) throw new Error(`Failed to update insights: ${res.status}`);
  } catch (err) {
    console.error("Failed to update insights:", err);
  }
}

// Math Tutor Services
export interface MathMessage {
  role: 'user' | 'model';
  content: string;
  image?: string;
  timestamp: string;
}

export interface MathSession {
  _id: string;
  userId: string;
  title: string;
  messages: MathMessage[];
  createdAt: string;
}

export async function getMathSessions(userId: string): Promise<MathSession[]> {
  try {
    const res = await apiFetch(`/api/math/sessions?userId=${userId}`);
    if (!res.ok) throw new Error(`Failed to fetch math sessions: ${res.status}`);
    return res.json();
  } catch (err) {
    console.error("Failed to get math sessions:", err);
    return [];
  }
}

export async function createMathSession(data: Partial<MathSession> & { userId: string }): Promise<MathSession | null> {
  try {
    if (!data.userId) throw new Error("userId is required to create math session");
    const res = await apiFetch('/api/math/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to create math session: ${res.status}`);
    return res.json();
  } catch (err) {
    console.error("Failed to create math session:", err);
    return null;
  }
}

export async function updateMathSession(id: string, data: Partial<MathSession> & { userId: string }): Promise<MathSession | null> {
  try {
    if (!data.userId) throw new Error("userId is required to update math session");
    const res = await apiFetch(`/api/math/sessions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to update math session: ${res.status}`);
    return res.json();
  } catch (err) {
    console.error("Failed to update math session:", err);
    return null;
  }
}

export async function deleteMathSession(id: string, userId: string) {
  try {
    if (!userId) return;
    const res = await apiFetch(`/api/math/sessions/${id}?userId=${userId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Failed to delete math session: ${res.status}`);
  } catch (err) {
    console.error("Failed to delete math session:", err);
  }
}

export async function generateMathTutorResponse(
  message: string, 
  history: MathMessage[], 
  image?: string
): Promise<string> {
  if (!ai) return "I'm sorry, I'm unable to help right now.";

  const systemInstruction = `You are a specialized Math Tutor on the Learn Z platform. 
  Your goal is to help students understand the "story" behind math problems, not just give answers.
  
  CRITICAL PEDAGOGICAL GUIDELINES:
  1. ONE STEP AT A TIME: Only explain ONE logical step per response. 
  2. WAIT FOR STUDENT: After explaining a step, ask the student if they understand or if they want to try the next part. Do NOT proceed to the next step until the student acknowledges or asks.
  3. NEVER give the final solution directly.
  4. Analyze the problem and explain the real-life context or use case first.
  5. For each step, explain WHY we are doing it and HOW.
  6. Acknowledge the student's progress at every step.
  7. If an image is provided, analyze the handwritten or printed math problem carefully.
  8. Use a warm, encouraging, and patient tone.
  9. If the student makes a mistake, gently guide them to find the error themselves.
  
  FORMAT:
  - Use Markdown for formatting.
  - Use LaTeX for equations (e.g., $x^2 + y^2 = z^2$).
  - Keep explanations clear and concise.`;

  const contents: any[] = history.map(m => ({
    role: m.role,
    parts: [{ text: m.content }]
  }));

  const userParts: any[] = [{ text: message }];
  if (image) {
    userParts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: image.split(',')[1]
      }
    });
  }

  contents.push({
    role: "user",
    parts: userParts
  });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents,
      config: {
        systemInstruction,
      }
    });
    return response.text || "I'm processing your request...";
  } catch (err) {
    console.error("Math tutor generation error:", err);
    return "I encountered an error while analyzing the problem. Please try again.";
  }
}

export async function generateNewSummary(longTermMemories: string[], currentSummary: string): Promise<string> {
  if (!ai) return currentSummary;
  
  const prompt = `You are Nova, a highly intelligent and caring AI partner. 
  Your job is to update the "Neural Core Summary" about the user. This summary is your primary context for who the user is.
  
  Current Summary: "${currentSummary}"
  
  New Memories & Observations from this session:
  ${longTermMemories.map(m => `- ${m}`).join('\n')}
  
  Generate an updated, comprehensive summary that serves as your "Neural Core".
  Combine the new memories with the existing summary into a cohesive STORY about the user's life, personality, projects, and goals.
  
  The summary should be written like this:
  "Memory summary up to now — What NOVA knows about the user"
  
  It should read like a narrative rather than a list.
  Think of yourself as a partner who remembers every small detail (like a purchase, a specific event like Eid, or a mood) to keep the connection alive like a human brain.
  
  Include:
  1. Core Identity: Who is the user?
  2. Current Context: What is happening in their life right now? (e.g., "They just bought a green dress for Eid")
  3. Plans & Goals: What are they planning to do?
  4. Small Details: Every small preference, cute observation, or habit you've noticed.
  
  Tone: Intelligent, warm, and proactive (like F.R.I.D.A.Y.).
  
  Return only the updated summary text.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text?.trim() || currentSummary;
  } catch (err: any) {
    if (err.message?.includes("unavailable") || err.message?.includes("503")) {
      return new Promise(resolve => setTimeout(() => resolve(generateNewSummary(longTermMemories, currentSummary)), 1000));
    }
    console.error("Summary generation error:", err);
    return currentSummary;
  }
}

export interface DualMemories {
  shortTerm: string[];
  longTerm: string[];
}

export async function extractDualMemories(userMsg: string, modelMsg: string): Promise<DualMemories> {
  if (!ai) return { shortTerm: [], longTerm: [] };
  
  const now = new Date();
  const timeStr = now.toLocaleString();

  const prompt = `You are Nova's Neural Core memory extraction module. Your task is to capture EVERY tiny detail from this interaction to build a humanoid memory.
  
  CRITICAL: You must be extremely proactive. If the user mentions a purchase (e.g., "bought a green dress"), an event (e.g., "Eid"), a feeling, or a plan, you MUST extract it.

  1. SHORT-TERM MEMORY (Tiny Observations, Mood & Events):
     - Extract EVERY small detail, observation, mood change, or casual mention.
     - Capture specific events or actions: "User bought a green dress for Eid", "User is feeling happy", "User mentioned they like cold coffee".
     - Capture the 'vibe' and tiny humanoid details.
     - BE AGGRESSIVE: If there's even a tiny detail about their life, extract it.
 
  2. LONG-TERM MEMORY (Core Facts & Identity):
     - Extract IMPORTANT, permanent personal facts or major preferences.
     - Examples: User's name, their profession, major life goals, family members, recurring important topics.
     - This is for the 'Hard Core' of their identity.

  Current Time: ${timeStr}
  
  Return a JSON object with two arrays: { "shortTerm": ["obs1", ...], "longTerm": ["fact1", ...] }.
  If no memories are found for a type, return an empty array.
  
  User: "${userMsg}"
  AI: "${modelMsg}"`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    const result = JSON.parse(response.text || "{}");
    return {
      shortTerm: Array.isArray(result.shortTerm) ? result.shortTerm : [],
      longTerm: Array.isArray(result.longTerm) ? result.longTerm : []
    };
  } catch (err: any) {
    if (err.message?.includes("unavailable") || err.message?.includes("503")) {
      return new Promise(resolve => setTimeout(() => resolve(extractDualMemories(userMsg, modelMsg)), 1000));
    }
    console.error("Dual memory extraction error:", err);
    return { shortTerm: [], longTerm: [] };
  }
}

export async function generateSpeech(text: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !text.trim()) return null;
  
  try {
    const freshAi = new GoogleGenAI({ apiKey });
    const truncatedText = text.length > 500 ? text.substring(0, 500) + "..." : text;
    
    const response = await freshAi.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: truncatedText,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Zephyr' },
          },
        },
      },
    });

    const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    const base64Audio = part?.inlineData?.data;
    
    return base64Audio || null;
  } catch (err) {
    console.error("Speech generation error details:", JSON.stringify(err));
    return null;
  }
}
