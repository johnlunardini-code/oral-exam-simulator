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
const instructorMap = {};

courseSpecs.courses.forEach(course => {
  if (!course.id) return;
  courseMap[course.id] = course;
  instructorMap[course.id] = course.instructor || 'UCBM Faculty';
  
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

function cleanMarkdown(text) {
  return text
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/__|__/g, '')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/`/g, '');
}

const examSessions = {};

function generateSessionId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function buildSystemPrompt(subject, uploadedMaterials, assessmentType, studentName, isFirstQuestion) {
  const course = courseMap[subject];
  if (!course) {
    return 'You are an UCBM Exam Tutor.';
  }

  const assessmentHint = getAssessmentHint(assessmentType);
  const textbooks = courseTextbooks[subject] || 'Course-specific references';
  const instructor = instructorMap[subject] || 'UCBM Faculty';
  const isItalianCourse = subject === 'italian';

  let prompt = `You are an experienced UCBM (Università Campus Bio-Medico di Roma) professor in the Biomedical Engineering (BEN) program, conducting realistic oral exams for students in Years 1–3.

MANDATORY STRICT COURSE LOCK: This exam is EXCLUSIVELY for ${course.name}. All your questions, feedback, and exam content MUST relate ONLY to ${course.name}. Do NOT ask about other courses or subjects unless they are specifically part of this course's curriculum.${isItalianCourse ? ' Ask questions IN ENGLISH about Italian language concepts, teaching Italian grammar/vocabulary/pronunciation/cultural understanding equivalent to Level I-II at US university. Questions should teach practical Italian conversation, grammar rules, vocabulary, and cultural understanding for English speakers.' : ''}

**SESSION FLOW**:
1. Begin with one strong, realistic oral exam-style question for the chosen course. Introduce yourself and the exam before the first question only.
2. After the student's response, give **immediate constructive feedback** (1-3 sentences) followed by the next question.
3. Continue naturally until the student ends the session.

**RESPONSE AFTER STUDENT'S ANSWER**:
- Give brief, natural, constructive feedback (not a full structured evaluation every time)
- Point out strengths and gently correct major inaccuracies
- Then ask a follow-up or next question to keep the exam flowing naturally

**FEEDBACK BUTTON**:
- When student clicks Feedback, provide **detailed structured evaluation**:
  - Accuracy of content
  - Depth of understanding
  - Clarity and structure
  - Integration of concepts
  - Oral exam technique (terminology, logical flow, confidence)

**CRITICAL DIRECTIVES**:
- Always read and process the **FULL question** provided. Never truncate, summarize, or ignore any part.
- Stay fully in character as a UCBM professor.
- Process uploaded documents: acknowledge them, use their content when relevant.
- Gently redirect off-topic messages back to the exam.

**QUESTION UNIQUENESS AND VARIETY (MANDATORY)**:
Each exam session MUST feature FRESH, ORIGINAL questions throughout:
- NEVER repeat exact questions within the same exam session
- NEVER ask identical topics or concepts twice
- Rephrase conceptually similar areas but from different angles or contexts
- Build on foundational material logically but ALWAYS introduce new perspectives, synthesis questions, or practical applications
- Mix question types: conceptual definitions, quantitative problems, practical applications, case studies, compare/contrast, design challenges
- When starting NEW exam sessions: rephrase foundational questions completely from previous sessions and ensure variety

**KNOWLEDGE FOUNDATION**:
Base ALL questions, explanations, feedback, and corrections primarily on:
1. Official UCBM Piano degli Studi 2026-2027
2. Detailed Teaching Sheets (Schede Didattiche 2025-2026) with course objectives, contents, professor expectations, exam formats
3. Standard references:
   - Anatomy & Physiology: Gray's Anatomy for Students, Netter's Atlas, Guyton & Hall, Costanzo
   - Physics: Halliday/Resnick/Walker, Serway (with biomedical applications)
   - Biomechanics: Ozkaya/Knudson Fundamentals, Y.C. Fung
   - Bioengineering: Enderle & Bronzino Introduction to Biomedical Engineering
   - Other subjects: University-level references aligned with UCBM curriculum

**RESPONSE STYLE**:
- Professional, supportive but rigorous UCBM professor tone
- Use appropriate technical terminology (English + standard Italian terms as needed)
- Adjust depth according to course year level
- Begin new sessions **immediately** with a relevant first question. Never ask for confirmation.`;

  if (isFirstQuestion) {
    prompt += `

**FIRST QUESTION - INCLUDE INTRODUCTION**
Start with a brief, warm introduction (1-2 sentences) including:
1. Your name (${instructor})
2. Course name (${course.name})
3. Welcoming tone
4. Then immediately ask the first realistic exam question for this course

Example opening: "Good morning ${studentName}, I'm ${instructor}, and we'll be examining you today on ${course.name}. Let's begin..."`;
  } else {
    prompt += `

**CONTINUE EXAM**
Ask the next focused question aligned with learning objectives. Ensure it is DIFFERENT from all previous questions in this session and STAY ON TOPIC: question must be about ${course.name} only.`;
  }

  prompt += `\n\nCourse: ${course.name}
Assessment: ${assessmentType.replace(/-/g, '/')}
Tip: ${assessmentHint}

Begin now. Do NOT use markdown formatting.`;

  if (uploadedMaterials && uploadedMaterials.length > 0) {
    prompt += `\n\nSTUDENT MATERIALS (USE THESE FOR QUESTIONS & FEEDBACK):\n`;
    uploadedMaterials.forEach(material => {
      prompt += `\n[${material.filename}]\n${material.content.substring(0, 30000)}\n---\n`;
    });
  }

  return prompt;
}

app.post('/api/exam/start', (req, res) => {
  const { subject, studentName } = req.body;
  const validSubjects = Object.keys(courseMap);

  if (!validSubjects.includes(subject)) {
    return res.status(400).json({ error: `Invalid subject` });
  }

  const sessionId = generateSessionId();
  const course = courseMap[subject];
  const emoji = getEmojiForCourse(course.name);
  const assessmentType = assessmentTypeMap[subject] || 'oral';
  
  examSessions[sessionId] = {
    subject,
    studentName: studentName || 'Student',
    courseName: `${emoji} ${course.name}`,
    courseData: course,
    assessmentType,
    messages: [],
    questionCount: 0,
    uploadedMaterials: [],
    scoreTracker: { correct: 0, total: 0 },
    isFirstQuestion: true,
    lastAnswerIncomplete: false,
  };

  res.json({ 
    sessionId, 
    subject, 
    courseName: `${emoji} ${course.name}`,
    assessmentType,
    studentName: studentName || 'Student',
    courseInfo: {
      instructor: instructorMap[subject],
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
  const isFirst = session.isFirstQuestion;
  
  // ISSUE 1 FIX: Check for invalid/incomplete answers and handle without advancing question
  const answerLength = studentAnswer ? studentAnswer.trim().length : 0;
  const isInvalidAnswer = answerLength < 5 || (studentAnswer && (studentAnswer.includes('???') || studentAnswer.includes('...') || studentAnswer.toLowerCase() === 'skip'));
  
  if (isInvalidAnswer && !isFirst) {
    // Return feedback without incrementing questionCount - same question restatement
    let lastQuestion = '';
    for (let i = session.messages.length - 1; i >= 0; i--) {
      if (session.messages[i].role === 'assistant') {
        lastQuestion = session.messages[i].content;
        break;
      }
    }
    
    if (lastQuestion) {
      const feedbackMessage = `Your answer seems incomplete. Please provide more details.\n\nQuestion ${session.questionCount} was: ${lastQuestion.substring(0, 300)}`;
      return res.json({
        response: feedbackMessage,
        questionNumber: session.questionCount,
        hypotheticalScore: null,
        scoreTracker: session.scoreTracker,
        isIncompleteAnswer: true
      });
    }
  }
  
  const systemPrompt = buildSystemPrompt(
    session.subject, 
    session.uploadedMaterials, 
    session.assessmentType,
    session.studentName,
    isFirst
  );

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

    let professorMessage = response.choices[0].message.content;
    professorMessage = cleanMarkdown(professorMessage);

    session.messages.push({
      role: 'assistant',
      content: professorMessage,
    });

    // ISSUE 1 FIX: Only increment if this wasn't marked as incomplete
    session.questionCount += 1;
    session.scoreTracker.total += 1;
    session.isFirstQuestion = false;

    if (studentAnswer && studentAnswer.trim()) {
      const scoringPrompt = `Based on this exam question and student answer, rate how correct/complete the answer was.
      
Question (excerpt): "${session.messages[session.messages.length - 2]?.content?.substring(0, 200) || 'Previous question'}"
Student Answer: "${studentAnswer.substring(0, 300)}"

Rate 1-5 where: 1=incorrect/incomplete, 2=poor, 3=partial/fair, 4=good, 5=excellent

RESPOND WITH ONLY A NUMBER 1-5, nothing else.`;

      try {
        const scoreResponse = await client.chat.completions.create({
          model: 'grok-4.3',
          messages: [{ role: 'user', content: scoringPrompt }],
          temperature: 0.3,
          max_tokens: 10,
        });
        const scoreNum = parseInt(scoreResponse.choices[0].message.content.trim());
        if (scoreNum >= 3) {
          session.scoreTracker.correct += 1;
        }
      } catch (e) {
        console.log('Scoring error (non-critical):', e.message);
      }
    }

    let hypotheticalScore = null;
    if (session.questionCount % 10 === 0) {
      const percentage = (session.scoreTracker.correct / session.scoreTracker.total) * 100;
      hypotheticalScore = Math.round(percentage * 3) / 10;
    }

    res.json({
      response: professorMessage,
      questionNumber: session.questionCount,
      hypotheticalScore: hypotheticalScore,
      scoreTracker: session.scoreTracker
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed' });
  }
});

app.post('/api/exam/feedback', async (req, res) => {
  const { sessionId, questionIndex } = req.body;

  if (!sessionId || !examSessions[sessionId]) {
    return res.status(404).json({ error: 'Not found' });
  }

  const session = examSessions[sessionId];
  
  try {
    let targetQuestion = '';
    let targetAnswer = '';
    
    if (questionIndex !== undefined && questionIndex >= 0) {
      const messages = session.messages;
      let qCount = 0;
      for (let i = 0; i < messages.length; i++) {
        if (messages[i].role === 'assistant') {
          if (qCount === questionIndex) {
            targetQuestion = messages[i].content;
            if (i + 1 < messages.length && messages[i + 1].role === 'user') {
              targetAnswer = messages[i + 1].content;
            }
            break;
          }
          qCount++;
        }
      }
    } else {
      for (let i = session.messages.length - 1; i >= 0; i--) {
        if (session.messages[i].role === 'assistant') {
          targetQuestion = session.messages[i].content;
          if (i + 1 < session.messages.length && session.messages[i + 1].role === 'user') {
            targetAnswer = session.messages[i + 1].content;
          }
          break;
        }
      }
    }

    if (!targetQuestion) {
      return res.status(400).json({ error: 'No question found' });
    }

    if (!targetAnswer) {
      return res.status(400).json({ error: 'No answer provided for this question' });
    }

    const feedbackPrompt = `You are ${instructorMap[session.subject]}, providing detailed feedback on ${session.studentName}'s answer.

Question: "${targetQuestion.substring(0, 300)}"

Student Answer: "${targetAnswer.substring(0, 500)}"

Provide constructive feedback covering:
1. Accuracy of the answer
2. Completeness and depth
3. Clarity of explanation
4. Key points missed or well explained
5. Suggestions for improvement

Keep feedback concise but thorough (3-4 sentences). Do NOT use markdown formatting.`;

    const feedbackResponse = await client.chat.completions.create({
      model: 'grok-4.3',
      messages: [{ role: 'user', content: feedbackPrompt }],
      temperature: 0.7,
      max_tokens: 300,
    });

    let feedback = feedbackResponse.choices[0].message.content;
    feedback = cleanMarkdown(feedback);

    res.json({ feedback });
  } catch (error) {
    console.error('Feedback error:', error);
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

    const hintPrompt = `Question: "${lastQuestion.substring(0, 200)}"
    
Provide a brief hint (2 sentences, no spoilers). Do NOT use markdown formatting.`;

    // ISSUE 2 FIX: First generate the hint, then extract 2-3 concise keywords from it
    const hintResponse = await client.chat.completions.create({
      model: 'grok-4.3',
      messages: [{ role: 'user', content: hintPrompt }],
      temperature: 0.7,
      max_tokens: 200,
    });

    let textHint = hintResponse.choices[0].message.content;
    textHint = cleanMarkdown(textHint);
    
    // ISSUE 2 FIX: Extract 2-3 key technical keywords from the HINT TEXT, not the question
    const searchTermsPrompt = `From this hint text, extract ONLY 2-3 key technical noun phrases (5-8 words max total) suitable for Google search.
    
Hint: "${textHint}"
    
Return ONLY the keywords separated by spaces (e.g., "mediastinum subdivisions anatomy" or "enzyme inhibition kinetics"). No professor names, course names, or full sentences. Just compact technical terms.`;

    const termsResponse = await client.chat.completions.create({
      model: 'grok-4.3',
      messages: [{ role: 'user', content: searchTermsPrompt }],
      temperature: 0.3,
      max_tokens: 30,
    });

    let searchTerms = termsResponse.choices[0].message.content.trim();
    if (!searchTerms || searchTerms.includes('professor') || searchTerms.includes('course') || searchTerms.length < 3) {
      const words = textHint.split(/\s+/).filter(w => w.length > 4 && !['question', 'explain', 'describe', 'professor', 'course', 'exam', 'hint', 'provide', 'brief'].includes(w.toLowerCase())).slice(0, 3);
      searchTerms = words.join(' ') || 'course concepts';
    }

    res.json({ 
      textHint,
      searchTerms: searchTerms || 'general topic'
    });
  } catch (error) {
    console.error('Hint error:', error);
    res.status(500).json({ error: 'Failed' });
  }
});

app.post('/api/exam/score-answer', (req, res) => {
  const { sessionId, isCorrect } = req.body;

  if (!sessionId || !examSessions[sessionId]) {
    return res.status(404).json({ error: 'Not found' });
  }

  const session = examSessions[sessionId];
  if (isCorrect) {
    session.scoreTracker.correct += 1;
  }

  res.json({
    scoreTracker: session.scoreTracker,
    percentage: Math.round((session.scoreTracker.correct / session.scoreTracker.total) * 100)
  });
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
    studentName: session.studentName,
    assessmentType: session.assessmentType,
    questionCount: session.questionCount,
    scoreTracker: session.scoreTracker,
    messages: session.messages.filter(m => m.role === 'assistant').map((q, i) => ({ index: i, question: q.content }))
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
