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
    console.log('✅ Loaded real UCBM courses from courses-extracted.json');
  } else {
    throw new Error('File not found');
  }
} catch (e) {
  console.log('⚠️  courses-extracted.json not found, creating from course-specs.json...');
  try {
    courseSpecs = JSON.parse(fs.readFileSync(path.join(__dirname, 'course-specs.json'), 'utf-8'));
    console.log('✅ Using fallback course-specs.json');
  } catch (err) {
    console.error('❌ Neither course data file found. Using minimal default courses.');
    courseSpecs = { courses: [] };
  }
}

const courseMap = {};
const assessmentTypeMap = {};

courseSpecs.courses.forEach(course => {
  courseMap[course.id] = course;
  
  // Determine assessment type from assessment field
  const assessment = (course.assessment || '').toLowerCase();
  let type = 'oral'; // default
  
  if (assessment.includes('written') && assessment.includes('oral')) {
    type = 'written-oral';
  } else if (assessment.includes('written') && assessment.includes('project')) {
    type = 'written-project';
  } else if (assessment.includes('written') && assessment.includes('lab')) {
    type = 'written-lab';
  } else if (assessment.includes('project') && assessment.includes('presentation')) {
    type = 'project-presentation';
  } else if (assessment.includes('written')) {
    type = 'written';
  } else if (assessment.includes('lab') || assessment.includes('laboratory')) {
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
      cb(new Error('Invalid file type. Only PDF, DOCX, PPTX, TXT, and images allowed.'));
    }
  }
});

const client = new OpenAI({
  apiKey: process.env.XAI_API_KEY || 'sk-placeholder',
  baseURL: 'https://api.x.ai/v1',
});

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
    'oral': 'Prepare to discuss concepts clearly and demonstrate deep understanding. Focus on explaining ideas verbally.',
    'written': 'Practice solving problems on paper with clear mathematical steps. Time management is key.',
    'written-oral': 'Study both written problem-solving and verbal explanation. Balance theory with calculations.',
    'lab': 'Prepare for hands-on experimentation. Know procedures, safety, and data analysis methods.',
    'project': 'Be ready to present your work and defend your methodology and results.',
    'written-lab': 'Expect both theoretical written exams and practical laboratory components.',
    'written-project': 'You\'ll need to produce written work and present findings.',
    'project-presentation': 'Focus on clear presentation skills and ability to discuss your project in detail.'
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
    return 'You are an UCBM Exam Tutor conducting a preparation session.';
  }

  const assessmentHint = getAssessmentHint(assessmentType);

  let prompt = `You are an experienced UCBM Exam Tutor helping students prepare for their assessment in the Biomedical Engineering program.

**Course**: ${course.name}
**Instructor**: ${course.instructor || 'UCBM Faculty'}
**ECTS**: ${course.ects || 'N/A'}
**Assessment Type**: ${assessmentType.replace('-', ' / ').toUpperCase()}

**Course Objectives**:
${course.objectives || 'Standard biomedical engineering course.'}

**Prerequisites**:
${course.prerequisites || 'None'}

**Assessment Details**:
${course.assessment || 'Standard exam'}

**Key References**:
${course.references || 'Course materials'}

**Assessment Preparation Tip**:
${assessmentHint}

**Your Role as Exam Tutor**:
1. Ask realistic questions that match this course's assessment format.
2. After each response, provide constructive feedback on:
   - Technical accuracy
   - Depth of understanding
   - Communication clarity (especially important for oral/presentation components)
   - Problem-solving approach (if written exam)
   - Practical understanding (if lab component)
3. Adapt difficulty progressively based on student performance.
4. Reference uploaded materials when available.
5. Use appropriate technical terminology.

**Session Style**:
- Start with one clear, focused question aligned with course learning objectives
- Listen carefully to responses and provide detailed, actionable feedback
- Ask probing follow-up questions to test deeper understanding
- Help students practice presentation skills if it's an oral/presentation exam
- Provide encouragement and identify areas for improvement

Begin immediately with your first question for ${course.name} (${assessmentType.replace('-', '/')})`. Do not introduce yourself or ask for confirmation.`;

  if (uploadedMaterials && uploadedMaterials.length > 0) {
    const materials = uploadedMaterials.map(m => m.filename).join(', ');
    prompt += `\n\n**Student-Uploaded Materials**: ${materials}\nUse these materials to ground your questions and feedback in the student's actual course content.`;
  }

  return prompt;
}

app.post('/api/exam/start', (req, res) => {
  const { subject } = req.body;
  const validSubjects = Object.keys(courseMap);

  if (!validSubjects.includes(subject)) {
    return res.status(400).json({ 
      error: `Invalid subject. Available: ${validSubjects.slice(0, 5).join(', ')}...`,
      validSubjects,
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
      semester: course.semester,
      assessment: course.assessment
    }
  });
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
  const systemPrompt = buildSystemPrompt(session.subject, session.uploadedMaterials, session.assessmentType);

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
    console.error('API error:', error);
    res.status(500).json({ error: 'Failed to generate response: ' + error.message });
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

Provide a concise hint (2-3 sentences) that guides the student without giving away the full answer.`;

    const hintResponse = await client.chat.completions.create({
      model: 'grok-4.3',
      messages: [{ role: 'user', content: hintPrompt }],
      temperature: 0.7,
      max_tokens: 250,
    });

    res.json({ textHint: hintResponse.choices[0].message.content });
  } catch (error) {
    console.error('Hint generation error:', error);
    res.status(500).json({ error: 'Failed to generate hint' });
  }
});

app.get('/api/courses', (req, res) => {
  const coursesList = courseSpecs.courses.map(course => ({
    id: course.id,
    name: course.name,
    code: course.code,
    instructor: course.instructor,
    ects: course.ects,
    assessmentType: assessmentTypeMap[course.id] || 'oral',
    emoji: getEmojiForCourse(course.name)
  }));
  res.json({ courses: coursesList });
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
    assessmentType: session.assessmentType,
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
  res.json({ 
    status: 'ok', 
    coursesLoaded: courseSpecs.courses.length,
    appName: 'UCBM Exam Tutor'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🎓 UCBM Exam Tutor running on http://0.0.0.0:${PORT}`);
  console.log(`📚 ${courseSpecs.courses.length} courses loaded`);
  console.log(`🔑 XAI_API_KEY: ${!!process.env.XAI_API_KEY ? '✅' : '⚠️ Not set'}\n`);
});
