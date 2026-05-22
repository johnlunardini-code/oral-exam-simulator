import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const client = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: 'https://api.x.ai/v1',
});

// System prompts for each subject
const systemPrompts = {
  anatomy: `You are an experienced professor of human anatomy at a top biomedical engineering university (UCBM Rome). 
You are conducting an oral exam on human anatomy for a first-year bioengineering student.
Your role is to:
1. Ask challenging but fair anatomy questions that test conceptual understanding and practical knowledge
2. Ask follow-up questions based on the student's answers to probe deeper knowledge
3. Focus on topics like: skeletal system, muscular system, nervous system, cardiovascular system, respiratory system, digestive system, endocrine system
4. After each student answer, provide concise feedback on correctness and clarity
5. Rate the quality of their response (Excellent/Good/Needs Improvement/Incorrect)
6. Continue asking questions until the exam naturally concludes (typically 5-7 questions)

Start by introducing yourself and ask the first anatomy question. Keep responses concise and professional.`,

  physics: `You are an experienced professor of physics at a top biomedical engineering university (UCBM Rome).
You are conducting an oral exam on physics for a first-year bioengineering student.
Your role is to:
1. Ask challenging but fair physics questions relevant to bioengineering (mechanics, thermodynamics, electromagnetism, optics)
2. Ask follow-up questions based on the student's answers to probe deeper understanding
3. Focus on problem-solving, conceptual understanding, and applications to biomedical systems
4. After each student answer, provide concise feedback on correctness and clarity
5. Rate the quality of their response (Excellent/Good/Needs Improvement/Incorrect)
6. Continue asking questions until the exam naturally concludes (typically 5-7 questions)

Start by introducing yourself and ask the first physics question. Keep responses concise and professional.`,
};

// Store conversation history per exam session
const examSessions = {};

// Generate unique session ID
function generateSessionId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// POST /api/exam/start - Start a new exam session
app.post('/api/exam/start', (req, res) => {
  const { subject } = req.body;

  if (!['anatomy', 'physics'].includes(subject)) {
    return res.status(400).json({ error: 'Invalid subject. Choose: anatomy or physics' });
  }

  const sessionId = generateSessionId();
  examSessions[sessionId] = {
    subject,
    messages: [],
    questionCount: 0,
  };

  res.json({ sessionId, subject });
});

// POST /api/exam/question - Get AI professor response
app.post('/api/exam/question', async (req, res) => {
  const { sessionId, studentAnswer } = req.body;

  if (!sessionId || !examSessions[sessionId]) {
    return res.status(404).json({ error: 'Exam session not found' });
  }

  const session = examSessions[sessionId];
  const systemPrompt = systemPrompts[session.subject];

  try {
    // Add student answer to conversation history
    if (studentAnswer && studentAnswer.trim()) {
      session.messages.push({
        role: 'user',
        content: studentAnswer,
      });
    }

    // Get professor response
    const response = await client.chat.completions.create({
      model: 'grok-build-0.1',
      messages: [
        { role: 'system', content: systemPrompt },
        ...session.messages,
      ],
      temperature: 0.6,
      max_tokens: 400,
    });

    const professorMessage = response.choices[0].message.content;

    // Add professor response to history
    session.messages.push({
      role: 'assistant',
      content: professorMessage,
    });

    session.questionCount += 1;

    res.json({
      response: professorMessage,
      questionNumber: session.questionCount,
    });
  } catch (error) {
    console.error('OpenAI API error:', error);
    res.status(500).json({ error: 'Failed to get exam response' });
  }
});

// GET /api/exam/session/:sessionId - Get session details
app.get('/api/exam/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;

  if (!examSessions[sessionId]) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const session = examSessions[sessionId];
  res.json({
    subject: session.subject,
    questionCount: session.questionCount,
    messageCount: session.messages.length,
  });
});

// DELETE /api/exam/session/:sessionId - End exam session
app.delete('/api/exam/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;

  if (examSessions[sessionId]) {
    delete examSessions[sessionId];
    res.json({ message: 'Session ended' });
  } else {
    res.status(404).json({ error: 'Session not found' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Oral exam simulator running on http://0.0.0.0:${PORT}`);
  if (!process.env.XAI_API_KEY) {
    console.warn('⚠️  XAI_API_KEY not set. Please set it in .env file');
  }
  console.log('Using model: grok-build-0.1 with Browser Text-to-Speech');
});
