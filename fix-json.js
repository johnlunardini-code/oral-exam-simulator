import fs from 'fs';

const data = fs.readFileSync('course-specs.json', 'utf8');
const lines = data.split('\n');
const fixed = [];
for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  if (line.includes('typical_oral_style') && line.includes('Physiological')) {
    fixed.push(line);
    fixed.push('    },' );
    i++; // skip the malformed closing brace
  } else {
    fixed.push(line);
  }
}
fs.writeFileSync('course-specs.json', fixed.join('\n'));
const parsed = JSON.parse(fs.readFileSync('course-specs.json', 'utf8'));
console.log('Fixed');
