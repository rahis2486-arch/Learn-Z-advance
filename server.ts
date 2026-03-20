import express from "express";
import { createServer as createViteServer } from "vite";
import { WebSocketServer } from "ws";
import dotenv from "dotenv";
import path from "path";
import mongoose from "mongoose";
import multer from "multer";
import fs from "fs";
import { Course } from "./src/models/Course.ts";
import { Lesson } from "./src/models/Lesson.ts";
import { UserProgress } from "./src/models/UserProgress.ts";
import { User } from "./src/models/User.ts";
import { Institution } from "./src/models/Institution.ts";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/learnz";

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), "public", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// MongoDB Models for Memory (Migrated from SQLite)
const MemorySchema = new mongoose.Schema({
  content: String,
  embedding: [Number],
  type: { type: String, default: 'short-term' },
  userId: String,
  timestamp: { type: Date, default: Date.now }
});
const Memory = mongoose.model('Memory', MemorySchema);

const SummarySchema = new mongoose.Schema({
  content: String,
  userId: String,
  updated_at: { type: Date, default: Date.now }
});
const Summary = mongoose.model('Summary', SummarySchema);

const ChatHistorySchema = new mongoose.Schema({
  role: String,
  content: String,
  timestamp: { type: Date, default: Date.now }
});
const ChatHistory = mongoose.model('ChatHistory', ChatHistorySchema);

const MathSessionSchema = new mongoose.Schema({
  userId: String,
  title: String,
  messages: [{
    role: String,
    content: String,
    image: String,
    timestamp: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now }
});
const MathSession = mongoose.model('MathSession', MathSessionSchema);

async function connectWithRetry() {
  const maxRetries = 5;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      await mongoose.connect(MONGODB_URI);
      console.log("Connected to MongoDB");
      return;
    } catch (err) {
      retries++;
      console.error(`MongoDB connection attempt ${retries} failed:`, err);
      if (retries < maxRetries) {
        console.log(`Retrying in 5 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }
  console.error("Could not connect to MongoDB after multiple attempts.");
}

async function startServer() {
  // Start connection in background so it doesn't block server startup
  console.log("Starting MongoDB connection in background...");
  connectWithRetry();

  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use("/public", express.static(path.join(process.cwd(), "public")));

  // API Routes
  app.get("/api/health", (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
    res.json({ 
      status: "ok", 
      database: dbStatus,
      mongodb_uri: MONGODB_URI.split('@').pop() // Safe logging
    });
  });

  // Error handling for the server
  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });

  // Middleware to check DB connection
  app.use("/api", (req, res, next) => {
    if (req.path === "/health") return next();
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database not connected" });
    }
    next();
  });

  app.post("/api/upload", upload.single("image"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const url = `/public/uploads/${req.file.filename}`;
    res.json({ url });
  });

  // Auth Sync
  app.post("/api/auth/sync", async (req, res) => {
    try {
      const { uid, email, displayName, photoURL, institutionId } = req.body;
      
      // If institutional login, validate email
      if (institutionId) {
        const inst = await Institution.findById(institutionId);
        if (!inst) {
          return res.status(404).json({ error: "Institution not found" });
        }
        const isAllowed = inst.allowedEmails.some(e => e.toLowerCase() === email.toLowerCase());
        if (!isAllowed) {
          return res.status(403).json({ error: "Your email is not authorized for this institution. Please contact your organization or use personal login." });
        }
      }

      let user = await User.findOne({ uid });
      
      if (!user) {
        // First time login - check if this is the default admin
        const isDefaultAdmin = email === "rahis2486@gmail.com";
        user = new User({
          uid,
          email,
          displayName,
          photoURL,
          role: isDefaultAdmin ? 'admin' : 'user',
          status: 'active',
          loginType: institutionId ? 'institutional' : 'personal',
          institutionId: institutionId || null
        });
      } else {
        // Update existing user info
        user.displayName = displayName;
        user.photoURL = photoURL;
        user.lastLogin = new Date();
        
        // If they logged in via institution this time, update it
        if (institutionId) {
          user.loginType = 'institutional';
          user.institutionId = institutionId;
        }

        // Ensure default admin always keeps admin role
        if (email === "rahis2486@gmail.com") {
          user.role = 'admin';
        }
      }
      
      await user.save();
      
      if (user.status === 'deactivated') {
        return res.status(403).json({ error: "Your account has been deactivated." });
      }
      
      res.json(user);
    } catch (err) {
      console.error("Auth sync error:", err);
      res.status(500).json({ error: "Failed to sync user" });
    }
  });

  // Admin Middleware
  const isAdmin = async (req: any, res: any, next: any) => {
    const uid = req.headers['x-user-uid'];
    if (!uid) return res.status(401).json({ error: "Unauthorized" });
    
    const user = await User.findOne({ uid });
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: "Forbidden: Admin access required" });
    }
    next();
  };

  // User Management (Admin Only)
  app.get("/api/admin/users", isAdmin, async (req, res) => {
    try {
      const users = await User.find().sort({ createdAt: -1 });
      res.json(users);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.put("/api/admin/users/:uid", isAdmin, async (req, res) => {
    try {
      const { role, status } = req.body;
      const user = await User.findOneAndUpdate(
        { uid: req.params.uid },
        { role, status },
        { new: true }
      );
      res.json(user);
    } catch (err) {
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  // Institution Management
  app.get("/api/institutions", async (req, res) => {
    try {
      const institutions = await Institution.find().select('name location logoUrl');
      res.json(institutions);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch institutions" });
    }
  });

  app.get("/api/admin/institutions", isAdmin, async (req, res) => {
    try {
      const institutions = await Institution.find().sort({ createdAt: -1 });
      res.json(institutions);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch institutions" });
    }
  });

  app.post("/api/admin/institutions", isAdmin, async (req, res) => {
    try {
      const institution = new Institution(req.body);
      await institution.save();
      res.json(institution);
    } catch (err) {
      res.status(500).json({ error: "Failed to create institution" });
    }
  });

  app.put("/api/admin/institutions/:id", isAdmin, async (req, res) => {
    try {
      const institution = await Institution.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
      );
      res.json(institution);
    } catch (err) {
      res.status(500).json({ error: "Failed to update institution" });
    }
  });

  app.delete("/api/admin/institutions/:id", isAdmin, async (req, res) => {
    try {
      await Institution.findByIdAndDelete(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete institution" });
    }
  });

  // Onboarding Update
  app.post("/api/users/:uid/onboarding", async (req, res) => {
    try {
      const { uid } = req.params;
      const { 
        displayName, 
        age, 
        country, 
        discoverySource, 
        interests, 
        primaryGoal,
        customGoal,
        dailyCommitment,
        onboardingCompleted 
      } = req.body;

      const user = await User.findOneAndUpdate(
        { uid },
        { 
          displayName, 
          age, 
          country, 
          discoverySource, 
          interests, 
          primaryGoal,
          customGoal,
          dailyCommitment,
          onboardingCompleted 
        },
        { new: true }
      );

      if (!user) return res.status(404).json({ error: "User not found" });
      res.json(user);
    } catch (err) {
      console.error("Onboarding update error:", err);
      res.status(500).json({ error: "Failed to update onboarding data" });
    }
  });

  // Course Management (Admin)
  app.get("/api/courses", async (req, res) => {
    try {
      const courses = await Course.find().sort({ createdAt: -1 });
      res.json(courses);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch courses" });
    }
  });

  app.get("/api/courses/:id", async (req, res) => {
    try {
      const course = await Course.findById(req.params.id);
      if (!course) return res.status(404).json({ error: "Course not found" });
      res.json(course);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch course" });
    }
  });

  app.post("/api/courses", isAdmin, async (req, res) => {
    try {
      const course = new Course(req.body);
      await course.save();
      res.json(course);
    } catch (err) {
      res.status(500).json({ error: "Failed to create course" });
    }
  });

  app.put("/api/courses/:id", isAdmin, async (req, res) => {
    try {
      const course = await (Course as any).findByIdAndUpdate(req.params.id, req.body, { new: true });
      res.json(course);
    } catch (err) {
      res.status(500).json({ error: "Failed to update course" });
    }
  });

  app.delete("/api/courses/:id", isAdmin, async (req, res) => {
    try {
      await (Course as any).findByIdAndDelete(req.params.id);
      await (Lesson as any).deleteMany({ courseId: req.params.id });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete course" });
    }
  });

  // Lesson Management
  app.get("/api/courses/:courseId/lessons", async (req, res) => {
    try {
      const lessons = await (Lesson as any).find({ courseId: req.params.courseId }).sort({ videoNumber: 1 });
      res.json(lessons);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch lessons" });
    }
  });

  app.post("/api/lessons", isAdmin, async (req, res) => {
    try {
      const lesson = new Lesson(req.body);
      await lesson.save();
      res.json(lesson);
    } catch (err) {
      res.status(500).json({ error: "Failed to create lesson" });
    }
  });

  app.put("/api/lessons/:id", isAdmin, async (req, res) => {
    try {
      const lesson = await (Lesson as any).findByIdAndUpdate(req.params.id, req.body, { new: true });
      res.json(lesson);
    } catch (err) {
      res.status(500).json({ error: "Failed to update lesson" });
    }
  });

  app.delete("/api/lessons/:id", isAdmin, async (req, res) => {
    try {
      await (Lesson as any).findByIdAndDelete(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete lesson" });
    }
  });

  // User Progress
  app.get("/api/progress/:userId", async (req, res) => {
    try {
      const progress = await (UserProgress as any).find({ userId: req.params.userId }).populate('courseId');
      res.json(progress);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch progress" });
    }
  });

  app.post("/api/enroll", async (req, res) => {
    try {
      const { userId, courseId } = req.body;
      const existing = await (UserProgress as any).findOne({ userId, courseId });
      if (existing) return res.json(existing);
      
      const progress = new UserProgress({ userId, courseId, completedLessons: [] });
      await progress.save();
      res.json(progress);
    } catch (err) {
      res.status(500).json({ error: "Failed to enroll" });
    }
  });

  // Migrated Memory APIs
  app.get("/api/history", async (req, res) => {
    try {
      const history = await ChatHistory.find().sort({ timestamp: -1 }).limit(50);
      res.json(history);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch history" });
    }
  });

  app.post("/api/chat/store", async (req, res) => {
    try {
      const chat = new ChatHistory(req.body);
      await chat.save();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to store chat" });
    }
  });

  app.delete("/api/chat/history", async (req, res) => {
    try {
      await ChatHistory.deleteMany({});
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to clear history" });
    }
  });

  app.post("/api/memory/store", async (req, res) => {
    try {
      const memory = new Memory(req.body);
      await memory.save();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to store memory" });
    }
  });

  app.get("/api/memory/list", async (req, res) => {
    try {
      const { type, userId } = req.query;
      const query: any = {};
      if (type) query.type = type;
      if (userId) query.userId = userId;
      const memories = await Memory.find(query).sort({ timestamp: -1 }).limit(100);
      res.json(memories);
    } catch (err) {
      res.status(500).json({ error: "Failed to list memories" });
    }
  });

  app.delete("/api/memory", async (req, res) => {
    try {
      const { userId } = req.query;
      const query = userId ? { userId } : {};
      await Memory.deleteMany(query);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to clear memories" });
    }
  });

  app.delete("/api/memory/:id", async (req, res) => {
    try {
      await Memory.findByIdAndDelete(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete memory" });
    }
  });

  app.post("/api/memory/search", async (req, res) => {
    try {
      const { embedding, limit = 5, type, userId } = req.body;
      const query: any = {};
      if (type) query.type = type;
      if (userId) query.userId = userId;
      const memories = await Memory.find(query);
      
      if (!embedding || embedding.length === 0) {
        return res.json(memories.slice(0, limit));
      }

      const cosineSimilarity = (vecA: number[], vecB: number[]) => {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < vecA.length; i++) {
          dotProduct += vecA[i] * vecB[i];
          normA += vecA[i] * vecA[i];
          normB += vecB[i] * vecB[i];
        }
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
      };

      const results = memories
        .map((m: any) => ({
          content: m.content,
          timestamp: m.timestamp,
          score: cosineSimilarity(embedding, m.embedding)
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      res.json(results);
    } catch (err) {
      res.json([]);
    }
  });

  app.get("/api/summary", async (req, res) => {
    try {
      const { userId } = req.query;
      console.log(`GET /api/summary - userId: ${userId}`);
      
      const query = userId ? { userId } : {};
      const summary = await Summary.findOne(query).sort({ updated_at: -1 });
      
      if (!summary && userId) {
        console.log(`No summary found for userId: ${userId}, returning empty`);
      }
      
      res.json(summary || { content: "" });
    } catch (err) {
      console.error("Failed to fetch summary:", err);
      res.status(500).json({ error: "Failed to fetch summary from database" });
    }
  });

  app.post("/api/summary", async (req, res) => {
    try {
      const { content, userId } = req.body;
      console.log(`POST /api/summary - userId: ${userId}, content length: ${content?.length}`);
      
      if (!content && content !== "") {
        return res.status(400).json({ error: "Content is required" });
      }

      const summary = new Summary({ content, userId });
      await summary.save();
      console.log("Summary saved successfully");
      res.json({ success: true });
    } catch (err) {
      console.error("Failed to update summary:", err);
      res.status(500).json({ error: "Failed to update summary in database" });
    }
  });

  // Math Tutor Canvas APIs
  app.get("/api/math/sessions", async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId) return res.status(400).json({ error: "userId required" });
      const sessions = await MathSession.find({ userId }).sort({ createdAt: -1 });
      res.json(sessions);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch math sessions" });
    }
  });

  app.post("/api/math/sessions", async (req, res) => {
    try {
      const session = new MathSession(req.body);
      await session.save();
      res.json(session);
    } catch (err) {
      res.status(500).json({ error: "Failed to create math session" });
    }
  });

  app.get("/api/math/sessions/:id", async (req, res) => {
    try {
      const session = await MathSession.findById(req.params.id);
      if (!session) return res.status(404).json({ error: "Session not found" });
      res.json(session);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch math session" });
    }
  });

  app.put("/api/math/sessions/:id", async (req, res) => {
    try {
      const session = await MathSession.findByIdAndUpdate(req.params.id, req.body, { new: true });
      res.json(session);
    } catch (err) {
      res.status(500).json({ error: "Failed to update math session" });
    }
  });

  app.delete("/api/math/sessions/:id", async (req, res) => {
    try {
      await MathSession.findByIdAndDelete(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete math session" });
    }
  });
  
  // Subscription Management
  app.post("/api/subscription/upgrade", async (req, res) => {
    try {
      const { uid, plan, paymentMethod, transactionId } = req.body;
      
      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + 1); // 1 month subscription
      
      const user = await User.findOneAndUpdate(
        { uid },
        { 
          subscription: {
            plan,
            status: 'active',
            expiryDate,
            paymentMethod,
            transactionId
          }
        },
        { new: true }
      );
      
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json(user);
    } catch (err) {
      console.error("Subscription upgrade error:", err);
      res.status(500).json({ error: "Failed to upgrade subscription" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("Initializing Vite server...");
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      console.log("Vite server initialized.");
      app.use(vite.middlewares);
    } catch (viteErr) {
      console.error("Failed to initialize Vite server:", viteErr);
    }
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }

  console.log("Attempting to start server on port", PORT);
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    console.log("Client connected to WebSocket");
    ws.on("message", (message) => {
      console.log("Received:", message.toString());
    });
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
