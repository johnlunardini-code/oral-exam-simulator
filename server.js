#!/usr/bin/env node
// server.js
console.log('[STARTUP] Starting UCBM Exam Simulator');

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { initKnowledgeBase, getCourseContext, addStudentMaterial, retrieveRelevantContext, getCourse } from './knowledge-base.js';
import { SYSTEM_PROMPT } from './system-prompt.js';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

console.log('[STARTUP] All imports successful');

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Session storage
const examSessions = {};

function generateSessionId() {
  return 'session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

// === COURSES ENDPOINT ===
app.get('/api/courses', (req, res) => {
  try {
    const coursesData = JSON.parse(fs.readFileSync(path.join(__dirname, 'course-specs.json'), 'utf8'));
    res.json({ success: true, courses: coursesData.courses || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load courses' });
  }
});

// === UPLOAD ENDPOINT ===
app.post('/api/upload', async (req, res) => {
  try {
    const { studentId, courseId, fileType, content, metadata } = req.body;
    await addStudentMaterial(studentId, courseId, fileType, content, metadata);
    res.json({ success: true, message: 'Material added' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === EXAM START ===
app.post('/api/exam/start', async (req, res) => {
  try {
    const { subject, studentName } = req.body;
    const course = getCourse(subject);
    if (!course) return res.status(404).json({ error: 'Course not found' });

    const sessionId = generateSessionId();
    examSessions[sessionId] = {
      courseId: subject,
      courseName: course.name,
      studentName,
      questions: [],
      answers: [],
      createdAt: new Date()
    };

    res.json({ success: true, sessionId, courseName: course.name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === GET NEXT QUESTION (FIXED - uses real prompt + xAI) ===
app.post('/api/exam/question', async (req, res) => {
  try {
    const { sessionId, studentAnswer } = req.body;
    const session = examSessions[sessionId];
    if (!session) return res.status(404).json({ error: 'Session not found' });

    if (studentAnswer) session.answers.push(studentAnswer);

    const courseContext = await getCourseContext(session.courseId);
    const course = courseContext.courseSpecs;

    const userMessage = `${SYSTEM_PROMPT}

Current course: ${course.name} (${course.code})
Professor: ${course.professor}
Exam Mode: Oral
Previous answers: ${JSON.stringify(session.answers.slice(-3))}

Generate the NEXT challenging university-level question for this oral exam.`;

    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return res.json({ success: true, response: "Demo question - XAI key not set" });
    }

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'grok-2',
        messages: [
          { role: 'system', content: 'You are a strict but fair UCBM professor conducting an oral exam.' },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.85,
        max_tokens: 800
      })
    });

    const data = await response.json();
    const aiQuestion = data.choices?.[0]?.message?.content || 'No question generated';

    session.questions.push(aiQuestion);

    res.json({
      success: true,
      response: aiQuestion,
      questionNumber: session.questions.length
    });

  } catch (err) {
    console.error('[EXAM/QUESTION] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Keep all other endpoints (hint, feedback, etc.) as they are
// ... (the rest of your server.js remains unchanged)

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 UCBM Exam Simulator running on http://localhost:${PORT}`);
  initKnowledgeBase().catch(console.error);
});