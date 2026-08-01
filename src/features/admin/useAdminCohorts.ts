import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiGet, apiPatch, apiPost } from '../../lib/supabaseApi';
import { PaginatedResponse } from '../student/useStudentAnnouncements';

export type AdminCohortStatus = 'upcoming' | 'active' | 'completed' | 'inactive';

export type AdminCohort = {
  cohortId?: string;
  domainKey?: string;
  endDate?: string;
  googleGroup?: string;
  id: string;
  name: string;
  programKey?: string;
  selfPaced: boolean;
  selfPacedResources: unknown[];
  selfPacedSessions: unknown[];
  startDate?: string;
  status: AdminCohortStatus;
  studentCount: number;
  updatedAt?: string;
  waLink?: string;
  waGroupName?: string;
};

export type AdminCohortImpact = {
  announcements: number;
  auditLogs: Array<{ action: string; actorEmail?: string; createdAt?: string; id: string; status?: string }>;
  resources: number;
  students: number;
  workshopItems: AdminCohortWorkshopAuditItem[];
  workshops: number;
};

export type AdminCohortWorkshopAuditItem = {
  date?: string;
  durationMinutes?: number;
  id: string;
  joinUrl?: string;
  programKey?: string;
  recordingUrl?: string;
  section: string;
  sectionOrder: number;
  sequenceNumber?: number;
  sessionType?: string;
  status?: string;
  time?: string;
  title: string;
  workshopId?: string;
};

export type AdminCohortCardMetrics = Record<string, { resources: number; students: number; workshops: number }>;

type RecordingSequenceRuleRecord = {
  matchAliases?: string[];
  programKey?: string;
  recordingSection?: string;
  sequenceNumber?: number;
  title?: string;
};

const recordingSectionOrder: Record<string, { label: string; order: number }> = {
  induction_live_project: { label: 'Induction & Live Project Overview', order: 1 },
  core_modules: { label: 'Core Modules', order: 2 },
  placement_mentorship: { label: 'Placement Mentorship', order: 3 },
  other_workshops: { label: 'Other Workshops', order: 4 }
};

export type AdminCohortsQuery = {
  enabled?: boolean;
  limit?: number;
  page?: number;
  program?: string;
  search?: string;
  sort?: string;
  status?: AdminCohortStatus | 'all';
};

export type AdminCreateCohortPayload = {
  cohortId?: string;
  domainKey?: string;
  endDate?: string;
  googleGroup?: string;
  name: string;
  programKey: string;
  selfPaced?: boolean;
  selfPacedResources?: unknown[];
  selfPacedSessions?: unknown[];
  startDate?: string;
  status: AdminCohortStatus;
  studentCount?: number;
  waGroupName?: string;
  waLink?: string;
};

export type AdminUpdateCohortPayload = Partial<AdminCreateCohortPayload>;

export function useAdminCohorts(query: AdminCohortsQuery) {
  const { accessToken } = useAuth();
  const limit = query.limit ?? 25;
  const page = query.page ?? 1;
  const program = query.program?.trim();
  const search = query.search?.trim();
  const sort = query.sort?.trim();
  const status = query.status ?? 'all';

  return useQuery({
    enabled: Boolean(accessToken) && query.enabled !== false,
    queryFn: () =>
      apiGet<PaginatedResponse<AdminCohort>>('/admins/cohorts', {
        accessToken: accessToken ?? undefined,
        query: {
          limit,
          page,
          program,
          search,
          sort,
          status
        }
      }),
    queryKey: ['admin-cohorts', accessToken, page, limit, status, search, program, sort],
    staleTime: 60_000
  });
}

export function useAdminAllCohorts(query: AdminCohortsQuery = {}) {
  const { accessToken } = useAuth();
  const program = query.program?.trim();
  const search = query.search?.trim();
  const sort = query.sort?.trim();
  const status = query.status ?? 'all';

  return useQuery({
    enabled: Boolean(accessToken) && query.enabled !== false,
    queryFn: async () => {
      const allItems: AdminCohort[] = [];
      let currentPage = 1;
      let latestResponse: PaginatedResponse<AdminCohort> | null = null;

      do {
        latestResponse = await apiGet<PaginatedResponse<AdminCohort>>('/admins/cohorts', {
          accessToken: accessToken ?? undefined,
          query: {
            limit: 500,
            page: currentPage,
            program,
            search,
            sort,
            status
          }
        });
        allItems.push(...latestResponse.items);
        currentPage += 1;
      } while (latestResponse.hasNextPage && currentPage <= 100);

      return latestResponse
        ? { ...latestResponse, hasNextPage: false, hasPreviousPage: false, items: allItems, page: 1, totalPages: 1 }
        : { hasNextPage: false, hasPreviousPage: false, items: allItems, limit: 500, page: 1, total: 0, totalPages: 1 };
    },
    queryKey: ['admin-all-cohorts', accessToken, status, search, program, sort],
    staleTime: 60_000
  });
}

export function useExportAdminCohorts() {
  const { accessToken } = useAuth();

  return useMutation({
    mutationFn: async (query: AdminCohortsQuery) => {
      const allItems: AdminCohort[] = [];
      let currentPage = 1;
      let latestResponse: PaginatedResponse<AdminCohort> | null = null;

      do {
        latestResponse = await apiGet<PaginatedResponse<AdminCohort>>('/admins/cohorts', {
          accessToken: accessToken ?? undefined,
          query: {
            limit: 500,
            page: currentPage,
            program: query.program?.trim(),
            search: query.search?.trim(),
            sort: query.sort?.trim(),
            status: query.status ?? 'all'
          }
        });
        allItems.push(...latestResponse.items);
        currentPage += 1;
      } while (latestResponse.hasNextPage && currentPage <= 100);

      return latestResponse ? { ...latestResponse, items: allItems, page: 1, totalPages: 1 } : { hasNextPage: false, hasPreviousPage: false, items: allItems, limit: 500, page: 1, total: 0, totalPages: 1 };
    }
  });
}

async function fetchAllAdminItems<TItem>(accessToken: string | undefined, path: string, query: Record<string, unknown> = {}) {
  const allItems: TItem[] = [];
  let currentPage = 1;
  let latestResponse: PaginatedResponse<TItem> | null = null;

  do {
    latestResponse = await apiGet<PaginatedResponse<TItem>>(path, {
      accessToken,
      query: { ...query, limit: 500, page: currentPage }
    });
    allItems.push(...latestResponse.items);
    currentPage += 1;
  } while (latestResponse.hasNextPage && currentPage <= 100);

  return allItems;
}

function includesCohortName(row: unknown, cohortName: string) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return false;
  const record = row as Record<string, unknown>;
  const names = record.cohortNames ?? record.cohort_names;
  if (!Array.isArray(names)) return false;
  return names.some((name) => String(name ?? '').trim() === cohortName);
}

function textValue(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function numberValue(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return undefined;
}

function normalizeRecordingSection(value: unknown) {
  const section = String(value ?? '').trim().toLowerCase();
  return recordingSectionOrder[section] ? section : 'other_workshops';
}

function normalizeRecordingSequenceText(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sequenceRuleMatchScore(rule: RecordingSequenceRuleRecord, record: Record<string, unknown>) {
  const workshopTitle = normalizeRecordingSequenceText(textValue(record, 'title', 'name') ?? '');
  if (!workshopTitle) return 0;

  const title = normalizeRecordingSequenceText(String(rule.title ?? ''));
  const aliases = compactUniqueStrings(Array.isArray(rule.matchAliases) ? rule.matchAliases : [])
    .map(normalizeRecordingSequenceText)
    .filter(Boolean);

  if (title && title === workshopTitle) return 100;
  if (aliases.some((alias) => alias === workshopTitle)) return 95;

  if (title && isStrongSequencePartialMatch(workshopTitle, title)) return 80;
  if (aliases.some((alias) => isStrongSequencePartialMatch(workshopTitle, alias))) return 70;

  return 0;
}

function isStrongSequencePartialMatch(workshopTitle: string, candidate: string) {
  if (!workshopTitle || !candidate) return false;
  const shorter = workshopTitle.length <= candidate.length ? workshopTitle : candidate;
  const longer = workshopTitle.length > candidate.length ? workshopTitle : candidate;
  if (shorter.length < 16 || !longer.includes(shorter)) return false;

  const candidateWords = new Set(candidate.split(' ').filter((word) => word.length >= 4));
  const workshopWords = new Set(workshopTitle.split(' ').filter((word) => word.length >= 4));
  if (candidateWords.size === 0 || workshopWords.size === 0) return false;

  const overlap = Array.from(candidateWords).filter((word) => workshopWords.has(word)).length;
  return overlap >= Math.min(3, candidateWords.size);
}

function compactUniqueStrings(values: unknown[]) {
  return Array.from(new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean)));
}

function matchedWorkshopSequenceRule(record: Record<string, unknown>, rules: RecordingSequenceRuleRecord[], cohortProgramKey?: string) {
  const programKeys = compactUniqueStrings([textValue(record, 'programKey', 'program_key'), cohortProgramKey]).map((key) => key.toLowerCase());
  const programKeySet = new Set(programKeys);

  return rules
    .filter((rule) => {
      const ruleProgramKey = String(rule.programKey ?? '').trim().toLowerCase();
      return !ruleProgramKey || programKeySet.size === 0 || programKeySet.has(ruleProgramKey);
    })
    .map((rule) => ({ rule, score: sequenceRuleMatchScore(rule, record) }))
    .filter((match) => match.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      const leftSequence = Number(left.rule.sequenceNumber);
      const rightSequence = Number(right.rule.sequenceNumber);
      if (Number.isFinite(leftSequence) && Number.isFinite(rightSequence) && leftSequence !== rightSequence) {
        return leftSequence - rightSequence;
      }
      return String(left.rule.title ?? '').localeCompare(String(right.rule.title ?? ''));
    })[0]?.rule;
}

function toWorkshopAuditItem(row: unknown, sequenceRules: RecordingSequenceRuleRecord[] = [], cohortProgramKey?: string): AdminCohortWorkshopAuditItem {
  const record = row && typeof row === 'object' && !Array.isArray(row) ? (row as Record<string, unknown>) : {};
  const title = textValue(record, 'title', 'name') ?? 'Untitled workshop';
  const recordingUrl = textValue(record, 'youtubeVideoUrl', 'youtube_video_url', 'zoomRecordingUrl', 'zoom_recording_url');
  const matchedRule = matchedWorkshopSequenceRule(record, sequenceRules, cohortProgramKey);
  const sectionKey = normalizeRecordingSection(matchedRule?.recordingSection ?? record.recordingSection ?? record.recording_section);
  const section = recordingSectionOrder[sectionKey] ?? recordingSectionOrder.other_workshops;
  const sequenceNumber = Number(matchedRule?.sequenceNumber);

  return {
    date: textValue(record, 'date'),
    durationMinutes: numberValue(record, 'durationMinutes', 'duration_minutes'),
    id: textValue(record, 'id', 'workshopId', 'workshop_id') ?? `${title}-${textValue(record, 'date') ?? ''}`,
    joinUrl: textValue(record, 'joinUrl', 'join_url'),
    programKey: textValue(record, 'programKey', 'program_key'),
    recordingUrl,
    section: section.label,
    sectionOrder: section.order,
    sequenceNumber: Number.isFinite(sequenceNumber) ? sequenceNumber : undefined,
    sessionType: textValue(record, 'sessionType', 'session_type'),
    status: textValue(record, 'status', 'workshop_status'),
    time: textValue(record, 'time'),
    title,
    workshopId: textValue(record, 'workshopId', 'workshop_id')
  };
}

function workshopSortValue(item: AdminCohortWorkshopAuditItem) {
  if (!item.date) return Number.POSITIVE_INFINITY;
  const date = new Date(`${item.date}T${item.time || '00:00'}`).getTime();
  return Number.isFinite(date) ? date : Number.POSITIVE_INFINITY;
}

function toRecordingSequenceRuleRecord(row: unknown): RecordingSequenceRuleRecord | null {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  const record = row as Record<string, unknown>;
  return {
    matchAliases: Array.isArray(record.matchAliases ?? record.match_aliases) ? ((record.matchAliases ?? record.match_aliases) as unknown[]).map((value) => String(value ?? '')).filter(Boolean) : [],
    programKey: textValue(record, 'programKey', 'program_key'),
    recordingSection: textValue(record, 'recordingSection', 'recording_section'),
    sequenceNumber: numberValue(record, 'sequenceNumber', 'sequence_number'),
    title: textValue(record, 'title')
  };
}

export function useAdminCohortCardMetrics(cohortNames: string[]) {
  const { accessToken } = useAuth();
  const names = Array.from(new Set(cohortNames.map((name) => name.trim()).filter(Boolean))).sort();

  return useQuery({
    enabled: Boolean(accessToken && names.length > 0),
    queryFn: async () => {
      const [workshops, resources, studentCounts] = await Promise.all([
        fetchAllAdminItems<unknown>(accessToken ?? undefined, '/admins/workshops', { status: 'all' }),
        fetchAllAdminItems<unknown>(accessToken ?? undefined, '/admins/resources', { status: 'all' }),
        Promise.all(
          names.map(async (cohortName) => {
            const response = await apiGet<PaginatedResponse<unknown>>('/admins/students', {
              accessToken: accessToken ?? undefined,
              query: { cohortName, limit: 1, page: 1, status: 'all' }
            });
            return [cohortName, response.total] as const;
          })
        )
      ]);

      const metrics = names.reduce<AdminCohortCardMetrics>((current, name) => {
        current[name] = { resources: 0, students: 0, workshops: 0 };
        return current;
      }, {});

      studentCounts.forEach(([name, count]) => {
        if (metrics[name]) metrics[name].students = count;
      });
      workshops.forEach((item) => {
        names.forEach((name) => {
          if (includesCohortName(item, name)) metrics[name].workshops += 1;
        });
      });
      resources.forEach((item) => {
        names.forEach((name) => {
          if (includesCohortName(item, name)) metrics[name].resources += 1;
        });
      });

      return metrics;
    },
    queryKey: ['admin-cohort-card-metrics', accessToken, names.join('|')],
    staleTime: 30_000
  });
}

export function useAdminCohortImpact(cohort?: Pick<AdminCohort, 'id' | 'name' | 'programKey'> | null) {
  const { accessToken } = useAuth();
  const cohortName = cohort?.name?.trim();
  const cohortId = cohort?.id?.trim();
  const cohortProgramKey = cohort?.programKey?.trim().toLowerCase();

  return useQuery({
    enabled: Boolean(accessToken && cohortName && cohortId),
    queryFn: async () => {
      const [students, resources, workshops, sequenceRules, announcements, auditLogs] = await Promise.all([
        apiGet<PaginatedResponse<unknown>>('/admins/students', {
          accessToken: accessToken ?? undefined,
          query: { cohortName, limit: 1, page: 1, status: 'all' }
        }),
        apiGet<PaginatedResponse<unknown>>('/admins/resources', {
          accessToken: accessToken ?? undefined,
          query: { cohortName, limit: 1, page: 1, status: 'all' }
        }),
        fetchAllAdminItems<unknown>(accessToken ?? undefined, '/admins/workshops', { status: 'all' }),
        fetchAllAdminItems<unknown>(accessToken ?? undefined, '/admins/recording-sequences', { status: 'active' }),
        apiGet<PaginatedResponse<unknown>>('/admins/announcements', {
          accessToken: accessToken ?? undefined,
          query: { audience: 'cohort', limit: 500, page: 1, status: 'all' }
        }),
        apiGet<PaginatedResponse<{ action: string; actorEmail?: string; createdAt?: string; id: string; status?: string }>>('/admins/audit-logs', {
          accessToken: accessToken ?? undefined,
          query: { entityId: cohortId, entityType: 'cohort', limit: 8, page: 1, sort: 'newest' }
        })
      ]);

      const activeSequenceRules = sequenceRules.map(toRecordingSequenceRuleRecord).filter((item): item is RecordingSequenceRuleRecord => Boolean(item));
      const workshopItems = workshops
        .filter((item) => includesCohortName(item, cohortName ?? ''))
        .map((item) => toWorkshopAuditItem(item, activeSequenceRules, cohortProgramKey))
        .sort((left, right) => {
          if (left.sectionOrder !== right.sectionOrder) return left.sectionOrder - right.sectionOrder;
          const sequenceDiff = (left.sequenceNumber ?? Number.POSITIVE_INFINITY) - (right.sequenceNumber ?? Number.POSITIVE_INFINITY);
          if (sequenceDiff !== 0) return sequenceDiff;
          const dateDiff = workshopSortValue(left) - workshopSortValue(right);
          if (dateDiff !== 0) return dateDiff;
          return left.title.localeCompare(right.title);
        });

      return {
        announcements: announcements.items.filter((item) => includesCohortName(item, cohortName ?? '')).length,
        auditLogs: auditLogs.items,
        resources: resources.total,
        students: students.total,
        workshopItems,
        workshops: workshopItems.length
      } satisfies AdminCohortImpact;
    },
    queryKey: ['admin-cohort-impact', accessToken, cohortId, cohortName, cohortProgramKey],
    staleTime: 30_000
  });
}

export function useCreateAdminCohort() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: AdminCreateCohortPayload) =>
      apiPost<AdminCohort, AdminCreateCohortPayload>('/admins/cohorts', {
        accessToken: accessToken ?? undefined,
        body
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-cohorts'] })
  });
}

export function useUpdateAdminCohort() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ cohortId, body }: { body: AdminUpdateCohortPayload; cohortId: string }) =>
      apiPatch<AdminCohort, AdminUpdateCohortPayload>(`/admins/cohorts/${cohortId}`, {
        accessToken: accessToken ?? undefined,
        body
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-cohorts'] })
  });
}

export function useUpdateAdminCohortStatus() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ cohortId, status }: { cohortId: string; status: AdminCohortStatus }) =>
      apiPatch<AdminCohort, { status: AdminCohortStatus }>(`/admins/cohorts/${cohortId}/status`, {
        accessToken: accessToken ?? undefined,
        body: { status }
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-cohorts'] })
  });
}
