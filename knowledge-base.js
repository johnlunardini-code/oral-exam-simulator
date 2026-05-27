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
    courseSpecs = JSON.parse(fs.readFileSync(COURSE_SPECS_PATH, 'utf8'));
    console.log('✅ Knowledge base initialized with', courseSpecs.courses.length, 'courses');
  } catch (err) {
    console.error('❌ Failed to load course specs:', err.message);
    throw err;
  }
}

export function getCourse(courseIdOrCode) {
  if (!courseSpecs) return null;
  return courseSpecs.courses.find(c => c.id === courseIdOrCode || c.code === courseIdOrCode);
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
  
  console.log(`✅ Added ${fileType} for student ${studentId} in ${courseId}`);
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
