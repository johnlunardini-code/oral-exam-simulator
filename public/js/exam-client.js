// public/js/exam-client.js
const API_BASE = '/api';

async function uploadMaterial(studentId, courseId, fileType, content, metadata = {}) {
  const response = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId, courseId, fileType, content, metadata })
  });
  return response.json();
}

async function simulateExam(studentId, courseId, mode = 'oral', previousContext = []) {
  const response = await fetch(`${API_BASE}/exam/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId, courseId, mode, previousContext })
  });
  const data = await response.json();
  return data;
}

// Example: Hook into your UI buttons (add this to your main script or inline in the HTML)
document.addEventListener('DOMContentLoaded', () => {
  console.log('✅ UCBM Exam Tutor frontend connected to backend');

  // Example: Attach to your upload button
  // const uploadBtn = document.getElementById('upload-button');
  // uploadBtn.addEventListener('click', handleUpload);
});

window.uploadMaterial = uploadMaterial;
window.simulateExam = simulateExam;
