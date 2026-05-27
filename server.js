#!/usr/bin/env node
// server.js

console.log('[STARTUP] Starting UCBM Exam Simulator');
console.log('[STARTUP] NODE_ENV:', process.env.NODE_ENV);
console.log('[STARTUP] PORT:', process.env.PORT || 3000);
console.log('[STARTUP] XAI_API_KEY present:', !!process.env.XAI_API_KEY);

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initKnowledgeBase, getCourseContext, addStudentMaterial, retrieveRelevantContext } from './knowledge-base.js';
import { SYSTEM_PROMPT } from './system-prompt.js';

console.log('[STARTUP] All imports successful');

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

console.log('[STARTUP] Express configured');

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// === COURSES ENDPOINT ===
app.get('/api/courses', (req, res) => {
  try {
    const coursesData = JSON.parse(fs.readFileSync(path.join(__dirname, 'course-specs.json'), 'utf8'));
    const courses = coursesData.courses || [];
    
    // Group by year
    const grouped = {};
    courses.forEach(c => {
      const year = c.year || 1;
      if (!grouped[year]) grouped[year] = [];
      grouped[year].push({
        id: c.id,
        name: c.name,
        code: c.code,
        cfu: c.cfu,
        semester: c.semester
      });
    });
    
    res.json({ success: true, courses, grouped, total: courses.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load courses', message: err.message });
  }
});

// === UPLOAD ENDPOINT ===
app.post('/api/upload', async (req, res) => {
  try {
    const { studentId, courseId, fileType, content, metadata } = req.body;
    await addStudentMaterial(studentId, courseId, fileType, content, metadata);
    res.json({ success: true, message: 'Material added to knowledge base' });
  } catch (err) {
    console.error('[UPLOAD] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// === EXAM SIMULATION ENDPOINT ===
app.post('/api/exam/simulate', async (req, res) => {
  try {
    const { studentId, courseId, mode, previousContext = [] } = req.body;

    const context = await getCourseContext(courseId);
    const course = context.courseSpecs;

    const apiKey = process.env.XAI_API_KEY;
    
    // If no API key, return mock response for testing
    if (!apiKey) {
      console.log('[EXAM] XAI_API_KEY not configured, returning demo response');
      return res.json({
        success: true,
        courseName: course.name,
        courseCode: course.code,
        mode: mode,
        response: `[DEMO MODE] Course: ${course.name}\n\nThis is a demonstration response. To enable AI-powered exam simulation, set XAI_API_KEY in your environment.\n\nCourse Details:\n- Professor: ${course.professor}\n- Exam Format: ${course.examFormat.primary}\n- CFU: ${course.cfu}\n- Student: ${studentId}`,
        examFormat: course.examFormat,
        score: null,
        feedback: null
      });
    }

    console.log('[EXAM] Calling xAI API for course:', courseId);

    // Build the full prompt for xAI
    const userMessage = `${SYSTEM_PROMPT}

Course: ${course.name} (${course.code})
Professor: ${course.professor}
Exam Mode: ${mode.toUpperCase()}
Student: ${studentId}

Course Specification:
${JSON.stringify(course, null, 2)}

Student Materials:
${JSON.stringify(context.studentMaterials || [], null, 2)}

Previous Exchange:
${JSON.stringify(previousContext, null, 2)}

Generate the next exam question or interaction.`;

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'grok-2',
        messages: [
          { role: 'system', content: 'You are an expert exam tutor for the UCBM Bioengineering program.' },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 1500,
        stream: false
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[EXAM] xAI API error:', response.status, error);
      return res.status(response.status).json({ error: `xAI API error: ${error}` });
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || 'No response generated';

    res.json({
      success: true,
      courseName: course.name,
      courseCode: course.code,
      mode: mode,
      response: aiResponse,
      examFormat: course.examFormat,
      score: null,
      feedback: null
    });

  } catch (err) {
    console.error('[EXAM] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[ERROR] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// 404 handler - serve index.html for SPA routes
app.use((req, res) => {
  if (req.accepts('html')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

const PORT = 3000;

console.log('[STARTUP] About to listen on port', PORT);

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[STARTUP] 🚀 Server listening on port ${PORT}`);
  
  // Initialize knowledge base AFTER server is listening
  initKnowledgeBase()
    .then(() => {
      console.log('[STARTUP] ✅ Knowledge base initialized');
    })
    .catch(err => {
      console.error('[STARTUP] ❌ Knowledge base init failed:', err);
      console.error('[STARTUP] Server will continue but KB features may not work');
    });
});

server.on('error', (err) => {
  console.error('[STARTUP] Server error:', err);
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

process.on('uncaughtException', (err) => {
  console.error('[CRASH] Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRASH] Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
