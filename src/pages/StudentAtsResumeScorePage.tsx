import {
  AlertCircle,
  BadgeIndianRupee,
  BriefcaseBusiness,
  ChevronRight,
  CheckCircle2,
  Circle,
  CircleCheck,
  Copy,
  Download,
  FileSearch,
  GraduationCap,
  History,
  ListChecks,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UploadCloud,
  X
} from 'lucide-react';
import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ErrorState, LoadingState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import {
  StudentAtsAttempt,
  useCreateStudentAtsAttempt,
  useCreateStudentAtsPackageOrder,
  useRecordStudentAtsReportDownload,
  useSyncStudentAtsCredits,
  useStudentAtsResumeScore
} from '../features/student/useStudentAtsResumeScore';
import { analyzeAdvancedResume, analyzeBasicResume, AtsScoreCategory, AtsScoreResult } from '../lib/atsResumeScoring';
import { extractResumeTextFromPdf, PdfResumePreviewPage, PdfResumeTextItem } from '../lib/pdfResumeText';

type ScanMode = 'basic' | 'advanced';

type ScoreComparison = {
  categoryChanges: Array<{
    delta: number;
    label: string;
  }>;
  delta: number;
  interpretation: string;
  previousDate: string;
  previousMode: string;
  previousScore: number;
};

type AtsLineFeedback = {
  applySteps: string[];
  bestLocation: string;
  categoryKey: string;
  coachingPrompt: string[];
  effort: 'Low' | 'Medium' | 'High';
  expectedGain: string;
  id: string;
  issue: string;
  line: string;
  lineNumber: number;
  recruiterReason: string;
  severity: 'high' | 'medium' | 'low';
  suggestedRewrite: string;
  title: string;
  truthfulAlternative: string;
};

type AtsKeywordRecommendation = {
  keyword: string;
  status: 'found' | 'missing' | 'use-with-evidence';
};

type AtsCvPointExample = {
  actionVerb: string;
  id: string;
  keywords: string[];
  metric: string;
  point: string;
};

type PdfHighlight = {
  feedbackId: string;
  height: number;
  pageNumber: number;
  severity: AtsLineFeedback['severity'];
  width: number;
  x: number;
  y: number;
};

type AnalysisState =
  | { status: 'idle' }
  | { fileName?: string; status: 'processing' }
  | {
      attemptId?: string;
      comparison?: ScoreComparison;
      fileName: string;
      keywordRecommendations: AtsKeywordRecommendation[];
      lineFeedback: AtsLineFeedback[];
      pageCount: number;
      previewImages: string[];
      previewPages: PdfResumePreviewPage[];
      previewLines: string[];
      result: AtsScoreResult;
      roleKeywords: string[];
      roleSampleCvPoints: Array<Record<string, unknown>>;
      saved: boolean;
      saveMessage?: string;
      scanMode: ScanMode;
      status: 'ready';
      targetLabel?: string;
    }
  | { message: string; status: 'error' };

const SCAN_STEPS = [
  'Reading your PDF resume',
  'Checking ATS readability',
  'Finding contact details',
  'Mapping resume sections',
  'Reviewing bullet points',
  'Checking action verbs',
  'Looking for measurable impact',
  'Testing role signals',
  'Preparing your score report'
];

const LOCKED_PREMIUM_CHECKS = [
  {
    description: 'Match this resume against a pasted job description and find missing terms.',
    key: 'jobDescriptionMatch',
    title: 'Job description match'
  },
  {
    description: 'Compare projects and experience against your selected target role.',
    key: 'roleKeywordMatch',
    title: 'Role keyword evidence'
  },
  {
    description: 'See more line-level issues, recruiter reasoning, and targeted rewrite formulas.',
    key: 'deepLineReview',
    title: 'Deep line review'
  },
  {
    description: 'Download a Skilled Sapiens branded ATS report for review and mentoring.',
    key: 'brandedReport',
    title: 'Branded report download'
  }
];

function formatDate(value: string | undefined) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function titleCaseLabel(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function scoreTone(score: number) {
  if (score >= 85) return 'safe';
  if (score >= 70) return 'neutral';
  if (score >= 50) return 'warning';
  return 'danger';
}

function bandLabel(score: number) {
  if (score >= 85) return 'Strong';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Needs work';
  return 'High risk';
}

function categoryPercent(category: AtsScoreCategory) {
  return Math.round((category.score / category.maxScore) * 100);
}

function deltaLabel(delta: number) {
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

function buildBreakdown(result: AtsScoreResult, extras: Record<string, unknown> = {}, sanitizeJobDescription = false) {
  return {
    band: result.band,
    categories: sanitizeJobDescription
      ? result.categories.map((category) =>
          category.key === 'jobDescriptionMatch'
            ? {
                ...category,
                signals: ['Job description match calculated in browser'],
                suggestions: category.score < category.maxScore ? ['Improve truthful alignment with the target job description.'] : []
              }
            : category
        )
      : result.categories,
    diagnostics: result.diagnostics,
    wordCount: result.wordCount,
    ...extras
  };
}

function savedCategoriesFromAttempt(attempt: StudentAtsAttempt) {
  const categories = Array.isArray(attempt.breakdown?.categories) ? attempt.breakdown.categories : [];
  return categories
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    .map((item) => ({
      key: String(item.key ?? ''),
      label: String(item.label ?? 'Score area'),
      maxScore: Number(item.maxScore ?? 0),
      score: Number(item.score ?? 0)
    }))
    .filter((item) => item.key && item.maxScore > 0);
}

function buildScoreComparison(result: AtsScoreResult, attempts: StudentAtsAttempt[], scanMode: ScanMode): ScoreComparison | undefined {
  const previous = attempts.find((attempt) => attempt.scanMode === scanMode) ?? attempts[0];
  if (!previous) return undefined;

  const previousCategories = new Map(savedCategoriesFromAttempt(previous).map((category) => [category.key, category]));
  const categoryChanges = result.categories
    .map((category) => {
      const oldCategory = previousCategories.get(category.key);
      if (!oldCategory) return null;
      const currentPercent = category.maxScore > 0 ? Math.round((category.score / category.maxScore) * 100) : 0;
      const previousPercent = oldCategory.maxScore > 0 ? Math.round((oldCategory.score / oldCategory.maxScore) * 100) : 0;
      return { delta: currentPercent - previousPercent, label: category.label };
    })
    .filter((item): item is { delta: number; label: string } => item !== null)
    .filter((item) => Math.abs(item.delta) >= 5)
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
    .slice(0, 4);
  const delta = result.overallScore - previous.overallScore;
  const interpretation =
    delta >= 8
      ? 'Clear improvement. Recruiters should see stronger evidence or structure than the previous scan.'
      : delta >= 3
        ? 'Modest improvement. The resume is moving in the right direction, but the strongest recruiter-facing gaps still matter.'
        : delta <= -8
          ? 'Score dropped meaningfully. Review missing sections, parse quality, or weaker role evidence before applying.'
          : delta <= -3
            ? 'Slight decline. Check whether the new version removed useful contact, section, keyword, or impact signals.'
            : 'Mostly stable. The new version is similar to the previous scan, so focus on the priority action plan.';

  return {
    categoryChanges,
    delta,
    interpretation,
    previousDate: previous.createdAt,
    previousMode: previous.scanMode,
    previousScore: previous.overallScore
  };
}

function buildImprovementSummary(result: AtsScoreResult, sanitizeJobDescription = false) {
  if (!sanitizeJobDescription) return result.improvementSummary;
  return {
    priorityActions: result.improvementSummary.priorityActions,
    strengths: result.improvementSummary.strengths,
    topFixes: result.improvementSummary.topFixes.map((fix) =>
      fix.toLowerCase().includes('job description match') ? 'Job description match: Improve truthful alignment with the target JD. Exact JD text was not saved.' : fix
    )
  };
}

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function pdfSafeText(value: string) {
  return value
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/[•·]/g, '-')
    .replace(/[₹]/g, 'INR')
    .replace(/./g, (character) => {
      const code = character.charCodeAt(0);
      return code >= 32 && code <= 126 ? character : ' ';
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function escapePdfText(value: string) {
  return pdfSafeText(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wrapPdfText(value: string, maxWidth: number, fontSize: number) {
  const words = pdfSafeText(value).split(/\s+/).filter(Boolean);
  const maxChars = Math.max(18, Math.floor(maxWidth / (fontSize * 0.52)));
  const lines: string[] = [];
  let line = '';
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function binaryStringFromBytes(bytes: Uint8Array) {
  let output = '';
  for (let index = 0; index < bytes.length; index += 8192) {
    output += String.fromCharCode(...bytes.slice(index, index + 8192));
  }
  return output;
}

function bytesFromBinaryString(value: string) {
  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) bytes[index] = value.charCodeAt(index) & 0xff;
  return bytes;
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function playScanSequence(setStep: (step: number) => void) {
  for (let index = 1; index < SCAN_STEPS.length; index += 1) {
    await sleep(520);
    setStep(index);
  }
}

function buildResumePreviewLines(text: string) {
  return text
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length >= 3)
    .slice(0, 34);
}

function normalizeMatchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9%₹$+]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenOverlapScore(left: string, right: string) {
  const leftTokens = new Set(normalizeMatchText(left).split(' ').filter((token) => token.length >= 2));
  const rightTokens = new Set(normalizeMatchText(right).split(' ').filter((token) => token.length >= 2));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  let overlap = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) overlap += 1;
  });
  return overlap / Math.max(leftTokens.size, 1);
}

function mergeTextItems(items: PdfResumeTextItem[]): Omit<PdfHighlight, 'feedbackId' | 'severity'> | null {
  if (items.length === 0) return null;
  const pageNumber = items[0].pageNumber;
  const x1 = Math.min(...items.map((item) => item.x));
  const y1 = Math.min(...items.map((item) => item.y));
  const x2 = Math.max(...items.map((item) => item.x + item.width));
  const y2 = Math.max(...items.map((item) => item.y + item.height));
  return {
    height: Math.max(y2 - y1 + 6, 12),
    pageNumber,
    width: Math.max(x2 - x1 + 8, 18),
    x: Math.max(x1 - 4, 0),
    y: Math.max(y1 - 3, 0)
  };
}

function buildPdfHighlights(pages: PdfResumePreviewPage[], feedback: AtsLineFeedback[]): PdfHighlight[] {
  return feedback
    .map((item) => {
      const target = normalizeMatchText(item.line);
      if (!target) return null;
      let bestItems: PdfResumeTextItem[] = [];
      let bestScore = 0;
      pages.forEach((page) => {
        const candidates = page.textItems.filter((textItem) => textItem.str.length > 0);
        candidates.forEach((_, index) => {
          const windowItems = candidates.slice(index, Math.min(candidates.length, index + 12));
          let collected = '';
          const selected: PdfResumeTextItem[] = [];
          for (const textItem of windowItems) {
            collected = `${collected} ${textItem.str}`.trim();
            selected.push(textItem);
            const normalizedCollected = normalizeMatchText(collected);
            if (normalizedCollected.length < Math.min(target.length * 0.35, 24)) continue;
            const score = normalizedCollected.includes(target) || target.includes(normalizedCollected) ? 1 : tokenOverlapScore(target, normalizedCollected);
            if (score > bestScore) {
              bestItems = [...selected];
              bestScore = score;
            }
            if (normalizedCollected.length > target.length * 1.6) break;
          }
        });
      });
      if (bestScore < 0.48 || bestItems.length === 0) return null;
      const box = mergeTextItems(bestItems);
      return box ? { ...box, feedbackId: item.id, severity: item.severity } : null;
    })
    .filter((item): item is PdfHighlight => item !== null);
}

const LINE_ACTION_VERBS = [
  'achieved',
  'analyzed',
  'assisted',
  'automated',
  'built',
  'coordinated',
  'created',
  'delivered',
  'designed',
  'developed',
  'drove',
  'executed',
  'improved',
  'implemented',
  'increased',
  'launched',
  'led',
  'managed',
  'optimized',
  'prepared',
  'reduced',
  'reported',
  'resolved',
  'supported',
  'streamlined'
];

const GENERAL_RESUME_KEYWORDS = [
  'stakeholder management',
  'data analysis',
  'reporting',
  'Excel',
  'dashboard',
  'process improvement',
  'research',
  'documentation',
  'presentation',
  'project coordination',
  'quality review',
  'client communication',
  'problem solving',
  'performance tracking',
  'workflow optimization',
  'cross-functional collaboration',
  'SOP',
  'MIS',
  'business analysis',
  'compliance'
];

function hasMetric(value: string) {
  return /\b(?:\d+(?:\.\d+)?%?|\d+\+|[₹$]\s?\d+|inr\s?\d+|usd\s?\d+|users?|clients?|students?|hours?|days?|weeks?|months?)\b/i.test(value);
}

function startsWithActionVerb(value: string) {
  const firstWord = value.replace(/^[•▪●*—-]\s+|^\d+[.)]\s+/, '').trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  return LINE_ACTION_VERBS.includes(firstWord.replace(/[^a-z]/g, ''));
}

function hasToolOrMethod(value: string) {
  return /\b(using|via|through|with|by|sql|excel|python|power bi|tableau|crm|jira|figma|dashboard|model|analysis|research|automation|campaign|funnel|interview|survey|document|documents|report|reports|compliance|process|review)\b/i.test(value);
}

function isResumeBullet(value: string) {
  return /^[•▪●*—-]\s+\S|^\d+[.)]\s+\S/.test(value) || startsWithActionVerb(value);
}

function lineRewriteFormula(line: string) {
  const clean = line.replace(/^[•▪●*—-]\s+|^\d+[.)]\s+/, '').trim();
  const fallbackObject = clean.split(/\s+/).slice(0, 7).join(' ').replace(/[.,;:]+$/, '');
  return `Rewrite as: Action + ${fallbackObject || 'project/task'} + tool/method + measurable outcome.`;
}

function stripBulletMarker(value: string) {
  return value.replace(/^[•▪●*—-]\s+|^\d+[.)]\s+/, '').trim();
}

function sentenceCase(value: string) {
  const clean = value.trim();
  if (!clean) return '';
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function inferResumeSection(lines: Array<{ index: number; line: string }>, lineNumber: number) {
  const headings = [
    'experience',
    'work experience',
    'internship',
    'internships',
    'projects',
    'academic projects',
    'education',
    'skills',
    'certifications',
    'achievements',
    'summary'
  ];
  for (let index = lines.findIndex((line) => line.index === lineNumber); index >= 0; index -= 1) {
    const normalized = lines[index]?.line.toLowerCase().replace(/[:|]/g, '').trim() ?? '';
    if (headings.includes(normalized)) return sentenceCase(lines[index].line.replace(/[:|]/g, '').trim());
  }
  return 'Most relevant project, internship, or experience bullet';
}

function bestLocationForLine(lines: Array<{ index: number; line: string }>, lineNumber: number) {
  const section = inferResumeSection(lines, lineNumber);
  return section === 'Most relevant project, internship, or experience bullet' ? section : `${section} section, nearest relevant bullet`;
}

function buildActionVerbRewrite(line: string) {
  const clean = stripBulletMarker(line);
  return `Prepared ${clean.charAt(0).toLowerCase()}${clean.slice(1).replace(/[.]+$/, '')} using [method/tool] to achieve [result].`;
}

function buildMetricRewrite(line: string) {
  const clean = stripBulletMarker(line).replace(/[.]+$/, '');
  return `${clean} for [number] clients/users/tasks, improving [speed/accuracy/completion] by [metric].`;
}

function buildMethodRewrite(line: string) {
  const clean = stripBulletMarker(line).replace(/[.]+$/, '');
  return `${clean} using [tool/process/dataset], coordinating with [stakeholder] to deliver [specific output].`;
}

function keywordRewrite(keyword: string) {
  return `Assisted with ${keyword} work by reviewing supporting documents, preparing working notes, and coordinating follow-up for quarterly compliance.`;
}

function displayKeyword(keyword: string) {
  const raw = keyword.trim();
  const pipeParts = raw.split('|').map((part) => part.trim()).filter(Boolean);
  if (pipeParts.length >= 2) return pipeParts[0];
  const prefix = raw.match(/^\[(must-have|required|mandatory|core|critical|important|nice-to-have|optional|bonus|preferred|good-to-have)\]\s*(.+)$/i);
  const suffix = raw.match(/^(.+?)\s*\((must-have|required|mandatory|core|critical|important|nice-to-have|optional|bonus|preferred|good-to-have)\)$/i);
  const colon = raw.match(/^(.+?)\s*:\s*(must-have|required|mandatory|core|critical|important|nice-to-have|optional|bonus|preferred|good-to-have)$/i);
  if (prefix) return prefix[2].trim();
  if (suffix) return suffix[1].trim();
  if (colon) return colon[1].trim();
  return raw;
}

function uniqueTextItems(items: string[]) {
  const seen = new Set<string>();
  return items
    .map((item) => displayKeyword(item).replace(/\s+/g, ' ').trim())
    .filter((item) => {
      const key = item.toLowerCase();
      if (!item || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function roleKeywordPool(roleKeywords: string[] = []) {
  return uniqueTextItems([...roleKeywords, ...GENERAL_RESUME_KEYWORDS]).slice(0, 30);
}

function buildKeywordRecommendations(text: string, roleKeywords: string[] = []): AtsKeywordRecommendation[] {
  const lowerText = text.toLowerCase();
  return roleKeywordPool(roleKeywords).slice(0, 30).map((keyword) => {
    if (roleKeywords.length === 0) return { keyword, status: 'use-with-evidence' };
    const found = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(lowerText);
    return { keyword, status: found ? 'found' : 'missing' };
  });
}

function keywordAt(pool: string[], index: number, fallback: string) {
  return pool[index % Math.max(pool.length, 1)] ?? fallback;
}

function exampleTheme(targetLabel?: string, roleKeywords: string[] = []) {
  const joined = `${targetLabel ?? ''} ${roleKeywords.join(' ')}`.toLowerCase();
  if (/\b(agile|scrum|sprint|kanban|burndown|jira|product owner)\b/.test(joined)) return 'agile';
  if (/\b(tax|audit|account|finance|gst|tds|valuation|model|equity|investment)\b/.test(joined)) return 'finance';
  if (/\b(marketing|campaign|seo|content|social|brand|sales|lead|crm)\b/.test(joined)) return 'marketing';
  if (/\b(hr|recruit|talent|employee|training|l&d|payroll|onboarding)\b/.test(joined)) return 'hr';
  return 'general';
}

function cvPointFromRecord(item: Record<string, unknown>, index: number): AtsCvPointExample | null {
  const point = typeof item.point === 'string' ? item.point.trim() : '';
  if (!point) return null;
  return {
    actionVerb: typeof item.actionVerb === 'string' && item.actionVerb.trim() ? item.actionVerb.trim() : stripBulletMarker(point).split(/\s+/)[0]?.replace(/[^a-z]/gi, '') || 'Action',
    id: `cv-example-${index}`,
    keywords: Array.isArray(item.keywords) ? item.keywords.filter((keyword): keyword is string => typeof keyword === 'string' && keyword.trim().length > 0).map((keyword) => keyword.trim()) : [],
    metric: typeof item.metric === 'string' && item.metric.trim() ? item.metric.trim() : 'Add real metric',
    point
  };
}

function buildCvPointExamples(roleKeywords: string[] = [], targetLabel?: string, configuredPoints: Array<Record<string, unknown>> = []): AtsCvPointExample[] {
  const configured = configuredPoints.map(cvPointFromRecord).filter((item): item is AtsCvPointExample => item !== null).slice(0, 15);
  if (configured.length > 0) return configured;

  const pool = roleKeywordPool(roleKeywords);
  const k = (index: number, fallback: string) => keywordAt(pool, index, fallback);
  const themes: Record<string, Array<Omit<AtsCvPointExample, 'id'>>> = {
    agile: [
      { actionVerb: 'Analyzed', keywords: [k(0, 'agile maturity'), k(1, 'burndown')], metric: '4 sprint cycles', point: `Analyzed ${k(0, 'agile maturity')} and ${k(1, 'burndown')} trends across 4 sprint cycles, improving delivery visibility for project stakeholders.` },
      { actionVerb: 'Coordinated', keywords: [k(2, 'sprint planning'), k(3, 'Jira')], metric: '25+ backlog items', point: `Coordinated ${k(2, 'sprint planning')} inputs for 25+ backlog items using ${k(3, 'Jira')}, helping the team prioritize release-ready work.` },
      { actionVerb: 'Supported', keywords: [k(4, 'agile coaching'), k(5, 'retrospective')], metric: '3 team ceremonies', point: `Supported ${k(4, 'agile coaching')} during 3 team ceremonies by documenting ${k(5, 'retrospective')} actions and tracking follow-through.` },
      { actionVerb: 'Prepared', keywords: [k(6, 'Scrum'), k(7, 'stakeholder management')], metric: 'weekly status reports', point: `Prepared weekly ${k(6, 'Scrum')} status reports for ${k(7, 'stakeholder management')}, summarizing blockers, ownership, and next-step decisions.` },
      { actionVerb: 'Improved', keywords: [k(8, 'Kanban'), k(9, 'workflow optimization')], metric: '15% faster handoffs', point: `Improved ${k(8, 'Kanban')} workflow tracking, reducing handoff delays by a sample 15% through clearer task ownership and review checkpoints.` }
    ],
    finance: [
      { actionVerb: 'Prepared', keywords: [k(0, 'advance tax'), k(1, 'compliance')], metric: '12+ client files', point: `Prepared ${k(0, 'advance tax')} working notes for 12+ client files, supporting ${k(1, 'compliance')} review and quarterly filing readiness.` },
      { actionVerb: 'Analyzed', keywords: [k(2, 'financial modeling'), k(3, 'Excel')], metric: '3-statement model', point: `Analyzed assumptions in a ${k(2, 'financial modeling')} exercise using ${k(3, 'Excel')}, validating revenue, margin, and cash-flow drivers.` },
      { actionVerb: 'Reviewed', keywords: [k(4, 'assessment'), k(5, 'documentation')], metric: '40+ documents', point: `Reviewed 40+ supporting documents for ${k(4, 'assessment')} and ${k(5, 'documentation')}, flagging missing records for senior review.` },
      { actionVerb: 'Built', keywords: [k(6, 'valuation'), k(7, 'data analysis')], metric: '5 comparable companies', point: `Built a sample ${k(6, 'valuation')} comparison for 5 companies using ${k(7, 'data analysis')}, summarizing key multiples and business drivers.` },
      { actionVerb: 'Reported', keywords: [k(8, 'MIS'), k(9, 'dashboard')], metric: 'monthly tracker', point: `Reported monthly ${k(8, 'MIS')} updates through a ${k(9, 'dashboard')}, helping track collections, expenses, and variance trends.` }
    ],
    marketing: [
      { actionVerb: 'Executed', keywords: [k(0, 'campaign'), k(1, 'social media')], metric: '3 channels', point: `Executed ${k(0, 'campaign')} updates across 3 ${k(1, 'social media')} channels, tracking reach, engagement, and weekly content performance.` },
      { actionVerb: 'Analyzed', keywords: [k(2, 'SEO'), k(3, 'keyword research')], metric: '50+ keywords', point: `Analyzed 50+ ${k(2, 'SEO')} terms through ${k(3, 'keyword research')}, identifying content opportunities for higher-intent search traffic.` },
      { actionVerb: 'Built', keywords: [k(4, 'CRM'), k(5, 'lead generation')], metric: '200+ leads', point: `Built a ${k(4, 'CRM')} tracker for 200+ ${k(5, 'lead generation')} records, improving follow-up visibility for the sales team.` },
      { actionVerb: 'Created', keywords: [k(6, 'brand positioning'), k(7, 'presentation')], metric: '8-slide deck', point: `Created an 8-slide ${k(7, 'presentation')} on ${k(6, 'brand positioning')}, summarizing audience insights, competitor cues, and messaging options.` },
      { actionVerb: 'Improved', keywords: [k(8, 'conversion'), k(9, 'A/B testing')], metric: '12% sample lift', point: `Improved sample ${k(8, 'conversion')} messaging through ${k(9, 'A/B testing')}, comparing two CTA variants and documenting learnings.` }
    ],
    hr: [
      { actionVerb: 'Coordinated', keywords: [k(0, 'recruitment'), k(1, 'screening')], metric: '60+ profiles', point: `Coordinated ${k(0, 'recruitment')} ${k(1, 'screening')} for 60+ profiles, shortlisting candidates against role requirements and availability.` },
      { actionVerb: 'Prepared', keywords: [k(2, 'onboarding'), k(3, 'documentation')], metric: '15 new hires', point: `Prepared ${k(2, 'onboarding')} ${k(3, 'documentation')} for 15 new hires, improving joining-day readiness and record completeness.` },
      { actionVerb: 'Analyzed', keywords: [k(4, 'employee engagement'), k(5, 'survey')], metric: '120 responses', point: `Analyzed ${k(4, 'employee engagement')} ${k(5, 'survey')} inputs from 120 responses, summarizing themes for HR action planning.` },
      { actionVerb: 'Supported', keywords: [k(6, 'training'), k(7, 'L&D')], metric: '4 sessions', point: `Supported 4 ${k(6, 'training')} sessions for ${k(7, 'L&D')} initiatives by tracking attendance, feedback, and completion status.` },
      { actionVerb: 'Maintained', keywords: [k(8, 'HRIS'), k(9, 'compliance')], metric: '95% record accuracy', point: `Maintained ${k(8, 'HRIS')} records with a sample 95% accuracy target, supporting ${k(9, 'compliance')} and internal reporting.` }
    ],
    general: [
      { actionVerb: 'Analyzed', keywords: [k(0, 'data analysis'), k(1, 'reporting')], metric: '500+ records', point: `Analyzed 500+ records for ${k(0, 'data analysis')} and ${k(1, 'reporting')}, identifying trends and summarizing insights for team review.` },
      { actionVerb: 'Built', keywords: [k(2, 'Excel'), k(3, 'dashboard')], metric: 'weekly dashboard', point: `Built a weekly ${k(3, 'dashboard')} using ${k(2, 'Excel')}, improving visibility into tasks, owners, and pending follow-ups.` },
      { actionVerb: 'Coordinated', keywords: [k(4, 'project coordination'), k(5, 'stakeholder management')], metric: '6 stakeholders', point: `Coordinated ${k(4, 'project coordination')} across 6 stakeholders, tracking decisions, blockers, and completion timelines.` },
      { actionVerb: 'Prepared', keywords: [k(6, 'documentation'), k(7, 'presentation')], metric: '10-page report', point: `Prepared a 10-page ${k(6, 'documentation')} and ${k(7, 'presentation')} pack, converting research findings into clear recommendations.` },
      { actionVerb: 'Improved', keywords: [k(8, 'process improvement'), k(9, 'workflow optimization')], metric: '20% sample reduction', point: `Improved ${k(8, 'process improvement')} tracking, reducing sample turnaround time by 20% through ${k(9, 'workflow optimization')}.` }
    ]
  };
  const base = themes[exampleTheme(targetLabel, roleKeywords)];
  const extensions: Array<Omit<AtsCvPointExample, 'id'>> = [
    { actionVerb: 'Researched', keywords: [k(10, 'research'), k(11, 'business analysis')], metric: '8 competitor benchmarks', point: `Researched 8 competitor benchmarks for ${k(10, 'research')} and ${k(11, 'business analysis')}, summarizing patterns, gaps, and action points.` },
    { actionVerb: 'Tracked', keywords: [k(12, 'performance tracking'), k(13, 'MIS')], metric: 'weekly tracker', point: `Tracked weekly ${k(12, 'performance tracking')} metrics in an ${k(13, 'MIS')} sheet, highlighting delays, ownership, and completion status.` },
    { actionVerb: 'Reviewed', keywords: [k(14, 'quality review'), k(15, 'compliance')], metric: '30+ entries', point: `Reviewed 30+ entries for ${k(14, 'quality review')} and ${k(15, 'compliance')}, correcting inconsistencies before final submission.` },
    { actionVerb: 'Presented', keywords: [k(16, 'presentation'), k(17, 'stakeholder management')], metric: '5 recommendations', point: `Presented 5 recommendations to support ${k(17, 'stakeholder management')}, converting analysis into clear next steps and ownership.` },
    { actionVerb: 'Streamlined', keywords: [k(18, 'SOP'), k(19, 'workflow optimization')], metric: '3-step process', point: `Streamlined a 3-step ${k(18, 'SOP')} for ${k(19, 'workflow optimization')}, reducing ambiguity in recurring student/project tasks.` },
    { actionVerb: 'Documented', keywords: [k(20, 'documentation'), k(21, 'process improvement')], metric: '12 action items', point: `Documented 12 action items for ${k(21, 'process improvement')}, creating a clear tracker for owners, deadlines, and completion status.` },
    { actionVerb: 'Collaborated', keywords: [k(22, 'cross-functional collaboration'), k(23, 'client communication')], metric: '4 teams', point: `Collaborated with 4 teams on ${k(22, 'cross-functional collaboration')} and ${k(23, 'client communication')}, ensuring timely updates and issue closure.` },
    { actionVerb: 'Delivered', keywords: [k(24, 'reporting'), k(25, 'problem solving')], metric: '2-week deadline', point: `Delivered ${k(24, 'reporting')} support within a 2-week deadline, applying ${k(25, 'problem solving')} to resolve data and formatting gaps.` },
    { actionVerb: 'Optimized', keywords: [k(26, 'dashboard'), k(27, 'data analysis')], metric: '15% sample improvement', point: `Optimized a ${k(26, 'dashboard')} for ${k(27, 'data analysis')}, improving sample review speed by 15% through clearer filters and summaries.` },
    { actionVerb: 'Summarized', keywords: [k(28, 'research'), k(29, 'presentation')], metric: '6 insight themes', point: `Summarized 6 insight themes from ${k(28, 'research')} into a ${k(29, 'presentation')}, helping the team compare options quickly.` }
  ];
  return [...base, ...extensions].slice(0, 15).map((item, index) => ({ ...item, id: `cv-example-${index}` }));
}

function missingKeywordFromIssue(issue: string) {
  return issue.match(/missing role keyword evidence:\s*([^.]*)/i)?.[1]?.trim();
}

function lineFeedbackContextText(item: AtsLineFeedback) {
  const missingKeyword = missingKeywordFromIssue(item.issue);
  if (missingKeyword) return `No clear, credible evidence found for "${missingKeyword}" in a project or experience bullet.`;
  return item.line;
}

function buildLineFeedback(text: string, roleKeywords: string[] = []): AtsLineFeedback[] {
  const lines = text
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length >= 3)
    .map((line, index) => ({ index, line }));
  const bullets = lines.filter((item) => item.line.length >= 28 && isResumeBullet(item.line)).slice(0, 24);
  const firstVerbCounts = bullets.reduce<Record<string, number>>((counts, item) => {
    const firstVerb = item.line.replace(/^[•▪●*—-]\s+|^\d+[.)]\s+/, '').trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, '') ?? '';
    if (firstVerb && LINE_ACTION_VERBS.includes(firstVerb)) counts[firstVerb] = (counts[firstVerb] ?? 0) + 1;
    return counts;
  }, {});
  const feedback: AtsLineFeedback[] = [];
  const addFeedback = (item: Omit<AtsLineFeedback, 'id'>) => {
    if (feedback.some((existing) => existing.lineNumber === item.lineNumber && existing.categoryKey === item.categoryKey && existing.title === item.title)) return;
    feedback.push({ ...item, id: `${item.categoryKey}-${item.lineNumber}-${feedback.length}` });
  };

  bullets.forEach((item) => {
    const clean = item.line.replace(/^[•▪●*—-]\s+|^\d+[.)]\s+/, '').trim();
    if (!startsWithActionVerb(item.line)) {
      addFeedback({
        applySteps: ['Replace the first word with a stronger ownership verb.', 'Keep the rest of the line truthful.', 'Add a tool, scope, or result if the line still feels generic.'],
        bestLocation: bestLocationForLine(lines, item.index),
        categoryKey: 'actionVerbs',
        coachingPrompt: ['What did you personally do in this task?', 'Was the work analyzed, built, coordinated, improved, prepared, or resolved?', 'What changed because you did it?'],
        effort: 'Low',
        expectedGain: '+1 to +2',
        issue: 'This line does not start with a strong ownership verb.',
        line: item.line,
        lineNumber: item.index,
        recruiterReason: 'Recruiters read bullets quickly. A strong first verb makes the contribution easier to understand.',
        severity: 'medium',
        suggestedRewrite: buildActionVerbRewrite(clean),
        truthfulAlternative: lineRewriteFormula(clean),
        title: 'Strengthen bullet opening'
      });
    }
    if (!hasMetric(item.line)) {
      addFeedback({
        applySteps: ['Choose one number you can defend in an interview.', 'Use scope when exact results are unavailable: clients handled, rows analyzed, reports prepared, weeks covered.', 'Place the number before the outcome so it is easy to scan.'],
        bestLocation: bestLocationForLine(lines, item.index),
        categoryKey: 'quantifiedImpact',
        coachingPrompt: ['How many clients, users, leads, students, reports, records, or SKUs were involved?', 'Did you reduce time, improve accuracy, increase completion, or handle a recurring volume?', 'Can you state the timeframe: daily, weekly, monthly, quarterly?'],
        effort: 'Medium',
        expectedGain: '+1 to +3',
        issue: 'This line does not show measurable proof.',
        line: item.line,
        lineNumber: item.index,
        recruiterReason: 'A number, volume, percentage, or scope signal helps recruiters judge real impact.',
        severity: 'high',
        suggestedRewrite: buildMetricRewrite(clean),
        truthfulAlternative: 'If you do not know the final impact, add truthful scope instead: number of files, reports, clients, records, meetings, or weeks handled.',
        title: 'Add measurable impact'
      });
    }
    if (!hasToolOrMethod(item.line)) {
      addFeedback({
        applySteps: ['Name the tool, process, dataset, framework, or stakeholder used.', 'Connect it to the task instead of adding a separate skills list.', 'Keep only the method that is most relevant to the target role.'],
        bestLocation: bestLocationForLine(lines, item.index),
        categoryKey: 'bulletQuality',
        coachingPrompt: ['Which tool did you use: Excel, SQL, Power BI, CRM, Figma, survey, dashboard, model, or another process?', 'Who used your output?', 'What document, report, dashboard, analysis, or campaign did you produce?'],
        effort: 'Low',
        expectedGain: '+1 to +2',
        issue: 'This line does not explain how the work was done.',
        line: item.line,
        lineNumber: item.index,
        recruiterReason: 'Method or tool context makes the bullet more credible than a generic responsibility.',
        severity: 'medium',
        suggestedRewrite: buildMethodRewrite(clean),
        truthfulAlternative: 'If no software tool was used, mention the process instead: research calls, document review, reconciliations, stakeholder follow-ups, or manual analysis.',
        title: 'Add method or tool evidence'
      });
    }
    const firstVerb = clean.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, '') ?? '';
    if (firstVerbCounts[firstVerb] > 2) {
      addFeedback({
        applySteps: ['Replace this repeated first verb with a more precise one.', 'Choose a verb that matches the actual task.', 'Keep repeated verbs only when they describe genuinely similar work.'],
        bestLocation: bestLocationForLine(lines, item.index),
        categoryKey: 'actionVerbs',
        coachingPrompt: ['Was this work closer to analysis, coordination, execution, improvement, or reporting?', 'Can another verb show the specific contribution better?', 'Do nearby bullets already start the same way?'],
        effort: 'Low',
        expectedGain: '+1',
        issue: `The action verb "${firstVerb}" appears multiple times.`,
        line: item.line,
        lineNumber: item.index,
        recruiterReason: 'Repeated verbs make achievements feel similar even when the work was different.',
        severity: 'low',
        suggestedRewrite: 'Replace repeated verbs with more precise alternatives like analyzed, improved, delivered, launched, resolved, or optimized.',
        truthfulAlternative: 'Keep the verb only if it is the most accurate description, but vary nearby bullets where possible.',
        title: 'Reduce repeated verbs'
      });
    }
  });

  lines.forEach((item) => {
    if (/\b(date of birth|dob|marital status|gender|religion|nationality)\b/i.test(item.line)) {
      addFeedback({
        applySteps: ['Remove personal details that are not required for the application.', 'Keep contact details limited to professional ways to reach you.', 'Use the saved space for skills, projects, or experience evidence.'],
        bestLocation: 'Resume header or personal details section',
        categoryKey: 'contactInformation',
        coachingPrompt: ['Does the recruiter need this to contact you?', 'Is this required in the job posting?', 'Could this space show a stronger project, skill, or certification instead?'],
        effort: 'Low',
        expectedGain: '+1 to +2',
        issue: 'This line may include unnecessary personal details.',
        line: item.line,
        lineNumber: item.index,
        recruiterReason: 'Recruiters generally need only name, email, phone, location, LinkedIn, and portfolio links.',
        severity: 'medium',
        suggestedRewrite: 'Remove personal details that are not required for the job application.',
        truthfulAlternative: 'Keep only name, email, phone, city, LinkedIn, GitHub, portfolio, or other role-relevant professional links.',
        title: 'Remove unnecessary personal detail'
      });
    }
  });

  if (roleKeywords.length > 0) {
    const lowerText = text.toLowerCase();
    const missingKeywords = roleKeywords.filter((keyword) => keyword.length >= 3 && !new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(lowerText)).slice(0, 4);
    missingKeywords.forEach((keyword, index) => {
      addFeedback({
        applySteps: ['Find a real project, internship, coursework, or case study where this keyword was actually used.', 'Add the keyword inside a bullet with the task, document, tool, or outcome.', 'Skip this keyword if you cannot explain it confidently in an interview.'],
        bestLocation: bullets[index] ? bestLocationForLine(lines, bullets[index].index) : 'Best fit: Experience or Projects section',
        categoryKey: 'roleKeywordMatch',
        coachingPrompt: [`Did you work on ${keyword} directly, or only study it?`, `What document, calculation, report, tool, or client task involved ${keyword}?`, 'Can you explain your role in one interview answer without exaggerating?'],
        effort: 'Medium',
        expectedGain: '+1 to +2',
        issue: `Missing role keyword evidence: ${keyword}.`,
        line: `No evidence found for "${keyword}" inside a relevant project or experience bullet.`,
        lineNumber: bullets[index]?.index ?? lines[index]?.index ?? 0,
        recruiterReason: `Recruiters and ATS systems trust "${keyword}" more when it appears inside a real task, project, tool, document, or outcome instead of a plain keyword list.`,
        severity: 'medium',
        suggestedRewrite: keywordRewrite(keyword),
        title: `Add evidence for "${keyword}"`,
        truthfulAlternative: `If you did not perform ${keyword} work, do not add the term. Use the closest truthful exposure instead, such as tax filing support, document review, compliance research, or coursework.`
      });
    });
  }

  return feedback
    .sort((left, right) => {
      const rank = { high: 0, medium: 1, low: 2 };
      return rank[left.severity] - rank[right.severity] || left.lineNumber - right.lineNumber;
    })
    .slice(0, 10);
}

function topCategories(result: AtsScoreResult, order: 'strong' | 'weak') {
  return [...result.categories]
    .sort((left, right) =>
      order === 'strong'
        ? right.score / Math.max(right.maxScore, 1) - left.score / Math.max(left.maxScore, 1)
        : left.score / Math.max(left.maxScore, 1) - right.score / Math.max(right.maxScore, 1)
    )
    .slice(0, 2);
}

function categoryIssueCount(category: AtsScoreCategory) {
  const missing = category.suggestions.length;
  const ratio = category.score / Math.max(category.maxScore, 1);
  return Math.max(missing, ratio >= 0.85 ? 0 : ratio >= 0.7 ? 1 : 2);
}

function categoryStatus(category: AtsScoreCategory) {
  const ratio = category.score / Math.max(category.maxScore, 1);
  if (ratio >= 0.85) return 'completed';
  if (ratio >= 0.7) return 'review';
  return 'top-fix';
}

function categoryRecruiterReason(category: AtsScoreCategory) {
  const reasons: Record<string, string> = {
    actionVerbs: 'Recruiters scan for active ownership. Strong verbs make each contribution easier to believe.',
    atsReadability: 'A readable, selectable PDF reduces the chance that ATS systems miss important information.',
    bulletQuality: 'Bullet quality shows whether the student can explain contribution, scope, tools, and result.',
    contactInformation: 'Recruiters should be able to contact the student without searching through the resume.',
    formattingRisk: 'Clean formatting keeps the resume professional and easier to parse.',
    jobDescriptionMatch: 'JD alignment helps recruiters quickly see fit for this specific opening.',
    levelReadiness: 'Career-stage fit shows whether the resume has the right kind of proof for this level.',
    quantifiedImpact: 'Metrics help recruiters compare impact and separate real work from generic responsibility.',
    resumeValidity: 'The file must first look like a real, readable resume before any score can be trusted.',
    roleKeywordMatch: 'Role keywords are most trusted when they appear with project or experience evidence.',
    sectionCompleteness: 'Standard sections help both recruiters and ATS systems classify the resume correctly.',
    sectionQuality: 'Strong sections make the resume easier to scan and reduce ambiguity.'
  };
  return reasons[category.key] ?? 'This check affects how confidently a recruiter can understand the resume.';
}

function categoryFixFormula(category: AtsScoreCategory) {
  const formulas: Record<string, string> = {
    actionVerbs: 'Start bullets with distinct verbs: Analyzed, Built, Improved, Led, Automated, Delivered.',
    bulletQuality: 'Use: Action + task + tool/method + measurable result.',
    contactInformation: 'Use one clean header with name, email, phone, LinkedIn, and portfolio if relevant.',
    jobDescriptionMatch: 'Mirror only truthful JD terms inside evidence bullets, not as a keyword dump.',
    levelReadiness: 'Match proof to the stage: projects for early talent, ownership and impact for experienced roles.',
    quantifiedImpact: 'Add count, percentage, time saved, users, revenue, accuracy, or volume handled.',
    roleKeywordMatch: 'Place target-role keywords inside projects and experience where you can prove them.',
    sectionCompleteness: 'Use clear headings: Summary, Skills, Projects, Experience, Education, Certifications.'
  };
  return formulas[category.key] ?? 'Make the section clearer, more specific, and easier to verify.';
}

function levelDescription(levelKey: string, fallback?: string) {
  if (fallback) return fallback;
  if (levelKey === 'internship') return 'For students targeting internships, live projects, or first corporate exposure.';
  if (levelKey === 'fresher') return 'For recent graduates building proof through projects, coursework, and internships.';
  if (levelKey === 'entry_level') return 'For candidates with early work experience or a first full-time role target.';
  if (levelKey === 'experienced') return 'For candidates who need stronger ownership, impact, and role depth.';
  return 'Choose this when it best matches your current career stage.';
}

function levelIcon(levelKey: string) {
  if (levelKey === 'internship') return <GraduationCap size={20} />;
  if (levelKey === 'fresher') return <Sparkles size={20} />;
  if (levelKey === 'entry_level') return <BriefcaseBusiness size={20} />;
  return <TrendingUp size={20} />;
}

async function downloadBrandedReport(studentName: string, analysis: Extract<AnalysisState, { status: 'ready' }>) {
  const title = `${studentName || 'Student'}_Skilled Sapiens ATS Report`;
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 42;
  const contentWidth = pageWidth - margin * 2;
  const bottomMargin = 58;
  const pageStreams: string[][] = [[]];
  let y = 0;
  let logoBytes: Uint8Array | null = null;
  try {
    const logoResponse = await fetch('/assets/ats-report-logo.jpg');
    if (logoResponse.ok) logoBytes = new Uint8Array(await logoResponse.arrayBuffer());
  } catch {
    logoBytes = null;
  }

  const current = () => pageStreams[pageStreams.length - 1];
  const fill = (hex: string) => {
    const value = hex.replace('#', '');
    const rgb = [value.slice(0, 2), value.slice(2, 4), value.slice(4, 6)].map((part) => parseInt(part, 16) / 255);
    return `${rgb.map((part) => part.toFixed(3)).join(' ')} rg`;
  };
  const stroke = (hex: string) => fill(hex).replace(' rg', ' RG');
  const rect = (x: number, bottom: number, width: number, height: number, fillColor = '#ffffff', strokeColor = '#e2e8f0') => {
    current().push(`q ${fill(fillColor)} ${stroke(strokeColor)} 0.8 w ${x.toFixed(1)} ${bottom.toFixed(1)} ${width.toFixed(1)} ${height.toFixed(1)} re B Q`);
  };
  const line = (x1: number, yy: number, x2: number, color = '#e2e8f0', width = 0.8) => {
    current().push(`q ${stroke(color)} ${width} w ${x1.toFixed(1)} ${yy.toFixed(1)} m ${x2.toFixed(1)} ${yy.toFixed(1)} l S Q`);
  };
  const emitText = (value: string, x: number, yy: number, fontSize = 10, font = 'F1', color = '#172033') => {
    current().push(`BT /${font} ${fontSize} Tf ${fill(color)} ${x.toFixed(1)} ${yy.toFixed(1)} Td (${escapePdfText(value)}) Tj ET`);
  };
  const drawPageChrome = () => {
    y = pageHeight - 42;
    if (logoBytes) {
      current().push(`q 30 0 0 30 ${margin} ${(pageHeight - 66).toFixed(1)} cm /Logo Do Q`);
    } else {
      rect(margin, pageHeight - 66, 30, 30, '#ffcc00', '#ffcc00');
      emitText('SS', margin + 7, pageHeight - 55, 11, 'F2', '#111827');
    }
    emitText('SKILLED SAPIENS', margin + 40, pageHeight - 48, 8, 'F2', '#ef3333');
    emitText('ATS Resume Score Report', margin + 40, pageHeight - 64, 14, 'F2', '#111827');
    emitText(formatDate(new Date().toISOString()), pageWidth - margin - 72, pageHeight - 55, 9, 'F1', '#64748b');
    line(margin, pageHeight - 82, pageWidth - margin, '#e2e8f0');
    y = pageHeight - 108;
  };
  const addPage = () => {
    pageStreams.push([]);
    drawPageChrome();
  };
  const ensureSpace = (height: number) => {
    if (y - height < bottomMargin) addPage();
  };
  const drawText = (value: string, x: number, fontSize = 10, font = 'F1', color = '#172033', gap = 6) => {
    ensureSpace(fontSize + gap + 2);
    emitText(value, x, y, fontSize, font, color);
    y -= fontSize + gap;
  };
  const paragraph = (value: string, x = margin, width = contentWidth, fontSize = 10, font = 'F1', color = '#475569', gap = 4) => {
    const lines = wrapPdfText(value, width, fontSize);
    lines.forEach((line) => {
      ensureSpace(fontSize + gap + 2);
      emitText(line, x, y, fontSize, font, color);
      y -= fontSize + gap;
    });
    y -= 4;
  };
  const section = (value: string) => {
    ensureSpace(34);
    y -= 4;
    drawText(value, margin, 13, 'F2', '#111827', 7);
    line(margin, y + 3, pageWidth - margin, '#e2e8f0');
    y -= 12;
  };
  const truncate = (value: string, maxLength = 260) => {
    const clean = pdfSafeText(value);
    return clean.length > maxLength ? `${clean.slice(0, maxLength - 3).trim()}...` : clean;
  };
  const drawSummaryCard = () => {
    const height = 116;
    ensureSpace(height + 16);
    rect(margin, y - height, contentWidth, height, '#fff7ed', '#fed7aa');
    current().push(`q ${fill('#ef3333')} ${margin} ${(y - height).toFixed(1)} 5 ${height.toFixed(1)} re f Q`);
    emitText(`${analysis.result.overallScore}`, margin + 24, y - 48, 40, 'F2', '#111827');
    emitText('/100', margin + 86, y - 48, 14, 'F2', '#64748b');
    emitText(bandLabel(analysis.result.overallScore), margin + 24, y - 72, 12, 'F2', '#ef3333');
    emitText(studentName || 'Student', margin + 160, y - 34, 16, 'F2', '#111827');
    let localY = y - 56;
    wrapPdfText(
      `${analysis.targetLabel ?? 'General resume quality'} | ${analysis.pageCount} page PDF | ${titleCaseLabel(analysis.scanMode)} scan`,
      contentWidth - 184,
      10
    )
      .slice(0, 2)
      .forEach((lineText) => {
        emitText(lineText, margin + 160, localY, 10, 'F1', '#475569');
        localY -= 13;
      });
    localY -= 4;
    wrapPdfText(
      'A recruiter-style summary of ATS readability, role alignment, score gaps, and practical next steps.',
      contentWidth - 184,
      10
    )
      .slice(0, 2)
      .forEach((lineText) => {
        emitText(lineText, margin + 160, localY, 10, 'F1', '#475569');
        localY -= 13;
      });
    y -= height + 22;
  };
  const drawScoreRow = (category: AtsScoreCategory) => {
    const score = categoryPercent(category);
    const tone = scoreTone(score);
    const scoreColor = tone === 'safe' ? '#137333' : tone === 'warning' ? '#8a5200' : '#b42318';
    const detailLines = wrapPdfText(truncate(category.signals.concat(category.suggestions).slice(0, 3).join(' | ') || categoryRecruiterReason(category), 170), contentWidth - 12, 9).slice(0, 2);
    const height = 34 + detailLines.length * 12;
    ensureSpace(height + 8);
    line(margin, y + 4, pageWidth - margin, '#edf2f7');
    emitText(category.label, margin, y - 10, 10.5, 'F2', '#172033');
    emitText(`${score}/100`, pageWidth - margin - 52, y - 10, 10.5, 'F2', scoreColor);
    let localY = y - 28;
    detailLines.forEach((lineText) => {
      emitText(lineText, margin, localY, 9, 'F1', '#64748b');
      localY -= 12;
    });
    y -= height;
  };
  const drawActionRow = (left: string, right: string, detail: string) => {
    const rightColumnWidth = 122;
    const leftColumnWidth = contentWidth - rightColumnWidth - 42;
    const titleLines = wrapPdfText(truncate(left, 110), leftColumnWidth, 10.5).slice(0, 2);
    const gainLines = wrapPdfText(truncate(right, 54), rightColumnWidth, 9.5).slice(0, 2);
    const detailLines = wrapPdfText(truncate(detail, 220), contentWidth - 28, 9.5);
    const headingHeight = Math.max(titleLines.length, gainLines.length) * 13;
    const height = 28 + headingHeight + detailLines.length * 12;
    ensureSpace(height + 8);
    rect(margin, y - height, contentWidth, height, '#ffffff', '#e5e7eb');
    let titleY = y - 20;
    titleLines.forEach((lineText) => {
      emitText(lineText, margin + 14, titleY, 10.5, 'F2', '#172033');
      titleY -= 13;
    });
    let gainY = y - 20;
    gainLines.forEach((lineText) => {
      emitText(lineText, pageWidth - margin - rightColumnWidth, gainY, 9.5, 'F2', '#8a5200');
      gainY -= 13;
    });
    let localY = y - 26 - headingHeight;
    detailLines.forEach((detailLine) => {
      emitText(detailLine, margin + 14, localY, 9.5, 'F1', '#64748b');
      localY -= 12;
    });
    y -= height + 10;
  };
  const drawBullet = (value: string) => {
    const bulletLines = wrapPdfText(truncate(value, 220), contentWidth - 18, 9.7);
    const height = bulletLines.length * 13 + 6;
    ensureSpace(height);
    emitText('-', margin, y, 10, 'F2', '#ef3333');
    let localY = y;
    bulletLines.forEach((lineText) => {
      emitText(lineText, margin + 14, localY, 9.7, 'F1', '#475569');
      localY -= 13;
    });
    y -= height;
  };
  const drawSuggestionCard = (item: AtsLineFeedback) => {
    const issueLines = wrapPdfText(truncate(item.issue, 190), contentWidth - 28, 9.5).slice(0, 2);
    const rewriteLines = wrapPdfText(truncate(item.suggestedRewrite, 260), contentWidth - 28, 9.5).slice(0, 3);
    const truthLines = wrapPdfText(truncate(item.truthfulAlternative, 210), contentWidth - 28, 9).slice(0, 2);
    const placeLines = wrapPdfText(truncate(item.bestLocation, 160), contentWidth - 28, 9).slice(0, 2);
    const height = 92 + (issueLines.length + rewriteLines.length + truthLines.length + placeLines.length) * 12;
    ensureSpace(height + 12);
    rect(margin, y - height, contentWidth, height, '#ffffff', '#dbeafe');
    current().push(`q ${fill('#2563eb')} ${margin} ${(y - height).toFixed(1)} 4 ${height.toFixed(1)} re f Q`);
    emitText(truncate(item.title, 58), margin + 14, y - 20, 11, 'F2', '#111827');
    emitText(`${item.effort} effort | ${item.expectedGain}`, pageWidth - margin - 128, y - 20, 9, 'F2', '#8a5200');
    let localY = y - 42;
    emitText('Issue', margin + 14, localY, 8.5, 'F2', '#64748b');
    localY -= 13;
    issueLines.forEach((lineText) => {
      emitText(lineText, margin + 14, localY, 9.5, 'F1', '#475569');
      localY -= 12;
    });
    localY -= 4;
    emitText('Suggested rewrite', margin + 14, localY, 8.5, 'F2', '#137333');
    localY -= 13;
    rewriteLines.forEach((lineText) => {
      emitText(lineText, margin + 14, localY, 9.5, 'F1', '#172033');
      localY -= 12;
    });
    localY -= 4;
    emitText('Use only if true', margin + 14, localY, 8.5, 'F2', '#8a5200');
    localY -= 13;
    truthLines.forEach((lineText) => {
      emitText(lineText, margin + 14, localY, 9, 'F1', '#8a5200');
      localY -= 11;
    });
    localY -= 4;
    emitText('Best place', margin + 14, localY, 8.5, 'F2', '#64748b');
    localY -= 13;
    placeLines.forEach((lineText) => {
      emitText(lineText, margin + 14, localY, 9, 'F1', '#475569');
      localY -= 11;
    });
    y -= height + 12;
  };

  drawPageChrome();
  drawSummaryCard();

  if (analysis.comparison) {
    section('Before / After Comparison');
    paragraph(`Previous ${titleCaseLabel(analysis.comparison.previousMode)} scan: ${analysis.comparison.previousScore}/100 on ${formatDate(analysis.comparison.previousDate)}. Current change: ${deltaLabel(analysis.comparison.delta)} points.`);
    paragraph(analysis.comparison.interpretation);
  }

  section('Score Breakdown');
  analysis.result.categories.forEach((category) => {
    drawScoreRow(category);
  });

  section('Priority Improvements');
  const fixes = analysis.result.improvementSummary.topFixes.length ? analysis.result.improvementSummary.topFixes : ['No priority fixes detected.'];
  fixes.slice(0, 6).forEach((fix) => drawBullet(fix));

  section('Recruiter-Focused Action Plan');
  const actions = analysis.result.improvementSummary.priorityActions.length
    ? analysis.result.improvementSummary.priorityActions
    : [{ action: 'Keep the resume clear and recruiter-readable.', expectedGain: '+0', recruiterValue: 'Maintains the current resume quality.' }];
  actions.forEach((item) => {
    drawActionRow(item.action, item.expectedGain, item.recruiterValue);
  });

  if (analysis.lineFeedback.length > 0) {
    section('Line-Level Suggestions');
    analysis.lineFeedback.slice(0, 5).forEach((item) => {
      drawSuggestionCard(item);
    });
  }

  ensureSpace(46);
  line(margin, y, pageWidth - margin, '#e2e8f0');
  y -= 18;
  paragraph('Generated by Skilled Sapiens LMS. Resume file, extracted resume text, and pasted job description text are not included in this report.', margin, contentWidth, 8.5, 'F1', '#64748b');

  const footerLinkText = 'https://skilledsapiens.com/';
  const footerLinkX = pageWidth / 2 - 52;
  const footerLinkY = 28;
  const footerLinkWidth = 104;
  const footerLinkHeight = 12;
  pageStreams.forEach((stream, index) => {
    stream.push(`q ${fill('#f8fafc')} 0 0 ${pageWidth.toFixed(1)} 50 re f Q`);
    stream.push(`q ${stroke('#e2e8f0')} 0.8 w ${margin.toFixed(1)} 49 m ${(pageWidth - margin).toFixed(1)} 49 l S Q`);
    stream.push(`BT /F2 8 Tf ${fill('#475569')} ${margin.toFixed(1)} ${footerLinkY.toFixed(1)} Td (Skilled Sapiens ATS Report) Tj ET`);
    stream.push(`BT /F1 8 Tf ${fill('#2563eb')} ${footerLinkX.toFixed(1)} ${footerLinkY.toFixed(1)} Td (${escapePdfText(footerLinkText)}) Tj ET`);
    stream.push(`BT /F1 8 Tf ${fill('#94a3b8')} ${(pageWidth - margin - 56).toFixed(1)} ${footerLinkY.toFixed(1)} Td (Page ${index + 1} of ${pageStreams.length}) Tj ET`);
  });

  const objects: string[] = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push('');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const logoObjectId = logoBytes ? objects.length + 1 : null;
  if (logoBytes) {
    objects.push(`<< /Type /XObject /Subtype /Image /Width 1080 /Height 1080 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logoBytes.length} >>\nstream\n${binaryStringFromBytes(logoBytes)}\nendstream`);
  }
  const pageObjectIds: number[] = [];
  pageStreams.forEach((stream) => {
    const content = stream.join('\n');
    const contentId = objects.length + 1;
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    const linkAnnotationId = objects.length + 1;
    objects.push(`<< /Type /Annot /Subtype /Link /Rect [${footerLinkX.toFixed(1)} ${(footerLinkY - 4).toFixed(1)} ${(footerLinkX + footerLinkWidth).toFixed(1)} ${(footerLinkY + footerLinkHeight).toFixed(1)}] /Border [0 0 0] /A << /S /URI /URI (${escapePdfText(footerLinkText)}) /NewWindow true >> >>`);
    const pageId = objects.length + 1;
    pageObjectIds.push(pageId);
    const xObjectResource = logoObjectId ? ` /XObject << /Logo ${logoObjectId} 0 R >>` : '';
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>${xObjectResource} >> /Annots [${linkAnnotationId} 0 R] /Contents ${contentId} 0 R >>`);
  });
  objects[1] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageObjectIds.length} >>`;

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const blob = new Blob([bytesFromBinaryString(pdf)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeFileName(title)}.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function AttemptsList({ attempts }: { attempts: Array<{ accessType: string; createdAt: string; id: string; overallScore: number; scanMode: string }> }) {
  if (attempts.length === 0) {
    return (
      <section className="ats-history-panel">
        <header>
          <span className="eyebrow">History</span>
          <h2>Recent scans</h2>
        </header>
        <p>No ATS scans are saved yet.</p>
      </section>
    );
  }

  return (
    <section className="ats-history-panel">
      <header>
        <span className="eyebrow">History</span>
        <h2>Recent scans</h2>
      </header>
      <div className="ats-history-list">
        {attempts.map((attempt) => (
          <article className="ats-history-row" key={attempt.id}>
            <div>
              <strong>{attempt.overallScore}/100</strong>
              <span>{formatDate(attempt.createdAt)}</span>
            </div>
            <div className="ats-history-row__badges">
              <StatusBadge tone={scoreTone(attempt.overallScore)}>{bandLabel(attempt.overallScore)}</StatusBadge>
              <span>{titleCaseLabel(attempt.scanMode)}</span>
              <span>{titleCaseLabel(attempt.accessType)}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function AtsScanOverlay({ fileName, scanMode, stepIndex }: { fileName?: string; scanMode: ScanMode; stepIndex: number }) {
  return (
    <div className="ats-scan-overlay" role="status" aria-live="polite">
      <div className="ats-scan-overlay__panel">
        <span className="eyebrow">{scanMode === 'advanced' ? 'Advanced ATS scan' : 'Basic ATS scan'}</span>
        <h2>Scanning your resume</h2>
        <p>{fileName ? fileName : 'Your PDF is being processed privately in this browser.'}</p>
        <div className="ats-scan-steps">
          {SCAN_STEPS.map((step, index) => {
            const isDone = index < stepIndex;
            const isActive = index === stepIndex;
            return (
              <div className={isDone ? 'ats-scan-step ats-scan-step--done' : isActive ? 'ats-scan-step ats-scan-step--active' : 'ats-scan-step'} key={step}>
                {isDone ? <CircleCheck size={22} /> : isActive ? <Loader2 className="workshop-action-spinner" size={22} /> : <Circle size={22} />}
                <span>{step}{isActive ? '...' : ''}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ScoreGuideModal({ analysis, onClose }: { analysis: Extract<AnalysisState, { status: 'ready' }>; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const strengths = topCategories(analysis.result, 'strong');
  const weak = topCategories(analysis.result, 'weak');
  const slides = [
    {
      eyebrow: 'Score guide',
      title: 'Your score is based on recruiter-style checks.',
      body: (
        <>
          <div className="ats-guide-summary">
            <div className="ats-guide-line ats-guide-line--good">
              <CheckCircle2 size={22} />
              <p>
                Your resume scored well in checks like <strong>{strengths.map((item) => item.label).join(' and ') || 'readability'}</strong>.
              </p>
            </div>
            <div className="ats-guide-line ats-guide-line--fix">
              <AlertCircle size={22} />
              <p>
                Your fastest improvements are in <strong>{weak.map((item) => item.label).join(' and ') || 'resume structure'}</strong>.
              </p>
            </div>
          </div>
          <p>We will show each issue with the recruiter reason, the exact improvement area, and the expected score impact.</p>
        </>
      )
    },
    {
      eyebrow: 'How to improve',
      title: 'Each recommendation explains what a recruiter will notice.',
      body: (
        <div className="ats-guide-example">
          <span>Example feedback</span>
          <blockquote>“Worked on reports and helped the team.”</blockquote>
          <p>
            This is too generic. A stronger line tells the recruiter the task, method, and measurable outcome.
          </p>
          <blockquote className="ats-guide-example__rewrite">
            Built weekly Excel reporting dashboards for 4 managers, reducing manual reporting time by 6 hours.
          </blockquote>
        </div>
      )
    },
    {
      eyebrow: 'Report view',
      title: 'Use the left checklist, read the fix, then compare it with your resume.',
      body: (
        <div className="ats-guide-checks">
          <article>
            <FileSearch size={22} />
            <strong>Score areas</strong>
            <span>Readability, contact details, sections, bullets, impact, role/JD match.</span>
          </article>
          <article>
            <ListChecks size={22} />
            <strong>Action plan</strong>
            <span>Prioritized fixes with realistic score gain from recruiter POV.</span>
          </article>
          <article>
            <ShieldCheck size={22} />
            <strong>Private scan</strong>
            <span>PDF preview and resume text stay temporary in your browser.</span>
          </article>
        </div>
      )
    }
  ];
  const current = slides[step] ?? slides[0];
  return (
    <div className="ats-guide-backdrop" role="dialog" aria-modal="true" aria-labelledby="ats-guide-title">
      <section className="ats-guide-modal">
        <button aria-label="Close score guide" className="ats-guide-close" onClick={onClose} type="button">
          <X size={18} />
        </button>
        <span className="eyebrow">{current.eyebrow}</span>
        <h2 id="ats-guide-title">{current.title}</h2>
        {current.body}
        <div className="ats-guide-footer">
          <div className="ats-guide-dots" aria-label="Score guide progress">
            {slides.map((slide, index) => (
              <button aria-label={`Open guide step ${index + 1}`} className={index === step ? 'is-active' : ''} key={slide.title} onClick={() => setStep(index)} type="button" />
            ))}
          </div>
          <div className="ats-guide-actions">
            {step > 0 ? (
              <button className="segmented-button" onClick={() => setStep((currentStep) => Math.max(0, currentStep - 1))} type="button">
                Back
              </button>
            ) : null}
            <button className="student-action student-action--primary" onClick={step === slides.length - 1 ? onClose : () => setStep((currentStep) => Math.min(slides.length - 1, currentStep + 1))} type="button">
              {step === slides.length - 1 ? 'Go to my report' : 'Next'}
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function AtsUnlockModal({
  isPending,
  onClose,
  onUnlockNow,
  priceText
}: {
  isPending: boolean;
  onClose: () => void;
  onUnlockNow: () => void;
  priceText: string;
}) {
  const benefits = [
    'Job description match and role fit scoring',
    'Role keyword evidence checks, not just keyword stuffing',
    'Deep line-level resume coaching suggestions',
    'Sample CV points and role keywords to improve faster',
    'Branded PDF report download after the advanced scan'
  ];
  const steps = ['Complete payment securely on Razorpay.', 'One advanced scan credit is added to your account.', 'Return here, choose Advanced match, and upload the resume again.', 'The full ATS report is generated from that advanced scan.'];

  return (
    <div className="ats-guide-backdrop" role="dialog" aria-modal="true" aria-labelledby="ats-unlock-title">
      <section className="ats-unlock-modal">
        <button aria-label="Close unlock details" className="ats-guide-close" disabled={isPending} onClick={onClose} type="button">
          <X size={18} />
        </button>
        <div className="ats-unlock-modal__content">
          <div className="ats-unlock-modal__copy">
            <span className="eyebrow">Advanced ATS report</span>
            <h2 id="ats-unlock-title">Unlock your full resume report</h2>
            <p>Get the role-specific checks that help you understand what to fix before applying.</p>
            <div className="ats-unlock-price">
              <BadgeIndianRupee size={18} />
              <span>{priceText}</span>
            </div>
            <ul className="ats-unlock-benefits">
              {benefits.map((benefit) => (
                <li key={benefit}>
                  <CheckCircle2 size={18} />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="ats-unlock-modal__steps">
            <span className="eyebrow">How it works</span>
            <h3>Payment unlocks a scan credit</h3>
            <ol>
              {steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <div className="ats-unlock-note">
              <LockKeyhole size={16} />
              <span>Payment does not auto-generate the report. The report is created when you run the next Advanced match scan.</span>
            </div>
          </div>
        </div>
        <footer className="ats-unlock-modal__actions">
          <button className="student-action student-action--primary" disabled={isPending} onClick={onUnlockNow} type="button">
            {isPending ? <Loader2 className="workshop-action-spinner" size={16} /> : <LockKeyhole size={16} />}
            {isPending ? 'Preparing checkout...' : 'Unlock now'}
          </button>
        </footer>
      </section>
    </div>
  );
}

function AtsReportWorkspace({
  analysis,
  onClose,
  onDownloadReport,
  onUnlockAdvancedPending,
  onShowGuide,
  onUnlockAdvanced
}: {
  analysis: Extract<AnalysisState, { status: 'ready' }>;
  onClose: () => void;
  onDownloadReport: () => void;
  onUnlockAdvancedPending: boolean;
  onShowGuide: () => void;
  onUnlockAdvanced: () => void;
}) {
  const topFixes = useMemo(
    () => [...analysis.result.categories].sort((left, right) => left.score / Math.max(left.maxScore, 1) - right.score / Math.max(right.maxScore, 1)),
    [analysis.result.categories]
  );
  const [activeCategoryKey, setActiveCategoryKey] = useState(topFixes[0]?.key ?? analysis.result.categories[0]?.key ?? '');
  const activeCategory = analysis.result.categories.find((category) => category.key === activeCategoryKey) ?? topFixes[0] ?? analysis.result.categories[0];
  const categoryLineFeedback = analysis.lineFeedback.filter((item) => {
    if (!activeCategory) return false;
    if (item.categoryKey === activeCategory.key) return true;
    return activeCategory.key === 'bulletQuality' && ['actionVerbs', 'quantifiedImpact'].includes(item.categoryKey);
  });
  const relevantLineFeedback = categoryLineFeedback.length > 0 ? categoryLineFeedback : analysis.lineFeedback.slice(0, 6);
  const [activeFeedbackId, setActiveFeedbackId] = useState(relevantLineFeedback[0]?.id ?? '');
  const [copiedItemId, setCopiedItemId] = useState('');
  const visibleLineFeedback = analysis.scanMode === 'advanced' ? relevantLineFeedback : relevantLineFeedback.slice(0, 2);
  const activeFeedback = visibleLineFeedback.find((item) => item.id === activeFeedbackId) ?? visibleLineFeedback[0];
  const hiddenLineFeedbackCount = Math.max(0, relevantLineFeedback.length - visibleLineFeedback.length);
  const completedCategories = analysis.result.categories.filter((category) => categoryStatus(category) === 'completed');
  const issueCategories = analysis.result.categories.filter((category) => categoryStatus(category) !== 'completed');
  const isPremiumUnlocked = analysis.scanMode === 'advanced';
  const previewScrollRef = useRef<HTMLDivElement | null>(null);
  const pdfHighlights = useMemo(() => buildPdfHighlights(analysis.previewPages, visibleLineFeedback), [analysis.previewPages, visibleLineFeedback]);
  const activeHighlight = activeFeedback ? pdfHighlights.find((item) => item.feedbackId === activeFeedback.id) : undefined;
  const cvPointExamples = useMemo(() => buildCvPointExamples(analysis.roleKeywords, analysis.targetLabel, analysis.roleSampleCvPoints), [analysis.roleKeywords, analysis.roleSampleCvPoints, analysis.targetLabel]);
  const keywordGroups = useMemo(
    () => [
      { description: 'Consider adding these only where you have real project or experience evidence.', items: analysis.keywordRecommendations.filter((item) => item.status === 'missing'), label: 'Missing from resume' },
      { description: 'Already detected in your resume. Keep them attached to proof, tools, or outcomes.', items: analysis.keywordRecommendations.filter((item) => item.status === 'found'), label: 'Found in resume' },
      { description: 'General role terms. Add only if they truthfully match your work.', items: analysis.keywordRecommendations.filter((item) => item.status === 'use-with-evidence'), label: 'Use with evidence' }
    ].filter((group) => group.items.length > 0),
    [analysis.keywordRecommendations]
  );

  function activateFeedback(id: string) {
    setActiveFeedbackId(id);
    window.setTimeout(() => {
      previewScrollRef.current?.querySelector(`[data-feedback-id="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  }

  async function copyText(value: string, itemId: string) {
    try {
      await navigator.clipboard?.writeText(value);
      setCopiedItemId(itemId);
      window.setTimeout(() => setCopiedItemId((current) => (current === itemId ? '' : current)), 1600);
    } catch {
      setCopiedItemId('');
    }
  }

  function copySuggestedRewrite() {
    if (!activeFeedback) return;
    void copyText(activeFeedback.suggestedRewrite, activeFeedback.id);
  }

  return (
    <section className="ats-report-fullscreen" aria-label="ATS score result">
      <header className="ats-report-brandbar">
        <div>
          <span>Skilled Sapiens</span>
          <strong>ATS Resume Score</strong>
        </div>
        <div className="ats-report-brandbar__actions">
          <button className="segmented-button" onClick={onShowGuide} type="button">
            How it works
          </button>
          <button aria-label="Exit ATS report" className="ats-report-close" onClick={onClose} type="button">
            <X size={20} />
          </button>
        </div>
      </header>
      <div className="ats-report-workspace">
      <aside className="ats-report-rail">
        <div
          className="ats-score-ring"
          data-tone={scoreTone(analysis.result.overallScore)}
          style={{
            background: `radial-gradient(circle at center, #fff 60%, transparent 61%), conic-gradient(#e7835f ${analysis.result.overallScore}%, #edf1f7 0)`
          }}
        >
          <strong>{analysis.result.overallScore}</strong>
          <span>Overall</span>
        </div>
        <StatusBadge tone={scoreTone(analysis.result.overallScore)}>{bandLabel(analysis.result.overallScore)}</StatusBadge>
        <div className="ats-report-rail__meta">
          <span>{analysis.pageCount} page PDF</span>
          <span>{analysis.targetLabel ?? 'General resume review'}</span>
          <span>{analysis.scanMode === 'advanced' ? 'Advanced scan' : 'Basic scan'}</span>
        </div>
        <nav className="ats-fix-nav" aria-label="ATS issue navigation">
          <span>Top fixes</span>
          {issueCategories.slice(0, 6).map((category) => (
            <button className={activeCategory.key === category.key ? 'ats-fix-nav__item ats-fix-nav__item--active' : 'ats-fix-nav__item'} key={category.key} onClick={() => setActiveCategoryKey(category.key)} type="button">
              <span>{category.label}</span>
              <strong>{categoryPercent(category)}</strong>
            </button>
          ))}
          <span>Completed</span>
          {completedCategories.slice(0, 4).map((category) => (
            <button className={activeCategory.key === category.key ? 'ats-fix-nav__item ats-fix-nav__item--active' : 'ats-fix-nav__item'} key={category.key} onClick={() => setActiveCategoryKey(category.key)} type="button">
              <span>{category.label}</span>
              <strong>{categoryPercent(category)}</strong>
            </button>
          ))}
          {!isPremiumUnlocked ? (
            <>
              <span>Locked premium</span>
              {LOCKED_PREMIUM_CHECKS.map((item) => (
                <button className="ats-fix-nav__item ats-fix-nav__item--locked" disabled={onUnlockAdvancedPending} key={item.key} onClick={onUnlockAdvanced} type="button">
                  <span>{item.title}</span>
                  <LockKeyhole size={14} />
                </button>
              ))}
            </>
          ) : null}
        </nav>
        {isPremiumUnlocked && analysis.saved ? (
          <button className="student-action student-action--primary ats-report-unlock" onClick={onDownloadReport} type="button">
            <Download size={16} />
            Download report
          </button>
        ) : !isPremiumUnlocked ? (
          <button className="student-action student-action--primary ats-report-unlock" disabled={onUnlockAdvancedPending} onClick={onUnlockAdvanced} type="button">
            {onUnlockAdvancedPending ? <Loader2 className="workshop-action-spinner" size={16} /> : <LockKeyhole size={16} />}
            {onUnlockAdvancedPending ? 'Preparing checkout...' : 'Unlock full report'}
          </button>
        ) : null}
      </aside>

      <main className="ats-report-main">
        <section className="ats-report-card ats-report-home">
          <header>
            <div>
              <span className="eyebrow">Latest score</span>
              <h2>Your resume scored {analysis.result.overallScore} out of 100.</h2>
              <p>{analysis.fileName}</p>
            </div>
          </header>
          <div className="ats-score-scale" aria-hidden="true">
            <span style={{ left: `${analysis.result.overallScore}%` }} />
          </div>
          <p className="ats-score-note">
            Your score is based on resume validity, parser readability, contact details, sections, bullet quality, impact proof, and {analysis.scanMode === 'advanced' ? 'role/JD alignment.' : 'general recruiter checks.'}
          </p>
        </section>

        {activeCategory ? (
          <section className="ats-report-card ats-issue-card">
            <header>
              <div>
                <span className="eyebrow">{categoryStatus(activeCategory) === 'completed' ? 'Completed check' : 'Improvement area'}</span>
                <h2>{activeCategory.label}</h2>
                <p>{categoryRecruiterReason(activeCategory)}</p>
              </div>
              <div className="ats-category-score">
                <strong>{categoryPercent(activeCategory)}</strong>
                <span>/100</span>
              </div>
            </header>
            <div className="ats-issue-grid">
              <article>
                <span>{categoryIssueCount(activeCategory)} issue{categoryIssueCount(activeCategory) === 1 ? '' : 's'} found</span>
                <ul>
                  {(activeCategory.suggestions.length ? activeCategory.suggestions : activeCategory.signals).slice(0, 4).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
              <article>
                <span>How to fix</span>
                <p>{categoryFixFormula(activeCategory)}</p>
              </article>
            </div>
          </section>
        ) : null}

        {!isPremiumUnlocked ? (
          <section className="ats-report-card ats-premium-lock-panel" aria-label="Locked premium ATS checks">
            <header>
              <div>
                <span className="eyebrow">Premium checks</span>
                <h2>Unlock the full ATS report</h2>
                <p>Basic scan shows your core resume health. Advanced scan adds the checks recruiters use when matching a resume to a real role.</p>
              </div>
              <button className="student-action student-action--primary" onClick={onUnlockAdvanced} type="button">
                <LockKeyhole size={16} />
                Unlock premium features
              </button>
            </header>
            <div className="ats-payment-guidance">
              <CheckCircle2 size={18} />
              <div>
                <strong>How unlock works</strong>
                <span>Payment adds one advanced scan credit. After checkout, return here and run Advanced match to generate the full report.</span>
              </div>
            </div>
            <div className="ats-premium-lock-grid">
              {LOCKED_PREMIUM_CHECKS.map((item) => (
                <article key={item.key}>
                  <LockKeyhole size={18} />
                  <strong>{item.title}</strong>
                  <span>{item.description}</span>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {analysis.result.improvementSummary.priorityActions.length > 0 ? (
          <section className="ats-report-card ats-action-plan" aria-label="Recruiter-focused action plan">
            <header>
              <span className="eyebrow">Priority action plan</span>
              <h3>What to improve first</h3>
            </header>
            <div>
              {analysis.result.improvementSummary.priorityActions.map((item) => (
                <article key={item.action}>
                  <div>
                    <strong>{item.action}</strong>
                    <span>{item.recruiterValue}</span>
                  </div>
                  <small>{item.expectedGain}</small>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {analysis.comparison ? (
          <section className="ats-report-card ats-comparison-panel" aria-label="Before and after resume score comparison">
            <header>
              <div>
                <span className="eyebrow">Before / after</span>
                <h3>{deltaLabel(analysis.comparison.delta)} point change</h3>
                <p>
                  Compared with your previous {analysis.comparison.previousMode} scan from {formatDate(analysis.comparison.previousDate)}.
                </p>
              </div>
              <strong>
                {analysis.comparison.previousScore}/100 {'->'} {analysis.result.overallScore}/100
              </strong>
            </header>
            <p>{analysis.comparison.interpretation}</p>
          </section>
        ) : null}

        <section className={analysis.saved ? 'ats-alert ats-alert--success' : 'ats-alert ats-alert--warning'}>
          {analysis.saved ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{analysis.saved ? 'Score history saved. Resume text and JD text were discarded after analysis.' : analysis.saveMessage}</span>
        </section>
      </main>

      <aside className="ats-resume-preview">
        <header>
          <div>
            <h2>Your resume</h2>
          </div>
        </header>
        <div className="ats-resume-preview__paper" ref={previewScrollRef}>
          {analysis.previewPages.length > 0
            ? analysis.previewPages.map((page) => (
                <div className="ats-pdf-page" key={page.pageNumber} style={{ aspectRatio: `${page.width} / ${page.height}` }}>
                  <img alt={`Resume page ${page.pageNumber}`} src={page.image} />
                  <div className="ats-pdf-highlight-layer" aria-hidden="true">
                    {pdfHighlights.filter((highlight) => highlight.pageNumber === page.pageNumber).map((highlight) => {
                      const isActive = highlight.feedbackId === activeHighlight?.feedbackId;
                      return (
                        <span
                          className={isActive ? `ats-pdf-highlight ats-pdf-highlight--${highlight.severity} ats-pdf-highlight--active` : `ats-pdf-highlight ats-pdf-highlight--${highlight.severity}`}
                          data-feedback-id={highlight.feedbackId}
                          key={`${highlight.feedbackId}-${highlight.pageNumber}`}
                          style={{
                            height: `${(highlight.height / page.height) * 100}%`,
                            left: `${(highlight.x / page.width) * 100}%`,
                            top: `${(highlight.y / page.height) * 100}%`,
                            width: `${(highlight.width / page.width) * 100}%`
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              ))
            : analysis.previewImages.length > 0
              ? analysis.previewImages.map((image, index) => <img alt={`Resume page ${index + 1}`} key={image} src={image} />)
              : analysis.previewLines.slice(0, 28).map((line, index) => <p className="ats-preview-line" key={`${line}-${index}`}>{line}</p>)}
        </div>
      </aside>

      {relevantLineFeedback.length > 0 ? (
        <section className="ats-report-card ats-line-feedback-panel ats-line-feedback-panel--wide" aria-label="Line-level feedback">
          <header>
            <div>
              <span className="eyebrow">Inline suggestions</span>
              <h3>{categoryLineFeedback.length > 0 ? 'What to fix in this check' : 'Resume coaching suggestions'}</h3>
              <p>Select a coaching item to see the resume line, a better rewrite, a safer truthful alternative, and prompts to help you write from real experience.</p>
            </div>
            <span>{relevantLineFeedback.length} line check{relevantLineFeedback.length === 1 ? '' : 's'}</span>
          </header>
          <div className="ats-line-feedback-layout">
            <div className="ats-line-feedback-list">
              {visibleLineFeedback.slice(0, 5).map((item) => (
                <button className={activeFeedback?.id === item.id ? 'ats-line-feedback-item ats-line-feedback-item--active' : 'ats-line-feedback-item'} key={item.id} onClick={() => activateFeedback(item.id)} type="button">
                  <strong>{item.title}</strong>
                  <span>{item.issue}</span>
                  <small>{item.effort} effort | {item.expectedGain}</small>
                </button>
              ))}
              {hiddenLineFeedbackCount > 0 ? (
                <button className="ats-line-feedback-item ats-line-feedback-item--locked" onClick={onUnlockAdvanced} type="button">
                  <strong>{hiddenLineFeedbackCount} more line checks locked</strong>
                  <span>Unlock advanced scan to see the rest of the line-level feedback.</span>
                  <small>Premium</small>
                </button>
              ) : null}
            </div>
            {activeFeedback ? (
              <article className="ats-line-feedback-detail">
                <header>
                  <span className={`ats-severity ats-severity--${activeFeedback.severity}`}>{activeFeedback.severity} priority</span>
                  <strong>{activeFeedback.effort} effort | {activeFeedback.expectedGain} score impact</strong>
                </header>
                <div className="ats-line-feedback-callout">
                  <strong>Issue found</strong>
                  <p>{activeFeedback.issue}</p>
                </div>
                <div className="ats-line-feedback-before-after">
                  <section>
                    <strong>{activeFeedback.categoryKey === 'roleKeywordMatch' ? 'Evidence missing' : 'Current line'}</strong>
                    <blockquote>{lineFeedbackContextText(activeFeedback)}</blockquote>
                  </section>
                  <section>
                    <strong>Suggested rewrite</strong>
                    <blockquote>{activeFeedback.suggestedRewrite}</blockquote>
                  </section>
                </div>
                <section className="ats-line-feedback-truth">
                  <strong>Use only if true</strong>
                  <p>{activeFeedback.truthfulAlternative}</p>
                </section>
                <section className="ats-suggestion-action" aria-label="Suggestion action">
                  <div>
                    <strong>Ready to use</strong>
                    <p>Copy the rewrite, then adjust names, numbers, tools, and outcomes before adding it to your resume.</p>
                  </div>
                  <button className="student-action student-action--primary" onClick={copySuggestedRewrite} type="button">
                    {copiedItemId === activeFeedback.id ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                    {copiedItemId === activeFeedback.id ? 'Copied' : 'Copy suggested line'}
                  </button>
                  <details>
                    <summary>
                      <ShieldCheck size={15} />
                      Check before using this
                    </summary>
                    <ul>
                      {activeFeedback.coachingPrompt.map((prompt) => (
                        <li key={prompt}>{prompt}</li>
                      ))}
                    </ul>
                  </details>
                </section>
                <div className="ats-line-feedback-explainer-grid">
                  <section>
                    <strong>Recruiter signal</strong>
                    <p>{activeFeedback.recruiterReason}</p>
                  </section>
                  <section>
                    <strong>Best place to add</strong>
                    <p>{activeFeedback.bestLocation}</p>
                  </section>
                  <section>
                    <strong>How to apply</strong>
                    <ul>
                      {activeFeedback.applySteps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ul>
                  </section>
                  <section>
                    <strong>Think back</strong>
                    <ul>
                      {activeFeedback.coachingPrompt.map((prompt) => (
                        <li key={prompt}>{prompt}</li>
                      ))}
                    </ul>
                  </section>
                </div>
              </article>
            ) : null}
          </div>
          <section className="ats-role-boosters" aria-label="Role resume examples and keywords">
            <header>
              <div>
                <span className="eyebrow">Examples & keywords</span>
                <h3>Role resume boosters</h3>
                <p>Use these as inspiration only. Replace sample numbers with your real numbers and keep only claims you can explain in an interview.</p>
              </div>
            </header>
            <div className="ats-role-boosters__grid">
              <article className="ats-cv-examples">
                <header>
                  <strong>Sample CV points</strong>
                  <span>{cvPointExamples.length} examples</span>
                </header>
                <div>
                  {cvPointExamples.map((example) => (
                    <section className="ats-cv-example-row" key={example.id}>
                      <div>
                        <span>{example.actionVerb}</span>
                        <small>{example.metric}</small>
                      </div>
                      <p>{example.point}</p>
                      <div className="ats-cv-example-row__tags">
                        {example.keywords.slice(0, 3).map((keyword) => (
                          <em key={`${example.id}-${keyword}`}>{keyword}</em>
                        ))}
                      </div>
                      <button className="segmented-button" onClick={() => void copyText(example.point, example.id)} type="button">
                        {copiedItemId === example.id ? <CheckCircle2 size={15} /> : <Copy size={15} />}
                        {copiedItemId === example.id ? 'Copied' : 'Copy'}
                      </button>
                    </section>
                  ))}
                </div>
              </article>
              <article className="ats-keyword-recommendations">
                <header>
                  <strong>Role keywords to consider</strong>
                  <span>{analysis.keywordRecommendations.length} keywords</span>
                </header>
                <div className="ats-keyword-groups">
                  {keywordGroups.map((group) => (
                    <section className="ats-keyword-group" key={group.label}>
                      <header>
                        <strong>{group.label}</strong>
                        <span>{group.items.length}</span>
                      </header>
                      <p>{group.description}</p>
                      <ul>
                        {group.items.map((item) => (
                          <li key={item.keyword}>{item.keyword}</li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              </article>
            </div>
          </section>
        </section>
      ) : null}
      </div>
    </section>
  );
}

export function StudentAtsResumeScorePage() {
  const overviewQuery = useStudentAtsResumeScore();
  const createAttempt = useCreateStudentAtsAttempt();
  const createPackageOrder = useCreateStudentAtsPackageOrder();
  const syncAtsCredits = useSyncStudentAtsCredits();
  const recordReportDownload = useRecordStudentAtsReportDownload();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const packagePanelRef = useRef<HTMLDivElement | null>(null);
  const syncedStudentRef = useRef('');
  const [analysis, setAnalysis] = useState<AnalysisState>({ status: 'idle' });
  const [orderMessage, setOrderMessage] = useState<{ checkoutUrl?: string; tone: 'error' | 'success'; text: string } | null>(null);
  const [pendingPackageId, setPendingPackageId] = useState<string | null>(null);
  const [scanMode, setScanMode] = useState<ScanMode>('basic');
  const [scanStepIndex, setScanStepIndex] = useState(0);
  const [showScoreGuide, setShowScoreGuide] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [selectedLevelId, setSelectedLevelId] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const overview = overviewQuery.data;
  const roles = overview?.roles ?? [];
  const levels = overview?.roleLevels ?? [];
  const activeRoleId = selectedRoleId || roles[0]?.id || '';
  const activeLevelId = selectedLevelId || levels[1]?.id || levels[0]?.id || '';
  const selectedRole = roles.find((role) => role.id === activeRoleId);
  const selectedLevel = levels.find((level) => level.id === activeLevelId);
  const selectedProfile = overview?.roleProfiles.find((profile) => profile.roleId === activeRoleId && profile.levelId === activeLevelId);
  const canUseFreeScan = (overview?.freeAttemptsRemaining ?? 0) > 0;
  const paidPackages = overview?.packages ?? [];
  const hasPaidCredits = (overview?.paidCreditsRemaining ?? 0) > 0;
  const hasCareerStage = levels.length === 0 || Boolean(selectedLevel);
  const canUpload = scanMode === 'basic' ? canUseFreeScan && hasCareerStage : hasPaidCredits && Boolean(selectedRole && selectedLevel && selectedProfile);
  const uploadCtaLabel = scanMode === 'advanced' ? 'Use paid credit' : 'Choose PDF';
  const blockedCtaLabel = scanMode === 'basic' && !canUseFreeScan ? 'Unlock premium features' : scanMode === 'basic' ? 'Choose career stage' : 'Unlock advanced scan';

  useEffect(() => {
    const studentEmail = overview?.student.email ?? '';
    if (!studentEmail || syncedStudentRef.current === studentEmail) return;
    syncedStudentRef.current = studentEmail;
    void syncAtsCredits.mutateAsync().catch(() => {
      syncedStudentRef.current = '';
    });
  }, [overview?.student.email, syncAtsCredits]);

  const summary = useMemo(
    () => ({
      attempts: overview?.attempts.length ?? 0,
      freeLimit: overview?.freeAttemptsLimit ?? 2,
      freeRemaining: overview?.freeAttemptsRemaining ?? 0,
      paidCredits: overview?.paidCreditsRemaining ?? 0,
      used: overview?.freeAttemptsUsed ?? 0
    }),
    [overview]
  );
  const unlockReportPackage = useMemo(() => {
    const packages = paidPackages.filter((item) => Number(item.amount) > 0);
    return (
      packages.find((item) => Number(item.amount) === 249 && item.currency === 'INR' && item.scanCredits === 1) ??
      packages.find((item) => item.packageKey === 'ats_single_scan') ??
      packages.find((item) => item.scanCredits === 1) ??
      packages[0]
    );
  }, [paidPackages]);
  const unlockReportPriceText = unlockReportPackage ? `${unlockReportPackage.currency} ${Number(unlockReportPackage.amount).toLocaleString()}` : 'Paid advanced scan';

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setScanStepIndex(0);
    setShowScoreGuide(false);
    setAnalysis({ fileName: file.name, status: 'processing' });

    try {
      if (scanMode === 'basic' && !canUseFreeScan) {
        setAnalysis({ message: 'Your two free ATS Resume Score scans are already used. Buy a paid package to continue.', status: 'error' });
        return;
      }
      if (scanMode === 'advanced' && !hasPaidCredits) {
        setAnalysis({ message: 'Advanced ATS analysis requires a paid scan credit.', status: 'error' });
        return;
      }
      if (scanMode === 'advanced' && (!selectedRole || !selectedLevel || !selectedProfile)) {
        setAnalysis({ message: 'Select a target role and level before running an advanced ATS scan.', status: 'error' });
        return;
      }
      if (!selectedLevel && levels.length > 0) {
        setAnalysis({ message: 'Choose your career stage before running the ATS scan.', status: 'error' });
        return;
      }

      const extractionPromise = extractResumeTextFromPdf(file);
      await playScanSequence(setScanStepIndex);
      const extracted = await extractionPromise;
      if (extracted.text.length < 500) {
        setAnalysis({
          message: 'This PDF did not expose enough selectable resume text. Export a text-based PDF, not a scanned image, and try again.',
          status: 'error'
        });
        return;
      }

      const result =
        scanMode === 'advanced' && selectedRole && selectedLevel && selectedProfile
          ? analyzeAdvancedResume(extracted.text, {
              jobDescription,
              levelKey: selectedLevel.levelKey,
              levelName: selectedLevel.levelName,
              roleName: selectedRole.roleName,
              roleProfile: selectedProfile,
              scoringPolicy: overview?.scoringVersion?.weights,
              scoringWeights: overview?.scoringVersion?.weights
            })
          : analyzeBasicResume(extracted.text, { scoringPolicy: overview?.scoringVersion?.freeScanWeights });

      const jdMatch = result.categories.find((category) => category.key === 'jobDescriptionMatch');
      const targetLabel = scanMode === 'advanced' && selectedRole && selectedLevel ? `${selectedRole.roleName} · ${selectedLevel.levelName}` : selectedLevel ? `${selectedLevel.levelName} resume review` : undefined;
      const comparison = buildScoreComparison(result, overview?.attempts ?? [], scanMode);
      const previewLines = buildResumePreviewLines(extracted.text);
      const roleKeywords = scanMode === 'advanced' ? selectedProfile?.keywords ?? [] : [];
      const roleSampleCvPoints = scanMode === 'advanced' ? selectedProfile?.sampleCvPoints ?? [] : [];
      const keywordRecommendations = buildKeywordRecommendations(extracted.text, roleKeywords);
      const lineFeedback = buildLineFeedback(extracted.text, roleKeywords);

      try {
        const savedAttempt = await createAttempt.mutateAsync({
          accessType: scanMode === 'advanced' ? 'paid' : 'free',
          breakdown: buildBreakdown(result, { careerLevel: selectedLevel?.levelName, targetLabel, scanMode }, scanMode === 'advanced' && jobDescription.trim().length > 0),
          improvementSummary: buildImprovementSummary(result, scanMode === 'advanced' && jobDescription.trim().length > 0),
          jdMatchScore: jdMatch ? categoryPercent(jdMatch) : undefined,
          jdMatchUsed: scanMode === 'advanced' && jobDescription.trim().length > 0,
          levelId: activeLevelId || undefined,
          overallScore: result.overallScore,
          roleId: scanMode === 'advanced' ? activeRoleId : undefined,
          scanMode
        });
        setAnalysis({ attemptId: savedAttempt.id, comparison, fileName: file.name, keywordRecommendations, lineFeedback, pageCount: extracted.pageCount, previewImages: extracted.previewImages, previewLines, previewPages: extracted.previewPages, result, roleKeywords, roleSampleCvPoints, saved: true, scanMode, status: 'ready', targetLabel });
        setShowScoreGuide(true);
      } catch (error) {
        setAnalysis({
          comparison,
          fileName: file.name,
          keywordRecommendations,
          lineFeedback,
          pageCount: extracted.pageCount,
          previewImages: extracted.previewImages,
          previewPages: extracted.previewPages,
          previewLines,
          result,
          roleKeywords,
          roleSampleCvPoints,
          saved: false,
          saveMessage: error instanceof Error ? error.message : 'Score was calculated, but history could not be saved.',
          scanMode,
          status: 'ready',
          targetLabel
        });
        setShowScoreGuide(true);
      }
    } catch (error) {
      setAnalysis({ message: error instanceof Error ? error.message : 'Resume could not be analyzed.', status: 'error' });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDownloadReport() {
    if (analysis.status !== 'ready' || analysis.scanMode !== 'advanced') return;
    const studentName = overview?.student.fullName || 'Student';
    await downloadBrandedReport(studentName, analysis);
    if (analysis.attemptId) {
      try {
        await recordReportDownload.mutateAsync({ attemptId: analysis.attemptId });
      } catch {
        // Report generation is browser-only; analytics failure should not block the student's download.
      }
    }
  }

  async function handleCreatePackageOrder(packageId: string, options: { openCheckout?: boolean } = {}) {
    setOrderMessage(null);
    setPendingPackageId(packageId);
    try {
      const order = await createPackageOrder.mutateAsync({ packageId });
      const checkoutUrl = order.checkoutUrl ?? order.paymentLink;
      setOrderMessage({
        checkoutUrl,
        tone: 'success',
        text: checkoutUrl
          ? `Payment order ${order.orderId ?? order.id} is ready. After payment, 1 advanced scan credit will be added. Return here, choose Advanced match, and scan again to generate the full report.`
          : `Payment order ${order.orderId ?? order.id} is ready, but checkout could not be opened. Please contact support.`
      });
      if (checkoutUrl && options.openCheckout) {
        window.location.assign(checkoutUrl);
      }
    } catch (error) {
      setOrderMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Payment order could not be created.' });
    } finally {
      setPendingPackageId(null);
    }
  }

  function handleUnlockAdvancedCheckout() {
    if (createPackageOrder.isPending) return;
    setScanMode('advanced');
    if (!unlockReportPackage) {
      setShowUnlockModal(false);
      setOrderMessage({ tone: 'error', text: 'No paid ATS package is available right now. Please contact support.' });
      packagePanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    void handleCreatePackageOrder(unlockReportPackage.id, { openCheckout: true });
  }

  function handleOpenUnlockModal() {
    if (createPackageOrder.isPending) return;
    setScanMode('advanced');
    setShowUnlockModal(true);
  }

  function handlePrimaryUploadAction() {
    if (analysis.status === 'processing') return;
    if (canUpload) {
      fileInputRef.current?.click();
      return;
    }
    if (blockedCtaLabel === 'Choose career stage') {
      return;
    }
    setScanMode('advanced');
    setShowUnlockModal(true);
  }

  if (overviewQuery.isLoading) {
    return (
      <div className="page-stack">
        <PageHeader description="Loading ATS Resume Score." eyebrow="Career tools" title="ATS Resume Score" />
        <LoadingState />
      </div>
    );
  }

  if (overviewQuery.isError) {
    return (
      <div className="page-stack">
        <PageHeader description="ATS Resume Score could not be loaded right now." eyebrow="Career tools" title="ATS Resume Score unavailable" />
        <ErrorState />
      </div>
    );
  }

  return (
    <div className="page-stack ats-resume-page">
      {analysis.status === 'processing' ? <AtsScanOverlay fileName={analysis.fileName} scanMode={scanMode} stepIndex={scanStepIndex} /> : null}
      {analysis.status === 'ready' && showScoreGuide ? <ScoreGuideModal analysis={analysis} onClose={() => setShowScoreGuide(false)} /> : null}
      {showUnlockModal ? <AtsUnlockModal isPending={createPackageOrder.isPending} onClose={() => setShowUnlockModal(false)} onUnlockNow={handleUnlockAdvancedCheckout} priceText={unlockReportPriceText} /> : null}
      <PageHeader
        description="Check your PDF resume for ATS readability, structure, contact details, action verbs, measurable impact, role keywords, and JD match."
        eyebrow="Career tools"
        title="ATS Resume Score"
      />

      <section className="ats-student-command">
        <div>
          <span className="eyebrow">Resume readiness lab</span>
          <h2>Score your resume before you apply</h2>
          <p>Run a private browser-based PDF scan, review structured feedback, and unlock role-specific analysis when needed.</p>
        </div>
      </section>

      <section className="ats-summary-grid ats-summary-grid--student" aria-label="ATS scan summary">
        <article>
          <ShieldCheck size={20} />
          <span>Free scans left</span>
          <strong>{summary.freeRemaining}</strong>
          <small>Lifetime basic scans</small>
        </article>
        <article>
          <CheckCircle2 size={20} />
          <span>Free scans used</span>
          <strong>{summary.used}/{summary.freeLimit}</strong>
          <small>Basic ATS scoring</small>
        </article>
        <article>
          <BadgeIndianRupee size={20} />
          <span>Paid credits</span>
          <strong>{summary.paidCredits}</strong>
          <small>Advanced scans available</small>
        </article>
        <article>
          <History size={20} />
          <span>Saved scans</span>
          <strong>{summary.attempts}</strong>
          <small>Score history only</small>
        </article>
      </section>

      <section className="ats-workspace">
        <div className="ats-upload-panel">
          <div className="ats-upload-panel__icon">
            <FileSearch size={28} />
          </div>
          <div>
            <span className="eyebrow">PDF only</span>
            <h2>Upload resume</h2>
          </div>

          <aside className="ats-review-preview" aria-label="ATS review checks">
            <header>
              <ListChecks size={20} />
              <strong>What your scan checks</strong>
            </header>
            <div>
              <span>Resume score</span>
              <span>ATS readability</span>
              <span>Section quality</span>
              <span>Bullet strength</span>
              <span>{scanMode === 'advanced' ? 'Role and JD match' : 'General recruiter checks'}</span>
            </div>
          </aside>

          <div className="ats-mode-toggle" role="group" aria-label="ATS scan mode">
            <button className={scanMode === 'basic' ? 'is-active' : ''} onClick={() => setScanMode('basic')} type="button">
              Basic score
            </button>
            <button className={scanMode === 'advanced' ? 'is-active' : ''} onClick={() => setScanMode('advanced')} type="button">
              Advanced match
            </button>
          </div>

          {levels.length > 0 ? (
            <section className="ats-persona-step" aria-label="Career stage selection">
              <header>
                <div>
                  <span className="eyebrow">Personalize review</span>
                  <h3>What best describes you?</h3>
                </div>
                <p>We use this to judge the resume against the right recruiter expectation. You can change it before every scan.</p>
              </header>
              <div className="ats-level-choice-grid">
                {levels.map((level) => (
                  <button className={activeLevelId === level.id ? 'ats-level-choice ats-level-choice--active' : 'ats-level-choice'} key={level.id} onClick={() => setSelectedLevelId(level.id)} type="button">
                    <span>{levelIcon(level.levelKey)}</span>
                    <strong>{level.levelName}</strong>
                    <small>{levelDescription(level.levelKey, level.description)}</small>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {scanMode === 'advanced' ? (
            <div className="ats-target-grid">
              <label>
                <span>Target role</span>
                <select value={activeRoleId} onChange={(event) => setSelectedRoleId(event.target.value)}>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.roleName}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Level</span>
                <input readOnly value={selectedLevel?.levelName ?? 'Choose career stage above'} />
              </label>
              <label className="ats-jd-field">
                <span>Job description</span>
                <small>Optional, but useful for advanced scans. We use it only during this analysis and do not save the text.</small>
                <textarea
                  onChange={(event) => setJobDescription(event.target.value)}
                  placeholder="Paste the job description here: responsibilities, required skills, tools, keywords, and qualifications."
                  rows={5}
                  value={jobDescription}
                />
              </label>
            </div>
          ) : null}

          <input accept="application/pdf,.pdf" className="sr-only" id="ats-resume-upload" onChange={(event) => void handleFileChange(event)} ref={fileInputRef} type="file" />
          <button className="student-action student-action--primary ats-upload-button" disabled={analysis.status === 'processing'} onClick={handlePrimaryUploadAction} type="button">
            {analysis.status === 'processing' ? <Loader2 className="workshop-action-spinner" size={16} /> : <UploadCloud size={16} />}
            {analysis.status === 'processing' ? 'Analyzing...' : canUpload ? uploadCtaLabel : blockedCtaLabel}
          </button>

          {scanMode === 'advanced' && hasPaidCredits ? (
            <div className="ats-paywall-note ats-paywall-note--success">
              <Sparkles size={16} />
              <span>Advanced scan credit is available. Upload your resume here to generate the full report.</span>
            </div>
          ) : !canUpload ? (
            <div className="ats-paywall-note">
              <LockKeyhole size={16} />
              <span>{scanMode === 'advanced' ? 'Advanced analysis needs an available paid scan credit and a role profile. After payment, scan again in Advanced match to generate the full report.' : 'Free scans are used. Buy an advanced scan credit, then scan again in Advanced match for the full report.'}</span>
            </div>
          ) : null}
        </div>

        <div className="ats-plan-panel" ref={packagePanelRef}>
          <header>
            <span className="eyebrow">Paid package preview</span>
            <h2>Advanced unlock</h2>
            <p>Role keywords, JD match, detailed recommendations, and branded report download.</p>
          </header>
          <div className="ats-package-list">
            {paidPackages.slice(0, 3).map((item) => (
              <article className="ats-package-row" key={item.id}>
                <div className="ats-package-row__icon">
                  <Sparkles size={18} />
                </div>
                <div>
                  <strong>{item.title}</strong>
                  <span>
                    {item.scanCredits} scan{item.scanCredits === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="ats-package-row__action">
                  <span>
                    {item.currency} {Number(item.amount).toLocaleString()}
                  </span>
                  <button className="student-action student-action--primary ats-package-buy-button" disabled={createPackageOrder.isPending} onClick={() => void handleCreatePackageOrder(item.id)} type="button">
                    {pendingPackageId === item.id ? 'Preparing...' : 'Buy'}
                  </button>
                </div>
              </article>
            ))}
          </div>
          <div className="ats-payment-guidance ats-payment-guidance--compact">
            <CheckCircle2 size={18} />
            <div>
              <strong>What happens after payment?</strong>
              <span>Your account gets an advanced scan credit. Come back to this page, choose Advanced match, and upload the resume again to generate the full report.</span>
            </div>
          </div>
          {orderMessage ? (
            <div className={orderMessage.tone === 'success' ? 'ats-alert ats-alert--success' : 'ats-alert ats-alert--error'}>
              <span>{orderMessage.text}</span>
              {orderMessage.checkoutUrl ? (
                <a className="segmented-button ats-checkout-link" href={orderMessage.checkoutUrl} rel="noreferrer" target="_blank">
                  Open checkout
                </a>
              ) : null}
            </div>
          ) : null}
          <p>{hasPaidCredits ? 'Advanced scan credit is available. Choose Advanced match and scan your resume again to generate the full report.' : 'Payment adds an advanced scan credit. The report is generated after you return and run the Advanced match scan.'}</p>
        </div>
      </section>

      {analysis.status === 'error' ? (
        <section className="ats-alert ats-alert--error">
          <AlertCircle size={18} />
          <span>{analysis.message}</span>
        </section>
      ) : null}

      {analysis.status === 'ready' ? (
        <AtsReportWorkspace
          analysis={analysis}
          onClose={() => {
            setShowScoreGuide(false);
            setAnalysis({ status: 'idle' });
          }}
          onDownloadReport={() => void handleDownloadReport()}
          onShowGuide={() => setShowScoreGuide(true)}
          onUnlockAdvancedPending={createPackageOrder.isPending}
          onUnlockAdvanced={handleOpenUnlockModal}
        />
      ) : null}

      <AttemptsList attempts={overview?.attempts ?? []} />
    </div>
  );
}
