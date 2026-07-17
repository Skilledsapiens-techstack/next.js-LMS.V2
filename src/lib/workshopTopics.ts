export type WorkshopTopicDraft = {
  id: string;
  isEditing: boolean;
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

export function createTopicDraft(title = '', isEditing = title.trim().length === 0): WorkshopTopicDraft {
  return { id: `topic-${Date.now()}-${Math.random()}`, isEditing, title };
}

export function loadSavedWorkshopTopics() {
  if (typeof window === 'undefined') return defaultWorkshopTopics;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(workshopTopicStorageKey) ?? 'null');
    return Array.isArray(parsed) ? uniqueTitles(parsed.filter((item): item is string => typeof item === 'string')) : defaultWorkshopTopics;
  } catch {
    return defaultWorkshopTopics;
  }
}

export function saveWorkshopTopics(topics: string[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(workshopTopicStorageKey, JSON.stringify(topics));
}
