// Load courses dynamically from API and populate UI
async function loadCoursesFromAPI() {
  try {
    const response = await fetch('/api/courses');
    const data = await response.json();
    
    if (!data.success || !data.grouped) {
      console.error('Failed to load courses from API');
      return;
    }
    
    const container = document.getElementById('coursesContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Sort by year
    const years = Object.keys(data.grouped).sort((a, b) => Number(a) - Number(b));
    
    years.forEach((yearNum, yearIndex) => {
      const courses = data.grouped[yearNum];
      const yearLabel = `Year ${yearNum}`;
      
      const yearDiv = document.createElement('div');
      yearDiv.className = 'year-section';
      
      const header = document.createElement('div');
      header.className = 'year-header';
      header.innerHTML = `<span>${yearLabel}</span><span class="toggle">${yearIndex === 0 ? '▼' : '▶'}</span>`;
      header.onclick = () => {
        const coursesDiv = header.nextElementSibling;
        coursesDiv.classList.toggle('collapsed');
        header.querySelector('.toggle').textContent = coursesDiv.classList.contains('collapsed') ? '▶' : '▼';
      };
      
      const coursesDiv = document.createElement('div');
      coursesDiv.className = 'year-courses';
      if (yearIndex > 0) coursesDiv.classList.add('collapsed');
      
      // Assign colors to courses
      const colors = ['#e74c3c', '#f39c12', '#16a085', '#2980b9', '#8b4513', '#c0392b', '#9b59b6', '#764ba2', '#667eea', '#8e44ad', '#27ae60', '#d35400', '#1abc9c', '#34495e', '#e67e22', '#3498db', '#9b59b6', '#1e8449', '#154360', '#784212', '#641e16', '#8b4513', '#1e90ff', '#27ae60'];
      
      courses.forEach((course, idx) => {
        const btn = document.createElement('button');
        btn.className = 'subject-btn';
        btn.style.background = colors[idx % colors.length];
        btn.textContent = course.name;
        btn.onclick = () => startExam(course.id);
        coursesDiv.appendChild(btn);
      });
      
      yearDiv.appendChild(header);
      yearDiv.appendChild(coursesDiv);
      container.appendChild(yearDiv);
    });
    
    // Update feature count
    const featureList = document.querySelector('.feature-list ul');
    if (featureList && featureList.children[0]) {
      featureList.children[0].textContent = `✓ ${data.total} UCBM courses`;
    }
  } catch (error) {
    console.error('Error loading courses:', error);
  }
}

// Load courses when page ready
document.addEventListener('DOMContentLoaded', () => {
  loadCoursesFromAPI();
});

// Fallback if DOMContentLoaded already fired
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadCoursesFromAPI);
} else {
  loadCoursesFromAPI();
}
