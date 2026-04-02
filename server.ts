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
import { PreferenceOption } from "./src/models/PreferenceOption.ts";

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
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', default: null }, // NEW: Course-level scoping
  timestamp: { type: Date, default: Date.now }
});
const Memory = mongoose.model('Memory', MemorySchema);

const SummarySchema = new mongoose.Schema({
  content: String,
  userId: String,
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', default: null }, // NEW: Course-level scoping
  updated_at: { type: Date, default: Date.now }
});
const Summary = mongoose.model('Summary', SummarySchema);

const LearningProfileSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  interests: [String],
  strongSubjects: [String],
  weakSubjects: [String],
  learningSpeed: { type: String, enum: ['slow', 'average', 'fast'], default: 'average' },
  performanceTrends: [{
    date: { type: Date, default: Date.now },
    averageScore: Number,
    completionRate: Number
  }],
  completedCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
  weakTopics: [{
    topic: String,
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    failCount: { type: Number, default: 0 },
    lastAttemptScore: Number
  }],
  aiInsights: String,
  updatedAt: { type: Date, default: Date.now }
});
const LearningProfile = mongoose.model('LearningProfile', LearningProfileSchema);

const ChatHistorySchema = new mongoose.Schema({
  userId: String,
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', default: null }, // NEW: Course-level scoping
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

  // Middleware to check DB connection and enforce authentication
  const publicRoutes = ['/health', '/institutions', '/auth/sync', '/categories', '/courses'];
  
  app.use("/api", async (req: any, res: any, next: any) => {
    if (req.path === "/health") return next();
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database not connected" });
    }

    // Check if route is public
    const isPublic = publicRoutes.some(route => req.path === route || req.path.startsWith(route + '/'));
    // GET /api/institutions, /api/categories, /api/courses are public
    if (isPublic && req.method === 'GET') return next();
    // POST /api/auth/sync is public
    if (req.path === '/auth/sync' && req.method === 'POST') return next();

    // For all other /api routes, enforce authentication and institutional check
    const uid = req.headers['x-user-uid'];
    if (!uid) return res.status(401).json({ error: "Unauthorized" });
    
    try {
      const user = await User.findOne({ uid });
      if (!user) return res.status(404).json({ error: "User not found" });
      
      if (user.status === 'deactivated') {
        return res.status(403).json({ error: "Your account has been deactivated." });
      }

      // PART 2: SESSION INVALIDATION (VERY IMPORTANT)
      if (user.loginType === 'institutional' && user.institutionId) {
        const inst = await Institution.findById(user.institutionId);
        if (!inst) {
          console.log(`[AUTH CHECK] Access revoked: Institution ${user.institutionId} not found for ${user.email}`);
          return res.status(403).json({ error: "Access revoked by institution" });
        }
        
        const permittedEmails = inst.permittedEmails || [];
        const isAllowed = permittedEmails.some(e => e.toLowerCase() === user.email.toLowerCase());
        
        if (!isAllowed) {
          console.log(`[AUTH CHECK] Access revoked: ${user.email} no longer in permitted list for ${inst.name}`);
          return res.status(403).json({ error: "Access revoked by institution" });
        }
      }
      
      req.user = user;
      next();
    } catch (err) {
      console.error("Middleware auth error:", err);
      res.status(500).json({ error: "Authentication error" });
    }
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
      console.log(`[AUTH SYNC] User: ${email}, InstitutionID: ${institutionId}`);
      
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

      // PART 1: STRICT LOGIN BLOCK (MANDATORY)
      if (institutionId) {
        if (!mongoose.Types.ObjectId.isValid(institutionId)) {
          console.log(`[AUTH SYNC] Invalid Institution ID: ${institutionId}`);
          return res.status(400).json({ error: "Invalid Institution ID" });
        }
        const inst = await Institution.findById(institutionId);
        if (!inst) {
          console.log(`[AUTH SYNC] Institution not found: ${institutionId}`);
          return res.status(404).json({ error: "Institution not found" });
        }
        
        const permittedEmails = inst.permittedEmails || [];
        console.log(`[AUTH SYNC] Institution: ${inst.name}, Permitted Emails: ${JSON.stringify(permittedEmails)}`);
        
        if (permittedEmails.length === 0) {
          console.log(`[AUTH SYNC] Access denied: No permitted emails configured for ${inst.name}`);
          return res.status(403).json({ error: "No users are authorized for this institution" });
        }

        const isAllowed = permittedEmails.some(e => e.toLowerCase() === email.toLowerCase());
        if (!isAllowed) {
          console.log(`[AUTH SYNC] Access denied: ${email} not in permitted list for ${inst.name}`);
          return res.status(403).json({ error: "You are not authorized to sign in with this institution" });
        }
        console.log(`[AUTH SYNC] Access granted for ${email} to ${inst.name}`);
      }

      let user = await User.findOne({ uid });
      
      if (!user) {
        // First time login - check if this is the default admin
        const adminEmails = ["rahis2486@gmail.com", "malangcode510@gmail.com"];
        const isDefaultAdmin = adminEmails.includes(email);
        
        // Generate unique username from email
        let baseUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
        let username = baseUsername;
        let counter = 1;
        while (await User.findOne({ username })) {
          username = `${baseUsername}${counter}`;
          counter++;
        }

        const assignedRole = isDefaultAdmin ? 'admin' : (institutionId ? 'student' : 'user');
        console.log(`[AUTH SYNC] Creating new user: ${email}, Role: ${assignedRole}, LoginType: ${institutionId ? 'institutional' : 'personal'}`);

        user = new User({
          uid,
          email,
          displayName,
          photoURL,
          username,
          role: assignedRole,
          status: 'active',
          loginType: institutionId ? 'institutional' : 'personal',
          institutionId: institutionId || null
        });
      } else {
        // Update existing user info
        if (!user.displayName && displayName) {
          user.displayName = displayName;
        }
        if (photoURL) {
          user.photoURL = photoURL;
        }
        
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

        // If logging in via institution, update role and institutionId
        if (institutionId) {
          user.role = 'student';
          user.loginType = 'institutional';
          user.institutionId = institutionId;
        } else {
          // If personal login, ensure loginType is personal
          user.loginType = 'personal';
          // Only change role to 'user' if they are not already a higher role
          if (user.role !== 'admin' && user.role !== 'institution_admin' && user.role !== 'staff') {
            user.role = 'user';
          }
        }

        // Ensure default admin always keeps admin role
        const adminEmails = ["rahis2486@gmail.com", "malangcode510@gmail.com"];
        if (adminEmails.includes(email)) {
          user.role = 'admin';
        }

        user.lastLogin = new Date();
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

  // Admin Middleware (Depends on global auth middleware)
  const isAdmin = (req: any, res: any, next: any) => {
    if (!req.user || req.user.role !== 'admin') {
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

  app.delete("/api/admin/users/:uid", isAdmin, async (req, res) => {
    try {
      const { uid } = req.params;
      const user = await User.findOne({ uid });
      
      if (!user) return res.status(404).json({ error: "User not found" });
      
      // Prevent deleting the main admin
      const adminEmails = ["rahis2486@gmail.com", "malangcode510@gmail.com"];
      if (adminEmails.includes(user.email)) {
        return res.status(403).json({ error: "Cannot delete the main administrator account." });
      }

      // Delete all related data
      await Promise.all([
        User.deleteOne({ uid }),
        UserProgress.deleteMany({ userId: uid }),
        Memory.deleteMany({ userId: uid }),
        Summary.deleteMany({ userId: uid }),
        LearningProfile.deleteOne({ userId: uid }),
        ChatHistory.deleteMany({ userId: uid }),
        MathSession.deleteMany({ userId: uid }),
        Recommendation.deleteMany({ recommendedBy: uid })
      ]);

      res.json({ success: true, message: "User and all related data deleted successfully." });
    } catch (err) {
      console.error("Admin user delete error:", err);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // DANGER: Delete all users except main admin
  app.delete("/api/admin/users-cleanup", isAdmin, async (req, res) => {
    try {
      const adminEmails = ["rahis2486@gmail.com", "malangcode510@gmail.com"];
      
      const usersToDelete = await User.find({ email: { $nin: adminEmails } });
      const uidsToDelete = usersToDelete.map(u => u.uid);

      await Promise.all([
        User.deleteMany({ email: { $nin: adminEmails } }),
        UserProgress.deleteMany({ userId: { $in: uidsToDelete } }),
        Memory.deleteMany({ userId: { $in: uidsToDelete } }),
        Summary.deleteMany({ userId: { $in: uidsToDelete } }),
        LearningProfile.deleteMany({ userId: { $in: uidsToDelete } }),
        ChatHistory.deleteMany({ userId: { $in: uidsToDelete } }),
        MathSession.deleteMany({ userId: { $in: uidsToDelete } }),
        Recommendation.deleteMany({ recommendedBy: { $in: uidsToDelete } })
      ]);

      res.json({ 
        success: true, 
        message: `Successfully deleted ${uidsToDelete.length} users and their related data.` 
      });
    } catch (err) {
      console.error("Admin users cleanup error:", err);
      res.status(500).json({ error: "Failed to perform users cleanup" });
    }
  });

  app.get("/api/admin/analytics", isAdmin, async (req, res) => {
    try {
      const { range = '30', interval = 'daily' } = req.query;
      const days = parseInt(range as string) || 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Backfill enrolledAt if missing (one-time fix logic)
      await UserProgress.updateMany(
        { enrolledAt: { $exists: false } },
        { $set: { enrolledAt: new Date() } }
      );

      // 1. Core Metrics
      const [
        totalCourses, 
        totalEnrollments, 
        uniqueStudents, 
        completedCourses,
        totalInstitutionalCourses,
        totalInstitutionalEnrollments,
        totalInstitutionalStudents,
        institutionalCompletedCourses
      ] = await Promise.all([
        Course.countDocuments(),
        UserProgress.countDocuments(),
        UserProgress.distinct('userId').then(ids => ids.length),
        UserProgress.countDocuments({ isCompleted: true }),
        Recommendation.distinct('courseId').then(ids => ids.length),
        UserProgress.countDocuments({ enrollmentSource: 'institution' }),
        UserProgress.distinct('userId', { enrollmentSource: 'institution' }).then(ids => ids.length),
        UserProgress.countDocuments({ enrollmentSource: 'institution', isCompleted: true })
      ]);

      const institutionalCompletionRate = totalInstitutionalEnrollments > 0 
        ? (institutionalCompletedCourses / totalInstitutionalEnrollments) * 100 
        : 0;

      // 2. Top 10 Courses by Enrollments
      const topEnrollments = await UserProgress.aggregate([
        { $group: { _id: "$courseId", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        { $lookup: { from: "courses", localField: "_id", foreignField: "_id", as: "course" } },
        { $unwind: "$course" },
        { $project: { title: "$course.title", count: 1 } }
      ]);

      // 3. Top 10 Courses by Ratings
      const topRatings = await UserProgress.aggregate([
        { $match: { rating: { $gt: 0 } } },
        { $group: { _id: "$courseId", avgRating: { $avg: "$rating" }, count: { $sum: 1 } } },
        { $sort: { avgRating: -1, count: -1 } },
        { $limit: 10 },
        { $lookup: { from: "courses", localField: "_id", foreignField: "_id", as: "course" } },
        { $unwind: "$course" },
        { $project: { title: "$course.title", avgRating: 1, count: 1 } }
      ]);

      // 4. Top 10 Courses by Engagement (Average Progress)
      const topEngagement = await UserProgress.aggregate([
        { $match: { "videoProgress.0": { $exists: true } } },
        { 
          $project: { 
            courseId: 1, 
            avgProgress: { $avg: "$videoProgress.percentage" } 
          } 
        },
        { $group: { _id: "$courseId", avgEngagement: { $avg: "$avgProgress" }, count: { $sum: 1 } } },
        { $sort: { avgEngagement: -1 } },
        { $limit: 10 },
        { $lookup: { from: "courses", localField: "_id", foreignField: "_id", as: "course" } },
        { $unwind: "$course" },
        { $project: { title: "$course.title", avgEngagement: 1, count: 1 } }
      ]);

      // 5. Enrollment Trend
      let format = "%Y-%m-%d";
      if (interval === 'monthly') format = "%Y-%m";
      else if (interval === 'weekly') format = "%Y-%U";

      const trendData = await UserProgress.aggregate([
        { $match: { enrolledAt: { $gte: startDate } } },
        {
          $group: {
            _id: { $dateToString: { format, date: "$enrolledAt" } },
            count: { $sum: 1 }
          }
        },
        { $sort: { "_id": 1 } }
      ]);

      res.json({
        metrics: {
          totalCourses,
          totalEnrollments,
          uniqueStudents,
          completedCourses,
          totalInstitutionalCourses,
          totalInstitutionalEnrollments,
          totalInstitutionalStudents,
          institutionalCompletionRate
        },
        topEnrollments,
        topRatings,
        topEngagement,
        trendData: trendData.map(d => ({ date: d._id, count: d.count }))
      });
    } catch (err) {
      console.error("Admin analytics error:", err);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  app.get("/api/admin/analytics/institutions-comparison", isAdmin, async (req, res) => {
    try {
      const comparison = await UserProgress.aggregate([
        { $match: { enrollmentSource: 'institution' } },
        { $lookup: { from: "users", localField: "userId", foreignField: "uid", as: "user" } },
        { $unwind: "$user" },
        { $match: { "user.institutionId": { $exists: true, $ne: null } } },
        { $group: { _id: "$user.institutionId", enrollmentCount: { $sum: 1 } } },
        { $lookup: { from: "institutions", localField: "_id", foreignField: "_id", as: "institution" } },
        { $unwind: "$institution" },
        { $project: { name: "$institution.name", count: "$enrollmentCount" } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);
      res.json(comparison);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch comparison" });
    }
  });

  app.get("/api/admin/analytics/institution/:id", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const institution = await Institution.findById(id);
      if (!institution) return res.status(404).json({ error: "Institution not found" });

      // Get all users belonging to this institution
      const users = await User.find({ institutionId: id });
      const userIds = users.map(u => u.uid);

      const [
        totalStudents,
        recommendedCourses,
        totalEnrollments,
        completedEnrollments
      ] = await Promise.all([
        users.length,
        Recommendation.countDocuments({ institutionId: id }),
        UserProgress.countDocuments({ userId: { $in: userIds }, enrollmentSource: 'institution' }),
        UserProgress.countDocuments({ userId: { $in: userIds }, enrollmentSource: 'institution', isCompleted: true })
      ]);

      const completionRate = totalEnrollments > 0 ? (completedEnrollments / totalEnrollments) * 100 : 0;

      // Performance trend for this institution
      const trendData = await UserProgress.aggregate([
        { $match: { userId: { $in: userIds }, enrollmentSource: 'institution' } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$enrolledAt" } },
            count: { $sum: 1 }
          }
        },
        { $sort: { "_id": 1 } },
        { $limit: 30 }
      ]);

      res.json({
        institution,
        metrics: {
          totalStudents,
          recommendedCourses,
          totalEnrollments,
          completionRate
        },
        trendData: trendData.map(d => ({ date: d._id, count: d.count }))
      });
    } catch (err) {
      console.error("Institution analytics error:", err);
      res.status(500).json({ error: "Failed to fetch institution analytics" });
    }
  });

  // Institution Management
  app.get("/api/institutions", async (req, res) => {
    try {
      const institutions = await Institution.find().select('name location logoUrl permittedEmails');
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
      console.log(`[ADMIN] Updating institution ${req.params.id}:`, JSON.stringify(req.body, null, 2));
      const institution = await Institution.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
      );
      console.log(`[ADMIN] Updated institution result:`, JSON.stringify(institution, null, 2));
      res.json(institution);
    } catch (err) {
      console.error(`[ADMIN] Failed to update institution:`, err);
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
      
      // Check if user is admin of this institution or global admin
      const user = await User.findOne({ uid: recommendedBy });
      const isAllowed = user && (
        user.role === 'admin' || 
        (user.role === 'institution_admin' && user.institutionId?.toString() === institutionId)
      );

      if (!isAllowed) {
        return res.status(403).json({ error: "Only institution admins can recommend courses" });
      }

      const recommendation = new Recommendation({ institutionId, courseId, recommendedBy });
      await recommendation.save();
      res.json(recommendation);
    } catch (err) {
      if ((err as any).code === 11000) {
        return res.status(400).json({ error: "Course already recommended" });
      }
      console.error("Failed to recommend course:", err);
      res.status(500).json({ error: "Failed to recommend course" });
    }
  });

  app.get("/api/recommendations/:institutionId", async (req: any, res: any) => {
    try {
      const { institutionId } = req.params;
      const user = req.user;
      
      if (!user) return res.status(401).json({ error: "Unauthorized" });
      
      // Check if user belongs to this institution or is a global admin
      if (user.role !== 'admin' && user.institutionId?.toString() !== institutionId) {
        return res.status(403).json({ error: "Forbidden: You do not belong to this institution" });
      }

      const recommendations = await Recommendation.find({ institutionId })
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

  app.delete("/api/recommendations/:institutionId/:courseId", async (req: any, res: any) => {
    try {
      const { institutionId, courseId } = req.params;
      const user = req.user;
      
      const isAllowed = user && (
        user.role === 'admin' || 
        (user.role === 'institution_admin' && user.institutionId?.toString() === institutionId)
      );

      if (!isAllowed) {
        return res.status(403).json({ error: "Only institution admins can remove recommendations" });
      }

      await Recommendation.findOneAndDelete({ institutionId, courseId });
      res.json({ success: true });
    } catch (err) {
      console.error("Failed to remove recommendation:", err);
      res.status(500).json({ error: "Failed to remove recommendation" });
    }
  });

  // Institution Admin Middleware (Depends on global auth middleware)
  const isInstitutionAdmin = (req: any, res: any, next: any) => {
    try {
      const user = req.user;
      if (!user) return res.status(401).json({ error: "Unauthorized" });
      
      const institutionId = req.params.institutionId || req.body.institutionId;

      if (user.role === 'admin') return next(); // Global admin can do anything

      if (user.role !== 'institution_admin' || user.institutionId?.toString() !== institutionId) {
        return res.status(403).json({ error: "Forbidden: Institution Admin access required for this institution" });
      }
      next();
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  };

  // Institution Admin Endpoints
  app.get("/api/institution/details/:institutionId", isInstitutionAdmin, async (req, res) => {
    try {
      const inst = await Institution.findById(req.params.institutionId);
      if (!inst) return res.status(404).json({ error: "Institution not found" });
      res.json(inst);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch institution details" });
    }
  });

  app.put("/api/institution/emails/:institutionId", isInstitutionAdmin, async (req, res) => {
    try {
      const { emails } = req.body;
      console.log(`[INST ADMIN] Updating emails for ${req.params.institutionId}:`, emails);
      const inst = await Institution.findByIdAndUpdate(
        req.params.institutionId,
        { permittedEmails: emails },
        { new: true }
      );
      console.log(`[INST ADMIN] Updated institution result:`, JSON.stringify(inst, null, 2));
      res.json(inst);
    } catch (err) {
      console.error(`[INST ADMIN] Failed to update permitted emails:`, err);
      res.status(500).json({ error: "Failed to update permitted emails" });
    }
  });

  app.get("/api/institution/students/:institutionId", isInstitutionAdmin, async (req, res) => {
    try {
      const students = await User.find({ 
        institutionId: req.params.institutionId,
        role: { $in: ['student', 'institution_student'] }
      }).sort({ displayName: 1 });
      
      // Get enrollment info for these students
      const studentIds = students.map(s => s.uid);
      const enrollments = await UserProgress.find({ 
        userId: { $in: studentIds },
        enrollmentSource: 'institution'
      }).populate('courseId');

      const studentsWithEnrollments = students.map(s => {
        const studentEnrollments = enrollments.filter(e => e.userId === s.uid);
        return {
          ...s.toObject(),
          enrollments: studentEnrollments
        };
      });

      res.json(studentsWithEnrollments);
    } catch (err) {
      console.error("Failed to fetch institution students:", err);
      res.status(500).json({ error: "Failed to fetch students" });
    }
  });

  app.get("/api/institution/stats/:institutionId", isInstitutionAdmin, async (req, res) => {
    try {
      const institutionId = req.params.institutionId;
      
      const totalStudents = await User.countDocuments({ 
        institutionId,
        role: { $in: ['student', 'institution_student'] }
      });

      const enrollments = await UserProgress.find({ 
        userId: { $in: await User.find({ institutionId }).distinct('uid') },
        enrollmentSource: 'institution'
      });

      const totalEnrollments = enrollments.length;
      const completions = enrollments.filter(e => e.isCompleted).length;
      const completionRate = totalEnrollments > 0 ? (completions / totalEnrollments) * 100 : 0;

      // Calculate average score across all quizzes
      let totalScore = 0;
      let totalQuizzes = 0;
      enrollments.forEach(e => {
        e.lessonQuizzes.forEach(q => {
          totalScore += (q.score / q.totalQuestions) * 100;
          totalQuizzes++;
        });
      });
      const averageScore = totalQuizzes > 0 ? totalScore / totalQuizzes : 0;

      // Stats by course
      const courseStats = await UserProgress.aggregate([
        { 
          $match: { 
            userId: { $in: await User.find({ institutionId }).distinct('uid') },
            enrollmentSource: 'institution'
          } 
        },
        {
          $group: {
            _id: "$courseId",
            enrollmentCount: { $sum: 1 },
            completionCount: { $sum: { $cond: ["$isCompleted", 1, 0] } }
          }
        },
        {
          $lookup: {
            from: "courses",
            localField: "_id",
            foreignField: "_id",
            as: "courseInfo"
          }
        },
        { $unwind: "$courseInfo" }
      ]);

      res.json({
        totalStudents,
        totalEnrollments,
        completions,
        completionRate,
        averageScore,
        courseStats
      });
    } catch (err) {
      console.error("Failed to fetch institution stats:", err);
      res.status(500).json({ error: "Failed to fetch stats" });
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
        hobbies,
        learningPreferences,
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
          hobbies,
          learningPreferences,
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

  // Preference Options API
  app.get("/api/preference-options", async (req, res) => {
    try {
      const options = await PreferenceOption.find().sort({ label: 1 });
      res.json(options);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch preference options" });
    }
  });

  app.post("/api/admin/preference-options", isAdmin, async (req, res) => {
    try {
      const { type, label, value, iconName } = req.body;
      const option = new PreferenceOption({ type, label, value, iconName });
      await option.save();
      res.status(201).json(option);
    } catch (error) {
      res.status(500).json({ error: "Failed to create preference option" });
    }
  });

  app.put("/api/admin/preference-options/:id", isAdmin, async (req, res) => {
    try {
      const { type, label, value, iconName } = req.body;
      const option = await PreferenceOption.findByIdAndUpdate(
        req.params.id,
        { type, label, value, iconName },
        { new: true }
      );
      if (!option) return res.status(404).json({ error: "Option not found" });
      res.json(option);
    } catch (error) {
      res.status(500).json({ error: "Failed to update preference option" });
    }
  });

  app.delete("/api/admin/preference-options/:id", isAdmin, async (req, res) => {
    try {
      const option = await PreferenceOption.findByIdAndDelete(req.params.id);
      if (!option) return res.status(404).json({ error: "Option not found" });
      res.json({ message: "Option deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete preference option" });
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

  // Dashboard Stats
  app.get("/api/dashboard/stats/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const { source } = req.query;
      const query: any = { userId };
      if (source) query.enrollmentSource = source;
      
      const progress = await (UserProgress as any).find(query).populate('courseId');
      
      const stats = {
        totalEnrolled: progress.length,
        completedCourses: progress.filter((p: any) => p.isCompleted).length,
        inProgressCourses: progress.filter((p: any) => !p.isCompleted).length,
        
        // Retention Metrics
        retentionMetrics: progress.map((p: any) => {
          const avgVideoCompletion = p.videoProgress.length > 0 
            ? p.videoProgress.reduce((acc: number, v: any) => acc + v.percentage, 0) / p.videoProgress.length 
            : 0;
          const totalPossible = p.lessonQuizzes.reduce((acc: number, q: any) => acc + q.totalQuestions, 0);
          const totalScored = p.lessonQuizzes.reduce((acc: number, q: any) => acc + q.score, 0);
          const avgQuizScore = totalPossible > 0 ? (totalScored / totalPossible) * 100 : 0;
          
          return {
            courseId: p.courseId?._id || p._id,
            title: p.courseId?.title || p.courseSnapshot?.title || "Unknown",
            retentionRate: (avgVideoCompletion * 0.4) + (avgQuizScore * 0.6),
            engagementScore: avgVideoCompletion,
            quizPerformance: avgQuizScore,
            source: p.enrollmentSource
          };
        }),

        // Progress over time (last 7 days of activity)
        activityHistory: await Promise.all(progress.flatMap((p: any) => 
          p.lessonQuizzes.flatMap((q: any) => 
            q.history.map((h: any) => ({
              date: h.date,
              score: (h.score / q.totalQuestions) * 100,
              courseTitle: p.courseId?.title || p.courseSnapshot?.title || "Unknown Course"
            }))
          )
        )).then(history => 
          history.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        ),

        // Scores per course
        courseScores: progress.map((p: any) => {
          const totalPossible = p.lessonQuizzes.reduce((acc: number, q: any) => acc + q.totalQuestions, 0);
          const totalScored = p.lessonQuizzes.reduce((acc: number, q: any) => acc + q.score, 0);
          return {
            id: p._id.toString(),
            title: p.courseId?.title || p.courseSnapshot?.title || "Unknown Course",
            averageScore: totalPossible > 0 ? (totalScored / totalPossible) * 100 : 0,
            completedLessons: p.completedLessons.length,
            totalQuizzes: p.lessonQuizzes.length,
            isCompleted: p.isCompleted,
            finalTest: p.finalTest,
            source: p.enrollmentSource
          };
        }),

        // Detailed lesson results and AI feedback
        lessonResults: progress.flatMap((p: any) => 
          p.lessonQuizzes.map((q: any) => ({
            id: `${p._id.toString()}-${q.lessonId}`,
            courseTitle: p.courseId?.title || p.courseSnapshot?.title || "Unknown Course",
            lessonId: q.lessonId,
            score: q.score,
            totalQuestions: q.totalQuestions,
            percentage: (q.score / q.totalQuestions) * 100,
            feedback: q.feedback,
            completed: q.completed,
            attempts: q.attempts,
            source: p.enrollmentSource
          }))
        )
      };

      res.json(stats);
    } catch (err) {
      console.error("Dashboard stats error:", err);
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
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

      // Update Learning Profile & Detect Weaknesses
      try {
        const lesson = await Lesson.findById(lessonId);
        const topic = lesson ? lesson.title : "Unknown Topic";
        const isFail = (score / totalQuestions) < 0.6;

        let profile = await LearningProfile.findOne({ userId: uid });
        if (!profile) {
          const user = await User.findOne({ uid });
          profile = new LearningProfile({ 
            userId: uid,
            interests: user ? user.interests : []
          });
        }

        // Update weak topics
        let weakTopic = profile.weakTopics.find((wt: any) => wt.topic === topic && wt.courseId.toString() === courseId);
        if (isFail) {
          if (weakTopic) {
            weakTopic.failCount += 1;
            weakTopic.lastAttemptScore = score;
          } else {
            profile.weakTopics.push({
              topic,
              courseId,
              failCount: 1,
              lastAttemptScore: score
            });
          }
          if (!profile.weakSubjects.includes(topic)) {
            profile.weakSubjects.push(topic);
          }
          // Remove from strong if it was there
          profile.strongSubjects = profile.strongSubjects.filter((s: string) => s !== topic) as any;
        } else {
          // Success
          if (weakTopic) {
            weakTopic.failCount = Math.max(0, weakTopic.failCount - 1);
            if (weakTopic.failCount === 0) {
              profile.weakTopics = profile.weakTopics.filter((wt: any) => wt.topic !== topic || wt.courseId.toString() !== courseId) as any;
              profile.weakSubjects = profile.weakSubjects.filter((s: string) => s !== topic) as any;
            }
          }
          if (!profile.strongSubjects.includes(topic)) {
            profile.strongSubjects.push(topic);
          }
        }

        // Update trends
        profile.performanceTrends.push({
          averageScore: (score / totalQuestions) * 100,
          completionRate: 100 // One quiz completed
        });
        if (profile.performanceTrends.length > 20) profile.performanceTrends.shift();

        profile.updatedAt = new Date();
        await profile.save();
      } catch (profileErr) {
        console.error("Failed to update learning profile:", profileErr);
      }

      res.json(progress);
    } catch (err) {
      console.error("Quiz save error:", err);
      res.status(500).json({ error: "Failed to save quiz result" });
    }
  });

  // Learning Profile APIs
  app.get("/api/learning-profile", async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId) return res.status(400).json({ error: "userId is required" });
      let profile = await LearningProfile.findOne({ userId });
      if (!profile) {
        const user = await User.findOne({ uid: userId as string });
        profile = new LearningProfile({ 
          userId: userId as string,
          interests: user ? user.interests : []
        });
        await profile.save();
      }
      res.json(profile);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch learning profile" });
    }
  });

  app.post("/api/learning-profile/insights", async (req, res) => {
    try {
      const { userId, insights } = req.body;
      if (!userId) return res.status(400).json({ error: "userId is required" });
      await LearningProfile.findOneAndUpdate({ userId }, { aiInsights: insights, updatedAt: new Date() }, { upsert: true });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update insights" });
    }
  });

  app.post("/api/progress/:uid/:courseId/video/:lessonId", async (req, res) => {
    try {
      const { uid, courseId, lessonId } = req.params;
      const { watchedTime, totalDuration, percentage, enrollmentSource } = req.body;
      
      let progress;
      if (enrollmentSource) {
        progress = await (UserProgress as any).findOne({ userId: uid, courseId, enrollmentSource });
      } else {
        const enrollments = await (UserProgress as any).find({ userId: uid, courseId });
        if (enrollments.length === 1) progress = enrollments[0];
        else if (enrollments.length > 1) return res.status(400).json({ error: "Multiple enrollments found. Please specify enrollmentSource." });
      }

      if (!progress) return res.status(404).json({ error: "Enrollment not found" });

      let video = progress.videoProgress.find((v: any) => v.lessonId === lessonId);
      if (video) {
        video.watchedTime = watchedTime;
        video.totalDuration = totalDuration;
        video.percentage = percentage;
        video.lastUpdated = new Date();
      } else {
        progress.videoProgress.push({
          lessonId,
          watchedTime,
          totalDuration,
          percentage,
          lastUpdated: new Date()
        });
      }
      await progress.save();
      res.json(progress);
    } catch (err) {
      res.status(500).json({ error: "Failed to save video progress" });
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
      const { userId, courseId } = req.query;
      if (!userId) return res.status(400).json({ error: "userId is required" });
      const query: any = { userId };
      if (courseId) query.courseId = courseId;
      else query.courseId = null; // Default to global if not specified
      const history = await ChatHistory.find(query).sort({ timestamp: -1 }).limit(50);
      res.json(history);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch history" });
    }
  });

  app.post("/api/chat/store", async (req, res) => {
    try {
      const { userId, role, content, courseId } = req.body;
      if (!userId) return res.status(400).json({ error: "userId is required" });
      const chat = new ChatHistory({ userId, role, content, courseId: courseId || null });
      await chat.save();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to store chat" });
    }
  });

  app.delete("/api/chat/history", async (req, res) => {
    try {
      const { userId, courseId } = req.query;
      if (!userId) return res.status(400).json({ error: "userId is required" });
      const query: any = { userId };
      if (courseId) query.courseId = courseId;
      await ChatHistory.deleteMany(query);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to clear history" });
    }
  });

  app.post("/api/memory/store", async (req, res) => {
    try {
      const { userId, content, embedding, type, courseId } = req.body;
      if (!userId) return res.status(400).json({ error: "userId is required" });
      const memory = new Memory({ userId, content, embedding, type, courseId: courseId || null });
      await memory.save();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to store memory" });
    }
  });

  app.get("/api/memory/list", async (req, res) => {
    try {
      const { type, userId, courseId } = req.query;
      if (!userId) return res.status(400).json({ error: "userId is required" });
      const query: any = { userId };
      if (type) query.type = type;
      if (courseId) query.courseId = courseId;
      else query.courseId = null; // Default to global if not specified
      const memories = await Memory.find(query).sort({ timestamp: -1 }).limit(100);
      res.json(memories);
    } catch (err) {
      res.status(500).json({ error: "Failed to list memories" });
    }
  });

  app.delete("/api/memory", async (req, res) => {
    try {
      const { userId, courseId } = req.query;
      if (!userId) return res.status(400).json({ error: "userId is required" });
      const query: any = { userId };
      if (courseId) query.courseId = courseId;
      await Memory.deleteMany(query);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to clear memories" });
    }
  });

  app.delete("/api/memory/:id", async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId) return res.status(400).json({ error: "userId is required" });
      
      const memory = await Memory.findOne({ _id: req.params.id, userId });
      if (!memory) return res.status(404).json({ error: "Memory not found or unauthorized" });
      
      await Memory.findByIdAndDelete(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete memory" });
    }
  });

  app.post("/api/memory/search", async (req, res) => {
    try {
      const { embedding, limit = 5, type, userId, courseId } = req.body;
      if (!userId) return res.status(400).json({ error: "userId is required" });
      const query: any = { userId };
      if (type) query.type = type;
      if (courseId) query.courseId = courseId;
      else query.courseId = null; // Default to global if not specified
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
      const { userId, courseId } = req.query;
      if (!userId) return res.status(400).json({ error: "userId is required" });
      
      console.log(`GET /api/summary - userId: ${userId}, courseId: ${courseId}`);
      
      const query: any = { userId };
      if (courseId) query.courseId = courseId;
      else query.courseId = null;

      const summary = await Summary.findOne(query).sort({ updated_at: -1 });
      
      if (!summary) {
        console.log(`No summary found for userId: ${userId}, courseId: ${courseId}, returning empty`);
      }
      
      res.json(summary || { content: "" });
    } catch (err) {
      console.error("Failed to fetch summary:", err);
      res.status(500).json({ error: "Failed to fetch summary from database" });
    }
  });

  app.post("/api/summary", async (req, res) => {
    try {
      const { content, userId, courseId } = req.body;
      if (!userId) return res.status(400).json({ error: "userId is required" });
      
      console.log(`POST /api/summary - userId: ${userId}, courseId: ${courseId}, content length: ${content?.length}`);
      
      if (!content && content !== "") {
        return res.status(400).json({ error: "Content is required" });
      }

      // Update existing summary or create new one
      const query: any = { userId };
      if (courseId) query.courseId = courseId;
      else query.courseId = null;

      let summary = await Summary.findOne(query);
      if (summary) {
        summary.content = content;
        summary.updated_at = new Date();
        await summary.save();
      } else {
        summary = new Summary({ content, userId, courseId: courseId || null });
        await summary.save();
      }
      
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
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ error: "userId is required" });
      const session = new MathSession(req.body);
      await session.save();
      res.json(session);
    } catch (err) {
      res.status(500).json({ error: "Failed to create math session" });
    }
  });

  app.get("/api/math/sessions/:id", async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId) return res.status(400).json({ error: "userId is required" });
      const session = await MathSession.findOne({ _id: req.params.id, userId });
      if (!session) return res.status(404).json({ error: "Session not found or unauthorized" });
      res.json(session);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch math session" });
    }
  });

  app.put("/api/math/sessions/:id", async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ error: "userId is required" });
      const session = await MathSession.findOneAndUpdate(
        { _id: req.params.id, userId },
        req.body,
        { new: true }
      );
      if (!session) return res.status(404).json({ error: "Session not found or unauthorized" });
      res.json(session);
    } catch (err) {
      res.status(500).json({ error: "Failed to update math session" });
    }
  });

  app.delete("/api/math/sessions/:id", async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId) return res.status(400).json({ error: "userId is required" });
      const session = await MathSession.findOneAndDelete({ _id: req.params.id, userId });
      if (!session) return res.status(404).json({ error: "Session not found or unauthorized" });
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
