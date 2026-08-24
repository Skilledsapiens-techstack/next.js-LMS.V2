export type AtsScoreBand = 'strong' | 'good' | 'needs-work' | 'risk';

export type AtsScoreCategory = {
  key: string;
  label: string;
  maxScore: number;
  score: number;
  signals: string[];
  suggestions: string[];
};

export type AtsScoreResult = {
  band: AtsScoreBand;
  categories: AtsScoreCategory[];
  diagnostics: {
    appliedCap?: {
      cap: number;
      reason: string;
    };
    bulletQuality: {
      averageScore: number;
      bulletCount: number;
      strongBulletCount: number;
      weakBulletCount: number;
    };
    detectedSections: string[];
    parseQuality: 'good' | 'limited' | 'poor';
    parseWarnings: string[];
    resumeConfidence: number;
  };
  improvementSummary: {
    priorityActions: Array<{
      action: string;
      expectedGain: string;
      recruiterValue: string;
    }>;
    strengths: string[];
    topFixes: string[];
  };
  overallScore: number;
  wordCount: number;
};

export type AtsRoleProfileInput = {
  actionVerbs?: string[];
  expectations?: Record<string, unknown>;
  keywords?: string[];
  preferredSections?: string[];
};

export type AtsScoringPolicy = {
  caps?: Record<string, unknown>;
  recommendationGains?: Record<string, unknown>;
};

export type AtsAdvancedAnalysisOptions = {
  jobDescription?: string;
  levelName?: string;
  roleName: string;
  roleProfile: AtsRoleProfileInput;
  scoringPolicy?: AtsScoringPolicy;
  scoringWeights?: Record<string, unknown>;
};

export type AtsBasicAnalysisOptions = {
  scoringPolicy?: AtsScoringPolicy;
};

const BASIC_WEIGHTS = {
  actionVerbs: 15,
  atsReadability: 25,
  contactInformation: 15,
  formattingRisk: 10,
  quantifiedImpact: 15,
  sectionCompleteness: 20
};

const ADVANCED_WEIGHTS = {
  actionVerbs: 10,
  atsReadability: 15,
  contactInformation: 10,
  formattingRisk: 5,
  jobDescriptionMatch: 15,
  quantifiedImpact: 10,
  roleKeywordMatch: 20,
  sectionCompleteness: 15
};

const SECTION_PATTERNS = {
  certifications: /\b(certifications?|licenses?|courses?)\b/i,
  education: /\b(education|academic|qualification|degree|university|college)\b/i,
  experience: /\b(experience|work experience|internship|employment|professional experience)\b/i,
  projects: /\b(projects?|portfolio|case stud(?:y|ies))\b/i,
  skills: /\b(skills?|technical skills|tools|competencies)\b/i,
  summary: /\b(summary|profile|objective|about me|career objective)\b/i
};

const ACTION_VERBS = [
  'achieved',
  'analyzed',
  'automated',
  'built',
  'collaborated',
  'created',
  'delivered',
  'designed',
  'developed',
  'executed',
  'improved',
  'implemented',
  'increased',
  'launched',
  'led',
  'managed',
  'optimized',
  'reduced',
  'reported',
  'resolved',
  'streamlined'
];

const NON_RESUME_PATTERNS = [
  /\b(invoice|tax invoice|receipt|purchase order|bill to|ship to|payment due)\b/i,
  /\b(abstract|introduction|methodology|literature review|references|bibliography|journal|doi)\b/i,
  /\b(terms and conditions|privacy policy|cookie policy|agreement|whereas)\b/i,
  /\b(question paper|answer key|syllabus|chapter|worksheet|assignment instructions)\b/i,
  /\b(board meeting|minutes of meeting|agenda item|annual report)\b/i
];

const RESUME_CONTEXT_TERMS = [
  'achievement',
  'certification',
  'college',
  'company',
  'degree',
  'education',
  'experience',
  'internship',
  'project',
  'responsibilities',
  'resume',
  'skills',
  'university',
  'work'
];

function clampScore(value: number, maxScore: number) {
  return Math.max(0, Math.min(maxScore, Math.round(value)));
}

function normalizeText(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

function countMatches(text: string, values: string[]) {
  return values.reduce((count, value) => count + (new RegExp(`\\b${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi').test(text) ? 1 : 0), 0);
}

function countAllMatches(text: string, pattern: RegExp) {
  return text.match(pattern)?.length ?? 0;
}

function uniqueTerms(values: string[]) {
  return [...new Set(values.map((value) => value.trim().toLowerCase()).filter((value) => value.length >= 2))];
}

function asWeight(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function asCap(policy: AtsScoringPolicy | undefined, key: string, fallback: number) {
  const numeric = Number(policy?.caps?.[key]);
  return Number.isFinite(numeric) && numeric >= 0 && numeric <= 100 ? numeric : fallback;
}

function asGain(policy: AtsScoringPolicy | undefined, key: string, fallback: string) {
  const value = String(policy?.recommendationGains?.[key] ?? '').trim();
  return value || fallback;
}

function getAdvancedWeights(scoringWeights?: Record<string, unknown>) {
  return {
    actionVerbs: asWeight(scoringWeights?.action_verbs ?? scoringWeights?.actionVerbs, ADVANCED_WEIGHTS.actionVerbs),
    atsReadability: asWeight(scoringWeights?.ats_readability ?? scoringWeights?.atsReadability, ADVANCED_WEIGHTS.atsReadability),
    contactInformation: asWeight(scoringWeights?.contact_information ?? scoringWeights?.contactInformation, ADVANCED_WEIGHTS.contactInformation),
    formattingRisk: asWeight(scoringWeights?.formatting_risk ?? scoringWeights?.formattingRisk, ADVANCED_WEIGHTS.formattingRisk),
    jobDescriptionMatch: asWeight(scoringWeights?.job_description_match ?? scoringWeights?.jobDescriptionMatch, ADVANCED_WEIGHTS.jobDescriptionMatch),
    quantifiedImpact: asWeight(scoringWeights?.quantified_impact ?? scoringWeights?.quantifiedImpact, ADVANCED_WEIGHTS.quantifiedImpact),
    roleKeywordMatch: asWeight(scoringWeights?.role_keyword_match ?? scoringWeights?.roleKeywordMatch, ADVANCED_WEIGHTS.roleKeywordMatch),
    sectionCompleteness: asWeight(scoringWeights?.section_completeness ?? scoringWeights?.sectionCompleteness, ADVANCED_WEIGHTS.sectionCompleteness)
  };
}

function scaleCategory(category: AtsScoreCategory, maxScore: number): AtsScoreCategory {
  const percent = category.maxScore > 0 ? category.score / category.maxScore : 0;
  return { ...category, maxScore, score: clampScore(percent * maxScore, maxScore) };
}

function detectedSections(text: string) {
  return Object.entries(SECTION_PATTERNS).filter(([, pattern]) => pattern.test(text)).map(([section]) => section);
}

function splitLines(text: string) {
  return text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
}

function likelyResumeLineCount(lines: string[]) {
  return lines.filter((line) => {
    const hasBullet = /^[•▪●*—-]\s+\S|^\d+[.)]\s+\S/.test(line);
    const hasDate = /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)?\.?\s?(?:20\d{2}|19\d{2})\b|present|current/i.test(line);
    const hasSeparator = /\s[-|•]\s/.test(line);
    return hasBullet || hasDate || hasSeparator;
  }).length;
}

function extractBulletLines(text: string) {
  return splitLines(text)
    .map((line) => line.replace(/^[•▪●*—-]\s+|^\d+[.)]\s+/, '').trim())
    .filter((line) => line.length >= 18 && (/^[•▪●*—-]\s+\S|^\d+[.)]\s+\S/.test(line) || countMatches(line.toLowerCase(), ACTION_VERBS) > 0));
}

function bulletQuality(text: string) {
  const bullets = extractBulletLines(text);
  const scored = bullets.map((bullet) => {
    const lower = bullet.toLowerCase();
    const hasActionVerb = countMatches(lower, ACTION_VERBS) > 0;
    const hasMetric = /\b(?:\d+(?:\.\d+)?%?|\d+\+|[₹$]\s?\d+|inr\s?\d+|usd\s?\d+)\b/i.test(bullet);
    const hasToolOrMethod = /\b(using|via|through|with|sql|excel|python|power bi|tableau|crm|jira|figma|dashboard|model|analysis|research|automation)\b/i.test(bullet);
    const hasOutcome = /\b(improved|increased|reduced|saved|grew|delivered|optimized|achieved|resolved|launched|converted|automated)\b/i.test(bullet);
    const isSpecific = bullet.length >= 55;
    return [hasActionVerb, hasMetric, hasToolOrMethod, hasOutcome, isSpecific].filter(Boolean).length;
  });
  const total = scored.reduce((sum, score) => sum + score, 0);
  const averageScore = scored.length ? Math.round((total / (scored.length * 5)) * 100) : 0;
  return {
    averageScore,
    bulletCount: bullets.length,
    strongBulletCount: scored.filter((score) => score >= 4).length,
    weakBulletCount: scored.filter((score) => score <= 2).length
  };
}

function resumeValidity(text: string, wordCount: number) {
  const normalized = normalizeText(text).toLowerCase();
  const lines = splitLines(text);
  const topText = normalizeText(lines.slice(0, 8).join(' '));
  const email = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text);
  const phone = /(?:\+?\d[\d\s().-]{7,}\d)/.test(text);
  const linkedin = /linkedin\.com|linkedin/i.test(text);
  const sections = detectedSections(text);
  const contextHits = countMatches(normalized, RESUME_CONTEXT_TERMS);
  const actionHits = countMatches(normalized, ACTION_VERBS);
  const dateSignals = countAllMatches(text, /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)?\.?\s?(?:20\d{2}|19\d{2})\b|present|current/gi);
  const bulletSignals = countAllMatches(text, /[•▪●*—-]\s+\S|(?:^|\n)\s*\d+[.)]\s+\S/g);
  const structuredLines = likelyResumeLineCount(lines);
  const nonResumeSignals = NON_RESUME_PATTERNS.filter((pattern) => pattern.test(text)).length;
  const contactNearTop = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:\+?\d[\d\s().-]{7,}\d)|linkedin/i.test(topText);
  const hasCareerCore = sections.some((section) => ['education', 'experience', 'projects', 'skills'].includes(section));
  const rawScore =
    (email ? 12 : 0) +
      (phone ? 10 : 0) +
      (linkedin ? 5 : 0) +
      (contactNearTop ? 8 : 0) +
      Math.min(sections.length, 5) * 8 +
      Math.min(contextHits, 8) * 3 +
      Math.min(actionHits, 8) * 2 +
      Math.min(dateSignals, 5) * 3 +
      Math.min(bulletSignals, 8) * 2 +
      Math.min(structuredLines, 8) * 2 -
      nonResumeSignals * 18 -
      (wordCount < 120 ? 25 : 0);
  const score = Math.max(0, clampScore(rawScore, 100));

  return {
    actionHits,
    bulletSignals,
    contactNearTop,
    dateSignals,
    email,
    hasCareerCore,
    linkedin,
    nonResumeSignals,
    phone,
    score,
    sections,
    structuredLines,
    wordCount
  };
}

function scoreResumeValidity(text: string, wordCount: number): AtsScoreCategory {
  const validity = resumeValidity(text, wordCount);
  const signals = [
    validity.email || validity.phone ? 'Contact detail found' : 'No email or phone detected',
    validity.sections.length ? `${validity.sections.length} resume section${validity.sections.length === 1 ? '' : 's'} detected` : 'No clear resume sections detected',
    validity.bulletSignals || validity.structuredLines ? 'Resume-like bullet/date structure detected' : 'Limited resume-like structure detected',
    validity.nonResumeSignals ? 'Non-resume document signals detected' : 'No obvious non-resume document signal detected'
  ];
  const suggestions = [
    validity.email || validity.phone ? '' : 'Add email and phone at the top of the resume.',
    validity.sections.length >= 3 ? '' : 'Use clear section headings like Summary, Skills, Education, Projects, Experience, and Certifications.',
    validity.hasCareerCore ? '' : 'Include career-ready content such as skills, projects, internships, work experience, or education.',
    validity.nonResumeSignals ? 'Upload an actual resume PDF, not an invoice, article, report, assignment, or policy document.' : '',
    validity.wordCount >= 120 ? '' : 'The extracted text is too short to score reliably. Export a text-based resume PDF and try again.'
  ].filter(Boolean);

  return {
    key: 'resumeValidity',
    label: 'Resume validity',
    maxScore: 100,
    score: validity.score,
    signals,
    suggestions
  };
}

function scoreBulletQuality(text: string, maxScore: number): AtsScoreCategory {
  const quality = bulletQuality(text);
  const score = clampScore((quality.averageScore / 100) * maxScore, maxScore);
  return {
    key: 'bulletQuality',
    label: 'Bullet quality',
    maxScore,
    score,
    signals: [
      `${quality.bulletCount} resume bullet${quality.bulletCount === 1 ? '' : 's'} assessed`,
      `${quality.strongBulletCount} strong bullet${quality.strongBulletCount === 1 ? '' : 's'} found`
    ],
    suggestions: [
      quality.bulletCount >= 3 ? '' : 'Add clear bullet points under projects, internships, or experience.',
      quality.weakBulletCount === 0 && quality.strongBulletCount > 0 ? '' : 'Rewrite bullets to include action, task, tool/method, and measurable result.',
      quality.averageScore >= 60 ? '' : 'Avoid vague bullets like “worked on” or “responsible for”; show what you did and what changed.'
    ].filter(Boolean)
  };
}

function scoreSectionQuality(text: string, maxScore: number): AtsScoreCategory {
  const sections = detectedSections(text);
  const normalized = normalizeText(text).toLowerCase();
  const skillTerms = countMatches(normalized, ['sql', 'excel', 'python', 'power bi', 'tableau', 'crm', 'jira', 'figma', 'analytics', 'research', 'communication', 'project management']);
  const hasTimeline = /\b(?:20\d{2}|19\d{2}|present|current)\b/i.test(text);
  const hasProjectOrExperience = sections.includes('projects') || sections.includes('experience');
  const hasEducation = sections.includes('education');
  const hasSkills = sections.includes('skills') && skillTerms >= 3;
  const qualityHits = [sections.length >= 4, hasSkills, hasProjectOrExperience, hasEducation, hasTimeline].filter(Boolean).length;
  return {
    key: 'sectionQuality',
    label: 'Section quality',
    maxScore,
    score: clampScore((qualityHits / 5) * maxScore, maxScore),
    signals: [
      `${sections.length} standard section${sections.length === 1 ? '' : 's'} found`,
      hasSkills ? 'Skills section has usable skill signals' : 'Skills section is missing or too thin',
      hasTimeline ? 'Timeline/date signal found' : 'Timeline/date signal not found'
    ],
    suggestions: [
      sections.length >= 4 ? '' : 'Add enough clear sections so the resume is easy for ATS systems to parse.',
      hasSkills ? '' : 'Add a skills section with real tools, methods, and domain keywords.',
      hasProjectOrExperience ? '' : 'Add projects, internships, or experience with role-relevant bullets.',
      hasTimeline ? '' : 'Add dates for education, internships, projects, or work experience where relevant.'
    ].filter(Boolean)
  };
}

function scoreCaps(text: string, wordCount: number, advanced = false, policy?: AtsScoringPolicy) {
  const validity = resumeValidity(text, wordCount);
  const caps: Array<{ cap: number; reason: string }> = [];

  if (wordCount < 80) caps.push({ cap: asCap(policy, 'tinyText', 12), reason: 'Extracted text is too short to be a scorable resume.' });
  else if (wordCount < 140) caps.push({ cap: asCap(policy, 'veryShortText', 22), reason: 'Extracted resume text is very short, so the score is capped.' });

  if (validity.nonResumeSignals >= 2 && validity.sections.length < 3) caps.push({ cap: asCap(policy, 'nonResume', 12), reason: 'This PDF looks like a non-resume document.' });
  else if (validity.nonResumeSignals >= 1 && validity.score < 55) caps.push({ cap: asCap(policy, 'nonResumeSignal', 18), reason: 'Non-resume document signals were detected.' });

  if (validity.score < 30) caps.push({ cap: asCap(policy, 'lowResumeConfidence', 15), reason: 'The file does not look like a resume.' });
  else if (validity.score < 45) caps.push({ cap: asCap(policy, 'weakResumeStructure', 30), reason: 'The file has weak resume structure and limited career signals.' });

  if (!validity.email && !validity.phone) caps.push({ cap: asCap(policy, 'missingContact', 55), reason: 'No email or phone was detected.' });
  if (validity.sections.length === 0) caps.push({ cap: asCap(policy, 'missingSections', 25), reason: 'No standard resume sections were detected.' });
  else if (validity.sections.length < 3) caps.push({ cap: asCap(policy, 'fewSections', 45), reason: 'Too few standard resume sections were detected.' });
  if (!validity.hasCareerCore) caps.push({ cap: asCap(policy, 'missingCareerCore', 35), reason: 'No core resume section like skills, education, projects, or experience was detected.' });
  if (validity.bulletSignals === 0 && validity.structuredLines < 2 && wordCount < 500) caps.push({ cap: asCap(policy, 'weakBulletStructure', 50), reason: 'The file has limited resume-like bullet or timeline structure.' });
  if (advanced && validity.score < 60) caps.push({ cap: asCap(policy, 'advancedWeakResume', 45), reason: 'Advanced role matching is capped because the file is not resume-like enough.' });

  return caps.sort((left, right) => left.cap - right.cap);
}

function applyScoreCaps(score: number, caps: Array<{ cap: number; reason: string }>) {
  if (caps.length === 0) return { appliedCap: undefined, score };
  const appliedCap = caps[0];
  return { appliedCap, score: Math.min(score, appliedCap.cap) };
}

function parseQuality(text: string, wordCount: number) {
  const warnings = [
    wordCount < 140 ? 'Very little selectable text was extracted.' : '',
    /\S{45,}/.test(text) ? 'Long unbroken text may indicate extraction or formatting issues.' : '',
    /\s{8,}/.test(text) ? 'Large spacing blocks may indicate columns or table extraction risk.' : '',
    splitLines(text).length <= 2 && wordCount > 250 ? 'Text extraction returned very few line breaks, which can reduce ATS parse quality.' : ''
  ].filter(Boolean);
  const quality: AtsScoreResult['diagnostics']['parseQuality'] = warnings.length >= 3 || wordCount < 120 ? 'poor' : warnings.length >= 1 || wordCount < 220 ? 'limited' : 'good';
  return { quality, warnings };
}

function buildDiagnostics(text: string, wordCount: number, appliedCap?: { cap: number; reason: string }): AtsScoreResult['diagnostics'] {
  const validity = resumeValidity(text, wordCount);
  const parse = parseQuality(text, wordCount);
  return {
    appliedCap,
    bulletQuality: bulletQuality(text),
    detectedSections: validity.sections,
    parseQuality: parse.quality,
    parseWarnings: parse.warnings,
    resumeConfidence: validity.score
  };
}

function categoryRatio(category: AtsScoreCategory) {
  return category.maxScore > 0 ? category.score / category.maxScore : 0;
}

function priorityActions(categories: AtsScoreCategory[], diagnostics: AtsScoreResult['diagnostics'], roleName?: string, policy?: AtsScoringPolicy): AtsScoreResult['improvementSummary']['priorityActions'] {
  const byKey = new Map(categories.map((category) => [category.key, category]));
  const actions: AtsScoreResult['improvementSummary']['priorityActions'] = [];
  const addAction = (action: string, expectedGain: string, recruiterValue: string) => {
    if (actions.some((item) => item.action === action)) return;
    actions.push({ action, expectedGain, recruiterValue });
  };

  if (diagnostics.appliedCap) {
    addAction(
      diagnostics.appliedCap.reason,
      asGain(policy, 'scoreCap', '+2 to +5 after the blocking issue is fixed'),
      'Recruiters first need to confirm the file is a real, readable resume before evaluating skills or experience.'
    );
  }

  const contact = byKey.get('contactInformation');
  if (contact && categoryRatio(contact) < 0.5) {
    addAction('Place email, phone, and LinkedIn/profile link in the top header.', asGain(policy, 'contact', '+2 to +4'), 'Recruiters should be able to contact the student without searching through the document.');
  }

  const sectionQuality = byKey.get('sectionQuality') ?? byKey.get('sectionCompleteness');
  if (sectionQuality && categoryRatio(sectionQuality) < 0.7) {
    addAction('Add clear, standard headings for Skills, Projects/Experience, Education, and Certifications.', asGain(policy, 'sections', '+3 to +5'), 'Clear sections help recruiters scan the resume quickly and help ATS parsers classify information correctly.');
  }

  const bulletQualityCategory = byKey.get('bulletQuality');
  if (bulletQualityCategory && categoryRatio(bulletQualityCategory) < 0.65) {
    addAction('Rewrite the weakest bullets using action + task + tool/method + result.', asGain(policy, 'bulletRewrite', '+3 to +6'), 'Recruiters value evidence of what the student actually did, not only a list of responsibilities.');
  }

  const quantified = byKey.get('quantifiedImpact');
  if (quantified && categoryRatio(quantified) < 0.65) {
    addAction('Add measured proof to 2-3 bullets: count, %, time saved, accuracy, revenue, users, or volume handled.', asGain(policy, 'quantifiedImpact', '+2 to +5'), 'Numbers make impact easier to compare and make project work feel more credible.');
  }

  const roleKeyword = byKey.get('roleKeywordMatch');
  if (roleKeyword && categoryRatio(roleKeyword) < 0.6) {
    addAction(`Add truthful ${roleName ?? 'target-role'} keywords inside project or experience bullets, not only in the skills list.`, asGain(policy, 'roleKeywordEvidence', '+3 to +6'), 'Recruiters trust keywords more when they are attached to evidence, tools used, and outcomes.');
  }

  const jdMatch = byKey.get('jobDescriptionMatch');
  if (jdMatch && categoryRatio(jdMatch) < 0.55) {
    addAction('Mirror the most relevant job-description language where it truthfully matches the resume.', asGain(policy, 'jobDescriptionMatch', '+2 to +4'), 'This helps recruiters see fit faster while avoiding keyword stuffing.');
  }

  const readability = byKey.get('atsReadability');
  if (readability && categoryRatio(readability) < 0.72) {
    addAction('Use simple layout, readable bullets, and selectable text; avoid image-heavy or complex table layouts.', asGain(policy, 'readability', '+2 to +4'), 'A clean format reduces the chance that ATS systems miss important details.');
  }

  if (diagnostics.bulletQuality.bulletCount < 3 && diagnostics.resumeConfidence >= 45) {
    addAction('Add 3-5 bullets under projects, internships, or experience.', asGain(policy, 'moreBullets', '+2 to +4'), 'Bullet points give recruiters faster proof of scope, tools, and contribution.');
  }

  return actions.slice(0, 5);
}

function extractJobDescriptionTerms(jobDescription: string, roleKeywords: string[]) {
  const normalized = normalizeText(jobDescription).toLowerCase();
  if (!normalized) return [];

  const roleHits = roleKeywords.filter((keyword) => new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(normalized));
  const commonWords = new Set([
    'about',
    'also',
    'and',
    'are',
    'for',
    'from',
    'have',
    'into',
    'our',
    'that',
    'the',
    'this',
    'with',
    'will',
    'work',
    'you',
    'your'
  ]);
  const frequentTerms = Array.from(normalized.matchAll(/\b[a-z][a-z0-9+#.-]{2,}\b/g))
    .map((match) => match[0])
    .filter((term) => !commonWords.has(term));
  const ranked = [...new Set(frequentTerms)].sort((left, right) => {
    const leftCount = frequentTerms.filter((term) => term === left).length;
    const rightCount = frequentTerms.filter((term) => term === right).length;
    return rightCount - leftCount;
  });

  return uniqueTerms([...roleHits, ...ranked.slice(0, 24)]).slice(0, 30);
}

function scoreContactInformation(text: string): AtsScoreCategory {
  const email = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text);
  const phone = /(?:\+?\d[\d\s().-]{7,}\d)/.test(text);
  const linkedin = /linkedin\.com|linkedin/i.test(text);
  const portfolio = /github\.com|behance\.net|portfolio|personal website|medium\.com/i.test(text);
  const signals = [
    email ? 'Email found' : 'Email not found',
    phone ? 'Phone number found' : 'Phone number not found',
    linkedin ? 'LinkedIn/profile link found' : 'LinkedIn/profile link not found',
    portfolio ? 'Portfolio/GitHub signal found' : 'Portfolio/GitHub signal not found'
  ];
  const score = clampScore([email, phone, linkedin, portfolio].filter(Boolean).length * 3.75, BASIC_WEIGHTS.contactInformation);
  const suggestions = [
    !email ? 'Add a professional email address near the top.' : '',
    !phone ? 'Add a reachable phone number with country code if relevant.' : '',
    !linkedin ? 'Add a clean LinkedIn profile URL.' : '',
    !portfolio ? 'Add a portfolio, GitHub, or work-sample link if relevant to your target role.' : ''
  ].filter(Boolean);

  return { key: 'contactInformation', label: 'Contact information', maxScore: BASIC_WEIGHTS.contactInformation, score, signals, suggestions };
}

function scoreSectionCompleteness(text: string): AtsScoreCategory {
  const found = detectedSections(text);
  const score = clampScore((found.length / Object.keys(SECTION_PATTERNS).length) * BASIC_WEIGHTS.sectionCompleteness, BASIC_WEIGHTS.sectionCompleteness);
  const missing = Object.keys(SECTION_PATTERNS).filter((section) => !found.includes(section));
  return {
    key: 'sectionCompleteness',
    label: 'Section completeness',
    maxScore: BASIC_WEIGHTS.sectionCompleteness,
    score,
    signals: found.length ? found.map((section) => `${section} section found`) : ['No standard resume sections detected'],
    suggestions: missing.slice(0, 4).map((section) => `Add or clearly label your ${section} section.`)
  };
}

function scoreAtsReadability(text: string, wordCount: number): AtsScoreCategory {
  const hasLongUnbrokenText = /\S{45,}/.test(text);
  const hasColumnsRisk = /\s{8,}/.test(text);
  const usefulLength = wordCount >= 250 && wordCount <= 900;
  const hasBullets = /[•▪●*-]\s+\w|(?:^|\n)\s*\d+[.)]\s+\w/.test(text);
  const score = clampScore(
    BASIC_WEIGHTS.atsReadability - (hasLongUnbrokenText ? 6 : 0) - (hasColumnsRisk ? 4 : 0) - (usefulLength ? 0 : 6) + (hasBullets ? 2 : 0),
    BASIC_WEIGHTS.atsReadability
  );
  return {
    key: 'atsReadability',
    label: 'ATS readability',
    maxScore: BASIC_WEIGHTS.atsReadability,
    score,
    signals: [
      usefulLength ? 'Resume length is in a useful range' : 'Resume length may be too short or too long',
      hasBullets ? 'Bullet formatting detected' : 'Bullet formatting is limited',
      hasLongUnbrokenText ? 'Long unbroken text detected' : 'No major long-token issue detected',
      hasColumnsRisk ? 'Spacing suggests possible column/table extraction risk' : 'No major spacing extraction risk detected'
    ],
    suggestions: [
      !usefulLength ? 'Keep most student resumes around one page with enough detail for role relevance.' : '',
      !hasBullets ? 'Use clear bullet points under experience and projects.' : '',
      hasLongUnbrokenText ? 'Avoid decorative text, image-only sections, or long unbroken links.' : '',
      hasColumnsRisk ? 'Avoid complex columns/tables if your PDF text extraction looks scrambled.' : ''
    ].filter(Boolean)
  };
}

function scoreActionVerbs(text: string): AtsScoreCategory {
  const found = countMatches(text, ACTION_VERBS);
  const score = clampScore((found / 8) * BASIC_WEIGHTS.actionVerbs, BASIC_WEIGHTS.actionVerbs);
  return {
    key: 'actionVerbs',
    label: 'Action verbs',
    maxScore: BASIC_WEIGHTS.actionVerbs,
    score,
    signals: [`${found} strong action verb${found === 1 ? '' : 's'} detected`],
    suggestions: found < 6 ? ['Start more bullets with verbs like analyzed, built, improved, led, optimized, delivered, or automated.'] : []
  };
}

function scoreCustomActionVerbs(text: string, actionVerbs: string[], maxScore: number): AtsScoreCategory {
  const verbs = uniqueTerms(actionVerbs.length ? actionVerbs : ACTION_VERBS);
  const found = countMatches(text, verbs);
  const visible = verbs.slice(0, 8).join(', ');
  return {
    key: 'actionVerbs',
    label: 'Role action verbs',
    maxScore,
    score: clampScore((found / Math.min(8, Math.max(verbs.length, 1))) * maxScore, maxScore),
    signals: [`${found} target action verb${found === 1 ? '' : 's'} detected`],
    suggestions: found < 5 ? [`Use stronger role verbs such as ${visible}.`] : []
  };
}

function scoreRoleKeywords(text: string, keywords: string[], roleName: string, maxScore: number): AtsScoreCategory {
  const terms = uniqueTerms(keywords);
  const foundTerms = terms.filter((term) => new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text));
  const missingTerms = terms.filter((term) => !foundTerms.includes(term));
  return {
    key: 'roleKeywordMatch',
    label: `${roleName} keyword match`,
    maxScore,
    score: clampScore((foundTerms.length / Math.max(terms.length, 1)) * maxScore, maxScore),
    signals: [`${foundTerms.length}/${terms.length} role keyword${terms.length === 1 ? '' : 's'} matched`],
    suggestions: missingTerms.length ? [`Add relevant evidence for: ${missingTerms.slice(0, 8).join(', ')}.`] : []
  };
}

function scorePreferredSections(text: string, preferredSections: string[], maxScore: number): AtsScoreCategory {
  const sections = uniqueTerms(preferredSections.length ? preferredSections : Object.keys(SECTION_PATTERNS));
  const found = sections.filter((section) => new RegExp(`\\b${section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text));
  const missing = sections.filter((section) => !found.includes(section));
  return {
    key: 'sectionCompleteness',
    label: 'Role section completeness',
    maxScore,
    score: clampScore((found.length / Math.max(sections.length, 1)) * maxScore, maxScore),
    signals: [`${found.length}/${sections.length} preferred section${sections.length === 1 ? '' : 's'} detected`],
    suggestions: missing.slice(0, 4).map((section) => `Add or clearly label your ${section} section.`)
  };
}

function scoreJobDescriptionMatch(text: string, jobDescription: string | undefined, roleKeywords: string[], maxScore: number): AtsScoreCategory {
  const jdTerms = extractJobDescriptionTerms(jobDescription ?? '', roleKeywords);
  if (jdTerms.length === 0) {
    return {
      key: 'jobDescriptionMatch',
      label: 'Job description match',
      maxScore,
      score: 0,
      signals: ['No job description was used'],
      suggestions: ['Paste a target job description to unlock JD-specific keyword matching.']
    };
  }

  const foundTerms = jdTerms.filter((term) => new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text));
  const missingTerms = jdTerms.filter((term) => !foundTerms.includes(term));
  return {
    key: 'jobDescriptionMatch',
    label: 'Job description match',
    maxScore,
    score: clampScore((foundTerms.length / jdTerms.length) * maxScore, maxScore),
    signals: [`${foundTerms.length}/${jdTerms.length} JD keyword${jdTerms.length === 1 ? '' : 's'} matched`],
    suggestions: missingTerms.length ? [`Mirror relevant JD language where truthful: ${missingTerms.slice(0, 8).join(', ')}.`] : []
  };
}

function scoreQuantifiedImpact(text: string): AtsScoreCategory {
  const metrics = text.match(/\b(?:\d+(?:\.\d+)?%?|\d+\+|[₹$]\s?\d+|inr\s?\d+|usd\s?\d+)\b/gi) ?? [];
  const impactWords = countMatches(text, ['increased', 'reduced', 'improved', 'saved', 'grew', 'decreased', 'optimized', 'delivered']);
  const score = clampScore((Math.min(metrics.length, 8) / 8) * 10 + Math.min(impactWords, 5), BASIC_WEIGHTS.quantifiedImpact);
  return {
    key: 'quantifiedImpact',
    label: 'Quantified impact',
    maxScore: BASIC_WEIGHTS.quantifiedImpact,
    score,
    signals: [`${metrics.length} metric/value signal${metrics.length === 1 ? '' : 's'} detected`, `${impactWords} impact word${impactWords === 1 ? '' : 's'} detected`],
    suggestions: metrics.length < 4 ? ['Add measurable outcomes to bullets: %, count, time saved, revenue, users, accuracy, turnaround time, or volume handled.'] : []
  };
}

function scoreFormattingRisk(text: string): AtsScoreCategory {
  const validity = resumeValidity(text, normalizeText(text).split(/\s+/).filter(Boolean).length);
  const risky = [
    /curriculum vitae/i.test(text) ? '' : '',
    /\bphoto\b|\bdate of birth\b|\bmarital status\b/i.test(text) ? 'Personal-detail terms detected' : '',
    /references available/i.test(text) ? 'References line detected' : '',
    text.length < 800 ? 'Extracted text is very short' : '',
    validity.nonResumeSignals ? 'Non-resume document language detected' : '',
    validity.sections.length < 2 ? 'Too few resume sections detected' : ''
  ].filter(Boolean);
  const score = clampScore(BASIC_WEIGHTS.formattingRisk - risky.length * 3, BASIC_WEIGHTS.formattingRisk);
  return {
    key: 'formattingRisk',
    label: 'Formatting risk',
    maxScore: BASIC_WEIGHTS.formattingRisk,
    score,
    signals: risky.length ? risky : ['No major basic formatting risk detected'],
    suggestions: risky.length ? ['Keep the resume ATS-friendly: selectable text, simple headings, no photos, no unnecessary personal details, and no decorative tables.'] : []
  };
}

function scoreBand(score: number): AtsScoreBand {
  if (score >= 85) return 'strong';
  if (score >= 70) return 'good';
  if (score >= 50) return 'needs-work';
  return 'risk';
}

export function analyzeBasicResume(text: string, options: AtsBasicAnalysisOptions = {}): AtsScoreResult {
  const normalized = normalizeText(text);
  const wordCount = normalized ? normalized.split(/\s+/).length : 0;
  const categories = [
    scaleCategory(scoreResumeValidity(text, wordCount), 15),
    scoreContactInformation(normalized),
    scoreSectionCompleteness(normalized),
    scoreSectionQuality(text, 15),
    scoreAtsReadability(text, wordCount),
    scoreActionVerbs(normalized),
    scoreBulletQuality(text, 15),
    scoreQuantifiedImpact(normalized),
    scoreFormattingRisk(text)
  ];
  const total = categories.reduce((sum, category) => sum + category.score, 0);
  const maxTotal = categories.reduce((sum, category) => sum + category.maxScore, 0);
  const uncappedScore = clampScore((total / maxTotal) * 100, 100);
  const caps = scoreCaps(text, wordCount, false, options.scoringPolicy);
  const { appliedCap, score: overallScore } = applyScoreCaps(uncappedScore, caps);
  const diagnostics = buildDiagnostics(text, wordCount, appliedCap);
  const sorted = [...categories].sort((left, right) => left.score / left.maxScore - right.score / right.maxScore);
  const strengths = [...categories]
    .sort((left, right) => right.score / right.maxScore - left.score / left.maxScore)
    .slice(0, 2)
    .map((category) => `${category.label}: ${category.signals[0]}`);
  const topFixes = [
    appliedCap ? `Score cap applied: ${appliedCap.reason} Maximum possible score for this upload is ${appliedCap.cap}/100.` : '',
    ...sorted.flatMap((category) => category.suggestions.map((suggestion) => `${category.label}: ${suggestion}`))
  ].filter(Boolean).slice(0, 5);

  return {
    band: scoreBand(overallScore),
    categories,
    diagnostics,
    improvementSummary: { priorityActions: priorityActions(categories, diagnostics, undefined, options.scoringPolicy), strengths, topFixes },
    overallScore,
    wordCount
  };
}

export function analyzeAdvancedResume(text: string, options: AtsAdvancedAnalysisOptions): AtsScoreResult {
  const normalized = normalizeText(text);
  const wordCount = normalized ? normalized.split(/\s+/).length : 0;
  const weights = getAdvancedWeights(options.scoringWeights);
  const categories = [
    scaleCategory(scoreResumeValidity(text, wordCount), 10),
    scaleCategory(scoreContactInformation(normalized), weights.contactInformation),
    scorePreferredSections(normalized, options.roleProfile.preferredSections ?? [], weights.sectionCompleteness),
    scoreSectionQuality(text, 10),
    scaleCategory(scoreAtsReadability(text, wordCount), weights.atsReadability),
    scoreRoleKeywords(normalized, options.roleProfile.keywords ?? [], options.roleName, weights.roleKeywordMatch),
    scoreJobDescriptionMatch(normalized, options.jobDescription, options.roleProfile.keywords ?? [], weights.jobDescriptionMatch),
    scoreCustomActionVerbs(normalized, options.roleProfile.actionVerbs ?? [], weights.actionVerbs),
    scoreBulletQuality(text, 10),
    scaleCategory(scoreQuantifiedImpact(normalized), weights.quantifiedImpact),
    scaleCategory(scoreFormattingRisk(text), weights.formattingRisk)
  ];
  const total = categories.reduce((sum, category) => sum + category.score, 0);
  const maxTotal = categories.reduce((sum, category) => sum + category.maxScore, 0);
  const uncappedScore = clampScore((total / maxTotal) * 100, 100);
  const caps = scoreCaps(text, wordCount, true, options.scoringPolicy);
  const roleKeywordCategory = categories.find((category) => category.key === 'roleKeywordMatch');
  if (roleKeywordCategory && roleKeywordCategory.maxScore > 0 && roleKeywordCategory.score / roleKeywordCategory.maxScore < 0.2) {
    caps.push({ cap: asCap(options.scoringPolicy, 'lowRoleKeywordMatch', 50), reason: `The resume has very low ${options.roleName} keyword alignment.` });
  }
  const { appliedCap, score: overallScore } = applyScoreCaps(uncappedScore, caps);
  const diagnostics = buildDiagnostics(text, wordCount, appliedCap);
  const sorted = [...categories].sort((left, right) => left.score / left.maxScore - right.score / right.maxScore);
  const levelHint = typeof options.roleProfile.expectations?.summary === 'string' ? options.roleProfile.expectations.summary : '';
  const strengths = [...categories]
    .sort((left, right) => right.score / right.maxScore - left.score / left.maxScore)
    .slice(0, 2)
    .map((category) => `${category.label}: ${category.signals[0]}`);
  const topFixes = [
    appliedCap ? `Score cap applied: ${appliedCap.reason} Maximum possible score for this upload is ${appliedCap.cap}/100.` : '',
    levelHint ? `${options.levelName ?? 'Target level'} expectation: ${levelHint}` : '',
    ...sorted.flatMap((category) => category.suggestions.map((suggestion) => `${category.label}: ${suggestion}`))
  ].filter(Boolean).slice(0, 6);

  return {
    band: scoreBand(overallScore),
    categories,
    diagnostics,
    improvementSummary: { priorityActions: priorityActions(categories, diagnostics, options.roleName, options.scoringPolicy), strengths, topFixes },
    overallScore,
    wordCount
  };
}
