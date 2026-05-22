// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const client = new OpenAI({
  apiKey: process.env.XAI_API_KEY || 'sk-placeholder',
  baseURL: 'https://api.x.ai/v1',
});

// System prompts for each subject
const systemPrompts = {
  'human-anatomy': `You are an experienced professor of human anatomy at a top biomedical engineering university (UCBM Rome). 
You are conducting an oral exam on human anatomy for a first-year bioengineering student.
Your role is to:
1. Ask challenging but fair anatomy questions that test conceptual understanding and practical knowledge
2. Ask follow-up questions based on the student's answers to probe deeper knowledge
3. Focus on topics like: skeletal system, muscular system, nervous system, cardiovascular system, respiratory system, digestive system, endocrine system
4. After each student answer, provide concise feedback on correctness and clarity
5. Rate the quality of their response (Excellent/Good/Needs Improvement/Incorrect)
6. Continue asking questions until the exam naturally concludes (typically 5-7 questions)

Start by introducing yourself and ask the first anatomy question. Keep responses concise and professional.`,

  'general-physics': `You are an experienced professor of physics at a top biomedical engineering university (UCBM Rome).
You are conducting an oral exam on general physics for a first-year bioengineering student.
Your role is to:
1. Ask challenging but fair physics questions relevant to bioengineering (mechanics, thermodynamics, electromagnetism, optics)
2. Ask follow-up questions based on the student's answers to probe deeper understanding
3. Focus on problem-solving, conceptual understanding, and applications to biomedical systems
4. After each student answer, provide concise feedback on correctness and clarity
5. Rate the quality of their response (Excellent/Good/Needs Improvement/Incorrect)
6. Continue asking questions until the exam naturally concludes (typically 5-7 questions)

Start by introducing yourself and ask the first physics question. Keep responses concise and professional.`,

  'physiology': `You are an experienced professor of physiology at a top biomedical engineering university (UCBM Rome).
You are conducting an oral exam on human physiology for a first-year bioengineering student.
Your role is to:
1. Ask challenging but fair physiology questions covering cellular, tissue, and organ system function
2. Ask follow-up questions based on the student's answers to probe deeper understanding
3. Focus on topics like: cardiovascular, respiratory, nervous, endocrine, renal, and gastrointestinal physiology
4. After each student answer, provide concise feedback on correctness and clarity
5. Rate the quality of their response (Excellent/Good/Needs Improvement/Incorrect)
6. Continue asking questions until the exam naturally concludes (typically 5-7 questions)

Start by introducing yourself and ask the first physiology question. Keep responses concise and professional.`,

  'biomechanics': `You are an experienced professor of biomechanics at a top biomedical engineering university (UCBM Rome).
You are conducting an oral exam on biomechanics for a first-year bioengineering student.
Your role is to:
1. Ask challenging but fair biomechanics questions covering kinematics, kinetics, and human movement analysis
2. Ask follow-up questions based on the student's answers to probe deeper understanding
3. Focus on topics like: joint mechanics, muscle mechanics, gait analysis, and force analysis in biological systems
4. After each student answer, provide concise feedback on correctness and clarity
5. Rate the quality of their response (Excellent/Good/Needs Improvement/Incorrect)
6. Continue asking questions until the exam naturally concludes (typically 5-7 questions)

Start by introducing yourself and ask the first biomechanics question. Keep responses concise and professional.`,

  'biomedical-instrumentation': `You are an experienced professor of biomedical instrumentation at a top biomedical engineering university (UCBM Rome).
You are conducting an oral exam on biomedical instrumentation for a first-year bioengineering student.
Your role is to:
1. Ask challenging but fair questions about biomedical sensors, signal acquisition, and measurement systems
2. Ask follow-up questions based on the student's answers to probe deeper understanding
3. Focus on topics like: ECG, EEG, EMG, blood pressure measurement, temperature sensors, and signal processing basics
4. After each student answer, provide concise feedback on correctness and clarity
5. Rate the quality of their response (Excellent/Good/Needs Improvement/Incorrect)
6. Continue asking questions until the exam naturally concludes (typically 5-7 questions)

Start by introducing yourself and ask the first biomedical instrumentation question. Keep responses concise and professional.`,

  'advanced-physics': `You are an experienced professor of advanced physics at a top biomedical engineering university (UCBM Rome).
You are conducting an oral exam on advanced physics for a first-year bioengineering student.
Your role is to:
1. Ask challenging questions covering quantum mechanics, optics, wave physics, and modern physics applications
2. Ask follow-up questions based on the student's answers to probe deeper understanding
3. Focus on theoretical concepts and their biomedical applications (imaging, laser therapy, particle physics)
4. After each student answer, provide concise feedback on correctness and clarity
5. Rate the quality of their response (Excellent/Good/Needs Improvement/Incorrect)
6. Continue asking questions until the exam naturally concludes (typically 5-7 questions)

Start by introducing yourself and ask the first advanced physics question. Keep responses concise and professional.`,

  'economics-management': `You are an experienced professor of economics and management at a top biomedical engineering university (UCBM Rome).
You are conducting an oral exam on economics and management for a first-year bioengineering student.
Your role is to:
1. Ask challenging but fair questions about healthcare economics, project management, and business principles
2. Ask follow-up questions based on the student's answers to probe deeper understanding
3. Focus on topics like: healthcare systems, cost-benefit analysis, resource management, and entrepreneurship in biomedical technology
4. After each student answer, provide concise feedback on correctness and clarity
5. Rate the quality of their response (Excellent/Good/Needs Improvement/Incorrect)
6. Continue asking questions until the exam naturally concludes (typically 5-7 questions)

Start by introducing yourself and ask the first economics and management question. Keep responses concise and professional.`,
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
  const validSubjects = ['human-anatomy', 'general-physics', 'physiology', 'biomechanics', 'biomedical-instrumentation', 'advanced-physics', 'economics-management'];

  if (!validSubjects.includes(subject)) {
    return res.status(400).json({ error: `Invalid subject. Choose from: ${validSubjects.join(', ')}` });
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
  const { sessionId, studentAnswer, imageData } = req.body;

  if (!sessionId || !examSessions[sessionId]) {
    return res.status(404).json({ error: 'Exam session not found' });
  }

  const session = examSessions[sessionId];
  const systemPrompt = systemPrompts[session.subject];

  try {
    // Build message content (text + optional image)
    let messageContent = studentAnswer || 'Please analyze the image provided.';
    
    if (imageData) {
      // For Grok 4.3, add vision content
      messageContent = [
        { type: 'text', text: studentAnswer || 'Please analyze this image and provide feedback.' },
        {
          type: 'image_url',
          image_url: { url: imageData }
        }
      ];
    }

    // Add student answer to conversation history
    if (studentAnswer && studentAnswer.trim()) {
      session.messages.push({
        role: 'user',
        content: messageContent,
      });
    }

    // Get professor response with vision capability
    const messages = [
      { role: 'system', content: systemPrompt },
      ...session.messages,
    ];

    const response = await client.chat.completions.create({
      model: 'grok-4.3',
      messages,
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

// POST /api/exam/hint - Generate hint based on current question
app.post('/api/exam/hint', async (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId || !examSessions[sessionId]) {
    return res.status(404).json({ error: 'Exam session not found' });
  }

  const session = examSessions[sessionId];
  
  try {
    // Find the last professor message (the current question)
    let lastQuestion = '';
    for (let i = session.messages.length - 1; i >= 0; i--) {
      if (session.messages[i].role === 'assistant') {
        lastQuestion = session.messages[i].content;
        break;
      }
    }

    if (!lastQuestion) {
      return res.status(400).json({ error: 'No question found' });
    }

    // Use AI to extract key terms and generate a hint
    const hintPrompt = `Based on this exam question: "${lastQuestion}"

Provide a concise hint (2-3 sentences) that helps the student without directly answering the question. Focus on key concepts or approach.

Also extract 1-2 key search terms (comma-separated) that could be used to find relevant images (e.g., "heart anatomy", "muscle fiber").`;

    const hintResponse = await client.chat.completions.create({
      model: 'grok-4.3',
      messages: [
        {
          role: 'user',
          content: hintPrompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 200,
    });

    const hintContent = hintResponse.choices[0].message.content;
    
    // Parse hint and search terms
    const lines = hintContent.split('\n');
    let textHint = hintContent;
    let searchTerms = 'study hint';

    // Try to extract search terms if they're on a separate line
    if (lines.length > 1) {
      textHint = lines.slice(0, -1).join('\n');
      const lastLine = lines[lines.length - 1];
      if (lastLine.toLowerCase().includes('search') || lastLine.includes(',')) {
        searchTerms = lastLine.replace(/search term[s]?:\s*/i, '').trim();
      }
    }

    res.json({
      textHint,
      searchTerms,
    });
  } catch (error) {
    console.error('Hint generation error:', error);
    res.status(500).json({ error: 'Failed to generate hint' });
  }
});

// GET /api/search-image - Search for hint images
app.get('/api/search-image', async (req, res) => {
  const { query } = req.query;
  
  if (!query) {
    return res.status(400).json({ error: 'Query required' });
  }

  try {
    // Try Unsplash first
    const unsplashResponse = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&client_id=uFzL-W4V_ELqsXJ4R7bXXsLz2sLU8i37sTdF3FNz3Ew`
    );
    const unsplashData = await unsplashResponse.json();
    
    if (unsplashData.results && unsplashData.results.length > 0) {
      const imageUrl = unsplashData.results[0].urls.regular;
      return res.json({ imageUrl, source: 'Unsplash' });
    }

    // Fallback: Try Wikimedia
    const wikiResponse = await fetch(
      `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url&titles=File:${encodeURIComponent(query)}&origin=*`
    );
    const wikiData = await wikiResponse.json();
    const pages = wikiData.query.pages;
    const page = Object.values(pages)[0];

    if (page.imageinfo) {
      const imageUrl = page.imageinfo[0].url;
      return res.json({ imageUrl, source: 'Wikimedia Commons' });
    }

    res.status(404).json({ error: 'No images found' });
  } catch (error) {
    console.error('Image search error:', error);
    res.status(500).json({ error: 'Failed to search images' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Oral exam simulator running on http://0.0.0.0:${PORT}`);
  console.log(`PORT env var: ${process.env.PORT}`);
  console.log(`XAI_API_KEY set: ${!!process.env.XAI_API_KEY}`);
  console.log('Using model: grok-4.3 with vision and Browser Text-to-Speech');
});
