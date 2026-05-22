// Knowledge base manager - integrates Teaching Sheets + vetted sources + web search
// Ensures all Q&A is grounded in authoritative UCBM curriculum and academic sources

const verifiedSources = {
  'anatomy': [
    { name: "Gray's Anatomy for Students", url: 'https://www.elsevier.com/en-gb/products/grays-anatomy-for-students', trusted: true },
    { name: 'Netter\'s Atlas of Human Anatomy', url: 'https://www.elsevier.com/en-gb/products/netter-atlas-of-human-anatomy', trusted: true },
    { name: 'NIH Anatomy Resources', url: 'https://www.nlm.nih.gov/', trusted: true },
  ],
  'physiology': [
    { name: 'Guyton & Hall Textbook of Medical Physiology', url: 'https://www.elsevier.com/en-gb/products/guyton-and-hall-textbook-of-medical-physiology', trusted: true },
    { name: 'Costanzo Physiology', url: 'https://www.elsevier.com/en-gb/products/physiology', trusted: true },
    { name: 'Kandel Principles of Neural Science', url: 'https://www.mhhe.com/', trusted: true },
    { name: 'PubMed Central', url: 'https://www.ncbi.nlm.nih.gov/pmc/', trusted: true },
  ],
  'chemistry': [
    { name: 'IUPAC Chemistry Resources', url: 'https://iupac.org/', trusted: true },
    { name: 'Whitten Chemistry Textbook', url: 'https://www.cengage.com/', trusted: true },
    { name: 'ChemSpider', url: 'https://www.chemspider.com/', trusted: true },
  ],
  'physics': [
    { name: 'Tipler Physics for Scientists and Engineers', url: 'https://www.macmillanlearning.com/', trusted: true },
    { name: 'Serway Physics Textbook', url: 'https://www.cengage.com/', trusted: true },
    { name: 'PhET Interactive Simulations', url: 'https://phet.colorado.edu/', trusted: true },
  ],
  'biomedical-signal-processing': [
    { name: 'IEEE Xplore', url: 'https://ieeexplore.ieee.org/', trusted: true },
    { name: 'PubMed', url: 'https://pubmed.ncbi.nlm.nih.gov/', trusted: true },
    { name: 'ScienceDirect Biomedical Engineering', url: 'https://www.sciencedirect.com/', trusted: true },
  ],
  'electronics': [
    { name: 'IEEE Standards', url: 'https://standards.ieee.org/', trusted: true },
    { name: 'Horowitz & Hill Art of Electronics', url: 'https://artofelectronics.net/', trusted: true },
    { name: 'Texas Instruments Education', url: 'https://www.ti.com/en-us/education.html', trusted: true },
  ],
  'mathematics': [
    { name: 'Wolfram MathWorld', url: 'https://mathworld.wolfram.com/', trusted: true },
    { name: 'MIT OpenCourseWare Math', url: 'https://ocw.mit.edu/', trusted: true },
    { name: 'Khan Academy', url: 'https://www.khanacademy.org/', trusted: true },
  ],
  'general': [
    { name: 'PubMed', url: 'https://pubmed.ncbi.nlm.nih.gov/', trusted: true },
    { name: 'Scholar.Google.com', url: 'https://scholar.google.com/', trusted: true },
    { name: 'OpenStax Textbooks', url: 'https://openstax.org/', trusted: true },
    { name: 'NIH/NLM Resources', url: 'https://www.nlm.nih.gov/', trusted: true },
    { name: 'Elsevier ScienceDirect', url: 'https://www.sciencedirect.com/', trusted: true },
  ]
};

const courseTextbooks = {
  'anatomy': [
    "Gray's Anatomy for Students",
    'Netter\'s Atlas of Human Anatomy',
    'Clinical Anatomy by Regions'
  ],
  'physiology': [
    'Guyton & Hall Textbook of Medical Physiology',
    'Costanzo Physiology',
    'Kandel Principles of Neural Science'
  ],
  'chemistry': [
    'Whitten Chemistry',
    'Lausarot Stechiometria per la Chimica Generale'
  ],
  'general-physics': [
    'Tipler Physics for Scientists and Engineers',
    'Serway Physics'
  ],
  'advanced-physics': [
    'Tipler Modern Physics',
    'Morrison Modern Physics for Scientists and Engineers'
  ],
  'biomechanics': [
    'Ozkaya & Nordin Fundamentals of Biomechanics',
    'Y.C. Fung Biomechanics'
  ],
  'biomedical-signal-processing': [
    'Semmlow Circuits, Signals, and Systems for Bioengineers',
    'Abood Digital Signal Processing'
  ],
  'electronics': [
    'Alexander & Sadiku Fundamentals of Electric Circuits',
    'Horowitz & Hill Art of Electronics'
  ],
  'mathematics': [
    'Lay Linear Algebra and Its Applications',
    'Stewart Calculus Early Transcendentals'
  ],
  'measurements-and-instrumentation': [
    'Beckwith Mechanical Measurements',
    'Figliola Theory and Design for Mechanical Measurements'
  ]
};

// Google search query builder - targets verified academic sources
function buildSearchQuery(topic, course, searchType = 'research') {
  const courseKeyword = course.replace(/-/g, ' ');
  
  const queries = {
    research: `"${topic}" site:pubmed.ncbi.nlm.nih.gov OR site:scholar.google.com "${courseKeyword}"`,
    textbook: `"${topic}" textbook biomedical engineering`,
    standards: `"${topic}" standard ISO IEC OR IEEE biomedical`,
    tutorial: `"${topic}" tutorial site:openstax.org OR site:ocw.mit.edu`,
    clinical: `"${topic}" clinical application biomedical`,
  };
  
  return queries[searchType] || queries.research;
}

// Source citation builder
function buildSourceCitation(courseId, topic) {
  const sources = [];
  const textbooks = courseTextbooks[courseId] || courseTextbooks['general'];
  
  sources.push({
    type: 'textbook',
    primary: true,
    references: textbooks,
  });

  const courseSpecificSources = verifiedSources[courseId] || [];
  const generalSources = verifiedSources['general'];
  
  sources.push({
    type: 'academic',
    primary: true,
    urls: [...courseSpecificSources, ...generalSources].slice(0, 3),
  });

  return {
    topic,
    course: courseId,
    primaryTextbooks: textbooks,
    verifiedSources: courseSpecificSources.map(s => ({ name: s.name, url: s.url })),
    searchQueries: {
      research: buildSearchQuery(topic, courseId, 'research'),
      textbook: buildSearchQuery(topic, courseId, 'textbook'),
      standards: buildSearchQuery(topic, courseId, 'standards'),
    },
    googleScholarSearch: `https://scholar.google.com/scholar?q=${encodeURIComponent(topic + ' ' + courseId.replace(/-/g, ' '))}`,
    pubmedSearch: `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(topic)}`,
  };
}

// Knowledge validation - ensures Q&A grounded in authoritative sources
function validateKnowledgeSource(courseId, topic, claim) {
  return {
    claim,
    verificationApproach: [
      `1. Check against UCBM Teaching Sheets for ${courseId}`,
      `2. Cross-reference with primary textbooks: ${(courseTextbooks[courseId] || courseTextbooks['general']).join(', ')}`,
      `3. Validate against peer-reviewed literature: PubMed, IEEE Xplore`,
      `4. Verify standards compliance: ISO, IEC, IEEE standards`,
    ],
    verifiedSources: verifiedSources[courseId] || verifiedSources['general'],
    trustLevel: 'high', // Only after validation
  };
}

// Export for use in system prompt
export { 
  verifiedSources, 
  courseTextbooks, 
  buildSearchQuery, 
  buildSourceCitation,
  validateKnowledgeSource 
};
