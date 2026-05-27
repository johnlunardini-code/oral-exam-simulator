#!/usr/bin/env node
// server.js - UCBM Exam Simulator
console.log('[START]', new Date().toISOString());

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { initKnowledgeBase, getCourse } from './knowledge-base.js';
import { SYSTEM_PROMPT } from './system-prompt.js';
import dotenv from 'dotenv';
dotenv.config();

process.on('uncaughtException', (err) => {
  console.error('[FATAL]', err.message);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL]', reason);
  process.exit(1);
});

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sessions = new Map();
let sessionCounter = 0;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Log all requests
app.use((req, res, next) => {
  console.log('[REQ]', req.method, req.path, req.query);
  res.on('finish', () => {
    console.log('[RES]', req.method, req.path, res.statusCode);
  });
  next();
});

const publicPath = path.join(__dirname, 'public');

// ============================================================
// ROUTES
// ============================================================

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.use(express.static(publicPath));

app.get('/course-specs.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'course-specs.json'));
});

app.get('/api/courses', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'course-specs.json'), 'utf8'));
    res.json({ success: true, courses: data.courses || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// XAI Grok Integration
// ============================================================

const XAI_API_KEY = process.env.XAI_API_KEY;
const XAI_MODEL = process.env.XAI_MODEL || 'grok-4';
const XAI_BASE_URL = process.env.XAI_BASE_URL || 'https://api.x.ai/v1';

async function callGrok(systemPrompt, conversation, options = {}) {
  if (!XAI_API_KEY) throw new Error('XAI_API_KEY not set');

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

  if (!response.ok) throw new Error(`xAI error ${response.status}`);

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
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
  return {
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
}

function getSession(sessionId) {
  return sessions.get(sessionId);
}

function buildSystemPromptForSession(session, isFirstQuestion = false) {
  const course = getCourse(session.courseId);
  let prompt = SYSTEM_PROMPT;

  if (course) {
    prompt += `\n\nCURRENT COURSE: ${course.name}`;
    if (course.examFormat) {
      prompt += `\nExam format: ${JSON.stringify(course.examFormat)}`;
    }
  }

  if (session.isItalianCourse) {
    prompt += `\n\nLANGUAGE: Italian`;
  }

  if (session.askedQuestions.length > 0) {
    prompt += `\n\nPREVIOUS: ${session.askedQuestions.slice(-3).join(' | ')}`;
  }

  if (isFirstQuestion) {
    prompt += `\n\nGreet the student and ask the first question.`;
  }

  return prompt;
}

// ============================================================
// API: Exam Endpoints
// ============================================================

app.post('/api/exam/start', async (req, res) => {
  try {
    const { subject, studentName } = req.body || {};
    if (!subject) return res.status(400).json({ error: 'subject required' });

    const session = createSession(subject, studentName);
    sessions.set(session.id, session);

    res.json({
      sessionId: session.id,
      courseName: session.courseName,
      isItalianCourse: session.isItalianCourse
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/exam/question', async (req, res) => {
  try {
    const { sessionId, studentAnswer } = req.body || {};
    const session = getSession(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    if ((studentAnswer || '').trim()) {
      session.messages.push({ role: 'user', content: studentAnswer });
      session.scoreTracker.total += 1;
      if ((studentAnswer || '').length > 20) session.scoreTracker.correct += 1;
    }

    const systemPrompt = buildSystemPromptForSession(session, session.questionCount === 0);
    const recent = session.messages.slice(-12);

    const professorResponse = await callGrok(systemPrompt, recent);

    session.messages.push({ role: 'assistant', content: professorResponse });
    session.lastQuestion = professorResponse;
    session.questionCount += 1;

    res.json({
      response: professorResponse,
      questionNumber: session.questionCount,
      scoreTracker: session.scoreTracker
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/exam/session/:id', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Not found' });
  res.json({ scoreTracker: session.scoreTracker });
});

app.delete('/api/exam/session/:id', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Not found' });

  const { correct, total } = session.scoreTracker;
  sessions.delete(req.params.id);

  res.json({ correct, total, sessionId: req.params.id, courseName: session.courseName });
});

app.post('/api/exam/hint', async (req, res) => {
  try {
    const { sessionId } = req.body || {};
    const session = getSession(sessionId);
    if (!session) return res.status(404).json({ error: 'Not found' });

    const hint = await callGrok('Give a brief study hint.', []);
    res.json({ textHint: hint });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/exam/hint-history/:id', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Not found' });
  res.json({ hintHistory: session.hintHistory });
});

app.post('/api/exam/feedback', async (req, res) => {
  try {
    const { sessionId } = req.body || {};
    const session = getSession(sessionId);
    if (!session) return res.status(404).json({ error: 'Not found' });

    const feedback = await callGrok('Provide feedback.', []);
    res.json({ feedback });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/exam/upload/:sessionId', (req, res) => {
  const session = getSession(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Not found' });

  const chunks = [];
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', () => {
    try {
      const buffer = Buffer.concat(chunks);
      const filename = `material-${Date.now()}`;
      session.uploads.push({ filename, size: buffer.length });
      res.json({ success: true, filename, size: buffer.length });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
});

// SPA Fallback
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(publicPath, 'index.html'));
});

// ============================================================
// STARTUP
// ============================================================

async function start() {
  try {
    console.log('[INIT] Loading knowledge base...');
    await initKnowledgeBase();
    console.log('[INIT] Done');

    const PORT = parseInt(process.env.PORT || '3000', 10);
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`[LISTEN] Port ${PORT}`);
    });

    server.on('error', (err) => {
      console.error('[ERROR]', err.message);
      process.exit(1);
    });

    process.on('SIGTERM', () => {
      console.log('[TERM]');
      server.close(() => process.exit(0));
    });
  } catch (err) {
    console.error('[FAIL]', err.message);
    process.exit(1);
  }
}

start();
