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

// Load real UCBM course data
let courseSpecs;
const courseDataPath = path.join(__dirname, 'courses-extracted.json');

try {
  if (fs.existsSync(courseDataPath)) {
    courseSpecs = JSON.parse(fs.readFileSync(courseDataPath, 'utf-8'));
    console.log('✅ Loaded real UCBM courses');
  } else {
    throw new Error('File not found');
  }
} catch (e) {
  console.log('⚠️  Trying fallback...');
  try {
    const specPath = path.join(__dirname, 'course-specs.json');
    if (fs.existsSync(specPath)) {
      courseSpecs = JSON.parse(fs.readFileSync(specPath, 'utf-8'));
      console.log('✅ Using fallback');
    } else {
      throw new Error('No spec file');
    }
  } catch (err) {
    console.error('❌ Using minimal defaults');
    courseSpecs = { courses: [
      { id: 'fundamentals-of-computer-science', name: 'Fundamentals of Computer Science', instructor: 'ROSA SICILIA', ects: 10, assessment: 'Practical + Oral', prerequisites: 'Basic computer skills' },
      { id: 'mathematics', name: 'Mathematics', instructor: 'MARTA MENCI', ects: 10, assessment: 'Written exam', prerequisites: 'High school algebra' },
      { id: 'chemistry', name: 'Chemistry', instructor: 'SARA MARIA GIANNITELLI', ects: 7, assessment: 'Multiple choice written test', prerequisites: 'Basic chemistry' },
      { id: 'general-physics', name: 'General Physics', instructor: 'ALESSANDRO LOPPINI', ects: 12, assessment: 'Written + Optional Oral', prerequisites: 'Precalculus' },
    ]};
  }
}

const courseMap = {};
const assessmentTypeMap = {};

courseSpecs.courses.forEach(course => {
  if (!course.id) return;
  courseMap[course.id] = course;
  
  const assessment = (course.assessment || '').toLowerCase();
  let type = 'oral';
  
  if (assessment.includes('written') && assessment.includes('oral')) {
    type = 'written-oral';
  } else if (assessment.includes('written') && assessment.includes('project')) {
    type = 'written-project';
  } else if (assessment.includes('written') && assessment.includes('lab')) {
    type = 'written-lab';
  } else if (assessment.includes('project') && assessment.includes('presentation')) {
    type = 'project-presentation';
  } else if (assessment.includes('practical') && assessment.includes('oral')) {
    type = 'practical-oral';
  } else if (assessment.includes('written')) {
    type = 'written';
  } else if (assessment.includes('lab') || assessment.includes('laboratory') || assessment.includes('practical')) {
    type = 'lab';
  } else if (assessment.includes('project')) {
    type = 'project';
  }
  
  assessmentTypeMap[course.id] = type;
});

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
      cb(new Error('Invalid file type.'));
    }
  }
});

const client = new OpenAI({
  apiKey: process.env.XAI_API_KEY || 'sk-placeholder',
  baseURL: 'https://api.x.ai/v1',
});

// Verified textbooks by course
const courseTextbooks = {
  'anatomy': "Gray's Anatomy for Students, Netter's Atlas of Human Anatomy",
  'physiology': 'Guyton & Hall Textbook of Medical Physiology, Costanzo Physiology',
  'chemistry': 'Whitten Chemistry, Lausarot Stechiometria',
  'general-physics': 'Tipler Physics for Scientists and Engineers, Serway Physics',
  'advanced-physics': 'Tipler Modern Physics, Morrison Modern Physics',
  'mathematics': 'Lay Linear Algebra, Stewart Calculus',
  'mathematics-ii': 'Lay Linear Algebra, Stewart Calculus Early Transcendentals',
  'probability-and-statistics': 'Ross Introduction to Probability and Statistics',
  'biomechanics': 'Ozkaya & Nordin Fundamentals of Biomechanics, Y.C. Fung',
  'biomedical-signal-processing': 'Semmlow Circuits and Systems for Bioengineers, Abood Digital Signal Processing',
  'electronics-and-electrotechnics': 'Alexander & Sadiku Fundamentals of Electric Circuits, Horowitz & Hill Art of Electronics',
  'measurements-and-instrumentation-in-biomedical-engineering': 'Beckwith Mechanical Measurements, Figliola Theory and Design for Mechanical Measurements',
};

// Verified academic sources
const verifiedSources = {
  'pubmed': 'https://pubmed.ncbi.nlm.nih.gov/',
  'ieee': 'https://ieeexplore.ieee.org/',
  'scholar': 'https://scholar.google.com/',
  'openstax': 'https://openstax.org/',
  'nih': 'https://www.nlm.nih.gov/',
  'sciencedirect': 'https://www.sciencedirect.com/',
};

function getEmojiForCourse(name) {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('computer')) return '💻';
  if (lowerName.includes('math')) return '📐';
  if (lowerName.includes('chemistry')) return '⚗️';
  if (lowerName.includes('physics')) return '⚡';
  if (lowerName.includes('economics') || lowerName.includes('management')) return '💼';
  if (lowerName.includes('english') || lowerName.includes('italian')) return '🌍';
  if (lowerName.includes('physiology')) return '❤️';
  if (lowerName.includes('anatomy')) return '🦴';
  if (lowerName.includes('signal')) return '📡';
  if (lowerName.includes('robotics')) return '🤖';
  if (lowerName.includes('control')) return '🎛️';
  if (lowerName.includes('biomechanics')) return '🏃';
  if (lowerName.includes('bioengineering')) return '🔧';
  if (lowerName.includes('measurement') || lowerName.includes('instrumentation')) return '🔬';
  if (lowerName.includes('electronics')) return '🔌';
  if (lowerName.includes('mechanics')) return '🏗️';
  if (lowerName.includes('transport') || lowerName.includes('thermodynamics')) return '🌡️';
  if (lowerName.includes('healthcare') || lowerName.includes('telemedicine')) return '🏥';
  if (lowerName.includes('ethics') || lowerName.includes('anthropology')) return '🎭';
  if (lowerName.includes('humanities')) return '📚';
  if (lowerName.includes('probability') || lowerName.includes('statistics')) return '📈';
  if (lowerName.includes('lab')) return '🧪';
  return '📖';
}

function getAssessmentHint(assessmentType) {
  const hints = {
    'oral': 'Prepare to discuss concepts clearly and demonstrate deep understanding.',
    'written': 'Practice solving problems with clear mathematical steps.',
    'written-oral': 'Study both written problem-solving and verbal explanation.',
    'lab': 'Know procedures, safety, and data analysis methods.',
    'practical-oral': 'Be ready for hands-on work plus verbal defense.',
    'project': 'Prepare presentations and defend your methodology.',
    'written-lab': 'Expect both theoretical exams and practical components.',
    'written-project': 'Balance written work with project presentations.',
    'project-presentation': 'Focus on clear presentation skills.'
  };
  return hints[assessmentType] || hints['oral'];
}

const examSessions = {};

function generateSessionId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function buildSystemPrompt(subject, uploadedMaterials, assessmentType) {
  const course = courseMap[subject];
  if (!course) {
    return 'You are an UCBM Exam Tutor.';
  }

  const assessmentHint = getAssessmentHint(assessmentType);
  const textbooks = courseTextbooks[subject] || 'Course-specific references';

  let prompt = `You are an UCBM Exam Tutor helping students prepare for ${course.name}.

KNOWLEDGE FOUNDATION (AUTHORITATIVE SOURCES):
✓ PRIMARY: UCBM Piano degli Studi & Teaching Sheets for ${course.name}
✓ TEXTBOOKS: ${textbooks}
✓ RESEARCH: PubMed, IEEE Xplore, Scholar.Google for peer-reviewed content
✓ STANDARDS: ISO, IEC, IEEE standards for biomedical engineering
✗ NEVER: Invent content beyond official curriculum

**COURSE DETAILS**
Name: ${course.name}
Instructor: ${course.instructor || 'UCBM Faculty'}
ECTS: ${course.ects || 'N/A'}
Assessment: ${course.assessment || 'Standard exam'}
Type: ${assessmentType.replace(/-/g, ' / ').toUpperCase()}

**COURSE OBJECTIVES**
${course.objectives || 'Develop comprehensive understanding of the subject'}

**PREREQUISITES**
${course.prerequisites || 'None specified'}

**CRITICAL RULES**
1. Base all questions on UCBM Teaching Sheets for this course
2. Reference textbooks when explaining concepts
3. Validate facts against peer-reviewed sources (PubMed, IEEE)
4. Flag anything beyond standard curriculum as "emerging topic"
5. Provide citations for factual claims

**ASSESSMENT FOCUS**
Type: ${assessmentType.replace(/-/g, '/')}
Tip: ${assessmentHint}

**YOUR ROLE**
- Ask realistic questions aligned with UCBM learning objectives
- Provide feedback grounded in verified sources
- Adapt difficulty based on performance
- Help practice format-specific skills
- Encourage deep understanding

**SESSION FLOW**
1. Ask one focused question from UCBM Teaching Sheets
2. Evaluate response against course standards
3. Provide detailed, evidence-based feedback
4. Ask follow-up probing questions
5. Help with presentation skills if applicable

Begin with your first question for ${course.name}. Base it on the official UCBM curriculum.`;

  if (uploadedMaterials && uploadedMaterials.length > 0) {
    const materials = uploadedMaterials.map(m => m.filename).join(', ');
    prompt += `\n\nSTUDENT MATERIALS: ${materials}\nPrioritize these in questions and feedback.`;
  }

  return prompt;
}

app.post('/api/exam/start', (req, res) => {
  const { subject } = req.body;
  const validSubjects = Object.keys(courseMap);

  if (!validSubjects.includes(subject)) {
    return res.status(400).json({ 
      error: `Invalid subject`,
      availableCount: validSubjects.length
    });
  }

  const sessionId = generateSessionId();
  const course = courseMap[subject];
  const emoji = getEmojiForCourse(course.name);
  const assessmentType = assessmentTypeMap[subject] || 'oral';
  
  examSessions[sessionId] = {
    subject,
    courseName: `${emoji} ${course.name}`,
    courseData: course,
    assessmentType,
    messages: [],
    questionCount: 0,
    uploadedMaterials: [],
  };

  res.json({ 
    sessionId, 
    subject, 
    courseName: `${emoji} ${course.name}`,
    assessmentType,
    courseInfo: {
      instructor: course.instructor,
      ects: course.ects,
      assessment: course.assessment
    }
  });
});

app.post('/api/exam/upload/:sessionId', upload.single('file'), (req, res) => {
  const { sessionId } = req.params;

  if (!sessionId || !examSessions[sessionId]) {
    return res.status(404).json({ error: 'Session not found' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No file' });
  }

  const material = {
    filename: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    content: req.file.buffer.toString('utf-8', 0, Math.min(50000, req.file.size)),
  };

  examSessions[sessionId].uploadedMaterials.push(material);

  res.json({
    message: 'Uploaded',
    filename: req.file.originalname,
    count: examSessions[sessionId].uploadedMaterials.length,
  });
});

app.post('/api/exam/question', async (req, res) => {
  const { sessionId, studentAnswer } = req.body;

  if (!sessionId || !examSessions[sessionId]) {
    return res.status(404).json({ error: 'Not found' });
  }

  const session = examSessions[sessionId];
  const systemPrompt = buildSystemPrompt(session.subject, session.uploadedMaterials, session.assessmentType);

  try {
    if (studentAnswer && studentAnswer.trim()) {
      session.messages.push({
        role: 'user',
        content: studentAnswer,
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
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed' });
  }
});

app.post('/api/exam/hint', async (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId || !examSessions[sessionId]) {
    return res.status(404).json({ error: 'Not found' });
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
      return res.status(400).json({ error: 'No question' });
    }

    const hintPrompt = `Question: "${lastQuestion.substring(0, 150)}"
    
Provide a brief hint (2 sentences, no spoilers).`;

    const hintResponse = await client.chat.completions.create({
      model: 'grok-4.3',
      messages: [{ role: 'user', content: hintPrompt }],
      temperature: 0.7,
      max_tokens: 200,
    });

    res.json({ textHint: hintResponse.choices[0].message.content });
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

app.get('/api/courses', (req, res) => {
  const coursesList = Object.entries(courseMap).map(([id, course]) => ({
    id,
    name: course.name,
    instructor: course.instructor,
    ects: course.ects,
    assessmentType: assessmentTypeMap[id] || 'oral',
    emoji: getEmojiForCourse(course.name)
  }));
  res.json({ courses: coursesList, total: coursesList.length });
});

app.get('/api/exam/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;

  if (!examSessions[sessionId]) {
    return res.status(404).json({ error: 'Not found' });
  }

  const session = examSessions[sessionId];
  res.json({
    subject: session.subject,
    courseName: session.courseName,
    assessmentType: session.assessmentType,
    questionCount: session.questionCount,
  });
});

app.delete('/api/exam/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  if (examSessions[sessionId]) {
    delete examSessions[sessionId];
    res.json({ message: 'Ended' });
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    courses: Object.keys(courseMap).length,
    app: 'UCBM Exam Tutor'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎓 UCBM Exam Tutor on port ${PORT}`);
  console.log(`📚 ${Object.keys(courseMap).length} courses\n`);
});
