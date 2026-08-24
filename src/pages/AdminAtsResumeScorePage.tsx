import { AlertCircle, BadgeIndianRupee, BarChart3, BriefcaseBusiness, CheckCircle2, CreditCard, Eye, FileSearch, Plus, RefreshCw, Save, Search, Settings2, SlidersHorizontal, Sparkles, Trash2, UserPlus, Users } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { LoadingState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import {
  AdminAtsPackage,
  AdminAtsAttempt,
  AdminAtsRoleProfile,
  AdminAtsScoringVersion,
  AdminAtsStudentCredit,
  useAdminAtsResumeScore,
  useAdminAtsStudentCredits,
  useUpdateAdminAtsStudentCredits,
  useUpdateAdminAtsPackage,
  useUpdateAdminAtsRoleProfile,
  useUpdateAdminAtsScoringVersion
} from '../features/admin/useAdminAtsResumeScore';

function formatDate(value: string | undefined) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function scoreTone(score: number) {
  if (score >= 85) return 'safe';
  if (score >= 70) return 'neutral';
  if (score >= 50) return 'warning';
  return 'danger';
}

function csvText(values: string[] | undefined) {
  return (values ?? []).join(', ');
}

function parseCsvText(value: string) {
  return [...new Set(value.split(/[\n,]+/).map((item) => item.trim().toLowerCase()).filter(Boolean))];
}

function formatAmount(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { currency, style: 'currency' }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

function scoringKeyLabel(value: string) {
  return value
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .split(/\s+/)
    .map((word) => {
      const lower = word.toLowerCase();
      if (lower === 'ats') return 'ATS';
      if (lower === 'jd') return 'JD';
      return `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
    })
    .join(' ');
}

function parseJsonObject(value: string, label: string) {
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error(`${label} must be valid JSON object text.`);
  }
}

const ATS_CAP_CONTROLS = [
  { helper: 'Hard cap when extracted text is extremely short.', key: 'tinyText', label: 'Tiny text cap' },
  { helper: 'Hard cap when extracted resume text is very short.', key: 'veryShortText', label: 'Very short text cap' },
  { helper: 'Hard cap for clear non-resume PDFs.', key: 'nonResume', label: 'Non-resume cap' },
  { helper: 'Hard cap when document has weak resume confidence.', key: 'lowResumeConfidence', label: 'Low resume confidence cap' },
  { helper: 'Hard cap when email and phone are missing.', key: 'missingContact', label: 'Missing contact cap' },
  { helper: 'Hard cap when no standard resume sections are detected.', key: 'missingSections', label: 'Missing sections cap' },
  { helper: 'Hard cap when only one or two sections are detected.', key: 'fewSections', label: 'Few sections cap' },
  { helper: 'Hard cap when bullets or timeline structure is weak.', key: 'weakBulletStructure', label: 'Weak bullet structure cap' },
  { helper: 'Advanced-only cap for very low role keyword match.', key: 'lowRoleKeywordMatch', label: 'Low role match cap' }
] as const;

const ATS_RECOMMENDATION_GAIN_CONTROLS = [
  { helper: 'Shown when a hard cap blocks the score.', key: 'scoreCap', label: 'Score cap fix gain' },
  { helper: 'Shown when core contact details are weak.', key: 'contact', label: 'Contact fix gain' },
  { helper: 'Shown when sections need clearer structure.', key: 'sections', label: 'Section fix gain' },
  { helper: 'Shown when bullets need rewriting.', key: 'bulletRewrite', label: 'Bullet rewrite gain' },
  { helper: 'Shown when measurable proof is missing.', key: 'quantifiedImpact', label: 'Quantified impact gain' },
  { helper: 'Shown when role keywords need evidence.', key: 'roleKeywordEvidence', label: 'Role keyword evidence gain' },
  { helper: 'Shown when JD alignment is weak.', key: 'jobDescriptionMatch', label: 'JD match gain' },
  { helper: 'Shown when format/readability needs cleanup.', key: 'readability', label: 'Readability gain' },
  { helper: 'Shown when there are too few bullets.', key: 'moreBullets', label: 'More bullets gain' }
] as const;

type SavedAtsCategory = {
  label: string;
  maxScore: number;
  score: number;
  signals: string[];
  suggestions: string[];
};

type SampleCvPointDraft = {
  actionVerb: string;
  keywords: string;
  metric: string;
  point: string;
};

type RoleProfileDraft = {
  actionVerbs: string;
  evidence: string;
  keywordStrategy: string;
  keywords: string;
  preferredSections: string;
  sampleCvPoints: SampleCvPointDraft[];
  summary: string;
  warning: string;
};

function stringList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [];
}

function expectationText(expectations: Record<string, unknown> | undefined, key: string) {
  const value = expectations?.[key];
  return typeof value === 'string' ? value : '';
}

function sampleCvPointDrafts(value: Array<Record<string, unknown>> | undefined): SampleCvPointDraft[] {
  return (value ?? []).map((item) => ({
    actionVerb: typeof item.actionVerb === 'string' ? item.actionVerb : typeof item.action_verb === 'string' ? item.action_verb : '',
    keywords: stringList(item.keywords).join(', '),
    metric: typeof item.metric === 'string' ? item.metric : '',
    point: typeof item.point === 'string' ? item.point : ''
  }));
}

function sampleCvPointPayload(value: SampleCvPointDraft[]) {
  return value
    .map((item) => ({
      actionVerb: item.actionVerb.trim(),
      keywords: parseCsvText(item.keywords),
      metric: item.metric.trim(),
      point: item.point.trim()
    }))
    .filter((item) => item.point.length > 0);
}

function savedCategories(breakdown: Record<string, unknown>): SavedAtsCategory[] {
  return Array.isArray(breakdown.categories)
    ? breakdown.categories
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
        .map((category) => ({
          label: typeof category.label === 'string' ? category.label : 'Score area',
          maxScore: Number(category.maxScore ?? 0),
          score: Number(category.score ?? 0),
          signals: stringList(category.signals),
          suggestions: stringList(category.suggestions)
        }))
        .filter((category) => category.maxScore > 0)
    : [];
}

function summaryList(summary: Record<string, unknown>, key: 'strengths' | 'topFixes') {
  return stringList(summary[key]);
}

function atsLoadErrorDetails(error: unknown) {
  const message = error instanceof Error ? error.message : 'ATS data could not be loaded.';
  const normalized = message.toLowerCase();
  const migrationPending =
    normalized.includes('ats_') &&
    (normalized.includes('does not exist') || normalized.includes('relation') || normalized.includes('schema cache') || normalized.includes('could not find'));

  return {
    message,
    migrationPending
  };
}

export function AdminAtsResumeScorePage() {
  const atsQuery = useAdminAtsResumeScore();
  const updatePackage = useUpdateAdminAtsPackage();
  const updateProfile = useUpdateAdminAtsRoleProfile();
  const updateScoring = useUpdateAdminAtsScoringVersion();
  const updateStudentCredits = useUpdateAdminAtsStudentCredits();
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [search, setSearch] = useState('');
  const [creditSearch, setCreditSearch] = useState('');
  const [creditSearchQuery, setCreditSearchQuery] = useState('');
  const [packageDrafts, setPackageDrafts] = useState<Record<string, Partial<AdminAtsPackage>>>({});
  const [profileDrafts, setProfileDrafts] = useState<Record<string, RoleProfileDraft>>({});
  const [scoringDrafts, setScoringDrafts] = useState<Record<string, { freeScanWeights: string; weights: string }>>({});
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<'overview' | 'packages' | 'scoring' | 'roles' | 'credits' | 'history'>('overview');
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [selectedLevelId, setSelectedLevelId] = useState<string | null>(null);
  const [selectedCreditStudentIds, setSelectedCreditStudentIds] = useState<string[]>([]);
  const [creditDraft, setCreditDraft] = useState({ advancedCreditsToGrant: '0', freeAttemptsLimit: '', notes: '' });
  const creditQuery = useAdminAtsStudentCredits(creditSearchQuery);

  const data = atsQuery.data;
  const attempts = data?.attempts.items ?? [];
  const roles = data?.roles.items ?? [];
  const levels = data?.levels.items ?? [];
  const profiles = data?.profiles.items ?? [];
  const packages = data?.packages.items ?? [];
  const scoringVersions = data?.scoringVersions.items ?? [];
  const activeScoring = scoringVersions.find((item) => item.status === 'active') ?? scoringVersions[0];

  const roleById = useMemo(() => new Map(roles.map((role) => [role.id, role])), [roles]);
  const levelById = useMemo(() => new Map(levels.map((level) => [level.id, level])), [levels]);
  const filteredRoles = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return roles;
    return roles.filter((role) => `${role.roleName} ${role.category} ${role.description ?? ''}`.toLowerCase().includes(query));
  }, [roles, search]);
  const activeRoleId = selectedRoleId && filteredRoles.some((role) => role.id === selectedRoleId) ? selectedRoleId : filteredRoles[0]?.id ?? roles[0]?.id;
  const profilesForActiveRole = useMemo(() => profiles.filter((profile) => profile.roleId === activeRoleId), [activeRoleId, profiles]);
  const activeLevelId =
    selectedLevelId && profilesForActiveRole.some((profile) => profile.levelId === selectedLevelId)
      ? selectedLevelId
      : profilesForActiveRole[0]?.levelId ?? levels[0]?.id;
  const activeProfile = profilesForActiveRole.find((profile) => profile.levelId === activeLevelId) ?? profilesForActiveRole[0];
  const activeRole = activeRoleId ? roleById.get(activeRoleId) : undefined;
  const activeLevel = activeProfile ? levelById.get(activeProfile.levelId) : undefined;

  const summary = useMemo(() => {
    const paid = attempts.filter((attempt) => attempt.accessType === 'paid');
    const average = attempts.length ? Math.round(attempts.reduce((sum, item) => sum + item.overallScore, 0) / attempts.length) : 0;
    const downloads = attempts.filter((attempt) => attempt.reportDownloaded).length;
    const topMissing = new Map<string, number>();
    attempts.forEach((attempt) => {
      const categories = Array.isArray(attempt.breakdown?.categories) ? attempt.breakdown.categories : [];
      categories.forEach((category) => {
        if (!category || typeof category !== 'object' || Array.isArray(category)) return;
        const label = typeof category.label === 'string' ? category.label : '';
        const score = Number(category.score ?? 0);
        const maxScore = Number(category.maxScore ?? 0);
        if (label && maxScore > 0 && score / maxScore < 0.55) topMissing.set(label, (topMissing.get(label) ?? 0) + 1);
      });
    });
    const missing = [...topMissing.entries()].sort((left, right) => right[1] - left[1]).slice(0, 3).map(([label]) => label);
    return { average, downloads, paid: paid.length, scans: attempts.length, topMissing: missing };
  }, [attempts]);
  const selectedAttempt = useMemo(() => attempts.find((attempt) => attempt.id === selectedAttemptId) ?? null, [attempts, selectedAttemptId]);

  function updatePackageDraft(id: string, patch: Partial<AdminAtsPackage>) {
    setPackageDrafts((current) => ({ ...current, [id]: { ...(current[id] ?? {}), ...patch } }));
  }

  function updateSampleCvPoint(profileId: string, draft: RoleProfileDraft, index: number, patch: Partial<SampleCvPointDraft>) {
    setProfileDrafts((current) => ({
      ...current,
      [profileId]: {
        ...draft,
        sampleCvPoints: draft.sampleCvPoints.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item))
      }
    }));
  }

  function addSampleCvPoint(profileId: string, draft: RoleProfileDraft) {
    const blankPoint = { actionVerb: '', keywords: '', metric: '', point: '' };
    setProfileDrafts((current) => ({
      ...current,
      [profileId]: {
        ...draft,
        sampleCvPoints: [blankPoint, ...draft.sampleCvPoints]
      }
    }));
    window.setTimeout(() => {
      const editor = document.getElementById(`ats-sample-points-${profileId}`);
      editor?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      editor?.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea')?.focus({ preventScroll: true });
    }, 0);
  }

  function removeSampleCvPoint(profileId: string, draft: RoleProfileDraft, index: number) {
    setProfileDrafts((current) => ({
      ...current,
      [profileId]: {
        ...draft,
        sampleCvPoints: draft.sampleCvPoints.filter((_, itemIndex) => itemIndex !== index)
      }
    }));
  }

  async function savePackage(item: AdminAtsPackage) {
    const draft = packageDrafts[item.id];
    if (!draft) return;
    try {
      await updatePackage.mutateAsync({ body: draft, id: item.id });
      setPackageDrafts((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
      setMessage({ tone: 'success', text: `${item.title} updated.` });
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'ATS package could not be updated.' });
    }
  }

  async function saveProfile(item: AdminAtsRoleProfile) {
    const draft = profileDrafts[item.id];
    if (!draft) return;
    try {
      await updateProfile.mutateAsync({
        body: {
          actionVerbs: parseCsvText(draft.actionVerbs),
          expectations: {
            ...(item.expectations ?? {}),
            evidence: draft.evidence.trim(),
            keyword_strategy: draft.keywordStrategy.trim(),
            summary: draft.summary.trim(),
            warning: draft.warning.trim()
          },
          keywords: parseCsvText(draft.keywords),
          preferredSections: parseCsvText(draft.preferredSections),
          sampleCvPoints: sampleCvPointPayload(draft.sampleCvPoints)
        },
        id: item.id
      });
      setProfileDrafts((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
      setMessage({ tone: 'success', text: 'ATS role profile updated.' });
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'ATS role profile could not be updated.' });
    }
  }

  async function saveScoring(item: AdminAtsScoringVersion) {
    const draft = scoringDrafts[item.id];
    if (!draft) return;
    try {
      await updateScoring.mutateAsync({
        body: {
          freeScanWeights: parseJsonObject(draft.freeScanWeights, 'Free scan weights'),
          weights: parseJsonObject(draft.weights, 'Advanced scoring weights')
        },
        id: item.id
      });
      setScoringDrafts({});
      setMessage({ tone: 'success', text: 'ATS scoring weights updated.' });
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'ATS scoring weights could not be updated.' });
    }
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(search.trim());
  }

  function handleCreditSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreditSearchQuery(creditSearch.trim());
    setSelectedCreditStudentIds([]);
  }

  function toggleCreditStudent(id: string) {
    setSelectedCreditStudentIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function saveStudentCredits() {
    try {
      const freeAttemptsLimit = creditDraft.freeAttemptsLimit.trim() === '' ? undefined : Number(creditDraft.freeAttemptsLimit);
      const advancedCreditsToGrant = creditDraft.advancedCreditsToGrant.trim() === '' ? 0 : Number(creditDraft.advancedCreditsToGrant);
      const response = await updateStudentCredits.mutateAsync({
        advancedCreditsToGrant,
        freeAttemptsLimit,
        notes: creditDraft.notes.trim(),
        studentIds: selectedCreditStudentIds
      });
      setCreditDraft({ advancedCreditsToGrant: '0', freeAttemptsLimit: '', notes: '' });
      setSelectedCreditStudentIds([]);
      setMessage({ tone: 'success', text: response.message });
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'ATS student credits could not be updated.' });
    }
  }

  function scoringObject(item: AdminAtsScoringVersion, key: 'freeScanWeights' | 'weights') {
    const draft = scoringDrafts[item.id]?.[key];
    if (!draft) return item[key] ?? {};
    try {
      return parseJsonObject(draft, key === 'weights' ? 'Advanced scoring weights' : 'Free scan weights');
    } catch {
      return item[key] ?? {};
    }
  }

  function updateScoringWeight(item: AdminAtsScoringVersion, group: 'freeScanWeights' | 'weights', key: string, value: number) {
    const currentDraft = scoringDrafts[item.id] ?? {
      freeScanWeights: JSON.stringify(item.freeScanWeights, null, 2),
      weights: JSON.stringify(item.weights, null, 2)
    };
    const currentObject = parseJsonObject(currentDraft[group], group === 'weights' ? 'Advanced scoring weights' : 'Free scan weights');
    setScoringDrafts((current) => ({
      ...current,
      [item.id]: {
        ...currentDraft,
        [group]: JSON.stringify({ ...currentObject, [key]: value }, null, 2)
      }
    }));
  }

  function updateNestedScoringValue(item: AdminAtsScoringVersion, group: 'freeScanWeights' | 'weights', section: 'caps' | 'recommendationGains', key: string, value: number | string) {
    const currentDraft = scoringDrafts[item.id] ?? {
      freeScanWeights: JSON.stringify(item.freeScanWeights, null, 2),
      weights: JSON.stringify(item.weights, null, 2)
    };
    const currentObject = parseJsonObject(currentDraft[group], group === 'weights' ? 'Advanced scoring weights' : 'Free scan weights');
    const currentSection = currentObject[section] && typeof currentObject[section] === 'object' && !Array.isArray(currentObject[section]) ? (currentObject[section] as Record<string, unknown>) : {};
    setScoringDrafts((current) => ({
      ...current,
      [item.id]: {
        ...currentDraft,
        [group]: JSON.stringify({ ...currentObject, [section]: { ...currentSection, [key]: value } }, null, 2)
      }
    }));
  }

  if (atsQuery.isLoading) {
    return (
      <div className="page-stack">
        <PageHeader description="Loading ATS analytics and configuration." eyebrow="Admin career tools" title="ATS Resume Score" />
        <LoadingState />
      </div>
    );
  }

  if (atsQuery.isError) {
    const details = atsLoadErrorDetails(atsQuery.error);
    return (
      <div className="page-stack">
        <PageHeader
          description={details.migrationPending ? 'ATS Resume Score database setup is pending.' : 'ATS Resume Score administration could not be loaded right now.'}
          eyebrow="Admin career tools"
          title={details.migrationPending ? 'ATS Resume Score setup required' : 'ATS Resume Score unavailable'}
        />
        <section className="screen-state screen-state--warning ats-admin-error">
          <AlertCircle size={22} />
          <div>
            <h2>{details.migrationPending ? 'Supabase migration not applied' : 'Unable to load'}</h2>
            <p>
              {details.migrationPending
                ? 'Apply the ATS migration to create the roles, packages, scoring, attempts, and usage tables before this admin page can load.'
                : 'Please refresh the page. If the issue continues, check the API message below.'}
            </p>
            <code>{details.message}</code>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page-stack admin-ats-page">
      <PageHeader description="Monitor resume scans, manage paid packages, tune scoring weights, and maintain the role keyword database." eyebrow="Admin career tools" title="ATS Resume Score" />

      {message ? <div className={message.tone === 'success' ? 'auth-alert auth-alert--success' : 'auth-alert auth-alert--error'}>{message.text}</div> : null}

      <section className="ats-admin-command">
        <div>
          <span className="eyebrow">Resume intelligence dashboard</span>
          <h2>Career readiness control panel</h2>
          <p>Keep the ATS checker calibrated, monetized, and useful for students without storing resume text.</p>
        </div>
        <div className="ats-admin-command__actions">
          <button className="segmented-button" disabled={atsQuery.isFetching} onClick={() => void atsQuery.refetch()} type="button">
            <RefreshCw size={16} />
            {atsQuery.isFetching ? 'Refreshing...' : 'Refresh data'}
          </button>
          <button className="student-action student-action--primary" onClick={() => setActivePanel('roles')} type="button">
            <BriefcaseBusiness size={16} />
            Manage roles
          </button>
        </div>
      </section>

      <section className="ats-summary-grid ats-summary-grid--admin" aria-label="Admin ATS summary">
        <article className="ats-admin-metric">
          <FileSearch size={20} />
          <span>Total scans</span>
          <strong>{summary.scans}</strong>
          <small>All student resume checks</small>
        </article>
        <article className="ats-admin-metric">
          <BadgeIndianRupee size={20} />
          <span>Paid scans</span>
          <strong>{summary.paid}</strong>
          <small>Advanced credit usage</small>
        </article>
        <article className="ats-admin-metric">
          <CheckCircle2 size={20} />
          <span>Average score</span>
          <strong>{summary.average}/100</strong>
          <small>Across saved attempts</small>
        </article>
        <article className="ats-admin-metric">
          <DownloadIcon />
          <span>Reports</span>
          <strong>{summary.downloads}</strong>
          <small>Branded downloads</small>
        </article>
      </section>

      <nav className="ats-admin-tabs" aria-label="ATS admin sections">
        {[
          { icon: BarChart3, id: 'overview', label: 'Overview' },
          { icon: CreditCard, id: 'packages', label: 'Packages' },
          { icon: Settings2, id: 'scoring', label: 'Scoring' },
          { icon: BriefcaseBusiness, id: 'roles', label: 'Roles' },
          { icon: UserPlus, id: 'credits', label: 'Credits' },
          { icon: FileSearch, id: 'history', label: 'History' }
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button className={activePanel === item.id ? 'ats-admin-tab ats-admin-tab--active' : 'ats-admin-tab'} key={item.id} onClick={() => setActivePanel(item.id as typeof activePanel)} type="button">
              <Icon size={16} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {activePanel === 'overview' ? (
        <section className="ats-admin-overview-grid">
          <article className="ats-admin-insight-card">
            <SlidersHorizontal size={20} />
            <div>
              <span className="eyebrow">Quality signals</span>
              <h2>Top improvement areas</h2>
              <p>{summary.topMissing.length ? summary.topMissing.join(', ') : 'No scan patterns available yet.'}</p>
            </div>
          </article>
          <article className="ats-admin-insight-card">
            <Sparkles size={20} />
            <div>
              <span className="eyebrow">Setup health</span>
              <h2>{roles.length} roles · {profiles.length} profiles</h2>
              <p>{packages.length} paid packages and {scoringVersions.length} scoring version{scoringVersions.length === 1 ? '' : 's'} configured.</p>
            </div>
          </article>
        </section>
      ) : null}

      {activePanel === 'packages' ? (
        <section className="ats-admin-panel">
          <header className="ats-admin-panel__header">
            <div>
              <span className="eyebrow">Paid packages</span>
              <h2>Pricing and credits</h2>
              <p>Configure student-facing scan packs, Razorpay links, credits, and availability.</p>
            </div>
            <span className="ats-count-pill">{packages.length} packages</span>
          </header>
          <div className="ats-package-control-grid">
            {packages.map((item) => {
              const draft = packageDrafts[item.id] ?? {};
              return (
                <article className="ats-package-control-card" key={item.id}>
                  <header>
                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.scanCredits} scan{item.scanCredits === 1 ? '' : 's'} · {formatAmount(item.amount, item.currency)}</span>
                    </div>
                    <StatusBadge tone={item.status === 'active' ? 'safe' : 'warning'}>{item.status}</StatusBadge>
                  </header>
                  <div className="ats-package-fields">
                    <label>
                      Amount
                      <input value={String(draft.amount ?? item.amount)} onChange={(event) => updatePackageDraft(item.id, { amount: Number(event.target.value) })} type="number" min="0" />
                    </label>
                    <label>
                      Credits
                      <input value={String(draft.scanCredits ?? item.scanCredits)} onChange={(event) => updatePackageDraft(item.id, { scanCredits: Number(event.target.value) })} type="number" min="1" />
                    </label>
                    <label className="ats-wide-field">
                      Payment link
                      <input value={String(draft.paymentLink ?? item.paymentLink ?? '')} onChange={(event) => updatePackageDraft(item.id, { paymentLink: event.target.value })} placeholder="https://rzp.io/..." type="url" />
                    </label>
                    <label>
                      Status
                      <select value={draft.status ?? item.status} onChange={(event) => updatePackageDraft(item.id, { status: event.target.value as AdminAtsPackage['status'] })}>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="draft">Draft</option>
                      </select>
                    </label>
                  </div>
                  <button className="student-action student-action--primary" disabled={!packageDrafts[item.id] || updatePackage.isPending} onClick={() => void savePackage(item)} type="button">
                    <Save size={16} />
                    Save package
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {activePanel === 'scoring' && activeScoring ? (
        <section className="ats-admin-panel">
          <header className="ats-admin-panel__header">
            <div>
              <span className="eyebrow">Scoring formula</span>
              <h2>{activeScoring.title}</h2>
              <p>Adjust the scoring weights shown to students. Totals are normalized into an overall score out of 100.</p>
            </div>
            <StatusBadge tone={activeScoring.status === 'active' ? 'safe' : 'warning'}>{activeScoring.status}</StatusBadge>
          </header>
          <div className="ats-weight-board">
            {(['weights', 'freeScanWeights'] as const).map((group) => {
              const weights = scoringObject(activeScoring, group);
              const caps = weights.caps && typeof weights.caps === 'object' && !Array.isArray(weights.caps) ? (weights.caps as Record<string, unknown>) : {};
              const gains = weights.recommendationGains && typeof weights.recommendationGains === 'object' && !Array.isArray(weights.recommendationGains) ? (weights.recommendationGains as Record<string, unknown>) : {};
              const scoreWeights = Object.entries(weights).filter(([, value]) => typeof value === 'number');
              return (
                <article className="ats-weight-card" key={group}>
                  <header>
                    <strong>{group === 'weights' ? 'Advanced analysis' : 'Basic free scan'}</strong>
                    <span>{scoreWeights.reduce<number>((sum, [, value]) => sum + Number(value || 0), 0)} total weight</span>
                  </header>
                  <div className="ats-weight-list">
                    {scoreWeights.map(([key, value]) => (
                      <label key={key}>
                        <span>{scoringKeyLabel(key)}</span>
                        <input min="0" onChange={(event) => updateScoringWeight(activeScoring, group, key, Number(event.target.value))} type="number" value={Number(value ?? 0)} />
                      </label>
                    ))}
                  </div>
                  <details className="ats-policy-controls">
                    <summary>Score caps</summary>
                    <div className="ats-policy-grid">
                      {ATS_CAP_CONTROLS.map((control) => (
                        <label key={control.key}>
                          <span>{control.label}</span>
                          <input min="0" max="100" onChange={(event) => updateNestedScoringValue(activeScoring, group, 'caps', control.key, Number(event.target.value))} type="number" value={Number(caps[control.key] ?? '')} />
                          <small>{control.helper}</small>
                        </label>
                      ))}
                    </div>
                  </details>
                  <details className="ats-policy-controls">
                    <summary>Recommendation gains</summary>
                    <div className="ats-policy-grid">
                      {ATS_RECOMMENDATION_GAIN_CONTROLS.map((control) => (
                        <label key={control.key}>
                          <span>{control.label}</span>
                          <input onChange={(event) => updateNestedScoringValue(activeScoring, group, 'recommendationGains', control.key, event.target.value)} placeholder="+2 to +4" type="text" value={String(gains[control.key] ?? '')} />
                          <small>{control.helper}</small>
                        </label>
                      ))}
                    </div>
                  </details>
                </article>
              );
            })}
          </div>
          <button className="student-action student-action--primary ats-admin-save" disabled={!scoringDrafts[activeScoring.id] || updateScoring.isPending} onClick={() => void saveScoring(activeScoring)} type="button">
            <Save size={16} />
            Save scoring weights
          </button>
        </section>
      ) : null}

      {activePanel === 'roles' ? (
        <section className="ats-admin-panel">
        <header className="ats-admin-panel__header">
          <div>
            <span className="eyebrow">Role database</span>
            <h2>Keywords and verbs</h2>
            <p>Select a role from the list, then tune the selected level profile.</p>
          </div>
          <form className="finance-search-form" onSubmit={handleSearch}>
            <div className="filter-search finance-search-input">
              <Search size={16} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search roles" type="search" />
            </div>
          </form>
        </header>
        <div className="ats-role-config-layout">
          <aside className="ats-role-tabs" aria-label="ATS role tabs">
            {filteredRoles.map((role) => (
              <button className={activeRoleId === role.id ? 'ats-role-tab ats-role-tab--active' : 'ats-role-tab'} key={role.id} onClick={() => setSelectedRoleId(role.id)} type="button">
                <strong>{role.roleName}</strong>
              </button>
            ))}
          </aside>
          <div className="ats-role-config-main">
        {activeProfile ? (() => {
          const draft = profileDrafts[activeProfile.id] ?? {
            actionVerbs: csvText(activeProfile.actionVerbs),
            evidence: expectationText(activeProfile.expectations, 'evidence'),
            keywordStrategy: expectationText(activeProfile.expectations, 'keyword_strategy'),
            keywords: csvText(activeProfile.keywords),
            preferredSections: csvText(activeProfile.preferredSections),
            sampleCvPoints: sampleCvPointDrafts(activeProfile.sampleCvPoints),
            summary: expectationText(activeProfile.expectations, 'summary'),
            warning: expectationText(activeProfile.expectations, 'warning')
          };
          return (
            <div className="ats-role-workspace">
              <article className="ats-profile-editor">
                <div className="ats-role-editor-context">
                  <div>
                    <span className="eyebrow">{activeRole?.category ?? 'Role'}</span>
                    <h3>{activeRole?.roleName ?? 'Role profile'}</h3>
                  </div>
                  <p>{activeRole?.description || 'Manage keywords, action verbs, and preferred resume sections for this target role.'}</p>
                </div>
                <div className="ats-role-level-tabs" aria-label="ATS role level tabs">
                  {profilesForActiveRole.map((profile) => {
                    const level = levelById.get(profile.levelId);
                    return (
                      <button className={activeProfile.id === profile.id ? 'ats-level-tab ats-level-tab--active' : 'ats-level-tab'} key={profile.id} onClick={() => setSelectedLevelId(profile.levelId)} type="button">
                        {level?.levelName ?? 'Level'}
                      </button>
                    );
                  })}
                </div>
                <header>
                  <div>
                    <strong>{activeLevel?.levelName ?? 'Level'} expectations</strong>
                    <span>{activeProfile.keywords.length} keywords · {activeProfile.actionVerbs.length} verbs</span>
                  </div>
                  <StatusBadge tone={activeProfile.status === 'active' ? 'safe' : 'warning'}>{activeProfile.status}</StatusBadge>
                </header>
                <label>
                  Keywords
                  <textarea value={draft.keywords} onChange={(event) => setProfileDrafts((current) => ({ ...current, [activeProfile.id]: { ...draft, keywords: event.target.value } }))} rows={4} />
                </label>
                <label>
                  Action verbs
                  <textarea value={draft.actionVerbs} onChange={(event) => setProfileDrafts((current) => ({ ...current, [activeProfile.id]: { ...draft, actionVerbs: event.target.value } }))} rows={3} />
                </label>
                <label>
                  Preferred sections
                  <input value={draft.preferredSections} onChange={(event) => setProfileDrafts((current) => ({ ...current, [activeProfile.id]: { ...draft, preferredSections: event.target.value } }))} />
                </label>
                <div className="ats-profile-guidance-grid">
                  <label>
                    Level guidance
                    <textarea value={draft.summary} onChange={(event) => setProfileDrafts((current) => ({ ...current, [activeProfile.id]: { ...draft, summary: event.target.value } }))} rows={3} />
                  </label>
                  <label>
                    Evidence to look for
                    <textarea value={draft.evidence} onChange={(event) => setProfileDrafts((current) => ({ ...current, [activeProfile.id]: { ...draft, evidence: event.target.value } }))} rows={3} />
                  </label>
                  <label>
                    Warning to flag
                    <textarea value={draft.warning} onChange={(event) => setProfileDrafts((current) => ({ ...current, [activeProfile.id]: { ...draft, warning: event.target.value } }))} rows={3} />
                  </label>
                  <label>
                    Keyword strategy
                    <textarea value={draft.keywordStrategy} onChange={(event) => setProfileDrafts((current) => ({ ...current, [activeProfile.id]: { ...draft, keywordStrategy: event.target.value } }))} rows={3} />
                  </label>
                </div>
                <section className="ats-sample-points-editor">
                  <header>
                    <div>
                      <strong>Sample CV point templates</strong>
                      <span>Edit the examples students can copy and adapt for this role.</span>
                    </div>
                    <button className="segmented-button" onClick={() => addSampleCvPoint(activeProfile.id, draft)} type="button">
                      <Plus size={16} />
                      Add point
                    </button>
                  </header>
                  <div className="ats-sample-point-list" id={`ats-sample-points-${activeProfile.id}`}>
                    {draft.sampleCvPoints.length === 0 ? (
                      <div className="ats-empty-panel">No sample CV points yet. Add examples students can adapt for this role and level.</div>
                    ) : null}
                    {draft.sampleCvPoints.map((point, index) => (
                      <article className="ats-sample-point-card" key={`${activeProfile.id}-sample-${index}`}>
                        <div className="ats-sample-point-card__header">
                          <span>Template {index + 1}</span>
                          <button aria-label={`Remove sample CV point ${index + 1}`} className="icon-button" onClick={() => removeSampleCvPoint(activeProfile.id, draft, index)} type="button">
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div className="ats-sample-point-fields">
                          <label>
                            Action verb
                            <input value={point.actionVerb} onChange={(event) => updateSampleCvPoint(activeProfile.id, draft, index, { actionVerb: event.target.value })} placeholder="Analyzed" />
                          </label>
                          <label>
                            Sample number
                            <input value={point.metric} onChange={(event) => updateSampleCvPoint(activeProfile.id, draft, index, { metric: event.target.value })} placeholder="15%, 20+, 3 days" />
                          </label>
                          <label className="ats-wide-field">
                            Editable resume bullet
                            <textarea value={point.point} onChange={(event) => updateSampleCvPoint(activeProfile.id, draft, index, { point: event.target.value })} placeholder="Analyzed customer feedback data using Excel to identify recurring service issues and improve reporting accuracy by 15%." rows={3} />
                          </label>
                          <label className="ats-wide-field">
                            Role keywords to include
                            <input value={point.keywords} onChange={(event) => updateSampleCvPoint(activeProfile.id, draft, index, { keywords: event.target.value })} placeholder="Excel, dashboard, reporting accuracy" />
                          </label>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
                <button className="student-action student-action--primary" disabled={!profileDrafts[activeProfile.id] || updateProfile.isPending} onClick={() => void saveProfile(activeProfile)} type="button">
                  <Save size={16} />
                  Save role profile
                </button>
              </article>
            </div>
          );
        })() : <div className="ats-empty-panel">No role profile found for this search.</div>}
          </div>
        </div>
      </section>
      ) : null}

      {activePanel === 'credits' ? (
        <section className="ats-admin-panel ats-credit-admin-panel">
          <header className="ats-admin-panel__header">
            <div>
              <span className="eyebrow">Student access</span>
              <h2>Assign ATS attempts</h2>
              <p>Search by student name, college, or email, then select matching results to update attempts.</p>
            </div>
            <form className="finance-search-form" onSubmit={handleCreditSearch}>
              <div className="filter-search finance-search-input">
                <Search size={16} />
                <input value={creditSearch} onChange={(event) => setCreditSearch(event.target.value)} placeholder="Search name, college, or email" type="search" />
              </div>
            </form>
          </header>
          <div className="ats-credit-admin-layout">
            <section className="ats-credit-search-results">
              <header>
                <div>
                  <strong>Search results</strong>
                  <span>{creditSearchQuery ? `${creditQuery.data?.items.length ?? 0} matching student${(creditQuery.data?.items.length ?? 0) === 1 ? '' : 's'}` : 'Search to load student records'}</span>
                </div>
              </header>
              <div className="ats-credit-student-list">
              {!creditSearchQuery ? <div className="ats-empty-panel">Search for a student to view matching ATS credit records.</div> : null}
              {creditSearchQuery && creditQuery.isLoading ? <LoadingState /> : null}
              {creditQuery.isError ? <div className="ats-empty-panel">Student ATS credits could not be loaded.</div> : null}
              {creditSearchQuery && !creditQuery.isLoading && !creditQuery.isError && (creditQuery.data?.items.length ?? 0) === 0 ? <div className="ats-empty-panel">No matching students found.</div> : null}
              {(creditQuery.data?.items ?? []).map((student) => (
                <StudentCreditRow isSelected={selectedCreditStudentIds.includes(student.id)} key={student.id} onToggle={() => toggleCreditStudent(student.id)} student={student} />
              ))}
              </div>
            </section>
            <section className="ats-credit-assignment-card">
              <header>
                <div className="ats-credit-assignment-card__icon">
                  <Users size={22} />
                </div>
                <div>
                  <span className="eyebrow">Batch update</span>
                  <h3>{selectedCreditStudentIds.length} selected</h3>
                  <p>Use this after selecting one or more students from the search results above.</p>
                </div>
              </header>
              <div className="ats-credit-assignment-fields">
              <label>
                <span>Set free basic lifetime limit</span>
                <input min="0" max="500" onChange={(event) => setCreditDraft((current) => ({ ...current, freeAttemptsLimit: event.target.value }))} placeholder="Leave unchanged" type="number" value={creditDraft.freeAttemptsLimit} />
                <small>Leave empty to keep each selected student&apos;s current free scan limit.</small>
              </label>
              <label>
                <span>Add advanced credits</span>
                <input min="0" max="500" onChange={(event) => setCreditDraft((current) => ({ ...current, advancedCreditsToGrant: event.target.value }))} type="number" value={creditDraft.advancedCreditsToGrant} />
                <small>Adds paid-style ATS scan credits to the selected students.</small>
              </label>
              <label>
                <span>Admin note</span>
                <textarea onChange={(event) => setCreditDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Reason visible in admin audit context" rows={4} value={creditDraft.notes} />
                <small>Optional note for internal tracking.</small>
              </label>
              </div>
              <button className="student-action student-action--primary" disabled={selectedCreditStudentIds.length === 0 || updateStudentCredits.isPending} onClick={() => void saveStudentCredits()} type="button">
                <UserPlus size={16} />
                {updateStudentCredits.isPending ? 'Updating...' : 'Update attempts'}
              </button>
            </section>
          </div>
        </section>
      ) : null}

      {activePanel === 'history' ? (
      <section className="ats-admin-panel">
        <header className="ats-admin-panel__header">
          <div>
            <span className="eyebrow">Student history</span>
            <h2>Recent scans</h2>
            <p>Review saved score history without storing resume text or job description content.</p>
          </div>
          <span className="ats-count-pill">{attempts.length} shown</span>
        </header>
        <div className="finance-list">
          {attempts.length === 0 ? <div className="ats-empty-panel">No student ATS scans have been saved yet.</div> : null}
          {attempts.slice(0, 20).map((attempt) => (
            <article className="finance-row" key={attempt.id}>
              <div className="finance-row__icon">
                <FileSearch size={20} />
              </div>
              <div className="finance-row__main">
                <div className="finance-row__title-line">
                  <h2>{attempt.studentName || attempt.studentEmail}</h2>
                  <strong>{attempt.overallScore}/100</strong>
                </div>
                <div className="finance-row__chips">
                  <StatusBadge tone={scoreTone(attempt.overallScore)}>{attempt.scanMode}</StatusBadge>
                  <span>{attempt.accessType}</span>
                  <span>{attempt.jdMatchUsed ? `JD ${attempt.jdMatchScore ?? 0}%` : 'No JD'}</span>
                  <span>{attempt.reportDownloaded ? 'Report downloaded' : 'No report'}</span>
                </div>
                <div className="finance-row__meta">
                  <span className="finance-reference"><strong>Email</strong><span>{attempt.studentEmail}</span></span>
                  <span className="finance-reference"><strong>Date</strong><span>{formatDate(attempt.createdAt)}</span></span>
                  <span className="finance-reference"><strong>Role</strong><span>{attempt.roleId ? roleById.get(attempt.roleId)?.roleName ?? 'Unknown role' : 'General'}</span></span>
                </div>
                <button className="segmented-button ats-detail-button" onClick={() => setSelectedAttemptId(attempt.id)} type="button">
                  <Eye size={16} />
                  View details
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
      ) : null}

      {selectedAttempt ? <AttemptDetailPanel attempt={selectedAttempt} levelName={selectedAttempt.levelId ? levelById.get(selectedAttempt.levelId)?.levelName : undefined} roleName={selectedAttempt.roleId ? roleById.get(selectedAttempt.roleId)?.roleName : undefined} onClose={() => setSelectedAttemptId(null)} /> : null}
    </div>
  );
}

function DownloadIcon() {
  return <FileSearch size={20} />;
}

function StudentCreditRow({ isSelected, onToggle, student }: { isSelected: boolean; onToggle: () => void; student: AdminAtsStudentCredit }) {
  return (
    <article className={isSelected ? 'ats-credit-student-row ats-credit-student-row--selected' : 'ats-credit-student-row'}>
      <label className="ats-credit-student-row__select">
        <input checked={isSelected} onChange={onToggle} type="checkbox" />
        <span />
      </label>
      <div className="ats-credit-student-row__identity">
        <strong>{student.fullName || student.email}</strong>
        <span>{student.email}</span>
        <small>{[student.studentId, student.programName, student.cohortName].filter(Boolean).join(' · ') || 'No program details'}</small>
      </div>
      <div className="ats-credit-stats">
        <span>
          <strong>{student.freeAttemptsUsed}/{student.freeAttemptsLimit}</strong>
          Basic used
        </span>
        <span>
          <strong>{student.freeAttemptsRemaining}</strong>
          Basic left
        </span>
        <span>
          <strong>{student.paidCreditsRemaining}</strong>
          Advanced left
        </span>
        <span>
          <strong>{student.adminCreditsGranted}</strong>
          Admin granted
        </span>
        <span>
          <strong>{student.totalScans}</strong>
          Total scans
        </span>
      </div>
    </article>
  );
}

function AttemptDetailPanel({ attempt, levelName, onClose, roleName }: { attempt: AdminAtsAttempt; levelName?: string; onClose: () => void; roleName?: string }) {
  const categories = savedCategories(attempt.breakdown);
  const strengths = summaryList(attempt.improvementSummary, 'strengths');
  const topFixes = summaryList(attempt.improvementSummary, 'topFixes');
  const wordCount = Number(attempt.breakdown.wordCount ?? 0);

  return (
    <section className="finance-list-panel ats-admin-detail" aria-label="ATS attempt detail">
      <header className="finance-list-panel__header">
        <div>
          <span className="eyebrow">Attempt detail</span>
          <h2>{attempt.studentName || attempt.studentEmail}</h2>
        </div>
        <button className="segmented-button" onClick={onClose} type="button">Close</button>
      </header>
      <div className="ats-admin-detail__summary">
        <span><strong>Score</strong>{attempt.overallScore}/100</span>
        <span><strong>Scan</strong>{attempt.scanMode}</span>
        <span><strong>Access</strong>{attempt.accessType}</span>
        <span><strong>Target</strong>{roleName ? `${roleName}${levelName ? `, ${levelName}` : ''}` : 'General'}</span>
        <span><strong>JD match</strong>{attempt.jdMatchUsed ? `${attempt.jdMatchScore ?? 0}%` : 'Not used'}</span>
        <span><strong>Words</strong>{wordCount > 0 ? wordCount.toLocaleString() : 'Not saved'}</span>
        <span><strong>Report</strong>{attempt.reportDownloaded ? 'Downloaded' : 'Not downloaded'}</span>
        <span><strong>Date</strong>{formatDate(attempt.createdAt)}</span>
      </div>
      <div className="ats-admin-detail__grid">
        {categories.map((category) => (
          <article className="ats-admin-detail-card" key={category.label}>
            <header>
              <strong>{category.label}</strong>
              <span>{category.score}/{category.maxScore}</span>
            </header>
            <div className="ats-score-meter" aria-hidden="true">
              <span style={{ width: `${Math.round((category.score / category.maxScore) * 100)}%` }} />
            </div>
            {category.signals.length ? (
              <ul>
                {category.signals.slice(0, 3).map((signal) => <li key={signal}>{signal}</li>)}
              </ul>
            ) : null}
            {category.suggestions.length ? <p>{category.suggestions[0]}</p> : null}
          </article>
        ))}
      </div>
      <div className="ats-admin-detail__lists">
        <article>
          <strong>Strengths</strong>
          {strengths.length ? strengths.map((item) => <span key={item}>{item}</span>) : <span>No strengths saved.</span>}
        </article>
        <article>
          <strong>Top fixes</strong>
          {topFixes.length ? topFixes.map((item) => <span key={item}>{item}</span>) : <span>No fixes saved.</span>}
        </article>
      </div>
    </section>
  );
}
