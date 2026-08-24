export type WorkshopTopicDraft = {
  id: string;
  isEditing: boolean;
  programKeys: string[];
  resourceIds: string[];
  title: string;
};

export type WorkshopTopicRecord = {
  programKeys: string[];
  resourceIds: string[];
  title: string;
};

export const workshopTopicStorageKey = 'admin-workshop-topic-options';

export const defaultWorkshopTopics = [
  'Market Research Foundation - MR',
  'Case Based Frameworks & Sample Mocks - Part 01',
  'Case Based Frameworks & Sample Mocks - Part 02',
  'Product & Brand Management - Detailed Overview',
  'Induction Session - Skilled Sapiens',
  'Forecasting of financial statements - Part 1',
  'How to think like a Consultant & Marketer',
  'Introduction to Equity Research, Financial Modeling & Excel'
];

export const customWorkshopTopicValue = '__custom_workshop_topic__';

export function uniqueTitles(values: string[]) {
  const seen = new Set<string>();
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function uniqueTopicRecords(values: WorkshopTopicRecord[]) {
  const records = new Map<string, WorkshopTopicRecord>();
  values.forEach((value) => {
    const title = value.title.trim();
    if (!title) return;
    const key = title.toLowerCase();
    const existing = records.get(key);
    records.set(key, {
      title,
      programKeys: uniqueTitles([...(existing?.programKeys ?? []), ...(value.programKeys ?? [])]).map((programKey) => programKey.toLowerCase()),
      resourceIds: uniqueTitles([...(existing?.resourceIds ?? []), ...(value.resourceIds ?? [])])
    });
  });
  return Array.from(records.values());
}

export function createTopicDraft(title = '', isEditing = title.trim().length === 0, programKeys: string[] = [], resourceIds: string[] = []): WorkshopTopicDraft {
  return {
    id: `topic-${Date.now()}-${Math.random()}`,
    isEditing,
    programKeys: uniqueTitles(programKeys).map((programKey) => programKey.toLowerCase()),
    resourceIds: uniqueTitles(resourceIds),
    title
  };
}

function toTopicRecords(value: unknown): WorkshopTopicRecord[] {
  if (!Array.isArray(value)) return defaultWorkshopTopics.map((title) => ({ title, programKeys: [], resourceIds: [] }));
  return uniqueTopicRecords(
    value
      .map((item) => {
        if (typeof item === 'string') return { title: item, programKeys: [], resourceIds: [] };
        if (!item || typeof item !== 'object') return null;
        const record = item as Record<string, unknown>;
        const title = typeof record.title === 'string' ? record.title : '';
        const programKeys = Array.isArray(record.programKeys) ? record.programKeys.filter((programKey): programKey is string => typeof programKey === 'string') : [];
        const resourceIds = Array.isArray(record.resourceIds) ? record.resourceIds.filter((resourceId): resourceId is string => typeof resourceId === 'string') : [];
        return { title, programKeys, resourceIds };
      })
      .filter((item): item is WorkshopTopicRecord => Boolean(item))
  );
}

export function loadSavedWorkshopTopicRecords() {
  if (typeof window === 'undefined') return defaultWorkshopTopics.map((title) => ({ title, programKeys: [], resourceIds: [] }));
  try {
    const parsed = JSON.parse(window.localStorage.getItem(workshopTopicStorageKey) ?? 'null');
    return toTopicRecords(parsed);
  } catch {
    return defaultWorkshopTopics.map((title) => ({ title, programKeys: [], resourceIds: [] }));
  }
}

export function loadSavedWorkshopTopics() {
  return loadSavedWorkshopTopicRecords().map((topic) => topic.title);
}

export function saveWorkshopTopics(topics: Array<string | WorkshopTopicRecord>) {
  if (typeof window === 'undefined') return;
  const records = uniqueTopicRecords(
    topics.map((topic) => (typeof topic === 'string' ? { title: topic, programKeys: [], resourceIds: [] } : topic))
  );
  window.localStorage.setItem(workshopTopicStorageKey, JSON.stringify(records));
}
