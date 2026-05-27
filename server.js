#!/usr/bin/env node
// server.js - UCBM Exam Simulator
console.log('[STARTUP] Starting UCBM Exam Simulator');
console.log('[STARTUP] Environment:', {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  XAI_KEY_SET: !!process.env.XAI_API_KEY
});

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { initKnowledgeBase, getCourse } from './knowledge-base.js';
import { SYSTEM_PROMPT } from './system-prompt.js';
import dotenv from 'dotenv';
dotenv.config();

// Global error handlers
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
});

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sessions = new Map();
let sessionCounter = 0;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ============================================================
// ROUTES
// ============================================================

// Health check (Railway uses this)
app.get('/health', (req, res) => {
  console.log('[HEALTH CHECK]');
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Static files (CSS, JS, index.html)
const publicPath = path.join(__dirname, 'public');
console.log('[STARTUP] Serving static files from:', publicPath);
app.use(express.static(publicPath));

// Course specs endpoint
app.get('/course-specs.json', (req, res) => {
  const filePath = path.join(__dirname, 'course-specs.json');
  console.log('[API] GET /course-specs.json from:', filePath);
  res.sendFile(filePath);
});

// API: List courses
app.get('/api/courses', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'course-specs.json'), 'utf8'));
    console.log('[API] GET /api/courses - returning', data.courses?.length || 0, 'courses');
    res.json({ success: true, courses: data.courses || [] });
  } catch (err) {
    console.error('[API ERROR] /api/courses:', err.message);
    res.status(500).json({ error: 'Failed to load courses' });
  }
});

// ============================================================
// XAI Grok Integration
// ============================================================

const XAI_API_KEY = process.env.XAI_API_KEY;
const XAI_MODEL = process.env.XAI_MODEL || 'grok-4';
const XAI_BASE_URL = process.env.XAI_BASE_URL || 'https://api.x.ai/v1';

if (!XAI_API_KEY) {
  console.warn('[STARTUP] WARNING: XAI_API_KEY not set - UI will load, exam features unavailable');
}

async function callGrok(systemPrompt, conversation, options = {}) {
  if (!XAI_API_KEY) {
    throw new Error('XAI_API_KEY not configured');
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

// ============================================================
// Session Management
// ============================================================

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
    messages: [],
    askedQuestions: [],
    scoreTracker: { correct: 0, total: 0 },
    hintHistory: {},
    uploads: [],
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

  if (course) {
    prompt += `\n\nCURRENT COURSE: ${course.name} (ID: ${session.courseId}, Year ${course.year || '?'}, Semester ${course.semester || '?'})`;
    prompt += `\nProfessor style: ${course.typical_oral_style || 'rigorous oral exam'}`;
    if (course.examFormat) {
      prompt += `\nExam format: ${JSON.stringify(course.examFormat)}`;
    }
  }

  if (session.isItalianCourse) {
    prompt += `\n\n**LANGUAGE MODE**: This is an Italian-language course. Conduct the exam primarily in Italian. Accept answers in Italian or English.`;
  }

  if (session.askedQuestions.length > 0) {
    prompt += `\n\n**PREVIOUSLY ASKED IN THIS SESSION (DO NOT REPEAT)**:\n`;
    prompt += session.askedQuestions.slice(-8).map((q, i) => `  ${i + 1}. ${q}`).join('\n');
  }

  if (session.uploads.length > 0) {
    prompt += `\n\n**STUDENT-UPLOADED MATERIALS**:\n`;
    for (const u of session.uploads.slice(-5)) {
      const excerpt = (u.content || '').slice(0, 4000);
      prompt += `\n--- ${u.filename} ---\n${excerpt}\n`;
    }
  }

  if (isFirstQuestion) {
    prompt += `\n\n**FIRST QUESTION**: Greet ${session.studentName}, introduce the course briefly, then ask the first realistic question immediately.`;
  } else {
    prompt += `\n\n**CONTINUE THE EXAM**: Give short feedback on the last answer, then ask the next non-repetitive question.`;
  }

  prompt += `\n\nCurrent question number: ${session.questionCount + 1}`;
  return prompt;
}

// ============================================================
// API: Exam Endpoints
// ============================================================

app.post('/api/exam/start', async (req, res) => {
  try {
    const { subject, studentName } = req.body || {};
    if (!subject) return res.status(400).json({ error: 'subject is required' });

    await initKnowledgeBase();

    const session = createSession(subject, studentName);
    console.log(`[EXAM] New session: ${session.id} - ${session.courseName}`);

    res.json({
      sessionId: session.id,
      courseName: session.courseName,
      isItalianCourse: session.isItalianCourse
    });
  } catch (err) {
    console.error('[EXAM START ERROR]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/exam/question', async (req, res) => {
  try {
    const { sessionId, studentAnswer } = req.body || {};
    const session = getSession(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const isFirst = session.questionCount === 0;
    const trimmedAnswer = (studentAnswer || '').trim();

    if (trimmedAnswer) {
      session.messages.push({ role: 'user', content: trimmedAnswer });
      const wordCount = trimmedAnswer.split(/\s+/).length;
      const looksSubstantive = wordCount >= 8 || trimmedAnswer.length > 60;
      if (looksSubstantive) {
        session.scoreTracker.total += 1;
        const technical = /[a-z]{6,}|equation|function|process|mechanism|structure|cell|force|energy|wave|signal|model/i.test(trimmedAnswer);
        if (technical || wordCount > 18) session.scoreTracker.correct += 1;
      }
    }

    const systemPrompt = buildSystemPromptForSession(session, isFirst);
    const recent = session.messages.slice(-12);

    let professorResponse;
    try {
      professorResponse = await callGrok(systemPrompt, recent, { temperature: isFirst ? 0.65 : 0.72 });
    } catch (apiErr) {
      console.error('[GROK API ERROR]', apiErr.message);
      return res.status(502).json({ error: 'LLM call failed', details: apiErr.message });
    }

    session.messages.push({ role: 'assistant', content: professorResponse });
    session.lastQuestion = professorResponse;
    session.questionCount += 1;
    session.askedQuestions.push(professorResponse.slice(0, 220));

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
    console.error('[EXAM QUESTION ERROR]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/exam/session/:id', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json({ scoreTracker: session.scoreTracker });
});

app.delete('/api/exam/session/:id', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const { correct, total } = session.scoreTracker;
  sessions.delete(req.params.id);

  res.json({ correct, total, sessionId: req.params.id, courseName: session.courseName });
});

app.post('/api/exam/hint', async (req, res) => {
  try {
    const { sessionId } = req.body || {};
    const session = getSession(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const context = session.lastQuestion || (session.messages.at(-1)?.content) || 'current topic';
    const langNote = session.isItalianCourse ? ' Respond in Italian.' : '';

    const hintPrompt = `You are a helpful UCBM biomedical engineering professor. Give ONE concise, high-value study hint (2-4 sentences). Be specific. Avoid giving the full answer.${langNote}\n\nContext:\n${context}`;

    const hint = await callGrok(hintPrompt, [], { temperature: 0.6, max_tokens: 350 });

    const qNum = session.questionCount || 1;
    if (!session.hintHistory[qNum]) session.hintHistory[qNum] = [];
    session.hintHistory[qNum].push({ hint, at: new Date().toISOString() });

    res.json({ textHint: hint });
  } catch (err) {
    console.error('[HINT ERROR]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/exam/hint-history/:id', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json({ hintHistory: session.hintHistory });
});

app.post('/api/exam/feedback', async (req, res) => {
  try {
    const { sessionId, questionIndex } = req.body || {};
    const session = getSession(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const studentTurns = session.messages.filter(m => m.role === 'user');
    const idx = Math.max(0, Math.min(questionIndex ?? studentTurns.length - 1, studentTurns.length - 1));
    const studentAnswer = studentTurns[idx]?.content || 'No answer recorded';

    const fbPrompt = `Provide structured feedback on this student answer (max 180 words). Cover: (1) What was good, (2) What was missing, (3) One improvement. Use bullets.\n\n${studentAnswer}`;

    const feedback = await callGrok(fbPrompt, [], { temperature: 0.5, max_tokens: 400 });
    res.json({ feedback });
  } catch (err) {
    console.error('[FEEDBACK ERROR]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/exam/upload/:sessionId', (req, res) => {
  const session = getSession(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const chunks = [];
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', () => {
    try {
      const buffer = Buffer.concat(chunks);
      const bufStr = buffer.toString('latin1');
      const filenameMatch = bufStr.match(/filename="([^"]+)"/i);
      const filename = (filenameMatch ? filenameMatch[1] : `material-${Date.now()}`).replace(/[^a-zA-Z0-9._-]/g, '_');

      const headerEnd = bufStr.indexOf('\r\n\r\n');
      let content = '[no content extracted]';
      let size = buffer.length;

      if (headerEnd !== -1) {
        const fileBuffer = buffer.slice(headerEnd + 4);
        size = fileBuffer.length;
        const looksLikeText = /\.(txt|md|csv|json|html?|js|ts|css)$/i.test(filename) || size < 65000;
        content = looksLikeText ? fileBuffer.toString('utf8').slice(0, 140000) : `[binary - ${size} bytes]`;
      }

      session.uploads.push({ filename, content, size, uploadedAt: new Date().toISOString() });
      res.json({ success: true, filename, size });
    } catch (e) {
      console.error('[UPLOAD ERROR]', e.message);
      res.status(400).json({ error: e.message });
    }
  });
});

// ============================================================
// SPA Fallback (serve index.html for all unmatched routes)
// ============================================================

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    console.log('[API 404]', req.path);
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  
  // Serve index.html for SPA routing
  const indexPath = path.join(publicPath, 'index.html');
  console.log('[SPA FALLBACK] Serving index.html from:', indexPath);
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('[SPA FALLBACK ERROR]', err.message);
      res.status(500).json({ error: 'Failed to load application' });
    }
  });
});

// ============================================================
// STARTUP
// ============================================================

const PORT = parseInt(process.env.PORT || '3000', 10);
console.log('[STARTUP] PORT resolved to:', PORT);

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[STARTUP] ✅ Server listening on port ${PORT}`);
  console.log(`[STARTUP] URL: http://0.0.0.0:${PORT}`);
  console.log(`[STARTUP] Health check: http://localhost:${PORT}/health`);
  console.log(`[STARTUP] XAI Model: ${XAI_MODEL}`);
  console.log('[STARTUP] Ready to accept requests');
});

server.on('error', (err) => {
  console.error('[SERVER ERROR]', err);
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('[SHUTDOWN] SIGTERM received');
  server.close(() => {
    console.log('[SHUTDOWN] Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[SHUTDOWN] SIGINT received');
  server.close(() => {
    console.log('[SHUTDOWN] Server closed');
    process.exit(0);
  });
});
