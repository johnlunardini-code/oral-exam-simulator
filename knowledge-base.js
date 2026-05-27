// knowledge-base.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ChromaClient } from 'chromadb';
import { OpenAIEmbeddingFunction } from 'chromadb';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COURSE_SPECS_PATH = path.join(__dirname, 'course-specs.json');
const COLLECTION_NAME = 'ucbm-biomedical-engineering';

const client = new ChromaClient({ path: 'http://localhost:8000' });
const embedder = new OpenAIEmbeddingFunction({ openai_api_key: process.env.XAI_API_KEY || process.env.OPENAI_API_KEY || 'sk-placeholder' });

let courseSpecs = null;
let collection = null;

export async function initKnowledgeBase() {
  courseSpecs = JSON.parse(fs.readFileSync(COURSE_SPECS_PATH, 'utf8'));

  collection = await client.getOrCreateCollection({
    name: COLLECTION_NAME,
    embeddingFunction: embedder,
    metadata: { description: 'UCBM Biomedical Engineering 2025-2026 + student uploads' }
  });

  console.log('✅ Knowledge base initialized with', courseSpecs.courses.length, 'courses');
}

export function getCourse(courseIdOrCode) {
  return courseSpecs.courses.find(c => c.id === courseIdOrCode || c.code === courseIdOrCode);
}

export async function getCourseContext(courseId, limit = 15) {
  const course = getCourse(courseId);
  if (!course) throw new Error(`Course ${courseId} not found`);

  const results = await collection.query({
    queryTexts: [JSON.stringify(course.modules)],
    nResults: limit,
    where: { courseId: course.id }
  });

  return {
    courseSpecs: course,
    studentMaterials: results.documents.flat() || [],
    contextSummary: `Course: ${course.name} (${course.code}) - ${course.cfu} CFU\nProfessor: ${course.professor}\nExam: ${course.examFormat.primary}`
  };
}

export async function addStudentMaterial(studentId, courseId, fileType, content, metadata = {}) {
  await collection.add({
    ids: [`${studentId}-${courseId}-${Date.now()}`],
    documents: [content],
    metadatas: [{
      studentId,
      courseId,
      fileType,
      timestamp: new Date().toISOString(),
      ...metadata
    }]
  });
  console.log(`✅ Added ${fileType} for ${courseId}`);
}

export async function retrieveRelevantContext(courseId, query, limit = 10) {
  const course = getCourse(courseId);
  const results = await collection.query({
    queryTexts: [query],
    nResults: limit,
    where: { courseId: course.id }
  });

  return {
    courseContext: await getCourseContext(courseId),
    relevantUploads: results.documents.flat()
  };
}
