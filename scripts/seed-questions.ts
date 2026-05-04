/**
 * ScholarOS - Question Database Seeder
 * =====================================
 * This script fetches past questions from the ALOC API and seeds
 * your Firebase Firestore database.
 *
 * HOW TO RUN:
 *   1. Get a free ALOC API token at: https://questions.aloc.com.ng
 *   2. Add ALOC_API_TOKEN=your_token to your .env file
 *   3. Run: npx tsx scripts/seed-questions.ts
 *
 * ALOC API covers: JAMB (1978-present), WAEC, NECO, Post-UTME
 */

import axios from 'axios';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---- Firebase Setup ----
const firebaseConfigPath = path.join(__dirname, '..', 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
const clientApp = initializeApp(firebaseConfig, 'seeder-app');
const db = getFirestore(clientApp, firebaseConfig.firestoreDatabaseId);

// ---- ALOC API Setup ----
// Docs: https://questions.aloc.com.ng/doc
const ALOC_BASE = 'https://questions.aloc.com.ng/api/v2';
const ALOC_TOKEN = process.env.ALOC_API_TOKEN;

if (!ALOC_TOKEN) {
  console.error('\n[ERROR] ALOC_API_TOKEN is missing from your .env file.');
  console.error('Get a free token at: https://questions.aloc.com.ng\n');
  process.exit(1);
}

const alocClient = axios.create({
  baseURL: ALOC_BASE,
  headers: {
    'Accept': 'application/json',
    'AccessToken': ALOC_TOKEN,
  },
  timeout: 15000,
});

// ---- Types ----
interface ALOCQuestion {
  id: number;
  question: string;
  option: {
    a: string;
    b: string;
    c: string;
    d: string;
    e?: string;
  };
  answer: string; // 'a', 'b', 'c', or 'd'
  image?: string | null;
  solution?: string | null;
}

interface ScholarQuestion {
  alocId: number;
  text: string;
  options: { id: string; text: string }[];
  correctAnswer: string; // 'A', 'B', 'C', or 'D'
  explanation: string;
  topic: string;
  subject: string;
  exam: string;    // 'jamb', 'waec', 'neco'
  year: number;
  hasImage: boolean;
  seededAt: any;
}

// ---- Exam Subjects Mapping ----
// Maps ScholarOS subject names to ALOC API subject slugs
const JAMB_SUBJECTS: Record<string, string> = {
  'Mathematics':    'mathematics',
  'English':        'english',
  'Physics':        'physics',
  'Chemistry':      'chemistry',
  'Biology':        'biology',
  'Economics':      'economics',
  'Government':     'government',
  'Literature':     'literature-in-english',
  'Geography':      'geography',
  'Commerce':       'commerce',
  'Accounting':     'financial-accounting',
  'CRS':            'christian-religious-studies',
  'IRS':            'islamic-religious-studies',
};

const WAEC_SUBJECTS: Record<string, string> = {
  'Mathematics':    'mathematics',
  'English':        'english',
  'Physics':        'physics',
  'Chemistry':      'chemistry',
  'Biology':        'biology',
  'Economics':      'economics',
  'Government':     'government',
  'Literature':     'literature-in-english',
  'Geography':      'geography',
  'Commerce':       'commerce',
  'Accounting':     'financial-accounting',
  'CRS':            'christian-religious-studies',
  'Agricultural Science': 'agricultural-science',
  'Further Mathematics':  'further-mathematics',
};

// ---- Year Ranges ----
// JAMB started 1978, WAEC 1985 (digital records), NECO 2000
const YEAR_RANGES: Record<string, { start: number; end: number }> = {
  jamb: { start: 2000, end: new Date().getFullYear() }, // Start from 2000 for clean data
  waec: { start: 2005, end: new Date().getFullYear() },
  neco: { start: 2005, end: new Date().getFullYear() },
};

// ---- Topic Detector ----
// Assigns a topic label to each question based on keywords in the text.
// This powers the "Weakness Detection" and "Scholar-Print" AI features.
function detectTopic(questionText: string, subject: string): string {
  const text = questionText.toLowerCase();

  if (subject === 'Mathematics' || subject === 'Further Mathematics') {
    if (text.includes('log') || text.includes('logarithm')) return 'Logarithms';
    if (text.includes('quadratic') || text.includes('roots of')) return 'Quadratic Equations';
    if (text.includes('integral') || text.includes('integrat')) return 'Integration';
    if (text.includes('differenti') || text.includes('dy/dx') || text.includes('gradient')) return 'Differentiation';
    if (text.includes('surd') || text.includes('√') || text.includes('square root')) return 'Surds';
    if (text.includes('matrix') || text.includes('matrices') || text.includes('determinant')) return 'Matrices';
    if (text.includes('arithmetic progression') || text.includes('geometric progression') || text.includes('sequence')) return 'Sequences & Series';
    if (text.includes('probability')) return 'Probability';
    if (text.includes('statistic') || text.includes('mean') || text.includes('median') || text.includes('mode')) return 'Statistics';
    if (text.includes('circle') || text.includes('triangle') || text.includes('angle') || text.includes('polygon')) return 'Geometry';
    if (text.includes('sin') || text.includes('cos') || text.includes('tan') || text.includes('trig')) return 'Trigonometry';
    if (text.includes('set') || text.includes('union') || text.includes('intersection')) return 'Sets';
    if (text.includes('vector')) return 'Vectors';
    if (text.includes('binary') || text.includes('base')) return 'Number Bases';
    if (text.includes('fraction') || text.includes('ratio') || text.includes('proportion')) return 'Fractions & Ratios';
    if (text.includes('permut') || text.includes('combinat')) return 'Permutation & Combination';
    return 'Algebra';
  }

  if (subject === 'Physics') {
    if (text.includes('wave') || text.includes('frequenc') || text.includes('wavelength')) return 'Waves';
    if (text.includes('electric') || text.includes('current') || text.includes('volt') || text.includes('resist')) return 'Electricity';
    if (text.includes('motion') || text.includes('velocity') || text.includes('acceleration') || text.includes('speed')) return 'Motion & Kinematics';
    if (text.includes('force') || text.includes('newton') || text.includes('momentum')) return 'Forces & Newton\'s Laws';
    if (text.includes('light') || text.includes('refract') || text.includes('reflect') || text.includes('lens')) return 'Light & Optics';
    if (text.includes('heat') || text.includes('temperature') || text.includes('thermal') || text.includes('latent')) return 'Heat & Temperature';
    if (text.includes('magnet') || text.includes('electromagn')) return 'Magnetism';
    if (text.includes('nuclear') || text.includes('radioact') || text.includes('atom')) return 'Atomic & Nuclear Physics';
    if (text.includes('pressure') || text.includes('fluid') || text.includes('density') || text.includes('archimed')) return 'Pressure & Fluids';
    if (text.includes('energy') || text.includes('power') || text.includes('work done')) return 'Energy & Power';
    if (text.includes('sound') || text.includes('echo') || text.includes('resonanc')) return 'Sound';
    return 'General Physics';
  }

  if (subject === 'Chemistry') {
    if (text.includes('organic') || text.includes('alkane') || text.includes('alkene') || text.includes('alcohol')) return 'Organic Chemistry';
    if (text.includes('acid') || text.includes('base') || text.includes('ph') || text.includes('neutraliz')) return 'Acids, Bases & Salts';
    if (text.includes('mole') || text.includes('stoichiom') || text.includes('empirical formula')) return 'Mole Concept';
    if (text.includes('electrolys') || text.includes('electrolyte') || text.includes('electrode')) return 'Electrochemistry';
    if (text.includes('periodic') || text.includes('element') || text.includes('group') || text.includes('period')) return 'Periodic Table';
    if (text.includes('bond') || text.includes('ionic') || text.includes('covalent') || text.includes('metallic')) return 'Chemical Bonding';
    if (text.includes('equilibrium') || text.includes('le chatelier')) return 'Chemical Equilibrium';
    if (text.includes('kinetic') || text.includes('rate of reaction')) return 'Reaction Rates';
    if (text.includes('gas') || text.includes('boyle') || text.includes('charles')) return 'Gas Laws';
    if (text.includes('nuclear') || text.includes('radioact')) return 'Nuclear Chemistry';
    return 'General Chemistry';
  }

  if (subject === 'Biology') {
    if (text.includes('genetic') || text.includes('heredit') || text.includes('mendel') || text.includes('dna') || text.includes('chromosome')) return 'Genetics & Heredity';
    if (text.includes('cell') || text.includes('mitosis') || text.includes('meiosis') || text.includes('organelle')) return 'Cell Biology';
    if (text.includes('photosynthes') || text.includes('chlorophyll') || text.includes('respiration')) return 'Photosynthesis & Respiration';
    if (text.includes('ecosystem') || text.includes('ecology') || text.includes('food chain') || text.includes('food web')) return 'Ecology';
    if (text.includes('classif') || text.includes('taxonomy') || text.includes('kingdom')) return 'Classification';
    if (text.includes('evolution') || text.includes('darwin') || text.includes('natural selection')) return 'Evolution';
    if (text.includes('nutrition') || text.includes('digest') || text.includes('enzyme')) return 'Nutrition & Digestion';
    if (text.includes('blood') || text.includes('circulat') || text.includes('heart') || text.includes('artery')) return 'Circulatory System';
    if (text.includes('nerve') || text.includes('neuron') || text.includes('brain') || text.includes('reflex')) return 'Nervous System';
    if (text.includes('reproduct') || text.includes('fertiliz') || text.includes('pollination')) return 'Reproduction';
    return 'General Biology';
  }

  if (subject === 'English') {
    if (text.includes('comprehension') || text.includes('passage')) return 'Comprehension';
    if (text.includes('grammar') || text.includes('verb') || text.includes('noun') || text.includes('adjective')) return 'Grammar';
    if (text.includes('lexis') || text.includes('vocabular') || text.includes('synonym') || text.includes('antonym')) return 'Lexis & Structure';
    if (text.includes('oral') || text.includes('phonetics') || text.includes('stress') || text.includes('intonat')) return 'Oral English';
    if (text.includes('essay') || text.includes('letter') || text.includes('formal writing')) return 'Essay & Letter Writing';
    if (text.includes('figure of speech') || text.includes('metaphor') || text.includes('simile')) return 'Figures of Speech';
    return 'Summary & Comprehension';
  }

  return `${subject} - General`;
}

// ---- Transformer ----
// Converts raw ALOC API response into ScholarOS Question format
function transformQuestion(
  raw: ALOCQuestion,
  subject: string,
  exam: string,
  year: number
): ScholarQuestion {
  const correctAnswerUpper = (raw.answer || 'a').toUpperCase();

  // ALOC image URLs follow the pattern: /storage/questions/{id}.png
  const imageUrl = raw.image
    ? (raw.image.startsWith('http') ? raw.image : `https://questions.aloc.com.ng${raw.image}`)
    : null;

  return {
    alocId: raw.id,
    text: raw.question,
    options: [
      { id: 'A', text: raw.option?.a || '' },
      { id: 'B', text: raw.option?.b || '' },
      { id: 'C', text: raw.option?.c || '' },
      { id: 'D', text: raw.option?.d || '' },
    ].filter(opt => opt.text.trim() !== ''),
    correctAnswer: correctAnswerUpper,
    explanation: raw.solution || `The correct answer is ${correctAnswerUpper}.`,
    topic: detectTopic(raw.question, subject),
    subject,
    exam,
    year,
    hasImage: !!raw.image,
    imageUrl,
    seededAt: serverTimestamp(),
  };
}

// ---- Rate Limiter ----
// Prevents hammering the ALOC API and getting rate-limited
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---- Firestore Batch Writer ----
// Writes up to 500 questions at once (Firestore batch limit)
async function batchWriteQuestions(questions: ScholarQuestion[]): Promise<number> {
  let written = 0;
  const BATCH_SIZE = 400; // Stay well under Firestore's 500 limit

  for (let i = 0; i < questions.length; i += BATCH_SIZE) {
    const chunk = questions.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);

    for (const q of chunk) {
      // Document ID format: jamb_mathematics_2020_12345
      const docId = `${q.exam}_${q.subject.toLowerCase().replace(/\s+/g, '_')}_${q.year}_${q.alocId}`;
      const docRef = doc(collection(db, 'questions'), docId);
      batch.set(docRef, q);
    }

    await batch.commit();
    written += chunk.length;
    console.log(`    Batch committed: ${written} questions written so far`);
    await sleep(500); // Pause between batches
  }

  return written;
}

// ---- AI Explanation Generator ----
// Called when ALOC returns no solution for a question.
// Uses Gemini to generate a clear, WAEC/JAMB-style explanation.
async function generateExplanation(question: ALOCQuestion, subject: string, correctAnswer: string): Promise<string> {
  const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) return `The correct answer is ${correctAnswer}.`;

  try {
    const prompt = `You are a Nigerian exam tutor. For this ${subject} question:

Question: ${question.question}
Options: A) ${question.option?.a}  B) ${question.option?.b}  C) ${question.option?.c}  D) ${question.option?.d}
Correct Answer: ${correctAnswer.toUpperCase()}

Write a SHORT (2-3 sentence) clear explanation of why ${correctAnswer.toUpperCase()} is correct. 
Use LaTeX for any math: $formula$. Be direct and educational. Nigerian WAEC/JAMB syllabus context.`;

    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    if (!res.ok) return `The correct answer is ${correctAnswer}.`;
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || `The correct answer is ${correctAnswer}.`;
  } catch {
    return `The correct answer is ${correctAnswer}.`;
  }
}

// ---- Core Fetcher ----
// Fetches all questions for one exam + subject + year combination
async function fetchSubjectYear(
  examType: string,
  alocSubjectSlug: string,
  subjectName: string,
  year: number
): Promise<ScholarQuestion[]> {
  const questions: ScholarQuestion[] = [];

  try {
    const response = await alocClient.get('/q', {
      params: {
        subject: alocSubjectSlug,
        year,
        type: examType,
      }
    });

    const rawQuestions: ALOCQuestion[] = response.data?.data || response.data || [];

    if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
      return [];
    }

    for (const raw of rawQuestions) {
      if (raw.question && raw.option && raw.answer) {
        let q = transformQuestion(raw, subjectName, examType, year);
        
        // If ALOC provided no explanation, generate one with AI
        // Only do this for ~20% of questions to avoid rate limits and cost
        if (!raw.solution && Math.random() < 0.2) {
          await sleep(200); // Small delay to avoid API hammering
          q.explanation = await generateExplanation(raw, subjectName, raw.answer);
        }
        
        questions.push(q);
      }
    }

  } catch (err: any) {
    const status = err.response?.status;
    if (status === 404) {
      // No questions for this combination - normal, skip silently
    } else if (status === 429) {
      console.warn(`    Rate limited. Waiting 10 seconds...`);
      await sleep(10000);
    } else {
      console.warn(`    API error (${status || 'network'}): ${err.message}`);
    }
  }

  return questions;
}

// ---- Check if already seeded ----
async function isAlreadySeeded(exam: string, subject: string, year: number): Promise<boolean> {
  const q = query(
    collection(db, 'questions'),
    where('exam', '==', exam),
    where('subject', '==', subject),
    where('year', '==', year)
  );
  const snapshot = await getDocs(q);
  return !snapshot.empty;
}

// ---- Main Seeder ----
async function seedExam(examType: 'jamb' | 'waec' | 'neco'): Promise<void> {
  const subjects = examType === 'jamb' ? JAMB_SUBJECTS : WAEC_SUBJECTS;
  const { start, end } = YEAR_RANGES[examType];
  const years = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`SEEDING: ${examType.toUpperCase()} | Years: ${start}-${end} | Subjects: ${Object.keys(subjects).length}`);
  console.log(`${'='.repeat(60)}`);

  let totalFetched = 0;

  for (const [subjectName, alocSlug] of Object.entries(subjects)) {
    console.log(`\n[${subjectName}]`);

    for (const year of years) {
      process.stdout.write(`  ${year}: `);

      // Skip if already seeded to allow resuming interrupted runs
      const alreadyDone = await isAlreadySeeded(examType, subjectName, year);
      if (alreadyDone) {
        process.stdout.write('SKIP (already seeded)\n');
        continue;
      }

      const questions = await fetchSubjectYear(examType, alocSlug, subjectName, year);

      if (questions.length === 0) {
        process.stdout.write('0 questions found\n');
      } else {
        process.stdout.write(`${questions.length} questions found. Writing...\n`);
        await batchWriteQuestions(questions);
        totalFetched += questions.length;
      }

      // Be respectful to the ALOC API: 1 request per second
      await sleep(1000);
    }
  }

  console.log(`\n[DONE] ${examType.toUpperCase()}: ${totalFetched} total questions seeded.\n`);
}

// ---- Entry Point ----
async function main() {
  console.log('\n========================================');
  console.log('  ScholarOS Question Database Seeder   ');
  console.log('========================================\n');

  // Parse command line argument: npm run seed -- jamb
  const target = process.argv[2] as 'jamb' | 'waec' | 'neco' | 'all' | undefined;

  if (!target || !['jamb', 'waec', 'neco', 'all'].includes(target)) {
    console.log('Usage:');
    console.log('  npx tsx scripts/seed-questions.ts jamb   # Seed JAMB only');
    console.log('  npx tsx scripts/seed-questions.ts waec   # Seed WAEC only');
    console.log('  npx tsx scripts/seed-questions.ts neco   # Seed NECO only');
    console.log('  npx tsx scripts/seed-questions.ts all    # Seed everything\n');
    process.exit(0);
  }

  const toSeed = target === 'all' ? ['jamb', 'waec', 'neco'] : [target];

  for (const exam of toSeed) {
    await seedExam(exam as 'jamb' | 'waec' | 'neco');
  }

  console.log('\nAll seeding complete. Your ScholarOS database is live.');
  process.exit(0);
}

main().catch(err => {
  console.error('\n[FATAL]', err.message);
  process.exit(1);
});
