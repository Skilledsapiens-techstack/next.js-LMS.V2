import { useParams } from 'react-router-dom';
import { Portal } from '../app/routeConfig';
import { DataColumn, DataPanel } from '../components/DataPanel';
import { FilterBar } from '../components/FilterBar';
import { PageHeader } from '../components/PageHeader';
import { DisabledWriteAction, EmptyState, ErrorState, LoadingState, LockedState } from '../components/ScreenStates';
import { StateBlock } from '../components/StateBlock';
import { StatusBadge } from '../components/StatusBadge';

type ModulePlaceholderPageProps = {
  portal: Portal;
};

function toTitle(value: string | undefined) {
  if (!value) {
    return 'Module';
  }

  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

type PreviewRow = {
  name: string;
  state: string;
  notes: string;
};

const previewRows: PreviewRow[] = [
  {
    name: 'Bounded list',
    notes: 'Pagination, filters, and API query keys are added when the real endpoint is connected.',
    state: 'Ready'
  },
  {
    name: 'Read model',
    notes: 'The screen renders DTO fields returned by Supabase and keeps business rules outside visual components.',
    state: 'Planned'
  },
  {
    name: 'Write action',
    notes: 'Mutation controls remain disabled until Phase 6 approval and workflow-specific QA.',
    state: 'Disabled'
  }
];

const previewColumns: DataColumn<PreviewRow>[] = [
  {
    header: 'Area',
    key: 'name',
    render: (item) => <strong>{item.name}</strong>
  },
  {
    header: 'State',
    key: 'state',
    render: (item) => <StatusBadge tone={item.state === 'Disabled' ? 'warning' : 'neutral'}>{item.state}</StatusBadge>
  },
  {
    header: 'Notes',
    key: 'notes',
    render: (item) => item.notes
  }
];

export function ModulePlaceholderPage({ portal }: ModulePlaceholderPageProps) {
  const params = useParams();
  const title = toTitle(params.moduleId ?? params.requestId ?? params.ticketId);

  return (
    <div className="page-stack">
      <PageHeader
        actions={<DisabledWriteAction />}
        description="This route is reserved for the read-only migration screen mapped in the Phase 5 UI plan."
        eyebrow={portal === 'student' ? 'Student route' : 'Admin route'}
        title={title}
      />

      <StateBlock title="Screen implementation pending">
        The scaffold is ready. The next steps will connect this area to a typed Supabase query, then add loading, empty, error, unauthorized, and locked states.
      </StateBlock>

      <FilterBar searchPlaceholder={`Search ${title.toLowerCase()}`}>
        <StatusBadge>Read-only</StatusBadge>
        <StatusBadge tone="safe">Supabase</StatusBadge>
      </FilterBar>

      <DataPanel columns={previewColumns} description="Future module screens should keep table/list behavior consistent and bounded." items={previewRows} title="Module baseline" />

      <section className="state-grid" aria-label="Reusable screen states">
        <LoadingState />
        <EmptyState />
        <ErrorState />
        <LockedState />
      </section>
    </div>
  );
}
