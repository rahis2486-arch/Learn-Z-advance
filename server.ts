import express from "express";
import axios from 'axios';
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
import { Category } from "./src/models/Category.ts";
import { Recommendation } from "./src/models/Recommendation.ts";

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
      let { uid, email, displayName, photoURL, institutionId } = req.body;
      
      // Convert external photoURL to base64 to ensure persistence
      if (photoURL && photoURL.startsWith('http') && !photoURL.includes('localhost') && !photoURL.includes('.run.app')) {
        try {
          const response = await axios.get(photoURL, { responseType: 'arraybuffer' });
          const contentType = response.headers['content-type'];
          const base64 = Buffer.from(response.data, 'binary').toString('base64');
          photoURL = `data:${contentType};base64,${base64}`;
        } catch (err) {
          console.error("Failed to convert photoURL to base64:", err);
        }
      }

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
        
        // Generate unique username from email
        let baseUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
        let username = baseUsername;
        let counter = 1;
        while (await User.findOne({ username })) {
          username = `${baseUsername}${counter}`;
          counter++;
        }

        user = new User({
          uid,
          email,
          displayName,
          photoURL,
          username,
          role: isDefaultAdmin ? 'admin' : 'user',
          status: 'active',
          loginType: institutionId ? 'institutional' : 'personal',
          institutionId: institutionId || null
        });
      } else {
        // Update existing user info
        // Only update displayName if it's not already set in the database
        if (!user.displayName && displayName) {
          user.displayName = displayName;
        }
        // Only update photoURL if it's not already a local upload or base64
        if (photoURL && !user.photoURL?.startsWith('data:image') && !user.photoURL?.startsWith('/public/uploads')) {
          try {
            const response = await axios.get(photoURL, { responseType: 'arraybuffer' });
            const contentType = response.headers['content-type'];
            const base64 = Buffer.from(response.data, 'binary').toString('base64');
            user.photoURL = `data:${contentType};base64,${base64}`;
          } catch (e) {
            console.error("Failed to convert photoURL to base64:", e);
            user.photoURL = photoURL; // Fallback to original URL
          }
        }
        user.lastLogin = new Date();
        
        // Ensure they have a username if they don't (legacy users)
        if (!user.username) {
          let baseUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
          let username = baseUsername;
          let counter = 1;
          while (await User.findOne({ username })) {
            username = `${baseUsername}${counter}`;
            counter++;
          }
          user.username = username;
        }

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
      const { role, status, displayName, username, institutionId } = req.body;
      const user = await User.findOneAndUpdate(
        { uid: req.params.uid },
        { role, status, displayName, username, institutionId },
        { new: true }
      );
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json(user);
    } catch (err) {
      console.error("Admin user update error:", err);
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

  // Recommendation Management
  app.post("/api/recommendations", async (req, res) => {
    try {
      const { institutionId, courseId, recommendedBy } = req.body;
      
      // Check if user is admin of this institution
      const user = await User.findOne({ uid: recommendedBy });
      if (!user || user.role !== 'admin' || user.institutionId?.toString() !== institutionId) {
        return res.status(403).json({ error: "Only institution admins can recommend courses" });
      }

      const recommendation = new Recommendation({ institutionId, courseId, recommendedBy });
      await recommendation.save();
      res.json(recommendation);
    } catch (err) {
      if ((err as any).code === 11000) {
        return res.status(400).json({ error: "Course already recommended" });
      }
      res.status(500).json({ error: "Failed to recommend course" });
    }
  });

  app.get("/api/recommendations/:institutionId", async (req, res) => {
    try {
      const recommendations = await Recommendation.find({ institutionId: req.params.institutionId })
        .populate("courseId")
        .sort({ createdAt: -1 });
      
      // Filter out recommendations where the course was deleted
      const validCourses = recommendations
        .map(r => r.courseId)
        .filter(c => {
          if (!c) {
            console.warn(`[Recommendations] Found recommendation for deleted course in institution ${req.params.institutionId}`);
            return false;
          }
          return true;
        });
        
      res.json(validCourses);
    } catch (err) {
      console.error("Failed to fetch recommendations:", err);
      res.status(500).json({ error: "Failed to fetch recommendations" });
    }
  });

  app.delete("/api/recommendations/:institutionId/:courseId", async (req, res) => {
    try {
      const { institutionId, courseId } = req.params;
      const uid = req.headers['x-user-uid'];
      
      const user = await User.findOne({ uid });
      if (!user || user.role !== 'admin' || user.institutionId?.toString() !== institutionId) {
        return res.status(403).json({ error: "Only institution admins can remove recommendations" });
      }

      await Recommendation.findOneAndDelete({ institutionId, courseId });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to remove recommendation" });
    }
  });

  // User Profile Update
  app.put("/api/users/:uid", async (req, res) => {
    try {
      const { uid } = req.params;
      const updates = req.body;

      // If username is being updated, check for uniqueness
      if (updates.username) {
        const existing = await User.findOne({ username: updates.username, uid: { $ne: uid } });
        if (existing) {
          // Suggest a unique username
          let baseUsername = updates.username.toLowerCase().replace(/[^a-z0-9]/g, '');
          let suggested = baseUsername;
          let counter = 1;
          while (await User.findOne({ username: suggested })) {
            suggested = `${baseUsername}${counter}`;
            counter++;
          }
          return res.status(400).json({ 
            error: "Username already taken", 
            suggestion: suggested 
          });
        }
      }

      const user = await User.findOneAndUpdate({ uid }, updates, { new: true });
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json(user);
    } catch (err) {
      console.error("User update error:", err);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // Onboarding Update
  app.post("/api/users/:uid/profile-picture", upload.single("photo"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      
      // Read file and convert to base64
      const filePath = path.join(process.cwd(), 'public', 'uploads', req.file.filename);
      const fileData = fs.readFileSync(filePath);
      const base64Image = `data:${req.file.mimetype};base64,${fileData.toString('base64')}`;
      
      // Delete the temporary file
      fs.unlinkSync(filePath);

      const user = await User.findOneAndUpdate(
        { uid: req.params.uid },
        { photoURL: base64Image },
        { new: true }
      );
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json(user);
    } catch (err) {
      console.error("Profile picture update error:", err);
      res.status(500).json({ error: "Failed to update profile picture" });
    }
  });

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
      const { 
        search, 
        category, 
        page = "1", 
        limit = "10", 
        userId,
        recommend = "false" 
      } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      let query: any = {};

      // Search matching title, tags, or category
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: "i" } },
          { tags: { $in: [new RegExp(search as string, "i")] } },
          { category: { $regex: search, $options: "i" } }
        ];
      }

      // Category filter
      if (category) {
        query.category = category;
      }

      // Recommendation logic
      if (recommend === "true" && userId) {
        const user = await User.findOne({ uid: userId });
        const enrolled = await UserProgress.find({ userId }).populate("courseId");
        
        if (user || enrolled.length > 0) {
          const userInterests = user?.interests || [];
          const userHobbies = user?.hobbies || [];
          const userPrefs = user?.learningPreferences || [];
          
          const enrolledTags = enrolled.flatMap((p: any) => p.courseId?.tags || []);
          const enrolledCategories = enrolled.map((p: any) => p.courseId?.category).filter(Boolean);
          
          const allRelevantTags = [...new Set([...userInterests, ...userHobbies, ...userPrefs, ...enrolledTags])];
          const allRelevantCategories = [...new Set([...enrolledCategories])];

          // Boost courses matching tags or categories
          // We'll use a weighted approach if possible, but for simple MongoDB:
          query.$or = [
            ...(query.$or || []),
            { tags: { $in: allRelevantTags.map(t => new RegExp(t, "i")) } },
            { category: { $in: allRelevantCategories } }
          ];
        }
      }

      const total = await Course.countDocuments(query);
      const courses = await Course.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum);

      res.json({
        courses,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
        hasMore: skip + courses.length < total
      });
    } catch (err) {
      console.error("Fetch courses error:", err);
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
      const courseId = req.params.id;
      
      // 1. Delete related recommendations
      await (Recommendation as any).deleteMany({ courseId });
      console.log(`[Cleanup] Deleted all recommendations for course ${courseId}`);

      // 2. Delete non-completed enrollments, preserve completed ones for snapshots
      const deletedEnrollments = await (UserProgress as any).deleteMany({ 
        courseId, 
        isCompleted: false 
      });
      console.log(`[Cleanup] Deleted ${deletedEnrollments.deletedCount} active enrollments for course ${courseId}`);

      // 3. Delete lessons
      await (Lesson as any).deleteMany({ courseId });
      
      // 4. Finally delete the course
      await (Course as any).findByIdAndDelete(courseId);
      
      res.json({ success: true });
    } catch (err) {
      console.error("Failed to delete course:", err);
      res.status(500).json({ error: "Failed to delete course" });
    }
  });

  // Category Management
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await Category.find().sort({ name: 1 });
      res.json(categories);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  app.post("/api/categories", isAdmin, async (req, res) => {
    try {
      const category = new Category(req.body);
      await category.save();
      res.json(category);
    } catch (err) {
      if ((err as any).code === 11000) {
        return res.status(400).json({ error: "Category already exists" });
      }
      res.status(500).json({ error: "Failed to create category" });
    }
  });

  app.put("/api/categories/:id", isAdmin, async (req, res) => {
    try {
      const category = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
      res.json(category);
    } catch (err) {
      res.status(500).json({ error: "Failed to update category" });
    }
  });

  app.delete("/api/categories/:id", isAdmin, async (req, res) => {
    try {
      await Category.findByIdAndDelete(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete category" });
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
      const progressWithLessonCount = await Promise.all(progress.map(async (p: any) => {
        // If course was deleted, use snapshot if available
        if (!p.courseId) {
          console.warn(`[Progress] Found enrollment for deleted course in user ${req.params.userId}`);
          return { 
            ...p.toObject(), 
            totalLessons: 0,
            courseId: p.courseSnapshot ? {
              _id: null,
              title: p.courseSnapshot.title,
              thumbnail: p.courseSnapshot.thumbnail,
              deleted: true
            } : null
          };
        }
        const lessonCount = await (Lesson as any).countDocuments({ courseId: p.courseId._id });
        return { ...p.toObject(), totalLessons: lessonCount };
      }));
      res.json(progressWithLessonCount);
    } catch (err) {
      console.error("Failed to fetch progress:", err);
      res.status(500).json({ error: "Failed to fetch progress" });
    }
  });

  app.post("/api/enroll", async (req, res) => {
    try {
      const { userId, courseId, enrollmentSource = 'personal' } = req.body;
      const existing = await (UserProgress as any).findOne({ userId, courseId, enrollmentSource });
      if (existing) return res.json(existing);
      
      const progress = new UserProgress({ 
        userId, 
        courseId, 
        completedLessons: [],
        enrollmentSource 
      });
      await progress.save();
      console.log(`[Enrollment] Created new enrollment: user=${userId}, course=${courseId}, source=${enrollmentSource}`);
      res.json(progress);
    } catch (err) {
      console.error("Enrollment error:", err);
      res.status(500).json({ error: "Failed to enroll" });
    }
  });

  app.post("/api/progress/:uid/:courseId/lesson/:lessonId", async (req, res) => {
    try {
      const { uid, courseId, lessonId } = req.params;
      const { enrollmentSource } = req.query;
      console.log(`[Progress Update] Marking lesson ${lessonId} as complete for user ${uid}, course ${courseId}, source ${enrollmentSource || 'any'}`);
      
      let progress;
      if (enrollmentSource) {
        progress = await (UserProgress as any).findOne({ userId: uid, courseId, enrollmentSource });
      } else {
        const enrollments = await (UserProgress as any).find({ userId: uid, courseId });
        if (enrollments.length === 1) progress = enrollments[0];
        else if (enrollments.length > 1) return res.status(400).json({ error: "Multiple enrollments found. Please specify enrollmentSource." });
      }

      if (!progress) {
        console.warn(`[Progress Update] Enrollment not found for user ${uid}, course ${courseId}, source ${enrollmentSource}`);
        return res.status(404).json({ error: "Enrollment not found" });
      }

      // Check if lesson quiz is completed
      const quiz = progress.lessonQuizzes.find((q: any) => q.lessonId === lessonId);
      if (!quiz || !quiz.completed) {
        return res.status(403).json({ error: "Lesson quiz must be completed first" });
      }

      if (!progress.completedLessons.includes(lessonId)) {
        progress.completedLessons.push(lessonId);
        await progress.save();
      }
      res.json(progress);
    } catch (err) {
      console.error("Progress update error:", err);
      res.status(500).json({ error: "Failed to update progress" });
    }
  });

  app.post("/api/progress/:uid/:courseId/quiz/:lessonId", async (req, res) => {
    try {
      const { uid, courseId, lessonId } = req.params;
      const { score, totalQuestions, timeTaken, answers, feedback, enrollmentSource } = req.body;
      console.log(`[Quiz Update] Saving quiz for lesson ${lessonId} for user ${uid}, course ${courseId}, source ${enrollmentSource || 'any'}`);
      
      let progress;
      if (enrollmentSource) {
        progress = await (UserProgress as any).findOne({ userId: uid, courseId, enrollmentSource });
      } else {
        const enrollments = await (UserProgress as any).find({ userId: uid, courseId });
        if (enrollments.length === 1) progress = enrollments[0];
        else if (enrollments.length > 1) return res.status(400).json({ error: "Multiple enrollments found. Please specify enrollmentSource." });
      }

      if (!progress) {
        console.warn(`[Quiz Update] Enrollment not found for user ${uid}, course ${courseId}, source ${enrollmentSource}`);
        return res.status(404).json({ error: "Enrollment not found" });
      }

      let quiz = progress.lessonQuizzes.find((q: any) => q.lessonId === lessonId);
      if (quiz) {
        quiz.attempts += 1;
        quiz.score = score;
        quiz.timeTaken = timeTaken;
        quiz.completed = true;
        quiz.answers = answers;
        quiz.feedback = feedback;
        quiz.history.push({ score, timeTaken });
      } else {
        progress.lessonQuizzes.push({
          lessonId,
          score,
          totalQuestions,
          timeTaken,
          attempts: 1,
          completed: true,
          answers,
          feedback,
          history: [{ score, timeTaken }]
        });
      }
      await progress.save();
      res.json(progress);
    } catch (err) {
      console.error("Quiz save error:", err);
      res.status(500).json({ error: "Failed to save quiz result" });
    }
  });

  app.post("/api/progress/:uid/:courseId/final-test", async (req, res) => {
    try {
      const { uid, courseId } = req.params;
      const { score, totalQuestions, timeTaken, answers, feedback, enrollmentSource } = req.body;
      console.log(`[Final Test Update] Saving final test for user ${uid}, course ${courseId}, source ${enrollmentSource || 'any'}`);
      
      let progress;
      if (enrollmentSource) {
        progress = await (UserProgress as any).findOne({ userId: uid, courseId, enrollmentSource });
      } else {
        const enrollments = await (UserProgress as any).find({ userId: uid, courseId });
        if (enrollments.length === 1) progress = enrollments[0];
        else if (enrollments.length > 1) return res.status(400).json({ error: "Multiple enrollments found. Please specify enrollmentSource." });
      }

      if (!progress) {
        console.warn(`[Final Test Update] Enrollment not found for user ${uid}, course ${courseId}, source ${enrollmentSource}`);
        return res.status(404).json({ error: "Enrollment not found" });
      }

      if (progress.finalTest) {
        progress.finalTest.attempts += 1;
        progress.finalTest.score = score;
        progress.finalTest.totalQuestions = totalQuestions;
        progress.finalTest.timeTaken = timeTaken;
        progress.finalTest.completed = true;
        progress.finalTest.answers = answers;
        progress.finalTest.feedback = feedback;
        progress.finalTest.history.push({ score, timeTaken });
      } else {
        progress.finalTest = {
          score,
          totalQuestions,
          timeTaken,
          attempts: 1,
          completed: true,
          answers,
          feedback,
          history: [{ score, timeTaken }]
        };
      }
      await progress.save();
      res.json(progress);
    } catch (err) {
      console.error("Final test save error:", err);
      res.status(500).json({ error: "Failed to save final test result" });
    }
  });

  app.post("/api/progress/:uid/:courseId/complete", async (req, res) => {
    try {
      const { uid, courseId } = req.params;
      const { rating, enrollmentSource } = req.body;
      console.log(`[Course Completion] Marking course ${courseId} as complete for user ${uid}, source ${enrollmentSource || 'any'}`);
      
      let progress;
      if (enrollmentSource) {
        progress = await (UserProgress as any).findOne({ userId: uid, courseId, enrollmentSource });
      } else {
        const enrollments = await (UserProgress as any).find({ userId: uid, courseId });
        if (enrollments.length === 1) progress = enrollments[0];
        else if (enrollments.length > 1) return res.status(400).json({ error: "Multiple enrollments found. Please specify enrollmentSource." });
      }

      if (!progress) {
        console.warn(`[Course Completion] Enrollment not found for user ${uid}, course ${courseId}, source ${enrollmentSource}`);
        return res.status(404).json({ error: "Enrollment not found" });
      }

      // Enforce completion rules
      const lessons = await Lesson.find({ courseId });
      const allLessonsCompleted = lessons.every(l => progress.completedLessons.includes(l._id.toString()));
      const allQuizzesCompleted = lessons.every(l => {
        const quiz = progress.lessonQuizzes.find((q: any) => q.lessonId === l._id.toString());
        return quiz && quiz.completed;
      });
      const finalTestCompleted = progress.finalTest && progress.finalTest.completed;

      if (!allLessonsCompleted || !allQuizzesCompleted || !finalTestCompleted) {
        return res.status(403).json({ 
          error: "All lessons, quizzes, and the final test must be completed before marking the course as finished." 
        });
      }

      progress.isCompleted = true;
      if (rating) progress.rating = rating;
      
      // Store course snapshot for dashboard preservation
      const course = await Course.findById(courseId);
      if (course) {
        progress.courseSnapshot = {
          title: (course as any).title,
          thumbnail: (course as any).thumbnail
        };
        
        if (rating) {
          const currentTotal = (course as any).rating * (course as any).ratingCount;
          (course as any).ratingCount += 1;
          (course as any).rating = (currentTotal + rating) / (course as any).ratingCount;
          await course.save();
        }
      }
      
      await progress.save();
      res.json(progress);
    } catch (err) {
      res.status(500).json({ error: "Failed to complete course" });
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
