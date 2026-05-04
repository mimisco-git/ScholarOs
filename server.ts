import express from "express";
import path from "path";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createServer as createViteServer } from "vite";
import { initializeApp, getApps } from 'firebase-admin/app';
import { initializeApp as initializeClientApp } from 'firebase/app';
import { 
    getFirestore as getClientFirestore, 
    doc, 
    setDoc, 
    getDoc, 
    updateDoc, 
    collection, 
    query, 
    where, 
    getDocs, 
    addDoc, 
    serverTimestamp, 
    arrayUnion, 
    increment, 
    orderBy, 
    limit,
    Timestamp
} from 'firebase/firestore';
import axios from 'axios';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load Firebase Config
const firebaseConfigPath = path.join(__dirname, 'firebase-applet-config.json');
let firebaseConfig: any = {};
if (fs.existsSync(firebaseConfigPath)) {
  firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
}

// Initialize Firebase Admin
if (getApps().length === 0) {
  initializeApp({
    projectId: firebaseConfig.projectId
  });
}

// Initialize Firebase Client (for Firestore operations)
const clientApp = initializeClientApp(firebaseConfig);
const db = getClientFirestore(clientApp, firebaseConfig.firestoreDatabaseId);

const ADMIN_EMAILS = ['mimisco4life@gmail.com'];

async function startServer() {
  const app = express();
  app.use(express.json());

  const PORT = 3000;

  // Paystack Helper
  const paystack = axios.create({
    baseURL: 'https://api.paystack.co',
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  // Termii Helper
  const termii = axios.create({
    baseURL: 'https://api.ng.termii.com/api',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  // Email Helper (Using SendGrid or SMTP)
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_PORT === '465',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  // --- API Routes ---

  // 1. Registration Endpoint
  app.post("/api/register", async (req, res) => {
    try {
      const { username, email, phone, examCategory } = req.body;
      
      if (!username || !email || !phone || !examCategory) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Check if email already exists
      const usersCol = collection(db, 'users');
      const q = query(usersCol, where('email', '==', email));
      const userSnapshot = await getDocs(q);
      
      if (!userSnapshot.empty) {
        return res.status(400).json({ error: "Email already registered" });
      }

      // Check if username already exists
      const qUsername = query(usersCol, where('username', '==', username));
      const usernameSnapshot = await getDocs(qUsername);

      if (!usernameSnapshot.empty) {
        return res.status(400).json({ error: "Username already taken. Please choose another." });
      }

      const reference_id = crypto.randomBytes(16).toString('hex');

      // Create user document (pending status)
      await setDoc(doc(db, 'users', reference_id), {
        username,
        email,
        phone,
        examCategory,
        payment_status: 'pending',
        purchased_modules: [], // Initialize empty
        reference_id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Initialize Paystack Transaction
      // Note: Real world would use VITE_APP_URL for callback
      const paystackResponse = await paystack.post('/transaction/initialize', {
        email,
        amount: 250000, // Example: 2,500 Naira in kobo
        reference: reference_id,
        callback_url: `${process.env.APP_URL || 'http://localhost:3000'}/dashboard`
      });

      res.json({ 
        authorization_url: paystackResponse.data.data.authorization_url,
        reference: reference_id 
      });

    } catch (error: any) {
      console.error("Registration Error:", error.response?.data || error.message);
      res.status(500).json({ error: "Registration process failed" });
    }
  });

  // 2. Webhook Listener for Paystack
  app.post("/api/webhook/paystack", async (req, res) => {
    const hash = req.headers['x-paystack-signature'];
    const secret = process.env.PAYSTACK_WEBHOOK_SECRET;

    if (!hash || !secret) return res.sendStatus(400);

    const expectedHash = crypto
      .createHmac('sha512', secret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hash !== expectedHash) {
      console.error("Invalid Webhook Signature");
      return res.status(401).send('Invalid signature');
    }

    const { event, data } = req.body;

    if (event === 'charge.success') {
      const reference_id = data.reference;
      const userRef = doc(db, 'users', reference_id);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        // Skip if already active
        if (userData?.payment_status === 'active') {
          return res.sendStatus(200);
        }

        // Generate 6-digit PIN
        const pin = Math.floor(100000 + Math.random() * 900000).toString();
        const hashedPin = await bcrypt.hash(pin, 10);

        // Update User Status & Save Hashed PIN
        await updateDoc(userRef, {
          payment_status: 'active',
          purchased_modules: arrayUnion(userData.examCategory),
          hashedPin,
          updatedAt: serverTimestamp()
        });

        // 1. Send SMS via Termii
        try {
          if (process.env.TERMII_API_KEY) {
            await termii.post('/sms/send', {
              to: userData?.phone,
              from: "ScholarOS",
              sms: `ScholarOS: Access Granted! User: ${userData?.username}, PIN: ${pin}. Do not share this PIN.`,
              type: "plain",
              channel: "dnd",
              api_key: process.env.TERMII_API_KEY
            });
            console.log(`SMS sent to ${userData?.phone}`);
          }
        } catch (smsError: any) {
          console.error("Termii SMS Error:", smsError.response?.data || smsError.message);
        }

        // 2. Send Email via Nodemailer
        try {
          if (process.env.EMAIL_USER) {
            await transporter.sendMail({
              from: '"ScholarOS" <no-reply@scholaros.com>',
              to: userData?.email,
              subject: "ScholarOS - System Access Granted",
              html: `
                <div style="font-family: sans-serif; padding: 20px; color: #333;">
                  <h2>System Access Granted</h2>
                  <p>Hello <b>${userData?.username}</b>,</p>
                  <p>Your payment for ${userData?.examCategory} has been verified.</p>
                  <p>Your unique access PIN is:</p>
                  <div style="background: #f4f4f4; padding: 20px; font-size: 24px; font-weight: bold; text-align: center; border-radius: 10px; margin: 20px 0;">
                    ${pin}
                  </div>
                  <p>Use this PIN along with your username to log into ScholarOS.</p>
                  <p>Good luck with your studies!</p>
                </div>
              `
            });
            console.log(`Email sent to ${userData?.email}`);
          }
        } catch (mailError: any) {
          console.error("Nodemailer Error:", mailError.message);
        }
      }
    }

    res.sendStatus(200);
  });

  // 3. Login Endpoint
  app.post("/api/login", async (req, res) => {
    try {
      const { username, pin } = req.body;

      if (!username || !pin) {
        return res.status(400).json({ error: "Username and PIN are required" });
      }

      // Admin Bypass for Testing
      if (username === 'admin' && pin === '000000') {
        const adminEmail = ADMIN_EMAILS[0];
        // Try to find if user exists with this email
        const qAdmin = query(collection(db, 'users'), where('email', '==', adminEmail));
        const userSnapshot = await getDocs(qAdmin);
        
        if (!userSnapshot.empty) {
          const userDoc = userSnapshot.docs[0];
          const userData = userDoc.data();
          return res.json({ 
            success: true, 
            user: { 
              id: userDoc.id,
              username: userData.username, 
              email: userData.email,
              examCategory: userData.examCategory,
              purchased_modules: ['foundation', 'university', 'professional', 'opportunity'], // Grant all for admin
              xp: userData.xp || 0,
              streak: userData.streak || 0,
              badges: userData.badges || [],
              topicPerformance: userData.topicPerformance || {},
              isAdmin: true
            } 
          });
        } else {
          // Create a temporary mock admin session for testing if user doesn't exist yet
          return res.json({
            success: true,
            user: {
              id: 'admin-test-id',
              username: 'AdminTest',
              email: adminEmail,
              examCategory: 'JAMB UTME',
              purchased_modules: ['foundation', 'university', 'professional', 'opportunity'],
              xp: 5000,
              streak: 99,
              badges: ['centurion', 'streak_5', 'speed_demon'],
              topicPerformance: {},
              isAdmin: true
            }
          });
        }
      }
      
      const qLogin = query(collection(db, 'users'), where('username', '==', username));
      const userSnapshot = await getDocs(qLogin);
      
      if (userSnapshot.empty) {
        return res.status(401).json({ error: "Invalid username or PIN" });
      }

      const userDoc = userSnapshot.docs[0];
      const userData = userDoc.data();

      if (userData.payment_status !== 'active') {
         return res.status(403).json({ error: "Payment pending. Please complete registration." });
      }

      const isMatch = await bcrypt.compare(pin, userData.hashedPin);
      if (!isMatch) {
        return res.status(401).json({ error: "Invalid username or PIN" });
      }

      // Login success - return full profile so frontend analytics work
      res.json({ 
        success: true, 
        user: { 
          id: userDoc.id,
          username: userData.username, 
          email: userData.email,
          examCategory: userData.examCategory,
          purchased_modules: userData.purchased_modules || [],
          xp: userData.xp || 0,
          streak: userData.streak || 0,
          badges: userData.badges || [],
          topicPerformance: userData.topicPerformance || {},
          isAdmin: false
        } 
      });

    } catch (error: any) {
      console.error("Login Error Details:", {
        message: error.message,
        code: error.code,
        stack: error.stack,
        details: error.details
      });
      res.status(500).json({ error: `Internal server error during login: ${error.message}` });
    }
  });

  // 4. Save Results & Update User Stats
  app.post("/api/results", async (req, res) => {
    try {
      const { userId, examType, year, score, total, incorrectQuestions, topicStats } = req.body;
      
      const resultData = {
        userId,
        examType,
        year,
        score,
        total,
        incorrectQuestions,
        timestamp: serverTimestamp()
      };

      const resultRef = await addDoc(collection(db, 'results'), resultData);

      // Update User XP & Performance
      if (userId) {
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          const userData = userDoc.data()!;
          const gainedXP = score * 10; // 10 XP per correct answer
          
          // Streak Logic
          const today = new Date().toISOString().split('T')[0];
          let newStreak = userData.streak || 0;
          if (userData.lastActiveDate !== today) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            if (userData.lastActiveDate === yesterday.toISOString().split('T')[0]) {
              newStreak += 1;
            } else if (!userData.lastActiveDate) {
              newStreak = 1;
            } else {
              newStreak = 1;
            }
          }

          // Topic Performance Logic
          const currentPerformance = userData.topicPerformance || {};
          if (topicStats) {
            Object.keys(topicStats).forEach(topic => {
              const { correct, total: topicTotal } = topicStats[topic];
              const old = currentPerformance[topic] || { correct: 0, total: 0 };
              currentPerformance[topic] = {
                correct: old.correct + correct,
                total: old.total + topicTotal
              };
            });
          }

          // Badges Logic
          const badges = userData.badges || [];
          const currentXP = (userData.xp || 0) + gainedXP;
          
          if (currentXP >= 1000 && !badges.includes('centurion')) badges.push('centurion');
          if (newStreak >= 5 && !badges.includes('streak_5')) badges.push('streak_5');
          
          // Speed Demon: 30 Qs in 15 mins (900s)
          // We'll trust the client for timeTaken for now if provided
          const { timeTaken } = req.body;
          if (total >= 30 && timeTaken <= 900 && !badges.includes('speed_demon')) {
            badges.push('speed_demon');
          }

          await updateDoc(userRef, {
            xp: increment(gainedXP),
            streak: newStreak,
            lastActiveDate: today,
            topicPerformance: currentPerformance,
            badges,
            updatedAt: serverTimestamp()
          });
        }
      }

      res.json({ success: true, resultId: resultRef.id });
    } catch (error: any) {
      console.error("Save Result Error:", error.message);
      res.status(500).json({ error: "Failed to save results" });
    }
  });

  // 4a. Get Leaderboard
  app.get("/api/leaderboard", async (req, res) => {
    try {
      const qLB = query(collection(db, 'users'), orderBy('xp', 'desc'), limit(10));
      const snapshot = await getDocs(qLB);
      
      const leaderboard = snapshot.docs.map(doc => ({
        username: doc.data().username,
        xp: doc.data().xp || 0,
        streak: doc.data().streak || 0
      }));

      res.json({ success: true, leaderboard });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
  });

  // 4b. Get Questions from Firestore
  // Query: GET /api/questions?exam=jamb&subject=Mathematics&year=2020&limit=60
  app.get("/api/questions", async (req, res) => {
    try {
      const { exam, subject, year } = req.query as Record<string, string>;

      if (!exam || !subject || !year) {
        return res.status(400).json({ error: "exam, subject, and year are required" });
      }

      const yearInt = parseInt(year);
      if (isNaN(yearInt)) {
        return res.status(400).json({ error: "year must be a number" });
      }

      const q = query(
        collection(db, 'questions'),
        where('exam', '==', exam.toLowerCase()),
        where('subject', '==', subject),
        where('year', '==', yearInt),
        limit(100)
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        // Return a clear signal so the frontend can show a friendly message
        return res.json({ success: true, questions: [], total: 0, message: "No questions found for this combination yet. Check back soon." });
      }

      const questions = snapshot.docs.map((docSnap, index) => {
        const data = docSnap.data();
        return {
          id: index + 1,
          text: data.text,
          options: data.options,
          correctAnswer: data.correctAnswer,
          explanation: data.explanation,
          topic: data.topic,
          subject: data.subject,
        };
      });

      // Shuffle so different users get different question orders
      const shuffled = questions.sort(() => Math.random() - 0.5);

      res.json({ success: true, questions: shuffled, total: shuffled.length });
    } catch (error: any) {
      console.error("Questions Error:", error.message);
      res.status(500).json({ error: "Failed to fetch questions" });
    }
  });

  // 4c. Get Scholar-Print Questions (personalized by weak topics)
  app.post("/api/scholar-print", async (req, res) => {
    try {
      const { userId, exam, weakTopics } = req.body as { userId: string, exam: string, weakTopics: string[] };

      if (!exam) {
        return res.status(400).json({ error: "exam is required" });
      }

      const questionsRef = collection(db, 'questions');
      const allQuestions: any[] = [];

      // Fetch up to 20 questions from each weak topic
      for (const topic of (weakTopics || []).slice(0, 3)) {
        const topicQ = query(
          questionsRef,
          where('exam', '==', exam.toLowerCase()),
          where('topic', '==', topic),
          limit(20)
        );
        const snap = await getDocs(topicQ);
        snap.docs.forEach((d, i) => {
          allQuestions.push({ id: allQuestions.length + 1, ...d.data() });
        });
      }

      // Fill remaining slots with random questions if not enough
      if (allQuestions.length < 40) {
        const fillQ = query(questionsRef, where('exam', '==', exam.toLowerCase()), limit(60));
        const fillSnap = await getDocs(fillQ);
        fillSnap.docs.forEach(d => {
          if (!allQuestions.find(q => q.alocId === d.data().alocId)) {
            allQuestions.push({ id: allQuestions.length + 1, ...d.data() });
          }
        });
      }

      const shuffled = allQuestions.sort(() => Math.random() - 0.5).slice(0, 60);
      res.json({ success: true, questions: shuffled, total: shuffled.length });

    } catch (error: any) {
      console.error("Scholar-Print Error:", error.message);
      res.status(500).json({ error: "Failed to generate Scholar-Print exam" });
    }
  });

  // 4d. Get Available Years for an exam + subject
  app.get("/api/available-years", async (req, res) => {
    try {
      const { exam, subject } = req.query as Record<string, string>;

      if (!exam || !subject) {
        return res.status(400).json({ error: "exam and subject are required" });
      }

      const q = query(
        collection(db, 'questions'),
        where('exam', '==', exam.toLowerCase()),
        where('subject', '==', subject),
        limit(500)
      );

      const snapshot = await getDocs(q);
      const yearsSet = new Set<number>();
      snapshot.docs.forEach(d => yearsSet.add(d.data().year));

      const years = Array.from(yearsSet).sort((a, b) => b - a); // Latest first
      res.json({ success: true, years });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch available years" });
    }
  });

  // 4b. Get AI Insights
  app.post("/api/insights", async (req, res) => {
    res.status(410).json({ error: "Endpoint deprecated. AI insights are handled client-side." });
  });

  // 5a. Forgot PIN - generates a new PIN and emails it
  app.post("/api/forgot-pin", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: "Email is required" });

      const q = query(collection(db, 'users'), where('email', '==', email));
      const snapshot = await getDocs(q);

      // Always return success to prevent email enumeration attacks
      if (snapshot.empty) {
        return res.json({ success: true, message: "If that email is registered, a new PIN has been sent." });
      }

      const userDoc = snapshot.docs[0];
      const userData = userDoc.data();

      if (userData.payment_status !== 'active') {
        return res.json({ success: true, message: "If that email is registered, a new PIN has been sent." });
      }

      // Generate a fresh 6-digit PIN
      const newPin = Math.floor(100000 + Math.random() * 900000).toString();
      const hashedPin = await bcrypt.hash(newPin, 10);

      await updateDoc(doc(db, 'users', userDoc.id), {
        hashedPin,
        updatedAt: serverTimestamp()
      });

      // Send new PIN via SMS
      try {
        if (process.env.TERMII_API_KEY) {
          await termii.post('/sms/send', {
            to: userData.phone,
            from: "ScholarOS",
            sms: `ScholarOS PIN Reset: Your new login PIN is ${newPin}. Do not share this with anyone.`,
            type: "plain",
            channel: "dnd",
            api_key: process.env.TERMII_API_KEY
          });
        }
      } catch (smsErr) { console.error("SMS error on reset:", smsErr); }

      // Send new PIN via Email
      try {
        if (process.env.EMAIL_USER) {
          await transporter.sendMail({
            from: '"ScholarOS" <no-reply@scholaros.com>',
            to: email,
            subject: "ScholarOS - Your New Login PIN",
            html: `
              <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#020617;color:#fff;border-radius:16px;">
                <h2 style="color:#10b981;margin-bottom:8px;">PIN Reset Request</h2>
                <p style="color:#94a3b8;">Hello <b>${userData.username}</b>,</p>
                <p style="color:#94a3b8;">A new access PIN has been generated for your ScholarOS account.</p>
                <div style="background:#0f172a;border:1px solid #1e293b;border-radius:12px;padding:24px;text-align:center;margin:24px 0;">
                  <div style="font-size:12px;color:#10b981;font-weight:bold;letter-spacing:4px;margin-bottom:8px;">YOUR NEW PIN</div>
                  <div style="font-size:36px;font-weight:900;letter-spacing:12px;color:#fff;font-family:monospace;">${newPin}</div>
                </div>
                <p style="color:#64748b;font-size:12px;">If you did not request this, please contact support immediately. Do not share your PIN with anyone.</p>
              </div>
            `
          });
        }
      } catch (mailErr) { console.error("Mail error on reset:", mailErr); }

      res.json({ success: true, message: "If that email is registered, a new PIN has been sent." });
    } catch (error: any) {
      console.error("Forgot PIN Error:", error.message);
      res.status(500).json({ error: "PIN reset failed. Please try again." });
    }
  });

  // 5b. Update Exam Date for countdown
  app.post("/api/set-exam-date", async (req, res) => {
    try {
      const { userId, examDate, examName } = req.body;
      if (!userId || !examDate) return res.status(400).json({ error: "userId and examDate required" });

      await updateDoc(doc(db, 'users', userId), {
        examDate,
        examName: examName || 'My Exam',
        updatedAt: serverTimestamp()
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to save exam date" });
    }
  });

  // 5c. Save a question to Mistakes Bank
  app.post("/api/mistakes-bank/add", async (req, res) => {
    try {
      const { userId, question } = req.body;
      if (!userId || !question) return res.status(400).json({ error: "userId and question required" });

      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      if (!userDoc.exists()) return res.status(404).json({ error: "User not found" });

      const current = userDoc.data().mistakesBank || [];
      // Prevent duplicates by alocId or question text hash
      const exists = current.some((q: any) => q.text === question.text);
      if (!exists) {
        await updateDoc(userRef, {
          mistakesBank: [...current, { ...question, savedAt: new Date().toISOString() }].slice(-200) // cap at 200
        });
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to save to Mistakes Bank" });
    }
  });

  // 5d. Get Mistakes Bank
  app.get("/api/mistakes-bank", async (req, res) => {
    try {
      const { userId } = req.query as Record<string, string>;
      if (!userId) return res.status(400).json({ error: "userId required" });

      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) return res.status(404).json({ error: "User not found" });

      res.json({ success: true, questions: userDoc.data().mistakesBank || [] });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch Mistakes Bank" });
    }
  });

  // 5e. Admin Stats
  app.get("/api/admin/stats", async (req, res) => {
    try {
      const { adminUsername } = req.query as Record<string, string>;
      if (!adminUsername) return res.status(401).json({ error: "Unauthorized" });

      const adminQ = query(collection(db, 'users'), where('username', '==', adminUsername));
      const adminSnap = await getDocs(adminQ);
      if (adminSnap.empty || !adminSnap.docs[0].data().isAdmin) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Total users
      const usersSnap = await getDocs(collection(db, 'users'));
      const totalUsers = usersSnap.size;
      const activeUsers = usersSnap.docs.filter(d => d.data().payment_status === 'active').length;

      // Total questions
      const qSnap = await getDocs(collection(db, 'questions'));
      const totalQuestions = qSnap.size;

      // Total exams taken
      const resultsSnap = await getDocs(collection(db, 'results'));
      const totalExams = resultsSnap.size;

      // Revenue estimate (active users * 2500 NGN)
      const estimatedRevenue = activeUsers * 2500;

      res.json({
        success: true,
        stats: {
          totalUsers,
          activeUsers,
          pendingUsers: totalUsers - activeUsers,
          totalQuestions,
          totalExams,
          estimatedRevenue,
        }
      });
    } catch (error: any) {
      res.status(500).json({ error: "Admin stats failed" });
    }
  });

  // 5. Verify PIN for Result Decryption
  app.post("/api/verify-pin", async (req, res) => {
    try {
      const { username, pin } = req.body;
      const qPin = query(collection(db, 'users'), where('username', '==', username));
      const userSnapshot = await getDocs(qPin);
      
      if (userSnapshot.empty) return res.status(401).json({ error: "Invalid credentials" });
      
      const userData = userSnapshot.docs[0].data();
      const isMatch = await bcrypt.compare(pin, userData.hashedPin);
      
      res.json({ success: isMatch });
    } catch (error: any) {
      res.status(500).json({ error: "Verification failed" });
    }
  });

  // --- End API Routes ---

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
