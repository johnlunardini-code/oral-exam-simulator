#!/usr/bin/env node
// server.js
console.log('[STARTUP] Starting UCBM Exam Simulator');

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { initKnowledgeBase, getCourse, getCourseContext } from './knowledge-base.js';
import { SYSTEM_PROMPT } from './system-prompt.js';
import dotenv from 'dotenv';
dotenv.config(); // loads .env if present (harmless on Railway)

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// In-memory exam sessions (sufficient for Railway single-instance deploys)
const sessions = new Map();
let sessionCounter = 0;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve the UI (this is the most important part)
app.use(express.static(path.join(__dirname, 'public')));

// Make course-specs.json directly available to the frontend (fixes the 404 on loadCoursesFromJSON)
app.get('/course-specs.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'course-specs.json'));
});

// Explicit root route - fixes Bad Gateway / cold start issues on Railway
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check (used by Railway and load balancers)
app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// Basic courses list (kept for compatibility)
app.get('/api/courses', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'course-specs.json'), 'utf8'));
    res.json({ success: true, courses: data.courses || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load courses' });
  }
});

/* ============================================================
   XAI (Grok) integration - OpenAI-compatible endpoint
   ============================================================ */

const XAI_API_KEY = process.env.XAI_API_KEY;
const XAI_MODEL = process.env.XAI_MODEL || 'grok-4';
const XAI_BASE_URL = process.env.XAI_BASE_URL || 'https://api.x.ai/v1';

if (!XAI_API_KEY) {
  console.warn('[STARTUP] WARNING: XAI_API_KEY is not set. The exam simulator will not be able to generate questions.');
}

async function callGrok(systemPrompt, conversation, options = {}) {
  if (!XAI_API_KEY) {
    throw new Error('XAI_API_KEY is not configured on the server');
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversation
  ];

  const response = await fetch(`${XAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${XAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: XAI_MODEL,
      messages,
      temperature: options.temperature ?? 0.75,
      max_tokens: options.max_tokens ?? 1200
    })
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`xAI API error ${response.status}: ${text.slice(0, 300)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('Empty response from Grok');

  return content;
}

/* ============================================================
   Session helpers
   ============================================================ */

function createSession(courseId, studentName) {
  const course = getCourse(courseId);
  const courseName = course ? course.name : courseId;
  const isItalianCourse = courseId === 'italian' || courseId === 'technical-italian' || 
                          (course && (course.name || '').toLowerCase().includes('italian'));

  const sessionId = `sess_${Date.now()}_${++sessionCounter}`;
  const session = {
    id: sessionId,
    courseId,
    courseName,
    studentName: studentName || 'Student',
    isItalianCourse,
    createdAt: new Date().toISOString(),
    messages: [],                    // full conversation for LLM
    askedQuestions: [],              // strings of previous questions (for anti-repetition)
    scoreTracker: { correct: 0, total: 0 },
    hintHistory: {},                 // { [questionNumber]: [{hint, at: iso}] }
    uploads: [],                     // [{ filename, content, size, uploadedAt }]
    questionCount: 0,
    lastQuestion: null
  };

  sessions.set(sessionId, session);
  return session;
}

function getSession(sessionId) {
  return sessions.get(sessionId);
}

function buildSystemPromptForSession(session, isFirstQuestion = false) {
  const course = getCourse(session.courseId);
  let prompt = SYSTEM_PROMPT;

  // Inject concrete course information
  if (course) {
    prompt += `\n\nCURRENT COURSE: ${course.name} (ID: ${session.courseId}, Year ${course.year || '?'}, Semester ${course.semester || '?'})`;
    prompt += `\nProfessor style: ${course.typical_oral_style || 'rigorous oral exam'}`;
    if (course.examFormat) {
      prompt += `\nExam format: ${JSON.stringify(course.examFormat)}`;
    }
  }

  // Language directive
  if (session.isItalianCourse) {
    prompt += `\n\n**LANGUAGE MODE**: This is an Italian-language course. Conduct the exam primarily in Italian. Accept answers in Italian or English. When the student speaks Italian, respond in Italian.`;
  }

  // Previously asked questions (anti-repetition)
  if (session.askedQuestions.length > 0) {
    prompt += `\n\n**PREVIOUSLY ASKED IN THIS SESSION (DO NOT REPEAT THESE OR CLOSE VARIANTS)**:\n`;
    prompt += session.askedQuestions.slice(-8).map((q, i) => `  ${i + 1}. ${q}`).join('\n');
  }

  // Student uploaded materials for THIS session
  if (session.uploads.length > 0) {
    prompt += `\n\n**STUDENT-UPLOADED MATERIALS (treat as primary source)**:\n`;
    for (const u of session.uploads.slice(-5)) {
      const excerpt = (u.content || '').slice(0, 4000);
      prompt += `\n--- ${u.filename} (${u.size || 0} bytes) ---\n${excerpt}\n`;
    }
  }

  if (isFirstQuestion) {
    prompt += `\n\n**FIRST QUESTION INSTRUCTIONS**:
- Greet the student by name (${session.studentName}).
- Briefly state the course and that this is a realistic oral exam practice.
- Ask the FIRST high-quality, course-specific question immediately.
- Do not ask for confirmation before the first question.`;
  } else {
    prompt += `\n\n**CONTINUE THE EXAM**:
Ask the next focused, non-repetitive question. After the student's last answer, give 1-3 sentences of constructive professor-style feedback, then ask a natural follow-up.`;
  }

  prompt += `\n\nCurrent question number in this session: ${session.questionCount + 1}`;
  return prompt;
}

/* ============================================================
   Core Exam API Endpoints
   ============================================================ */

// POST /api/exam/start
app.post('/api/exam/start', async (req, res) => {
  try {
    const { subject, studentName } = req.body || {};
    if (!subject) return res.status(400).json({ error: 'subject is required' });

    await initKnowledgeBase(); // ensure courses are loaded

    const session = createSession(subject, studentName);
    console.log(`[EXAM] New session ${session.id} for ${session.courseName} (${session.isItalianCourse ? 'Italian' : 'English'})`);

    res.json({
      sessionId: session.id,
      courseName: session.courseName,
      isItalianCourse: session.isItalianCourse
    });
  } catch (err) {
    console.error('start error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/exam/question  — the heart of the simulator
app.post('/api/exam/question', async (req, res) => {
  try {
    const { sessionId, studentAnswer } = req.body || {};
    const session = getSession(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const isFirst = session.questionCount === 0;
    const trimmedAnswer = (studentAnswer || '').trim();

    // Record the student's answer (if any)
    if (trimmedAnswer) {
      session.messages.push({ role: 'user', content: trimmedAnswer });
      // Simple heuristic scoring on the fly (cheap, no extra LLM call)
      const wordCount = trimmedAnswer.split(/\s+/).length;
      const looksSubstantive = wordCount >= 8 || trimmedAnswer.length > 60;
      if (looksSubstantive) {
        session.scoreTracker.total += 1;
        // Lightweight "correct" signal (length + some presence of technical words)
        const technical = /[a-z]{6,}|equation|function|process|mechanism|structure|cell|tissue|force|energy|wave|signal|model|analysis/i.test(trimmedAnswer);
        if (technical || wordCount > 18) session.scoreTracker.correct += 1;
      }
    }

    // Build the prompt for Grok
    const systemPrompt = buildSystemPromptForSession(session, isFirst);

    // Construct recent conversation for the model (keep last ~12 turns to stay under limits)
    const recent = session.messages.slice(-12);

    let professorResponse;
    try {
      professorResponse = await callGrok(systemPrompt, recent, { temperature: isFirst ? 0.65 : 0.72 });
    } catch (apiErr) {
      console.error('Grok call failed:', apiErr.message);
      return res.status(502).json({ error: 'LLM call failed', details: apiErr.message });
    }

    // Store the professor turn
    session.messages.push({ role: 'assistant', content: professorResponse });
    session.lastQuestion = professorResponse;
    session.questionCount += 1;
    session.askedQuestions.push(professorResponse.slice(0, 220)); // for variety guard

    // Occasional hypothetical score (every ~5-6 questions, not spammy)
    let hypotheticalScore = null;
    if (session.questionCount % 5 === 0 && session.scoreTracker.total > 0) {
      const pct = Math.round((session.scoreTracker.correct / session.scoreTracker.total) * 100);
      hypotheticalScore = Math.round(pct * 30 / 100);
    }

    res.json({
      response: professorResponse,
      questionNumber: session.questionCount,
      hypotheticalScore,
      scoreTracker: session.scoreTracker
    });
  } catch (err) {
    console.error('question error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/exam/session/:id  — used by "Get Score" button
app.get('/api/exam/session/:id', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json({ scoreTracker: session.scoreTracker });
});

// DELETE /api/exam/session/:id  — ends the exam and returns final score data
app.delete('/api/exam/session/:id', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const { correct, total } = session.scoreTracker;
  // Clean up memory
  sessions.delete(req.params.id);

  res.json({
    correct,
    total,
    sessionId: req.params.id,
    courseName: session.courseName
  });
});

// POST /api/exam/hint  — generate a study hint for the current topic
app.post('/api/exam/hint', async (req, res) => {
  try {
    const { sessionId } = req.body || {};
    const session = getSession(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const context = session.lastQuestion || (session.messages.at(-1)?.content) || 'the current exam topic';
    const langNote = session.isItalianCourse ? ' Respond in Italian.' : '';

    const hintPrompt = `You are a helpful UCBM biomedical engineering professor. Give the student ONE concise, high-value study hint (2-4 sentences) that directly helps them answer or understand the current question better. Focus on a key concept, common pitfall, or the exact angle the professor is likely testing. Be specific to the course material. Avoid giving the full answer.${langNote}\n\nCurrent context:\n${context}`;

    const hint = await callGrok(hintPrompt, [], { temperature: 0.6, max_tokens: 350 });

    const qNum = session.questionCount || 1;
    if (!session.hintHistory[qNum]) session.hintHistory[qNum] = [];
    session.hintHistory[qNum].push({ hint, at: new Date().toISOString() });

    res.json({ textHint: hint });
  } catch (err) {
    console.error('hint error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/exam/hint-history/:id
app.get('/api/exam/hint-history/:id', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json({ hintHistory: session.hintHistory });
});

// POST /api/exam/feedback  — detailed structured feedback for one student answer
app.post('/api/exam/feedback', async (req, res) => {
  try {
    const { sessionId, questionIndex } = req.body || {};
    const session = getSession(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    // Find the relevant student answer + professor question around that index
    const studentTurns = session.messages.filter(m => m.role === 'user');
    const idx = Math.max(0, Math.min(questionIndex ?? studentTurns.length - 1, studentTurns.length - 1));
    const studentAnswer = studentTurns[idx]?.content || 'No answer recorded';

    const fbPrompt = `You are a rigorous but fair UCBM oral exam examiner. Provide structured, constructive feedback on the student's answer below (max 180 words). Cover: (1) What was accurate/good, (2) What was missing or imprecise, (3) One specific improvement suggestion. Use bullet points. Be encouraging but precise.\n\nStudent answer:\n${studentAnswer}`;

    const feedback = await callGrok(fbPrompt, [], { temperature: 0.5, max_tokens: 400 });
    res.json({ feedback });
  } catch (err) {
    console.error('feedback error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/exam/upload/:sessionId  — accept student materials (FormData) without extra deps
app.post('/api/exam/upload/:sessionId', (req, res) => {
  const session = getSession(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const chunks = [];
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', () => {
    try {
      const buffer = Buffer.concat(chunks);
      const bufStr = buffer.toString('latin1');

      // Extract filename from multipart header
      const filenameMatch = bufStr.match(/filename="([^"]+)"/i);
      const filename = (filenameMatch ? filenameMatch[1] : `material-${Date.now()}`).replace(/[^a-zA-Z0-9._-]/g, '_');

      // Find start of file content (after first \r\n\r\n)
      const headerEnd = bufStr.indexOf('\r\n\r\n');
      let content = '[no content extracted]';
      let size = buffer.length;

      if (headerEnd !== -1) {
        const fileBuffer = buffer.slice(headerEnd + 4);
        size = fileBuffer.length;

        const looksLikeText = /\.(txt|md|csv|json|html?|js|ts|css|log)$/i.test(filename) || size < 65000;
        if (looksLikeText) {
          content = fileBuffer.toString('utf8').slice(0, 140000);
        } else {
          content = `[binary or large file - ${size} bytes]`;
        }
      }

      session.uploads.push({
        filename,
        content,
        size,
        uploadedAt: new Date().toISOString()
      });

      console.log(`[UPLOAD] ${filename} → session ${session.id} (${size} bytes)`);
      res.json({ success: true, filename, size });
    } catch (e) {
      res.status(400).json({ error: 'Failed to parse upload: ' + e.message });
    }
  });
  req.on('error', e => res.status(400).json({ error: e.message }));
});

/* ============================================================
   SPA fallback (must be LAST)
   ============================================================ */
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* ============================================================
   Startup
   ============================================================ */

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 UCBM Exam Simulator running on port ${PORT}`);
  console.log(`   Model: ${XAI_MODEL} via ${XAI_BASE_URL}`);
  if (!XAI_API_KEY) {
    console.log('   ⚠️  No XAI_API_KEY — exam endpoints will return 500 until the key is provided.');
  }
  try {
    await initKnowledgeBase();
    console.log('   ✅ Knowledge base initialized');
  } catch (e) {
    console.error('   ❌ Knowledge base init failed:', e.message);
  }
});