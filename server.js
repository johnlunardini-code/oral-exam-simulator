// server.js
import express from 'express';
import cors from 'cors';
import { initKnowledgeBase, getCourseContext, addStudentMaterial, retrieveRelevantContext } from './knowledge-base.js';
import { SYSTEM_PROMPT } from './system-prompt.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize knowledge base on startup
let kbReady = false;
initKnowledgeBase()
  .then(() => { 
    kbReady = true;
    console.log('✅ Knowledge base ready');
  })
  .catch(err => { 
    console.error('❌ Knowledge base init failed:', err); 
    process.exit(1); 
  });

// === UPLOAD ENDPOINT ===
app.post('/api/upload', async (req, res) => {
  try {
    const { studentId, courseId, fileType, content, metadata } = req.body;
    await addStudentMaterial(studentId, courseId, fileType, content, metadata);
    res.json({ success: true, message: 'Material added to knowledge base' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === EXAM SIMULATION ENDPOINT ===
app.post('/api/exam/simulate', async (req, res) => {
  try {
    const { studentId, courseId, mode, previousContext = [] } = req.body;

    const context = await getCourseContext(courseId);
    const course = context.courseSpecs;

    // Build the full prompt for xAI
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

    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'XAI_API_KEY not configured' });
    }

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
      console.error('xAI API error:', error);
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
    console.error('Exam simulation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 UCBM Exam Simulator running on port ${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
