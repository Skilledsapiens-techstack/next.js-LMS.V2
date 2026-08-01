import { Bold, Copy, CornerDownLeft, ExternalLink, Italic, List, ListOrdered, MessageCircle, Plus, Save, Search } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenStates';
import { StatusBadge } from '../components/StatusBadge';
import { useAdminAllCohorts, useUpdateAdminCohort } from '../features/admin/useAdminCohorts';
import { useAdminPrograms } from '../features/admin/useAdminPrograms';
import { AdminWorkshop, useAdminWorkshops } from '../features/admin/useAdminWorkshops';
import {
  AdminWhatsAppCategory,
  AdminWhatsAppGroup,
  AdminWhatsAppTemplate,
  useAdminWhatsAppCategories,
  useAdminWhatsAppGroups,
  useAdminWhatsAppLogs,
  useAdminWhatsAppTemplates,
  useCreateAdminWhatsAppCategory,
  useCreateAdminWhatsAppGroup,
  useCreateAdminWhatsAppLog,
  useCreateAdminWhatsAppTemplate,
  useUpdateAdminWhatsAppCategory,
  useUpdateAdminWhatsAppGroup,
  useUpdateAdminWhatsAppTemplate,
  WhatsAppStatus
} from '../features/admin/useAdminWhatsApp';

type GroupFormState = {
  cohortName: string;
  directChatLink: string;
  groupName: string;
  inviteLink: string;
  notes: string;
  programName: string;
  status: WhatsAppStatus;
};

type CategoryFormState = {
  name: string;
  sortOrder: string;
  status: WhatsAppStatus;
};

type TemplateFormState = {
  categoryId: string;
  messageBody: string;
  notes: string;
  status: WhatsAppStatus;
  title: string;
};

type ComposerState = {
  categoryId: string;
  groupId: string;
  groupIds: string[];
  messageBody: string;
  messageTitle: string;
  notes: string;
  templateId: string;
};

type MessageFormatAction = 'bold' | 'italic' | 'bullet' | 'numbered' | 'lineBreak';

const emptyGroupForm: GroupFormState = {
  cohortName: '',
  directChatLink: '',
  groupName: '',
  inviteLink: '',
  notes: '',
  programName: '',
  status: 'active'
};

const emptyCategoryForm: CategoryFormState = {
  name: '',
  sortOrder: '100',
  status: 'active'
};

const emptyTemplateForm: TemplateFormState = {
  categoryId: '',
  messageBody: '',
  notes: '',
  status: 'active',
  title: ''
};

const emptyComposer: ComposerState = {
  categoryId: '',
  groupId: '',
  groupIds: [],
  messageBody: '',
  messageTitle: '',
  notes: '',
  templateId: ''
};

function formatDateTime(value: string | undefined) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { day: '2-digit', hour: '2-digit', minute: '2-digit', month: 'short', year: 'numeric' });
}

function readableError(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function groupToForm(group: AdminWhatsAppGroup): GroupFormState {
  return {
    cohortName: group.cohortName ?? '',
    directChatLink: group.directChatLink ?? '',
    groupName: group.groupName,
    inviteLink: group.inviteLink ?? '',
    notes: group.notes ?? '',
    programName: group.programName ?? '',
    status: group.status
  };
}

function categoryToForm(category: AdminWhatsAppCategory): CategoryFormState {
  return {
    name: category.name,
    sortOrder: String(category.sortOrder ?? 100),
    status: category.status
  };
}

function templateToForm(template: AdminWhatsAppTemplate): TemplateFormState {
  return {
    categoryId: template.categoryId ?? '',
    messageBody: template.messageBody,
    notes: template.notes ?? '',
    status: template.status,
    title: template.title
  };
}

function categoryName(categories: AdminWhatsAppCategory[], categoryId: string | null | undefined) {
  return categories.find((category) => category.id === categoryId)?.name ?? 'Uncategorized';
}

function programNameFromKey(programs: Array<{ name: string; programKey: string }>, programKey: string | undefined) {
  if (!programKey) return null;
  return programs.find((program) => program.programKey === programKey)?.name ?? programKey;
}

function formatShortDate(value: string | undefined) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function openUrl(url: string | undefined | null) {
  if (!url) return;
  window.open(url, '_blank', 'noopener,noreferrer');
}

function formatWhatsAppMessage(value: string, action: MessageFormatAction) {
  const trimmed = value.trim();

  if (action === 'lineBreak') return value ? `${value}\n\n` : '\n';
  if (action === 'bold') return trimmed ? `*${trimmed}*` : '*message*';
  if (action === 'italic') return trimmed ? `_${trimmed}_` : '_message_';

  const lines = (value || 'Message line').split('\n');
  if (action === 'numbered') {
    return lines.map((line, index) => (line.trim() ? `${index + 1}. ${line.replace(/^\d+\.\s*/, '').trim()}` : line)).join('\n');
  }

  return lines.map((line) => (line.trim() ? `- ${line.replace(/^[-*]\s*/, '').trim()}` : line)).join('\n');
}

function renderMessageVariables(
  body: string,
  context: {
    categoryName?: string;
    cohortName?: string | null;
    groupName?: string | null;
    programName?: string | null;
    workshopDate?: string;
    workshopTime?: string;
    workshopTitle?: string;
  }
) {
  const today = new Date().toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  const variables: Record<string, string> = {
    categoryName: context.categoryName ?? '',
    cohortName: context.cohortName ?? '',
    date: today,
    groupName: context.groupName ?? '',
    programName: context.programName ?? '',
    today,
    workshopDate: context.workshopDate ?? '',
    workshopTime: context.workshopTime ?? '',
    workshopTitle: context.workshopTitle ?? ''
  };
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => variables[key] ?? '');
}

function MessageFormatToolbar({ onFormat }: { onFormat: (action: MessageFormatAction) => void }) {
  return (
    <div className="whatsapp-admin-formatbar" aria-label="WhatsApp message formatting">
      <button onClick={() => onFormat('bold')} title="Bold" type="button">
        <Bold size={14} />
        Bold
      </button>
      <button onClick={() => onFormat('italic')} title="Italic" type="button">
        <Italic size={14} />
        Italic
      </button>
      <button onClick={() => onFormat('bullet')} title="Bullet list" type="button">
        <List size={14} />
        Bullets
      </button>
      <button onClick={() => onFormat('numbered')} title="Numbered list" type="button">
        <ListOrdered size={14} />
        Numbered
      </button>
      <button onClick={() => onFormat('lineBreak')} title="Add line break" type="button">
        <CornerDownLeft size={14} />
        Line
      </button>
    </div>
  );
}

export function AdminWhatsAppGroupsPage() {
  const groupsQuery = useAdminWhatsAppGroups({ limit: 1000, status: 'all' });
  const categoriesQuery = useAdminWhatsAppCategories({ limit: 100, status: 'all' });
  const templatesQuery = useAdminWhatsAppTemplates({ limit: 500, status: 'all' });
  const logsQuery = useAdminWhatsAppLogs({ limit: 60, status: 'all' });
  const cohortsQuery = useAdminAllCohorts({ sort: 'name', status: 'all' });
  const programsQuery = useAdminPrograms({ limit: 500, page: 1, status: 'all' });
  const workshopsQuery = useAdminWorkshops({ limit: 100, status: 'Upcoming' });

  const createGroup = useCreateAdminWhatsAppGroup();
  const updateGroup = useUpdateAdminWhatsAppGroup();
  const updateCohort = useUpdateAdminCohort();
  const createCategory = useCreateAdminWhatsAppCategory();
  const updateCategory = useUpdateAdminWhatsAppCategory();
  const createTemplate = useCreateAdminWhatsAppTemplate();
  const updateTemplate = useUpdateAdminWhatsAppTemplate();
  const createLog = useCreateAdminWhatsAppLog();

  const [groupForm, setGroupForm] = useState<GroupFormState>(emptyGroupForm);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(emptyCategoryForm);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [templateForm, setTemplateForm] = useState<TemplateFormState>(emptyTemplateForm);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [composer, setComposer] = useState<ComposerState>(emptyComposer);
  const [directorySearch, setDirectorySearch] = useState('');
  const [bulkTargetsSearch, setBulkTargetsSearch] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const groups = groupsQuery.data?.items ?? [];
  const categories = categoriesQuery.data?.items ?? [];
  const templates = templatesQuery.data?.items ?? [];
  const logs = logsQuery.data?.items ?? [];
  const cohortOptions = cohortsQuery.data?.items ?? [];
  const programOptions = programsQuery.data?.items ?? [];
  const upcomingWorkshops = workshopsQuery.data?.items ?? [];

  const selectedGroup = useMemo(() => groups.find((group) => group.id === composer.groupId), [composer.groupId, groups]);
  const selectedGroupFormCohort = useMemo(() => cohortOptions.find((cohort) => cohort.name === groupForm.cohortName), [cohortOptions, groupForm.cohortName]);
  const selectedComposerGroups = useMemo(() => groups.filter((group) => composer.groupIds.includes(group.id)), [composer.groupIds, groups]);
  const targetGroups = selectedComposerGroups.length > 0 ? selectedComposerGroups : selectedGroup ? [selectedGroup] : [];
  const selectedTemplate = useMemo(() => templates.find((template) => template.id === composer.templateId), [composer.templateId, templates]);
  const selectedCategory = useMemo(() => categories.find((category) => category.id === composer.categoryId), [categories, composer.categoryId]);
  const activeCategories = categories.filter((category) => category.status === 'active');
  const activeTemplates = templates.filter((template) => template.status === 'active');
  const activeGroups = groups.filter((group) => group.status === 'active');
  const normalizedBulkTargetsSearch = bulkTargetsSearch.trim().toLowerCase();
  const visibleBulkTargetGroups = useMemo(() => {
    if (!normalizedBulkTargetsSearch) return activeGroups;
    return activeGroups.filter((group) => group.groupName.toLowerCase().includes(normalizedBulkTargetsSearch));
  }, [activeGroups, normalizedBulkTargetsSearch]);
  const normalizedDirectorySearch = directorySearch.trim().toLowerCase();
  const directoryGroups = useMemo(() => {
    if (!normalizedDirectorySearch) return groups;
    return groups.filter((group) =>
      [
        group.groupName,
        group.cohortName,
        group.programName,
        group.status,
        group.notes,
        group.inviteLink,
        group.directChatLink
      ].some((value) => String(value ?? '').toLowerCase().includes(normalizedDirectorySearch))
    );
  }, [groups, normalizedDirectorySearch]);
  const cohortsWithGroups = new Set(groups.map((group) => group.cohortName).filter(Boolean));
  const missingCohortGroupRecords = cohortOptions.filter((cohort) => cohort.waGroupName && !cohortsWithGroups.has(cohort.name));
  const groupsMissingLinks = groups.filter((group) => !group.inviteLink && !group.directChatLink);
  const duplicateCohortGroups = groups.filter((group, index) => group.cohortName && groups.findIndex((item) => item.cohortName === group.cohortName) !== index);
  const isLoading = groupsQuery.isLoading || categoriesQuery.isLoading || templatesQuery.isLoading || logsQuery.isLoading || programsQuery.isLoading || workshopsQuery.isLoading;
  const queryError = groupsQuery.error || categoriesQuery.error || templatesQuery.error || logsQuery.error || programsQuery.error || workshopsQuery.error;

  function resetMessages() {
    setError(null);
    setNotice(null);
  }

  async function copyMessage() {
    resetMessages();
    if (!composer.messageBody.trim()) {
      setError('Add or choose a message before copying.');
      return;
    }
    if (targetGroups.length === 0) {
      setError('Select at least one WhatsApp group before copying.');
      return;
    }
    const copiedText = targetGroups.length > 1
      ? targetGroups.map((group) => `${group.groupName}\n${renderMessageForGroup(group)}`).join('\n\n---\n\n')
      : renderMessageForGroup(targetGroups[0]);
    await navigator.clipboard.writeText(copiedText);
    setNotice(targetGroups.length > 1 ? `${targetGroups.length} group messages copied.` : 'Message copied.');
  }

  async function saveGroup(event: FormEvent) {
    event.preventDefault();
    resetMessages();
    try {
      const payload = {
        cohortName: groupForm.cohortName || null,
        directChatLink: groupForm.directChatLink || null,
        groupName: groupForm.groupName,
        inviteLink: groupForm.inviteLink || null,
        notes: groupForm.notes || null,
        programName: groupForm.programName || null,
        status: groupForm.status
      };
      const duplicateGroup = !selectedGroupId && groupForm.cohortName ? groups.find((group) => group.cohortName === groupForm.cohortName) : null;
      if (selectedGroupId) await updateGroup.mutateAsync({ groupId: selectedGroupId, body: payload });
      else if (duplicateGroup) await updateGroup.mutateAsync({ groupId: duplicateGroup.id, body: payload });
      else await createGroup.mutateAsync(payload);
      if (selectedGroupFormCohort && groupForm.groupName.trim()) {
        const nextGroupName = groupForm.groupName.trim();
        const nextInviteLink = groupForm.inviteLink.trim();
        const shouldSyncGroupName = nextGroupName !== (selectedGroupFormCohort.waGroupName ?? '').trim();
        const shouldSyncInviteLink = nextInviteLink && nextInviteLink !== (selectedGroupFormCohort.waLink ?? '').trim();
        if (shouldSyncGroupName || shouldSyncInviteLink) {
          await updateCohort.mutateAsync({
            body: {
              ...(shouldSyncGroupName ? { waGroupName: nextGroupName } : {}),
              ...(shouldSyncInviteLink ? { waLink: nextInviteLink } : {})
            },
            cohortId: selectedGroupFormCohort.id
          });
        }
      }
      setGroupForm(emptyGroupForm);
      setSelectedGroupId(null);
      setNotice(selectedGroupFormCohort ? 'WhatsApp group saved and cohort WhatsApp fields synced.' : 'WhatsApp group saved.');
    } catch (saveError) {
      setError(readableError(saveError, 'WhatsApp group could not be saved.'));
    }
  }

  async function saveCategory(event: FormEvent) {
    event.preventDefault();
    resetMessages();
    try {
      const payload = {
        name: categoryForm.name,
        sortOrder: Number(categoryForm.sortOrder || 100),
        status: categoryForm.status
      };
      if (selectedCategoryId) await updateCategory.mutateAsync({ categoryId: selectedCategoryId, body: payload });
      else await createCategory.mutateAsync(payload);
      setCategoryForm(emptyCategoryForm);
      setSelectedCategoryId(null);
      setNotice('WhatsApp category saved.');
    } catch (saveError) {
      setError(readableError(saveError, 'WhatsApp category could not be saved.'));
    }
  }

  async function saveTemplate(event: FormEvent) {
    event.preventDefault();
    resetMessages();
    try {
      const payload = {
        categoryId: templateForm.categoryId || null,
        messageBody: templateForm.messageBody,
        notes: templateForm.notes || null,
        status: templateForm.status,
        title: templateForm.title
      };
      if (selectedTemplateId) await updateTemplate.mutateAsync({ templateId: selectedTemplateId, body: payload });
      else await createTemplate.mutateAsync(payload);
      setTemplateForm(emptyTemplateForm);
      setSelectedTemplateId(null);
      setNotice('WhatsApp template saved.');
    } catch (saveError) {
      setError(readableError(saveError, 'WhatsApp template could not be saved.'));
    }
  }

  async function markSent() {
    resetMessages();
    if (targetGroups.length === 0) {
      setError('Select at least one WhatsApp group first.');
      return;
    }
    if (!composer.messageTitle.trim() || !composer.messageBody.trim()) {
      setError('Add message title and body before marking as sent.');
      return;
    }
    try {
      for (const group of targetGroups) {
        await createLog.mutateAsync({
          categoryId: composer.categoryId || null,
          cohortName: group.cohortName ?? null,
          groupId: group.id,
          groupName: group.groupName,
          messageBody: renderMessageForGroup(group),
          messageTitle: composer.messageTitle,
          notes: composer.notes || null,
          programName: group.programName ?? null,
          sentAt: new Date().toISOString(),
          status: 'sent',
          templateId: composer.templateId || null
        });
      }
      setNotice(`${targetGroups.length} WhatsApp message${targetGroups.length === 1 ? '' : 's'} marked as sent and logged.`);
    } catch (saveError) {
      setError(readableError(saveError, 'Message history could not be saved.'));
    }
  }

  function applyTemplate(templateId: string) {
    const template = templates.find((item) => item.id === templateId);
    setComposer((current) => ({
      ...current,
      categoryId: template?.categoryId ?? current.categoryId,
      messageBody: template?.messageBody ?? current.messageBody,
      messageTitle: template?.title ?? current.messageTitle,
      templateId
    }));
  }

  function renderMessageForGroup(group: AdminWhatsAppGroup | undefined) {
    return renderMessageVariables(composer.messageBody, {
      categoryName: categoryName(categories, composer.categoryId),
      cohortName: group?.cohortName,
      groupName: group?.groupName,
      programName: group?.programName
    });
  }

  function formatComposerMessage(action: MessageFormatAction) {
    setComposer((current) => ({ ...current, messageBody: formatWhatsAppMessage(current.messageBody, action) }));
  }

  function formatTemplateMessage(action: MessageFormatAction) {
    setTemplateForm((current) => ({ ...current, messageBody: formatWhatsAppMessage(current.messageBody, action) }));
  }

  function selectCohort(cohortName: string) {
    const cohort = cohortOptions.find((item) => item.name === cohortName);
    setGroupForm((current) => ({
      ...current,
      cohortName,
      groupName: cohort?.waGroupName?.trim() || current.groupName,
      inviteLink: cohort?.waLink?.trim() || current.inviteLink,
      programName: programNameFromKey(programOptions, cohort?.programKey) ?? current.programName
    }));
  }

  function toggleComposerGroup(groupId: string) {
    setComposer((current) => {
      const groupIds = current.groupIds.includes(groupId) ? current.groupIds.filter((id) => id !== groupId) : [...current.groupIds, groupId];
      return { ...current, groupId: groupIds[0] ?? '', groupIds };
    });
  }

  function selectWorkshopReminder(workshop: AdminWorkshop) {
    const category = activeCategories.find((item) => item.name.toLowerCase() === 'workshop reminder');
    const matchingGroupIds = activeGroups.filter((group) => group.cohortName && workshop.cohortNames.includes(group.cohortName)).map((group) => group.id);
    setComposer((current) => ({
      ...current,
      categoryId: category?.id ?? current.categoryId,
      groupId: matchingGroupIds[0] ?? current.groupId,
      groupIds: matchingGroupIds,
      messageBody: `Hi {{cohortName}},\n\nReminder: ${workshop.title} is scheduled on ${formatShortDate(workshop.date)}${workshop.time ? ` at ${workshop.time}` : ''}.\n\nPlease join on time.`,
      messageTitle: `Workshop reminder: ${workshop.title}`
    }));
    setNotice(matchingGroupIds.length > 0 ? `${matchingGroupIds.length} matching WhatsApp group${matchingGroupIds.length === 1 ? '' : 's'} selected for this workshop.` : 'Workshop message prepared, but no matching WhatsApp group was found.');
  }

  async function syncMissingCohortGroups() {
    resetMessages();
    if (missingCohortGroupRecords.length === 0) {
      setNotice('All configured cohort WhatsApp groups are already synced.');
      return;
    }
    try {
      for (const cohort of missingCohortGroupRecords) {
        await createGroup.mutateAsync({
          cohortName: cohort.name,
          directChatLink: null,
          groupName: cohort.waGroupName ?? cohort.name,
          inviteLink: cohort.waLink ?? null,
          notes: 'Auto-created from Cohort module.',
          programName: programNameFromKey(programOptions, cohort.programKey),
          status: 'active'
        });
      }
      setNotice(`${missingCohortGroupRecords.length} cohort WhatsApp group record${missingCohortGroupRecords.length === 1 ? '' : 's'} synced.`);
    } catch (syncError) {
      setError(readableError(syncError, 'Cohort WhatsApp groups could not be synced.'));
    }
  }

  return (
    <main className="page-frame admin-whatsapp-page">
      <PageHeader
        actions={
          <button className="segmented-button segmented-button--active" onClick={() => openUrl(selectedGroup?.directChatLink || selectedGroup?.inviteLink || 'https://web.whatsapp.com/')} type="button">
            <ExternalLink size={18} />
            Open WhatsApp
          </button>
        }
        description="Manage cohort-wise WhatsApp groups, reusable messages, and sent-message audit history."
        eyebrow="Admin communications"
        title="WhatsApp Groups"
      />

      {notice ? <div className="whatsapp-admin-alert whatsapp-admin-alert--success">{notice}</div> : null}
      {error ? <div className="whatsapp-admin-alert whatsapp-admin-alert--error">{error}</div> : null}
      {isLoading ? <LoadingState /> : null}
      {queryError ? <ErrorState /> : null}

      <section className="whatsapp-admin-panel whatsapp-admin-automation">
        <div className="whatsapp-admin-panel__header">
          <div>
            <span className="section-eyebrow">Automation helpers</span>
            <h2>Reduce Manual WhatsApp Work</h2>
          </div>
          <button className="segmented-button" disabled={createGroup.isPending || missingCohortGroupRecords.length === 0} onClick={syncMissingCohortGroups} type="button">
            Sync from Cohorts
          </button>
        </div>
        <div className="whatsapp-admin-health-grid">
          <div>
            <strong>{missingCohortGroupRecords.length}</strong>
            <span>Cohorts ready to sync</span>
          </div>
          <div>
            <strong>{groupsMissingLinks.length}</strong>
            <span>Groups missing links</span>
          </div>
          <div>
            <strong>{duplicateCohortGroups.length}</strong>
            <span>Duplicate cohort records</span>
          </div>
          <div>
            <strong>{targetGroups.length}</strong>
            <span>Selected send targets</span>
          </div>
        </div>
        <div className="whatsapp-admin-workshop-strip">
          <span className="whatsapp-admin-mini-title">Upcoming workshop shortcuts</span>
          {upcomingWorkshops.slice(0, 4).map((workshop) => (
            <button key={workshop.id} className="whatsapp-admin-shortcut" onClick={() => selectWorkshopReminder(workshop)} type="button">
              <strong>{workshop.title}</strong>
              <span>{formatShortDate(workshop.date)} {workshop.time ? `- ${workshop.time}` : ''}</span>
            </button>
          ))}
          {upcomingWorkshops.length === 0 ? <span className="whatsapp-admin-hint">No upcoming workshops found.</span> : null}
        </div>
      </section>

      <section className="whatsapp-admin-grid">
        <form className="whatsapp-admin-panel whatsapp-admin-group-form" onSubmit={saveGroup}>
          <div className="whatsapp-admin-panel__header">
            <div>
              <span className="section-eyebrow">Group directory</span>
              <h2>{selectedGroupId ? 'Edit WhatsApp Group' : 'Add WhatsApp Group'}</h2>
            </div>
            <button className="segmented-button" type="button" onClick={() => { setSelectedGroupId(null); setGroupForm(emptyGroupForm); }}>
              <Plus size={16} />
              New
            </button>
          </div>
          <div className="whatsapp-admin-form-grid">
            <label>
              <span>Group Name *</span>
              <input value={groupForm.groupName} onChange={(event) => setGroupForm((current) => ({ ...current, groupName: event.target.value }))} />
            </label>
            <label>
              <span>Cohort Name</span>
              <select value={groupForm.cohortName} onChange={(event) => selectCohort(event.target.value)}>
                <option value="">Select cohort</option>
                {cohortOptions.map((cohort) => (
                  <option key={cohort.id} value={cohort.name}>{cohort.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Program Name</span>
              <select value={groupForm.programName} onChange={(event) => setGroupForm((current) => ({ ...current, programName: event.target.value }))}>
                <option value="">Select program</option>
                {programOptions.map((program) => (
                  <option key={program.id} value={program.name}>{program.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Status</span>
              <select value={groupForm.status} onChange={(event) => setGroupForm((current) => ({ ...current, status: event.target.value as WhatsAppStatus }))}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <label className="whatsapp-admin-form-grid__wide">
              <span>Invite Link</span>
              <input placeholder="https://chat.whatsapp.com/..." value={groupForm.inviteLink} onChange={(event) => setGroupForm((current) => ({ ...current, inviteLink: event.target.value }))} />
            </label>
            <label className="whatsapp-admin-form-grid__wide">
              <span>Direct Chat Link</span>
              <input placeholder="Optional, if available" value={groupForm.directChatLink} onChange={(event) => setGroupForm((current) => ({ ...current, directChatLink: event.target.value }))} />
            </label>
            <label className="whatsapp-admin-form-grid__wide">
              <span>Notes</span>
              <textarea rows={3} value={groupForm.notes} onChange={(event) => setGroupForm((current) => ({ ...current, notes: event.target.value }))} />
            </label>
          </div>
          <div className="whatsapp-admin-form-actions">
            <button className="segmented-button segmented-button--active" disabled={createGroup.isPending || updateGroup.isPending || updateCohort.isPending} type="submit">
              <Save size={16} />
              Save Group
            </button>
          </div>
        </form>

        <section className="whatsapp-admin-panel">
          <div className="whatsapp-admin-panel__header">
            <div>
              <span className="section-eyebrow">Prepare message</span>
              <h2>Send Tracker</h2>
            </div>
            <MessageCircle size={22} />
          </div>
          <div className="whatsapp-admin-form-grid">
            <label>
              <span>WhatsApp Group</span>
              <select value={composer.groupId} onChange={(event) => setComposer((current) => ({ ...current, groupId: event.target.value, groupIds: event.target.value ? [event.target.value] : [] }))}>
                <option value="">Select group</option>
                {activeGroups.map((group) => (
                  <option key={group.id} value={group.id}>{group.groupName}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Template</span>
              <select value={composer.templateId} onChange={(event) => applyTemplate(event.target.value)}>
                <option value="">No template</option>
                {activeTemplates.map((template) => (
                  <option key={template.id} value={template.id}>{template.title}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Category</span>
              <select value={composer.categoryId} onChange={(event) => setComposer((current) => ({ ...current, categoryId: event.target.value }))}>
                <option value="">Select category</option>
                {activeCategories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Message Title</span>
              <input value={composer.messageTitle} onChange={(event) => setComposer((current) => ({ ...current, messageTitle: event.target.value }))} />
            </label>
            <label className="whatsapp-admin-form-grid__wide">
              <span>Message</span>
              <MessageFormatToolbar onFormat={formatComposerMessage} />
              <textarea rows={6} value={composer.messageBody} onChange={(event) => setComposer((current) => ({ ...current, messageBody: event.target.value }))} />
            </label>
            <div className="whatsapp-admin-form-grid__wide whatsapp-admin-group-picker">
              <div className="whatsapp-admin-group-picker__header">
                <span className="whatsapp-admin-mini-title">Bulk send targets</span>
                <label className="whatsapp-admin-target-search">
                  <Search size={15} />
                  <input
                    aria-label="Search bulk send target groups"
                    placeholder="Search group names"
                    value={bulkTargetsSearch}
                    onChange={(event) => setBulkTargetsSearch(event.target.value)}
                  />
                </label>
              </div>
              {visibleBulkTargetGroups.length === 0 ? (
                <p className="whatsapp-admin-hint">No matching group names found.</p>
              ) : visibleBulkTargetGroups.map((group) => (
                  <label key={group.id} className="whatsapp-admin-checkbox-row">
                    <input checked={composer.groupIds.includes(group.id)} onChange={() => toggleComposerGroup(group.id)} type="checkbox" />
                    <span>{group.groupName}</span>
                    <small>{group.cohortName || group.programName || 'No cohort mapped'}</small>
                  </label>
                ))}
            </div>
            <label className="whatsapp-admin-form-grid__wide">
              <span>Remarks</span>
              <input value={composer.notes} onChange={(event) => setComposer((current) => ({ ...current, notes: event.target.value }))} />
            </label>
          </div>
          <div className="whatsapp-admin-actions">
            <button className="segmented-button" onClick={copyMessage} type="button">
              <Copy size={16} />
              Copy Message
            </button>
            <button className="segmented-button" onClick={() => openUrl(targetGroups[0]?.directChatLink || targetGroups[0]?.inviteLink || selectedGroup?.directChatLink || selectedGroup?.inviteLink || 'https://web.whatsapp.com/')} type="button">
              <ExternalLink size={16} />
              Open First Group
            </button>
            <button className="segmented-button segmented-button--active" disabled={createLog.isPending} onClick={markSent} type="button">
              Mark as Sent
            </button>
          </div>
          <p className="whatsapp-admin-hint">Open Group uses Direct Chat Link when available, otherwise Invite Link. WhatsApp may still ask you to open/select the group inside WhatsApp Web.</p>
          <p className="whatsapp-admin-hint">Template variables available: {'{{groupName}}'}, {'{{cohortName}}'}, {'{{programName}}'}, {'{{categoryName}}'}, {'{{today}}'}.</p>
          {targetGroups[0] && composer.messageBody ? (
            <div className="whatsapp-admin-preview">
              <span className="whatsapp-admin-mini-title">Preview for {targetGroups[0].groupName}</span>
              <p>{renderMessageForGroup(targetGroups[0])}</p>
            </div>
          ) : null}
          {selectedTemplate ? <p className="whatsapp-admin-hint">Template category: {categoryName(categories, selectedTemplate.categoryId)}</p> : null}
          {selectedCategory ? <p className="whatsapp-admin-hint">Selected category: {selectedCategory.name}</p> : null}
        </section>
      </section>

      <section className="data-panel">
        <div className="data-panel__header">
          <div>
            <span className="section-eyebrow">Cohort groups</span>
            <h2>WhatsApp Group Directory</h2>
          </div>
          <label className="whatsapp-admin-directory-search">
            <Search size={16} />
            <input
              aria-label="Search WhatsApp group directory"
              placeholder="Search group, cohort, program"
              value={directorySearch}
              onChange={(event) => setDirectorySearch(event.target.value)}
            />
          </label>
        </div>
        {groups.length === 0 ? (
          <EmptyState />
        ) : directoryGroups.length === 0 ? (
          <div className="whatsapp-admin-directory-empty">
            <span className="section-eyebrow">No matching groups</span>
            <h3>No WhatsApp groups found</h3>
            <p>Try a different group, cohort, or program search.</p>
          </div>
        ) : (
          <div className="data-table-wrap whatsapp-admin-directory-table">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Group</th>
                  <th>Cohort</th>
                  <th>Program</th>
                  <th>Status</th>
                  <th>Links</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {directoryGroups.map((group) => (
                  <tr key={group.id}>
                    <td>
                      <strong>{group.groupName}</strong>
                      {group.notes ? <span>{group.notes}</span> : null}
                      {!group.inviteLink ? <span className="whatsapp-admin-missing-link">Invite link missing</span> : null}
                    </td>
                    <td>{group.cohortName || '-'}</td>
                    <td>{group.programName || '-'}</td>
                    <td><StatusBadge tone={group.status === 'active' ? 'safe' : 'neutral'}>{group.status}</StatusBadge></td>
                    <td>
                      <div className="whatsapp-admin-row-actions">
                        <button className="segmented-button" disabled={!group.inviteLink} onClick={() => openUrl(group.inviteLink)} type="button">Invite</button>
                        <button className="segmented-button" disabled={!group.directChatLink} onClick={() => openUrl(group.directChatLink)} type="button">Direct</button>
                      </div>
                    </td>
                    <td>
                      <button className="segmented-button" onClick={() => { setSelectedGroupId(group.id); setGroupForm(groupToForm(group)); }} type="button">Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="whatsapp-admin-grid whatsapp-admin-grid--secondary">
        <form className="whatsapp-admin-panel" onSubmit={saveCategory}>
          <div className="whatsapp-admin-panel__header">
            <div>
              <span className="section-eyebrow">Authorable</span>
              <h2>Message Categories</h2>
            </div>
            <button className="segmented-button" type="button" onClick={() => { setSelectedCategoryId(null); setCategoryForm(emptyCategoryForm); }}>New</button>
          </div>
          <div className="whatsapp-admin-form-grid">
            <label>
              <span>Category Name</span>
              <input value={categoryForm.name} onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label>
              <span>Order</span>
              <input value={categoryForm.sortOrder} onChange={(event) => setCategoryForm((current) => ({ ...current, sortOrder: event.target.value }))} />
            </label>
            <label>
              <span>Status</span>
              <select value={categoryForm.status} onChange={(event) => setCategoryForm((current) => ({ ...current, status: event.target.value as WhatsAppStatus }))}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          </div>
          <button className="segmented-button segmented-button--active" type="submit">Save Category</button>
          <div className="whatsapp-admin-chip-list">
            {categories.map((category) => (
              <button key={category.id} className="whatsapp-admin-chip" onClick={() => { setSelectedCategoryId(category.id); setCategoryForm(categoryToForm(category)); }} type="button">
                {category.name}
              </button>
            ))}
          </div>
        </form>

        <form className="whatsapp-admin-panel" onSubmit={saveTemplate}>
          <div className="whatsapp-admin-panel__header">
            <div>
              <span className="section-eyebrow">Reusable messages</span>
              <h2>Message Templates</h2>
            </div>
            <button className="segmented-button" type="button" onClick={() => { setSelectedTemplateId(null); setTemplateForm(emptyTemplateForm); }}>New</button>
          </div>
          <div className="whatsapp-admin-form-grid">
            <label>
              <span>Template Title</span>
              <input value={templateForm.title} onChange={(event) => setTemplateForm((current) => ({ ...current, title: event.target.value }))} />
            </label>
            <label>
              <span>Category</span>
              <select value={templateForm.categoryId} onChange={(event) => setTemplateForm((current) => ({ ...current, categoryId: event.target.value }))}>
                <option value="">Uncategorized</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Status</span>
              <select value={templateForm.status} onChange={(event) => setTemplateForm((current) => ({ ...current, status: event.target.value as WhatsAppStatus }))}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <label className="whatsapp-admin-form-grid__wide">
              <span>Message</span>
              <MessageFormatToolbar onFormat={formatTemplateMessage} />
              <textarea rows={5} value={templateForm.messageBody} onChange={(event) => setTemplateForm((current) => ({ ...current, messageBody: event.target.value }))} />
            </label>
          </div>
          <button className="segmented-button segmented-button--active" type="submit">Save Template</button>
          <div className="whatsapp-admin-template-list">
            {templates.slice(0, 8).map((template) => (
              <button key={template.id} className="whatsapp-admin-template-item" onClick={() => { setSelectedTemplateId(template.id); setTemplateForm(templateToForm(template)); }} type="button">
                <strong>{template.title}</strong>
                <span>{categoryName(categories, template.categoryId)}</span>
              </button>
            ))}
          </div>
        </form>
      </section>

      <section className="data-panel">
        <div className="data-panel__header">
          <div>
            <span className="section-eyebrow">Audit history</span>
            <h2>WhatsApp Message History</h2>
          </div>
        </div>
        {logs.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Message</th>
                  <th>Group</th>
                  <th>Category</th>
                  <th>Sent By</th>
                  <th>Sent At</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td><strong>{log.messageTitle}</strong><span>{log.messageBody}</span></td>
                    <td>{log.groupName}<span>{log.cohortName || log.programName || ''}</span></td>
                    <td>{categoryName(categories, log.categoryId)}</td>
                    <td>{log.sentBy || '-'}</td>
                    <td>{formatDateTime(log.sentAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
