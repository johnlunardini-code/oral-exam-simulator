// knowledge-base.js - Course specifications and student materials management
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COURSE_SPECS_PATH = path.join(__dirname, 'course-specs.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

let courseSpecs = null;

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export async function initKnowledgeBase() {
  try {
    const data = fs.readFileSync(COURSE_SPECS_PATH, 'utf8');
    courseSpecs = JSON.parse(data);
    console.log(`[KB] ✅ Loaded ${courseSpecs.courses.length} courses from course-specs.json`);
  } catch (err) {
    console.error('[KB] ❌ Failed to load course specifications:', err.message);
    throw err;
  }
}

export function getCourse(courseIdOrCode) {
  if (!courseSpecs) {
    throw new Error('Knowledge base not initialized. Call initKnowledgeBase() first.');
  }

  // Search by ID first
  let course = courseSpecs.courses.find(c => c.id === courseIdOrCode);
  if (course) return course;

  // Search by code if ID not found
  course = courseSpecs.courses.find(c => c.code === courseIdOrCode);
  if (course) return course;

  // Return null if not found (for fallback handling in server.js)
  return null;
}

export async function getCourseContext(courseId, limit = 15) {
  const course = getCourse(courseId);
  if (!course) throw new Error(`Course ${courseId} not found`);

  const materials = await loadStudentMaterials(courseId);

  return {
    courseSpecs: course,
    studentMaterials: materials.slice(0, limit).map(m => m.content),
    contextSummary: `Course: ${course.name} (${course.code}) - ${course.cfu} CFU\nProfessor: ${course.professor}\nExam: ${course.examFormat.primary}`
  };
}

async function loadStudentMaterials(courseId) {
  const filePath = path.join(UPLOADS_DIR, `${courseId}-materials.json`);
  if (!fs.existsSync(filePath)) return [];
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    console.error(`[KB] Error loading materials for ${courseId}:`, e.message);
    return [];
  }
}

async function saveStudentMaterials(courseId, materials) {
  const filePath = path.join(UPLOADS_DIR, `${courseId}-materials.json`);
  try {
    fs.writeFileSync(filePath, JSON.stringify(materials, null, 2));
  } catch (e) {
    console.error(`[KB] Error saving materials for ${courseId}:`, e.message);
  }
}

export async function addStudentMaterial(studentId, courseId, fileType, content, metadata = {}) {
  let materials = await loadStudentMaterials(courseId);

  const newMaterial = {
    id: `${studentId}-${courseId}-${Date.now()}`,
    studentId,
    courseId,
    fileType,
    content,
    timestamp: new Date().toISOString(),
    ...metadata
  };

  materials.push(newMaterial);
  await saveStudentMaterials(courseId, materials);

  console.log(`[KB] ✅ Added ${fileType} for student ${studentId} in ${courseId} (persistent)`);
  return newMaterial;
}

export async function retrieveRelevantContext(courseId, query, maxResults = 10) {
  const course = getCourse(courseId);
  if (!course) throw new Error(`Course ${courseId} not found`);

  const materials = await loadStudentMaterials(courseId);
  const queryLower = query.toLowerCase();

  // Filter materials by relevance to query
  const relevant = materials.filter(m => {
    const contentLower = (m.content || '').toLowerCase();
    return contentLower.includes(queryLower) || (m.metadata && JSON.stringify(m.metadata).toLowerCase().includes(queryLower));
  }).slice(0, maxResults);

  return {
    course,
    relevantMaterials: relevant,
    courseModules: course.modules || [],
    courseObjectives: course.dublinDescriptors || {}
  };
}

export function getAllCourses() {
  if (!courseSpecs) {
    throw new Error('Knowledge base not initialized');
  }
  return courseSpecs.courses;
}

export function getCoursesByYear(year) {
  if (!courseSpecs) {
    throw new Error('Knowledge base not initialized');
  }
  return courseSpecs.courses.filter(c => c.year === year);
}

export function getCoursesByProfessor(professorName) {
  if (!courseSpecs) {
    throw new Error('Knowledge base not initialized');
  }
  return courseSpecs.courses.filter(c => c.professor?.toLowerCase().includes(professorName.toLowerCase()));
}
