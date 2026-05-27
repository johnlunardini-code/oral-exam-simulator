// knowledge-base.js - In-memory implementation (no external ChromaDB dependency)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COURSE_SPECS_PATH = path.join(__dirname, 'course-specs.json');

let courseSpecs = null;
const inMemoryStorage = {}; // In-memory student materials storage

export async function initKnowledgeBase() {
  try {
    const specPath = COURSE_SPECS_PATH;
    console.log('[KB] Loading specs from:', specPath);
    const rawData = fs.readFileSync(specPath, 'utf8');
    courseSpecs = JSON.parse(rawData);
    if (!courseSpecs.courses || !Array.isArray(courseSpecs.courses)) {
      throw new Error('course-specs.json missing courses array');
    }
    console.log('[KB] ✅ Knowledge base initialized with', courseSpecs.courses.length, 'courses');
  } catch (err) {
    console.error('[KB] ❌ Failed to load course specs:', err.message);
    throw err;
  }
}

export function getCourse(courseIdOrCode) {
  try {
    if (!courseSpecs) {
      console.error('[KB] getCourse called but courseSpecs not initialized');
      return null;
    }
    if (!courseSpecs.courses) {
      console.error('[KB] courseSpecs.courses is undefined');
      return null;
    }
    const course = courseSpecs.courses.find(c => c && (c.id === courseIdOrCode || c.code === courseIdOrCode));
    return course || null;
  } catch (err) {
    console.error('[KB] Error in getCourse:', err.message);
    return null;
  }
}

export async function getCourseContext(courseId, limit = 15) {
  const course = getCourse(courseId);
  if (!course) throw new Error(`Course ${courseId} not found`);

  // Retrieve from in-memory storage
  const studentMaterials = inMemoryStorage[courseId] || [];

  return {
    courseSpecs: course,
    studentMaterials: studentMaterials.slice(0, limit).map(m => m.content),
    contextSummary: `Course: ${course.name} (${course.code}) - ${course.cfu} CFU\nProfessor: ${course.professor}\nExam: ${course.examFormat.primary}`
  };
}

export async function addStudentMaterial(studentId, courseId, fileType, content, metadata = {}) {
  if (!inMemoryStorage[courseId]) {
    inMemoryStorage[courseId] = [];
  }
  
  inMemoryStorage[courseId].push({
    id: `${studentId}-${courseId}-${Date.now()}`,
    studentId,
    courseId,
    fileType,
    content,
    timestamp: new Date().toISOString(),
    ...metadata
  });
  
  console.log(`[KB] ✅ Added ${fileType} for student ${studentId} in ${courseId}`);
}

export async function retrieveRelevantContext(courseId, query, limit = 10) {
  const course = getCourse(courseId);
  if (!course) throw new Error(`Course ${courseId} not found`);
  
  const materials = inMemoryStorage[courseId] || [];
  // Simple keyword matching on content
  const queryWords = query.toLowerCase().split(' ');
  const relevant = materials.filter(m => 
    queryWords.some(word => m.content?.toLowerCase().includes(word))
  ).slice(0, limit);

  return {
    courseContext: await getCourseContext(courseId),
    relevantUploads: relevant.map(m => m.content)
  };
}
