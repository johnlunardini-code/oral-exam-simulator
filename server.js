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
      { id: 'fundamentals-of-computer-science', name: 'Fundamentals of Computer Science', instructor: 'ROSA SICILIA', ects: 10, assessment: 'Practical + Oral', prerequisites: 'Basic computer skills', yearLevel: 1 },
      { id: 'mathematics', name: 'Mathematics', instructor: 'MARTA MENCI', ects: 10, assessment: 'Written exam', prerequisites: 'High school algebra', yearLevel: 1 },
      { id: 'chemistry', name: 'Chemistry', instructor: 'SARA MARIA GIANNITELLI', ects: 7, assessment: 'Multiple choice written test', prerequisites: 'Basic chemistry', yearLevel: 1 },
      { id: 'general-physics', name: 'General Physics', instructor: 'ALESSANDRO LOPPINI', ects: 12, assessment: 'Written + Optional Oral', prerequisites: 'Precalculus', yearLevel: 1 },
      { id: 'italian', name: 'Italian', instructor: 'UCBM Faculty', ects: 6, assessment: 'Oral', prerequisites: 'None', yearLevel: 1 },
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
  'general-physics': 'Tipler Physics for Scientists and Engineers, Serway Physics, Halliday/Resnick/Walker Physics',
  'advanced-physics': 'Tipler Modern Physics, Morrison Modern Physics',
  'mathematics': 'Lay Linear Algebra, Stewart Calculus',
  'mathematics-ii': 'Lay Linear Algebra, Stewart Calculus Early Transcendentals',
  'probability-and-statistics': 'Ross Introduction to Probability and Statistics',
  'biomechanics': 'Ozkaya & Nordin Fundamentals of Biomechanics, Y.C. Fung Biomechanics',
  'biomedical-signal-processing': 'Semmlow Circuits and Systems for Bioengineers, Abood Digital Signal Processing',
  'electronics-and-electrotechnics': 'Alexander & Sadiku Fundamentals of Electric Circuits, Horowitz & Hill Art of Electronics',
  'fundamentals-of-bioengineering': 'Enderle & Bronzino Introduction to Biomedical Engineering',
  'italian': 'Ciao! Italian for English Speakers, Prego! Contemporary Italian',
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

// Enhanced session initialization with tracking and language support
function initializeSessionWithTracking(subject, studentName) {
  const sessionId = generateSessionId();
  const course = courseMap[subject];
  const emoji = getEmojiForCourse(course.name);
  const assessmentType = assessmentTypeMap[subject] || 'oral';
  const isItalianCourse = subject === 'italian';
  
  examSessions[sessionId] = {
    subject,
    studentName: studentName || 'Student',
    courseName: `${emoji} ${course.name}`,
    courseData: course,
    assessmentType,
    isItalianCourse,
    speechLang: isItalianCourse ? 'it-IT' : 'en-US',
    messages: [],
    questionCount: 0,
    uploadedMaterials: [],
    scoreTracker: { correct: 0, total: 0, italianScore: 0 },
    isFirstQuestion: true,
    lastAnswerIncomplete: false,
    hintHistory: {},
    askedQuestions: [],
    uploadedMaterialsByAssignment: {},
    confidenceScores: []
  };
  return sessionId;
}

// Updated system prompt with full specifications
function buildSystemPrompt(subject, uploadedMaterials, assessmentType, studentName, isFirstQuestion) {
  const course = courseMap[subject];
  if (!course) {
    return 'You are an UCBM Exam Tutor.';
  }

  const assessmentHint = getAssessmentHint(assessmentType);
  const textbooks = courseTextbooks[subject] || 'Course-specific references';
  const instructor = instructorMap[subject] || 'UCBM Faculty';
  const isItalianCourse = subject === 'italian';
  const yearLevel = course.yearLevel || 'Variable';

  let prompt = `You are an experienced UCBM (Università Campus Bio-Medico di Roma) professor in the Biomedical Engineering (BEN) program, conducting realistic oral exams for students in Years 1–3.

Your role: Conduct rigorous but supportive oral examinations aligned with UCBM's Piano degli Studi 2026-2027 and Teaching Sheets (Schede Didattiche 2025-2026). Ensure questions are challenging, assess deep learning, and provide immediate constructive feedback.

MANDATORY STRICT COURSE LOCK: This exam is EXCLUSIVELY for ${course.name}. All your questions, feedback, and exam content MUST relate ONLY to ${course.name}. Do NOT ask about other courses or subjects unless they are specifically part of this course's curriculum.${isItalianCourse ? ' Exams for Italian accept responses in Italian or English. Ask questions IN ENGLISH about Italian language concepts, teaching Italian grammar/vocabulary/pronunciation/cultural understanding equivalent to Level I-II at US university. Questions should teach practical Italian conversation, grammar rules, vocabulary, and cultural understanding for English speakers.' : ''}

**UPLOADED STUDENT MATERIALS**:
If student materials are provided, acknowledge them within your professor persona and use the content actively:
- Reference concepts from the materials in questions
- Ask students to apply knowledge from provided documents
- Give feedback that connects answers to the material
- Treat materials as legitimate course resources for assessment

**SESSION FLOW**:
1. Begin with one strong, realistic oral exam-style question for the chosen course. Introduce yourself and the exam before the first question only.
2. After the student's response, give **immediate constructive feedback** (1-3 sentences) followed by the next question.
3. Continue naturally until the student ends the session.

**RESPONSE AFTER STUDENT'S ANSWER**:
- Give brief, natural, constructive feedback (not a full structured evaluation every time)
- Point out strengths and gently correct major inaccuracies
- Then ask a follow-up or next question to keep the exam flowing naturally

**RESPONSE TO FEEDBACK BUTTON**:
- When student requests feedback (via button), provide **detailed structured evaluation**:
  - Accuracy of content
  - Depth of understanding
  - Clarity and structure
  - Integration of concepts
  - Oral exam technique (terminology, logical flow, confidence)
- Distinguish between: natural feedback after every answer vs. detailed structured feedback when Feedback button is pressed

**CRITICAL DIRECTIVES**:
- Always read and process the **FULL question** provided. Never truncate, summarize, or ignore any part.
- Stay fully in character as a UCBM professor.
- Process uploaded documents: acknowledge them, use their content when relevant, treat as legitimate study materials.
- Gently redirect off-topic messages back to the exam.
- Accept student responses in English${isItalianCourse ? ' or Italian' : ''}.

**QUESTION UNIQUENESS AND VARIETY (MANDATORY)**:
Ensure variety of questions in exams:
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
3. Textbooks & References:
   - Anatomy: Gray's Anatomy for Students, Netter's Atlas of Human Anatomy
   - Physiology: Guyton & Hall Textbook of Medical Physiology, Costanzo Physiology
   - Chemistry: Whitten Chemistry, Lausarot Stechiometria
   - Physics: Halliday/Resnick/Walker Physics, Tipler Physics for Scientists and Engineers, Serway Physics
   - Advanced Physics: Tipler Modern Physics, Morrison Modern Physics
   - Mathematics: Lay Linear Algebra, Stewart Calculus
   - Statistics: Ross Introduction to Probability and Statistics
   - Biomechanics: Ozkaya & Nordin Fundamentals of Biomechanics, Y.C. Fung Biomechanics
   - Signal Processing: Semmlow Circuits and Systems for Bioengineers, Abood Digital Signal Processing
   - Electronics: Alexander & Sadiku Fundamentals of Electric Circuits, Horowitz & Hill Art of Electronics
   - Bioengineering: Enderle & Bronzino Introduction to Biomedical Engineering
   - Italian: Ciao! Italian for English Speakers, Prego! Contemporary Italian
   - Other subjects: University-level references aligned with UCBM curriculum

**RESPONSE STYLE**:
- Professional, supportive but rigorous UCBM professor tone
- Use appropriate technical terminology (English + standard Italian terms as needed)
- Adjust depth according to course year level (Year 1 foundational, Years 2-3 advanced)
- Begin new sessions **immediately** with a relevant first question. Never ask for confirmation.`;

  if (isFirstQuestion) {
    prompt += `\n\n**FIRST QUESTION - INCLUDE INTRODUCTION**
Start with a brief, warm introduction (1-2 sentences) including:
1. Your name (${instructor})
2. Course name (${course.name})
3. Welcoming tone
4. Then immediately ask the first realistic exam question for this course

Example opening: "Good morning ${studentName}, I'm ${instructor}, and we'll be examining you today on ${course.name}. Let's begin..."`;
  } else {
    prompt += `\n\n**CONTINUE EXAM**
Ask the next focused question aligned with learning objectives. Ensure it is DIFFERENT from all previous questions in this session and STAY ON TOPIC: question must be about ${course.name} only.`;
  }

  prompt += `\n\nCourse: ${course.name}
Assessment: ${assessmentType.replace(/-/g, '/')}
Year Level: ${yearLevel}
Textbooks: ${textbooks}
Tip: ${assessmentHint}

Begin now. Do NOT use markdown formatting.`;

  // Include uploaded materials in system prompt
  if (uploadedMaterials && uploadedMaterials.length > 0) {
    prompt += `\n\nSTUDENT UPLOADED MATERIALS (USE THESE FOR QUESTIONS & FEEDBACK - These are critical reference documents):\n`;
    uploadedMaterials.forEach(material => {
      prompt += `\n[${material.filename}]\n${material.content.substring(0, 30000)}\n---\n`;
    });
    prompt += `\nIMPORTANT: Use the uploaded materials above to:
1. Generate questions that reference these materials
2. Ask about concepts covered in these documents
3. Provide feedback that connects student answers to the material content
4. Encourage students to apply knowledge from these materials`;
  }

  return prompt;
}

app.post('/api/exam/start', (req, res) => {
  const { subject, studentName } = req.body;
  const validSubjects = Object.keys(courseMap);

  if (!validSubjects.includes(subject)) {
    return res.status(400).json({ error: `Invalid subject` });
  }

  const sessionId = initializeSessionWithTracking(subject, studentName);
  const session = examSessions[sessionId];

  res.json({ 
    sessionId, 
    subject, 
    courseName: session.courseName,
    assessmentType: session.assessmentType,
    studentName: session.studentName,
    isItalianCourse: session.isItalianCourse,
    speechLang: session.speechLang,
    courseInfo: {
      instructor: instructorMap[subject],
      ects: session.courseData.ects,
      assessment: session.courseData.assessment
    }
  });
});

// Enhanced upload endpoint with course assignment
app.post('/api/exam/upload/:sessionId', upload.single('file'), (req, res) => {
  const { sessionId } = req.params;
  const { courseAssignment } = req.body;

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
    courseAssignment: courseAssignment || 'general',
    uploadedAt: new Date().toISOString()
  };

  examSessions[sessionId].uploadedMaterials.push(material);
  
  if (courseAssignment) {
    if (!examSessions[sessionId].uploadedMaterialsByAssignment[courseAssignment]) {
      examSessions[sessionId].uploadedMaterialsByAssignment[courseAssignment] = [];
    }
    examSessions[sessionId].uploadedMaterialsByAssignment[courseAssignment].push(material);
  }

  res.json({
    message: 'File successfully uploaded and loaded',
    filename: req.file.originalname,
    courseAssignment: courseAssignment || 'general',
    totalFilesLoaded: examSessions[sessionId].uploadedMaterials.length,
    fileSize: req.file.size,
    confirmation: `✓ Material "${req.file.originalname}" loaded for ${courseAssignment || 'this exam'}. Total materials: ${examSessions[sessionId].uploadedMaterials.length}`
  });
});

// Enhanced question endpoint with confidence scoring and language support
app.post('/api/exam/question', async (req, res) => {
  const { sessionId, studentAnswer, confidenceScore } = req.body;

  if (!sessionId || !examSessions[sessionId]) {
    return res.status(404).json({ error: 'Not found' });
  }

  const session = examSessions[sessionId];
  const isFirst = session.isFirstQuestion;
  
  if (req.body.isEnding) {
    const percentage = session.scoreTracker.total > 0 ? Math.round((session.scoreTracker.correct / session.scoreTracker.total) * 100) : 0;
    const italianScore = Math.round(percentage * 30 / 100);
    session.scoreTracker.italianScore = italianScore;
    
    return res.json({ 
      response: 'Exam ended', 
      questionNumber: session.questionCount, 
      scoreTracker: session.scoreTracker, 
      isEnded: true,
      scoreData: {
        courseName: session.courseName.replace(/^[🌍💻📐⚗️⚡💼🌍❤️🦴📡🤖🎛️🏃🔧🔬🔌🏗️🌡️🏥🎭📚📈🧪📖]\s/, ''),
        correct: session.scoreTracker.correct,
        total: session.scoreTracker.total,
        percentage: percentage,
        italianScore: italianScore,
        date: new Date().toLocaleDateString()
      }
    });
  }
  
  // BUG FIX #1: Detect incomplete answers (less than 10 words OR less than 15 characters)
  const wordCount = studentAnswer ? studentAnswer.trim().split(/\s+/).length : 0;
  const charCount = studentAnswer ? studentAnswer.trim().length : 0;
  const isIncompleteAnswer = (wordCount < 10 || charCount < 15) && studentAnswer && studentAnswer.trim();
  const isInvalidAnswer = !studentAnswer || studentAnswer.trim().length < 5 || (studentAnswer && (studentAnswer.includes('???') || studentAnswer.includes('...') || studentAnswer.toLowerCase() === 'skip'));
  
  // Handle incomplete answers by repeating the same question
  if (isIncompleteAnswer && !isFirst) {
    let lastQuestion = '';
    for (let i = session.messages.length - 1; i >= 0; i--) {
      if (session.messages[i].role === 'assistant') {
        lastQuestion = session.messages[i].content;
        break;
      }
    }
    
    if (lastQuestion) {
      // Add user's incomplete answer to messages for context
      session.messages.push({
        role: 'user',
        content: studentAnswer,
        confidenceScore: confidenceScore || null
      });
      
      // Do NOT increment questionCount on incomplete answer
      // Do NOT score incomplete answer
      // Return flags to indicate incomplete answer and question repeat
      const feedbackMessage = `That answer seems incomplete. Let me re-ask the question more clearly: ${lastQuestion}`;
      return res.json({
        response: feedbackMessage,
        questionNumber: session.questionCount,
        hypotheticalScore: null,
        scoreTracker: session.scoreTracker,
        isIncompleteAnswer: true,
        isQuestionRepeat: true
      });
    }
  }
  
  if (isInvalidAnswer && !isFirst) {
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
        confidenceScore: confidenceScore || null
      });
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      ...session.messages.map(m => ({ role: m.role, content: m.content })),
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

    session.askedQuestions.push(professorMessage.substring(0, 200));

    // Score only if user provided a valid answer
    let scoreData = null;
    if (studentAnswer && studentAnswer.trim() && !isInvalidAnswer) {
      session.questionCount += 1;
      session.scoreTracker.total += 1;

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
        const scoreText = scoreResponse.choices[0]?.message?.content?.trim() || '0';
        const scoreNum = parseInt(scoreText) || 0;
        if (scoreNum >= 3) {
          session.scoreTracker.correct += 1;
        }
        scoreData = scoreNum;
        session.confidenceScores.push({ answer: scoreNum, userConfidence: confidenceScore || null });
      } catch (e) {
        console.log('Scoring error (non-critical):', e.message);
      }
    } else if (!studentAnswer && isFirst) {
      session.questionCount = 1;
      session.scoreTracker.total = 1;
    }

    session.isFirstQuestion = false;

    let hypotheticalScore = null;
    if (session.questionCount % 10 === 0) {
      if (session.scoreTracker.total > 0) {
        const percentage = (session.scoreTracker.correct / session.scoreTracker.total) * 100;
        hypotheticalScore = Math.round(percentage * 3) / 10;
      }
    }

    res.json({
      response: professorMessage,
      questionNumber: session.questionCount,
      hypotheticalScore: hypotheticalScore,
      scoreTracker: session.scoreTracker || { correct: 0, total: 0 }
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

    const hintResponse = await client.chat.completions.create({
      model: 'grok-4.3',
      messages: [{ role: 'user', content: hintPrompt }],
      temperature: 0.7,
      max_tokens: 200,
    });

    let textHint = hintResponse.choices[0].message.content;
    textHint = cleanMarkdown(textHint);
    
    let searchTerms = lastQuestion.substring(0, 150).trim();
    searchTerms = searchTerms.replace(/[?:!.]+$/, '').trim();
    if (searchTerms.length < 5) {
      const words = lastQuestion.split(/\s+/).filter(w => w.length > 4 && !['question', 'explain', 'describe', 'professor', 'course', 'exam', 'hint', 'provide', 'brief', 'please', 'how', 'what', 'which', 'where', 'when', 'about', 'the', 'and', 'or', 'is', 'are'].includes(w.toLowerCase())).slice(0, 3);
      searchTerms = words.join(' ') || 'course concepts';
    }

    const questionNum = session.questionCount;
    if (!session.hintHistory[questionNum]) {
      session.hintHistory[questionNum] = [];
    }
    session.hintHistory[questionNum].push({
      hint: textHint,
      searchTerms: searchTerms,
      timestamp: new Date().toISOString()
    });

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

app.get('/api/exam/hint-history/:sessionId', (req, res) => {
  const { sessionId } = req.params;

  if (!sessionId || !examSessions[sessionId]) {
    return res.status(404).json({ error: 'Not found' });
  }

  const session = examSessions[sessionId];
  res.json({
    hintHistory: session.hintHistory || {}
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
    isItalianCourse: session.isItalianCourse,
    messages: session.messages.filter(m => m.role === 'assistant').map((q, i) => ({ index: i, question: q.content }))
  });
});

app.delete('/api/exam/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  if (examSessions[sessionId]) {
    const session = examSessions[sessionId];
    const percentage = session.scoreTracker.total > 0 ? Math.round((session.scoreTracker.correct / session.scoreTracker.total) * 100) : 0;
    const italianScore = Math.round(percentage * 30 / 100);
    
    const scoreData = {
      courseName: session.courseName.replace(/^[🌍💻📐⚗️⚡💼🌍❤️🦴📡🤖🎛️🏃🔧🔬🔌🏗️🌡️🏥🎭📚📈🧪📖]\s/, ''),
      correct: session.scoreTracker.correct,
      total: session.scoreTracker.total,
      percentage: percentage,
      italianScore: italianScore,
      date: new Date().toLocaleDateString()
    };
    
    delete examSessions[sessionId];
    res.json({ message: 'Ended', scoreData: scoreData });
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
