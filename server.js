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

// Serve static files (UI)
app.use(express.static(path.join(__dirname, 'public')));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Explicit root route - fixes Bad Gateway on Railway
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

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

    const sessionId = 'session-' + Date.now();
    // You can expand this session storage as needed
    res.json({ success: true, sessionId, courseName: course.name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === GET NEXT QUESTION (uses full SYSTEM_PROMPT + xAI) ===
app.post('/api/exam/question', async (req, res) => {
  try {
    const { sessionId, studentAnswer } = req.body;
    // You can add session storage later if needed

    const courseContext = await getCourseContext('anatomy'); // replace with actual courseId from request
    const course = courseContext.courseSpecs;

    const userMessage = `${SYSTEM_PROMPT}

Current course: ${course.name} (${course.code})
Professor: ${course.professor}
Exam Mode: Oral

Generate the NEXT challenging university-level oral exam question.`;

    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return res.json({ success: true, response: "Demo question - XAI key not configured" });
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

    res.json({
      success: true,
      response: aiQuestion,
      questionNumber: 1
    });

  } catch (err) {
    console.error('[EXAM/QUESTION] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Catch-all route for SPA (important for Railway)
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'API endpoint not found' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 UCBM Exam Simulator running on port ${PORT}`);
  initKnowledgeBase().catch(console.error);
});