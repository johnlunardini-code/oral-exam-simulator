#!/usr/bin/env node
// server.js
console.log('[STARTUP] Starting UCBM Exam Simulator');

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { initKnowledgeBase, getCourse } from './knowledge-base.js';
import { SYSTEM_PROMPT } from './system-prompt.js';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const sessions = new Map();
let sessionCounter = 0;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve the UI
app.use(express.static(path.join(__dirname, 'public')));

// Make course-specs.json available to the frontend
app.get('/course-specs.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'course-specs.json'));
});

// Explicit root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Basic courses list
app.get('/api/courses', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'course-specs.json'), 'utf8'));
    res.json({ success: true, courses: data.courses || [] });
  } catch (err) {
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
  console.warn('[STARTUP] WARNING: XAI_API_KEY is not set. The UI will load but exam features will fail until the key is added in Railway.');
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

// ============================================================
// Question Detection Helper
// ============================================================

function isActualQuestion(text) {
  if (!text) return false;
  const trimmed = text.trim();
  
  // Must contain a question mark
  if (!trimmed.includes('?')) return false;
  
  // Exclude ONLY pure confirmations like "Yes." or "Ok!"
  const pureConfirmation = /^\s*(yes|no|okay|ok|sure|alright)[.!]*\s*$/i;
  if (pureConfirmation.test(trimmed)) return false;
  
  return true;
}

// ============================================================
// MC Answer Extraction Helper
// ============================================================

function extractAndHideCorrectAnswer(responseText, questionType) {
  const result = {
    displayText: responseText,
    correctAnswer: null
  };

  if (questionType === 'multiple-choice') {
    const answerMatch = responseText.match(/\[CORRECT_ANSWER:\s*([A-D])\]/i);
    if (answerMatch) {
      result.correctAnswer = answerMatch[1].toUpperCase();
      result.displayText = responseText.replace(/\s*\[CORRECT_ANSWER:\s*[A-D]\]\s*/i, '').trim();
    }
  }

  return result;
}

// ============================================================
// Meta-Question Detection (time, technical, repeat, context requests)
// ============================================================

function detectMetaQuestion(studentAnswer) {
  const text = (studentAnswer || '').toLowerCase().trim();
  
  // Time request patterns
  const timePatterns = /\b(what time|can you tell.*time|do i have.*time|how long|time left|timer|how much time)\b/i;
  if (timePatterns.test(text)) return 'time-request';
  
  // Technical issue patterns
  const technicalPatterns = /\b(can you hear|can you see|audio|microphone|connection|technical|sound|not working|broken|hear me|see me|repeat)\b/i;
  if (technicalPatterns.test(text)) return 'technical-issue';
  
  // Repeat question patterns
  const repeatPatterns = /\b(repeat|say again|could you repeat|what was|what did you ask|ask again|rephrase)\b/i;
  if (repeatPatterns.test(text)) return 'repeat-question';
  
  // Alternative context patterns
  const contextPatterns = /\b(example|different context|another way|clarify|explain|what do you mean|confused)\b/i;
  if (contextPatterns.test(text)) return 'context-request';
  
  return null;
}

// ============================================================
// Question Type Helpers
// ============================================================

function getNextQuestionType(course, session) {
  if (!course || !course.examFormat) return 'oral';
  
  const fmt = course.examFormat;
  const askedOralCount = (session.askedQuestions || []).filter(q => q && q.type === 'oral').length;
  const askedWrittenCount = (session.askedQuestions || []).filter(q => q && q.type === 'written').length;
  const askedMCCount = (session.askedQuestions || []).filter(q => q && q.type === 'multiple-choice').length;
  
  // Biomechanics: 45-minute multiple-choice FOLLOWED BY oral exam
  if (course.id === 'biomechanics') {
    const estimatedMCQuestions = 12;
    return askedMCCount >= estimatedMCQuestions ? 'oral' : 'multiple-choice';
  }
  
  // Economics: oral + written mixed questions
  if (course.id === 'economics-and-management') {
    const estimatedOralQuestions = 4;
    return askedOralCount >= estimatedOralQuestions ? 'written' : 'oral';
  }
  
  // Math: open-form then multiple-choice
  if (course.id === 'mathematics') {
    const estimatedOpenQuestions = 2;
    return askedWrittenCount >= estimatedOpenQuestions ? 'multiple-choice' : 'written';
  }
  
  // General mixed format
  if (fmt.primary === 'mixed' || fmt.primary === 'written + oral') {
    return askedOralCount <= askedWrittenCount ? 'oral' : 'written';
  }
  
  return fmt.primary === 'written' ? 'written' : 'oral';
}

// ============================================================
// Session Helpers
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
    lastQuestion: null,
    lastQuestionType: 'oral',
    mcAnswerBank: {},
    googleSearchUsed: false
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
    prompt += `\nProfessor name: ${course.professor || 'Professor'}`;
    prompt += `\nProfessor style: ${course.typical_oral_style || 'rigorous oral exam'}`;
    if (course.examFormat) {
      prompt += `\nExam format: ${JSON.stringify(course.examFormat)}`;
    }
    
    const nextType = getNextQuestionType(course, session);
    session.lastQuestionType = nextType;
    prompt += `\n\n**QUESTION TYPE FOR THIS QUESTION**: ${nextType.toUpperCase()}`;
    
    if (nextType === 'multiple-choice') {
      prompt += `\n\nFormat Instructions: Provide a clear, focused question with exactly 4 options labeled A, B, C, D. At the END of your response, explicitly state the correct answer as: [CORRECT_ANSWER: A] (or B/C/D as appropriate).`;
    } else if (nextType === 'written') {
      prompt += `\n\nFormat Instructions: Ask an open-form question that requires a detailed written answer (ideally 200+ words). Student must provide comprehensive explanation.`;
    } else if (nextType === 'numerical') {
      prompt += `\n\nFormat Instructions: Ask a numerical problem that requires calculation and numeric answer with units or explanation.`;
    } else {
      prompt += `\n\nFormat Instructions: Ask a conversational oral question suitable for spoken response.`;
    }
  }

  if (session.isItalianCourse) {
    prompt += `\n\n**LANGUAGE MODE - ITALIAN COURSE**: Present questions in English but include probes about Italian comprehension and content knowledge. Accept answers in BOTH English AND Italian (code-switching is completely fine). Student can mix languages freely.\\n\\nIMPORTANT: When grading feedback, differentiate between:\\n1. Language skill testing (mark Italian grammar/vocabulary errors)\\n2. Content knowledge testing (ignore language mixing, focus on concepts)\\n\\nClarify in context which aspect you are testing.`;
  }

  if (session.askedQuestions.length > 0) {
    prompt += `\n\n**PREVIOUSLY ASKED IN THIS SESSION (DO NOT REPEAT)**:\n`;
    prompt += session.askedQuestions.slice(-8).map((q, i) => `  ${i + 1}. ${typeof q === 'string' ? q : q.text || q}`).join('\n');
  }

  if (session.uploads.length > 0) {
    prompt += `\n\n**STUDENT-UPLOADED MATERIALS**:\n`;
    for (const u of session.uploads.slice(-5)) {
      const excerpt = (u.content || '').slice(0, 4000);
      prompt += `\n--- ${u.filename} ---\n${excerpt}\n`;
    }
  }

  if (isFirstQuestion) {
    prompt += `\n\n**FIRST QUESTION**: Greet ${session.studentName}, introduce yourself as ${course?.professor || 'the professor'}, introduce the course format briefly, then ask the first realistic question immediately. DO NOT describe exam scoring criteria - only mention how the exam will be given/conducted.`;
  } else {
    prompt += `\n\n**CONTINUE THE EXAM**: Give short feedback on the last answer, then ask the next non-repetitive question.`;
  }

  prompt += `\n\nCurrent question number: ${session.questionCount + 1}`;
  return prompt;
}

// ============================================================
// Exam API Endpoints
// ============================================================

app.post('/api/exam/start', async (req, res) => {
  try {
    const { subject, studentName } = req.body || {};
    if (!subject) return res.status(400).json({ error: 'subject is required' });

    const session = createSession(subject, studentName);
    console.log(`[EXAM] New session for ${session.courseName}`);

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

    const isFirst = session.questionCount === 0;
    const trimmedAnswer = (studentAnswer || '').trim();
    const metaQuestionType = detectMetaQuestion(trimmedAnswer);

    // Handle meta-questions (time, technical, repeat, context) without advancing
    if (metaQuestionType && !isFirst) {
      let metaResponse = '';
      
      if (metaQuestionType === 'time-request') {
        metaResponse = 'You have unlimited time for this exam. Please take your time and provide a thorough answer to the current question.';
      } else if (metaQuestionType === 'technical-issue') {
        metaResponse = 'Yes, I can hear you clearly. Your audio and connection are working. Please proceed with your answer when ready.';
      } else if (metaQuestionType === 'repeat-question') {
        const lastProfessorMsg = session.messages.slice().reverse().find(m => m.role === 'assistant');
        metaResponse = lastProfessorMsg ? lastProfessorMsg.content : 'Let me ask you another way. Could you clarify your understanding of the current topic?';
      } else if (metaQuestionType === 'context-request') {
        metaResponse = 'Certainly. To clarify: the current question is asking you to explain your understanding. Use any examples or context from the course materials that help illustrate your point. What is your answer?';
      }
      
      session.messages.push({ role: 'user', content: trimmedAnswer });
      session.messages.push({ role: 'assistant', content: metaResponse });
      session.lastQuestion = session.messages[session.messages.length - 2].content;
      
      return res.json({
        response: metaResponse,
        questionNumber: session.questionCount,
        questionType: 'clarification',
        isMetaQuestion: true,
        hypotheticalScore: null,
        scoreTracker: session.scoreTracker
      });
    }

    if (trimmedAnswer && !metaQuestionType) {
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
      return res.status(502).json({ error: 'LLM call failed', details: apiErr.message });
    }

    // Extract and hide correct answer for MC questions
    const { displayText, correctAnswer } = extractAndHideCorrectAnswer(professorResponse, session.lastQuestionType);
    
    // Store correct answer if this is an MC question
    if (session.lastQuestionType === 'multiple-choice' && correctAnswer) {
      const qNum = session.questionCount + 1;
      session.mcAnswerBank[qNum] = correctAnswer;
    }

    session.messages.push({ role: 'assistant', content: professorResponse });
    session.lastQuestion = displayText;
    session.questionCount += 1;
    
    const qObj = {
      text: displayText.slice(0, 220),
      type: session.lastQuestionType,
      number: session.questionCount
    };
    session.askedQuestions.push(qObj);

    let hypotheticalScore = null;
    if (session.questionCount % 5 === 0 && session.scoreTracker.total > 0) {
      const pct = Math.round((session.scoreTracker.correct / session.scoreTracker.total) * 100);
      hypotheticalScore = Math.round(pct * 30 / 100);
    }

    res.json({
      response: displayText,
      questionNumber: session.questionCount,
      questionType: session.lastQuestionType,
      hypotheticalScore,
      scoreTracker: session.scoreTracker
    });
  } catch (err) {
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
    
    // Check if the last response is actually a question
    if (!isActualQuestion(context)) {
      return res.json({ 
        textHint: 'This is not a question yet. Wait for the professor to ask you a question before requesting a hint.',
        isNotQuestion: true
      });
    }
    
    const langNote = session.isItalianCourse ? ' Respond in Italian.' : '';

    const hintPrompt = `You are a helpful UCBM biomedical engineering professor. Give ONE concise, high-value study hint (2-4 sentences). Be specific. Avoid giving the full answer.${langNote}\n\nContext:\n${context}`;

    const hint = await callGrok(hintPrompt, [], { temperature: 0.6, max_tokens: 350 });

    const qNum = session.questionCount || 1;
    if (!session.hintHistory[qNum]) session.hintHistory[qNum] = [];
    session.hintHistory[qNum].push({ hint, at: new Date().toISOString() });

    res.json({ textHint: hint });
  } catch (err) {
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
    const { sessionId, questionIndex, isSpokenAnswer } = req.body || {};
    const session = getSession(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const studentTurns = session.messages.filter(m => m.role === 'user');
    const idx = Math.max(0, Math.min(questionIndex ?? studentTurns.length - 1, studentTurns.length - 1));
    const studentAnswer = studentTurns[idx]?.content || 'No answer recorded';

    let fbPrompt = `Provide structured feedback on this student answer (max 180 words). Cover: (1) What was good, (2) What was missing, (3) One improvement. Use bullets.\n\n`;
    
    if (isSpokenAnswer) {
      fbPrompt += `NOTE: This answer came from speech recognition. DO NOT cite spelling or minor grammar issues from speech-to-text errors. Focus on content quality and comprehension.\n\n`;
    }
    
    fbPrompt += `Student answer:\n${studentAnswer}`;
    
    // If course has uploaded materials, include them in feedback
    if (session.uploads.length > 0) {
      fbPrompt += `\n\nAvailable course materials:\n`;
      for (const u of session.uploads.slice(-3)) {
        fbPrompt += `- ${u.filename}\n`;
      }
      fbPrompt += `\nConsider referencing these materials in feedback if relevant.`;
    }

    const feedback = await callGrok(fbPrompt, [], { temperature: 0.5, max_tokens: 400 });
    res.json({ feedback });
  } catch (err) {
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
      res.status(400).json({ error: e.message });
    }
  });
});

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================================
// Startup
// ============================================================

async function start() {
  try {
    await initKnowledgeBase();
    console.log('[STARTUP] Knowledge base initialized');

    const PORT = 3000;
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`[STARTUP] Server listening on port ${PORT}`);
    });

    server.on('error', (err) => {
      console.error('[ERROR]', err);
      process.exit(1);
    });

    process.on('SIGTERM', () => {
      server.close(() => process.exit(0));
    });
  } catch (err) {
    console.error('[STARTUP ERROR]', err.message);
    process.exit(1);
  }
}

start();
