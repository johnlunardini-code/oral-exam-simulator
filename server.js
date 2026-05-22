import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
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

// Subject-specific context mapping
const subjectContext = {
  'fundamentals-of-computer-science': {
    name: 'Fundamentals of Computer Science',
    references: 'Cormen et al., Silberschatz',
  },
  'mathematics': {
    name: 'Mathematics',
    references: 'Standard calculus and linear algebra textbooks',
  },
  'chemistry': {
    name: 'Chemistry',
    references: 'Standard chemistry textbooks (organic, inorganic, biochemistry)',
  },
  'general-physics': {
    name: 'General Physics',
    references: 'Halliday/Resnick/Walker, Serway',
  },
  'economics-and-management': {
    name: 'Economics and Management',
    references: 'Healthcare economics and medical device management texts',
  },
  'general-english-italian': {
    name: 'General English/Italian',
    references: 'UCBM language and professional communication guidelines',
  },
  'physiology': {
    name: 'Physiology',
    references: 'Guyton & Hall, Costanzo Physiology',
  },
  'anatomy': {
    name: 'Anatomy',
    references: 'Gray\'s Anatomy for Students, Netter\'s Atlas',
  },
  'advanced-physics': {
    name: 'Advanced Physics',
    references: 'Advanced physics texts, biomedical imaging applications',
  },
  'mathematics-ii': {
    name: 'Mathematics II',
    references: 'Advanced calculus, differential equations, vector calculus',
  },
  'probability-and-statistics': {
    name: 'Probability and Statistics',
    references: 'Standard statistics and biomedical data analysis texts',
  },
  'healthcare-information-systems': {
    name: 'Healthcare Information Systems and Telemedicine',
    references: 'EHR systems, telemedicine platforms, healthcare IT standards',
  },
  'electronics-and-electrotechnics': {
    name: 'Electronics and Electrotechnics',
    references: 'Circuit theory, electronics textbooks, biomedical instrumentation',
  },
  'mechanics-of-solids': {
    name: 'Mechanics of Solids',
    references: 'Mechanics and materials science textbooks',
  },
  'transport-phenomena-and-thermodynamics': {
    name: 'Transport Phenomena and Thermodynamics',
    references: 'Transport phenomena and thermodynamics textbooks, biological applications',
  },
  'technical-english-italian': {
    name: 'Technical English/Italian',
    references: 'UCBM technical language and professional communication guidelines',
  },
  'biomedical-signal-processing': {
    name: 'Biomedical Signal Processing',
    references: 'Signal processing textbooks, biomedical signal analysis',
  },
  'fundamentals-of-automatic-control': {
    name: 'Fundamental of Automatic Control',
    references: 'Control theory textbooks, feedback systems',
  },
  'biomechanics': {
    name: 'Biomechanics',
    references: 'Ozkaya/Knudson Biomechanics, Y.C. Fung',
  },
  'fundamentals-of-bioengineering': {
    name: 'Fundamentals of Bioengineering',
    references: 'Enderle & Bronzino, biomedical engineering principles',
  },
  'measurements-and-instrumentation': {
    name: 'Measurements and Instrumentation in Biomedical Engineering and Standards for Medical Devices',
    references: 'Instrumentation texts, ISO/IEC medical device standards',
  },
  'humanities-for-bioengineering': {
    name: 'Humanities for Bioengineering',
    references: 'Ethics, professional responsibility, healthcare innovation',
  },
};

// Course full names with emojis
const courseNames = {
  'fundamentals-of-computer-science': '💻 Fundamentals of Computer Science',
  'mathematics': '📐 Mathematics',
  'chemistry': '⚗️ Chemistry',
  'general-physics': '⚡ General Physics',
  'economics-and-management': '💼 Economics and Management',
  'general-english-italian': '🌍 General English/Italian',
  'physiology': '❤️ Physiology',
  'anatomy': '🦴 Anatomy',
  'advanced-physics': '🌌 Advanced Physics',
  'mathematics-ii': '📊 Mathematics II',
  'probability-and-statistics': '📈 Probability and Statistics',
  'healthcare-information-systems': '🏥 Healthcare Information Systems and Telemedicine',
  'electronics-and-electrotechnics': '🔌 Electronics and Electrotechnics',
  'mechanics-of-solids': '🏗️ Mechanics of Solids',
  'transport-phenomena-and-thermodynamics': '🌡️ Transport Phenomena and Thermodynamics',
  'technical-english-italian': '📝 Technical English/Italian',
  'biomedical-signal-processing': '📡 Biomedical Signal Processing',
  'fundamentals-of-automatic-control': '🎛️ Fundamental of Automatic Control',
  'biomechanics': '🏃 Biomechanics',
  'fundamentals-of-bioengineering': '🔧 Fundamentals of Bioengineering',
  'measurements-and-instrumentation': '🔬 Measurements and Instrumentation in Biomedical Engineering',
  'humanities-for-bioengineering': '🎭 Humanities for Bioengineering',
};

const examSessions = {};

function generateSessionId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function buildSystemPrompt(subject, uploadedMaterials) {
  const context = subjectContext[subject];
  if (!context) {
    return 'You are an UCBM professor conducting an oral exam.';
  }

  let prompt = `You are an experienced UCBM (Università Campus Bio-Medico di Roma) professor in the Biomedical Engineering (BEN) program, conducting realistic oral exams for students in Years 1–3.

You are currently in an oral exam practice session for **${context.name}**. Stay strictly on this subject throughout the session.

**Session Flow**:
1. You have begun the session. Immediately start with one strong, realistic oral exam-style question for ${context.name}.
2. After the student's response (voice or text), give detailed, constructive feedback on accuracy, depth, clarity, integration, and oral exam technique.
3. Then ask the next question or probe deeper on the same subject.

**Foundational Knowledge**:
- Base all questions and feedback on: UCBM Piano degli Studi 2026-2027 and Schede Didattiche 2025-2026 for ${context.name}.
- Reference core textbooks: ${context.references}
- Prioritize any student-uploaded materials (lecture notes, slides, syllabi) as primary sources for grounding.
- Clearly label any recent developments as "emerging" or "beyond standard curriculum".

**Response Style**:
- Professional, supportive but rigorous UCBM professor tone.
- Use appropriate technical terminology (English + standard Italian terms where applicable).
- Focus on both technical accuracy and strong oral exam presentation skills.
- Never hallucinate or invent knowledge beyond the standard curriculum and uploaded materials.

Begin immediately with your first question for ${context.name}. Do not introduce yourself or ask for confirmation of the subject.`;

  if (uploadedMaterials && uploadedMaterials.length > 0) {
    const materials = uploadedMaterials.map(m => m.filename).join(', ');
    prompt += `\n\n**Student-Uploaded Materials Available**:\n${materials}\n\nAlways reference and prioritize these materials when providing feedback and grounding your questions and feedback.`;
  }

  return prompt;
}

app.post('/api/exam/start', (req, res) => {
  const { subject } = req.body;
  const validSubjects = Object.keys(subjectContext);

  if (!validSubjects.includes(subject)) {
    return res.status(400).json({ error: `Invalid subject. Choose from: ${validSubjects.join(', ')}` });
  }

  const sessionId = generateSessionId();
  examSessions[sessionId] = {
    subject,
    courseName: courseNames[subject],
    messages: [],
    questionCount: 0,
    uploadedMaterials: [],
  };

  res.json({ sessionId, subject, courseName: courseNames[subject] });
});

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
    content: req.file.buffer.toString('utf-8', 0, Math.min(50000, req.file.size)),
  };

  examSessions[sessionId].uploadedMaterials.push(material);

  res.json({
    message: 'File uploaded successfully',
    filename: req.file.originalname,
    materialsCount: examSessions[sessionId].uploadedMaterials.length,
  });
});

app.post('/api/exam/question', async (req, res) => {
  const { sessionId, studentAnswer, imageData } = req.body;

  if (!sessionId || !examSessions[sessionId]) {
    return res.status(404).json({ error: 'Exam session not found' });
  }

  const session = examSessions[sessionId];
  const systemPrompt = buildSystemPrompt(session.subject, session.uploadedMaterials);

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
      temperature: 0.7,
      max_tokens: 600,
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

Provide a concise hint (2-3 sentences) that guides the student without giving away the full answer. Focus on key concepts, structure, or important relationships to consider.

Also extract 1-2 key search terms for finding relevant images or diagrams.`;

    const hintResponse = await client.chat.completions.create({
      model: 'grok-4.3',
      messages: [{ role: 'user', content: hintPrompt }],
      temperature: 0.7,
      max_tokens: 250,
    });

    const hintContent = hintResponse.choices[0].message.content;
    
    const lines = hintContent.split('\n');
    let textHint = hintContent;
    let searchTerms = 'anatomy physiology biomedical';

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

app.get('/api/search-image', async (req, res) => {
  const { query } = req.query;
  
  if (!query) {
    return res.status(400).json({ error: 'Query required' });
  }

  try {
    const googleImagesUrl = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`;
    
    res.json({
      imageUrl: googleImagesUrl,
      source: 'Google Images',
      searchQuery: query,
    });
  } catch (error) {
    console.error('Image search error:', error);
    res.status(500).json({ error: 'Failed to search images' });
  }
});

app.get('/api/exam/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;

  if (!examSessions[sessionId]) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const session = examSessions[sessionId];
  res.json({
    subject: session.subject,
    courseName: session.courseName,
    questionCount: session.questionCount,
    messageCount: session.messages.length,
    materialsUploaded: session.uploadedMaterials.length,
  });
});

app.delete('/api/exam/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;

  if (examSessions[sessionId]) {
    delete examSessions[sessionId];
    res.json({ message: 'Session ended' });
  } else {
    res.status(404).json({ error: 'Session not found' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`UCBM Oral Exam Simulator running on http://0.0.0.0:${PORT}`);
  console.log(`XAI_API_KEY set: ${!!process.env.XAI_API_KEY}`);
  console.log('22 UCBM courses loaded');
});
