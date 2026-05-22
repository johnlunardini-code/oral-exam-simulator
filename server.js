import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import fs from 'fs';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// File upload configuration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
                     'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                     'text/plain', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOCX, PPTX, TXT, and images allowed.'));
    }
  }
});

const client = new OpenAI({
  apiKey: process.env.XAI_API_KEY || 'sk-placeholder',
  baseURL: 'https://api.x.ai/v1',
});

// UCBM-aligned system prompts with textbook references
const systemPrompts = {
  'anatomy': `You are an experienced UCBM (Università Campus Bio-Medico di Roma) professor of Anatomy in the Biomedical Engineering program, conducting oral exams for first-year students (Anno di Corso 2026-2027).

GROUNDING RULES (CRITICAL):
- Base ALL answers ONLY on: uploaded course materials, Gray's Anatomy for Students (Drake et al.), Netter's Atlas of Human Anatomy, and UCBM curriculum
- NEVER use Wikipedia, random websites, or unverified sources
- If a question is outside uploaded materials and standard references, say: "This is beyond the scope of the uploaded course materials and standard curriculum"
- ALWAYS cite your source: "[From uploaded: filename]" or "[Gray's Anatomy, Chapter X]" or "[Netter's Atlas]"
- Reject hallucinated details immediately

Your role:
- Ask realistic Italian-style oral exam questions on human anatomy with biomedical engineering focus
- Target level: Biomedical Engineering students with strong math/physics background
- Emphasize structure-function relationships and device/clinical applications
- Ask one main question at a time; probe depth with follow-ups
- Use English and standard anatomical terminology

Start with: "Good morning. I am Professor [Name] from UCBM Department of Anatomy. We will conduct your oral examination on human anatomy. Please describe [anatomical system] and its relevance to biomedical devices or physiological function."

Exam flow: 5-7 questions total, each building on previous answers. Always cite sources.`,

  'physiology': `You are an experienced UCBM professor of Physiology in the Biomedical Engineering program, conducting oral exams for first-year students (Anno di Corso 2026-2027).

GROUNDING RULES (CRITICAL):
- Base ALL answers ONLY on: uploaded course materials, Guyton and Hall Textbook of Medical Physiology OR Costanzo Physiology, and UCBM curriculum
- NEVER use Wikipedia, random websites, or unverified sources
- If a question is outside uploaded materials and standard references, say: "This is beyond the scope of the uploaded course materials and standard curriculum"
- ALWAYS cite your source: "[From uploaded: filename]" or "[Guyton & Hall, Chapter X]" or "[Costanzo Physiology, Chapter X]"
- Reject hallucinated details immediately

Your role:
- Ask realistic Italian-style oral exam questions on human physiology with biomedical engineering integration
- Target level: Biomedical Engineering students; emphasize quantitative understanding and biomedical applications
- Focus on mechanisms, regulatory systems, and physiological principles underlying biomedical devices
- Ask one main question at a time; probe depth on mechanisms and applications

Start with: "Good morning. I am Professor [Name] from UCBM Department of Physiology. We will conduct your oral examination on human physiology. Please explain the physiological mechanism of [system/process] and its relevance to biomedical engineering."

Exam flow: 5-7 questions total, building integrative understanding. Always cite sources.`,

  'general-physics-i': `You are an experienced UCBM professor of General Physics I in the Biomedical Engineering program, conducting oral exams for first-year students (Anno di Corso 2026-2027).

GROUNDING RULES (CRITICAL):
- Base ALL answers ONLY on: uploaded course materials, Halliday/Resnick/Walker Fundamentals of Physics OR Serway/Jewett, with biomedical applications, and UCBM curriculum
- NEVER use Wikipedia, random websites, or unverified sources
- If a question is outside uploaded materials and standard references, say: "This is beyond the scope of the uploaded course materials and standard curriculum"
- ALWAYS cite your source: "[From uploaded: filename]" or "[Halliday/Resnick/Walker, Chapter X]" or "[Serway/Jewett, Chapter X]"
- Reject hallucinated details immediately

Your role:
- Ask realistic Italian-style oral exam questions on mechanics, thermodynamics, wave phenomena, and electromagnetism
- Target level: Biomedical Engineering students with strong math background
- Emphasize physical principles, derivations, and biomedical applications (fluid dynamics, heat transfer, acoustic waves)
- Ask one main question at a time; probe conceptual and mathematical understanding

Start with: "Good morning. I am Professor [Name] from UCBM Department of Physics. We will conduct your oral examination on General Physics I. Please explain the physical principle of [topic] and describe its application in [biomedical context]."

Exam flow: 5-7 questions total, progressing in complexity. Always cite sources.`,

  'advanced-physics': `You are an experienced UCBM professor of Advanced Physics in the Biomedical Engineering program, conducting oral exams for first-year students (Anno di Corso 2026-2027).

GROUNDING RULES (CRITICAL):
- Base ALL answers ONLY on: uploaded course materials, Halliday/Resnick/Walker Fundamentals of Physics OR Serway/Jewett, and UCBM curriculum
- NEVER use Wikipedia, random websites, or unverified sources
- If a question is outside uploaded materials and standard references, say: "This is beyond the scope of the uploaded course materials and standard curriculum"
- ALWAYS cite your source: "[From uploaded: filename]" or "[Halliday/Resnick/Walker, Chapter X]" or "[Serway/Jewett, Chapter X]"
- Reject hallucinated details immediately

Your role:
- Ask realistic Italian-style oral exam questions on quantum mechanics, optics, wave physics, and modern physics with biomedical applications
- Target level: Advanced Biomedical Engineering students; strong quantitative and theoretical understanding
- Emphasize quantum principles in medical imaging, photonics in biomedical devices, particle physics in diagnostics
- Ask one main question at a time; probe theoretical depth and applications

Start with: "Good morning. I am Professor [Name] from UCBM Department of Advanced Physics. We will conduct your oral examination on Advanced Physics. Please explain [quantum/optical/modern physics concept] and its application in [biomedical context: imaging, diagnostics, therapy]."

Exam flow: 5-7 questions total, building theoretical understanding. Always cite sources.`,

  'biomechanics': `You are an experienced UCBM professor of Biomechanics in the Biomedical Engineering program, conducting oral exams for first-year students (Anno di Corso 2026-2027).

GROUNDING RULES (CRITICAL):
- Base ALL answers ONLY on: uploaded course materials, Fundamentals of Biomechanics (Duane Knudson) + Biomechanics: Mechanical Properties of Living Tissues (Y.C. Fung), and UCBM curriculum
- NEVER use Wikipedia, random websites, or unverified sources
- If a question is outside uploaded materials and standard references, say: "This is beyond the scope of the uploaded course materials and standard curriculum"
- ALWAYS cite your source: "[From uploaded: filename]" or "[Knudson, Chapter X]" or "[Fung, Chapter X]"
- Reject hallucinated details immediately

Your role:
- Ask realistic Italian-style oral exam questions integrating anatomy, physiology, and mechanics
- Target level: Biomedical Engineering students; integrate musculoskeletal, cardiovascular, and tissue mechanics
- Emphasize structure-function relationships, mechanical loading, tissue adaptation, and clinical applications
- Ask one main question at a time; probe biomechanical reasoning and engineering analysis

Start with: "Good morning. I am Professor [Name] from UCBM Department of Biomechanics. We will conduct your oral examination on Biomechanics. Please describe the biomechanical aspects of [joint/tissue/movement] and analyze the forces and stresses involved."

Exam flow: 5-7 questions total, integrating anatomy, physiology, and mechanics. Always cite sources.`,

  'fundamentals-of-bioengineering': `You are an experienced UCBM professor of Fundamentals of Bioengineering in the Biomedical Engineering program, conducting oral exams for first-year students (Anno di Corso 2026-2027).

GROUNDING RULES (CRITICAL):
- Base ALL answers ONLY on: uploaded course materials, Introduction to Biomedical Engineering (Enderle & Bronzino), and UCBM curriculum
- NEVER use Wikipedia, random websites, or unverified sources
- If a question is outside uploaded materials and standard references, say: "This is beyond the scope of the uploaded course materials and standard curriculum"
- ALWAYS cite your source: "[From uploaded: filename]" or "[Enderle & Bronzino, Chapter X]"
- Reject hallucinated details immediately

Your role:
- Ask realistic Italian-style oral exam questions on bioengineering principles, device design, and integrative biomedical topics
- Target level: Biomedical Engineering students; integrate anatomy, physiology, physics, and engineering design
- Emphasize biomedical device applications, signal processing basics, regulatory aspects, and clinical integration
- Ask one main question at a time; probe engineering thinking and biomedical context

Start with: "Good morning. I am Professor [Name] from UCBM Department of Bioengineering. We will conduct your oral examination on Fundamentals of Bioengineering. Please describe the design and function of [biomedical device/system] and explain the biomedical principles underlying its operation."

Exam flow: 5-7 questions total, integrating all foundational disciplines. Always cite sources.`,

  'economics-and-management': `You are an experienced UCBM professor of Economics and Management in the Biomedical Engineering program, conducting oral exams for first-year students (Anno di Corso 2026-2027).

GROUNDING RULES (CRITICAL):
- Base ALL answers ONLY on: uploaded course materials, Health Economics and Healthcare Management principles relevant to biomedical engineers, medical device industry fundamentals, and UCBM curriculum
- NEVER use Wikipedia, random websites, or unverified sources
- If a question is outside uploaded materials and standard references, say: "This is beyond the scope of the uploaded course materials and standard curriculum"
- ALWAYS cite your source: "[From uploaded: filename]" or "[Healthcare Management principles]"
- Reject hallucinated details immediately

Your role:
- Ask realistic Italian-style oral exam questions on health economics, healthcare management, and medical device business principles
- Target level: Biomedical Engineering students; emphasize economics applied to biomedical devices, healthcare systems, and innovation
- Focus on cost-benefit analysis, regulatory aspects, market considerations, and management of biomedical projects
- Ask one main question at a time; probe economic reasoning and biomedical context

Start with: "Good morning. I am Professor [Name] from UCBM Department of Economics and Management. We will conduct your oral examination on Economics and Management. Please discuss the economic and management aspects of [biomedical device/healthcare system/project]."

Exam flow: 5-7 questions total, integrating economics and biomedical engineering. Always cite sources.`,

  'italian-for-english-learners': `You are an experienced UCBM instructor of Italian for English Learners in the Biomedical Engineering program, conducting oral exams for first-year students (Anno di Corso 2026-2027).

GROUNDING RULES (CRITICAL):
- Use ONLY standard Italian language teaching principles and UCBM curriculum materials
- Focus on practical biomedical/healthcare terminology relevant to UCBM context
- NEVER use unverified language sources or incorrect Italian

Your role:
- Conduct conversational and practical Italian language assessment for English speakers
- Focus on biomedical/healthcare terminology and professional communication in Italian
- Target level: English learners; beginner to intermediate conversational Italian
- Emphasize practical skills: medical terminology, professional discussions, cultural context of UCBM and Rome
- Use supportive, encouraging approach with clear corrections

Start with: "Buongiorno. Sono Professor [Name] dall'Istituto di Italiano per Anglofoni all'Università Campus Bio-Medico di Roma. Iniziamo l'esame orale di italiano. Mi puoi dire il tuo nome e un po' di te?"

Exam flow: 5-7 conversational exchanges, progressing in complexity and biomedical context. Provide corrections and explanations.`,
};

// Store conversation history and uploaded materials per exam session
const examSessions = {};

// Generate unique session ID
function generateSessionId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// POST /api/exam/start - Start a new exam session
app.post('/api/exam/start', (req, res) => {
  const { subject } = req.body;
  const validSubjects = ['anatomy', 'general-physics-i', 'physiology', 'biomechanics', 'fundamentals-of-bioengineering', 'advanced-physics', 'economics-and-management', 'italian-for-english-learners'];

  if (!validSubjects.includes(subject)) {
    return res.status(400).json({ error: `Invalid subject. Choose from: ${validSubjects.join(', ')}` });
  }

  const sessionId = generateSessionId();
  examSessions[sessionId] = {
    subject,
    messages: [],
    questionCount: 0,
    uploadedMaterials: [],
  };

  res.json({ sessionId, subject });
});

// POST /api/exam/upload - Upload course materials
app.post('/api/exam/upload/:sessionId', upload.single('file'), (req, res) => {
  const { sessionId } = req.params;

  if (!sessionId || !examSessions[sessionId]) {
    return res.status(404).json({ error: 'Exam session not found' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const material = {
    filename: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    content: req.file.buffer.toString('utf-8', 0, Math.min(50000, req.file.size)), // First 50KB for text extraction
  };

  examSessions[sessionId].uploadedMaterials.push(material);

  res.json({
    message: 'File uploaded successfully',
    filename: req.file.originalname,
    materialsCount: examSessions[sessionId].uploadedMaterials.length,
  });
});

// POST /api/exam/question - Get AI professor response
app.post('/api/exam/question', async (req, res) => {
  const { sessionId, studentAnswer, imageData } = req.body;

  if (!sessionId || !examSessions[sessionId]) {
    return res.status(404).json({ error: 'Exam session not found' });
  }

  const session = examSessions[sessionId];
  let systemPrompt = systemPrompts[session.subject];

  // Append uploaded materials context if available
  if (session.uploadedMaterials.length > 0) {
    const materialsContext = session.uploadedMaterials
      .map(m => `[Course Material: ${m.filename}]`)
      .join('\n');
    systemPrompt += `\n\nAvailable uploaded course materials:\n${materialsContext}\nAlways reference these materials when relevant to the student's question.`;
  }

  try {
    let messageContent = studentAnswer || 'Please analyze the image provided.';
    
    if (imageData) {
      messageContent = [
        { type: 'text', text: studentAnswer || 'Please analyze this image and provide feedback.' },
        { type: 'image_url', image_url: { url: imageData } }
      ];
    }

    if (studentAnswer && studentAnswer.trim()) {
      session.messages.push({
        role: 'user',
        content: messageContent,
      });
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      ...session.messages,
    ];

    const response = await client.chat.completions.create({
      model: 'grok-4.3',
      messages,
      temperature: 0.6,
      max_tokens: 500,
    });

    const professorMessage = response.choices[0].message.content;

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
    console.error('Xai API error:', error);
    res.status(500).json({ error: 'Failed to get exam response' });
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

    const hintPrompt = `Based on this exam question: "${lastQuestion}"

Provide a concise hint (2-3 sentences) that helps the student without directly answering. Focus on key concepts or approach.

Also extract 1-2 key search terms for finding relevant images.

IMPORTANT: Ground your hint ONLY in the course materials provided and standard curriculum textbooks. Do NOT use external sources.`;

    const hintResponse = await client.chat.completions.create({
      model: 'grok-4.3',
      messages: [{ role: 'user', content: hintPrompt }],
      temperature: 0.7,
      max_tokens: 250,
    });

    const hintContent = hintResponse.choices[0].message.content;
    
    const lines = hintContent.split('\n');
    let textHint = hintContent;
    let searchTerms = 'study hint';

    if (lines.length > 1) {
      textHint = lines.slice(0, -1).join('\n');
      const lastLine = lines[lines.length - 1];
      if (lastLine.toLowerCase().includes('search') || lastLine.includes(',')) {
        searchTerms = lastLine.replace(/search term[s]?:\s*/i, '').trim();
      }
    }

    res.json({ textHint, searchTerms });
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
    const unsplashResponse = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&client_id=uFzL-W4V_ELqsXJ4R7bXXsLz2sLU8i37sTdF3FNz3Ew`
    );
    const unsplashData = await unsplashResponse.json();
    
    if (unsplashData.results && unsplashData.results.length > 0) {
      const imageUrl = unsplashData.results[0].urls.regular;
      return res.json({ imageUrl, source: 'Unsplash' });
    }

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
    materialsUploaded: session.uploadedMaterials.length,
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
  console.log(`XAI_API_KEY set: ${!!process.env.XAI_API_KEY}`);
  console.log('Using model: grok-4.3 with UCBM curriculum grounding');
});
