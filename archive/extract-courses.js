// Script to extract course data from UCBM teaching sheets
// Run with: node extract-courses.js

const fs = require('fs');

// Raw course data from teaching sheets (you'll paste the full text here)
const rawData = `Chemistry [ 2300103]
Docenti: SARA MARIA GIANNITELLI
Periodo: Primo Cicio Semestrale
Obiettivi formativi: The course provides an overview of general inorganic chemistry.
Prerequisiti: Basic notions of mathematics and physics.
ECTS: 7
Assessment: Multiple choice questions test (30 questions in 50 minutes), minimum 18/30 to pass.
References: Whitten, Davis, Peck, Stanley, CHEMISTRY, 10th Edition, Cengage Learning.

Economics and Management [ 2300105 ]
Docenti: GIUSEPPE TURCHETTI
Periodo: Secondo Cicio Semestrale
Obiettivi formativi: The course aims to provide students with the fundamental elements of economics and management.
Prerequisiti: Basic knowledge of mathematical concepts.
ECTS: 6
Assessment: Written exam with multiple-choice and open questions, theory 20 points, numerical 12 points.
References: Essentials of Strategic Management, McGraw Hill; Corporate Finance, Pearson.

Fundamentals of Computer Science [ 2300101 ]
Docenti: ROSA SICILIA
Periodo: Secondo Cicio Semestrale
Obiettivi formativi: Introduction to problem solving through computer programming.
Prerequisiti: Knowledge of vectors and matrices (from Mathematics course).
ECTS: 10
Assessment: Practical programming assessment (Python) + oral test on theory. Min 18/30 each. Final: 3/5 practical + 2/5 theory.
References: J. Hunt, A Beginners Guide to Python 3 Programming, Springer.

General Physics [ 2300104 ]
Docenti: ALESSANDRO LOPPINI
Periodo: Cicio Annuale Unico
Obiettivi formativi: Knowledge of fundamentals of classical mechanics, thermodynamics and electromagnetism.
Prerequisiti: Precalculus. Basic calculus recommended.
ECTS: 12
Assessment: Two written tests (2h 30min each): 4 practical problems + 2 theoretical proofs. Min 18/30 each module.
References: Physics for Scientists and Engineers, Extended Version, 6th Edition, Tipler & Mosca, Macmillan.

Mathematics [ 2300102 ]
Docenti: MARTA MENCI
Periodo: Primo Cicio Semestrale
Obiettivi formativi: Basic mathematical tools for engineering, Mathematical Analysis and Linear Algebra.
Prerequisiti: First/second degree equations, rational equations, trigonometry, geometry.
ECTS: 10
Assessment: Written test (2 hours): 4 open exercises + 4 multiple choice. Max 32 points, min 18 to pass.
References: Mathematics - solved exercises and theory review by Buscema et al., Societá Editrice Esculapio.

Physiology and Anatomy [ 2300109 ]
Docenti: GIOVANNI DI PINO, GIORGIO VIVACQUA
Periodo: Cicio Annuale Unico
Obiettivi formativi: Knowledge of human body organization and physiological functions.
Prerequisiti: Chemistry, Physics, general knowledge of Molecular Biology.
ECTS: 10
Assessment: Integrated oral exam (anatomy 3 questions + 1 histology, physiology open-ended). Each answer max 9 points, min 18 total.
References: Gray's Anatomy for Students; Guyton and Hall Textbook of Medical Physiology, 14th edition.

Advanced Physics [ 2303201 ]
Docenti: LETIZIA CHIODO
Periodo: Primo Cicio Semestrale
Obiettivi formativi: Advanced concepts of classical mechanics, thermodynamics, electromagnetism, quantum mechanics, statistical mechanics.
Prerequisiti: General Physics, Calculus I.
ECTS: 6
Assessment: Written exam (2 hours): 3 theoretical questions (10 points each), followed by oral discussion. Min 18/30.
References: Physics for Scientists and Engineers (Tipler & Mosca); Modern Physics for Scientists and Engineers (Morrison).

Biomedical Signal Processing [ 2303301 ]
Docenti: LEANDRO PECCHIA
Periodo: Cicio Annuale Unico
Obiettivi formativi: Principles, methods, and tools of signal processing applied to medicine and biology.
Prerequisiti: Mathematics, Physics, Computer Science, Physiology, Statistics, Mathematics II, Electronics, Advanced Physics.
ECTS: 10
Assessment: Module 1 (written+oral), Modules 2&3 (written+oral), Group project. Each min 18/30. Final average of three components.
References: Semmlow, Circuits, signals, and systems for bioengineers (2024); Abood, Digital Signal Processing (2020).

Electronics and Electrotechnics [ 2303205 ]
Docenti: MAURO PARISE
Periodo: Secondo Cicio Semestrale
Obiettivi formativi: Analysis of electrical systems and linear electrical networks. Basic knowledge about electronic components and devices.
Prerequisiti: Fundamentals of Electromagnetics (Module A); Basic knowledge of electrical quantities (Module B).
ECTS: 11
Assessment: Module A - written numerical test (2.5 hours, 3 exercises with 6 questions). Module B - oral exam (structured 30min written + presentation + problem application + lab exercises).
References: Alexander & Sadiku, Fundamentals of Electric Circuits, 6th ed; Art of Electronics (Horowitz & Hill).

Fundamentals of Automatic Control [ 2303312 ]
Docenti: FILIPPO CACACE
Periodo: Primo Cicio Semestrale
Obiettivi formativi: Basic notions for analysis of systems and design of basic controllers.
Prerequisiti: Linear algebra, calculus, basic Matlab programming.
ECTS: 9
Assessment: Oral discussion (about 20 minutes): 3 topics on systems theory, frequency-based control, time-domain control. Average of 3 topics for final grade.
References: Astrom & Murray, Feedback systems: an introduction for scientists and engineers (2021).

Fundamentals of Bioengineering [ 2303304 ]
Docenti: FABRIZIO TAFFONI
Periodo: Secondo Cicio Semestrale
Obiettivi formativi: Multidisciplinary design, development, integration, and virtual testing of bioengineering devices.
Prerequisiti: Mathematics, Physics, Geometry, Mechanics of Solids, Electronics, Programming.
ECTS: 12
Assessment: Individual oral exam (50%), group presentation on labs (20%), Q&A session (30%). Min 18/31, laude >30.5.
References: Kutz, Biomedical engineering and design handbook; Jerald, The VR book.

Healthcare Information Systems and Telemedicine [ 2303204 ]
Docenti: ANNA SABATINI
Periodo: Primo Cicio Semestrale
Obiettivi formativi: Concept of Healthcare as ecosystem, Telemedicine, fundamentals of computer networks, databases, and data visualization.
Prerequisiti: Suggested to have passed Fundamentals of Computer Science.
ECTS: 6
Assessment: Project work (computer-based test) + oral interview. Tests evaluate design, software tools mastery, knowledge of concepts and data management.
References: Kurose & Ross, Reti di calcolatori e Internet (2017); Atzeni et al., Database Systems concepts (1999).

Healthcare Robotics [ 2303308 ]
Docenti: LOREDANA ZOLLO
Periodo: Secondo Cicio Semestrale
Obiettivi formativi: Applications of robotics in biomedical field through theory and practice.
Prerequisiti: None
ECTS: 6
Assessment: Oral exam: 3 questions (11 points each) on theoretical/practical aspects. Max 45 min. Min 18/30 to pass.
References: Van Wynsberghe, Healthcare robots: Ethics, design and implementation (2016); Siciliano & Khatib, Handbook of Robotics (2008).

Mathematics II [ 2303211 ]
Docenti: FLAVIA SMARRAZZO, MARCO PAPI
Periodo: Cicio Annuale Unico
Obiettivi formativi: Linear Algebra, differential equations, differential and integral calculus for functions of several variables.
Prerequisiti: Mathematics I (vector spaces, differential and integral calculus).
ECTS: 13
Assessment: Full exam OR two partial exams. Full: 4 exercises + 2 questions (max 32, min 18). Partial 1 & 2: 4 exercises + 2 questions each (max 32, min 18 each).
References: Lay, Linear Algebra and Its Applications, 4th ed; Stewart, Calculus Early Transcendentals, 7th ed.

Measurements and Instrumentation in Biomedical Engineering [ 2303305 ]
Docenti: EMILIANO SCHENA
Periodo: Primo Cicio Semestrale
Obiettivi formativi: Methodologies for estimating physical quantities, measurement uncertainty, measurement systems and sensors in biomedical applications.
Prerequisiti: None (only admission requirements for degree program).
ECTS: 7
Assessment: Oral exam: students discuss 2 topics selected by instructor or student. Demonstration of theoretical understanding, practical application, regulatory knowledge.
References: Beckwith et al., Mechanical Measurements; Figliola & Beasley, Theory and Design for Mechanical Measurements.

Mechanics of Solids [ 2303206 ]
Docenti: ALESSIO GIZZI
Periodo: Secondo Cicio Semestrale
Obiettivi formativi: Foundations of Solid & Structural Mechanics through inductive approach.
Prerequisiti: Linear algebra, Calculus, Mechanics and Thermodynamics (Physics I).
ECTS: 6
Assessment: Written test (2 hours): open/multiple-choice questions + 1 exercise. Oral test (±4 points adjustment). Grand honor (lode) based on oral preparation.
References: Casini, Gizzi, Vasta, Scienza delle Costruzioni per lngegneria Biomedica (2023).

Probability and Statistics [ 2303203 ]
Docenti: MARCO PAPI
Periodo: Primo Cicio Semestrale
Obiettivi formativi: Fundamental knowledge in probability and statistics for understanding experimental data and random phenomena.
Prerequisiti: Linear algebra and calculus (from Mathematics I).
ECTS: 6
Assessment: Written exam (2 hours): 2 open exercises + 2 multiple-choice questions. Max 32 points, min 18 to pass.
References: Ross, Introduction to Probability and Statistics for Engineers and Scientists, 6th ed (2021).

Biomechanics [ 2303303 ]
Docenti: FRANCESCA CORDELLA, FEDERICA BRESSI
Periodo: Primo Cicio Semestrale
Obiettivi formativi: Biomechanical analysis of human body with focus on musculoskeletal system.
Prerequisiti: None
ECTS: 9
Assessment: Multiple choice questionnaire (Module MED/34, 45 min) + oral exam (Module ING/IND34). Final: 35% MED/34 + 65% ING/IND34. Min 18/30.
References: Ozkaya & Nordin, Fundamentals of Biomechanics, 2nd edition, Springer.

Biomechatronics and Biomaterials [ 2303307 ]
Docenti: FABRIZIO TAFFONI
Periodo: Secondo Cicio Semestrale
Obiettivi formativi: Theoretical and scientific elements on biomechatronic systems and biomaterials properties.
Prerequisiti: Mathematics, Physics, Electronics, Chemistry.
ECTS: 6
Assessment: Individual written exam: 6 open-ended questions (3 per module). Evaluation of theoretical knowledge and skills application.
References: Alciatore & Histand, Introduction to mechatronics and measurement systems (2012), McGraw-Hill.

Fundamentals of Anthropology and Ethics [ 2303210 ]
Docenti: GIAMPAOLO GHILARDI
Periodo: Primo Cicio Semestrale
Obiettivi formativi: Understanding of values, virtues, and moral characteristics relating to Engineering and biomedical sciences.
Prerequisiti: None
ECTS: 3
Assessment: Written exam (30 minutes): 11 multiple-choice questions (3 points each, no penalty for wrong answers). Tests ability to apply knowledge.
References: Ghilardi, Elements of Anthropology and Ethics (2025); Tambone & Ghilardi, Philosophy and Deontology of Medical Practice (2020).

Humanities for Bioengineering [ 2303306 ]
Docenti: GIAMPAOLO GHILARDI, MARTA BERTOLASO
Periodo: Secondo Cicio Semestrale
Obiettivi formativi: Critical thinking on frontier cases of technology-life science interaction (bio-inspired robotics, CRISPR, simulation, AI).
Prerequisiti: None
ECTS: 2
Assessment: Oral examination: evaluated on conceptual clarity and adequacy of case study discussion. Min 18/30 for pass, 27+ for excellent.
References: Bertolaso, Artificialmente e Umanamente (2019); Jasanoff, The ethics of invention (2016); Verbeek, What things do (2021).

Transport Phenomena and Thermodynamics [ 2303207 ]
Docenti: LUISA DI PAOLA
Periodo: Secondo Cicio Semestrale
Obiettivi formativi: Analysis, modeling and solving of problems involving transport phenomena and thermodynamics in biomedical engineering.
Prerequisiti: None
ECTS: 6
Assessment: Written trial (2 hours): 2 problems on methods application. Oral trial (~1 hour): 2 practical cases. Final: 50% written + 50% oral. Min 18/30.
References: Bird, Stewart & Lightfoot, Transport Phenomena 2nd Ed.; Sandler, Chemical, Biochemical and Engineering Thermodynamics (2006).

Mechanics of Solids [ 2303206 ]
Docenti: ALESSIO GIZZI
Periodo: Secondo Cicio Semestrale
ECTS: 6

Laboratory of Measurements [ 2303311 ]
Docenti: DANIELA LO PRESTI
Periodo: Secondo Cicio Semestrale
Obiettivi formativi: Fundamental knowledge in developing and designing experiments to characterize measurement systems for biomedical applications.
Prerequisiti: None (only admission requirements).
ECTS: 6
Assessment: Lab experiments + computer activities (20/30) + Design and implementation of measurement system with oral test (10/30). Cum laude for excellence.
References: Beckwith et al., Mechanical Measurements; Figliola & Beasley, Theory and Design for Mechanical Measurements.

General English [ 2300106 ]
Docenti: ROBERTA ARONICA
Periodo: Primo Cicio Semestrale
Obiettivi formativi: Reinforces level C1 general English.
Prerequisiti: None
ECTS: 3
Assessment: Level C1 written test.
References: Materials provided by teachers.

Italian [ 2303209 ]
Docenti: ROBERTA ARONICA
Periodo: Primo Cicio Semestrale
Obiettivi formativi: Enhance knowledge of elementary Italian grammatical and syntactic structures.
Prerequisiti: Placement test (B1+ exempted).
ECTS: 2
Assessment: Written test (grammar, comprehension, writing, listening) + speaking assessment during course. Pass/fail basis.
References: Materials provided by teachers.

Technical English [ 2303208 ]
Docenti: ADAM JAMES MARTIN
Periodo: Primo Cicio Semestrale
Obiettivi formativi: Scientific terminology and abstract writing. Reading comprehension of medical articles.
Prerequisiti: Must pass Year 1 test before final exam.
ECTS: 2
Assessment: Written test: write the abstract of a scientific article.
References: Materials provided by teachers.

History of Biomedical Engineering in Twelve Machines [ 23001C1 ]
Docenti: GIAMPAOLO GHILARDI, LUCA BORGHI
Periodo: Primo Cicio Semestrale
Obiettivi formativi: History of relationship between medicine and technology through 12 medical instruments.
Prerequisiti: None
ECTS: 3
Assessment: Oral talk at end of semester. Questions evaluate ability to critically reformulate concepts and apply knowledge.
References: Casaccia & Borghi, Tools of the Trade. History of Relationship between Medicine and Engineering in Twelve Machines (2025).
`;

// Parse and structure the data
function parseCoursesFromText(text) {
  const courses = [];
  const courseBlocks = text.split(/\n\n(?=[A-Z])/);
  
  courseBlocks.forEach(block => {
    const lines = block.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length === 0) return;
    
    const course = {};
    
    // Extract course code and name
    const titleMatch = lines[0].match(/^(.+?)\s*\[\s*(\d+)\s*\]/);
    if (!titleMatch) return;
    
    course.name = titleMatch[1].trim();
    course.code = titleMatch[2];
    course.id = course.name.toLowerCase().replace(/\s+/g, '-').replace(/[&]/g, 'and');
    
    // Parse other fields
    lines.forEach(line => {
      if (line.startsWith('Docenti:')) course.instructor = line.replace('Docenti:', '').trim();
      if (line.startsWith('Periodo:')) course.semester = line.replace('Periodo:', '').trim();
      if (line.startsWith('Obiettivi formativi:')) course.objectives = line.replace('Obiettivi formativi:', '').trim();
      if (line.startsWith('Prerequisiti:')) course.prerequisites = line.replace('Prerequisiti:', '').trim();
      if (line.startsWith('ECTS:')) course.ects = parseInt(line.replace('ECTS:', '').trim());
      if (line.startsWith('Assessment:')) course.assessment = line.replace('Assessment:', '').trim();
      if (line.startsWith('References:')) course.references = line.replace('References:', '').trim();
    });
    
    if (course.name && course.code) {
      courses.push(course);
    }
  });
  
  return courses;
}

const courses = parseCoursesFromText(rawData);
const output = { courses };

// Write to file
fs.writeFileSync(
  path.join(__dirname, 'courses-extracted.json'),
  JSON.stringify(output, null, 2)
);

console.log(`✅ Extracted ${courses.length} courses`);
console.log('📁 Saved to courses-extracted.json');
console.log('\nSample course:');
console.log(JSON.stringify(courses[0], null, 2));
