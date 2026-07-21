import { ArrowDown, ArrowUp, Bold, CheckCircle2, Copy, Edit3, Eye, Italic, Link2, List, ListOrdered, Plus, RefreshCw, RemoveFormatting, Search, Trash2, Underline } from 'lucide-react';
import type { FormEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { sanitizeProjectHtml } from '../components/ProjectRichText';
import { StateBlock } from '../components/StateBlock';
import { StatusBadge } from '../components/StatusBadge';
import {
  AdminProject,
  AdminProjectRole,
  AdminProjectRoleStatus,
  AdminProjectRoleWritePayload,
  AdminProjectStatus,
  AdminProjectWritePayload,
  useAdminProjectRoles,
  useAdminProjects,
  useCreateAdminProject,
  useCreateAdminProjectRole,
  useUpdateAdminProject,
  useUpdateAdminProjectRole,
  useUpdateAdminProjectRoleStatus,
  useUpdateAdminProjectStatus
} from '../features/admin/useAdminProjects';
import {
  AdminProjectToolkitItem,
  AdminProjectToolkitStatus,
  AdminProjectToolkitType,
  AdminProjectToolkitWritePayload,
  useAdminProjectToolkit,
  useCreateAdminProjectToolkitItem,
  useUpdateAdminProjectToolkitItem,
  useUpdateAdminProjectToolkitItemStatus
} from '../features/admin/useAdminProjectToolkit';
import { AdminProgram, useAdminPrograms } from '../features/admin/useAdminPrograms';

type RoleFormState = {
  category: string;
  name: string;
  programKey: string;
  roleId: string;
  status: AdminProjectRoleStatus;
};

type ProjectFormState = {
  brief: string;
  companyName: string;
  customSections: ProjectContentSection[];
  deadline: string;
  deliverables: string;
  importantLinks: ProjectImportantLink[];
  introduction: string;
  objectives: string;
  programKeys: string[];
  projectId: string;
  roleId: string;
  status: AdminProjectStatus;
  title: string;
};

type ProjectContentSection = {
  body: string;
  id: string;
  title: string;
};

type ProjectImportantLink = {
  id: string;
  label: string;
  url: string;
};

type ToolkitFormState = {
  content: string;
  cvFinanceContent: string;
  cvManagementContent: string;
  itemType: AdminProjectToolkitType;
  linkLabel: string;
  linkUrl: string;
  programKeys: string[];
  sortOrder: string;
  status: AdminProjectToolkitStatus;
  summary: string;
  title: string;
  toolkitId: string;
};

type ProjectFilters = {
  programKey: string;
  roleId: string;
  search: string;
  status: AdminProjectStatus | 'all';
};

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_').replace(/[^a-z0-9_]/g, '');
}

const CV_POINTS_TOOLKIT_ID = 'cv_points_approval';

type CvPointsContent = {
  finance: string;
  management: string;
};

function emptyCvPointsContent(): CvPointsContent {
  return { finance: '', management: '' };
}

function decodeJsonEntities(value: string) {
  return value
    .replace(/&amp;quot;/g, '"')
    .replace(/&amp;#34;/g, '"')
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"');
}

function readCvPointsPayload(value: string) {
  const candidates = [value, decodeJsonEntities(value)];

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Partial<CvPointsContent> | string;
      if (typeof parsed === 'string') {
        const nested = JSON.parse(parsed) as Partial<CvPointsContent>;
        if (nested && typeof nested === 'object') return nested;
      }
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      // Try the next representation before falling back to legacy plain content.
    }
  }

  return null;
}

function looksLikeCvPointsPayload(value: string | undefined) {
  const rawValue = String(value ?? '').trim();
  if (!rawValue.startsWith('{')) return false;
  return /"?finance"?\s*:|"?management"?\s*:|&quot;finance&quot;\s*:|&quot;management&quot;\s*:/.test(rawValue);
}

function isCvPointsToolkitId(value: string | undefined) {
  return normalizeKey(value ?? '') === CV_POINTS_TOOLKIT_ID;
}

function isCvPointsToolkitItem(item?: Pick<AdminProjectToolkitItem, 'content' | 'title' | 'toolkitId'>) {
  if (!item) return false;
  return isCvPointsToolkitId(item.toolkitId) || looksLikeCvPointsPayload(item.content) || item.title.trim().toLowerCase().includes('cv points');
}

function parseCvPointsContent(value: string | undefined): CvPointsContent {
  const rawValue = String(value ?? '').trim();
  if (!rawValue) return emptyCvPointsContent();

  const parsed = readCvPointsPayload(rawValue);
  if (parsed) {
    return {
      finance: sanitizeProjectHtml(typeof parsed.finance === 'string' ? parsed.finance : ''),
      management: sanitizeProjectHtml(typeof parsed.management === 'string' ? parsed.management : '')
    };
  }

  return {
    finance: '',
    management: looksLikeCvPointsPayload(rawValue) ? '' : sanitizeProjectHtml(rawValue)
  };
}

function serializeCvPointsContent(content: CvPointsContent) {
  return JSON.stringify({
    finance: sanitizeProjectHtml(content.finance),
    management: sanitizeProjectHtml(content.management)
  });
}

function roleKey(role: AdminProjectRole) {
  return role.roleId ?? role.id;
}

function roleFromProject(project: AdminProject, roles: AdminProjectRole[]) {
  return roles.find((role) => roleKey(role) === project.roleId);
}

function formFromRole(role?: AdminProjectRole): RoleFormState {
  return {
    category: role?.category ?? '',
    name: role?.name ?? '',
    programKey: role?.programKey ?? '',
    roleId: normalizeKey(role?.roleId ?? ''),
    status: role?.status ?? 'active'
  };
}

function formFromToolkitItem(item?: AdminProjectToolkitItem): ToolkitFormState {
  const cvContent = isCvPointsToolkitItem(item) ? parseCvPointsContent(item?.content) : emptyCvPointsContent();
  return {
    content: richTextFromValue(item?.content ?? ''),
    cvFinanceContent: cvContent.finance,
    cvManagementContent: cvContent.management,
    itemType: item?.itemType ?? 'custom',
    linkLabel: item?.linkLabel ?? '',
    linkUrl: item?.linkUrl ?? '',
    programKeys: item?.programKeys ?? [],
    sortOrder: String(item?.sortOrder ?? 100),
    status: item?.status ?? 'active',
    summary: item?.summary ?? '',
    title: item?.title ?? '',
    toolkitId: normalizeKey(item?.toolkitId ?? '')
  };
}

function newProjectId() {
  return `PRJ-${Date.now()}`;
}

function createDraftId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function richTextFromValue(value: string | undefined) {
  return sanitizeProjectHtml(value);
}

function richTextFromDeliverables(project?: AdminProject | null) {
  if (!project || project.deliverables.length === 0) return '';
  if (project.deliverables.length === 1) {
    const deliverable = project.deliverables[0];
    return richTextFromValue(deliverable.note ?? deliverable.description ?? deliverable.title);
  }

  const items = project.deliverables
    .map((deliverable) => {
      const meta = [deliverable.format, deliverable.note].filter(Boolean).join(' - ');
      return `<li><strong>${deliverable.title}</strong>${meta ? `: ${meta}` : ''}</li>`;
    })
    .join('');
  return sanitizeProjectHtml(`<ul>${items}</ul>`);
}

function contentSectionsFromProject(project?: AdminProject | null) {
  const sections = project?.tasks ?? [];
  const introduction = sections.find((section) => section.sectionType === 'introduction' || section.title.trim().toLowerCase() === 'introduction');
  const customSections = sections
    .filter((section) => section !== introduction)
    .map((section) => ({
      body: richTextFromValue(section.description ?? ''),
      id: createDraftId('section'),
      title: section.title
    }));

  return {
    customSections,
    introduction: richTextFromValue(introduction?.description ?? '')
  };
}

function importantLinksFromProject(project?: AdminProject | null) {
  return (project?.documents ?? [])
    .filter((document) => document.link || document.title)
    .map((document) => ({
      id: createDraftId('link'),
      label: document.label ?? document.title,
      url: document.link ?? ''
    }));
}

function serializeContentSections(introduction: string, customSections: ProjectContentSection[]) {
  const sections = [
    introduction.trim()
      ? {
        description: sanitizeProjectHtml(introduction),
        sectionType: 'introduction',
        title: 'Introduction'
      }
      : null,
    ...customSections
      .map((section) => ({
        description: sanitizeProjectHtml(section.body),
        sectionType: 'custom',
        title: section.title.trim()
      }))
      .filter((section) => section.title || section.description)
  ].filter(Boolean);

  return JSON.stringify(sections);
}

function serializeDeliverables(value: string) {
  const cleanValue = sanitizeProjectHtml(value);
  return cleanValue ? JSON.stringify([{ format: 'Rich text', note: cleanValue, title: 'Project Deliverables' }]) : '';
}

function serializeImportantLinks(links: ProjectImportantLink[]) {
  const cleanedLinks = links
    .map((link) => ({
      label: link.label.trim(),
      link: link.url.trim(),
      title: link.label.trim(),
      type: 'Link'
    }))
    .filter((link) => link.title || link.link);

  return cleanedLinks.length ? JSON.stringify(cleanedLinks) : '';
}

function formFromProject(project?: AdminProject | null): ProjectFormState {
  const programKeys = project ? (project.programKeys.length > 0 ? project.programKeys : [project.programKey].filter((value): value is string => Boolean(value))) : [];
  const sections = contentSectionsFromProject(project);

  return {
    brief: richTextFromValue(project?.brief ?? ''),
    companyName: project?.companyName ?? '',
    customSections: sections.customSections,
    deadline: project?.deadline?.slice(0, 10) ?? '',
    deliverables: richTextFromDeliverables(project),
    importantLinks: importantLinksFromProject(project),
    introduction: sections.introduction,
    objectives: richTextFromValue(project?.objectives ?? ''),
    programKeys,
    projectId: project?.projectId ?? newProjectId(),
    roleId: project?.roleId ?? '',
    status: project?.status ?? 'active',
    title: project?.title ?? ''
  };
}

function duplicateProjectDraft(project: AdminProject): AdminProject {
  return {
    ...project,
    id: '',
    projectId: newProjectId(),
    status: 'inactive',
    title: project.title ? `Copy of ${project.title}` : 'Copy of project',
    updatedAt: undefined
  };
}

function selectedPrograms(programs: AdminProgram[], keys: string[]) {
  const keySet = new Set(keys);
  return programs.filter((program) => keySet.has(program.programKey));
}

function readableError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function ProjectRichTextEditor({
  label,
  onChange,
  placeholder,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  function emitChange() {
    onChange(sanitizeProjectHtml(editorRef.current?.innerHTML ?? ''));
  }

  function runCommand(command: string, commandValue?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    emitChange();
  }

  function addLink() {
    const url = window.prompt('Paste link URL');
    if (!url) return;
    runCommand('createLink', url.trim());
  }

  return (
    <div className="admin-project-rte">
      <span>{label}</span>
      <div className="admin-project-rte__box">
        <div className="admin-project-rte__toolbar" aria-label={`${label} formatting tools`}>
          <button aria-label="Bold" onClick={() => runCommand('bold')} title="Bold" type="button"><Bold size={15} /></button>
          <button aria-label="Italic" onClick={() => runCommand('italic')} title="Italic" type="button"><Italic size={15} /></button>
          <button aria-label="Underline" onClick={() => runCommand('underline')} title="Underline" type="button"><Underline size={15} /></button>
          <button aria-label="Bullet list" onClick={() => runCommand('insertUnorderedList')} title="Bullet list" type="button"><List size={15} /></button>
          <button aria-label="Numbered list" onClick={() => runCommand('insertOrderedList')} title="Numbered list" type="button"><ListOrdered size={15} /></button>
          <button aria-label="Add link" onClick={addLink} title="Add link" type="button"><Link2 size={15} /></button>
          <button aria-label="Clear formatting" onClick={() => runCommand('removeFormat')} title="Clear formatting" type="button"><RemoveFormatting size={15} /></button>
        </div>
        <div
          className="admin-project-rte__editor"
          contentEditable
          data-placeholder={placeholder}
          onBlur={emitChange}
          onInput={emitChange}
          ref={editorRef}
          role="textbox"
          suppressContentEditableWarning
        />
      </div>
    </div>
  );
}

function RoleEditor({
  activePrograms,
  onSaved,
  role
}: {
  activePrograms: AdminProgram[];
  onSaved: (message: string) => void;
  role?: AdminProjectRole;
}) {
  const [form, setForm] = useState<RoleFormState>(() => formFromRole(role));
  const [error, setError] = useState('');
  const createRole = useCreateAdminProjectRole();
  const updateRole = useUpdateAdminProjectRole();
  const isSaving = createRole.isPending || updateRole.isPending;
  const isEditing = Boolean(role?.id);

  useEffect(() => {
    setForm(formFromRole(role));
    setError('');
  }, [role]);

  function updateField<KField extends keyof RoleFormState>(field: KField, value: RoleFormState[KField]) {
    setForm((current) => ({
      ...current,
      [field]: field === 'roleId' ? normalizeKey(String(value)) : value
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    const payload: AdminProjectRoleWritePayload = {
      category: form.category.trim(),
      name: form.name.trim(),
      programKey: form.programKey || undefined,
      roleId: form.roleId,
      status: form.status
    };

    if (!payload.name) {
      setError('Role name is required.');
      return;
    }
    if (!isEditing && !payload.roleId) {
      setError('Role ID is required.');
      return;
    }

    try {
      if (isEditing && role?.id) {
        const updatePayload: Partial<AdminProjectRoleWritePayload> = {
          category: payload.category,
          name: payload.name,
          programKey: payload.programKey,
          status: payload.status
        };
        await updateRole.mutateAsync({ body: updatePayload, roleUuid: role.id });
        onSaved('Project role updated successfully.');
      } else {
        await createRole.mutateAsync(payload);
        onSaved('Project role created successfully.');
        setForm(formFromRole());
      }
    } catch (submitError) {
      setError(readableError(submitError, 'Project role could not be saved.'));
    }
  }

  return (
    <form className="admin-project-form" onSubmit={handleSubmit}>
      <label>
        <span>Role ID *</span>
        <input readOnly={isEditing} value={form.roleId} onChange={(event) => updateField('roleId', event.target.value)} placeholder="growth_strategy_consultant" />
      </label>
      <label>
        <span>Status</span>
        <select value={form.status} onChange={(event) => updateField('status', event.target.value as AdminProjectRoleStatus)}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </label>
      <label>
        <span>Role name *</span>
        <input value={form.name} onChange={(event) => updateField('name', event.target.value)} placeholder="Growth & Strategy Consultant" />
      </label>
      <label>
        <span>Role category</span>
        <input value={form.category} onChange={(event) => updateField('category', event.target.value)} placeholder="Management" />
      </label>
      <label className="admin-project-form__wide">
        <span>Program entitlement</span>
        <select value={form.programKey} onChange={(event) => updateField('programKey', event.target.value)}>
          <option value="">No fixed program mapping</option>
          {activePrograms.map((program) => (
            <option key={program.id} value={program.programKey}>
              {program.name}
            </option>
          ))}
        </select>
      </label>
      {error ? <p className="admin-project-form-note admin-project-form-note--error">{error}</p> : null}
      <div className="admin-project-form__actions">
        <button className="segmented-button" disabled={isSaving} onClick={() => setForm(formFromRole(role))} type="button">
          Reset
        </button>
        <button className="segmented-button segmented-button--gold" disabled={isSaving} type="submit">
          {isSaving ? 'Saving...' : isEditing ? 'Update Role' : 'Save Role'}
        </button>
      </div>
    </form>
  );
}

function ProjectEditor({
  activePrograms,
  onSaved,
  project,
  roles
}: {
  activePrograms: AdminProgram[];
  onSaved: (message: string) => void;
  project?: AdminProject | null;
  roles: AdminProjectRole[];
}) {
  const [form, setForm] = useState<ProjectFormState>(() => formFromProject(project));
  const [error, setError] = useState('');
  const createProject = useCreateAdminProject();
  const updateProject = useUpdateAdminProject();
  const isSaving = createProject.isPending || updateProject.isPending;
  const isEditing = Boolean(project?.id);
  const activeRoles = roles.filter((role) => role.status === 'active' || roleKey(role) === form.roleId);
  const mappedPrograms = selectedPrograms(activePrograms, form.programKeys);
  const selectedRole = roles.find((role) => roleKey(role) === form.roleId);

  useEffect(() => {
    setForm(formFromProject(project));
    setError('');
  }, [project]);

  function updateField<KField extends keyof ProjectFormState>(field: KField, value: ProjectFormState[KField]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function toggleProgram(programKey: string) {
    setForm((current) => {
      const currentSet = new Set(current.programKeys);
      currentSet.has(programKey) ? currentSet.delete(programKey) : currentSet.add(programKey);
      return { ...current, programKeys: Array.from(currentSet) };
    });
  }

  function addCustomSection() {
    setForm((current) => ({
      ...current,
      customSections: [...current.customSections, { body: '', id: createDraftId('section'), title: '' }]
    }));
  }

  function updateCustomSection(sectionId: string, patch: Partial<ProjectContentSection>) {
    setForm((current) => ({
      ...current,
      customSections: current.customSections.map((section) => (section.id === sectionId ? { ...section, ...patch } : section))
    }));
  }

  function removeCustomSection(sectionId: string) {
    setForm((current) => ({
      ...current,
      customSections: current.customSections.filter((section) => section.id !== sectionId)
    }));
  }

  function moveCustomSection(sectionId: string, direction: -1 | 1) {
    setForm((current) => {
      const index = current.customSections.findIndex((section) => section.id === sectionId);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= current.customSections.length) return current;
      const nextSections = [...current.customSections];
      const [section] = nextSections.splice(index, 1);
      nextSections.splice(targetIndex, 0, section);
      return { ...current, customSections: nextSections };
    });
  }

  function addImportantLink() {
    setForm((current) => ({
      ...current,
      importantLinks: [...current.importantLinks, { id: createDraftId('link'), label: '', url: '' }]
    }));
  }

  function updateImportantLink(linkId: string, patch: Partial<ProjectImportantLink>) {
    setForm((current) => ({
      ...current,
      importantLinks: current.importantLinks.map((link) => (link.id === linkId ? { ...link, ...patch } : link))
    }));
  }

  function removeImportantLink(linkId: string) {
    setForm((current) => ({
      ...current,
      importantLinks: current.importantLinks.filter((link) => link.id !== linkId)
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    const payload: AdminProjectWritePayload = {
      actionItems: serializeContentSections(form.introduction, form.customSections),
      brief: sanitizeProjectHtml(form.brief),
      companyName: form.companyName,
      deadline: form.deadline || null,
      deliverables: serializeDeliverables(form.deliverables),
      objectives: sanitizeProjectHtml(form.objectives),
      programKey: form.programKeys[0],
      programKeys: form.programKeys,
      programName: mappedPrograms.map((program) => program.name).join(', '),
      projectId: form.projectId.trim(),
      projectRole: selectedRole?.name ?? '',
      resources: serializeImportantLinks(form.importantLinks),
      roleId: form.roleId || undefined,
      status: form.status,
      title: form.title.trim()
    };

    if (!payload.title) {
      setError('Project title is required.');
      return;
    }
    if (!isEditing && !payload.projectId) {
      setError('Project ID is required.');
      return;
    }
    if (payload.programKeys.length === 0) {
      setError('Select at least one active program.');
      return;
    }
    const incompleteLink = form.importantLinks.find((link) => (link.label.trim() && !link.url.trim()) || (!link.label.trim() && link.url.trim()));
    if (incompleteLink) {
      setError('Each important link needs both a label and a URL.');
      return;
    }
    const invalidLink = form.importantLinks.find((link) => link.url.trim() && !/^https?:\/\//i.test(link.url.trim()));
    if (invalidLink) {
      setError('Important links must start with http:// or https://.');
      return;
    }

    try {
      if (isEditing && project?.id) {
        const updatePayload: Partial<AdminProjectWritePayload> = {
          actionItems: payload.actionItems,
          brief: payload.brief,
          companyName: payload.companyName,
          deadline: payload.deadline,
          deliverables: payload.deliverables,
          objectives: payload.objectives,
          programKey: payload.programKey,
          programKeys: payload.programKeys,
          programName: payload.programName,
          projectRole: payload.projectRole,
          resources: payload.resources,
          roleId: payload.roleId,
          status: payload.status,
          title: payload.title
        };
        await updateProject.mutateAsync({ body: updatePayload, projectId: project.id });
        onSaved('Project updated successfully.');
      } else {
        await createProject.mutateAsync(payload);
        onSaved('Project created successfully.');
        setForm(formFromProject(null));
      }
    } catch (submitError) {
      setError(readableError(submitError, 'Project could not be saved.'));
    }
  }

  return (
    <form className={isSaving ? 'admin-project-form admin-project-form--editor admin-project-form--saving' : 'admin-project-form admin-project-form--editor'} onSubmit={handleSubmit} aria-busy={isSaving}>
      <label>
        <span>Project ID *</span>
        <input readOnly={isEditing} value={form.projectId} onChange={(event) => updateField('projectId', event.target.value)} placeholder="PRJ-178..." />
      </label>
      <label>
        <span>Status</span>
        <select value={form.status} onChange={(event) => updateField('status', event.target.value as AdminProjectStatus)}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </label>
      <label className="admin-project-form__wide">
        <span>Project title *</span>
        <input value={form.title} onChange={(event) => updateField('title', event.target.value)} placeholder="Project title" />
      </label>
      <label>
        <span>Live company name</span>
        <input value={form.companyName} onChange={(event) => updateField('companyName', event.target.value)} placeholder="e.g. Samann.com" />
      </label>
      <label>
        <span>Project role</span>
        <select value={form.roleId} onChange={(event) => updateField('roleId', event.target.value)}>
          <option value="">Select project role</option>
          {activeRoles.map((role) => (
            <option key={role.id} value={roleKey(role)}>
              {role.name}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="admin-project-program-picker">
        <legend>Programs *</legend>
        <div className="admin-project-program-picker__actions">
          <button className="segmented-button" onClick={() => updateField('programKeys', activePrograms.map((program) => program.programKey))} type="button">
            Select All Programs
          </button>
          <button className="segmented-button" onClick={() => updateField('programKeys', [])} type="button">
            Clear Programs
          </button>
        </div>
        <div className="admin-project-program-list">
          {activePrograms.map((program) => (
            <label key={program.id}>
              <input checked={form.programKeys.includes(program.programKey)} onChange={() => toggleProgram(program.programKey)} type="checkbox" />
              <span>{program.name}</span>
              <strong>{program.shortName ?? program.programKey}</strong>
            </label>
          ))}
        </div>
      </fieldset>
      <section className="admin-project-reading-editor admin-project-form__wide" aria-label="Reading page content">
        <div className="admin-project-reading-editor__header">
          <div>
            <span>Reading Page Content</span>
            <h3>Project Detail Page</h3>
          </div>
          <p>These sections appear as a vertical reading page for eligible students.</p>
        </div>
        <ProjectRichTextEditor
          label="Introduction"
          onChange={(value) => updateField('introduction', value)}
          placeholder="Set context for the project in a short introductory note."
          value={form.introduction}
        />
        <ProjectRichTextEditor
          label="Project Objective"
          onChange={(value) => updateField('objectives', value)}
          placeholder="Describe the project objective, learning goal, and outcome."
          value={form.objectives}
        />
        <ProjectRichTextEditor
          label="Project Deliverables"
          onChange={(value) => updateField('deliverables', value)}
          placeholder="Describe what students need to submit. Use bullets or numbered lists if helpful."
          value={form.deliverables}
        />
        <ProjectRichTextEditor
          label="Project Brief"
          onChange={(value) => updateField('brief', value)}
          placeholder="Write the detailed project brief, background, instructions, and expectations."
          value={form.brief}
        />
      </section>

      <section className="admin-project-custom-sections admin-project-form__wide" aria-label="Custom project sections">
        <div className="admin-project-reading-editor__header">
          <div>
            <span>Custom Sections</span>
            <h3>Additional Reading Blocks</h3>
          </div>
          <button className="segmented-button" onClick={addCustomSection} type="button">
            <Plus size={15} />
            Add Section
          </button>
        </div>
        {form.customSections.length > 0 ? (
          form.customSections.map((section, index) => (
            <article className="admin-project-custom-section" key={section.id}>
              <div className="admin-project-custom-section__head">
                <label>
                  <span>Section title</span>
                  <input value={section.title} onChange={(event) => updateCustomSection(section.id, { title: event.target.value })} placeholder="e.g. Evaluation Criteria" />
                </label>
                <div className="admin-project-custom-section__actions">
                  <button aria-label="Move section up" className="icon-button" disabled={index === 0} onClick={() => moveCustomSection(section.id, -1)} type="button">
                    <ArrowUp size={16} />
                  </button>
                  <button aria-label="Move section down" className="icon-button" disabled={index === form.customSections.length - 1} onClick={() => moveCustomSection(section.id, 1)} type="button">
                    <ArrowDown size={16} />
                  </button>
                  <button aria-label="Delete section" className="icon-button icon-button--danger" onClick={() => removeCustomSection(section.id)} type="button">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <ProjectRichTextEditor
                label="Section body"
                onChange={(value) => updateCustomSection(section.id, { body: value })}
                placeholder="Write this custom section in descriptive text."
                value={section.body}
              />
            </article>
          ))
        ) : (
          <p className="admin-project-empty-note">No custom sections added.</p>
        )}
      </section>

      <section className="admin-project-link-editor admin-project-form__wide" aria-label="Important project links">
        <div className="admin-project-reading-editor__header">
          <div>
            <span>Important Links</span>
            <h3>Compact Link List</h3>
          </div>
          <button className="segmented-button" onClick={addImportantLink} type="button">
            <Plus size={15} />
            Add Link
          </button>
        </div>
        {form.importantLinks.length > 0 ? (
          <div className="admin-project-link-list">
            {form.importantLinks.map((link) => (
              <div className="admin-project-link-row" key={link.id}>
                <label>
                  <span>Label</span>
                  <input value={link.label} onChange={(event) => updateImportantLink(link.id, { label: event.target.value })} placeholder="SOW document" />
                </label>
                <label>
                  <span>URL</span>
                  <input value={link.url} onChange={(event) => updateImportantLink(link.id, { url: event.target.value })} placeholder="https://..." />
                </label>
                <button aria-label="Delete important link" className="icon-button icon-button--danger" onClick={() => removeImportantLink(link.id)} type="button">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="admin-project-empty-note">No important links added.</p>
        )}
      </section>
      <label>
        <span>Deadline</span>
        <input value={form.deadline} onChange={(event) => updateField('deadline', event.target.value)} type="date" />
      </label>
      <div className={form.status === 'active' && form.programKeys.length > 0 ? 'admin-project-visibility admin-project-visibility--visible' : 'admin-project-visibility'}>
        <Eye size={16} />
        <span>{form.status === 'active' && form.programKeys.length > 0 ? 'Visible to eligible students' : 'Hidden until active and mapped to a program'}</span>
      </div>
      {error ? <p className="admin-project-form-note admin-project-form-note--error">{error}</p> : null}
      <div className="admin-project-form__actions">
        <button className="segmented-button" disabled={isSaving} onClick={() => setForm(formFromProject(project))} type="button">
          Reset
        </button>
        <button className="segmented-button segmented-button--gold" disabled={isSaving} type="submit">
          {isSaving ? 'Saving...' : isEditing ? 'Update Project' : 'Save Project'}
        </button>
      </div>
    </form>
  );
}

function ToolkitEditor({
  activePrograms,
  item,
  onSaved
}: {
  activePrograms: AdminProgram[];
  item?: AdminProjectToolkitItem;
  onSaved: (message: string) => void;
}) {
  const [form, setForm] = useState<ToolkitFormState>(() => formFromToolkitItem(item));
  const [error, setError] = useState('');
  const createItem = useCreateAdminProjectToolkitItem();
  const updateItem = useUpdateAdminProjectToolkitItem();
  const isSaving = createItem.isPending || updateItem.isPending;
  const isEditing = Boolean(item?.id);

  useEffect(() => {
    setForm(formFromToolkitItem(item));
    setError('');
  }, [item]);

  function updateField<KField extends keyof ToolkitFormState>(field: KField, value: ToolkitFormState[KField]) {
    setForm((current) => ({
      ...current,
      [field]: field === 'toolkitId' ? normalizeKey(String(value)) : value
    }));
  }

  function toggleProgram(programKey: string) {
    setForm((current) => {
      const next = new Set(current.programKeys);
      next.has(programKey) ? next.delete(programKey) : next.add(programKey);
      return { ...current, programKeys: Array.from(next) };
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const isCvPointsItem = isCvPointsToolkitId(form.toolkitId);

    const payload: AdminProjectToolkitWritePayload = {
      content: isCvPointsItem
        ? serializeCvPointsContent({
            finance: form.cvFinanceContent,
            management: form.cvManagementContent
          })
        : sanitizeProjectHtml(form.content),
      itemType: form.itemType,
      linkLabel: form.linkLabel.trim() || null,
      linkUrl: form.linkUrl.trim() || null,
      programKeys: form.programKeys,
      sortOrder: Number(form.sortOrder || 100),
      status: form.status,
      summary: form.summary.trim(),
      title: form.title.trim(),
      toolkitId: form.toolkitId
    };

    if (!payload.title) {
      setError('Toolkit title is required.');
      return;
    }
    if (!isEditing && !payload.toolkitId) {
      setError('Toolkit ID is required.');
      return;
    }
    if (payload.linkUrl && !/^https?:\/\//i.test(payload.linkUrl)) {
      setError('Toolkit links must start with http:// or https://.');
      return;
    }

    try {
      if (isEditing && item?.id) {
        const updatePayload: Partial<AdminProjectToolkitWritePayload> = {
          content: payload.content,
          itemType: payload.itemType,
          linkLabel: payload.linkLabel,
          linkUrl: payload.linkUrl,
          programKeys: payload.programKeys,
          sortOrder: payload.sortOrder,
          status: payload.status,
          summary: payload.summary,
          title: payload.title
        };
        await updateItem.mutateAsync({ body: updatePayload, itemId: item.id });
        onSaved('Project toolkit item updated successfully.');
      } else {
        await createItem.mutateAsync(payload);
        onSaved('Project toolkit item created successfully.');
        setForm(formFromToolkitItem());
      }
    } catch (submitError) {
      setError(readableError(submitError, 'Project toolkit item could not be saved.'));
    }
  }

  return (
    <form className={isSaving ? 'admin-project-form admin-project-form--saving admin-project-toolkit-form' : 'admin-project-form admin-project-toolkit-form'} onSubmit={handleSubmit} aria-busy={isSaving}>
      <label>
        <span>Toolkit ID *</span>
        <input readOnly={isEditing} value={form.toolkitId} onChange={(event) => updateField('toolkitId', event.target.value)} placeholder="live_project_guidelines" />
      </label>
      <label>
        <span>Type</span>
        <select value={form.itemType} onChange={(event) => updateField('itemType', event.target.value as AdminProjectToolkitType)}>
          <option value="guidelines">Guidelines</option>
          <option value="sow_link">SOW Link</option>
          <option value="framework">Framework</option>
          <option value="custom">Custom</option>
        </select>
      </label>
      <label>
        <span>Status</span>
        <select value={form.status} onChange={(event) => updateField('status', event.target.value as AdminProjectToolkitStatus)}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </label>
      <label>
        <span>Sort order</span>
        <input min="1" value={form.sortOrder} onChange={(event) => updateField('sortOrder', event.target.value)} type="number" />
      </label>
      <label className="admin-project-form__wide">
        <span>Title *</span>
        <input value={form.title} onChange={(event) => updateField('title', event.target.value)} placeholder="Live Project Guidelines" />
      </label>
      <label className="admin-project-form__wide">
        <span>Short summary</span>
        <textarea value={form.summary} onChange={(event) => updateField('summary', event.target.value)} placeholder="One short line shown below the title." rows={2} />
      </label>
      <fieldset className="admin-project-program-picker admin-project-form__wide">
        <legend>Program mapping</legend>
        <div className="admin-project-program-picker__actions">
          <button className="segmented-button" onClick={() => updateField('programKeys', activePrograms.map((program) => program.programKey))} type="button">
            Select All Programs
          </button>
          <button className="segmented-button" onClick={() => updateField('programKeys', [])} type="button">
            Make Global
          </button>
        </div>
        <div className="admin-project-program-list admin-project-program-list--compact">
          {activePrograms.map((program) => (
            <label key={program.id}>
              <input checked={form.programKeys.includes(program.programKey)} onChange={() => toggleProgram(program.programKey)} type="checkbox" />
              <span>{program.name}</span>
              <strong>{program.shortName ?? program.programKey}</strong>
            </label>
          ))}
        </div>
        <p className="admin-project-empty-note">No selected program means visible to all eligible students.</p>
      </fieldset>
      {isCvPointsToolkitId(form.toolkitId) ? (
        <div className="admin-project-cv-editor admin-project-form__wide">
          <div className="admin-project-cv-editor__intro">
            <span className="section-eyebrow">CV points approval</span>
            <p>Students will see these as two accordions in the full-screen reader. Blank accordions stay hidden.</p>
          </div>
          <ProjectRichTextEditor
            label="Management Tracks"
            onChange={(value) => updateField('cvManagementContent', value)}
            placeholder="Add approval guidance for Management Consulting, Sales & Marketing, Product, HR, or related management tracks."
            value={form.cvManagementContent}
          />
          <ProjectRichTextEditor
            label="Finance Tracks"
            onChange={(value) => updateField('cvFinanceContent', value)}
            placeholder="Add approval guidance for Equity Research, Quant Finance, PEVC, and other finance tracks."
            value={form.cvFinanceContent}
          />
        </div>
      ) : (
        <ProjectRichTextEditor
          label="Toolkit content"
          onChange={(value) => updateField('content', value)}
          placeholder="Add formatted guidance, bullets, links, or framework details."
          value={form.content}
        />
      )}
      <div className="admin-project-link-row admin-project-form__wide">
        <label>
          <span>Link label</span>
          <input value={form.linkLabel} onChange={(event) => updateField('linkLabel', event.target.value)} placeholder="Open SOW document" />
        </label>
        <label>
          <span>Link URL</span>
          <input value={form.linkUrl} onChange={(event) => updateField('linkUrl', event.target.value)} placeholder="https://..." />
        </label>
      </div>
      {error ? <p className="admin-project-form-note admin-project-form-note--error">{error}</p> : null}
      <div className="admin-project-form__actions">
        <button className="segmented-button" disabled={isSaving} onClick={() => setForm(formFromToolkitItem(item))} type="button">
          Reset
        </button>
        <button className="segmented-button segmented-button--gold" disabled={isSaving} type="submit">
          {isSaving ? 'Saving...' : isEditing ? 'Update Toolkit' : 'Save Toolkit'}
        </button>
      </div>
    </form>
  );
}

function ToolkitCard({
  isSelected,
  item,
  onEdit,
  onStatusChange,
  programs,
  statusDisabled
}: {
  isSelected: boolean;
  item: AdminProjectToolkitItem;
  onEdit: (item: AdminProjectToolkitItem) => void;
  onStatusChange: (item: AdminProjectToolkitItem) => void;
  programs: AdminProgram[];
  statusDisabled: boolean;
}) {
  const mappedPrograms = selectedPrograms(programs, item.programKeys);
  const statusAction = item.status === 'active' ? 'Deactivate' : 'Reactivate';
  const itemClass = ['admin-project-list-card', 'admin-project-list-card--toolkit', isSelected ? 'admin-project-list-card--selected' : ''].filter(Boolean).join(' ');

  return (
    <article className={itemClass}>
      <div className="admin-project-list-card__content">
        <h3>{item.title}</h3>
        <p>{[item.toolkitId, item.itemType.replace(/_/g, ' '), item.summary].filter(Boolean).join(' · ')}</p>
        <div className="chip-row">
          {(mappedPrograms.length > 0 ? mappedPrograms.map((program) => program.shortName ?? program.name) : ['Global']).slice(0, 5).map((program) => (
            <StatusBadge key={program}>{program}</StatusBadge>
          ))}
          {mappedPrograms.length > 5 ? <StatusBadge>{`+${mappedPrograms.length - 5} more`}</StatusBadge> : null}
          <StatusBadge tone={item.status === 'active' ? 'safe' : 'warning'}>{item.status}</StatusBadge>
        </div>
      </div>
      <div className="admin-project-list-card__actions">
        <button className="segmented-button" onClick={() => onEdit(item)} type="button">
          Edit
        </button>
        <button className={item.status === 'active' ? 'segmented-button segmented-button--danger' : 'segmented-button'} disabled={statusDisabled} onClick={() => onStatusChange(item)} type="button">
          {statusDisabled ? 'Updating...' : statusAction}
        </button>
      </div>
    </article>
  );
}

function ProjectToolkitManager({ activePrograms, onNotice, programs }: { activePrograms: AdminProgram[]; onNotice: (message: string) => void; programs: AdminProgram[] }) {
  const [selectedItem, setSelectedItem] = useState<AdminProjectToolkitItem | undefined>();
  const toolkitQuery = useAdminProjectToolkit({ limit: 100, status: 'all' });
  const updateStatus = useUpdateAdminProjectToolkitItemStatus();
  const items = toolkitQuery.data?.items ?? [];

  async function changeStatus(item: AdminProjectToolkitItem) {
    const nextStatus: AdminProjectToolkitStatus = item.status === 'active' ? 'inactive' : 'active';
    if (!window.confirm(`${nextStatus === 'inactive' ? 'Deactivate' : 'Reactivate'} this toolkit item?`)) return;
    try {
      await updateStatus.mutateAsync({ itemId: item.id, status: nextStatus });
      onNotice(`Project toolkit item ${nextStatus === 'active' ? 'reactivated' : 'deactivated'} successfully.`);
    } catch (error) {
      onNotice(readableError(error, 'Project toolkit status could not be updated.'));
    }
  }

  return (
    <section className="admin-project-section admin-project-toolkit-section">
      <header className="admin-project-section__header">
        <div>
          <span>Student Toolkit</span>
          <h2>Project Hub Global Sections</h2>
        </div>
        <button className="segmented-button segmented-button--gold" onClick={() => setSelectedItem(undefined)} type="button">
          <Plus size={15} />
          New Toolkit Item
        </button>
      </header>
      <div className="admin-project-two-column admin-project-toolkit-grid">
        <div className="admin-project-scroll-list" aria-label="Project toolkit list">
          {toolkitQuery.isLoading ? (
            <LoadingState />
          ) : toolkitQuery.isError ? (
            <StateBlock title="Toolkit unavailable">Project toolkit settings could not be loaded. Existing Projects functionality is unaffected.</StateBlock>
          ) : items.length > 0 ? (
            items.map((item) => (
              <ToolkitCard
                isSelected={selectedItem?.id === item.id}
                item={item}
                key={item.id}
                onEdit={setSelectedItem}
                onStatusChange={changeStatus}
                programs={programs}
                statusDisabled={updateStatus.isPending}
              />
            ))
          ) : (
            <EmptyState />
          )}
        </div>
        <div className="admin-project-editor-panel">
          <h3>{selectedItem ? 'Edit Toolkit Item' : 'Add Toolkit Item'}</h3>
          <ToolkitEditor activePrograms={activePrograms} item={selectedItem} onSaved={onNotice} />
        </div>
      </div>
    </section>
  );
}

function RoleCard({
  disabled,
  onEdit,
  onStatusChange,
  role
}: {
  disabled: boolean;
  onEdit: (role: AdminProjectRole) => void;
  onStatusChange: (role: AdminProjectRole) => void;
  role: AdminProjectRole;
}) {
  return (
    <article className="admin-project-list-card">
      <div>
        <h3>{role.name}</h3>
        <p>
          {[role.category, roleKey(role), role.programKey ?? 'No program mapping'].filter(Boolean).join(' · ')}
        </p>
        <div className="chip-row">
          <StatusBadge tone={role.status === 'active' ? 'safe' : 'warning'}>{role.status}</StatusBadge>
        </div>
      </div>
      <div className="admin-project-list-card__actions">
        <button className="segmented-button" onClick={() => onEdit(role)} type="button">
          Edit
        </button>
        <button className={role.status === 'active' ? 'segmented-button segmented-button--danger' : 'segmented-button'} disabled={disabled} onClick={() => onStatusChange(role)} type="button">
          {role.status === 'active' ? 'Deactivate' : 'Reactivate'}
        </button>
      </div>
    </article>
  );
}

function ProjectCard({
  isSelected,
  onDuplicate,
  onEdit,
  onStatusChange,
  project,
  programs,
  role,
  statusDisabled
}: {
  isSelected: boolean;
  onDuplicate: (project: AdminProject) => void;
  onEdit: (project: AdminProject) => void;
  onStatusChange: (project: AdminProject) => void;
  project: AdminProject;
  programs: AdminProgram[];
  role?: AdminProjectRole;
  statusDisabled: boolean;
}) {
  const projectProgramKeys = project.programKeys.length > 0 ? project.programKeys : [project.programKey].filter((value): value is string => Boolean(value));
  const programNames = selectedPrograms(programs, projectProgramKeys).map((program) => program.shortName ?? program.name);
  const statusAction = project.status === 'active' ? 'Deactivate' : 'Reactivate';
  const cardClassName = [
    'admin-project-list-card',
    'admin-project-list-card--project',
    isSelected ? 'admin-project-list-card--selected' : ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <article className={cardClassName}>
      <div className="admin-project-list-card__content">
        <h3>{project.title || project.projectId || project.id}</h3>
        <p>
          {[project.projectId ?? project.id, role?.name ?? project.projectRole, project.companyName ?? 'Company not set'].filter(Boolean).join(' · ')}
        </p>
        <div className="chip-row">
          {programNames.slice(0, 6).map((program) => (
            <StatusBadge key={program}>{program}</StatusBadge>
          ))}
          {programNames.length > 6 ? <StatusBadge>{`+${programNames.length - 6} more`}</StatusBadge> : null}
          <StatusBadge tone={project.status === 'active' ? 'safe' : 'warning'}>{project.status}</StatusBadge>
        </div>
      </div>
      <div className="admin-project-list-card__actions">
        <button className="segmented-button" aria-label={`Edit project ${project.title || project.projectId || project.id}`} onClick={() => onEdit(project)} type="button">
          Edit
        </button>
        <button className="segmented-button" aria-label={`Duplicate project ${project.title || project.projectId || project.id}`} onClick={() => onDuplicate(project)} type="button">
          <Copy size={14} />
          Duplicate
        </button>
        <button
          aria-label={`${statusAction} project ${project.title || project.projectId || project.id}`}
          className={project.status === 'active' ? 'segmented-button segmented-button--danger' : 'segmented-button'}
          disabled={statusDisabled}
          onClick={() => onStatusChange(project)}
          type="button"
        >
          {statusDisabled ? 'Updating...' : statusAction}
        </button>
      </div>
    </article>
  );
}

export function AdminProjectsPage() {
  const [filters, setFilters] = useState<ProjectFilters>({ programKey: '', roleId: '', search: '', status: 'all' });
  const [searchDraft, setSearchDraft] = useState('');
  const [selectedProject, setSelectedProject] = useState<AdminProject | null>(null);
  const [selectedRole, setSelectedRole] = useState<AdminProjectRole | undefined>();
  const [notice, setNotice] = useState('');
  const projectsQuery = useAdminProjects({ limit: 100, programKey: filters.programKey, roleId: filters.roleId, search: filters.search, status: filters.status });
  const rolesQuery = useAdminProjectRoles({ limit: 200, status: 'all' });
  const programsQuery = useAdminPrograms({ limit: 500, status: 'all' });
  const updateProjectStatus = useUpdateAdminProjectStatus();
  const updateRoleStatus = useUpdateAdminProjectRoleStatus();
  const projects = projectsQuery.data?.items ?? [];
  const roles = rolesQuery.data?.items ?? [];
  const programs = programsQuery.data?.items ?? [];
  const activePrograms = programs.filter((program) => program.status === 'active');
  const hasError = projectsQuery.isError || rolesQuery.isError || programsQuery.isError;
  const isLoading = projectsQuery.isLoading || rolesQuery.isLoading || programsQuery.isLoading;
  const activeProjects = useMemo(() => projects.filter((project) => project.status === 'active').length, [projects]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((current) => ({ ...current, search: searchDraft.trim() }));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchDraft]);

  function startNewProject() {
    setSelectedProject(null);
    setNotice('');
  }

  function duplicateProject(project: AdminProject) {
    setSelectedProject(duplicateProjectDraft(project));
    setNotice('Duplicated as a new inactive draft. Review the role, title, and content before saving.');
  }

  async function changeProjectStatus(project: AdminProject) {
    const nextStatus: AdminProjectStatus = project.status === 'active' ? 'inactive' : 'active';
    if (!window.confirm(`${nextStatus === 'inactive' ? 'Deactivate' : 'Reactivate'} this project?`)) return;
    try {
      await updateProjectStatus.mutateAsync({ projectId: project.id, status: nextStatus });
      setNotice(`Project ${nextStatus === 'active' ? 'reactivated' : 'deactivated'} successfully.`);
    } catch (error) {
      setNotice(readableError(error, 'Project status could not be updated.'));
    }
  }

  async function changeRoleStatus(role: AdminProjectRole) {
    const nextStatus: AdminProjectRoleStatus = role.status === 'active' ? 'inactive' : 'active';
    if (!window.confirm(`${nextStatus === 'inactive' ? 'Deactivate' : 'Reactivate'} this project role?`)) return;
    try {
      await updateRoleStatus.mutateAsync({ roleUuid: role.id, status: nextStatus });
      setNotice(`Project role ${nextStatus === 'active' ? 'reactivated' : 'deactivated'} successfully.`);
    } catch (error) {
      setNotice(readableError(error, 'Project role status could not be updated.'));
    }
  }

  if (isLoading) {
    return (
      <div className="page-stack">
        <PageHeader description="Loading project workspace." eyebrow="Module refresh" title="Projects" />
        <LoadingState />
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="page-stack">
        <PageHeader description="Project data could not be loaded." eyebrow="Module refresh" title="Projects unavailable" />
        <ErrorState />
      </div>
    );
  }

  return (
    <div className="page-stack admin-projects-page">
      <PageHeader description="Manage live project roles, project briefs, student visibility, resources, and deadlines." eyebrow="Module refresh" title="Projects" />
      {notice ? <div className={/could not|failed|error/i.test(notice) ? 'auth-alert auth-alert--error' : 'auth-alert auth-alert--success'}>{notice}</div> : null}

      <div className="admin-projects-page__top-actions">
        <span>
          {projectsQuery.data?.total ?? projects.length} projects · {activeProjects} active on this view · {roles.length} roles
        </span>
        <button
          className="segmented-button"
          disabled={projectsQuery.isFetching || rolesQuery.isFetching || programsQuery.isFetching}
          onClick={() => {
            void projectsQuery.refetch();
            void rolesQuery.refetch();
            void programsQuery.refetch();
          }}
          type="button"
        >
          <RefreshCw size={16} />
          {projectsQuery.isFetching || rolesQuery.isFetching || programsQuery.isFetching ? 'Refreshing...' : 'Refresh Projects'}
        </button>
      </div>

      <section className="admin-project-section">
        <header className="admin-project-section__header">
          <div>
            <span>Master Data</span>
            <h2>Project Roles</h2>
          </div>
          <button className="segmented-button segmented-button--gold" onClick={() => setSelectedRole(undefined)} type="button">
            <Plus size={15} />
            New Role
          </button>
        </header>
        <div className="admin-project-two-column">
          <div className="admin-project-scroll-list" aria-label="Project role list">
            {roles.length > 0 ? (
              roles.map((role) => <RoleCard disabled={updateRoleStatus.isPending} key={role.id} onEdit={setSelectedRole} onStatusChange={changeRoleStatus} role={role} />)
            ) : (
              <EmptyState />
            )}
          </div>
          <div className="admin-project-editor-panel">
            <h3>{selectedRole ? 'Edit Role' : 'Add Role'}</h3>
            <RoleEditor activePrograms={activePrograms} onSaved={setNotice} role={selectedRole} />
          </div>
        </div>
      </section>

      <ProjectToolkitManager activePrograms={activePrograms} onNotice={setNotice} programs={programs} />

      <section className="admin-project-workspace-grid">
        <div className="admin-project-section">
          <header className="admin-project-section__header">
            <div>
              <span>Projects</span>
              <h2>Live Project Library</h2>
            </div>
            <button className="segmented-button segmented-button--gold" onClick={startNewProject} type="button">
              <Plus size={15} />
              New Project
            </button>
          </header>
          <div className="admin-project-library">
            <div className="admin-project-filter-row">
              <form className="filter-search filter-search--form admin-project-search" onSubmit={(event) => event.preventDefault()}>
                <Search size={16} />
                <label className="sr-only" htmlFor="admin-project-library-search">
                  Search projects
                </label>
                <input id="admin-project-library-search" onChange={(event) => setSearchDraft(event.target.value)} placeholder="Search projects..." type="search" value={searchDraft} />
              </form>
              <select aria-label="Filter project status" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as ProjectFilters['status'] }))}>
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <select aria-label="Filter project program" value={filters.programKey} onChange={(event) => setFilters((current) => ({ ...current, programKey: event.target.value }))}>
                <option value="">All programs</option>
                {programs.map((program) => (
                  <option key={program.id} value={program.programKey}>
                    {program.name}
                  </option>
                ))}
              </select>
              <select aria-label="Filter project role" value={filters.roleId} onChange={(event) => setFilters((current) => ({ ...current, roleId: event.target.value }))}>
                <option value="">All roles</option>
                {roles.map((role) => (
                  <option key={role.id} value={roleKey(role)}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-project-scroll-list admin-project-scroll-list--library" aria-label="Live project list">
              {projects.length > 0 ? (
                projects.map((project) => (
                  <ProjectCard
                    isSelected={selectedProject?.id === project.id}
                    key={project.id}
                    onDuplicate={duplicateProject}
                    onEdit={setSelectedProject}
                    onStatusChange={changeProjectStatus}
                    project={project}
                    programs={programs}
                    role={roleFromProject(project, roles)}
                    statusDisabled={updateProjectStatus.isPending}
                  />
                ))
              ) : (
                <EmptyState />
              )}
            </div>
          </div>
        </div>

        <div className="admin-project-section admin-project-section--sticky">
          <header className="admin-project-section__header">
            <div>
              <span>Editor</span>
              <h2>{selectedProject?.id ? 'Edit Project' : 'Add Project'}</h2>
            </div>
            <Edit3 size={18} />
          </header>
          <ProjectEditor
            activePrograms={activePrograms}
            onSaved={(message) => {
              setNotice(message);
              if (selectedProject && !selectedProject.id) setSelectedProject(null);
            }}
            project={selectedProject}
            roles={roles}
          />
          <div className="admin-project-editor-footnote">
            <CheckCircle2 size={15} />
            <span>Student visibility requires active status and at least one active program mapping.</span>
          </div>
        </div>
      </section>
    </div>
  );
}
