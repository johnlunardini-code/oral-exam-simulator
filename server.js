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
import { initKnowledgeBase, getCourseContext, addStudentMaterial, retrieveRelevantContext, getCourse } from './knowledge-base.js';
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

// === SESSION STORAGE ===
const examSessions = {};

function generateSessionId() {
  return 'session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

// === EXAM START ENDPOINT ===
app.post('/api/exam/start', async (req, res) => {
  try {
    const { subject, studentName } = req.body;
    const course = getCourse(subject);
    
    if (!course) {
      return res.status(404).json({ error: 'Course not found', courseId: subject });
    }

    const sessionId = generateSessionId();
    const isItalianCourse = course.name.toLowerCase().includes('italian') || course.id.includes('italian');
    
    examSessions[sessionId] = {
      courseId: subject,
      courseName: course.name,
      studentName,
      isItalianCourse,
      questions: [],
      answers: [],
      scoreTracker: { correct: 0, total: 0 },
      createdAt: new Date(),
      materials: []
    };

    res.json({
      success: true,
      sessionId,
      courseName: course.name,
      isItalianCourse,
      message: 'Exam session started'
    });
  } catch (err) {
    console.error('[EXAM/START] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// === GET QUESTION ENDPOINT ===
app.post('/api/exam/question', async (req, res) => {
  try {
    const { sessionId, studentAnswer } = req.body;
    const session = examSessions[sessionId];
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (studentAnswer) {
      session.answers.push(studentAnswer);
    }

    const courseContext = await getCourseContext(session.courseId);
    const course = courseContext.courseSpecs;
    const questionNumber = session.questions.length + 1;
    const sampleQuestions = [
      `Explain the main concepts of ${course.name}. How do they relate to biomedical engineering?`,
      `Describe a practical application of ${course.name} in modern healthcare.`,
      `What are the key challenges in ${course.name} and how do engineers address them?`,
      `How does ${course.name} connect with other courses in the program?`,
      `Discuss the latest developments in ${course.name}.`
    ];
    
    const question = sampleQuestions[questionNumber % sampleQuestions.length];
    session.questions.push(question);
    session.scoreTracker.total++;
    
    const isCorrect = studentAnswer && studentAnswer.length > 20;
    if (isCorrect) session.scoreTracker.correct++;

    res.json({
      success: true,
      response: question,
      questionNumber,
      hypotheticalScore: Math.round((session.scoreTracker.correct / session.scoreTracker.total * 30)) || 0
    });
  } catch (err) {
    console.error('[EXAM/QUESTION] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// === GET SESSION ENDPOINT ===
app.get('/api/exam/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = examSessions[sessionId];
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({
      success: true,
      sessionId,
      courseId: session.courseId,
      courseName: session.courseName,
      studentName: session.studentName,
      scoreTracker: session.scoreTracker,
      questionCount: session.questions.length
    });
  } catch (err) {
    console.error('[EXAM/SESSION] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// === END EXAM / DELETE SESSION ENDPOINT ===
app.delete('/api/exam/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = examSessions[sessionId];
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const result = {
      sessionId,
      correct: session.scoreTracker.correct,
      total: session.scoreTracker.total,
      percentage: session.scoreTracker.total > 0 ? Math.round(session.scoreTracker.correct / session.scoreTracker.total * 100) : 0
    };

    delete examSessions[sessionId];
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[EXAM/DELETE] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// === UPLOAD FILE ENDPOINT ===
app.post('/api/exam/upload/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = examSessions[sessionId];
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({
      success: true,
      filename: 'file',
      totalFilesLoaded: session.materials.length + 1
    });
  } catch (err) {
    console.error('[EXAM/UPLOAD] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// === HINT ENDPOINT ===
app.post('/api/exam/hint', async (req, res) => {
  try {
    const { sessionId } = req.body;
    const session = examSessions[sessionId];
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const hints = [
      'Review the core concepts covered in the course materials.',
      'Think about how this topic applies to real biomedical engineering problems.',
      'Consider the relationships between different course modules.',
      'Review your lecture notes on this topic.',
      'Look for patterns in similar concepts from other courses.'
    ];

    const searchTerms = [
      session.courseName + ' fundamentals',
      session.courseName + ' applications',
      session.courseName + ' biomedical engineering',
      session.courseName + ' practice problems',
      session.courseName + ' case studies'
    ];

    const randomHint = hints[Math.floor(Math.random() * hints.length)];
    const randomTerms = searchTerms[Math.floor(Math.random() * searchTerms.length)];

    res.json({
      success: true,
      textHint: randomHint,
      searchTerms: randomTerms
    });
  } catch (err) {
    console.error('[EXAM/HINT] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// === HINT HISTORY ENDPOINT ===
app.get('/api/exam/hint-history/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = examSessions[sessionId];
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({
      success: true,
      hintHistory: {}
    });
  } catch (err) {
    console.error('[EXAM/HINT-HISTORY] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// === FEEDBACK ENDPOINT ===
app.post('/api/exam/feedback', async (req, res) => {
  try {
    const { sessionId, questionIndex } = req.body;
    const session = examSessions[sessionId];
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const feedback = `Your answer to question ${questionIndex + 1} demonstrates understanding of ${session.courseName}. Consider elaborating on the practical applications and connections to other course topics.`;

    res.json({
      success: true,
      feedback
    });
  } catch (err) {
    console.error('[EXAM/FEEDBACK] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// === COURSES ENDPOINT ===
app.get('/api/courses', (req, res) => {
  try {
    const coursesData = JSON.parse(fs.readFileSync(path.join(__dirname, 'course-specs.json'), 'utf8'));
    const courses = coursesData.courses || [];
    
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

// === EXAM SIMULATION ENDPOINT (Legacy) ===
app.post('/api/exam/simulate', async (req, res) => {
  try {
    const { studentId, courseId, mode, previousContext = [] } = req.body;

    const context = await getCourseContext(courseId);
    const course = context.courseSpecs;

    const apiKey = process.env.XAI_API_KEY;
    
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
