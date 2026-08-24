import {
  AlertTriangle,
  CheckCircle2,
  CheckCircle,
  ChevronRight,
  Edit3,
  Library,
  MailCheck,
  Plus,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  Users,
  X
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { PortalToast } from '../components/PortalToast';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenStates';
import { StatusBadge } from '../components/StatusBadge';
import { AdminCohort, useAdminAllCohorts, useAdminCohortCardMetrics } from '../features/admin/useAdminCohorts';
import { AdminEmailQueueItem, AdminEmailResolveResult, useAdminEmailQueue, useAdminEmailTemplates, useResolveAdminEmailRecipients } from '../features/admin/useAdminEmailCenter';
import {
  AdminEmailMarketingCampaign,
  AdminEmailMarketingCampaignPayload,
  AdminEmailMarketingPlan,
  AdminEmailProviderEvent,
  AdminEmailSuppressionOverride,
  useAdminEmailMarketingCampaigns,
  useAdminEmailMarketingCohortTouch,
  useAdminEmailMarketingPlanEvents,
  useAdminEmailMarketingPlans,
  useAdminEmailProviderEvents,
  useAdminEmailSuppressionOverrides,
  useCreateAdminEmailMarketingCampaign,
  useCreateAdminEmailMarketingPlan,
  useCreateAdminEmailMarketingPlanEvent,
  useCreateAdminEmailSuppressionOverride,
  useUpdateAdminEmailMarketingCampaign,
  useUpdateAdminEmailMarketingPlan
} from '../features/admin/useAdminEmailMarketing';
import { useAdminResources } from '../features/admin/useAdminResources';

type CampaignIdea = {
  description: string;
  phase: string;
  priority: 'High' | 'Medium' | 'Low';
  title: string;
};

type CampaignDraft = AdminEmailMarketingCampaignPayload & {
  activitySegment?: string;
  audienceTag?: string;
  cohortStage?: string;
  domainKeyRule?: string;
  id?: string;
  programKeyRule?: string;
  resourceDomainKey?: string;
  resourceMode?: string;
  resourceType?: string;
};

type UpcomingPlanPreview = {
  campaignTitle: string;
  cohortNames: string[];
  dateKey: string;
  plannedRecipientCount: number;
};

type CampaignPerformanceMetric = {
  cancelledPlans: number;
  cohortNames: string[];
  draftPlans: number;
  key: string;
  lastSentAt?: string;
  phase: string;
  plannedRecipients: number;
  reviewedPlans: number;
  sentPlans: number;
  sentRecipients: number;
  skippedPlans: number;
  title: string;
  totalPlans: number;
};

type CampaignDiversityContext = {
  recentCampaignKeys?: string[];
  recentPhases?: string[];
};

type DeliveryPerformanceSummary = {
  failed: number;
  queued: number;
  sent: number;
  total: number;
};

type ProviderDeliverySummary = {
  bounced: number;
  clicked: number;
  delivered: number;
  opened: number;
  spam: number;
  totalEvents: number;
  unsubscribed: number;
};

type WebhookHealth = {
  activeEndpoint: string;
  lastEventAt?: string;
  lastEventType: string;
  lastRecipient: string;
  latestEvent?: AdminEmailProviderEvent;
  status: 'healthy' | 'stale' | 'empty';
  statusLabel: string;
};

type SuppressionRecord = {
  clearedAt?: string;
  eventType: string;
  lastEventAt?: string;
  overrideStatus?: string;
  reason?: string | null;
  recipientEmail: string;
  suppressed: boolean;
};

type EngagementSuggestion = {
  action: string;
  campaignPhase?: string;
  cohortName?: string;
  detail: string;
  kind: 'campaign' | 'cohort' | 'rotation' | 'suppression';
  metric: string;
  title: string;
  tone: 'safe' | 'warning' | 'neutral';
};

type SmartCopyVariant = {
  body: string;
  focus: string;
  subject: string;
  tone: 'safe' | 'warning' | 'neutral';
};

type AbCopyVariant = SmartCopyVariant & {
  variantKey: 'A' | 'B';
};

type AbCopyStats = {
  clicked: number;
  delivered: number;
  opened: number;
};

type SetupChecklistItem = {
  detail: string;
  label: string;
  ready: boolean;
  tone: 'safe' | 'warning' | 'neutral';
};

type EmailMarketingTab = 'today' | 'rotation' | 'campaigns' | 'activity';

type EmailMarketingStep = {
  action: string;
  detail: string;
  done: boolean;
  label: string;
  tone: 'safe' | 'warning' | 'neutral';
};

type CohortGroupingStrategy = 'oldest_touch' | 'same_program' | 'same_domain' | 'smallest_first';

const emailMarketingTabs: { key: EmailMarketingTab; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'rotation', label: 'Schedule' },
  { key: 'campaigns', label: 'Settings' },
  { key: 'activity', label: 'Activity' }
];

const dailyLimit = 300;
const defaultSuggestedBatch = 150;
const campaignAudienceTagOptions = [
  { label: 'General touch-base', value: 'general_touch_base' },
  { label: 'Resource sharing', value: 'resource_sharing' },
  { label: 'New cohort onboarding', value: 'new_cohort_onboarding' },
  { label: 'Inactive student reactivation', value: 'inactive_student_reactivation' },
  { label: 'Placement readiness', value: 'placement_readiness' },
  { label: 'Project submission nudge', value: 'project_submission_nudge' },
  { label: 'Workshop reminder', value: 'workshop_reminder' },
  { label: 'Recording follow-up', value: 'recording_followup' },
  { label: 'Certificate completion', value: 'certificate_completion' },
  { label: 'Fee or enrollment follow-up', value: 'enrollment_followup' }
];
const cohortStageOptions = [
  { label: 'Any cohort stage', value: '' },
  { label: 'New cohort', value: 'new' },
  { label: 'Active learning', value: 'active_learning' },
  { label: 'Nearing completion', value: 'nearing_completion' },
  { label: 'Completed / alumni', value: 'completed' }
];
const activitySegmentOptions = [
  { label: 'Any activity segment', value: '' },
  { label: 'Never touched', value: 'never_touched' },
  { label: 'Overdue touch', value: 'overdue_touch' },
  { label: 'Recently touched', value: 'recently_touched' }
];
const cohortGroupingOptions: { description: string; label: string; value: CohortGroupingStrategy }[] = [
  { description: 'Prioritize cohorts that have waited longest since the last Email Marketing touch.', label: 'Oldest touch first', value: 'oldest_touch' },
  { description: 'Start with the oldest cohort, then bundle cohorts from the same program first.', label: 'Same program together', value: 'same_program' },
  { description: 'Start with the oldest cohort, then bundle cohorts from the same domain first.', label: 'Same domain together', value: 'same_domain' },
  { description: 'Fill the daily target with smaller cohorts first, useful for clearing long tails.', label: 'Smallest cohorts first', value: 'smallest_first' }
];
const campaignPhaseOptions = [
  { label: 'Resource Sharing', value: 'resource_share' },
  { label: 'General Touch-base', value: 'general' },
  { label: 'Placement Readiness', value: 'placement' },
  { label: 'Learning Reminder', value: 'reminder' },
  { label: 'Workshop Link', value: 'workshop_link' },
  { label: 'Recording Update', value: 'recording_update' },
  { label: 'Project Submission', value: 'project_submission' },
  { label: 'Certificate', value: 'certificate' },
  { label: 'Enrollment', value: 'enrollment' }
];
const resourceTypeOptions = [
  { label: 'Any resource type', value: '' },
  { label: 'General', value: 'general' },
  { label: 'Template', value: 'template' },
  { label: 'Case Material', value: 'case_material' },
  { label: 'Project Resource', value: 'project_resource' },
  { label: 'Live Session Material', value: 'live_session_material' },
  { label: 'Placement Resource', value: 'placement_resource' },
  { label: 'Assignment Reference', value: 'assignment_reference' }
];
const resourceModeOptions = [
  { label: 'Any mode', value: '' },
  { label: 'Link', value: 'link' },
  { label: 'PDF', value: 'pdf' },
  { label: 'Video', value: 'video' },
  { label: 'Drive', value: 'drive' },
  { label: 'PPTX', value: 'pptx' },
  { label: 'XLSX', value: 'xlsx' },
  { label: 'DOC', value: 'doc' }
];

const campaignIdeas: CampaignIdea[] = [
  {
    description: 'Share one useful LMS resource with students who should be touched this cycle.',
    phase: 'resource_share',
    priority: 'High',
    title: 'Resource sharing campaign'
  },
  {
    description: 'Send a warm check-in that pulls students back into portal activity.',
    phase: 'general',
    priority: 'Medium',
    title: 'Student touch-base campaign'
  },
  {
    description: 'Nudge students toward resume, interview, and role-readiness material.',
    phase: 'placement',
    priority: 'Medium',
    title: 'Placement readiness campaign'
  },
  {
    description: 'Remind selected cohorts about upcoming sessions or learning milestones.',
    phase: 'reminder',
    priority: 'Low',
    title: 'Learning reminder campaign'
  }
];

function formatDate(value?: string) {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(value?: string) {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { day: '2-digit', hour: '2-digit', minute: '2-digit', month: 'short', year: 'numeric' });
}

function isoDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function startOfYear(value: Date) {
  return new Date(value.getFullYear(), 0, 0);
}

function dayOfYear(value: Date) {
  const diff = value.getTime() - startOfYear(value).getTime();
  return Math.floor(diff / 86_400_000);
}

function daysSince(value?: string, now = new Date()) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86_400_000));
}

function stringRule(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === 'string' ? value.trim() : '';
}

function majorityValue(values: Array<string | undefined>) {
  const counts = new Map<string, number>();
  values.forEach((value) => {
    const trimmed = value?.trim();
    if (trimmed) counts.set(trimmed, (counts.get(trimmed) ?? 0) + 1);
  });
  return [...counts.entries()].sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]))[0]?.[0] ?? '';
}

function cohortStage(cohort: AdminCohort, now = new Date()) {
  if (cohort.status === 'completed') return 'completed';
  const startDays = daysSince(cohort.startDate, now);
  if (startDays !== null && startDays <= 21) return 'new';
  if (cohort.endDate) {
    const endDate = new Date(cohort.endDate);
    if (!Number.isNaN(endDate.getTime())) {
      const daysUntilEnd = Math.ceil((endDate.getTime() - now.getTime()) / 86_400_000);
      if (daysUntilEnd >= 0 && daysUntilEnd <= 30) return 'nearing_completion';
    }
  }
  return 'active_learning';
}

function cohortActivitySegment(cohort: AdminCohort, cohortTouches: Map<string, string | undefined>, touchIntervalDays: number, now = new Date()) {
  const lastTouchedAt = cohortTouches.get(cohort.name);
  const touchedDaysAgo = daysSince(lastTouchedAt, now);
  if (touchedDaysAgo === null) return 'never_touched';
  if (touchedDaysAgo >= touchIntervalDays) return 'overdue_touch';
  return 'recently_touched';
}

function scoreCampaignForCohortGroup(campaign: AdminEmailMarketingCampaign, selectedCohorts: AdminCohort[], cohortTouches: Map<string, string | undefined>, now = new Date()) {
  if (!selectedCohorts.length) return campaign.rotationWeight;
  const rules = campaign.audienceRules ?? {};
  const programKey = stringRule(rules, 'programKey');
  const domainKey = stringRule(rules, 'domainKey');
  const stage = stringRule(rules, 'cohortStage');
  const activitySegment = stringRule(rules, 'activitySegment');
  const groupProgram = majorityValue(selectedCohorts.map((cohort) => cohort.programKey));
  const groupDomain = majorityValue(selectedCohorts.map((cohort) => cohort.domainKey));
  const groupStages = new Set<string>(selectedCohorts.map((cohort) => cohortStage(cohort, now)));
  const groupActivity = new Set<string>(selectedCohorts.map((cohort) => cohortActivitySegment(cohort, cohortTouches, campaign.touchIntervalDays, now)));
  const lastTouchDays = selectedCohorts.map((cohort) => daysSince(cohortTouches.get(cohort.name), now)).filter((value): value is number => value !== null);
  const newestTouchDays = lastTouchDays.length ? Math.min(...lastTouchDays) : null;
  let score = campaign.rotationWeight;

  if (programKey) score += programKey === groupProgram ? 70 : -80;
  if (domainKey) score += domainKey === groupDomain ? 70 : -80;
  if (stage) score += groupStages.has(stage) ? 45 : -45;
  if (activitySegment) score += groupActivity.has(activitySegment) ? 45 : -45;
  if (newestTouchDays !== null && newestTouchDays < campaign.touchIntervalDays) score -= 30;
  if (stringRule(rules, 'audienceTag')) score += 10;

  return score;
}

function campaignDiversityPenalty(campaign: AdminEmailMarketingCampaign, context: CampaignDiversityContext = {}) {
  const recentCampaignKeys = context.recentCampaignKeys ?? [];
  const recentPhases = context.recentPhases ?? [];
  let penalty = 0;

  recentCampaignKeys.forEach((key, index) => {
    if (key === campaign.campaignKey) penalty += index === 0 ? 110 : 55;
  });
  recentPhases.forEach((phase, index) => {
    if (phase === campaign.phase) penalty += index === 0 ? 55 : 25;
  });

  return penalty;
}

function cohortSortValue(cohort: AdminCohort) {
  return `${cohort.programKey ?? 'zz'}:${cohort.startDate ?? '9999-12-31'}:${cohort.name}`;
}

function cohortTouchTime(cohort: AdminCohort, cohortTouches: Map<string, string | undefined>) {
  const touchedAt = cohortTouches.get(cohort.name);
  return touchedAt ? new Date(touchedAt).getTime() : 0;
}

function sortCohortsByTouch(cohorts: AdminCohort[], cohortTouches: Map<string, string | undefined>) {
  return [...cohorts].sort((first, second) => {
    const firstTime = cohortTouchTime(first, cohortTouches);
    const secondTime = cohortTouchTime(second, cohortTouches);
    if (firstTime !== secondTime) return firstTime - secondTime;
    return cohortSortValue(first).localeCompare(cohortSortValue(second));
  });
}

function groupCohortsForStrategy(cohorts: AdminCohort[], strategy: CohortGroupingStrategy, cohortTouches: Map<string, string | undefined>) {
  const touchSorted = sortCohortsByTouch(cohorts, cohortTouches);
  if (strategy === 'oldest_touch') return touchSorted;
  if (strategy === 'smallest_first') {
    return [...touchSorted].sort((first, second) => first.studentCount - second.studentCount || cohortTouchTime(first, cohortTouches) - cohortTouchTime(second, cohortTouches) || cohortSortValue(first).localeCompare(cohortSortValue(second)));
  }

  const seed = touchSorted[0];
  if (!seed) return touchSorted;
  const groupingKey = strategy === 'same_program' ? seed.programKey : seed.domainKey;
  if (!groupingKey) return touchSorted;

  return [...touchSorted].sort((first, second) => {
    const firstMatches = (strategy === 'same_program' ? first.programKey : first.domainKey) === groupingKey;
    const secondMatches = (strategy === 'same_program' ? second.programKey : second.domainKey) === groupingKey;
    if (firstMatches !== secondMatches) return firstMatches ? -1 : 1;
    return cohortTouchTime(first, cohortTouches) - cohortTouchTime(second, cohortTouches) || cohortSortValue(first).localeCompare(cohortSortValue(second));
  });
}

function buildRotatingPlan(cohorts: AdminCohort[], targetCount: number, date: Date, cohortTouches = new Map<string, string | undefined>(), groupingStrategy: CohortGroupingStrategy = 'oldest_touch') {
  const activeCohorts = cohorts
    .filter((cohort) => cohort.status === 'active' && cohort.studentCount > 0);

  if (!activeCohorts.length) return { activeCohorts, selected: [] as AdminCohort[], total: 0 };

  const groupedCohorts = groupCohortsForStrategy(activeCohorts, groupingStrategy, cohortTouches);
  const hasTouchHistory = activeCohorts.some((cohort) => cohortTouches.has(cohort.name));
  const startIndex = hasTouchHistory || groupingStrategy !== 'oldest_touch' ? 0 : dayOfYear(date) % groupedCohorts.length;
  const selected: AdminCohort[] = [];
  let total = 0;

  for (let index = 0; index < groupedCohorts.length; index += 1) {
    const cohort = groupedCohorts[(startIndex + index) % groupedCohorts.length];
    if (selected.length > 0 && total + cohort.studentCount > targetCount) break;
    selected.push(cohort);
    total += cohort.studentCount;
    if (total >= targetCount) break;
  }

  return { activeCohorts: groupedCohorts, selected, total };
}

function pickCampaignIdea(day: number, templatePhases: Set<string>) {
  const preferred = campaignIdeas.filter((idea) => templatePhases.has(idea.phase));
  const pool = preferred.length ? preferred : campaignIdeas;
  return pool[day % pool.length];
}

function pickSavedCampaign(
  day: number,
  campaigns: AdminEmailMarketingCampaign[],
  selectedCohorts: AdminCohort[] = [],
  cohortTouches = new Map<string, string | undefined>(),
  now = new Date(),
  diversityContext: CampaignDiversityContext = {}
) {
  const activeCampaigns = campaigns.filter((campaign) => campaign.status === 'active');
  if (!activeCampaigns.length) return null;
  const sorted = [...activeCampaigns].sort((first, second) => {
    const firstScore = scoreCampaignForCohortGroup(first, selectedCohorts, cohortTouches, now) - campaignDiversityPenalty(first, diversityContext);
    const secondScore = scoreCampaignForCohortGroup(second, selectedCohorts, cohortTouches, now) - campaignDiversityPenalty(second, diversityContext);
    if (firstScore !== secondScore) return secondScore - firstScore;
    if (first.rotationWeight !== second.rotationWeight) return second.rotationWeight - first.rotationWeight;
    return first.title.localeCompare(second.title);
  });
  return selectedCohorts.length ? sorted[0] : sorted[day % sorted.length];
}

function buildCampaignDiversityContext(plans: AdminEmailMarketingPlan[] = [], beforeDateKey?: string): CampaignDiversityContext {
  const usablePlans = plans
    .filter((plan) => !beforeDateKey || plan.plannedDate < beforeDateKey)
    .filter((plan) => !['cancelled', 'skipped'].includes(plan.status))
    .sort((first, second) => second.plannedDate.localeCompare(first.plannedDate))
    .slice(0, 3);

  return {
    recentCampaignKeys: usablePlans
      .map((plan) => {
        const metadataKey = typeof plan.metadata?.preferredTemplateKey === 'string' ? plan.metadata.preferredTemplateKey : '';
        return metadataKey || `${plan.campaignPhase}:${plan.campaignTitle}`;
      })
      .filter(Boolean),
    recentPhases: usablePlans.map((plan) => plan.campaignPhase).filter(Boolean)
  };
}

function planStatusTone(status?: string) {
  if (status === 'sent') return 'safe';
  if (status === 'skipped' || status === 'cancelled') return 'warning';
  if (status === 'reviewed') return 'safe';
  return 'neutral';
}

function slugifyCampaignKey(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 56) || `campaign_${Date.now()}`;
}

function campaignDraftFrom(campaign?: AdminEmailMarketingCampaign | null): CampaignDraft {
  const rules = campaign?.audienceRules ?? {};
  return {
    activitySegment: typeof rules.activitySegment === 'string' ? rules.activitySegment : '',
    audienceRules: campaign?.audienceRules ?? {},
    audienceTag: typeof rules.audienceTag === 'string' ? rules.audienceTag : '',
    campaignKey: campaign?.campaignKey ?? '',
    cohortStage: typeof rules.cohortStage === 'string' ? rules.cohortStage : '',
    defaultBody: campaign?.defaultBody ?? '',
    defaultResourceIds: campaign?.defaultResourceIds ?? [],
    defaultSubject: campaign?.defaultSubject ?? '',
    description: campaign?.description ?? '',
    domainKeyRule: typeof rules.domainKey === 'string' ? rules.domainKey : '',
    id: campaign?.id,
    phase: campaign?.phase ?? 'general',
    programKeyRule: typeof rules.programKey === 'string' ? rules.programKey : '',
    resourceDomainKey: typeof rules.resourceDomainKey === 'string' ? rules.resourceDomainKey : '',
    resourceMode: typeof rules.resourceMode === 'string' ? rules.resourceMode : '',
    resourceType: typeof rules.resourceType === 'string' ? rules.resourceType : '',
    rotationWeight: campaign?.rotationWeight ?? 100,
    status: campaign?.status ?? 'active',
    templateKey: campaign?.templateKey ?? '',
    title: campaign?.title ?? '',
    touchIntervalDays: campaign?.touchIntervalDays ?? 14
  };
}

function scoreResourceForCampaign(
  resource: { cohortNames?: string[]; resourceDomainKey?: string | null; resourceMode?: string; resourceType?: string; updatedAt?: string },
  campaign: AdminEmailMarketingCampaign | null,
  cohortNames: string[]
) {
  const rules = campaign?.audienceRules ?? {};
  const resourceType = typeof rules.resourceType === 'string' ? rules.resourceType : '';
  const resourceMode = typeof rules.resourceMode === 'string' ? rules.resourceMode : '';
  const resourceDomainKey = typeof rules.resourceDomainKey === 'string' ? rules.resourceDomainKey : '';
  let score = 0;

  if (resourceType && resource.resourceType === resourceType) score += 40;
  if (resourceMode && resource.resourceMode === resourceMode) score += 20;
  if (resourceDomainKey && resource.resourceDomainKey === resourceDomainKey) score += 30;
  if (resource.cohortNames?.some((name) => cohortNames.includes(name))) score += 50;
  if (!resource.cohortNames?.length) score += 5;

  const updatedAt = resource.updatedAt ? new Date(resource.updatedAt).getTime() : Number.NaN;
  if (Number.isFinite(updatedAt)) score += Math.max(0, 10 - Math.floor((Date.now() - updatedAt) / 86_400_000));
  return score;
}

function buildPlanPayload({
  campaign,
  cohortTouches,
  cohortPlan,
  fallbackCampaign,
  groupingStrategy,
  targetCount,
  todayKey
}: {
  campaign: AdminEmailMarketingCampaign | null;
  cohortTouches: Map<string, string | undefined>;
  cohortPlan: ReturnType<typeof buildRotatingPlan>;
  fallbackCampaign: CampaignIdea;
  groupingStrategy: CohortGroupingStrategy;
  targetCount: number;
  todayKey: string;
}) {
  const campaignTitle = campaign?.title ?? fallbackCampaign.title;
  const campaignPhase = campaign?.phase ?? fallbackCampaign.phase;
  return {
    campaignId: campaign?.id ?? null,
    campaignPhase,
    campaignTitle,
    cohortIds: cohortPlan.selected.map((cohort) => cohort.id),
    cohortNames: cohortPlan.selected.map((cohort) => cohort.name),
    dailyLimit,
    metadata: {
      generatedBy: 'admin-email-marketing-page',
      groupingStrategy,
      preferredTemplateKey: campaign?.templateKey ?? null,
      prioritization: groupingStrategy,
      selectedCohortStudentCounts: cohortPlan.selected.map((cohort) => ({
        cohortName: cohort.name,
        lastTouchedAt: cohortTouches.get(cohort.name) ?? null,
        studentCount: cohort.studentCount
      }))
    },
    plannedDate: todayKey,
    plannedRecipientCount: cohortPlan.total,
    planKey: `email-marketing-${todayKey}`,
    priorityScore: campaign?.rotationWeight ?? (fallbackCampaign.priority === 'High' ? 100 : fallbackCampaign.priority === 'Medium' ? 70 : 40),
    rationale: `Grouped ${cohortPlan.selected.length} active cohort${cohortPlan.selected.length === 1 ? '' : 's'} using ${cohortGroupingOptions.find((option) => option.value === groupingStrategy)?.label ?? 'the selected grouping strategy'}, then capped the plan around the ${targetCount}-student daily target within the ${dailyLimit} email limit.`,
    resourceIds: campaign?.defaultResourceIds ?? [],
    status: 'draft' as const,
    suggestedBatchSize: targetCount,
    suggestedBody: campaign?.defaultBody ?? null,
    suggestedSubject: campaign?.defaultSubject ?? null
  };
}

function buildUpcomingPlanPreviews({
  campaigns,
  cohortTouches,
  cohorts,
  diversityContext,
  groupingStrategy,
  startDate,
  targetCount,
  templatePhases
}: {
  campaigns: AdminEmailMarketingCampaign[];
  cohortTouches: Map<string, string | undefined>;
  cohorts: AdminCohort[];
  diversityContext?: CampaignDiversityContext;
  groupingStrategy: CohortGroupingStrategy;
  startDate: Date;
  targetCount: number;
  templatePhases: Set<string>;
}) {
  const simulatedTouches = new Map(cohortTouches);
  const recentCampaignKeys = [...(diversityContext?.recentCampaignKeys ?? [])];
  const recentPhases = [...(diversityContext?.recentPhases ?? [])];
  const previews: UpcomingPlanPreview[] = [];

  for (let offset = 1; offset <= 7; offset += 1) {
    const previewDate = addDays(startDate, offset);
    const dateKey = isoDate(previewDate);
    const cohortPlan = buildRotatingPlan(cohorts, targetCount, previewDate, simulatedTouches, groupingStrategy);
    const savedCampaign = pickSavedCampaign(dayOfYear(previewDate), campaigns, cohortPlan.selected, simulatedTouches, previewDate, {
      recentCampaignKeys,
      recentPhases
    });
    const fallbackCampaign = pickCampaignIdea(dayOfYear(previewDate), templatePhases);
    const campaignTitle = savedCampaign?.title ?? fallbackCampaign.title;

    previews.push({
      campaignTitle,
      cohortNames: cohortPlan.selected.map((cohort) => cohort.name),
      dateKey,
      plannedRecipientCount: cohortPlan.total
    });

    if (savedCampaign) {
      recentCampaignKeys.unshift(savedCampaign.campaignKey);
      recentPhases.unshift(savedCampaign.phase);
      recentCampaignKeys.splice(3);
      recentPhases.splice(3);
    }
    cohortPlan.selected.forEach((cohort) => simulatedTouches.set(cohort.name, dateKey));
  }

  return previews;
}

function newerDate(first?: string, second?: string) {
  if (!first) return second;
  if (!second) return first;
  const firstTime = new Date(first).getTime();
  const secondTime = new Date(second).getTime();
  if (Number.isNaN(firstTime)) return second;
  if (Number.isNaN(secondTime)) return first;
  return firstTime > secondTime ? first : second;
}

function buildCampaignPerformanceMetrics(plans: AdminEmailMarketingPlan[]) {
  const metrics = new Map<string, CampaignPerformanceMetric>();

  plans.forEach((plan) => {
    const key = plan.campaignId ?? `${plan.campaignPhase}:${plan.campaignTitle}`;
    const existing = metrics.get(key) ?? {
      cancelledPlans: 0,
      cohortNames: [],
      draftPlans: 0,
      key,
      phase: plan.campaignPhase,
      plannedRecipients: 0,
      reviewedPlans: 0,
      sentPlans: 0,
      sentRecipients: 0,
      skippedPlans: 0,
      title: plan.campaignTitle,
      totalPlans: 0
    };

    existing.totalPlans += 1;
    existing.plannedRecipients += plan.plannedRecipientCount;
    existing.cohortNames = Array.from(new Set([...existing.cohortNames, ...plan.cohortNames])).slice(0, 6);
    if (plan.status === 'draft') existing.draftPlans += 1;
    if (plan.status === 'reviewed') existing.reviewedPlans += 1;
    if (plan.status === 'skipped') existing.skippedPlans += 1;
    if (plan.status === 'cancelled') existing.cancelledPlans += 1;
    if (plan.status === 'sent') {
      existing.sentPlans += 1;
      existing.sentRecipients += plan.plannedRecipientCount;
      existing.lastSentAt = newerDate(existing.lastSentAt, plan.sentAt ?? plan.updatedAt ?? plan.plannedDate);
    }
    metrics.set(key, existing);
  });

  return Array.from(metrics.values()).sort((first, second) => {
    if (first.sentRecipients !== second.sentRecipients) return second.sentRecipients - first.sentRecipients;
    if (first.sentPlans !== second.sentPlans) return second.sentPlans - first.sentPlans;
    return second.totalPlans - first.totalPlans;
  });
}

function buildCohortPerformanceMetrics(plans: AdminEmailMarketingPlan[]) {
  const metrics = new Map<string, { cohortName: string; lastSentAt?: string; sentPlans: number; sentRecipients: number; totalPlans: number }>();

  plans.forEach((plan) => {
    plan.cohortNames.forEach((cohortName) => {
      const existing = metrics.get(cohortName) ?? {
        cohortName,
        sentPlans: 0,
        sentRecipients: 0,
        totalPlans: 0
      };
      existing.totalPlans += 1;
      if (plan.status === 'sent') {
        existing.sentPlans += 1;
        existing.sentRecipients += Math.round(plan.plannedRecipientCount / Math.max(1, plan.cohortNames.length));
        existing.lastSentAt = newerDate(existing.lastSentAt, plan.sentAt ?? plan.updatedAt ?? plan.plannedDate);
      }
      metrics.set(cohortName, existing);
    });
  });

  return Array.from(metrics.values())
    .sort((first, second) => {
      if (first.sentPlans !== second.sentPlans) return second.sentPlans - first.sentPlans;
      if (first.sentRecipients !== second.sentRecipients) return second.sentRecipients - first.sentRecipients;
      return first.cohortName.localeCompare(second.cohortName);
    })
    .slice(0, 6);
}

function buildDeliveryPerformanceSummary(queueItems: AdminEmailQueueItem[]): DeliveryPerformanceSummary {
  return queueItems.reduce(
    (summary, item) => {
      const status = item.status ?? 'queued';
      if (status === 'sent') summary.sent += 1;
      else if (status === 'failed') summary.failed += 1;
      else summary.queued += 1;
      summary.total += 1;
      return summary;
    },
    { failed: 0, queued: 0, sent: 0, total: 0 }
  );
}

function providerEventIdentity(event: AdminEmailProviderEvent) {
  return event.emailQueueId || event.providerMessageId || event.recipientEmail || event.id;
}

function uniqueEventCount(events: AdminEmailProviderEvent[], eventTypes: string[]) {
  const keys = new Set<string>();
  events.forEach((event) => {
    if (!eventTypes.includes(event.eventType)) return;
    keys.add(providerEventIdentity(event));
  });
  return keys.size;
}

const deliveredSignalEventTypes = ['delivered', 'opened', 'unique_opened', 'clicked'];

function buildProviderDeliverySummary(events: AdminEmailProviderEvent[]): ProviderDeliverySummary {
  return {
    bounced: uniqueEventCount(events, ['bounced', 'hard_bounce', 'soft_bounce', 'blocked', 'invalid_email', 'error']),
    clicked: uniqueEventCount(events, ['clicked']),
    delivered: uniqueEventCount(events, deliveredSignalEventTypes),
    opened: uniqueEventCount(events, ['opened', 'unique_opened']),
    spam: uniqueEventCount(events, ['spam']),
    totalEvents: events.length,
    unsubscribed: uniqueEventCount(events, ['unsubscribed'])
  };
}

function buildWebhookHealth(events: AdminEmailProviderEvent[]): WebhookHealth {
  const latestEvent = [...events].sort((first, second) => new Date(second.occurredAt).getTime() - new Date(first.occurredAt).getTime())[0];
  if (!latestEvent) {
    return {
      activeEndpoint: 'Not detected',
      lastEventType: 'No event',
      lastRecipient: 'No recipient',
      status: 'empty',
      statusLabel: 'Needs setup'
    };
  }

  const endpointSlug = typeof latestEvent.metadata?.endpointSlug === 'string' ? latestEvent.metadata.endpointSlug : '';
  const lastEventTime = new Date(latestEvent.occurredAt).getTime();
  const hoursSinceLastEvent = Number.isFinite(lastEventTime) ? (Date.now() - lastEventTime) / 36e5 : Number.POSITIVE_INFINITY;
  const status = hoursSinceLastEvent > 72 ? 'stale' : 'healthy';

  return {
    activeEndpoint: endpointSlug || 'Historical/backfilled',
    lastEventAt: latestEvent.occurredAt,
    lastEventType: latestEvent.eventType,
    lastRecipient: latestEvent.recipientEmail || 'Recipient not mapped',
    latestEvent,
    status,
    statusLabel: status === 'healthy' ? 'Receiving' : 'Stale'
  };
}

const suppressionEventTypes = ['hard_bounce', 'soft_bounce', 'bounced', 'blocked', 'invalid_email', 'error', 'spam', 'unsubscribed'];

function buildSuppressionRecords(events: AdminEmailProviderEvent[], overrides: AdminEmailSuppressionOverride[]) {
  const byEmail = new Map<string, SuppressionRecord>();

  events
    .filter((event) => event.recipientEmail && suppressionEventTypes.includes(event.eventType))
    .forEach((event) => {
      const email = String(event.recipientEmail).toLowerCase();
      const current = byEmail.get(email);
      const currentTime = current?.lastEventAt ? new Date(current.lastEventAt).getTime() : 0;
      const eventTime = new Date(event.occurredAt).getTime();
      if (!current || eventTime >= currentTime) {
        byEmail.set(email, {
          eventType: event.eventType,
          lastEventAt: event.occurredAt,
          reason: event.reason,
          recipientEmail: email,
          suppressed: true
        });
      }
    });

  const latestOverrides = new Map<string, AdminEmailSuppressionOverride>();
  overrides.forEach((override) => {
    const email = override.recipientEmail.toLowerCase();
    const current = latestOverrides.get(email);
    const currentTime = current?.createdAt ? new Date(current.createdAt).getTime() : 0;
    const overrideTime = override.createdAt ? new Date(override.createdAt).getTime() : 0;
    if (!current || overrideTime >= currentTime) latestOverrides.set(email, override);
  });

  latestOverrides.forEach((override, email) => {
    const current = byEmail.get(email) ?? {
      eventType: 'manual',
      recipientEmail: email,
      suppressed: false
    };
    const eventTime = current.lastEventAt ? new Date(current.lastEventAt).getTime() : 0;
    const overrideTime = override.createdAt ? new Date(override.createdAt).getTime() : 0;
    byEmail.set(email, {
      ...current,
      clearedAt: override.status === 'cleared' ? override.createdAt : current.clearedAt,
      overrideStatus: override.status,
      reason: override.reason || current.reason,
      suppressed: override.status === 'suppressed' || (current.suppressed && eventTime > overrideTime)
    });
  });

  return Array.from(byEmail.values()).sort((first, second) => {
    if (first.suppressed !== second.suppressed) return first.suppressed ? -1 : 1;
    return String(second.lastEventAt ?? second.clearedAt ?? '').localeCompare(String(first.lastEventAt ?? first.clearedAt ?? ''));
  });
}

function percentage(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Math.min(100, Math.round((numerator / denominator) * 100));
}

function buildEngagementSuggestions({
  activeSuppressionCount,
  cohortMetrics,
  currentCampaignTitle,
  providerSummary,
  rotationPlan,
  topCampaign
}: {
  activeSuppressionCount: number;
  cohortMetrics: ReturnType<typeof buildCohortPerformanceMetrics>;
  currentCampaignTitle: string;
  providerSummary: ProviderDeliverySummary;
  rotationPlan: ReturnType<typeof buildRotatingPlan>;
  topCampaign: CampaignPerformanceMetric | null;
}) {
  const openRate = percentage(providerSummary.opened, providerSummary.delivered);
  const clickRate = percentage(providerSummary.clicked, providerSummary.delivered);
  const suggestions: EngagementSuggestion[] = [];

  if (providerSummary.delivered >= 10 && clickRate >= 8 && topCampaign) {
    suggestions.push({
      action: 'Repeat or adapt this campaign before changing the theme.',
      campaignPhase: topCampaign.phase,
      detail: `${topCampaign.title} is currently the strongest campaign by sent recipients and has enough provider activity to reuse its angle.`,
      kind: 'campaign',
      metric: `${clickRate}% click rate`,
      title: 'Lean into the campaign that is working',
      tone: 'safe'
    });
  } else if (providerSummary.delivered >= 10 && openRate < 25) {
    suggestions.push({
      action: 'Try a warmer touch-base subject and a short personal first line.',
      campaignPhase: 'general',
      detail: 'Provider opens are low, so the next campaign should focus on relevance and subject clarity before asking for a click.',
      kind: 'campaign',
      metric: `${openRate}% open rate`,
      title: 'Improve opens before pushing resources',
      tone: 'warning'
    });
  } else if (providerSummary.delivered >= 10 && clickRate < 3) {
    suggestions.push({
      action: 'Use a resource-sharing campaign with one clear CTA.',
      campaignPhase: 'resource_share',
      detail: 'Students are receiving emails, but clicks are still thin. A single useful LMS resource is a cleaner engagement test.',
      kind: 'campaign',
      metric: `${clickRate}% click rate`,
      title: 'Test one useful resource',
      tone: 'warning'
    });
  } else {
    suggestions.push({
      action: 'Continue with today’s planned campaign and collect more provider events.',
      detail: `${currentCampaignTitle} is still a reasonable next send while the provider sample grows.`,
      kind: 'rotation',
      metric: `${providerSummary.totalEvents} events`,
      title: 'Keep the rotation moving',
      tone: 'neutral'
    });
  }

  const untouchedCohort = rotationPlan.activeCohorts.find((cohort) => !cohortMetrics.some((metric) => metric.cohortName === cohort.name && metric.sentPlans > 0));
  const oldestCohort = [...cohortMetrics].sort((first, second) => {
    const firstTime = first.lastSentAt ? new Date(first.lastSentAt).getTime() : 0;
    const secondTime = second.lastSentAt ? new Date(second.lastSentAt).getTime() : 0;
    return firstTime - secondTime;
  })[0];

  if (untouchedCohort) {
    suggestions.push({
      action: 'Prioritize this cohort in the next rotation window.',
      cohortName: untouchedCohort.name,
      detail: `${untouchedCohort.name} has active students but no sent Email Marketing touch in the recent performance window.`,
      kind: 'cohort',
      metric: `${untouchedCohort.studentCount} students`,
      title: 'Cohort needs first touch',
      tone: 'warning'
    });
  } else if (oldestCohort) {
    suggestions.push({
      action: 'Use this as the fallback cohort if today’s batch has spare capacity.',
      cohortName: oldestCohort.cohortName,
      detail: `${oldestCohort.cohortName} has the oldest recent sent touch among tracked cohorts.`,
      kind: 'cohort',
      metric: `last ${formatDate(oldestCohort.lastSentAt)}`,
      title: 'Oldest engagement cohort',
      tone: 'neutral'
    });
  }

  if (activeSuppressionCount > 0) {
    suggestions.push({
      action: 'Review and clear only fixed addresses before the next large batch.',
      detail: 'Suppressed recipients are already excluded from preview and send, but unresolved issues reduce useful reach.',
      kind: 'suppression',
      metric: `${activeSuppressionCount} active`,
      title: 'Clean up suppressed recipients',
      tone: 'warning'
    });
  }

  return suggestions.slice(0, 4);
}

function firstNameToken() {
  return '{student_name}';
}

function buildSmartCopyVariants({
  campaignTitle,
  cohortNames,
  copySignal,
  resourceTitles
}: {
  campaignTitle: string;
  cohortNames: string[];
  copySignal?: EngagementSuggestion;
  resourceTitles: string[];
}) {
  const cohortLabel = cohortNames.length === 1 ? cohortNames[0] : cohortNames.length ? `${cohortNames.slice(0, 2).join(', ')}${cohortNames.length > 2 ? ` +${cohortNames.length - 2}` : ''}` : 'your cohort';
  const resourceTitle = resourceTitles[0] ?? 'a useful LMS resource';
  const firstName = firstNameToken();
  const signalKind = copySignal?.kind ?? 'rotation';

  const warmTouchBase: SmartCopyVariant = {
    focus: 'Warm touch-base',
    subject: `${firstName}, a quick check-in for ${cohortLabel}`,
    body: `Hi ${firstName},\n\nHope your learning momentum is going well.\n\nWe are checking in with ${cohortLabel} today so you do not miss the next useful LMS update. Please log in once, review your pending learning items, and continue from the latest resource/session relevant to you.\n\nIf you are stuck anywhere, reply to this email and the team will guide you.\n\nRegards,\nSkilled Sapiens Team`,
    tone: signalKind === 'campaign' ? 'safe' : 'neutral'
  };

  const resourceShare: SmartCopyVariant = {
    focus: 'One-resource CTA',
    subject: `${firstName}, use this resource before your next LMS step`,
    body: `Hi ${firstName},\n\nWe picked one resource that can help you move forward today: ${resourceTitle}.\n\nPlease open your LMS, review this resource, and note one action you can complete from it this week. Keeping this small and focused will help you stay consistent without feeling overloaded.\n\nRegards,\nSkilled Sapiens Team`,
    tone: signalKind === 'campaign' ? 'safe' : 'neutral'
  };

  const urgencyNudge: SmartCopyVariant = {
    focus: 'Gentle nudge',
    subject: `${cohortLabel}: your next LMS action is ready`,
    body: `Hi ${firstName},\n\nThis is a quick reminder from the Skilled Sapiens team.\n\nYour cohort has a fresh LMS touchpoint today. Please take a few minutes to check the latest update, complete any pending action, and stay aligned with the cohort pace.\n\nSmall regular progress matters more than waiting for a perfect long study window.\n\nRegards,\nSkilled Sapiens Team`,
    tone: copySignal?.tone ?? 'neutral'
  };

  if (copySignal?.campaignPhase === 'resource_share') return [resourceShare, warmTouchBase, urgencyNudge];
  if (copySignal?.campaignPhase === 'general') return [warmTouchBase, urgencyNudge, resourceShare];
  if (campaignTitle.toLowerCase().includes('resource')) return [resourceShare, warmTouchBase, urgencyNudge];
  return [warmTouchBase, resourceShare, urgencyNudge];
}

function buildAbCopyVariants(variants: SmartCopyVariant[]): AbCopyVariant[] {
  return variants.slice(0, 2).map((variant, index) => ({
    ...variant,
    variantKey: index === 0 ? 'A' : 'B'
  }));
}

function copyStatsForSubject(events: AdminEmailProviderEvent[], subject: string): AbCopyStats {
  const subjectEvents = events.filter((event) => event.subject === subject);
  return {
    clicked: uniqueEventCount(subjectEvents, ['clicked']),
    delivered: uniqueEventCount(subjectEvents, deliveredSignalEventTypes),
    opened: uniqueEventCount(subjectEvents, ['opened', 'unique_opened'])
  };
}

function engagementScore(stats: AbCopyStats) {
  return (stats.clicked * 3) + stats.opened + Math.round(stats.delivered * 0.2);
}

function eventTone(eventType: string) {
  if (eventType === 'sent' || eventType === 'reviewed') return 'safe';
  if (eventType === 'skipped' || eventType === 'cancelled') return 'warning';
  return 'neutral';
}

function eventDetailText(details: Record<string, unknown>) {
  const title = typeof details.title === 'string' ? details.title : '';
  const focus = typeof details.focus === 'string' ? details.focus : '';
  const subject = typeof details.subject === 'string' ? details.subject : '';
  const cohortName = typeof details.cohortName === 'string' ? details.cohortName : '';
  const activeVariantKey = typeof details.activeVariantKey === 'string' ? details.activeVariantKey : '';
  const sent = typeof details.sent === 'number' ? details.sent : null;
  const failed = typeof details.failed === 'number' ? details.failed : null;

  if (activeVariantKey) return `A/B variant ${activeVariantKey}${subject ? ` · ${subject}` : ''}`;
  if (focus) return `${focus}${subject ? ` · ${subject}` : ''}`;
  if (title) return `${title}${cohortName ? ` · ${cohortName}` : ''}`;
  if (sent !== null || failed !== null) return `${sent ?? 0} sent · ${failed ?? 0} failed`;
  if (cohortName) return cohortName;
  return 'Plan event recorded.';
}

function setupChecklistTone(ready: boolean, warning = false): 'safe' | 'warning' | 'neutral' {
  if (ready) return 'safe';
  return warning ? 'warning' : 'neutral';
}

export function AdminEmailMarketingPage() {
  const [activeTab, setActiveTab] = useState<EmailMarketingTab>('today');
  const [targetCount, setTargetCount] = useState(defaultSuggestedBatch);
  const [groupingStrategy, setGroupingStrategy] = useState<CohortGroupingStrategy>('oldest_touch');
  const [viewDensity, setViewDensity] = useState<'comfortable' | 'compact'>('compact');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('active');
  const [campaignStatusFilter, setCampaignStatusFilter] = useState('active');
  const [campaignPhaseFilter, setCampaignPhaseFilter] = useState('all');
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [campaignDraft, setCampaignDraft] = useState<CampaignDraft | null>(null);
  const [recipientPreview, setRecipientPreview] = useState<AdminEmailResolveResult | null>(null);
  const [rescheduleDates, setRescheduleDates] = useState<Record<string, string>>({});
  const autoDraftAttemptedRef = useRef('');
  const cohortsQuery = useAdminAllCohorts({ status: 'all', sort: 'start_date' });
  const cohorts = cohortsQuery.data?.items ?? [];
  const cohortNames = useMemo(() => cohorts.map((cohort) => cohort.name).filter(Boolean), [cohorts]);
  const cohortCardMetricsQuery = useAdminCohortCardMetrics(cohortNames);
  const campaignsQuery = useAdminEmailMarketingCampaigns({ status: 'all' });
  const cohortTouchQuery = useAdminEmailMarketingCohortTouch();
  const templatesQuery = useAdminEmailTemplates({ sort: 'order', status: 'all' });
  const queueQuery = useAdminEmailQueue({ limit: 50 });
  const providerEventsQuery = useAdminEmailProviderEvents({ limit: 300 });
  const suppressionOverridesQuery = useAdminEmailSuppressionOverrides({ limit: 300 });
  const resourcesQuery = useAdminResources({ limit: 8, page: 1, status: 'active' });
  const today = useMemo(() => new Date(), []);
  const todayKey = isoDate(today);
  const todayPlanQuery = useAdminEmailMarketingPlans({ limit: 1, plannedDate: todayKey });
  const planHistoryQuery = useAdminEmailMarketingPlans({ limit: 50, status: 'all' });
  const todayPlanId = todayPlanQuery.data?.items?.[0]?.id ?? '';
  const todayPlanEventsQuery = useAdminEmailMarketingPlanEvents({ enabled: Boolean(todayPlanId), limit: 30, planId: todayPlanId });
  const createCampaign = useCreateAdminEmailMarketingCampaign();
  const updateCampaign = useUpdateAdminEmailMarketingCampaign();
  const resolveRecipients = useResolveAdminEmailRecipients();
  const createPlan = useCreateAdminEmailMarketingPlan();
  const updatePlan = useUpdateAdminEmailMarketingPlan();
  const createPlanEvent = useCreateAdminEmailMarketingPlanEvent();
  const createSuppressionOverride = useCreateAdminEmailSuppressionOverride();

  const cohortTouches = useMemo(() => {
    return new Map((cohortTouchQuery.data?.items ?? []).map((item) => [item.cohortName, item.lastTouchedAt]));
  }, [cohortTouchQuery.data?.items]);
  const liveCohorts = useMemo(
    () =>
      cohorts.map((cohort) => ({
        ...cohort,
        studentCount: cohortCardMetricsQuery.data?.[cohort.name]?.students ?? cohort.studentCount
      })),
    [cohortCardMetricsQuery.data, cohorts]
  );
  const liveCohortCountByName = useMemo(() => new Map(liveCohorts.map((cohort) => [cohort.name, cohort.studentCount])), [liveCohorts]);
  const cohortProgramOptions = useMemo(() => Array.from(new Set(liveCohorts.map((cohort) => cohort.programKey).filter((value): value is string => Boolean(value)))).sort(), [liveCohorts]);
  const cohortDomainOptions = useMemo(() => Array.from(new Set(liveCohorts.map((cohort) => cohort.domainKey).filter((value): value is string => Boolean(value)))).sort(), [liveCohorts]);
  const selectedGroupingOption = cohortGroupingOptions.find((option) => option.value === groupingStrategy) ?? cohortGroupingOptions[0];
  const plan = useMemo(() => buildRotatingPlan(liveCohorts, targetCount, today, cohortTouches, groupingStrategy), [cohortTouches, groupingStrategy, liveCohorts, targetCount, today]);
  const templates = templatesQuery.data?.items ?? [];
  const activeTemplates = useMemo(() => templates.filter((template) => template.status === 'active'), [templates]);
  const campaigns = campaignsQuery.data?.items ?? [];
  const templatePhases = useMemo(() => new Set(activeTemplates.map((template) => template.phase || template.category)), [activeTemplates]);
  const fallbackCampaign = pickCampaignIdea(dayOfYear(today), templatePhases);
  const savedCampaign = pickSavedCampaign(dayOfYear(today), campaigns, plan.selected, cohortTouches, today, buildCampaignDiversityContext(planHistoryQuery.data?.items ?? [], todayKey));
  const campaign = savedCampaign
    ? {
        description: savedCampaign.description ?? 'Saved campaign from Email Marketing configuration.',
        phase: savedCampaign.phase,
        priority: savedCampaign.rotationWeight >= 110 ? 'High' : savedCampaign.rotationWeight >= 80 ? 'Medium' : 'Low',
        title: savedCampaign.title
      } satisfies CampaignIdea
    : fallbackCampaign;
  const todayPlan = todayPlanQuery.data?.items?.[0] ?? null;
  const todayPlanEvents = todayPlanEventsQuery.data?.items ?? [];
  const displayedPlan: AdminEmailMarketingPlan | null = todayPlan;
  const matchingTemplates = activeTemplates.filter((template) => template.phase === campaign.phase || template.category === campaign.phase).slice(0, 3);
  const resources = resourcesQuery.data?.items ?? [];
  const resourceDomainOptions = useMemo(() => {
    return Array.from(
      new Set(
        resources
          .map((resource) => resource.resourceDomainKey)
          .filter((domainKey): domainKey is string => Boolean(domainKey))
      )
    ).sort();
  }, [resources]);
  const suggestedResourceCohorts = displayedPlan?.cohortNames?.length ? displayedPlan.cohortNames : plan.selected.map((cohort) => cohort.name);
  const suggestedResources = [...resources]
    .map((resource) => ({ resource, score: scoreResourceForCampaign(resource, savedCampaign, suggestedResourceCohorts) }))
    .sort((first, second) => second.score - first.score || String(second.resource.updatedAt ?? '').localeCompare(String(first.resource.updatedAt ?? '')))
    .slice(0, 4)
    .map((item) => item.resource);
  const queueItems = queueQuery.data?.items ?? [];
  const providerEvents = providerEventsQuery.data?.items ?? [];
  const suppressionOverrides = suppressionOverridesQuery.data?.items ?? [];
  const displayedPlanLiveRecipientCount = displayedPlan?.cohortNames.length
    ? displayedPlan.cohortNames.reduce((sum, cohortName) => sum + (liveCohortCountByName.get(cohortName) ?? 0), 0)
    : null;
  const plannedRecipientCount = displayedPlanLiveRecipientCount ?? displayedPlan?.plannedRecipientCount ?? plan.total;
  const activeDailyLimit = displayedPlan?.dailyLimit ?? dailyLimit;
  const remainingDailyCapacity = Math.max(0, activeDailyLimit - plannedRecipientCount);
  const savedPlanBatchSize = todayPlan?.suggestedBatchSize ?? null;
  const savedPlanGroupingStrategy = typeof todayPlan?.metadata?.groupingStrategy === 'string' && cohortGroupingOptions.some((option) => option.value === todayPlan.metadata.groupingStrategy)
    ? todayPlan.metadata.groupingStrategy as CohortGroupingStrategy
    : null;
  const hasSavedPlanBatchMismatch = savedPlanBatchSize !== null && savedPlanBatchSize !== targetCount;
  const hasSavedPlanGroupingMismatch = savedPlanGroupingStrategy !== null && savedPlanGroupingStrategy !== groupingStrategy;
  const batchCapSourceLabel = savedPlanBatchSize !== null ? `today’s saved plan (${savedPlanBatchSize})` : `Suggested daily target (${targetCount})`;
  const effectiveGroupingStrategy = savedPlanGroupingStrategy ?? groupingStrategy;
  const effectiveGroupingOption = cohortGroupingOptions.find((option) => option.value === effectiveGroupingStrategy) ?? selectedGroupingOption;
  const effectiveBatchCap = displayedPlan?.suggestedBatchSize ?? targetCount;
  const activePlanCohortNames = displayedPlan?.cohortNames.length ? displayedPlan.cohortNames : plan.selected.map((cohort) => cohort.name);
  const activePlanLiveStudents = activePlanCohortNames.reduce((sum, cohortName) => sum + (liveCohortCountByName.get(cohortName) ?? 0), 0);
  const activePlanCampaign = displayedPlan?.campaignId ? campaigns.find((item) => item.id === displayedPlan.campaignId) ?? savedCampaign : savedCampaign;
  const campaignFitSignals = useMemo(() => {
    const rules = activePlanCampaign?.audienceRules ?? {};
    const signals: string[] = [];
    const audienceTag = stringRule(rules, 'audienceTag');
    const programKey = stringRule(rules, 'programKey');
    const domainKey = stringRule(rules, 'domainKey');
    const stage = stringRule(rules, 'cohortStage');
    const activitySegment = stringRule(rules, 'activitySegment');
    if (audienceTag) signals.push(campaignAudienceTagOptions.find((option) => option.value === audienceTag)?.label ?? audienceTag);
    if (programKey) signals.push(`Program: ${programKey}`);
    if (domainKey) signals.push(`Domain: ${domainKey}`);
    if (stage) signals.push(cohortStageOptions.find((option) => option.value === stage)?.label ?? stage);
    if (activitySegment) signals.push(activitySegmentOptions.find((option) => option.value === activitySegment)?.label ?? activitySegment);
    return signals;
  }, [activePlanCampaign]);
  const deferredRecipientCount = recipientPreview ? Math.max(0, recipientPreview.deliverableRecipients - recipientPreview.willSend) : null;
  const planHistory = (planHistoryQuery.data?.items ?? []).filter((item) => item.id !== todayPlan?.id);
  const recentPlans = todayPlan ? [todayPlan, ...planHistory] : planHistory;
  const visiblePlanHistory = planHistory
    .filter((item) => {
      if (historyStatusFilter === 'all') return true;
      if (historyStatusFilter === 'active') return !['cancelled', 'skipped', 'sent'].includes(item.status);
      return item.status === historyStatusFilter;
    })
    .slice(0, 8);
  const visibleCampaigns = campaigns.filter((item) => {
    const statusMatch = campaignStatusFilter === 'all' || item.status === campaignStatusFilter;
    const phaseMatch = campaignPhaseFilter === 'all' || item.phase === campaignPhaseFilter;
    return statusMatch && phaseMatch;
  });
  const campaignPerformanceMetrics = useMemo(() => buildCampaignPerformanceMetrics(recentPlans), [recentPlans]);
  const cohortPerformanceMetrics = useMemo(() => buildCohortPerformanceMetrics(recentPlans), [recentPlans]);
  const deliveryPerformanceSummary = useMemo(() => buildDeliveryPerformanceSummary(queueItems), [queueItems]);
  const providerDeliverySummary = useMemo(() => buildProviderDeliverySummary(providerEvents), [providerEvents]);
  const webhookHealth = useMemo(() => buildWebhookHealth(providerEvents), [providerEvents]);
  const suppressionRecords = useMemo(() => buildSuppressionRecords(providerEvents, suppressionOverrides), [providerEvents, suppressionOverrides]);
  const activeSuppressionRecords = suppressionRecords.filter((record) => record.suppressed);
  const topCampaignMetric = campaignPerformanceMetrics[0] ?? null;
  const engagementSuggestions = useMemo(
    () =>
      buildEngagementSuggestions({
        activeSuppressionCount: activeSuppressionRecords.length,
        cohortMetrics: cohortPerformanceMetrics,
        currentCampaignTitle: displayedPlan?.campaignTitle ?? campaign.title,
        providerSummary: providerDeliverySummary,
        rotationPlan: plan,
        topCampaign: topCampaignMetric
      }),
    [activeSuppressionRecords.length, campaign.title, cohortPerformanceMetrics, displayedPlan?.campaignTitle, plan, providerDeliverySummary, topCampaignMetric]
  );
  const smartCopyVariants = useMemo(
    () =>
      buildSmartCopyVariants({
        campaignTitle: displayedPlan?.campaignTitle ?? campaign.title,
        cohortNames: displayedPlan?.cohortNames?.length ? displayedPlan.cohortNames : plan.selected.map((cohort) => cohort.name),
        copySignal: engagementSuggestions[0],
        resourceTitles: suggestedResources.map((resource) => resource.title)
      }),
    [campaign.title, displayedPlan?.campaignTitle, displayedPlan?.cohortNames, engagementSuggestions, plan.selected, suggestedResources]
  );
  const abCopyVariants = useMemo(() => buildAbCopyVariants(smartCopyVariants), [smartCopyVariants]);
  const abCopyStats = useMemo(() => {
    return new Map(abCopyVariants.map((variant) => [variant.variantKey, copyStatsForSubject(providerEvents, variant.subject)]));
  }, [abCopyVariants, providerEvents]);
  const recommendedAbVariant = useMemo(() => {
    const [first, second] = abCopyVariants;
    if (!first || !second) return first ?? null;
    const firstStats = abCopyStats.get(first.variantKey) ?? { clicked: 0, delivered: 0, opened: 0 };
    const secondStats = abCopyStats.get(second.variantKey) ?? { clicked: 0, delivered: 0, opened: 0 };
    if (firstStats.delivered + secondStats.delivered < 10) return null;
    return engagementScore(secondStats) > engagementScore(firstStats) ? second : first;
  }, [abCopyStats, abCopyVariants]);
  const setupChecklist = useMemo<SetupChecklistItem[]>(() => {
    const activeCampaignCount = campaigns.filter((item) => item.status === 'active').length;
    const mappedTemplateCount = activeTemplates.filter((template) => campaigns.some((item) => item.status === 'active' && item.templateKey === template.templateKey)).length;
    const previewReady = Boolean(recipientPreview && recipientPreview.ok);
    const quotaReady = recipientPreview ? recipientPreview.remainingToday > 0 && recipientPreview.willSend > 0 : remainingDailyCapacity > 0;
    const draftReady = Boolean(todayPlan && ['draft', 'reviewed'].includes(todayPlan.status));
    const copyReady = Boolean(todayPlan?.suggestedSubject && todayPlan?.suggestedBody);

    return [
      {
        detail: `${activeCampaignCount} active campaign${activeCampaignCount === 1 ? '' : 's'}`,
        label: 'Campaigns configured',
        ready: activeCampaignCount > 0,
        tone: setupChecklistTone(activeCampaignCount > 0, true)
      },
      {
        detail: mappedTemplateCount ? `${mappedTemplateCount} preferred template${mappedTemplateCount === 1 ? '' : 's'} mapped` : `${activeTemplates.length} active template${activeTemplates.length === 1 ? '' : 's'} available`,
        label: 'Templates mapped',
        ready: mappedTemplateCount > 0 || activeTemplates.length > 0,
        tone: setupChecklistTone(mappedTemplateCount > 0 || activeTemplates.length > 0, true)
      },
      {
        detail: providerDeliverySummary.totalEvents ? `${providerDeliverySummary.totalEvents} provider event${providerDeliverySummary.totalEvents === 1 ? '' : 's'} received` : 'No provider webhook events yet',
        label: 'Brevo webhook',
        ready: providerDeliverySummary.totalEvents > 0,
        tone: setupChecklistTone(providerDeliverySummary.totalEvents > 0)
      },
      {
        detail: activeSuppressionRecords.length ? `${activeSuppressionRecords.length} active suppression${activeSuppressionRecords.length === 1 ? '' : 's'}` : 'Suppression safety active',
        label: 'Suppression safety',
        ready: true,
        tone: activeSuppressionRecords.length ? 'warning' : 'safe'
      },
      {
        detail: todayPlan ? `Today’s plan is ${todayPlan.status}` : 'Draft will be prepared when planner opens',
        label: 'Today’s draft',
        ready: draftReady,
        tone: setupChecklistTone(draftReady, true)
      },
      {
        detail: copyReady ? 'Subject and body are ready' : 'Pick smart copy or use campaign defaults',
        label: 'Copy ready',
        ready: copyReady,
        tone: setupChecklistTone(copyReady)
      },
      {
        detail: previewReady ? `${recipientPreview?.willSend ?? 0} ready for this batch` : 'Run Preview Recipients before sending',
        label: 'Recipient preview',
        ready: previewReady,
        tone: setupChecklistTone(previewReady, true)
      },
      {
        detail: recipientPreview ? `${recipientPreview.remainingToday} emails left today` : `${remainingDailyCapacity} estimated after plan`,
        label: 'Send quota',
        ready: quotaReady,
        tone: setupChecklistTone(quotaReady, true)
      }
    ];
  }, [activeSuppressionRecords.length, activeTemplates, campaigns, providerDeliverySummary.totalEvents, recipientPreview, remainingDailyCapacity, todayPlan]);
  const readyChecklistCount = setupChecklist.filter((item) => item.ready).length;
  const sendFlowSteps = useMemo<EmailMarketingStep[]>(() => {
    const hasPlan = Boolean(todayPlan);
    const hasCohorts = Boolean((displayedPlan?.cohortNames.length ?? plan.selected.length) > 0);
    const hasCopy = Boolean(displayedPlan?.suggestedSubject && displayedPlan?.suggestedBody);
    const hasPreview = Boolean(recipientPreview?.ok);
    const sent = todayPlan?.status === 'sent';

    return [
      {
        action: hasCohorts ? 'Ready' : 'Check',
        detail: hasCohorts ? `${displayedPlan?.cohortNames.length ?? plan.selected.length} cohort${(displayedPlan?.cohortNames.length ?? plan.selected.length) === 1 ? '' : 's'} in today’s rotation.` : 'No cohort is selected yet.',
        done: hasCohorts,
        label: 'Audience',
        tone: hasCohorts ? 'safe' : 'warning'
      },
      {
        action: hasCopy || hasPlan ? 'Ready' : 'Review',
        detail: hasCopy ? 'Subject and body are prepared.' : 'Review or edit the email in Email Centre.',
        done: hasCopy,
        label: 'Email',
        tone: hasCopy || hasPlan ? 'safe' : 'neutral'
      },
      {
        action: hasPreview ? 'Checked' : 'Preview',
        detail: hasPreview ? `${recipientPreview?.willSend ?? 0} deliverable recipient${recipientPreview?.willSend === 1 ? '' : 's'} for this batch.` : 'Run recipient preview before opening the send confirmation.',
        done: hasPreview,
        label: 'Safety',
        tone: hasPreview ? 'safe' : 'warning'
      },
      {
        action: sent ? 'Sent' : 'Rehearse first',
        detail: sent ? 'Today’s campaign is complete.' : 'Rehearse with QA, then send production from Email Centre.',
        done: sent,
        label: 'Send',
        tone: sent ? 'safe' : 'neutral'
      }
    ];
  }, [displayedPlan?.cohortNames.length, displayedPlan?.suggestedBody, displayedPlan?.suggestedSubject, plan.selected.length, recipientPreview?.ok, recipientPreview?.willSend, todayPlan]);
  const upcomingPlanPreviews = useMemo(
    () =>
      buildUpcomingPlanPreviews({
        campaigns,
        cohortTouches,
        cohorts: liveCohorts,
        diversityContext: buildCampaignDiversityContext(planHistoryQuery.data?.items ?? [], todayKey),
        groupingStrategy,
        startDate: today,
        targetCount,
        templatePhases
      }),
    [campaigns, cohortTouches, groupingStrategy, liveCohorts, planHistoryQuery.data?.items, targetCount, templatePhases, today, todayKey]
  );

  const isCohortMetricsLoading = cohortNames.length > 0 && cohortCardMetricsQuery.isLoading;
  const isLoading = cohortsQuery.isLoading || isCohortMetricsLoading || campaignsQuery.isLoading || templatesQuery.isLoading || todayPlanQuery.isLoading || cohortTouchQuery.isLoading || planHistoryQuery.isLoading || providerEventsQuery.isLoading || suppressionOverridesQuery.isLoading || todayPlanEventsQuery.isLoading;
  const isError = cohortsQuery.isError || cohortCardMetricsQuery.isError || campaignsQuery.isError || templatesQuery.isError || todayPlanQuery.isError || cohortTouchQuery.isError || planHistoryQuery.isError || providerEventsQuery.isError || suppressionOverridesQuery.isError || todayPlanEventsQuery.isError;

  useEffect(() => {
    if (isLoading || isError || todayPlan || !plan.selected.length || createPlan.isPending) return;
    if (autoDraftAttemptedRef.current === todayKey) return;
    autoDraftAttemptedRef.current = todayKey;

    const payload = {
      ...buildPlanPayload({ campaign: savedCampaign, cohortPlan: plan, cohortTouches, fallbackCampaign, groupingStrategy, targetCount, todayKey }),
      resourceIds: suggestedResources.map((resource) => resource.id)
    };

    void (async () => {
      try {
        const savedPlan = await createPlan.mutateAsync(payload);
        await createPlanEvent.mutateAsync({
          details: {
            autoCreated: true,
            cohortNames: payload.cohortNames,
            plannedRecipientCount: payload.plannedRecipientCount
          },
          eventType: 'created',
          planId: savedPlan.id
        });
        await todayPlanQuery.refetch();
        setMessage({ tone: 'success', text: 'Today’s Email Marketing draft was prepared automatically.' });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Auto draft could not be prepared.';
        if (/already exists|duplicate|unique/i.test(errorMessage)) {
          await todayPlanQuery.refetch();
          return;
        }
        setMessage({ tone: 'error', text: errorMessage });
      }
    })();
  }, [
    cohortTouches,
    createPlan,
    createPlanEvent,
    fallbackCampaign,
    groupingStrategy,
    isError,
    isLoading,
    plan,
    savedCampaign,
    suggestedResources,
    targetCount,
    todayKey,
    todayPlan,
    todayPlanQuery
  ]);

  async function refreshTodayPlan(nextTargetCount = targetCount, nextGroupingStrategy = groupingStrategy) {
    setMessage(null);
    const nextPlan = nextTargetCount === targetCount && nextGroupingStrategy === groupingStrategy
      ? plan
      : buildRotatingPlan(liveCohorts, nextTargetCount, today, cohortTouches, nextGroupingStrategy);
    if (!nextPlan.selected.length) {
      setMessage({ tone: 'error', text: 'No active cohorts with live linked students are available for today’s Email Marketing plan.' });
      return;
    }
    const nextSavedCampaign = pickSavedCampaign(dayOfYear(today), campaigns, nextPlan.selected, cohortTouches, today);
    const nextCohortNames = nextPlan.selected.map((cohort) => cohort.name);
    const nextSuggestedResources = [...resources]
      .map((resource) => ({ resource, score: scoreResourceForCampaign(resource, nextSavedCampaign, nextCohortNames) }))
      .sort((first, second) => second.score - first.score || String(second.resource.updatedAt ?? '').localeCompare(String(first.resource.updatedAt ?? '')))
      .slice(0, 4)
      .map((item) => item.resource);
    const payload = {
      ...buildPlanPayload({ campaign: nextSavedCampaign, cohortPlan: nextPlan, cohortTouches, fallbackCampaign, groupingStrategy: nextGroupingStrategy, targetCount: nextTargetCount, todayKey }),
      resourceIds: nextSuggestedResources.map((resource) => resource.id)
    };
    try {
      const savedPlan = todayPlan
        ? await updatePlan.mutateAsync({ body: payload, planId: todayPlan.id })
        : await createPlan.mutateAsync(payload);
      await createPlanEvent.mutateAsync({
        details: { cohortNames: payload.cohortNames, groupingStrategy: nextGroupingStrategy, plannedRecipientCount: payload.plannedRecipientCount, suggestedBatchSize: payload.suggestedBatchSize },
        eventType: todayPlan ? 'note' : 'created',
        planId: savedPlan.id
      });
      await todayPlanQuery.refetch();
      setRecipientPreview(null);
      setMessage({ tone: 'success', text: todayPlan ? 'Today’s Email Marketing plan was refreshed.' : 'Today’s Email Marketing plan was saved.' });
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Today’s plan could not be saved.' });
    }
  }

  async function handleSaveTodayPlan() {
    await refreshTodayPlan(targetCount, groupingStrategy);
  }

  async function handleTargetCountChange(nextTargetCount: number) {
    setTargetCount(nextTargetCount);
    setRecipientPreview(null);
    if (!todayPlan || todayPlan.suggestedBatchSize === nextTargetCount) return;
    if (!['draft', 'reviewed'].includes(todayPlan.status)) {
      setMessage({ tone: 'error', text: `Suggested daily target changed to ${nextTargetCount}, but today’s ${todayPlan.status} plan cannot be refreshed.` });
      return;
    }
    const shouldRefresh = window.confirm(`Refresh today’s saved Email Marketing plan with a ${nextTargetCount}-student batch cap?`);
    if (!shouldRefresh) return;
    await refreshTodayPlan(nextTargetCount, groupingStrategy);
  }

  async function handleGroupingStrategyChange(nextGroupingStrategy: CohortGroupingStrategy) {
    setGroupingStrategy(nextGroupingStrategy);
    setRecipientPreview(null);
    if (!todayPlan || savedPlanGroupingStrategy === nextGroupingStrategy) return;
    if (!['draft', 'reviewed'].includes(todayPlan.status)) {
      setMessage({ tone: 'error', text: `Cohort grouping changed, but today’s ${todayPlan.status} plan cannot be refreshed.` });
      return;
    }
    const nextOption = cohortGroupingOptions.find((option) => option.value === nextGroupingStrategy);
    const shouldRefresh = window.confirm(`Refresh today’s saved Email Marketing plan using "${nextOption?.label ?? 'the selected grouping'}"?`);
    if (!shouldRefresh) return;
    await refreshTodayPlan(targetCount, nextGroupingStrategy);
  }

  async function previewRecipients() {
    setMessage(null);
    setRecipientPreview(null);
    const payload = {
      ...buildPlanPayload({ campaign: savedCampaign, cohortPlan: plan, cohortTouches, fallbackCampaign, groupingStrategy, targetCount, todayKey }),
      resourceIds: suggestedResources.map((resource) => resource.id)
    };
    const cohortNames = displayedPlan?.cohortNames?.length ? displayedPlan.cohortNames : payload.cohortNames;
    if (!cohortNames.length) {
      setMessage({ tone: 'error', text: 'No cohorts are selected for today’s Email Marketing plan.' });
      return;
    }

    try {
      const result = await resolveRecipients.mutateAsync({
        action: 'resolveAdminStudentCommunication',
        batchSize: displayedPlan?.suggestedBatchSize ?? payload.suggestedBatchSize,
        body: displayedPlan?.suggestedBody || payload.suggestedBody || 'Email Marketing recipient preview.',
        cohortNames,
        params: {
          cohort: cohortNames.join(', '),
          cohorts: cohortNames.join(', ')
        },
        sendMode: 'cohort_students',
        subject: displayedPlan?.suggestedSubject || payload.suggestedSubject || payload.campaignTitle,
        templateKey: savedCampaign?.templateKey || displayedPlan?.campaignPhase || payload.campaignPhase
      });
      setRecipientPreview(result);
      setMessage({ tone: result.ok ? 'success' : 'error', text: result.message || 'Recipient preview refreshed.' });
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Recipient preview could not be resolved.' });
    }
  }

  async function handlePlanStatus(nextStatus: 'reviewed' | 'skipped') {
    if (!todayPlan) return;
    setMessage(null);
    try {
      await updatePlan.mutateAsync({
        body: nextStatus === 'skipped'
          ? { skipReason: 'Skipped from Email Marketing planner.', skippedAt: new Date().toISOString(), status: nextStatus }
          : { status: nextStatus },
        planId: todayPlan.id
      });
      await createPlanEvent.mutateAsync({
        details: nextStatus === 'skipped' ? { reason: 'Skipped from Email Marketing planner.' } : {},
        eventType: nextStatus,
        planId: todayPlan.id
      });
      await todayPlanQuery.refetch();
      setMessage({ tone: 'success', text: nextStatus === 'reviewed' ? 'Today’s plan is marked reviewed.' : 'Today’s plan is marked skipped.' });
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Plan status could not be updated.' });
    }
  }

  async function refetchPlannerPlans() {
    await Promise.all([todayPlanQuery.refetch(), todayPlanEventsQuery.refetch(), planHistoryQuery.refetch(), providerEventsQuery.refetch(), suppressionOverridesQuery.refetch(), cohortTouchQuery.refetch()]);
  }

  async function handleSuppressionOverride(recipientEmail: string, status: 'cleared' | 'suppressed', reason: string) {
    setMessage(null);
    try {
      await createSuppressionOverride.mutateAsync({
        reason,
        recipientEmail,
        status
      });
      await Promise.all([suppressionOverridesQuery.refetch(), providerEventsQuery.refetch()]);
      setMessage({ tone: 'success', text: status === 'cleared' ? 'Suppression was cleared for this email.' : 'Email was manually suppressed.' });
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Suppression override could not be saved.' });
    }
  }

  async function applyEngagementSuggestion(suggestion: EngagementSuggestion) {
    setMessage(null);
    if (suggestion.kind === 'suppression') {
      setMessage({ tone: 'error', text: 'Use the Recipient safety list to manage suppression records.' });
      return;
    }
    if (todayPlan && !['draft', 'reviewed'].includes(todayPlan.status)) {
      setMessage({ tone: 'error', text: 'Only draft or reviewed Email Marketing plans can be updated from a smart suggestion.' });
      return;
    }

    const phaseCampaigns = suggestion.campaignPhase
      ? campaigns
          .filter((item) => item.status === 'active' && item.phase === suggestion.campaignPhase)
          .sort((first, second) => second.rotationWeight - first.rotationWeight)
      : [];
    const appliedCampaign = phaseCampaigns[0] ?? savedCampaign;
    const appliedFallback = suggestion.campaignPhase
      ? campaignIdeas.find((idea) => idea.phase === suggestion.campaignPhase) ?? fallbackCampaign
      : fallbackCampaign;
    const suggestedCohort = suggestion.cohortName
      ? plan.activeCohorts.find((cohort) => cohort.name === suggestion.cohortName)
      : null;
    const appliedPlan = suggestedCohort
      ? { activeCohorts: plan.activeCohorts, selected: [suggestedCohort], total: suggestedCohort.studentCount }
      : plan;

    const payload = {
      ...buildPlanPayload({
        campaign: appliedCampaign,
        cohortPlan: appliedPlan,
        cohortTouches,
        fallbackCampaign: appliedFallback,
        groupingStrategy,
        targetCount,
        todayKey
      }),
      metadata: {
        ...buildPlanPayload({
          campaign: appliedCampaign,
          cohortPlan: appliedPlan,
          cohortTouches,
          fallbackCampaign: appliedFallback,
          groupingStrategy,
          targetCount,
          todayKey
        }).metadata,
        smartSuggestion: {
          action: suggestion.action,
          appliedAt: new Date().toISOString(),
          campaignPhase: suggestion.campaignPhase ?? null,
          cohortName: suggestion.cohortName ?? null,
          kind: suggestion.kind,
          metric: suggestion.metric,
          title: suggestion.title
        }
      },
      rationale: `Smart suggestion applied: ${suggestion.title}. ${suggestion.action} ${suggestedCohort ? `Focused this draft on ${suggestedCohort.name}.` : ''}`,
      resourceIds: suggestedResources.map((resource) => resource.id)
    };

    try {
      const savedPlan = todayPlan
        ? await updatePlan.mutateAsync({ body: payload, planId: todayPlan.id })
        : await createPlan.mutateAsync(payload);
      await createPlanEvent.mutateAsync({
        details: {
          action: suggestion.action,
          campaignPhase: suggestion.campaignPhase ?? null,
          cohortName: suggestion.cohortName ?? null,
          kind: suggestion.kind,
          metric: suggestion.metric,
          title: suggestion.title
        },
        eventType: 'note',
        planId: savedPlan.id
      });
      await todayPlanQuery.refetch();
      setMessage({ tone: 'success', text: 'Smart suggestion was applied to today’s Email Marketing draft.' });
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Smart suggestion could not be applied.' });
    }
  }

  async function applySmartCopyVariant(variant: SmartCopyVariant) {
    setMessage(null);
    if (todayPlan && !['draft', 'reviewed'].includes(todayPlan.status)) {
      setMessage({ tone: 'error', text: 'Only draft or reviewed Email Marketing plans can receive smart copy variants.' });
      return;
    }

    const basePayload = buildPlanPayload({ campaign: savedCampaign, cohortPlan: plan, cohortTouches, fallbackCampaign, groupingStrategy, targetCount, todayKey });
    const copyMetadata = {
      smartCopyVariant: {
        appliedAt: new Date().toISOString(),
        focus: variant.focus,
        subject: variant.subject,
        tone: variant.tone
      }
    };

    try {
      const savedPlan = todayPlan
        ? await updatePlan.mutateAsync({
            body: {
              metadata: {
                ...(todayPlan.metadata ?? {}),
                ...copyMetadata
              },
              suggestedBody: variant.body,
              suggestedSubject: variant.subject
            },
            planId: todayPlan.id
          })
        : await createPlan.mutateAsync({
            ...basePayload,
            metadata: {
              ...basePayload.metadata,
              ...copyMetadata
            },
            resourceIds: suggestedResources.map((resource) => resource.id),
            suggestedBody: variant.body,
            suggestedSubject: variant.subject
          });

      await createPlanEvent.mutateAsync({
        details: {
          focus: variant.focus,
          subject: variant.subject,
          tone: variant.tone
        },
        eventType: todayPlan ? 'note' : 'created',
        planId: savedPlan.id
      });
      await todayPlanQuery.refetch();
      setMessage({ tone: 'success', text: 'Smart copy was applied to today’s Email Marketing draft.' });
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Smart copy could not be applied.' });
    }
  }

  async function saveAbCopyTest(activeVariant: AbCopyVariant) {
    setMessage(null);
    if (todayPlan && !['draft', 'reviewed'].includes(todayPlan.status)) {
      setMessage({ tone: 'error', text: 'Only draft or reviewed Email Marketing plans can be used for A/B copy testing.' });
      return;
    }

    const basePayload = buildPlanPayload({ campaign: savedCampaign, cohortPlan: plan, cohortTouches, fallbackCampaign, groupingStrategy, targetCount, todayKey });
    const abMetadata = {
      smartCopyAbTest: {
        activeVariantKey: activeVariant.variantKey,
        savedAt: new Date().toISOString(),
        status: 'draft_test',
        variants: abCopyVariants.map((variant) => ({
          body: variant.body,
          focus: variant.focus,
          subject: variant.subject,
          tone: variant.tone,
          variantKey: variant.variantKey
        }))
      }
    };

    try {
      const savedPlan = todayPlan
        ? await updatePlan.mutateAsync({
            body: {
              metadata: {
                ...(todayPlan.metadata ?? {}),
                ...abMetadata
              },
              suggestedBody: activeVariant.body,
              suggestedSubject: activeVariant.subject
            },
            planId: todayPlan.id
          })
        : await createPlan.mutateAsync({
            ...basePayload,
            metadata: {
              ...basePayload.metadata,
              ...abMetadata
            },
            resourceIds: suggestedResources.map((resource) => resource.id),
            suggestedBody: activeVariant.body,
            suggestedSubject: activeVariant.subject
          });

      await createPlanEvent.mutateAsync({
        details: {
          activeVariantKey: activeVariant.variantKey,
          subject: activeVariant.subject,
          variantCount: abCopyVariants.length
        },
        eventType: todayPlan ? 'note' : 'created',
        planId: savedPlan.id
      });
      await todayPlanQuery.refetch();
      setMessage({ tone: 'success', text: `A/B copy test saved. Variant ${activeVariant.variantKey} is active in today’s draft.` });
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'A/B copy test could not be saved.' });
    }
  }

  async function duplicatePlanForToday(sourcePlan: AdminEmailMarketingPlan) {
    setMessage(null);
    if (todayPlan) {
      setMessage({ tone: 'error', text: 'Today already has an Email Marketing plan. Refresh or send today’s plan before duplicating another one.' });
      return;
    }

    try {
      const duplicatedPlan = await createPlan.mutateAsync({
        campaignId: sourcePlan.campaignId ?? null,
        campaignPhase: sourcePlan.campaignPhase,
        campaignTitle: sourcePlan.campaignTitle,
        cohortIds: sourcePlan.cohortIds,
        cohortNames: sourcePlan.cohortNames,
        dailyLimit: sourcePlan.dailyLimit,
        metadata: {
          ...(sourcePlan.metadata ?? {}),
          duplicatedFromPlanId: sourcePlan.id,
          duplicatedFromPlannedDate: sourcePlan.plannedDate,
          generatedBy: 'admin-email-marketing-history-action'
        },
        plannedDate: todayKey,
        plannedRecipientCount: sourcePlan.plannedRecipientCount,
        planKey: `email-marketing-${todayKey}`,
        priorityScore: sourcePlan.priorityScore,
        rationale: `Duplicated from ${formatDate(sourcePlan.plannedDate)} Email Marketing plan.`,
        resourceIds: sourcePlan.resourceIds,
        status: 'draft',
        suggestedBatchSize: sourcePlan.suggestedBatchSize,
        suggestedBody: sourcePlan.suggestedBody ?? null,
        suggestedSubject: sourcePlan.suggestedSubject ?? null
      });
      await createPlanEvent.mutateAsync({
        details: {
          duplicatedFromPlanId: sourcePlan.id,
          duplicatedFromPlannedDate: sourcePlan.plannedDate
        },
        eventType: 'created',
        planId: duplicatedPlan.id
      });
      await refetchPlannerPlans();
      setMessage({ tone: 'success', text: 'The selected Email Marketing plan was duplicated for today.' });
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Plan could not be duplicated for today.' });
    }
  }

  async function rescheduleHistoryPlan(sourcePlan: AdminEmailMarketingPlan) {
    const nextDate = rescheduleDates[sourcePlan.id];
    setMessage(null);
    if (!nextDate) {
      setMessage({ tone: 'error', text: 'Choose a new planned date before rescheduling.' });
      return;
    }
    if (!['draft', 'reviewed'].includes(sourcePlan.status)) {
      setMessage({ tone: 'error', text: 'Only draft or reviewed plans can be rescheduled.' });
      return;
    }

    try {
      await updatePlan.mutateAsync({
        body: {
          metadata: {
            ...(sourcePlan.metadata ?? {}),
            lastRescheduledFromDate: sourcePlan.plannedDate,
            rescheduledFromPlanId: sourcePlan.id
          },
          plannedDate: nextDate,
          planKey: `email-marketing-${nextDate}`,
          status: 'draft'
        },
        planId: sourcePlan.id
      });
      await createPlanEvent.mutateAsync({
        details: {
          fromDate: sourcePlan.plannedDate,
          toDate: nextDate
        },
        eventType: 'note',
        planId: sourcePlan.id
      });
      setRescheduleDates((current) => {
        const next = { ...current };
        delete next[sourcePlan.id];
        return next;
      });
      await refetchPlannerPlans();
      setMessage({ tone: 'success', text: 'Email Marketing plan was rescheduled as a draft.' });
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Plan could not be rescheduled.' });
    }
  }

  async function cancelHistoryPlan(sourcePlan: AdminEmailMarketingPlan) {
    setMessage(null);
    if (!['draft', 'reviewed'].includes(sourcePlan.status)) {
      setMessage({ tone: 'error', text: 'Only draft or reviewed plans can be cancelled.' });
      return;
    }

    try {
      await updatePlan.mutateAsync({
        body: {
          skipReason: 'Cancelled from Email Marketing history.',
          skippedAt: new Date().toISOString(),
          status: 'cancelled'
        },
        planId: sourcePlan.id
      });
      await createPlanEvent.mutateAsync({
        details: { reason: 'Cancelled from Email Marketing history.' },
        eventType: 'cancelled',
        planId: sourcePlan.id
      });
      await refetchPlannerPlans();
      setMessage({ tone: 'success', text: 'Email Marketing plan was cancelled.' });
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Plan could not be cancelled.' });
    }
  }

  function openNewCampaign() {
    setCampaignDraft(campaignDraftFrom({
      audienceRules: {},
      campaignKey: '',
      defaultBody: '',
      defaultResourceIds: [],
      defaultSubject: '',
      description: '',
      id: '',
      phase: 'general',
      rotationWeight: 80,
      status: 'active',
      templateKey: '',
      title: '',
      touchIntervalDays: 14
    }));
  }

  async function saveCampaign() {
    if (!campaignDraft) return;
    setMessage(null);
    const title = campaignDraft.title.trim();
    const campaignKey = campaignDraft.id ? campaignDraft.campaignKey.trim() : slugifyCampaignKey(title);
    if (!title) {
      setMessage({ tone: 'error', text: 'Campaign title is required.' });
      return;
    }
    const payload: AdminEmailMarketingCampaignPayload = {
      audienceRules: {
        ...(campaignDraft.audienceRules ?? {}),
        activitySegment: campaignDraft.activitySegment || undefined,
        audienceTag: campaignDraft.audienceTag || undefined,
        cohortStage: campaignDraft.cohortStage || undefined,
        domainKey: campaignDraft.domainKeyRule || undefined,
        programKey: campaignDraft.programKeyRule || undefined,
        resourceDomainKey: campaignDraft.resourceDomainKey || undefined,
        resourceMode: campaignDraft.resourceMode || undefined,
        resourceType: campaignDraft.resourceType || undefined
      },
      campaignKey,
      defaultBody: campaignDraft.defaultBody || null,
      defaultResourceIds: campaignDraft.defaultResourceIds ?? [],
      defaultSubject: campaignDraft.defaultSubject || null,
      description: campaignDraft.description || null,
      phase: campaignDraft.phase,
      rotationWeight: Number(campaignDraft.rotationWeight) || 0,
      status: campaignDraft.status,
      templateKey: campaignDraft.templateKey || null,
      title,
      touchIntervalDays: Math.max(1, Number(campaignDraft.touchIntervalDays) || 14)
    };

    try {
      if (campaignDraft.id) {
        await updateCampaign.mutateAsync({ body: payload, campaignId: campaignDraft.id });
        setMessage({ tone: 'success', text: 'Campaign configuration updated.' });
      } else {
        await createCampaign.mutateAsync(payload);
        setMessage({ tone: 'success', text: 'Campaign configuration added.' });
      }
      setCampaignDraft(null);
      await campaignsQuery.refetch();
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Campaign could not be saved.' });
    }
  }

  if (isLoading) {
    return (
      <div className="page-stack admin-email-marketing-page">
        <PageHeader description="Preparing the daily cohort rotation and campaign ideas." eyebrow="Email Marketing" title="Daily Outreach Planner" />
        <LoadingState />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="page-stack admin-email-marketing-page">
        <PageHeader description="Daily outreach data could not be loaded." eyebrow="Email Marketing" title="Planner unavailable" />
        <ErrorState />
      </div>
    );
  }

  return (
    <div className={`page-stack admin-email-marketing-page admin-email-marketing-page--${viewDensity}`}>
      <PageHeader
        actions={
          <button
            className="segmented-button"
            onClick={() => void Promise.all([campaignsQuery.refetch(), cohortTouchQuery.refetch(), cohortsQuery.refetch(), templatesQuery.refetch(), todayPlanQuery.refetch(), todayPlanEventsQuery.refetch(), planHistoryQuery.refetch(), providerEventsQuery.refetch(), suppressionOverridesQuery.refetch(), queueQuery.refetch(), resourcesQuery.refetch()])}
            type="button"
          >
            <RefreshCw size={18} />
            Refresh Planner
          </button>
        }
        description="A daily suggested email plan that rotates cohorts, recommends campaign topics, and keeps LMS sends inside the 300 email limit."
        eyebrow="Email Marketing"
        title="Daily Outreach Planner"
      />

      {message ? (
        <PortalToast
          icon={message.tone === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
          message={message.text}
          onDismiss={() => setMessage(null)}
          title={message.tone === 'success' ? 'Email Marketing updated' : 'Email Marketing failed'}
          tone={message.tone}
        />
      ) : null}

      <div className="email-marketing-tabs" role="tablist" aria-label="Email marketing sections">
        {emailMarketingTabs.map((tab) => (
          <button
            aria-selected={activeTab === tab.key}
            className={activeTab === tab.key ? 'email-marketing-tab email-marketing-tab--active' : 'email-marketing-tab'}
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'today' ? (
        <>
      <section className="email-marketing-hero">
        <div>
          <span className="eyebrow">{displayedPlan ? `Today’s email task · ${displayedPlan.status}` : 'Today’s email task'}</span>
          <h2>{displayedPlan?.campaignTitle ?? campaign.title}</h2>
          <p>{recipientPreview?.ok ? 'Next step: rehearse this email with QA, then send production from Email Centre.' : 'Next step: preview recipients, then rehearse with QA before any production send.'}</p>
        </div>
        <div className="email-marketing-hero__actions">
          <button className="segmented-button" disabled={resolveRecipients.isPending} onClick={() => void previewRecipients()} type="button">
            {resolveRecipients.isPending ? 'Checking...' : 'Preview'}
          </button>
          <Link className="segmented-button" to={todayPlan ? `/admin/email-center?marketingPlanId=${todayPlan.id}&rehearsal=1` : '/admin/email-center?rehearsal=1'}>
            Rehearse
          </Link>
          <Link className="student-action student-action--primary" to={todayPlan ? `/admin/email-center?marketingPlanId=${todayPlan.id}` : '/admin/email-center'}>
            <Send size={18} />
            Send
          </Link>
        </div>
      </section>

      <section className="admin-email-card">
        <div className="admin-email-card__header admin-email-card__header--row">
          <div>
            <span className="eyebrow">Daily workflow</span>
            <h2>Follow these steps in order</h2>
          </div>
          <StatusBadge tone={sendFlowSteps.every((step) => step.done) ? 'safe' : 'warning'}>{`${sendFlowSteps.filter((step) => step.done).length}/${sendFlowSteps.length} done`}</StatusBadge>
        </div>
        <div className="email-marketing-stepper">
          {sendFlowSteps.map((step, index) => (
            <article className={step.done ? 'email-marketing-step email-marketing-step--done' : 'email-marketing-step'} key={step.label}>
              <b>{index + 1}</b>
              <div>
                <strong>{step.label}</strong>
                <span>{step.detail}</span>
              </div>
              <StatusBadge tone={step.tone}>{step.action}</StatusBadge>
            </article>
          ))}
        </div>
      </section>

      <section className="email-marketing-task-grid" aria-label="Today email task">
        <article>
          <Users size={20} />
          <span>1. Audience</span>
          <strong>{(displayedPlan?.cohortNames.length ?? plan.selected.length)} cohort{(displayedPlan?.cohortNames.length ?? plan.selected.length) === 1 ? '' : 's'}</strong>
          <small>{displayedPlan?.cohortNames.length ? displayedPlan.cohortNames.join(', ') : plan.selected.map((cohort) => cohort.name).join(', ') || 'No cohort selected'}</small>
        </article>
        <article>
          <Sparkles size={20} />
          <span>2. Email</span>
          <strong>{displayedPlan?.suggestedSubject ? 'Copy ready' : 'Review copy'}</strong>
          <small>{displayedPlan?.suggestedSubject || matchingTemplates[0]?.subject || 'Open Email Centre to edit subject and body.'}</small>
        </article>
        <article>
          <MailCheck size={20} />
          <span>3. Safety</span>
          <strong>{recipientPreview ? `${recipientPreview.willSend} ready` : 'Preview needed'}</strong>
          <small>{recipientPreview ? `${recipientPreview.suppressedRecipients} blocked · ${recipientPreview.remainingToday} quota left` : 'Preview applies duplicate, suppression, and quota checks.'}</small>
        </article>
        <article>
          <Send size={20} />
          <span>4. Send</span>
          <strong>{todayPlan?.status === 'sent' ? 'Complete' : 'Rehearse first'}</strong>
          <small>{todayPlan?.status === 'sent' ? 'Today’s campaign is sent.' : 'QA rehearsal protects students before production send.'}</small>
        </article>
      </section>
        </>
      ) : null}

      {activeTab === 'activity' ? (
        <>
      <section className="admin-email-card">
        <div className="admin-email-card__header admin-email-card__header--row">
          <div>
            <span className="eyebrow">Performance</span>
            <h2>Campaign pulse</h2>
          </div>
          <StatusBadge tone={deliveryPerformanceSummary.failed ? 'warning' : 'safe'}>
            {deliveryPerformanceSummary.failed ? `${deliveryPerformanceSummary.failed} failed` : 'Healthy'}
          </StatusBadge>
        </div>
        <div className="email-marketing-webhook-health">
          <div className="email-marketing-webhook-health__header">
            <div>
              <span className="eyebrow">Webhook Health</span>
              <h3>Brevo delivery tracking</h3>
            </div>
            <StatusBadge tone={webhookHealth.status === 'healthy' ? 'safe' : webhookHealth.status === 'stale' ? 'warning' : 'neutral'}>
              {webhookHealth.statusLabel}
            </StatusBadge>
          </div>
          <div className="email-marketing-webhook-health__grid">
            <article>
              <span>Latest event</span>
              <strong>{webhookHealth.lastEventType}</strong>
              <small>{formatDateTime(webhookHealth.lastEventAt)}</small>
            </article>
            <article>
              <span>Active endpoint</span>
              <strong>{webhookHealth.activeEndpoint}</strong>
              <small>{webhookHealth.activeEndpoint === 'Historical/backfilled' ? 'Future live webhooks will record the exact slug.' : 'Recorded from webhook metadata.'}</small>
            </article>
            <article>
              <span>Recent archive</span>
              <strong>{providerDeliverySummary.totalEvents}</strong>
              <small>latest provider event{providerDeliverySummary.totalEvents === 1 ? '' : 's'} loaded</small>
            </article>
            <article>
              <span>Recipient signal</span>
              <strong>{webhookHealth.lastRecipient}</strong>
              <small>{webhookHealth.latestEvent?.providerMessageId || 'No provider message id'}</small>
            </article>
          </div>
          {webhookHealth.status !== 'healthy' ? (
            <div className="auth-alert auth-alert--warning email-marketing-webhook-health__alert">
              Confirm Brevo transactional webhooks point to https://olgihgkyteumndphxsut.supabase.co/functions/v1/brevo-email-webhook. The legacy /brevo-webhook endpoint is also active for compatibility.
            </div>
          ) : null}
        </div>
        <div className="email-marketing-smart-suggestions">
          <div>
            <span className="eyebrow">Smart suggestions</span>
            <h3>Engagement-based next steps</h3>
          </div>
          <div className="email-marketing-suggestion-list">
            {engagementSuggestions.map((suggestion) => (
              <article key={`${suggestion.title}:${suggestion.metric}`}>
                <div>
                  <strong>{suggestion.title}</strong>
                  <span>{suggestion.detail}</span>
                  <small>{suggestion.action}</small>
                </div>
                <div className="email-marketing-suggestion-actions">
                  <StatusBadge tone={suggestion.tone}>{suggestion.metric}</StatusBadge>
                  {suggestion.kind !== 'suppression' ? (
                    <button
                      className="segmented-button"
                      disabled={createPlan.isPending || updatePlan.isPending}
                      onClick={() => void applyEngagementSuggestion(suggestion)}
                      type="button"
                    >
                      Apply
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
          <div className="email-marketing-copy-variants">
            <div>
              <span className="eyebrow">Copy variants</span>
              <h3>Pick an email angle</h3>
            </div>
            <div className="email-marketing-copy-list">
              {smartCopyVariants.map((variant) => (
                <article key={variant.focus}>
                  <div>
                    <div className="email-marketing-campaign-title">
                      <strong>{variant.focus}</strong>
                      <StatusBadge tone={variant.tone}>{variant.tone}</StatusBadge>
                    </div>
                    <span>{variant.subject}</span>
                    <small>{variant.body.split('\n').filter(Boolean).slice(0, 2).join(' ')}</small>
                  </div>
                  <button
                    className="segmented-button"
                    disabled={createPlan.isPending || updatePlan.isPending}
                    onClick={() => void applySmartCopyVariant(variant)}
                    type="button"
                  >
                    Use Copy
                  </button>
                </article>
              ))}
            </div>
          </div>
          <div className="email-marketing-ab-test">
            <div className="admin-email-card__header admin-email-card__header--row">
              <div>
                <span className="eyebrow">A/B copy test lite</span>
                <h3>Save two variants and pick the active draft</h3>
              </div>
              {recommendedAbVariant ? <StatusBadge tone="safe">{`Use ${recommendedAbVariant.variantKey}`}</StatusBadge> : <StatusBadge tone="neutral">Needs data</StatusBadge>}
            </div>
            <div className="email-marketing-ab-list">
              {abCopyVariants.map((variant) => {
                const stats = abCopyStats.get(variant.variantKey) ?? { clicked: 0, delivered: 0, opened: 0 };
                const isActive = todayPlan?.suggestedSubject === variant.subject;
                return (
                  <article key={variant.variantKey}>
                    <div>
                      <div className="email-marketing-campaign-title">
                        <strong>Variant {variant.variantKey}: {variant.focus}</strong>
                        <StatusBadge tone={isActive ? 'safe' : 'neutral'}>{isActive ? 'active' : 'draft'}</StatusBadge>
                      </div>
                      <span>{variant.subject}</span>
                      <small>{stats.delivered} delivered · {stats.opened} opened · {stats.clicked} clicked</small>
                    </div>
                    <button
                      className="segmented-button"
                      disabled={createPlan.isPending || updatePlan.isPending}
                      onClick={() => void saveAbCopyTest(variant)}
                      type="button"
                    >
                      Use Variant {variant.variantKey}
                    </button>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
        <div className="email-marketing-performance-grid">
          <article>
            <span>Sent recipients</span>
            <strong>{campaignPerformanceMetrics.reduce((sum, metric) => sum + metric.sentRecipients, 0)}</strong>
            <small>{campaignPerformanceMetrics.reduce((sum, metric) => sum + metric.sentPlans, 0)} sent plan{campaignPerformanceMetrics.reduce((sum, metric) => sum + metric.sentPlans, 0) === 1 ? '' : 's'}</small>
          </article>
          <article>
            <span>Skipped / cancelled</span>
            <strong>{campaignPerformanceMetrics.reduce((sum, metric) => sum + metric.skippedPlans + metric.cancelledPlans, 0)}</strong>
            <small>plans removed from active rotation</small>
          </article>
          <article>
            <span>Email queue</span>
            <strong>{deliveryPerformanceSummary.sent} / {deliveryPerformanceSummary.total}</strong>
            <small>{deliveryPerformanceSummary.failed} failed · {deliveryPerformanceSummary.queued} queued</small>
          </article>
          <article>
            <span>Provider reached</span>
            <strong>{providerDeliverySummary.delivered}</strong>
            <small>delivered, opened, or clicked signals from {providerDeliverySummary.totalEvents} event{providerDeliverySummary.totalEvents === 1 ? '' : 's'}</small>
          </article>
          <article>
            <span>Opened / clicked</span>
            <strong>{providerDeliverySummary.opened} / {providerDeliverySummary.clicked}</strong>
            <small>unique queue/message events</small>
          </article>
          <article>
            <span>Bounced / unsubscribed</span>
            <strong>{providerDeliverySummary.bounced} / {providerDeliverySummary.unsubscribed}</strong>
            <small>{providerDeliverySummary.spam} spam complaint{providerDeliverySummary.spam === 1 ? '' : 's'}</small>
          </article>
          <article>
            <span>Top campaign</span>
            <strong>{topCampaignMetric ? topCampaignMetric.sentRecipients : '-'}</strong>
            <small>{topCampaignMetric?.title ?? 'No sent campaign yet'}</small>
          </article>
        </div>
        <div className="email-marketing-performance-columns">
          <div>
            <h3>Campaign patterns</h3>
            {campaignPerformanceMetrics.length ? (
              <div className="email-marketing-performance-list">
                {campaignPerformanceMetrics.slice(0, 5).map((metric) => (
                  <article key={metric.key}>
                    <div>
                      <strong>{metric.title}</strong>
                      <span>{metric.phase} · {metric.totalPlans} plan{metric.totalPlans === 1 ? '' : 's'} · last sent {formatDate(metric.lastSentAt)}</span>
                      <small>{metric.cohortNames.length ? metric.cohortNames.join(', ') : 'No cohort pattern yet'}</small>
                    </div>
                    <b>{metric.sentRecipients}</b>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState />
            )}
          </div>
          <div>
            <h3>Cohort patterns</h3>
            {cohortPerformanceMetrics.length ? (
              <div className="email-marketing-performance-list">
                {cohortPerformanceMetrics.map((metric) => (
                  <article key={metric.cohortName}>
                    <div>
                      <strong>{metric.cohortName}</strong>
                      <span>{metric.sentPlans} sent touch{metric.sentPlans === 1 ? '' : 'es'} · {metric.totalPlans} total plan{metric.totalPlans === 1 ? '' : 's'}</span>
                      <small>Last sent {formatDate(metric.lastSentAt)}</small>
                    </div>
                    <b>{metric.sentRecipients}</b>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState />
            )}
          </div>
        </div>
        <div className="email-marketing-provider-events">
          <h3>Latest provider events</h3>
          {providerEvents.length ? (
            <div className="email-marketing-performance-list">
              {providerEvents.slice(0, 6).map((event) => (
                <article key={event.id}>
                  <div>
                    <strong>{event.subject || event.recipientEmail || 'Brevo event'}</strong>
                    <span>{event.recipientEmail || 'Recipient not mapped'} · {formatDate(event.occurredAt)}</span>
                    <small>{event.providerMessageId || event.reason || 'No provider message id'}</small>
                  </div>
                  <StatusBadge tone={['hard_bounce', 'soft_bounce', 'bounced', 'blocked', 'invalid_email', 'error', 'spam'].includes(event.eventType) ? 'danger' : event.eventType === 'unsubscribed' ? 'warning' : 'safe'}>
                    {event.eventType}
                  </StatusBadge>
                </article>
              ))}
            </div>
          ) : (
            <div className="auth-alert auth-alert--warning">
              No provider webhook events have been received yet. Configure Brevo to post transactional email events to the new webhook endpoint.
            </div>
          )}
        </div>
        <div className="email-marketing-provider-events">
          <div className="admin-email-card__header admin-email-card__header--row">
            <div>
              <span className="eyebrow">Suppression</span>
              <h2>Recipient safety list</h2>
            </div>
            <StatusBadge tone={activeSuppressionRecords.length ? 'warning' : 'safe'}>{`${activeSuppressionRecords.length} active`}</StatusBadge>
          </div>
          {suppressionRecords.length ? (
            <div className="email-marketing-suppression-list">
              {suppressionRecords.slice(0, 10).map((record) => (
                <article key={record.recipientEmail}>
                  <div>
                    <strong>{record.recipientEmail}</strong>
                    <span>{record.suppressed ? record.eventType : 'cleared'} · {formatDate(record.lastEventAt ?? record.clearedAt)}</span>
                    <small>{record.reason || (record.overrideStatus === 'cleared' ? 'Admin cleared suppression.' : 'Provider event suppression.')}</small>
                  </div>
                  <div className="email-marketing-history-actions">
                    <StatusBadge tone={record.suppressed ? 'warning' : 'safe'}>{record.suppressed ? 'suppressed' : 'cleared'}</StatusBadge>
                    {record.suppressed ? (
                      <button
                        className="segmented-button"
                        disabled={createSuppressionOverride.isPending}
                        onClick={() => void handleSuppressionOverride(record.recipientEmail, 'cleared', `Cleared from Email Marketing after ${record.eventType}.`)}
                        type="button"
                      >
                        Clear
                      </button>
                    ) : (
                      <button
                        className="segmented-button segmented-button--danger"
                        disabled={createSuppressionOverride.isPending}
                        onClick={() => void handleSuppressionOverride(record.recipientEmail, 'suppressed', 'Manually suppressed from Email Marketing.')}
                        type="button"
                      >
                        Suppress
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="auth-alert auth-alert--success">
              No suppressed recipients have been detected from provider events yet.
            </div>
          )}
        </div>
      </section>
        </>
      ) : null}

      {activeTab === 'rotation' ? (
        <>
      <section className="email-marketing-queue-grid" aria-label="Email marketing upcoming plans and history">
        <article className="admin-email-card">
          <div className="admin-email-card__header">
              <span className="eyebrow">Next 7 days</span>
              <h2>Rotation preview</h2>
            <p className="email-marketing-card-note">{selectedGroupingOption.label}. Counts use live linked students, and campaign variety is protected across the week.</p>
          </div>
          {upcomingPlanPreviews.length ? (
            <div className="email-marketing-plan-list">
              {upcomingPlanPreviews.map((preview) => (
                <article key={preview.dateKey}>
                  <div>
                    <strong>{formatDate(preview.dateKey)}</strong>
                    <span>{preview.campaignTitle}</span>
                    <small>{preview.cohortNames.length ? preview.cohortNames.join(', ') : 'No active cohort selected'}</small>
                  </div>
                  <b>{preview.plannedRecipientCount} planned</b>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState />
          )}
        </article>

        <article className="admin-email-card">
          <div className="admin-email-card__header admin-email-card__header--row email-marketing-card-toolbar">
            <div>
              <span className="eyebrow">History</span>
              <h2>Recent plans</h2>
            </div>
            <div className="email-marketing-filter-bar">
              <select aria-label="Filter recent plans" value={historyStatusFilter} onChange={(event) => setHistoryStatusFilter(event.target.value)}>
                <option value="active">Drafts & reviewed</option>
                <option value="all">All plans</option>
                <option value="draft">Draft only</option>
                <option value="reviewed">Reviewed only</option>
                <option value="sent">Sent only</option>
                <option value="skipped">Skipped only</option>
                <option value="cancelled">Cancelled only</option>
              </select>
              <StatusBadge tone="neutral">{String(visiblePlanHistory.length)}</StatusBadge>
            </div>
          </div>
          {visiblePlanHistory.length ? (
            <div className="email-marketing-plan-list email-marketing-plan-list--history">
              {visiblePlanHistory.map((historyPlan) => (
                <article key={historyPlan.id}>
                  <div>
                    <strong>{historyPlan.campaignTitle}</strong>
                    <span>{formatDate(historyPlan.plannedDate)} · {historyPlan.cohortNames.length} cohort{historyPlan.cohortNames.length === 1 ? '' : 's'}</span>
                    <small>{historyPlan.cohortNames.slice(0, 4).join(', ')}{historyPlan.cohortNames.length > 4 ? ` +${historyPlan.cohortNames.length - 4} more` : ''}</small>
                  </div>
                  <div className="email-marketing-history-actions">
                    <StatusBadge tone={planStatusTone(historyPlan.status)}>{historyPlan.status}</StatusBadge>
                    <Link className="segmented-button" to={`/admin/email-center?marketingPlanId=${historyPlan.id}`}>
                      Open
                    </Link>
                    <button
                      className="segmented-button"
                      disabled={Boolean(todayPlan) || createPlan.isPending}
                      onClick={() => void duplicatePlanForToday(historyPlan)}
                      type="button"
                    >
                      Duplicate Today
                    </button>
                    {['draft', 'reviewed'].includes(historyPlan.status) ? (
                      <>
                        <input
                          aria-label={`Reschedule ${historyPlan.campaignTitle}`}
                          min={todayKey}
                          type="date"
                          value={rescheduleDates[historyPlan.id] ?? ''}
                          onChange={(event) => setRescheduleDates((current) => ({ ...current, [historyPlan.id]: event.target.value }))}
                        />
                        <button
                          className="segmented-button"
                          disabled={updatePlan.isPending}
                          onClick={() => void rescheduleHistoryPlan(historyPlan)}
                          type="button"
                        >
                          Reschedule
                        </button>
                        <button
                          className="segmented-button segmented-button--danger"
                          disabled={updatePlan.isPending}
                          onClick={() => void cancelHistoryPlan(historyPlan)}
                          type="button"
                        >
                          Cancel
                        </button>
                      </>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState />
          )}
        </article>
      </section>

      <section className="admin-email-card">
        <div className="admin-email-card__header admin-email-card__header--row">
          <div>
            <span className="eyebrow">Audit trail</span>
            <h2>Today’s plan timeline</h2>
          </div>
          <StatusBadge tone={todayPlanEvents.length ? 'neutral' : 'warning'}>{todayPlanEvents.length ? `${todayPlanEvents.length} events` : 'No plan'}</StatusBadge>
        </div>
        {todayPlan ? (
          todayPlanEvents.length ? (
            <div className="email-marketing-timeline">
              {todayPlanEvents.map((event) => (
                <article key={event.id}>
                  <div>
                    <strong>{event.eventType}</strong>
                    <span>{event.actorEmail || 'System'} · {formatDate(event.createdAt)}</span>
                    <small>{eventDetailText(event.details)}</small>
                  </div>
                  <StatusBadge tone={eventTone(event.eventType)}>{event.eventType}</StatusBadge>
                </article>
              ))}
            </div>
          ) : (
            <div className="auth-alert auth-alert--warning">
              Today’s plan exists, but no timeline events have been recorded yet.
            </div>
          )
        ) : (
          <div className="auth-alert auth-alert--success">
            Today’s draft will start recording timeline events as soon as the first plan action is saved.
          </div>
        )}
      </section>
        </>
      ) : null}

      {activeTab === 'today' ? (
        <>
      <div className="email-marketing-layout">
        <section className="admin-email-card">
          <div className="admin-email-card__header admin-email-card__header--row">
            <div>
              <span className="eyebrow">Daily plan</span>
              <h2>Suggested cohort rotation</h2>
              <p className="email-marketing-card-note">{selectedGroupingOption.description} Only active cohorts with live linked students are included.</p>
            </div>
            <StatusBadge tone={displayedPlan ? planStatusTone(displayedPlan.status) : campaign.priority === 'High' ? 'warning' : 'neutral'}>
              {displayedPlan?.status ?? campaign.priority}
            </StatusBadge>
          </div>

          {displayedPlan?.cohortNames.length ? (
            <div className="email-marketing-cohort-list">
              {displayedPlan.cohortNames.map((cohortName) => {
                const liveCount = liveCohortCountByName.get(cohortName) ?? 0;
                return (
                  <article key={cohortName}>
                    <div>
                      <strong>{cohortName}</strong>
                      <span>Saved for {formatDate(displayedPlan.plannedDate)} · {liveCount} live linked student{liveCount === 1 ? '' : 's'}</span>
                    </div>
                    <b>{liveCount} live</b>
                  </article>
                );
              })}
            </div>
          ) : plan.selected.length ? (
            <div className="email-marketing-cohort-list">
              {plan.selected.map((cohort) => (
                <article key={cohort.id}>
                  <div>
                    <strong>{cohort.name}</strong>
                    <span>
                      {cohort.programKey || 'Program not tagged'} · {cohortTouches.get(cohort.name)
                        ? `last touched ${daysSince(cohortTouches.get(cohort.name), today)} day${daysSince(cohortTouches.get(cohort.name), today) === 1 ? '' : 's'} ago`
                        : 'not touched by Email Marketing yet'}
                    </span>
                  </div>
                  <b>{cohort.studentCount} live</b>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState />
          )}

          <div className="email-marketing-rationale">
            <CheckCircle2 size={18} />
            <span>
              {displayedPlan
                ? 'This daily plan is saved in Email Marketing and can now be reviewed, skipped, or used in Email Centre for sending.'
                : 'This planner rotates active cohorts by oldest Email Marketing touch, uses live linked student counts, and keeps the plan under the 300 LMS email limit.'}
            </span>
          </div>
          <div className="email-marketing-why-plan">
            <div className="email-marketing-why-plan__head">
              <strong>Why this plan?</strong>
              <StatusBadge tone="neutral">{effectiveGroupingOption.label}</StatusBadge>
            </div>
            <div className="email-marketing-why-plan__grid">
              <article>
                <span>Grouping used</span>
                <strong>{effectiveGroupingOption.label}</strong>
                <small>{effectiveGroupingOption.description}</small>
              </article>
              <article>
                <span>Selected audience</span>
                <strong>{activePlanLiveStudents} live students</strong>
                <small>{activePlanCohortNames.length ? activePlanCohortNames.join(', ') : 'No cohort selected yet'}</small>
              </article>
              <article>
                <span>Campaign fit</span>
                <strong>{displayedPlan?.campaignTitle ?? campaign.title}</strong>
                <small>{campaignFitSignals.length ? campaignFitSignals.join(' · ') : 'No audience fit rules configured; priority rotation used.'}</small>
              </article>
              <article>
                <span>Send cap</span>
                <strong>{effectiveBatchCap} per batch</strong>
                <small>{deferredRecipientCount !== null ? `${deferredRecipientCount} deferred after preview` : 'Run preview to calculate deferred recipients.'}</small>
              </article>
            </div>
          </div>
          {todayPlan ? (
            <div className="email-marketing-plan-actions">
              <button className="segmented-button" disabled={updatePlan.isPending} onClick={() => void handlePlanStatus('reviewed')} type="button">
                Mark reviewed
              </button>
              <button className="segmented-button" disabled={updatePlan.isPending} onClick={() => void handlePlanStatus('skipped')} type="button">
                Skip today
              </button>
            </div>
          ) : null}
        </section>

        <aside className="email-marketing-side">
          <section className="admin-email-card">
            <div className="admin-email-card__header">
              <span className="eyebrow">Suggested templates</span>
              <h2>Use in Email Centre</h2>
            </div>
            {matchingTemplates.length ? (
              <div className="email-marketing-template-list">
                {matchingTemplates.map((template) => (
                  <Link key={template.id} to="/admin/email-center">
                    <div>
                      <strong>{template.templateName}</strong>
                      <span>{template.subject}</span>
                    </div>
                    <ChevronRight size={18} />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="auth-alert auth-alert--warning">
                No active template matches this campaign phase yet. Add one in Email Centre templates.
              </div>
            )}
          </section>

          <section className="admin-email-card">
            <div className="admin-email-card__header">
              <span className="eyebrow">Suggested resources</span>
              <h2>Use in today’s email</h2>
              <p className="email-marketing-card-note">Optional LMS resources matched to today’s campaign and cohort.</p>
            </div>
            {suggestedResources.length ? (
              <div className="email-marketing-resource-list">
                {suggestedResources.map((resource) => (
                  <article key={resource.id}>
                    <Library size={17} />
                    <div>
                      <strong>{resource.title}</strong>
                      <span>{[resource.resourceType, resource.resourceMode, resource.resourceDomainKey, resource.programKeys?.join(', ') || 'All programs'].filter(Boolean).join(' · ')}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState />
            )}
          </section>
        </aside>
      </div>

      <section className="admin-email-card">
        <div className="admin-email-card__header admin-email-card__header--row">
          <div>
            <span className="eyebrow">Recipient safety</span>
            <h2>Preview before Email Centre</h2>
          </div>
          <button className="segmented-button" disabled={resolveRecipients.isPending} onClick={() => void previewRecipients()} type="button">
            {resolveRecipients.isPending ? 'Checking...' : 'Refresh Preview'}
          </button>
        </div>
        {recipientPreview ? (
          <>
            {plannedRecipientCount > 0 && recipientPreview.willSend === 0 ? (
              <div className="auth-alert auth-alert--warning email-marketing-preview-warning">
                Planner estimated {plannedRecipientCount} students from the cohort rotation, but the live recipient preview found 0 deliverable emails. This usually means the selected cohort has no currently eligible active LMS recipients for this campaign, or all matching recipients were removed by duplicate-send, suppression, or recipient-safety checks.
              </div>
            ) : plannedRecipientCount > 0 && recipientPreview.willSend !== plannedRecipientCount ? (
              <div className="auth-alert auth-alert--warning email-marketing-preview-warning">
                Preview found {recipientPreview.deliverableRecipients} deliverable recipients. This batch will send to {recipientPreview.willSend}; the remaining {Math.max(0, recipientPreview.deliverableRecipients - recipientPreview.willSend)} stay unsent for a future batch or rotation.
              </div>
            ) : null}
            <div className="email-marketing-preview-grid">
              <article>
                <span>Resolved recipients</span>
                <strong>{recipientPreview.recipients}</strong>
                <small>{recipientPreview.deliverableRecipients} deliverable</small>
              </article>
              <article>
                <span>Selected for this send</span>
                <strong>{recipientPreview.willSend}</strong>
                <small>batch cap {recipientPreview.batchSize} from {batchCapSourceLabel}</small>
              </article>
              <article>
                <span>Daily quota</span>
                <strong>{recipientPreview.usedToday} / {recipientPreview.dailyLimit}</strong>
                <small>{recipientPreview.remainingAfterBatch} left after batch</small>
              </article>
              <article>
                <span>Skipped today</span>
                <strong>{recipientPreview.alreadySentToday}</strong>
                <small>already received this template</small>
              </article>
              <article>
                <span>Suppressed</span>
                <strong>{recipientPreview.suppressedRecipients}</strong>
                <small>bounced, spam, or unsubscribed</small>
              </article>
            </div>
            {recipientPreview.previewRecipients.length && recipientPreview.previewRecipients.length >= recipientPreview.willSend ? (
              <>
                <div className="email-marketing-recipient-list-header">
                  <strong>Students in this batch</strong>
                  <span>{recipientPreview.willSend} recipient{recipientPreview.willSend === 1 ? '' : 's'}</span>
                </div>
                <div className="email-marketing-recipient-list">
                  {recipientPreview.previewRecipients.map((recipient) => (
                    <article key={recipient.email}>
                      <strong>{recipient.name || recipient.email}</strong>
                      <span>{recipient.email} · {recipient.relatedType}</span>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <div className="auth-alert auth-alert--warning">
                Recipient preview is calculated, but the full batch list is not shown here because the API returned only a sample. Use Email Centre for the final reviewed send list.
              </div>
            )}
          </>
        ) : (
          <div className="auth-alert auth-alert--success">
            Click Preview Recipients to calculate exact deliverable students and quota usage before opening Email Centre.
          </div>
        )}
      </section>
        </>
      ) : null}

      {activeTab === 'campaigns' ? (
        <>
      <section className="admin-email-card">
        <div className="admin-email-card__header admin-email-card__header--row">
          <div>
            <span className="eyebrow">Basic settings</span>
            <h2>Daily planner defaults</h2>
          </div>
          <StatusBadge tone={readyChecklistCount === setupChecklist.length ? 'safe' : 'warning'}>{`${readyChecklistCount}/${setupChecklist.length} ready`}</StatusBadge>
        </div>
        <div className="email-marketing-settings-row">
          <label>
            <span>Suggested daily target</span>
            <select value={targetCount} onChange={(event) => void handleTargetCountChange(Number(event.target.value))}>
              <option value={100}>100 students</option>
              <option value={150}>150 students</option>
              <option value={200}>200 students</option>
              <option value={250}>250 students</option>
              <option value={300}>300 students</option>
            </select>
          </label>
          <label>
            <span>Cohort grouping</span>
            <select value={groupingStrategy} onChange={(event) => void handleGroupingStrategyChange(event.target.value as CohortGroupingStrategy)}>
              {cohortGroupingOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span>View density</span>
            <select value={viewDensity} onChange={(event) => setViewDensity(event.target.value as typeof viewDensity)}>
              <option value="compact">Compact console</option>
              <option value="comfortable">Comfortable view</option>
            </select>
          </label>
          <button className="segmented-button segmented-button--gold" disabled={createPlan.isPending || updatePlan.isPending} onClick={() => void handleSaveTodayPlan()} type="button">
            {todayPlan ? 'Refresh Saved Plan' : 'Save Today Plan'}
          </button>
        </div>
        {hasSavedPlanBatchMismatch || hasSavedPlanGroupingMismatch ? (
          <div className="auth-alert auth-alert--warning email-marketing-settings-alert">
            Today’s saved plan is not using the current settings. {hasSavedPlanBatchMismatch ? `Saved batch cap is ${savedPlanBatchSize}; dropdown is ${targetCount}. ` : ''}
            {hasSavedPlanGroupingMismatch ? `Saved grouping is ${cohortGroupingOptions.find((option) => option.value === savedPlanGroupingStrategy)?.label ?? savedPlanGroupingStrategy}; dropdown is ${selectedGroupingOption.label}. ` : ''}
            Click Refresh Saved Plan to apply the current settings before previewing or sending.
          </div>
        ) : null}
        <div className="email-marketing-checklist">
          {setupChecklist.map((item) => (
            <article key={item.label}>
              <CheckCircle2 size={18} />
              <div>
                <strong>{item.label}</strong>
                <span>{item.detail}</span>
              </div>
              <StatusBadge tone={item.tone}>{item.ready ? 'ready' : 'check'}</StatusBadge>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-email-card">
        <div className="admin-email-card__header admin-email-card__header--row">
          <div>
            <span className="eyebrow">Configuration</span>
            <h2>Campaigns</h2>
          </div>
          <button className="segmented-button segmented-button--gold" onClick={openNewCampaign} type="button">
            <Plus size={18} />
            Add Campaign
          </button>
        </div>

        {campaignDraft ? (
          <div className="email-marketing-campaign-editor">
            <label>
              <span>Campaign title *</span>
              <input
                value={campaignDraft.title}
                onChange={(event) => setCampaignDraft((current) => current ? { ...current, title: event.target.value } : current)}
                placeholder="Student touch-base campaign"
              />
            </label>
            <label>
              <span>Phase</span>
              <select value={campaignDraft.phase} onChange={(event) => setCampaignDraft((current) => current ? { ...current, phase: event.target.value } : current)}>
                {campaignPhaseOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Status</span>
              <select value={campaignDraft.status} onChange={(event) => setCampaignDraft((current) => current ? { ...current, status: event.target.value as CampaignDraft['status'] } : current)}>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label>
              <span>Priority weight</span>
              <input min={0} max={200} type="number" value={campaignDraft.rotationWeight} onChange={(event) => setCampaignDraft((current) => current ? { ...current, rotationWeight: Number(event.target.value) } : current)} />
            </label>
            <label>
              <span>Touch interval days</span>
              <input min={1} max={90} type="number" value={campaignDraft.touchIntervalDays} onChange={(event) => setCampaignDraft((current) => current ? { ...current, touchIntervalDays: Number(event.target.value) } : current)} />
            </label>
            <label className="email-marketing-editor-wide">
              <span>Preferred Email Centre template</span>
              <select value={campaignDraft.templateKey ?? ''} onChange={(event) => setCampaignDraft((current) => current ? { ...current, templateKey: event.target.value } : current)}>
                <option value="">No preferred template</option>
                {activeTemplates.map((template) => (
                  <option key={template.id} value={template.templateKey}>{template.templateName} · {template.phase}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Audience identifier</span>
              <select value={campaignDraft.audienceTag ?? ''} onChange={(event) => setCampaignDraft((current) => current ? { ...current, audienceTag: event.target.value } : current)}>
                <option value="">Any audience</option>
                {campaignAudienceTagOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Program fit</span>
              <select value={campaignDraft.programKeyRule ?? ''} onChange={(event) => setCampaignDraft((current) => current ? { ...current, programKeyRule: event.target.value } : current)}>
                <option value="">Any program</option>
                {cohortProgramOptions.map((programKey) => (
                  <option key={programKey} value={programKey}>{programKey}</option>
                ))}
                {campaignDraft.programKeyRule && !cohortProgramOptions.includes(campaignDraft.programKeyRule) ? (
                  <option value={campaignDraft.programKeyRule}>{campaignDraft.programKeyRule}</option>
                ) : null}
              </select>
            </label>
            <label>
              <span>Domain fit</span>
              <select value={campaignDraft.domainKeyRule ?? ''} onChange={(event) => setCampaignDraft((current) => current ? { ...current, domainKeyRule: event.target.value } : current)}>
                <option value="">Any domain</option>
                {cohortDomainOptions.map((domainKey) => (
                  <option key={domainKey} value={domainKey}>{domainKey}</option>
                ))}
                {campaignDraft.domainKeyRule && !cohortDomainOptions.includes(campaignDraft.domainKeyRule) ? (
                  <option value={campaignDraft.domainKeyRule}>{campaignDraft.domainKeyRule}</option>
                ) : null}
              </select>
            </label>
            <label>
              <span>Cohort stage fit</span>
              <select value={campaignDraft.cohortStage ?? ''} onChange={(event) => setCampaignDraft((current) => current ? { ...current, cohortStage: event.target.value } : current)}>
                {cohortStageOptions.map((option) => (
                  <option key={option.value || 'any'} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Activity fit</span>
              <select value={campaignDraft.activitySegment ?? ''} onChange={(event) => setCampaignDraft((current) => current ? { ...current, activitySegment: event.target.value } : current)}>
                {activitySegmentOptions.map((option) => (
                  <option key={option.value || 'any'} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Resource type rule</span>
              <select value={campaignDraft.resourceType ?? ''} onChange={(event) => setCampaignDraft((current) => current ? { ...current, resourceType: event.target.value } : current)}>
                {resourceTypeOptions.map((option) => (
                  <option key={option.value || 'any'} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Resource mode rule</span>
              <select value={campaignDraft.resourceMode ?? ''} onChange={(event) => setCampaignDraft((current) => current ? { ...current, resourceMode: event.target.value } : current)}>
                {resourceModeOptions.map((option) => (
                  <option key={option.value || 'any'} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="email-marketing-editor-wide">
              <span>Resource domain key rule</span>
              <select value={campaignDraft.resourceDomainKey ?? ''} onChange={(event) => setCampaignDraft((current) => current ? { ...current, resourceDomainKey: event.target.value } : current)}>
                <option value="">Any resource domain</option>
                {resourceDomainOptions.map((domainKey) => (
                  <option key={domainKey} value={domainKey}>{domainKey}</option>
                ))}
                {campaignDraft.resourceDomainKey && !resourceDomainOptions.includes(campaignDraft.resourceDomainKey) ? (
                  <option value={campaignDraft.resourceDomainKey}>{campaignDraft.resourceDomainKey}</option>
                ) : null}
              </select>
            </label>
            <label className="email-marketing-editor-wide">
              <span>Description</span>
              <textarea value={campaignDraft.description ?? ''} onChange={(event) => setCampaignDraft((current) => current ? { ...current, description: event.target.value } : current)} />
            </label>
            <label className="email-marketing-editor-wide">
              <span>Default subject</span>
              <input value={campaignDraft.defaultSubject ?? ''} onChange={(event) => setCampaignDraft((current) => current ? { ...current, defaultSubject: event.target.value } : current)} />
            </label>
            <label className="email-marketing-editor-wide">
              <span>Default body</span>
              <textarea value={campaignDraft.defaultBody ?? ''} onChange={(event) => setCampaignDraft((current) => current ? { ...current, defaultBody: event.target.value } : current)} />
            </label>
            <div className="email-marketing-editor-actions">
              <button className="student-action student-action--primary" disabled={createCampaign.isPending || updateCampaign.isPending} onClick={() => void saveCampaign()} type="button">
                <Save size={18} />
                Save Campaign
              </button>
              <button className="segmented-button" onClick={() => setCampaignDraft(null)} type="button">
                <X size={18} />
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        <div className="email-marketing-filter-bar email-marketing-filter-bar--section">
          <select aria-label="Filter campaigns by status" value={campaignStatusFilter} onChange={(event) => setCampaignStatusFilter(event.target.value)}>
            <option value="active">Active campaigns</option>
            <option value="all">All statuses</option>
            <option value="paused">Paused campaigns</option>
            <option value="archived">Archived campaigns</option>
          </select>
          <select aria-label="Filter campaigns by phase" value={campaignPhaseFilter} onChange={(event) => setCampaignPhaseFilter(event.target.value)}>
            <option value="all">All phases</option>
            {campaignPhaseOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <StatusBadge tone="neutral">{`${visibleCampaigns.length}/${campaigns.length}`}</StatusBadge>
        </div>

        {visibleCampaigns.length ? (
          <div className="email-marketing-campaign-list">
            {visibleCampaigns.map((item) => {
              const template = activeTemplates.find((activeTemplate) => activeTemplate.templateKey === item.templateKey);
              return (
                <article key={item.id}>
                  <div>
                    <div className="email-marketing-campaign-title">
                      <strong>{item.title}</strong>
                      <StatusBadge tone={item.status === 'active' ? 'safe' : item.status === 'paused' ? 'warning' : 'neutral'}>{item.status}</StatusBadge>
                    </div>
                    <span>{item.description || 'No description yet.'}</span>
                    <small>
                      {item.phase} · priority {item.rotationWeight} · every {item.touchIntervalDays} day{item.touchIntervalDays === 1 ? '' : 's'} · {template ? template.templateName : 'no preferred template'}
                    </small>
                    {(item.audienceRules.audienceTag || item.audienceRules.programKey || item.audienceRules.domainKey || item.audienceRules.cohortStage || item.audienceRules.activitySegment) ? (
                      <small>
                        Audience: {[item.audienceRules.audienceTag, item.audienceRules.programKey, item.audienceRules.domainKey, item.audienceRules.cohortStage, item.audienceRules.activitySegment].filter(Boolean).join(' · ')}
                      </small>
                    ) : null}
                    {(item.audienceRules.resourceType || item.audienceRules.resourceMode || item.audienceRules.resourceDomainKey) ? (
                      <small>
                        Resources: {[item.audienceRules.resourceType, item.audienceRules.resourceMode, item.audienceRules.resourceDomainKey].filter(Boolean).join(' · ')}
                      </small>
                    ) : null}
                  </div>
                  <button className="segmented-button" onClick={() => setCampaignDraft(campaignDraftFrom(item))} type="button">
                    <Edit3 size={18} />
                    Edit
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState />
        )}
      </section>
        </>
      ) : null}

      {activeTab === 'activity' ? (
        <>
      <section className="admin-email-card">
        <div className="admin-email-card__header admin-email-card__header--row">
          <div>
            <span className="eyebrow">Recent sends</span>
            <h2>Delivery context</h2>
          </div>
          <Link className="segmented-button" to="/admin/email-center">
            Open Email Centre
          </Link>
        </div>
        {queueItems.length ? (
          <div className="email-marketing-activity">
            {queueItems.map((item) => (
              <article key={item.id}>
                <div>
                  <strong>{item.subject || item.templateKey || 'Email activity'}</strong>
                  <span>{item.recipientName || item.recipientEmail || 'Recipient'} · {formatDate(item.sentAt || item.createdAt)}</span>
                </div>
                <StatusBadge tone={item.status === 'sent' ? 'safe' : item.status === 'failed' ? 'danger' : 'neutral'}>{item.status || 'queued'}</StatusBadge>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState />
        )}
      </section>
        </>
      ) : null}
    </div>
  );
}
