import React, { useState, useEffect, useRef } from 'react';
import { 
  Folder, 
  Monitor, 
  Calculator, 
  Layout, 
  Clock, 
  Battery, 
  X, 
  Minus, 
  Square,
  Search,
  MessageSquare,
  Sparkles,
  Award,
  BookOpen,
  ChevronRight,
  User,
  Settings,
  GraduationCap,
  Send,
  BarChart2,
  PieChart,
  HelpCircle,
  TrendingUp,
  Brain,
  Check,
  Lock,
  ChevronLeft,
  Flame,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';

import axios from 'axios';

// --- Types ---
type OSPhase = 'BOOT' | 'LOCK' | 'REGISTRATION' | 'DESKTOP';
type ExamMode = 'STUDY' | 'EXAM';

interface UserData {
  id: string;
  username: string;
  email: string;
  examCategory: string;
  purchased_modules: string[];
  xp: number;
  streak: number;
  badges: string[];
  topicPerformance: Record<string, { correct: number, total: number }>;
  isAdmin?: boolean;
  examDate?: string;       // ISO date string e.g. "2026-06-15"
  examName?: string;       // "JAMB 2026"
  mistakesBank?: Question[];
}

const BADGES = {
  'centurion': { label: 'The Centurion', icon: <Award size={24} />, desc: '1,000 XP Earned', color: 'text-gold-400' },
  'streak_5': { label: 'On Fire', icon: <Flame size={24} />, desc: '5 Day Study Streak', color: 'text-orange-500' },
  'speed_demon': { label: 'Speed Demon', icon: <Zap size={24} />, desc: '30 Qs in 15 Mins', color: 'text-blue-400' }
};

interface Question {
  id: number;
  text: string;
  options: { id: string; text: string }[];
  correctAnswer: string;
  explanation: string;
  topic: string;
  subject: string;
}

interface ExamAttempt {
  examName: string;
  questions: Question[];
}

const SAMPLE_JAMB_QUESTIONS: Question[] = [
  {
    id: 1,
    text: "Find the roots of the quadratic equation 2x² - 5x + 3 = 0.",
    options: [
      { id: 'A', text: 'x = 1, x = 1.5' },
      { id: 'B', text: 'x = -1, x = -1.5' },
      { id: 'C', text: 'x = 2, x = 3' },
      { id: 'D', text: 'x = 0.5, x = 3' }
    ],
    correctAnswer: 'A',
    explanation: "Using the quadratic formula x = [-b ± sqrt(b² - 4ac)] / 2a. Here a=2, b=-5, c=3. D = 25 - 24 = 1. x = (5 ± 1) / 4.",
    topic: "Algebra",
    subject: "Mathematics"
  },
  {
    id: 2,
    text: "If a car travels 120km in 2 hours, what is its average speed in m/s?",
    options: [
      { id: 'A', text: '60 m/s' },
      { id: 'B', text: '16.67 m/s' },
      { id: 'C', text: '33.33 m/s' },
      { id: 'D', text: '20 m/s' }
    ],
    correctAnswer: 'B',
    explanation: "Speed = Distance/Time = 120km/2h = 60km/h. To convert to m/s: (60 * 1000) / 3600 = 16.666...",
    topic: "Physics - Kinematics",
    subject: "Physics"
  },
  {
    id: 3,
    text: "What is the result of log₁₀(100) + log₂(8)?",
    options: [
      { id: 'A', text: '4' },
      { id: 'B', text: '5' },
      { id: 'C', text: '6' },
      { id: 'D', text: '10' }
    ],
    correctAnswer: 'B',
    explanation: "log₁₀(100) = 2 because 10² = 100. log₂(8) = 3 because 2³ = 8. 2 + 3 = 5.",
    topic: "Logarithms",
    subject: "Mathematics"
  },
  {
    id: 4,
    text: "A rectangular tank with dimensions 2m by 3m by 4m is filled with water. What is the pressure at the bottom? (g=10m/s²)",
    options: [
      { id: 'A', text: '40,000 Pa' },
      { id: 'B', text: '20,000 Pa' },
      { id: 'C', text: '10,000 Pa' },
      { id: 'D', text: '120,000 Pa' }
    ],
    correctAnswer: 'A',
    explanation: "Pressure P = ρgh. For water, ρ = 1000kg/m³. Height h = 4m. P = 1000 * 10 * 4 = 40,000 Pa.",
    topic: "Pressure",
    subject: "Physics"
  },
  {
    id: 5,
    text: "Which of the following describes the bonding in Diamond?",
    options: [
      { id: 'A', text: 'Ionic Bonding' },
      { id: 'B', text: 'Covalent Bonding' },
      { id: 'C', text: 'Metallic Bonding' },
      { id: 'D', text: 'Hydrogen Bonding' }
    ],
    correctAnswer: 'B',
    explanation: "Diamond is a giant covalent structure where each carbon atom is bonded to four others.",
    topic: "Chemical Bonding",
    subject: "Chemistry"
  }
];

interface WindowConfig {
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  title: string;
  icon: React.ReactNode;
}

interface ExamEntry {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  startYear: number;
  subjects: string[];
}

interface CategoryFolder {
  id: string;
  label: string;
  color: string;
  items: ExamEntry[];
}

const EDUCATIONAL_CATEGORIES: CategoryFolder[] = [
  {
    id: 'foundation',
    label: 'Foundation Hub',
    color: 'bg-emerald-400',
    items: [
      { id: 'waec', name: 'WAEC WASSCE', description: 'O-Level Certificate', icon: <Monitor />, startYear: 1952, subjects: ['Mathematics', 'English', 'Physics', 'Chemistry', 'Biology', 'Economics'] },
      { id: 'neco', name: 'NECO SSCE', description: 'National School Certificate', icon: <BookOpen />, startYear: 2000, subjects: ['Mathematics', 'English', 'Civic Education', 'Commerce'] },
      { id: 'bece', name: 'BECE (Junior WAEC)', description: 'Junior Secondary Exit', icon: <Award />, startYear: 1980, subjects: ['Basic Science', 'Basic Tech', 'Mathematics'] },
      { id: 'ncee', name: 'Common Entrance', description: 'Federal Unity Entry', icon: <BookOpen />, startYear: 1970, subjects: ['Quantitative', 'Verbal', 'General Science'] },
      { id: 'nbais', name: 'NBAIS SAISSCE', description: 'Arabic & Islamic Studies', icon: <BookOpen />, startYear: 1960, subjects: ['Arabic', 'Islamic Studies', 'English'] },
      { id: 'nabteb', name: 'NABTEB', description: 'Technical & Craft Trades', icon: <Settings />, startYear: 1992, subjects: ['Engineering', 'Building', 'Business'] },
    ]
  },
  {
    id: 'university',
    label: 'University Entry',
    color: 'bg-blue-400',
    items: [
      { id: 'jamb', name: 'JAMB UTME', description: 'Unified Matriculation Exam', icon: <Sparkles />, startYear: 1978, subjects: ['Use of English', 'Mathematics', 'Biology', 'Chemistry', 'Physics', 'Economics', 'Government'] },
      { id: 'post-utme', name: 'Post-UTME Screen', description: 'Institutional Screening', icon: <Search />, startYear: 2005, subjects: ['General Paper', 'Current Affairs'] },
      { id: 'jupeb', name: 'JUPEB / IJMB', description: 'Advanced Level A-Levels', icon: <Award />, startYear: 2013, subjects: ['Physics', 'Chemistry', 'Mathematics', 'Biology'] },
      { id: 'de', name: 'Direct Entry', description: '200 Level Admission', icon: <ChevronRight />, startYear: 1978, subjects: ['Subject A', 'Subject B'] },
    ]
  },
  {
    id: 'professional',
    label: 'Professional',
    color: 'bg-slate-400',
    items: [
      { id: 'ican', name: 'ICAN', description: 'Chartered Accountants', icon: <Calculator />, startYear: 1965, subjects: ['Financial Accounting', 'Taxation', 'Audit', 'Law'] },
      { id: 'law', name: 'Bar Exams', description: 'Nigerian Law School', icon: <Award />, startYear: 1962, subjects: ['Criminal Law', 'Civil Procedure', 'Land Law'] },
      { id: 'trcn', name: 'Teachers TRCN', description: 'Professional Qualifying', icon: <BookOpen />, startYear: 2017, subjects: ['Pedagogy', 'Educational Psych', 'English'] },
      { id: 'mdcn', name: 'MDCN Assessment', description: 'Medical Practitioners', icon: <User />, startYear: 1963, subjects: ['Medicine', 'Surgery', 'Paediatrics'] },
      { id: 'nursing', name: 'NMC Nursing', description: 'Nursing & Midwifery', icon: <BookOpen />, startYear: 1970, subjects: ['Nursing Science', 'Midwifery'] },
    ]
  },
  {
    id: 'opportunity',
    label: 'Opportunity',
    color: 'bg-gold-400',
    items: [
      { id: 'scholarships', name: 'Undergrad Scholarships', description: 'Corporate Foundation Awards', icon: <Sparkles />, startYear: 2000, subjects: ['Logical Reasoning', 'Quantitative', 'Verbal'] },
      { id: 'ptdf', name: 'PTDF / FSB Grants', description: 'Petroleum Tech Fund', icon: <Award />, startYear: 2000, subjects: ['General Paper', 'STEM Aptitude'] },
      { id: 'aptitude', name: 'Job Aptitude Tests', description: 'Bank & Corporate Hiring', icon: <Search />, startYear: 1990, subjects: ['GMAT Style', 'Current Affairs'] },
      { id: 'recruitment', name: 'FCSC / Military', description: 'Civil Service & Force', icon: <User />, startYear: 1960, subjects: ['Current Affairs', 'Verbal Analysis'] },
    ]
  }
];

interface DesktopIconProps {
  key?: React.Key;
  label: string;
  icon: React.ReactNode;
  color: string;
  onClick: () => void;
}

interface WindowProps {
  id: string;
  title: string;
  isOpen: boolean;
  isMinimized?: boolean;
  isMaximized?: boolean;
  onClose: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  children: React.ReactNode;
}

// --- Components ---

const AThinkingAnimation = () => (
  <div className="flex items-center gap-1.5 p-3 bg-white/5 rounded-2xl rounded-tl-none w-fit border border-white/10 shadow-[0_0_15px_rgba(16,185,129,0.05)]">
    <div className="text-[10px] font-black text-emerald-400/60 uppercase tracking-widest mr-2 flex items-center gap-2">
      <Brain size={12} className="animate-pulse" />
      Thinking
    </div>
    <div className="flex gap-1">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          animate={{
            scale: [1, 1.5, 1],
            opacity: [0.3, 1, 0.3],
            backgroundColor: ["#10b981", "#34d399", "#10b981"]
          }}
          transition={{
            duration: 1,
            repeat: Infinity,
            delay: i * 0.2,
            ease: "easeInOut"
          }}
          className="w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]"
        />
      ))}
    </div>
  </div>
);

const SystemActionLoader = ({ label }: { label: string }) => (
  <div className="flex items-center justify-center gap-3">
    <div className="relative w-5 h-5">
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        className="absolute inset-0 border-2 border-white/10 border-t-white rounded-full"
      />
      <motion.div 
        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="absolute inset-0 bg-white/20 blur-md rounded-full"
      />
    </div>
    <span className="animate-pulse">{label}</span>
  </div>
);

const PremiumAccessModal = ({ examId, onClose, onSuccess }: { examId: string, onClose: () => void, onSuccess: (id: string) => void }) => {
  const category = EDUCATIONAL_CATEGORIES.find(c => c.id === examId);
  const price = "₦2,500";
  
  const handlePay = () => {
    // Simulate Paystack Success
    onSuccess(examId);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-gold-400 to-emerald-500" />
        <div className="flex flex-col items-center text-center gap-6">
          <div className="w-20 h-20 bg-gold-400/10 rounded-full flex items-center justify-center text-gold-400 border border-gold-400/20">
            <Award size={40} />
          </div>
          <div>
            <h2 className="text-white text-xl font-black uppercase tracking-tight">Premium Access Required</h2>
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mt-2">{category?.label} Module</p>
          </div>
          <p className="text-white/60 text-xs leading-relaxed">
            The full repository for {category?.label} (O-Level & Unified Standard) is currently locked. Upgrade to the Pro License to access all years and subjects.
          </p>
          <div className="w-full bg-white/5 p-4 rounded-2xl border border-white/5">
            <div className="text-[8px] text-white/40 uppercase font-black tracking-widest mb-1">One-Time License Fee</div>
            <div className="text-2xl text-white font-black tracking-tighter">{price}</div>
          </div>
          <div className="flex flex-col gap-3 w-full">
            <button 
              onClick={handlePay}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20"
            >
              Pay with Paystack
            </button>
            <button 
              onClick={onClose}
              className="w-full py-3 text-white/40 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-all"
            >
              Not Now
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const ModeSelectionModal = ({ examName, onSelect, onClose }: { examName: string, onSelect: (mode: ExamMode) => void, onClose: () => void }) => (
  <motion.div 
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4"
  >
    <motion.div 
      initial={{ scale: 0.9, y: 20 }}
      animate={{ scale: 1, y: 0 }}
      className="w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl p-8 shadow-2xl"
    >
      <div className="flex flex-col items-center text-center gap-8">
        <div>
          <h2 className="text-white text-xl font-black uppercase tracking-tight">Prepare for Success</h2>
          <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mt-2">{examName} - Selective Access</p>
        </div>
        
        <div className="grid grid-cols-2 gap-4 w-full">
          <button 
            onClick={() => onSelect('STUDY')}
            className="flex flex-col items-center gap-4 p-6 bg-white/5 border border-white/10 rounded-2xl hover:bg-emerald-500/10 hover:border-emerald-500/50 transition-all group"
          >
            <div className="p-3 bg-emerald-500/20 rounded-xl text-emerald-400 group-hover:scale-110 transition-transform">
              <Brain size={24} />
            </div>
            <div>
              <div className="text-white text-xs font-black uppercase tracking-widest">Study Mode</div>
              <p className="text-[8px] text-white/40 uppercase font-bold mt-1">AI Guided • No Timer</p>
            </div>
          </button>
          
          <button 
            onClick={() => onSelect('EXAM')}
            className="flex flex-col items-center gap-4 p-6 bg-white/5 border border-white/10 rounded-2xl hover:bg-red-500/10 hover:border-red-500/50 transition-all group"
          >
            <div className="p-3 bg-red-500/20 rounded-xl text-red-400 group-hover:scale-110 transition-transform">
              <Clock size={24} />
            </div>
            <div>
              <div className="text-white text-xs font-black uppercase tracking-widest">Simulated Exam</div>
              <p className="text-[8px] text-white/40 uppercase font-bold mt-1">Locked AI • Countdown</p>
            </div>
          </button>
        </div>

        <button 
          onClick={onClose}
          className="text-white/40 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-all"
        >
          Cancel
        </button>
      </div>
    </motion.div>
  </motion.div>
);

const PerformanceHeatmap = ({ data }: { data: Record<string, { correct: number, total: number }> }) => {
  const chartData = Object.entries(data).map(([topic, stats]) => ({
    topic,
    accuracy: Math.round((stats.correct / stats.total) * 100)
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
          <PolarGrid stroke="#ffffff10" />
          <PolarAngleAxis dataKey="topic" tick={{ fill: '#ffffff40', fontSize: 8 }} />
          <Radar
            name="Accuracy"
            dataKey="accuracy"
            stroke="#10b981"
            fill="#10b981"
            fillOpacity={0.6}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

const ReadinessMeter = ({ percentage }: { percentage: number }) => (
  <div className="flex flex-col items-center gap-4">
    <div className="relative w-32 h-32">
      <svg className="w-full h-full" viewBox="0 0 100 100">
        <circle 
          cx="50" cy="50" r="45" 
          fill="none" 
          stroke="#ffffff05" 
          strokeWidth="8" 
        />
        <motion.circle 
          cx="50" cy="50" r="45" 
          fill="none" 
          stroke="#10b981" 
          strokeWidth="8" 
          strokeDasharray="283"
          initial={{ strokeDashoffset: 283 }}
          animate={{ strokeDashoffset: 283 - (283 * percentage) / 100 }}
          strokeLinecap="round"
          className="drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black text-white tracking-tighter">{percentage}%</span>
        <span className="text-[8px] text-white/40 uppercase font-bold tracking-widest leading-none">Ready</span>
      </div>
    </div>
  </div>
);

const AnalyticsDashboard = ({ user }: { user: UserData | null }) => {
  const [insight, setInsight] = useState("Analyzing performance trajectories...");
  
  useEffect(() => {
    const fetchInsight = async () => {
      if (!user || !user.topicPerformance || Object.keys(user.topicPerformance).length === 0) {
        setInsight("Complete your first exam to unlock AI-powered pedagogical trajectories.");
        return;
      }
      
      try {
        // Find lowest performing topic
        let worstTopic = "";
        let minAccuracy = 1.1;
        Object.keys(user.topicPerformance).forEach(topic => {
          const { correct, total } = user.topicPerformance[topic];
          const accuracy = total > 0 ? correct / total : 1;
          if (accuracy < minAccuracy) {
            minAccuracy = accuracy;
            worstTopic = topic;
          }
        });

        const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
        const response = await ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: `Based on a student's performance data, their weakest topic is "${worstTopic}" with ${Math.round(minAccuracy * 100)}% accuracy. 
          Write a single, encouraging, high-impact study recommendation (max 20 words) for ScholarOS. 
          Focus on a specific pedagogical approach for this topic.`,
          config: {
            systemInstruction: "You are Cerebro, a professional academic analyst. Provide concise, high-impact study recommendations."
          }
        });
        
        setInsight(response.text || "Diagnostic uplink failure. Keep studying.");
      } catch (err) {
        setInsight("Diagnostic uplink failure. Keep studying.");
      }
    };
    fetchInsight();
  }, [user]);

  if (!user) return null;

  const totalCorrect = Object.values(user.topicPerformance || {}).reduce((acc, curr) => acc + curr.correct, 0);
  const totalAttempted = Object.values(user.topicPerformance || {}).reduce((acc, curr) => acc + curr.total, 0);
  const avgAccuracy = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;

  return (
    <div className="flex flex-col h-full bg-[#0a0f1d] overflow-y-auto no-scrollbar p-6 gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white text-xl font-black uppercase tracking-tight">Command Center</h2>
          <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mt-1">Predictive Performance Analytics</p>
        </div>
        <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3">
          <TrendingUp size={16} className="text-emerald-400" />
          <span className="text-white font-black text-xs uppercase tracking-widest">Growth Phase</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white/5 border border-white/5 rounded-3xl p-6 flex flex-col items-center gap-4">
          <span className="text-[10px] text-white/40 font-black uppercase tracking-widest self-start">Readiness Level</span>
          <ReadinessMeter percentage={avgAccuracy} />
        </div>
        <div className="bg-white/5 border border-white/5 rounded-3xl p-6 flex flex-col gap-4">
           <span className="text-[10px] text-white/40 font-black uppercase tracking-widest">Topic Mastery Heatmap</span>
           <PerformanceHeatmap data={user.topicPerformance || {}} />
        </div>
      </div>

      <div className="bg-emerald-500 border border-emerald-400 rounded-3xl p-8 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
          <Brain size={80} />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-md">
              <Zap size={16} className="text-white" />
            </div>
            <span className="text-white text-xs font-black uppercase tracking-widest">Cerebro AI Insights</span>
          </div>
          <p className="text-white text-lg font-black leading-tight max-w-md italic underline decoration-white/20 underline-offset-4">
            "{insight}"
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white/5 border border-white/5 rounded-3xl p-6 flex flex-col gap-2">
          <span className="text-[8px] text-white/40 font-black uppercase tracking-widest">Total XP</span>
          <span className="text-2xl text-white font-black tracking-tighter">{user.xp || 0}</span>
        </div>
        <div className="bg-white/5 border border-white/5 rounded-3xl p-6 flex flex-col gap-2">
          <span className="text-[8px] text-white/40 font-black uppercase tracking-widest">Current Streak</span>
          <div className="flex items-center gap-2">
            <span className="text-2xl text-white font-black tracking-tighter">{user.streak || 0}</span>
            <Flame size={20} className="text-orange-500" />
          </div>
        </div>
        <div className="bg-white/5 border border-white/5 rounded-3xl p-6 flex flex-col gap-2">
          <span className="text-[8px] text-white/40 font-black uppercase tracking-widest">Badges Earned</span>
          <span className="text-2xl text-white font-black tracking-tighter">{user.badges?.length || 0}</span>
        </div>
      </div>

      <PredictedScore user={user} examCategory={user?.examCategory || 'JAMB UTME'} />

      <div className="flex flex-col gap-6">
        <div>
          <h3 className="text-white text-xs font-black uppercase tracking-widest mb-4">Trophy Cabinet</h3>
          <div className="grid grid-cols-3 gap-4">
            {Object.entries(BADGES).map(([id, badge]) => {
              const isEarned = user.badges?.includes(id);
              return (
                <div 
                  key={id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col gap-3 ${
                    isEarned 
                      ? 'bg-white/5 border-emerald-500/30' 
                      : 'bg-black/20 border-white/5 opacity-40 grayscale'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isEarned ? badge.color + ' bg-white/5' : 'text-white/20'}`}>
                    {badge.icon}
                  </div>
                  <div>
                    <div className={`text-[10px] font-black uppercase tracking-tight ${isEarned ? 'text-white' : 'text-white/40'}`}>{badge.label}</div>
                    <div className="text-[8px] text-white/20 uppercase font-bold tracking-widest mt-0.5">{badge.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

const LeaderboardWindow = () => {
  const [data, setData] = useState<{username: string, xp: number, streak: number}[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await axios.get('/api/leaderboard');
        setData(res.data.leaderboard);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  return (
    <div className="flex flex-col h-full bg-[#0a0f1d] no-scrollbar p-0">
      <div className="p-8 border-b border-white/5 flex items-center justify-between">
        <div>
          <h2 className="text-white text-xl font-black uppercase tracking-tight">Global Ranks</h2>
          <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mt-1">O-Level Standardized Rankings</p>
        </div>
        <Award size={32} className="text-gold-400" />
      </div>
      <div className="flex-1 overflow-y-auto no-scrollbar p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full text-white/20 uppercase font-black tracking-widest">Synchronizing...</div>
        ) : (
          <div className="flex flex-col gap-2">
            {data.map((entry, i) => (
              <div key={i} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${i === 0 ? 'bg-gold-400/10 border-gold-400/20' : 'bg-white/5 border-white/5'}`}>
                <div className="flex items-center gap-6">
                  <span className={`text-sm font-black w-6 ${i === 0 ? 'text-gold-400' : 'text-white/40'}`}>#{i + 1}</span>
                  <div className="flex flex-col">
                    <span className="text-white text-sm font-black uppercase tracking-tight">{entry.username}</span>
                    <div className="flex items-center gap-3">
                       <span className="text-[10px] text-white/40 font-bold">{entry.xp} XP Earned</span>
                       <div className="flex items-center gap-1">
                          <Flame size={10} className="text-orange-500" />
                          <span className="text-[10px] text-white/40 font-bold">{entry.streak}</span>
                       </div>
                    </div>
                  </div>
                </div>
                {i === 0 && <Award size={16} className="text-gold-400" />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
// ============================================================
// PREMIUM COMPONENT: Sound Engine
// ============================================================
const SoundEngine = {
  ctx: null as AudioContext | null,
  getCtx() {
    if (!this.ctx) this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    return this.ctx;
  },
  play(type: 'correct' | 'wrong' | 'click' | 'boot' | 'unlock') {
    try {
      const ctx = this.getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const configs = {
        correct: { freq: [523, 659, 784], dur: 0.12, vol: 0.18, wave: 'sine' as OscillatorType },
        wrong:   { freq: [220, 180],      dur: 0.18, vol: 0.12, wave: 'sawtooth' as OscillatorType },
        click:   { freq: [800],            dur: 0.04, vol: 0.06, wave: 'sine' as OscillatorType },
        boot:    { freq: [220, 440, 880],  dur: 0.2,  vol: 0.1,  wave: 'sine' as OscillatorType },
        unlock:  { freq: [523, 659, 784, 1046], dur: 0.15, vol: 0.15, wave: 'sine' as OscillatorType },
      };

      const cfg = configs[type];
      osc.type = cfg.wave;
      gain.gain.setValueAtTime(cfg.vol, ctx.currentTime);

      cfg.freq.forEach((f, i) => {
        osc.frequency.setValueAtTime(f, ctx.currentTime + i * cfg.dur);
      });

      const totalDur = cfg.freq.length * cfg.dur;
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + totalDur + 0.1);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + totalDur + 0.1);
    } catch {}
  }
};

// ============================================================
// PREMIUM COMPONENT: Exam Countdown Widget
// ============================================================
const ExamCountdownWidget = ({ user, onSetDate }: { user: UserData | null, onSetDate: () => void }) => {
  const [daysLeft, setDaysLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!user?.examDate) return;
    const exam = new Date(user.examDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.ceil((exam.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    setDaysLeft(diff);
  }, [user?.examDate]);

  if (!user?.examDate || daysLeft === null) {
    return (
      <motion.div
        whileHover={{ y: -3 }}
        onClick={onSetDate}
        className="flex flex-col items-center gap-2 w-24 select-none cursor-pointer group"
      >
        <div className="relative w-16 h-16 flex items-center justify-center rounded-2xl bg-white/5 backdrop-blur-md border border-dashed border-white/20 hover:border-emerald-400/50 transition-all">
          <Clock size={24} className="text-white/30 group-hover:text-emerald-400 transition-colors" />
        </div>
        <span className="text-white/40 text-[10px] font-medium tracking-wide text-center group-hover:text-white/60 transition-colors">Set Exam Date</span>
      </motion.div>
    );
  }

  const urgency = daysLeft <= 7 ? 'text-red-400 border-red-500/40 bg-red-500/10' :
                  daysLeft <= 30 ? 'text-amber-400 border-amber-500/40 bg-amber-500/10' :
                  'text-emerald-400 border-emerald-500/40 bg-emerald-500/10';

  return (
    <motion.div whileHover={{ y: -3 }} onClick={onSetDate} className="flex flex-col items-center gap-2 w-24 select-none cursor-pointer">
      <div className={`relative w-16 h-16 flex flex-col items-center justify-center rounded-2xl border backdrop-blur-md ${urgency} transition-all`}>
        {daysLeft <= 0 ? (
          <span className="text-[8px] font-black text-center leading-tight">EXAM DAY!</span>
        ) : (
          <>
            <span className="text-lg font-black leading-none">{daysLeft}</span>
            <span className="text-[7px] font-black uppercase tracking-widest opacity-60">days</span>
          </>
        )}
        {daysLeft <= 7 && daysLeft > 0 && (
          <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}
            className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-slate-900" />
        )}
      </div>
      <span className="text-white text-[9px] font-medium tracking-wide text-center leading-tight">
        {user.examName || 'My Exam'}
      </span>
    </motion.div>
  );
};

// ============================================================
// PREMIUM COMPONENT: Set Exam Date Modal
// ============================================================
const SetExamDateModal = ({ user, onClose, onSave }: { user: UserData | null, onClose: () => void, onSave: (date: string, name: string) => void }) => {
  const [examDate, setExamDate] = useState(user?.examDate || '');
  const [examName, setExamName] = useState(user?.examName || 'JAMB 2026');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!examDate || !user) return;
    setSaving(true);
    try {
      await axios.post('/api/set-exam-date', { userId: user.id, examDate, examName });
      onSave(examDate, examName);
      SoundEngine.play('unlock');
    } catch {}
    setSaving(false);
    onClose();
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
        className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-3xl p-8 shadow-2xl">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500/20 rounded-2xl"><Clock size={24} className="text-emerald-400" /></div>
            <div>
              <h2 className="text-white font-black uppercase tracking-tight">Set Exam Date</h2>
              <p className="text-white/40 text-[10px] uppercase font-bold tracking-widest mt-1">Activate Countdown Timer</p>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Exam Name</label>
            <select value={examName} onChange={e => setExamName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 transition-all">
              {['JAMB UTME 2026','WAEC WASSCE 2026','NECO SSCE 2026','ICAN Diet 2026','Bar Finals 2026','Post-UTME 2026'].map(n => (
                <option key={n} className="bg-slate-900" value={n}>{n}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Exam Date</label>
            <input type="date" min={today} value={examDate} onChange={e => setExamDate(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 transition-all" />
          </div>

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-3 bg-white/5 border border-white/10 text-white/60 rounded-xl font-black uppercase text-[10px] tracking-widest">Cancel</button>
            <button onClick={handleSave} disabled={!examDate || saving}
              className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-black uppercase text-[10px] tracking-widest disabled:opacity-50 transition-all">
              {saving ? 'Saving...' : 'Activate'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ============================================================
// PREMIUM COMPONENT: Forgot PIN Modal
// ============================================================
const ForgotPinModal = ({ onClose }: { onClose: () => void }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!email) return;
    setLoading(true);
    setError('');
    try {
      await axios.post('/api/forgot-pin', { email });
      setSent(true);
      SoundEngine.play('unlock');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Request failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
        className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-3xl p-8 shadow-2xl">
        {sent ? (
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center border border-emerald-500/30">
              <Check size={32} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-white font-black uppercase tracking-tight">Check Your Phone</h2>
              <p className="text-white/40 text-xs mt-2 leading-relaxed">If that email is registered, your new PIN has been sent via SMS and email. Check both.</p>
            </div>
            <button onClick={onClose} className="w-full py-3 bg-emerald-500 text-white rounded-xl font-black uppercase text-[10px] tracking-widest">Back to Login</button>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="text-white font-black uppercase tracking-tight">Reset PIN</h2>
              <p className="text-white/40 text-xs mt-1">Enter your registered email and we will send a new PIN to your phone and inbox.</p>
            </div>
            <input type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && handleSubmit()}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50 transition-all font-mono" />
            {error && <div className="text-red-400 text-[10px] font-bold text-center">{error}</div>}
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-3 bg-white/5 border border-white/10 text-white/60 rounded-xl font-black uppercase text-[10px] tracking-widest">Cancel</button>
              <button onClick={handleSubmit} disabled={!email || loading}
                className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-black uppercase text-[10px] tracking-widest disabled:opacity-50 transition-all">
                {loading ? 'Sending...' : 'Send New PIN'}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

// ============================================================
// PREMIUM COMPONENT: Mistakes Bank Window
// ============================================================
const MistakesBankWindow = ({ user, onStartReview }: { user: UserData | null, onStartReview: (questions: Question[]) => void }) => {
  const [mistakes, setMistakes] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    axios.get('/api/mistakes-bank', { params: { userId: user.id } })
      .then(res => setMistakes(res.data.questions || []))
      .catch(() => setMistakes([]))
      .finally(() => setLoading(false));
  }, [user?.id]);

  return (
    <div className="flex flex-col h-full bg-[#0a0f1d]">
      <div className="p-6 border-b border-white/5 flex items-center justify-between">
        <div>
          <h2 className="text-white text-xl font-black uppercase tracking-tight">Mistakes Bank</h2>
          <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mt-1">{mistakes.length} Saved Questions for Revision</p>
        </div>
        {mistakes.length > 0 && (
          <button onClick={() => onStartReview(mistakes)}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white text-[10px] font-black uppercase rounded-xl tracking-widest transition-all shadow-lg shadow-emerald-500/20">
            Start Revision
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar p-4">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-white/20 text-xs uppercase font-black tracking-widest animate-pulse">Loading Bank...</div>
        ) : mistakes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
            <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center"><BookOpen size={32} className="text-white/20" /></div>
            <div>
              <div className="text-white/40 font-black uppercase text-sm tracking-wide">Bank is Empty</div>
              <p className="text-white/20 text-[10px] mt-2">Questions you get wrong during exams are automatically saved here for revision.</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {mistakes.map((q, i) => (
              <div key={i} className="bg-white/5 border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-all">
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-[8px] font-black rounded uppercase">{q.topic}</span>
                  <span className="text-white/20 text-[8px]">{q.subject}</span>
                </div>
                <p className="text-white/80 text-sm leading-relaxed mb-3">{q.text}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-white/30 uppercase font-bold">Answer:</span>
                  <span className="text-emerald-400 text-[10px] font-black">{q.correctAnswer}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================
// PREMIUM COMPONENT: Admin Dashboard
// ============================================================
const AdminDashboard = ({ user }: { user: UserData | null }) => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.isAdmin) return;
    axios.get('/api/admin/stats', { params: { adminUsername: user.username } })
      .then(res => setStats(res.data.stats))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  if (!user?.isAdmin) return (
    <div className="flex items-center justify-center h-full">
      <p className="text-white/20 font-black uppercase text-sm tracking-widest">Access Denied</p>
    </div>
  );

  const statCards = stats ? [
    { label: 'Total Users', value: stats.totalUsers, color: 'text-blue-400', sub: `${stats.pendingUsers} pending payment` },
    { label: 'Active Licenses', value: stats.activeUsers, color: 'text-emerald-400', sub: 'Paid accounts' },
    { label: 'Questions in DB', value: stats.totalQuestions?.toLocaleString(), color: 'text-amber-400', sub: 'Across all exams' },
    { label: 'Exams Taken', value: stats.totalExams, color: 'text-purple-400', sub: 'Total sessions' },
    { label: 'Est. Revenue', value: `₦${stats.estimatedRevenue?.toLocaleString()}`, color: 'text-gold-400', sub: 'Lifetime estimate' },
  ] : [];

  return (
    <div className="flex flex-col h-full bg-[#0a0f1d] overflow-y-auto no-scrollbar p-8 gap-8">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-red-500/20 rounded-2xl border border-red-500/30"><Layout size={24} className="text-red-400" /></div>
        <div>
          <h2 className="text-white text-xl font-black uppercase tracking-tight">System Administration</h2>
          <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mt-1">Root Access - ScholarOS Backend</p>
        </div>
      </div>

      {loading ? (
        <div className="text-white/20 text-xs uppercase font-black tracking-widest animate-pulse">Fetching system metrics...</div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {statCards.map((card, i) => (
            <div key={i} className="bg-white/5 border border-white/5 rounded-3xl p-6 flex flex-col gap-2">
              <span className="text-[9px] text-white/30 font-black uppercase tracking-widest">{card.label}</span>
              <span className={`text-3xl font-black tracking-tighter ${card.color}`}>{card.value ?? '...'}</span>
              <span className="text-[9px] text-white/20 font-medium">{card.sub}</span>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white/5 border border-white/5 rounded-3xl p-6">
        <h3 className="text-white text-[10px] font-black uppercase tracking-widest mb-4 border-l-2 border-red-500 pl-3">Admin Credentials</h3>
        <div className="grid grid-cols-2 gap-3 text-[11px]">
          {[
            ['Admin Login', 'username: admin, PIN: 000000'],
            ['Firebase', 'Firestore (Client SDK)'],
            ['Payment', 'Paystack API'],
            ['SMS', 'Termii Nigeria'],
          ].map(([k, v]) => (
            <div key={k} className="bg-white/5 rounded-xl p-3">
              <div className="text-white/30 uppercase font-black text-[8px] tracking-widest mb-1">{k}</div>
              <div className="text-white/70 font-mono">{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================
// PREMIUM COMPONENT: Predicted Score
// ============================================================
const PredictedScore = ({ user, examCategory }: { user: UserData | null, examCategory: string }) => {
  const examMaxScores: Record<string, number> = {
    'JAMB UTME': 400, 'WAEC WASSCE': 9, 'NECO SSCE': 9,
    'ICAN': 100, 'Bar Exams': 100,
  };

  const maxScore = examMaxScores[examCategory] || 400;
  const totalCorrect = Object.values(user?.topicPerformance || {}).reduce((a, b) => a + b.correct, 0);
  const totalAttempted = Object.values(user?.topicPerformance || {}).reduce((a, b) => a + b.total, 0);
  const accuracy = totalAttempted > 0 ? totalCorrect / totalAttempted : 0;
  const predicted = Math.round(accuracy * maxScore);
  const confidence = Math.min(Math.round((totalAttempted / 200) * 100), 95);

  if (totalAttempted < 10) return null;

  return (
    <div className="bg-blue-500/10 border border-blue-500/20 rounded-3xl p-6 flex items-center gap-6">
      <div className="flex flex-col items-center gap-1">
        <span className="text-[9px] text-white/40 font-black uppercase tracking-widest">Predicted Score</span>
        <span className="text-4xl font-black text-blue-400 tracking-tighter">{predicted}</span>
        <span className="text-[9px] text-white/20 font-bold">out of {maxScore}</span>
      </div>
      <div className="flex-1 flex flex-col gap-2">
        <div className="flex justify-between text-[9px]">
          <span className="text-white/40 font-black uppercase">Confidence Level</span>
          <span className="text-blue-400 font-black">{confidence}%</span>
        </div>
        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: `${confidence}%` }}
            className="h-full bg-blue-500 rounded-full" />
        </div>
        <p className="text-[9px] text-white/30 leading-relaxed">
          Based on {totalAttempted} questions practiced. Answer more questions to improve prediction accuracy.
        </p>
      </div>
    </div>
  );
};

// ============================================================
// PREMIUM COMPONENT: WhatsApp Score Share
// ============================================================
const WhatsAppShare = ({ username, score, total, examName }: { username: string, score: number, total: number, examName: string }) => {
  const percent = ((score / total) * 100).toFixed(1);
  const emoji = parseFloat(percent) >= 80 ? '🎉' : parseFloat(percent) >= 60 ? '💪' : '📚';
  const message = `${emoji} I just scored ${score}/${total} (${percent}%) on ${examName} using ScholarOS! The AI-powered Nigerian exam prep system is 🔥. Try it at scholaros.ng`;

  const handleShare = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    SoundEngine.play('click');
  };

  return (
    <button onClick={handleShare}
      className="flex items-center gap-3 px-5 py-3 bg-[#25D366]/20 border border-[#25D366]/30 text-[#25D366] rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-[#25D366]/30 transition-all">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
      Share on WhatsApp
    </button>
  );
};

const BOOT_MESSAGES = [
  "[  OK  ] Initializing Scholar OS Kernel v5.0.4...",
  "[  OK  ] Mounting Educational Repositories...",
  "[  OK  ] Loading Scholar Database (500,000+ Questions)...",
  "[  OK  ] Loading Scholar OS Kernel v5.0.4 AI-Tutor-v2...",
  "[  OK  ] Syncing WAEC/O-Levels syllabus modules...",
  "[  OK  ] Initializing AI Tutor Neural Engine...",
  "[  OK  ] Establishing secure encrypted tunnel to Fed. Ministry...",
  "[  OK  ] Calibrating Exam Integrity Monitors...",
  "System Ready. Initializing User Environment..."
];

const BootScreen = ({ onComplete }: { onComplete: () => void }) => {
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    let current = 0;
    let timeoutId: number;
    
    const interval = setInterval(() => {
      if (current < BOOT_MESSAGES.length) {
        setLogs(prev => [...prev, BOOT_MESSAGES[current]]);
        current++;
      } else {
        clearInterval(interval);
        timeoutId = window.setTimeout(onComplete, 1000);
      }
    }, 400);

    return () => {
      clearInterval(interval);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center font-mono p-8 z-[200]">
      <div className="w-full max-w-2xl">
        {logs.map((log, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className={`mb-1 text-sm ${log?.includes('OK') ? 'text-emerald-500' : 'text-emerald-400 font-bold'}`}
          >
            {log}
          </motion.div>
        ))}
        <motion.div 
          animate={{ opacity: [0, 1] }} 
          transition={{ repeat: Infinity, duration: 0.8 }}
          className="w-2 h-5 bg-emerald-500 inline-block mt-2"
        />
      </div>
    </div>
  );
};

const RegistrationScreen = ({ 
  onBack, 
  onSuccess 
}: { 
  onBack: () => void, 
  onSuccess: (authUrl: string) => void 
}) => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    phone: '',
    examCategory: 'JAMB UTME'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await axios.post('/api/register', formData);
      onSuccess(response.data.authorization_url);
    } catch (err: any) {
      setError(err.response?.data?.error || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[160] overflow-hidden bg-slate-950">
      <div className="absolute inset-0">
        <div className="absolute top-[-10%] left-[-5%] w-[60%] h-[60%] bg-blue-600/10 blur-[150px] rounded-full" />
        <div className="absolute bottom-[-5%] right-[-5%] w-[40%] h-[40%] bg-emerald-600/10 blur-[150px] rounded-full" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl"
      >
        <div className="flex flex-col items-center gap-6 mb-8">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
             <User size={32} />
          </div>
          <div className="text-center">
            <h2 className="text-white text-2xl font-black uppercase tracking-tight">System Registration</h2>
            <p className="text-white/40 text-xs font-bold uppercase tracking-widest mt-1">Join ScholarOS Educational Network</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Preferred Username</label>
            <input 
              required
              placeholder="e.g. jdoe_scholar"
              value={formData.username}
              onChange={(e) => setFormData({...formData, username: e.target.value})}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/10 focus:outline-none focus:border-emerald-500/50 transition-all font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Email Address</label>
            <input 
              required
              type="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/10 focus:outline-none focus:border-emerald-500/50 transition-all font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Phone Number (For PIN SMS)</label>
            <input 
              required
              placeholder="2348030000000"
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/10 focus:outline-none focus:border-emerald-500/50 transition-all font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Exam Category</label>
            <select 
              value={formData.examCategory}
              onChange={(e) => setFormData({...formData, examCategory: e.target.value})}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 transition-all"
            >
              <option className="bg-slate-900" value="JAMB UTME">JAMB UTME</option>
              <option className="bg-slate-900" value="WAEC WASSCE">WAEC WASSCE</option>
              <option className="bg-slate-900" value="NECO SSCE">NECO SSCE</option>
              <option className="bg-slate-900" value="ICAN">ICAN Professional</option>
            </select>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-[10px] font-bold text-center">
              {error}
            </div>
          )}

          <div className="pt-4 flex flex-col gap-3">
            <button 
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 overflow-hidden relative"
            >
              {loading ? (
                <SystemActionLoader label="Initializing Secure Payment..." />
              ) : (
                'Register & Pay Access Fee'
              )}
              {loading && (
                <motion.div 
                  initial={{ x: '-100%' }}
                  animate={{ x: '200%' }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"
                />
              )}
            </button>
            <button 
              type="button"
              onClick={onBack}
              className="w-full py-3 text-white/40 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-all"
            >
              Cancel & Return to Login
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const LockScreen = ({ 
  onLogin, 
  onRegister,
  onForgotPin
}: { 
  onLogin: (username: string, pin: string) => Promise<boolean>, 
  onRegister: () => void,
  onForgotPin: () => void
}) => {
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const handleLogin = async () => {
    if (!username || !pin) return;
    setLoading(true);
    setError("");
    try {
      const success = await onLogin(username, pin);
      if (!success) {
        setError("System Access Denied: Invalid Credentials");
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "System Authorization Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[150] overflow-hidden bg-slate-950">
      <div className="absolute inset-0">
        <div className="absolute top-[-10%] left-[-5%] w-[60%] h-[60%] bg-emerald-600/10 blur-[150px] rounded-full" />
        <div className="absolute bottom-[-5%] right-[-5%] w-[40%] h-[40%] bg-blue-600/10 blur-[150px] rounded-full" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 flex flex-col items-center gap-8 w-full max-w-sm"
      >
        <div className="relative group">
          <div className="w-32 h-32 rounded-full border-2 border-white/20 p-1 bg-white/5 backdrop-blur-xl group-hover:border-emerald-500/50 transition-colors">
            <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center overflow-hidden">
               <User size={64} className="text-white/20" />
            </div>
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-emerald-500 rounded-full text-[10px] font-black text-white uppercase tracking-widest shadow-lg shadow-emerald-500/20">
            Secure Access
          </div>
        </div>

        <div className="flex flex-col items-center gap-2 text-center px-4">
          <h1 className="text-white text-2xl font-black uppercase tracking-tight">System Login</h1>
          <p className="text-white/40 text-sm font-medium">Please authorize your study session</p>
        </div>

        <div className="flex flex-col gap-4 w-full px-8">
          <div className="space-y-1">
             <input 
              type="text" 
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-center text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50 transition-all font-mono"
            />
          </div>
          <div className="space-y-1">
            <input 
              type="password" 
              placeholder="6-Digit PIN"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-center text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50 transition-all font-mono tracking-[0.5em]"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-[10px] font-bold text-center animate-shake">
              {error}
            </div>
          )}

          <button 
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-black uppercase tracking-[0.2em] transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50 relative overflow-hidden"
          >
            {loading ? (
              <SystemActionLoader label="Authorizing..." />
            ) : (
              'Unlock System'
            )}
            {loading && (
              <motion.div 
                initial={{ x: '-100%' }}
                animate={{ x: '200%' }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"
              />
            )}
          </button>
          
          <div className="flex items-center gap-4 py-2">
            <div className="flex-1 h-[1px] bg-white/10" />
            <span className="text-[10px] font-black text-white/20">OR</span>
            <div className="flex-1 h-[1px] bg-white/10" />
          </div>

          <button 
            onClick={onRegister}
            className="w-full py-3 bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white rounded-xl font-black uppercase tracking-widest text-[10px] transition-all"
          >
            Create New Account
          </button>
        </div>

        <div className="flex items-center gap-8 mt-4 text-white/30">
          <button className="flex flex-col items-center gap-2 hover:text-white/60 transition-colors">
            <Settings size={20} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Settings</span>
          </button>
          <button onClick={onForgotPin} className="flex flex-col items-center gap-2 hover:text-red-400/60 transition-colors">
             <HelpCircle size={20} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Forgot PIN?</span>
          </button>
        </div>
      </motion.div>

      {/* Clock overlay */}
      <div className="absolute top-12 left-12 text-white/40 flex flex-col pointer-events-none">
          <span className="text-6xl font-black text-white tracking-tighter">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
          </span>
          <span className="text-sm font-bold uppercase tracking-[0.2em] mt-2 border-l-2 border-emerald-500 pl-4 ml-1">
            {new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
      </div>
    </div>
  );
};

const GlassIcon = ({ icon, color }: { icon: React.ReactNode, color: string }) => (
  <div className={`relative group w-16 h-16 flex items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-xl transition-all duration-300 hover:scale-110 hover:bg-white/20 cursor-pointer`}>
    <div className={`absolute inset-0 blur-xl opacity-20 group-hover:opacity-40 transition-opacity rounded-2xl ${color}`} />
    <div className="relative z-10 text-white shadow-sm">
      {React.cloneElement(icon as React.ReactElement<any>, { size: 32 })}
    </div>
  </div>
);

const DesktopIcon = ({ label, icon, color, isLocked, onClick }: DesktopIconProps & { isLocked?: boolean }) => (
  <motion.div 
    whileHover={{ y: -5 }}
    onClick={onClick}
    className="flex flex-col items-center gap-2 w-24 select-none relative group"
  >
    <GlassIcon icon={icon} color={color} />
    {isLocked && (
      <div className="absolute top-0 right-4 p-1 bg-slate-900 border border-white/10 rounded-lg text-gold-400 shadow-xl z-20">
        <Lock size={12} />
      </div>
    )}
    <span className="text-white text-xs font-medium tracking-wide drop-shadow-md text-center">
      {label}
    </span>
  </motion.div>
);

const OSWindow = ({ id, title, isOpen, isMinimized, isMaximized, onClose, onMinimize, onMaximize, children }: WindowProps) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const handleDownload = () => {
    setIsDownloading(true);
    let prog = 0;
    const interval = setInterval(() => {
      prog += 5;
      setDownloadProgress(prog);
      if (prog >= 100) {
        clearInterval(interval);
        setTimeout(() => setIsDownloading(false), 500);
      }
    }, 50);
  };

  if (!isOpen || isMinimized) return null;

  return (
    <motion.div
      drag={!isMaximized}
      dragMomentum={false}
      initial={isMaximized ? { scale: 1, opacity: 1, top: 0, left: 0, width: '100%', height: 'calc(100% - 64px)' } : { scale: 0.9, opacity: 0, y: 20 }}
      animate={isMaximized ? { 
        top: 0, 
        left: 0, 
        width: '100%', 
        height: 'calc(100% - 64px)',
        x: 0,
        y: 0,
        borderRadius: 0 
      } : { 
        scale: 1, 
        opacity: 1, 
        y: 0,
        width: 900,
        height: 600,
        borderRadius: 16
      }}
      exit={{ scale: 0.9, opacity: 0, y: 20 }}
      className={`fixed bg-slate-900/60 backdrop-blur-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col z-50 ${isMaximized ? '' : 'top-20 left-1/2 -translate-x-1/2'}`}
      style={!isMaximized ? { x: '-50%' } : {}}
    >
      {/* Window Header */}
      <div className="h-10 bg-white/5 border-b border-white/5 px-4 flex items-center justify-between select-none cursor-grab active:cursor-grabbing">
        <div className="flex items-center gap-2">
          <BookOpen size={14} className="text-emerald-400" />
          <span className="text-white/80 text-xs font-semibold tracking-tight uppercase line-clamp-1">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          {id === 'exam' && (
            <button 
              onClick={handleDownload}
              disabled={isDownloading}
              className="mr-2 px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase rounded border border-emerald-500/20 transition-all flex items-center gap-2 overflow-hidden relative"
            >
              {isDownloading ? (
                <div className="flex items-center gap-2">
                  <div className="w-[40px] h-[4px] bg-emerald-500/20 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${downloadProgress}%` }}
                      className="h-full bg-emerald-500"
                    />
                  </div>
                  <span>{downloadProgress}%</span>
                </div>
              ) : (
                <>
                  <Battery size={10} className="text-emerald-400 rotate-90" />
                  <span>Download for Offline</span>
                </>
              )}
            </button>
          )}
          <button onClick={onMinimize} className="text-white/40 hover:text-white transition-colors p-1"><Minus size={14} /></button>
          <button onClick={onMaximize} className="text-white/40 hover:text-white transition-colors p-1"><Square size={12} /></button>
          <button onClick={onClose} className="text-white/40 hover:text-red-400 transition-colors p-1"><X size={16} /></button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        {children}
      </div>
    </motion.div>
  );
};

const ResultCertificate = ({ user, score, total, examName }: { user: UserData | null, score: number, total: number, examName: string }) => (
  <div className="flex flex-col items-center justify-center p-12 bg-white text-slate-900 border-[16px] border-slate-900 shadow-2xl relative h-full">
    <div className="absolute top-8 left-8 right-8 bottom-8 border border-slate-200 pointer-events-none" />
    <div className="flex flex-col items-center gap-4 mb-8">
      <GraduationCap size={48} className="text-slate-900" />
      <h1 className="text-4xl font-black uppercase tracking-widest text-center">Certificate of Performance</h1>
      <p className="text-slate-500 text-sm italic">Awarded by ScholarOS Educational Network</p>
    </div>
    
    <div className="w-full max-w-md border-t-2 border-slate-900 pt-8 flex flex-col items-center text-center gap-6">
      <div>
        <p className="text-slate-400 uppercase text-[10px] font-black tracking-widest mb-2">This certifies that</p>
        <h2 className="text-3xl font-black text-emerald-600 uppercase tracking-tight">{user?.username}</h2>
      </div>
      
      <div>
        <p className="text-slate-400 uppercase text-[10px] font-black tracking-widest mb-2">Has completed the</p>
        <h3 className="text-xl font-bold uppercase">{examName}</h3>
      </div>

      <div className="flex flex-col items-center">
        <p className="text-slate-400 uppercase text-[10px] font-black tracking-widest mb-4">With a total score of</p>
        <div className="text-6xl font-black text-slate-900 tracking-tighter">
          {score} <span className="text-2xl text-slate-300">/ {total}</span>
        </div>
        <div className="mt-4 px-6 py-2 bg-slate-900 text-white font-black uppercase tracking-widest text-sm">
          {((score/total)*100).toFixed(1)}% Performance Rating
        </div>
      </div>
    </div>

    <div className="mt-auto w-full flex flex-col gap-6 pt-12">
      <div className="flex justify-between items-end">
        <div className="flex flex-col items-center">
          <div className="w-32 h-[1px] bg-slate-200 mb-2" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">AI Examiner ID: CEREBRO-01</span>
        </div>
        <div className="p-4 bg-slate-50 border border-slate-100 rounded-lg">
          <Award size={32} className="text-slate-200" />
        </div>
        <div className="flex flex-col items-center">
          <div className="w-32 h-[1px] bg-slate-200 mb-2" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date: {new Date().toLocaleDateString()}</span>
        </div>
      </div>
      <div className="flex justify-center">
        <WhatsAppShare username={user?.username || ''} score={score} total={total} examName={examName} />
      </div>
    </div>
  </div>
);

const ExamContent = ({ examName, user, mode, setUser, questions = SAMPLE_JAMB_QUESTIONS }: { examName: string, user: UserData | null, mode: ExamMode | null, setUser: (user: UserData | null) => void, questions?: Question[] }) => {
  const startTime = useRef(Date.now());
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<Record<number, string>>({});
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<number>>(new Set());
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showResultWall, setShowResultWall] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);
  const [isScoreUnlocked, setIsScoreUnlocked] = useState(false);
  
  // Track timers for each subject independently
  const defaultTimes: Record<string, number> = {
    'Mathematics': 2400,
    'Physics': 1800,
    'Chemistry': 1800,
    'English': 3600
  };
  const [subjectTimes, setSubjectTimes] = useState<Record<string, number>>(defaultTimes);

  const [activeTab, setActiveTab] = useState<'AI' | 'PROGRESS'>('AI');
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([
    { role: 'ai', text: `Welcome to the ${examName} prep session. I am your Cerebro AI Academic Tutor. I can see you're working on ${questions[0]?.topic}. How can I help?` }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const currentQuestion = questions[currentQuestionIndex] || SAMPLE_JAMB_QUESTIONS[0];
  const activeSubject = currentQuestion.subject;

  useEffect(() => {
    if (mode === 'STUDY' || isSubmitted) return;
    const timer = setInterval(() => {
      setSubjectTimes(prev => {
        const currentTime = prev[activeSubject] || 0;
        if (currentTime <= 0) return prev;
        return {
          ...prev,
          [activeSubject]: currentTime - 1
        };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [activeSubject, mode, isSubmitted]);

  // Handle Exam Auto-Submit
  useEffect(() => {
    if (mode === 'EXAM' && !isSubmitted) {
      const allTimesZero = Object.values(subjectTimes).every(t => t <= 0);
      if (allTimesZero) {
        handleFinishExam();
      }
    }
  }, [subjectTimes, mode, isSubmitted]);

  const handleFinishExam = async () => {
    setIsSubmitted(true);
    setShowResultWall(true);
    
    // Calculate Score and Topic-wise performance
    let scoreCount = 0;
    const incorrect = [];
    const topicStats: Record<string, { correct: number, total: number }> = {};

    questions.forEach(q => {
      if (!topicStats[q.topic]) topicStats[q.topic] = { correct: 0, total: 0 };
      topicStats[q.topic].total += 1;

      if (selectedOptions[q.id] === q.correctAnswer) {
        scoreCount++;
        topicStats[q.topic].correct += 1;
      } else {
        incorrect.push(q.id);
      }
    });

    try {
      // Auto-save wrong questions to Mistakes Bank
      const wrongQuestions = questions.filter(q => selectedOptions[q.id] !== q.correctAnswer);
      if (user?.id && wrongQuestions.length > 0) {
        for (const wq of wrongQuestions.slice(0, 20)) { // cap per session
          axios.post('/api/mistakes-bank/add', { userId: user.id, question: wq }).catch(() => {});
        }
      }

      const timeTaken = Math.floor((Date.now() - startTime.current) / 1000);
      await axios.post('/api/results', {
        userId: user?.id,
        examType: examName,
        year: examName.split('-')[1]?.trim(),
        score: scoreCount,
        total: questions.length,
        incorrectQuestions: incorrect,
        topicStats,
        timeTaken
      });

      // Refresh user stats locally
      if (user) {
        const gainedXP = scoreCount * 10;
        const newPerformance = { ...(user.topicPerformance || {}) };
        Object.keys(topicStats).forEach(topic => {
          const old = newPerformance[topic] || { correct: 0, total: 0 };
          newPerformance[topic] = {
            correct: old.correct + topicStats[topic].correct,
            total: old.total + topicStats[topic].total
          };
        });
        
        const newBadges = [...(user.badges || [])];
        const updatedXP = (user.xp || 0) + gainedXP;
        const newStreak = (user.streak || 0) + 1;

        if (updatedXP >= 1000 && !newBadges.includes('centurion')) newBadges.push('centurion');
        if (newStreak >= 5 && !newBadges.includes('streak_5')) newBadges.push('streak_5');
        if (questions.length >= 30 && timeTaken <= 900 && !newBadges.includes('speed_demon')) newBadges.push('speed_demon');

        setUser({
          ...user,
          xp: updatedXP,
          topicPerformance: newPerformance,
          streak: newStreak,
          badges: newBadges
        });
      }
    } catch (err) {
      console.error("Result save failed", err);
    }
  };

  const handleVerifyPin = async () => {
    setIsVerifyingPin(true);
    try {
      const response = await axios.post('/api/verify-pin', { username: user?.username, pin: pinInput });
      if (response.data.success) {
        setIsScoreUnlocked(true);
        setShowResultWall(false);
      }
    } catch (err) {
      console.error("PIN verification failed");
    } finally {
      setIsVerifyingPin(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const currentSubjectTime = (subjectTimes[activeSubject] || 0) as number;

  const handleSendMessage = async (manualMsg?: string, selectedOptionIdOverride?: string) => {
    if (mode === 'EXAM' && !isSubmitted) return; // AI disabled in exam mode
    
    const textToSend = manualMsg || inputValue;
    if (!textToSend.trim()) return;

    if (!manualMsg) setInputValue("");
    setMessages(prev => [...prev, { role: 'user', text: textToSend }]);
    setIsTyping(true);
    setActiveTab('AI'); 

    try {
      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
      const selectedOptionId = selectedOptionIdOverride || selectedOptions[currentQuestion.id];
      const selectedOptionText = currentQuestion.options.find(o => o.id === selectedOptionId)?.text;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: `You are Cerebro, the world-class academic tutor for Nigerian exams. 
Current exam: ${examName}. 
Question: "${currentQuestion.text}". 
Options: ${currentQuestion.options.map(o => `${o.id}: ${o.text}`).join(', ')}. 
Correct answer: ${currentQuestion.correctAnswer}. 
Context: ${currentQuestion.explanation}. 
Student selected option: ${selectedOptionId ? `${selectedOptionId} (${selectedOptionText})` : 'None yet'}.
Student asked: ${textToSend}`,
        config: {
          systemInstruction: `You are Cerebro AI Tutor. 
 Rules for Mathematical Solutions:
 1. Formatting: Use LaTeX for EVERY equation, formula, OR variable (e.g., $x^2$, $\sqrt{25}$). Use [equation] blocks for complex formulas.
 2. Step-by-Step Breakdown: 
    - **Given**: State values.
    - **Formula**: Provide LaTeX formula.
    - **Substitution**: Plug in values.
    - **Calculation**: Mid-point steps.
    - **Final Answer**: Bold result.
 3. Incorrect Option Analysis: If the student has selected an option and it is INCORRECT, you MUST dedicate a section of your response to explaining EXACTLY why that specific choice was wrong, addressing the logic "trap" it fell into, before guiding them to the correct answer.
 4. Tone: Encouraging but precise. Highlight "traps" in Nigerian past questions.
 5. Markdown: Use clean lists and bold text. 
 Render math beautifully.`
        }
      });
      
      const reply = response.text || "Connection error. Re-syncing...";
      setMessages(prev => [...prev, { role: 'ai', text: reply }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'ai', text: "System Error: Neural link interrupted." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const calculateScore = () => {
    let scoreCount = 0;
    questions.forEach(q => {
      if (selectedOptions[q.id] === q.correctAnswer) scoreCount++;
    });
    return scoreCount;
  };

  if (isScoreUnlocked) {
    return <ResultCertificate user={user} score={calculateScore()} total={questions.length} examName={examName} />;
  }

  if (showResultWall) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#0a0f1d] p-8 text-center gap-8">
        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.1)]">
            <Lock size={40} />
          </div>
          <div>
            <h2 className="text-white text-2xl font-black uppercase tracking-tight">System Records Ready</h2>
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mt-2">{examName} Submission Successful</p>
          </div>
        </div>
        
        <p className="max-w-xs text-white/60 text-xs leading-relaxed">
          Your performance data has been encrypted for academic integrity. Please enter your system PIN to decrypt and reveal your certification.
        </p>

        <div className="flex flex-col gap-4 w-64">
          <input 
            type="password" 
            maxLength={6}
            placeholder="6-Digit PIN"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleVerifyPin()}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-center text-white placeholder:text-white/10 focus:outline-none focus:border-emerald-500 transition-all font-mono tracking-[0.8em] text-lg"
          />
          <button 
            disabled={pinInput.length < 6 || isVerifyingPin}
            onClick={handleVerifyPin}
            className="w-full py-4 bg-white text-slate-900 rounded-xl font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:opacity-50"
          >
            {isVerifyingPin ? 'Verifying...' : 'Decrypt Results'}
          </button>
        </div>
      </div>
    );
  }

  const progressData = [
    { subject: 'Math', score: 85, color: '#10b981' },
    { subject: 'Eng', score: 72, color: '#3b82f6' },
    { subject: 'Phys', score: 68, color: '#f59e0b' },
    { subject: 'Chem', score: 91, color: '#6366f1' },
  ];

  return (
    <div className="flex h-full bg-[#0a0f1d]/40">
      {/* Dynamic Header for CBT */}
      <div className="absolute top-0 left-0 right-0 h-10 bg-emerald-500/10 backdrop-blur-md flex items-center justify-between px-6 border-b border-emerald-500/20 z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 text-[10px] font-black uppercase tracking-widest">{examName}</span>
            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${mode === 'STUDY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400 animate-pulse'}`}>
              {mode} MODE
            </span>
          </div>
          <div className="w-[1px] h-3 bg-white/10" />
          <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Candidate: {user?.username}</span>
          <div className="w-[1px] h-3 bg-white/10" />
          <div className="flex gap-4">
            {(Object.entries(subjectTimes) as [string, number][]).map(([sub, time]) => (
              <div key={sub} className={`flex items-center gap-2 transition-opacity ${sub === activeSubject ? 'opacity-100' : 'opacity-30'}`}>
                <span className="text-[9px] font-black uppercase text-white/60">{sub.substring(0, 3)}:</span>
                <span className={`font-mono text-[10px] font-bold ${time < 300 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {mode === 'EXAM' ? formatTime(time) : '--:--'}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-6">
          {mode === 'EXAM' && (
            <div className="flex items-center gap-3">
              <Clock size={14} className={currentSubjectTime < 300 ? 'text-red-400 animate-pulse' : 'text-emerald-400'} />
              <div className="flex flex-col items-end">
                <span className="text-[8px] text-white/40 uppercase font-black leading-none mb-1">{activeSubject} Time</span>
                <span className={`font-mono text-sm font-black leading-none ${currentSubjectTime < 300 ? 'text-red-400' : 'text-white'}`}>
                  {formatTime(currentSubjectTime)}
                </span>
              </div>
            </div>
          )}
          <button 
            onClick={handleFinishExam}
            className="px-3 py-1 bg-red-500/20 text-red-400 text-[9px] font-black uppercase rounded border border-red-500/30 hover:bg-red-500/30 transition-all active:scale-95"
          >
            Finish Exam
          </button>
        </div>
      </div>

      {/* Left Spec: Question Area */}
      <div className="flex-1 p-8 pt-16 overflow-y-auto border-r border-white/5 relative no-scrollbar">
        <div className="flex items-center gap-3 mb-8">
          <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded border border-emerald-500/30 uppercase tracking-widest">{currentQuestion.topic}</span>
          <span className="text-white/30 text-[10px] uppercase font-bold tracking-widest">Question {currentQuestionIndex + 1} of {questions.length}</span>
          <button 
            onClick={() => {
              const newFlags = new Set(flaggedQuestions);
              if (newFlags.has(currentQuestion.id)) newFlags.delete(currentQuestion.id);
              else newFlags.add(currentQuestion.id);
              setFlaggedQuestions(newFlags);
            }}
            className={`ml-auto flex items-center gap-2 px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${flaggedQuestions.has(currentQuestion.id) ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-white/5 hover:bg-white/10 text-white/40'}`}
          >
            {flaggedQuestions.has(currentQuestion.id) ? 'Flagged' : 'Flag for Review'}
          </button>
        </div>

        <h2 className="text-2xl text-white font-medium mb-8 leading-relaxed">
          {currentQuestion.text}
        </h2>

        <div className="grid gap-3">
          {currentQuestion.options.map((option) => {
            const isSelected = selectedOptions[currentQuestion.id] === option.id;
            
            return (
              <button
                key={option.id}
                disabled={isAdvancing}
                onClick={() => {
                  if (isSelected || isAdvancing) return;
                  setSelectedOptions(prev => ({ ...prev, [currentQuestion.id]: option.id }));
                  
                  // Sound feedback
                  if (option.id === currentQuestion.correctAnswer) {
                    SoundEngine.play('correct');
                  } else {
                    SoundEngine.play('wrong');
                  }

                  if (mode === 'STUDY') {
                    handleSendMessage(`Explain this question. I selected ${option.id}.`, option.id);
                  }

                  setIsAdvancing(true);
                  setTimeout(() => {
                    if (currentQuestionIndex < questions.length - 1) {
                      setCurrentQuestionIndex(prev => prev + 1);
                    }
                    setIsAdvancing(false);
                  }, 800);
                }}
                className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-300 text-left ${
                  isSelected
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-100 shadow-[0_0_30px_rgba(16,185,129,0.2)] scale-[1.02]'
                    : 'bg-white/5 border-white/5 text-white/60 hover:bg-white/10 hover:border-white/10'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black border transition-all ${
                  isSelected
                    ? 'bg-emerald-500 border-emerald-400 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-pulse'
                    : 'bg-white/10 border-white/10'
                }`}>
                  {option.id}
                </div>
                <span className="text-xs font-medium">{option.text}</span>
              </button>
            );
          })}
        </div>

        {mode === 'STUDY' && (
          <div className="mt-8 flex flex-col gap-6">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => handleSendMessage(`Please provide a detailed pedagogical explanation of why the correct answer is ${currentQuestion.correctAnswer}. Break it down into clear steps.`)}
                disabled={isTyping}
                className="flex items-center gap-2 px-4 py-2 bg-gold-400/10 border border-gold-400/20 text-gold-400 text-[10px] font-black uppercase rounded-xl hover:bg-gold-400/20 transition-all active:scale-95 disabled:opacity-50"
              >
                <Brain size={14} /> Explain Answer
              </button>
              <button 
                onClick={() => handleSendMessage(`Give me a hint for this question WITHOUT telling me the answer.`)}
                disabled={isTyping}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-white/60 text-[10px] font-black uppercase rounded-xl hover:bg-white/10 transition-all active:scale-95 disabled:opacity-50"
              >
                <HelpCircle size={14} /> Need a Hint?
              </button>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between border-t border-white/5 pt-8 mt-12">
          {!isSubmitted && (
            <>
              <button 
                disabled={currentQuestionIndex === 0}
                onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
                className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 disabled:opacity-20 rounded-xl text-white text-xs font-bold transition-all"
              >
                <ChevronLeft size={16} /> Previous
              </button>
              
              <div className="flex gap-2">
                {questions.map((q, i) => (
                  <div 
                    key={i} 
                    onClick={() => setCurrentQuestionIndex(i)}
                    className={`w-2.5 h-2.5 rounded-full cursor-pointer transition-all relative ${
                      i === currentQuestionIndex ? 'bg-emerald-500 w-8' : 
                      selectedOptions[q.id] ? 'bg-emerald-500/60' : 'bg-white/10 hover:bg-white/30'
                    } ${flaggedQuestions.has(q.id) ? 'ring-2 ring-red-500 ring-offset-2 ring-offset-[#0a0f1d]' : ''}`} 
                  >
                  </div>
                ))}
              </div>

              <button 
                disabled={currentQuestionIndex === SAMPLE_JAMB_QUESTIONS.length - 1}
                onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-20 rounded-xl text-white text-xs font-bold transition-all shadow-lg shadow-emerald-500/20"
              >
                Next <ChevronRight size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Right Spec: AI Tutor Sidebar */}
      <div className={`transition-all duration-500 ${mode === 'EXAM' && !isSubmitted ? 'w-0 opacity-0 overflow-hidden' : 'w-[400px]'} bg-slate-900/40 backdrop-blur-xl border-l border-white/5 flex flex-col overflow-hidden`}>
        {/* Sidebar Tabs */}
        <div className="flex bg-white/5 border-b border-white/5">
          <button 
            onClick={() => setActiveTab('AI')}
            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'AI' ? 'text-emerald-400 border-b-2 border-emerald-400 bg-white/5' : 'text-white/40 hover:text-white/60'}`}
          >
            Cerebro AI
          </button>
          <button 
            onClick={() => setActiveTab('PROGRESS')}
            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'PROGRESS' ? 'text-blue-400 border-b-2 border-blue-400 bg-white/5' : 'text-white/40 hover:text-white/60'}`}
          >
            Insights
          </button>
        </div>

        {activeTab === 'AI' ? (
          <>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 no-scrollbar">
              {messages.map((msg, i) => (
                <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[95%] p-4 rounded-2xl text-xs leading-relaxed ${
                    msg.role === 'user' 
                      ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-100 rounded-tr-none' 
                      : 'bg-white/5 border border-white/10 text-white/80 rounded-tl-none font-sans'
                  }`}>
                    {msg.role === 'ai' ? (
                      <div className="markdown-body">
                        <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{msg.text}</Markdown>
                      </div>
                    ) : (
                      msg.text
                    )}
                  </div>
                </div>
              ))}
              {isTyping && <AThinkingAnimation />}
            </div>

            <div className="p-4 bg-white/5 border-t border-white/5">
              <div className="relative">
                <input 
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Ask Cerebro anything..."
                  className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 pr-12 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50 transition-all font-sans"
                />
                <button 
                  onClick={() => handleSendMessage()}
                  disabled={!inputValue.trim() || isTyping}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-emerald-400 hover:text-emerald-300 disabled:opacity-30 transition-all"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8 no-scrollbar">
            {/* Question Navigator Matrix */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h4 className="text-white text-[10px] font-black uppercase tracking-widest">Question Navigator</h4>
                <div className="flex gap-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                    <span className="text-[8px] text-white/40 uppercase">Current</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                    <span className="text-[8px] text-white/40 uppercase">Saved</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-red-400 rounded-full" />
                    <span className="text-[8px] text-white/40 uppercase">Flagged</span>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-4 gap-2">
                {questions.map((q, i) => (
                  <button
                    key={q.id}
                    onClick={() => {
                      setCurrentQuestionIndex(i);
                      setActiveTab('AI'); // Optional: jump to tutor view after selecting? No, keep in progress for bulk review
                    }}
                    className={`h-10 rounded-lg flex items-center justify-center text-[10px] font-black transition-all border ${
                      i === currentQuestionIndex 
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]' 
                        : flaggedQuestions.has(q.id)
                        ? 'bg-red-500/20 border-red-500/50 text-red-400'
                        : selectedOptions[q.id]
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400/60'
                        : 'bg-white/5 border-white/10 text-white/20 hover:border-white/40'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h4 className="text-white text-xs font-bold uppercase tracking-widest">Syllabus Coverage</h4>
                <TrendingUp size={14} className="text-emerald-400" />
              </div>
              <div className="h-[200px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={progressData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                    <XAxis 
                      dataKey="subject" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#ffffff40', fontSize: 10 }}
                    />
                    <YAxis hide />
                    <Tooltip 
                      cursor={{ fill: '#ffffff05' }}
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #ffffff10', borderRadius: '8px', fontSize: '10px' }}
                    />
                    <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                      {progressData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.8} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid gap-4">
              <h4 className="text-white text-[10px] font-black uppercase tracking-[0.2em] border-l-2 border-emerald-500 pl-3">Learning Insights</h4>
              <div className="bg-white/5 p-4 rounded-xl border border-white/5 flex items-start gap-4">
                <div className="p-2 bg-gold-400/20 rounded-lg">
                  <Brain size={16} className="text-gold-400" />
                </div>
                <div className="flex-1">
                  <div className="text-xs text-white font-bold mb-1">Knowledge Gap Found</div>
                  <p className="text-[10px] text-white/40 leading-relaxed">
                    You're struggling with "Surds and Logarithms". We recommend taking a mini-quiz on this tomorrow.
                  </p>
                </div>
              </div>
              <div className="bg-white/5 p-4 rounded-xl border border-white/5 flex items-start gap-4">
                <div className="p-2 bg-emerald-400/20 rounded-lg">
                  <TrendingUp size={16} className="text-emerald-400" />
                </div>
                <div className="flex-1">
                  <div className="text-xs text-white font-bold mb-1">Consistency Streak</div>
                  <p className="text-[10px] text-white/40 leading-relaxed">
                    You've maintained a 4-day study streak. Keep it up for 3 more days to unlock the "Master Scholar" badge.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const SystemSettingsContent = ({ user }: { user: UserData | null }) => {
  return (
    <div className="flex flex-col h-full bg-[#0a0f1d]/60 p-8">
      <div className="flex items-center gap-6 mb-12">
        <div className="w-24 h-24 rounded-3xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shadow-2xl">
          <Award size={48} className="text-emerald-400" />
        </div>
        <div>
          <h2 className="text-4xl font-black text-white tracking-widest uppercase">Scholar OS</h2>
          <p className="text-emerald-400 font-mono text-sm">Version 1.0.4 (Enterprise Edition)</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {[
          { label: 'OS Name', value: 'Scholar OS' },
          { label: 'Kernel', value: 'AI-Tutor-v2' },
          { label: 'Database', value: '500,000+ Nigerian Past Questions' },
          { label: 'Network', value: 'Secure Edu-Net (Nigeria)' },
          { label: 'User', value: user?.username || 'Guest' },
          { label: 'Status', value: user ? 'Authorized Academic License' : 'Unlicensed Trial' },
        ].map((item, i) => (
          <div key={i} className="bg-white/5 border border-white/5 p-4 rounded-xl">
            <div className="text-[10px] text-white/40 font-bold uppercase tracking-widest mb-1">{item.label}</div>
            <div className="text-sm text-white font-medium">{item.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-auto pt-8 border-t border-white/5 flex items-center justify-between text-white/20">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em]">Designed for Excellence</div>
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] italic">Proprietary AI Logic</div>
      </div>
    </div>
  );
};

const FolderContent = ({ category, onOpenExam }: { category: CategoryFolder, onOpenExam: (name: string, exam: string, subject: string, year: number) => void }) => {
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [yearsLoading, setYearsLoading] = useState(false);

  const selectedExam = category.items.find(e => e.id === selectedExamId);

  // When a subject is chosen, fetch the years that have actual questions in the database
  useEffect(() => {
    if (!selectedExam || !selectedSubject) return;
    setYearsLoading(true);
    setAvailableYears([]);
    axios.get('/api/available-years', {
      params: { exam: selectedExam.id, subject: selectedSubject }
    }).then(res => {
      if (res.data.years?.length > 0) {
        setAvailableYears(res.data.years);
      } else {
        // Fallback: show last 10 years from startYear so UI is never empty
        const cur = new Date().getFullYear();
        const fallback = Array.from({ length: Math.min(10, cur - selectedExam.startYear + 1) }, (_, i) => cur - i);
        setAvailableYears(fallback);
      }
    }).catch(() => {
      const cur = new Date().getFullYear();
      const fallback = Array.from({ length: 10 }, (_, i) => cur - i);
      setAvailableYears(fallback);
    }).finally(() => setYearsLoading(false));
  }, [selectedExam, selectedSubject]);

  // Subject selection view
  if (selectedExam && !selectedSubject) {
    return (
      <div className="flex flex-col h-full bg-[#0a1428]/50 overflow-hidden">
        <div className="flex items-center gap-2 p-4 bg-white/5 border-b border-white/5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setSelectedExamId(null)}
            className="shrink-0 p-1 px-3 bg-white/5 hover:bg-white/10 rounded-lg text-emerald-400 text-[10px] font-black uppercase transition-all"
          >
            ← Back to {category.label}
          </button>
          <div className="shrink-0 w-[1px] h-4 bg-white/10" />
          <span className="shrink-0 text-white/60 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">{selectedExam.name} - Choose Subject</span>
        </div>
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="grid grid-cols-3 gap-3">
            {selectedExam.subjects.map((sub) => (
              <motion.button
                key={sub}
                whileHover={{ scale: 1.02, y: -2 }}
                onClick={() => setSelectedSubject(sub)}
                className="group p-5 bg-white/5 border border-white/5 rounded-xl hover:bg-emerald-500/10 hover:border-emerald-500/50 transition-all text-center flex flex-col items-center gap-2 relative overflow-hidden"
              >
                <BookOpen size={20} className="text-emerald-400/60 group-hover:text-emerald-400 transition-colors" />
                <div className="text-white text-sm font-bold tracking-tight group-hover:text-emerald-400 transition-colors">{sub}</div>
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Year selection view
  if (selectedExam && selectedSubject) {
    return (
      <div className="flex flex-col h-full bg-[#0a1428]/50 overflow-hidden">
        <div className="flex items-center gap-2 p-4 bg-white/5 border-b border-white/5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setSelectedSubject(null)}
            className="shrink-0 p-1 px-3 bg-white/5 hover:bg-white/10 rounded-lg text-emerald-400 text-[10px] font-black uppercase transition-all"
          >
            ← Back to Subjects
          </button>
          <div className="shrink-0 w-[1px] h-4 bg-white/10" />
          <span className="shrink-0 text-white/60 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">{selectedExam.name} / {selectedSubject} - Choose Year</span>
        </div>
        <div className="flex-1 p-6 overflow-y-auto">
          {yearsLoading ? (
            <div className="flex items-center justify-center h-32 text-white/20 text-xs uppercase font-black tracking-widest animate-pulse">
              Loading Archive...
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {availableYears.map((year) => (
                <motion.button
                  key={year}
                  whileHover={{ scale: 1.02, y: -2 }}
                  onClick={() => onOpenExam(`${selectedExam.name} ${selectedSubject} - ${year}`, selectedExam.id, selectedSubject, year)}
                  className="group p-4 bg-white/5 border border-white/5 rounded-xl hover:bg-emerald-500/10 hover:border-emerald-500/50 transition-all text-center flex flex-col items-center gap-1 relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="text-white text-lg font-black tracking-tighter group-hover:text-emerald-400 transition-colors relative z-10">{year}</div>
                  <div className="text-white/20 text-[8px] font-black uppercase group-hover:text-emerald-400/40 relative z-10">{selectedExam.id} ARCHIVE</div>
                </motion.button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 flex flex-col h-full bg-[#0a1428]/50 overflow-y-auto no-scrollbar">
      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-3xl p-8 mb-10 flex items-center justify-between group hover:bg-emerald-500/20 transition-all cursor-pointer relative overflow-hidden"
        onClick={() => onOpenExam(`${category.label} - Scholar-Print AI Mock`)}
      >
        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
          <Brain size={120} />
        </div>
        <div className="flex items-center gap-6 relative z-10">
          <div className="p-4 bg-emerald-500 rounded-3xl shadow-[0_0_40px_rgba(16,185,129,0.3)] group-hover:scale-105 transition-transform">
            <Zap size={32} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h3 className="text-white font-black uppercase tracking-tight text-2xl">Scholar-Print AI Mock</h3>
              <span className="px-2 py-0.5 bg-white/20 text-white text-[8px] font-black rounded uppercase">Premium</span>
            </div>
            <p className="text-white/60 text-xs font-medium max-w-md">Our neural engine analyzes your history and constructs a personalized diagnostic exam targeting your specific cognitive gaps.</p>
          </div>
        </div>
        <ChevronRight className="text-emerald-400 group-hover:translate-x-2 transition-transform h-8 w-8" />
      </div>

      <div className="grid grid-cols-3 gap-6">
        {category.items.map((exam) => (
        <motion.div
          key={exam.id}
          whileHover={{ y: -4 }}
          onClick={() => setSelectedExamId(exam.id)}
          className="group p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 hover:border-white/10 transition-all cursor-pointer flex flex-col items-center text-center gap-3"
        >
          <div className="relative">
            <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-slate-800/80 text-emerald-400 group-hover:scale-110 transition-transform">
              {React.cloneElement(exam.icon as React.ReactElement<any>, { size: 24 })}
            </div>
            <div className="absolute -bottom-1 -right-1 px-1.5 bg-emerald-500 rounded text-[6px] font-black text-white">
              S.{exam.startYear}
            </div>
          </div>
          <div>
            <div className="text-white text-sm font-bold tracking-tight">{exam.name}</div>
            <div className="text-white/40 text-[10px] font-medium leading-tight mt-1">{exam.description}</div>
          </div>
          <button className="mt-2 text-[10px] font-black uppercase text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity">Explore Years</button>
        </motion.div>
      ))}
      </div>
    </div>
  );
};

const Taskbar = ({ onOpenSettings, openWindows, onToggleWindow, user }: { 
  onOpenSettings: () => void, 
  openWindows: { id: string, title: string, icon: React.ReactNode, isMinimized: boolean }[],
  onToggleWindow: (id: string) => void,
  user: UserData | null
}) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-2 py-2 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl z-[100]">
      {/* Start Button */}
      <div 
        onClick={onOpenSettings}
        className="hover:bg-white/10 p-2 rounded-xl border border-transparent hover:border-white/10 transition-all cursor-pointer group"
      >
        <div className="relative">
          <GraduationCap size={24} className="text-emerald-400 group-hover:scale-110 transition-transform" />
          <div className="absolute inset-0 bg-emerald-400/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      <div className="w-[1px] h-6 bg-white/10 mx-1" />

      {/* App Icons */}
      <div className="flex items-center gap-1">
        <div 
          onClick={() => {}} 
          className="p-2.5 rounded-xl transition-all cursor-pointer hover:bg-white/10 group relative bg-white/10 shadow-inner shadow-white/5"
        >
          <div className="text-white transition-all group-hover:scale-110 opacity-100">
            <Monitor size={20} />
          </div>
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-emerald-400 rounded-full" />
        </div>

        {openWindows.map((win) => (
          <div 
            key={win.id} 
            onClick={() => onToggleWindow(win.id)}
            className={`p-2.5 rounded-xl transition-all cursor-pointer hover:bg-white/10 group relative ${!win.isMinimized ? 'bg-white/10 shadow-inner shadow-white/5' : ''}`}
          >
            <div className={`text-white transition-all group-hover:scale-110 ${!win.isMinimized ? 'opacity-100' : 'opacity-40 group-hover:opacity-80'}`}>
              {win.icon}
            </div>
            {!win.isMinimized && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-emerald-400 rounded-full" />}
          </div>
        ))}

        <div className="w-[1px] h-6 bg-white/10 mx-1" />

        {[
          { icon: <Calculator size={20} />, label: 'Calculator' },
          { icon: <Award size={20} />, label: 'Progress' },
          { icon: <Settings size={20} />, label: 'Settings', onClick: onOpenSettings }
        ].map((app, i) => (
          <div 
            key={i} 
            onClick={app.onClick}
            className="p-2.5 rounded-xl transition-all cursor-pointer hover:bg-white/10 group relative"
          >
            <div className="text-white transition-all group-hover:scale-110 opacity-40 group-hover:opacity-80">
              {app.icon}
            </div>
          </div>
        ))}
      </div>

      <div className="w-[1px] h-6 bg-white/10 mx-1" />

      {/* System Tray */}
      <div className="flex items-center gap-4 px-3 text-white/60">
        {user && (
          <>
            {user.isAdmin && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded text-[8px] font-black text-red-400 uppercase tracking-widest mr-2">
                <Layout size={10} />
                Root Admin
              </div>
            )}
            <div className="hidden md:flex items-center gap-4 px-3 py-1 bg-white/5 rounded-lg border border-white/5 mr-2">
             <div className="flex items-center gap-1.5">
               <Flame size={12} className={(user.streak || 0) > 0 ? 'text-orange-500' : 'text-white/20'} />
               <span className="text-[10px] font-black text-white">{(user.streak || 0)}</span>
             </div>
             <div className="w-[1px] h-3 bg-white/10" />
             <div className="flex items-center gap-1.5">
               <Zap size={12} className="text-gold-400" />
               <span className="text-[10px] font-black text-white">{(user.xp || 0)} XP</span>
             </div>
          </div>
        </>
      )}
        <div className="flex items-center gap-1.5 cursor-help">
          <Battery size={14} className="text-emerald-400 rotate-90" />
          <span className="text-[10px] font-bold">94%</span>
        </div>
        <div className="flex flex-col items-end min-w-[60px]">
          <span className="text-[10px] font-bold text-white/90 leading-none">
            {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className="text-[8px] font-medium leading-none mt-0.5 opacity-60">
            {time.toLocaleDateString([], { day: 'numeric', month: 'short' })}
          </span>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [phase, setPhase] = useState<OSPhase>('BOOT');
  const [user, setUser] = useState<UserData | null>(null);
  
  // Windows State Management
  const [windows, setWindows] = useState<Record<string, WindowConfig>>({
    exam: { isOpen: false, isMinimized: false, isMaximized: false, title: "CBT Testing Environment", icon: <BookOpen /> },
    analytics: { isOpen: false, isMinimized: false, isMaximized: false, title: "Predictive Analytics Dashboard", icon: <TrendingUp /> },
    leaderboard: { isOpen: false, isMinimized: false, isMaximized: false, title: "Global Ranks", icon: <Award /> },
    settings: { isOpen: false, isMinimized: false, isMaximized: false, title: "Scholar OS System Settings", icon: <Settings /> },
    folder: { isOpen: false, isMinimized: false, isMaximized: false, title: "Explorer", icon: <Folder /> }
  });

  const [activeExamName, setActiveExamName] = useState("");
  const [activeExamQuestions, setActiveExamQuestions] = useState<Question[]>(SAMPLE_JAMB_QUESTIONS);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  
  const [examMode, setExamMode] = useState<ExamMode | null>(null);
  const [showPremiumModal, setShowPremiumModal] = useState<string | null>(null); 
  const [showModeModal, setShowModeModal] = useState<string | null>(null);
  
  // Premium feature state
  const [showForgotPin, setShowForgotPin] = useState(false);
  const [showSetExamDate, setShowSetExamDate] = useState(false);
  const [showMistakesBank, setShowMistakesBank] = useState(false);
  const [showAdminDash, setShowAdminDash] = useState(false);

  const getScholarPrintQuestions = (userData: UserData | null) => {
    if (!userData || !userData.topicPerformance || Object.keys(userData.topicPerformance).length === 0) {
      return [...SAMPLE_JAMB_QUESTIONS].sort(() => Math.random() - 0.5);
    }
    const rankedTopics = Object.entries(userData.topicPerformance)
      .sort(([, a], [, b]) => (a.correct / a.total) - (b.correct / b.total))
      .map(([topic]) => topic);
    const weakestTopic = rankedTopics[0];
    const prioritized = SAMPLE_JAMB_QUESTIONS.filter(q => q.topic === weakestTopic);
    const others = SAMPLE_JAMB_QUESTIONS.filter(q => q.topic !== weakestTopic);
    return [...prioritized, ...others];
  };

  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionsError, setQuestionsError] = useState("");

  const handleOpenExam = async (name: string, exam?: string, subject?: string, year?: number) => {
    setActiveExamName(name);
    setQuestionsError("");

    if (name.includes("Scholar-Print")) {
      // Fetch personalized questions from the backend
      setQuestionsLoading(true);
      try {
        const weakTopics = user?.topicPerformance
          ? Object.entries(user.topicPerformance)
              .sort(([, a], [, b]) => (a.correct / a.total) - (b.correct / b.total))
              .slice(0, 3)
              .map(([topic]) => topic)
          : [];

        const res = await axios.post('/api/scholar-print', {
          userId: user?.id,
          exam: 'jamb',
          weakTopics,
        });

        if (res.data.questions?.length > 0) {
          setActiveExamQuestions(res.data.questions);
        } else {
          setActiveExamQuestions(SAMPLE_JAMB_QUESTIONS);
        }
      } catch {
        setActiveExamQuestions(SAMPLE_JAMB_QUESTIONS);
      } finally {
        setQuestionsLoading(false);
      }
    } else if (exam && subject && year) {
      // Fetch specific exam/subject/year questions from backend
      setQuestionsLoading(true);
      try {
        const res = await axios.get('/api/questions', {
          params: { exam, subject, year }
        });

        if (res.data.questions?.length > 0) {
          setActiveExamQuestions(res.data.questions);
          setShowModeModal(name);
        } else {
          // No questions seeded yet for this year - show sample with a notice
          setActiveExamQuestions(SAMPLE_JAMB_QUESTIONS);
          setQuestionsError(res.data.message || "No questions found for this year yet.");
          setShowModeModal(name);
        }
        return; // modal is set above
      } catch {
        setActiveExamQuestions(SAMPLE_JAMB_QUESTIONS);
        setQuestionsError("Could not load questions. Using sample questions.");
      } finally {
        setQuestionsLoading(false);
      }
    } else {
      setActiveExamQuestions(SAMPLE_JAMB_QUESTIONS);
    }

    setShowModeModal(name);
  };

  const activeFolder = EDUCATIONAL_CATEGORIES.find(c => c.id === activeFolderId);

  const toggleWindowState = (id: string, updates: Partial<WindowConfig>) => {
    setWindows(prev => ({
      ...prev,
      [id]: { ...prev[id], ...updates }
    }));
  };

  const handleStartExam = (name: string, mode: ExamMode) => {
    setExamMode(mode);
    setShowModeModal(null);
    toggleWindowState('exam', { isOpen: true, isMinimized: false, title: `${name} CBT Testing Environment` });
  };

  const handleOpenFolder = (folderId: string) => {
    const folder = EDUCATIONAL_CATEGORIES.find(c => c.id === folderId);
    setActiveFolderId(folderId);
    toggleWindowState('folder', { isOpen: true, isMinimized: false, title: `Explorer: ${folder?.label}` });
  };

  const getOpenWindowsForTaskbar = () => {
    return (Object.entries(windows) as [string, WindowConfig][])
      .filter(([_, win]) => win.isOpen)
      .map(([id, win]) => ({
        id,
        title: win.title,
        icon: win.icon,
        isMinimized: win.isMinimized
      }));
  };

  return (
    <div className="relative w-full h-screen bg-[#020617] overflow-hidden font-sans">
      <AnimatePresence mode="wait">
        {phase === 'BOOT' && (
          <motion.div key="boot" exit={{ opacity: 0 }}>
            <BootScreen onComplete={() => setPhase('LOCK')} />
          </motion.div>
        )}

        {phase === 'LOCK' && (
          <motion.div 
            key="lock" 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.8 }}
          >
            <LockScreen 
              onLogin={async (username, pin) => {
                const response = await axios.post('/api/login', { username, pin });
                if (response.data.success) {
                  SoundEngine.play('unlock');
                  setUser(response.data.user);
                  setPhase('DESKTOP');
                  return true;
                }
                return false;
              }} 
              onRegister={() => setPhase('REGISTRATION')}
              onForgotPin={() => setShowForgotPin(true)}
            />
          </motion.div>
        )}

        {phase === 'REGISTRATION' && (
          <motion.div 
            key="registration"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <RegistrationScreen 
              onBack={() => setPhase('LOCK')}
              onSuccess={(authUrl) => {
                window.location.href = authUrl;
              }}
            />
          </motion.div>
        )}

        {phase === 'DESKTOP' && (
          <motion.div 
            key="desktop" 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }}
            className="w-full h-full"
          >
            {/* Abstract Background Orbs */}
            <div className="absolute top-[-10%] left-[-5%] w-[60%] h-[60%] bg-emerald-600/10 blur-[150px] rounded-full" />
            <div className="absolute bottom-[-5%] right-[-5%] w-[40%] h-[40%] bg-blue-600/10 blur-[150px] rounded-full" />
            <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-gold-400/5 blur-[120px] rounded-full" />

            {/* Main Wallpaper Content (Subtle texture) */}
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.02] mix-blend-overlay" />

            {/* Desktop Grid */}
            <div className="relative z-10 p-8 grid grid-cols-1 gap-12 w-fit">
              {EDUCATIONAL_CATEGORIES.map((category) => {
                const isLocked = user && !user.purchased_modules.includes(category.id);
                return (
                  <DesktopIcon 
                    key={category.id}
                    label={category.label} 
                    icon={<Folder />} 
                    color={category.color} 
                    isLocked={isLocked}
                    onClick={() => {
                      if (isLocked) {
                        setShowPremiumModal(category.id);
                      } else {
                        handleOpenFolder(category.id);
                      }
                    }}
                  />
                );
              })}
              <ExamCountdownWidget user={user} onSetDate={() => setShowSetExamDate(true)} />
              <DesktopIcon 
                label="Analytics Dashboard" 
                icon={<TrendingUp />} 
                color="bg-emerald-500" 
                onClick={() => toggleWindowState('analytics', { isOpen: true, isMinimized: false })}
              />
              <DesktopIcon 
                label="Global Rankings" 
                icon={<Award />} 
                color="bg-gold-400" 
                onClick={() => toggleWindowState('leaderboard', { isOpen: true, isMinimized: false })}
              />
              <DesktopIcon 
                label="Mistakes Bank" 
                icon={<BookOpen />} 
                color="bg-red-500" 
                onClick={() => setShowMistakesBank(true)}
              />
              {user?.isAdmin && (
                <DesktopIcon 
                  label="Admin Panel" 
                  icon={<Layout />} 
                  color="bg-red-700" 
                  onClick={() => setShowAdminDash(true)}
                />
              )}
              <DesktopIcon 
                label="Scholar OS Settings" 
                icon={<Settings />} 
                color="bg-slate-400" 
                onClick={() => toggleWindowState('settings', { isOpen: true, isMinimized: false })}
              />
            </div>

            {/* Window Manager */}
            <AnimatePresence>
              {windows.folder.isOpen && activeFolder && (
                <OSWindow 
                  id="folder" 
                  title={windows.folder.title} 
                  isOpen={windows.folder.isOpen}
                  isMinimized={windows.folder.isMinimized}
                  isMaximized={windows.folder.isMaximized}
                  onClose={() => toggleWindowState('folder', { isOpen: false })}
                  onMinimize={() => toggleWindowState('folder', { isMinimized: true })}
                  onMaximize={() => toggleWindowState('folder', { isMaximized: !windows.folder.isMaximized })}
                >
                  <FolderContent 
                    category={activeFolder} 
                    onOpenExam={handleOpenExam} 
                  />
                </OSWindow>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {windows.analytics.isOpen && (
                <OSWindow 
                   id="analytics" 
                   title={windows.analytics.title} 
                   isOpen={windows.analytics.isOpen}
                   isMinimized={windows.analytics.isMinimized}
                   isMaximized={windows.analytics.isMaximized}
                   onClose={() => toggleWindowState('analytics', { isOpen: false })}
                   onMinimize={() => toggleWindowState('analytics', { isMinimized: true })}
                   onMaximize={() => toggleWindowState('analytics', { isMaximized: !windows.analytics.isMaximized })}
                >
                  <AnalyticsDashboard user={user} />
                </OSWindow>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {windows.leaderboard.isOpen && (
                <OSWindow 
                   id="leaderboard" 
                   title={windows.leaderboard.title} 
                   isOpen={windows.leaderboard.isOpen}
                   isMinimized={windows.leaderboard.isMinimized}
                   isMaximized={windows.leaderboard.isMaximized}
                   onClose={() => toggleWindowState('leaderboard', { isOpen: false })}
                   onMinimize={() => toggleWindowState('leaderboard', { isMinimized: true })}
                   onMaximize={() => toggleWindowState('leaderboard', { isMaximized: !windows.leaderboard.isMaximized })}
                >
                  <LeaderboardWindow />
                </OSWindow>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {windows.exam.isOpen && (
                <OSWindow 
                  id="exam" 
                  title={windows.exam.title} 
                  isOpen={windows.exam.isOpen}
                  isMinimized={windows.exam.isMinimized}
                  isMaximized={windows.exam.isMaximized}
                  onClose={() => toggleWindowState('exam', { isOpen: false })}
                  onMinimize={() => toggleWindowState('exam', { isMinimized: true })}
                  onMaximize={() => toggleWindowState('exam', { isMaximized: !windows.exam.isMaximized })}
                >
                  <ExamContent 
                    examName={activeExamName} 
                    user={user} 
                    mode={examMode} 
                    setUser={setUser}
                    questions={activeExamQuestions}
                  />
                </OSWindow>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {windows.settings.isOpen && (
                <OSWindow 
                  id="settings" 
                  title={windows.settings.title} 
                  isOpen={windows.settings.isOpen}
                  isMinimized={windows.settings.isMinimized}
                  isMaximized={windows.settings.isMaximized}
                  onClose={() => toggleWindowState('settings', { isOpen: false })}
                  onMinimize={() => toggleWindowState('settings', { isMinimized: true })}
                  onMaximize={() => toggleWindowState('settings', { isMaximized: !windows.settings.isMaximized })}
                >
                  <SystemSettingsContent user={user} />
                </OSWindow>
              )}
            </AnimatePresence>

            {/* Taskbar Dock */}
            <Taskbar 
              onOpenSettings={() => toggleWindowState('settings', { isOpen: true, isMinimized: false })} 
              openWindows={getOpenWindowsForTaskbar()}
              onToggleWindow={(id) => toggleWindowState(id, { isMinimized: !windows[id].isMinimized })}
              user={user}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPremiumModal && (
          <PremiumAccessModal 
            examId={showPremiumModal} 
            onClose={() => setShowPremiumModal(null)} 
            onSuccess={(id) => {
              if (user) {
                user.purchased_modules.push(id);
                setUser({ ...user });
              }
              setShowPremiumModal(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Questions loading overlay */}
      <AnimatePresence>
        {questionsLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-md gap-6"
          >
            <div className="relative w-12 h-12">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 border-2 border-white/10 border-t-emerald-400 rounded-full"
              />
            </div>
            <div className="text-center">
              <div className="text-white font-black uppercase tracking-widest text-sm">Loading Question Archive</div>
              <div className="text-white/40 text-[10px] uppercase font-bold tracking-widest mt-2">Connecting to ScholarOS Database...</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Questions error banner */}
      <AnimatePresence>
        {questionsError && !questionsLoading && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[250] px-6 py-3 bg-amber-500/20 border border-amber-500/30 rounded-2xl text-amber-300 text-[10px] font-black uppercase tracking-widest max-w-md text-center backdrop-blur-md"
          >
            {questionsError} Using sample questions for now.
            <button onClick={() => setQuestionsError("")} className="ml-4 text-amber-300/60 hover:text-amber-300">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showModeModal && !questionsLoading && (
          <ModeSelectionModal 
            examName={showModeModal}
            onClose={() => setShowModeModal(null)}
            onSelect={(mode) => {
              handleStartExam(showModeModal, mode);
              setShowModeModal(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Forgot PIN Modal */}
      <AnimatePresence>
        {showForgotPin && <ForgotPinModal onClose={() => setShowForgotPin(false)} />}
      </AnimatePresence>

      {/* Set Exam Date Modal */}
      <AnimatePresence>
        {showSetExamDate && (
          <SetExamDateModal
            user={user}
            onClose={() => setShowSetExamDate(false)}
            onSave={(date, name) => {
              if (user) setUser({ ...user, examDate: date, examName: name });
            }}
          />
        )}
      </AnimatePresence>

      {/* Mistakes Bank Modal */}
      <AnimatePresence>
        {showMistakesBank && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }}
              className="w-full max-w-2xl h-[80vh] bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                <span className="text-white font-black uppercase tracking-widest text-sm">Mistakes Bank</span>
                <button onClick={() => setShowMistakesBank(false)} className="text-white/40 hover:text-red-400 transition-colors"><X size={20} /></button>
              </div>
              <div className="flex-1 overflow-hidden">
                <MistakesBankWindow
                  user={user}
                  onStartReview={(questions) => {
                    setActiveExamQuestions(questions);
                    setActiveExamName('Mistakes Bank Revision');
                    setShowMistakesBank(false);
                    setExamMode('STUDY');
                    toggleWindowState('exam', { isOpen: true, isMinimized: false, title: 'Mistakes Bank - Revision Session' });
                  }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Admin Dashboard Modal */}
      <AnimatePresence>
        {showAdminDash && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }}
              className="w-full max-w-3xl h-[80vh] bg-slate-900 border border-red-500/20 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-red-500/5">
                <span className="text-red-400 font-black uppercase tracking-widest text-sm">Root Administration</span>
                <button onClick={() => setShowAdminDash(false)} className="text-white/40 hover:text-red-400 transition-colors"><X size={20} /></button>
              </div>
              <div className="flex-1 overflow-hidden">
                <AdminDashboard user={user} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global CSS for custom colors and polish */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        
        :root {
          --font-sans: 'Inter', sans-serif;
        }

        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        .text-gold-400 { color: #fbbf24; }
        .bg-gold-400 { background-color: #fbbf24; }
        .border-gold-400 { border-color: #fbbf24; }
      `}</style>
    </div>
  );
}
