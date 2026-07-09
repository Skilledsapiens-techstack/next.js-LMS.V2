import { ShieldCheck, UserPlus, UsersRound } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { ADMIN_PERMISSION_MODULES, ROLE_PERMISSIONS, type AdminPermission } from '../auth/adminPermissions';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenStates';
import { StatusBadge } from '../components/StatusBadge';
import { AdminUser, AdminUserRole, AdminUserSavePayload, AdminUserStatus, useAdminUsers, useDeactivateAdminUser, useSaveAdminUser } from '../features/admin/useAdminUsers';

type Draft = AdminUserSavePayload;

const roleOptions: Array<{ description: string; label: string; value: AdminUserRole }> = [
  { description: 'Full LMS control, including roles and protected settings.', label: 'Super Admin', value: 'super_admin' },
  { description: 'Operational LMS control without payments, email centre, feature flags, or role management.', label: 'Admin', value: 'admin' },
  { description: 'Review/support oriented access with limited write permissions.', label: 'Moderator', value: 'moderator' }
];

const emptyDraft: Draft = {
  email: '',
  fullName: '',
  permissions: ROLE_PERMISSIONS.moderator,
  role: 'moderator',
  status: 'active'
};

function uniquePermissions(permissions: readonly AdminPermission[]) {
  return Array.from(new Set(permissions));
}

function defaultPermissionsForRole(role: AdminUserRole) {
  return role === 'super_admin' ? null : uniquePermissions(ROLE_PERMISSIONS[role]);
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { day: '2-digit', hour: '2-digit', minute: '2-digit', month: 'short', year: 'numeric' });
}

function roleLabel(role: AdminUserRole) {
  return roleOptions.find((option) => option.value === role)?.label ?? role;
}

function statusTone(status: AdminUserStatus) {
  return status === 'active' ? 'safe' : 'warning';
}

function draftFromAdmin(admin: AdminUser): Draft {
  return {
    email: admin.email,
    fullName: admin.fullName,
    permissions: admin.role === 'super_admin' ? null : uniquePermissions(admin.permissions ?? ROLE_PERMISSIONS[admin.role]),
    role: admin.role,
    status: admin.status
  };
}

export function AdminUsersPage() {
  const adminsQuery = useAdminUsers();
  const saveAdmin = useSaveAdminUser();
  const deactivateAdmin = useDeactivateAdminUser();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const admins = adminsQuery.data?.admins ?? [];
  const summary = useMemo(
    () => ({
      active: admins.filter((admin) => admin.status === 'active').length,
      superAdmins: admins.filter((admin) => admin.role === 'super_admin' && admin.status === 'active').length,
      total: admins.length
    }),
    [admins]
  );

  function patchDraft(patch: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function handleRoleChange(role: AdminUserRole) {
    patchDraft({ permissions: defaultPermissionsForRole(role), role });
  }

  function toggleModulePermissions(modulePermissions: AdminPermission[]) {
    if (draft.role === 'super_admin') return;
    const currentPermissions = new Set(draft.permissions ?? []);
    const isSelected = modulePermissions.every((permission) => currentPermissions.has(permission));
    if (isSelected) {
      modulePermissions.forEach((permission) => currentPermissions.delete(permission));
    } else {
      modulePermissions.forEach((permission) => currentPermissions.add(permission));
    }
    patchDraft({ permissions: uniquePermissions(Array.from(currentPermissions)) });
  }

  function startEdit(admin: AdminUser) {
    setEditingEmail(admin.email);
    setDraft(draftFromAdmin(admin));
    setNotice(null);
  }

  function resetForm() {
    setEditingEmail(null);
    setDraft(emptyDraft);
    setNotice(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    try {
      await saveAdmin.mutateAsync(draft);
      setNotice({ tone: 'success', text: editingEmail ? 'Admin access updated.' : 'Admin access added.' });
      setEditingEmail(null);
      setDraft(emptyDraft);
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Admin access could not be saved.' });
    }
  }

  async function handleDeactivate(admin: AdminUser) {
    if (!window.confirm(`Deactivate admin access for ${admin.email}?`)) return;
    setNotice(null);
    try {
      await deactivateAdmin.mutateAsync(admin.id);
      setNotice({ tone: 'success', text: 'Admin access deactivated.' });
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Admin access could not be deactivated.' });
    }
  }

  if (adminsQuery.isLoading) {
    return (
      <div className="page-stack">
        <PageHeader description="Loading protected admin access controls." eyebrow="Security" title="Admin Users" />
        <LoadingState />
      </div>
    );
  }

  if (adminsQuery.isError) {
    return (
      <div className="page-stack">
        <PageHeader description="Admin access controls could not be loaded right now." eyebrow="Security" title="Admin Users unavailable" />
        <ErrorState />
      </div>
    );
  }

  return (
    <div className="page-stack admin-users-page">
      <PageHeader description="Manage who can enter the Admin Portal and what role they receive." eyebrow="Security" title="Admin Users" />

      {notice ? <div className={notice.tone === 'success' ? 'auth-alert auth-alert--success' : 'auth-alert auth-alert--error'}>{notice.text}</div> : null}

      <section className="feature-control-summary" aria-label="Admin access summary">
        <article>
          <UsersRound size={20} />
          <span>Total admins</span>
          <strong>{summary.total}</strong>
        </article>
        <article>
          <ShieldCheck size={20} />
          <span>Active</span>
          <strong>{summary.active}</strong>
        </article>
        <article>
          <ShieldCheck size={20} />
          <span>Super Admins</span>
          <strong>{summary.superAdmins}</strong>
        </article>
      </section>

      <section className="admin-users-grid">
        <form className="admin-users-form" onSubmit={handleSubmit}>
          <header>
            <UserPlus size={20} />
            <div>
              <h2>{editingEmail ? 'Update admin access' : 'Add admin access'}</h2>
              <p>Use the account holder name and exact email used for Supabase login.</p>
            </div>
          </header>

          <label>
            <span>Account holder name</span>
            <input required value={draft.fullName} onChange={(event) => patchDraft({ fullName: event.target.value })} placeholder="Full name" />
          </label>

          <label>
            <span>Email</span>
            <input required type="email" value={draft.email} onChange={(event) => patchDraft({ email: event.target.value })} placeholder="name@example.com" />
          </label>

          <label>
            <span>Role</span>
            <select value={draft.role} onChange={(event) => handleRoleChange(event.target.value as AdminUserRole)}>
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Status</span>
            <select value={draft.status} onChange={(event) => patchDraft({ status: event.target.value as AdminUserStatus })}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>

          <div className="admin-users-role-help">
            {roleOptions.map((option) => (
              <p key={option.value}>
                <strong>{option.label}:</strong> {option.description}
              </p>
            ))}
          </div>

          <section className="admin-permission-picker" aria-label="Module permissions">
            <div>
              <h3>Module permissions</h3>
              <p>{draft.role === 'super_admin' ? 'Super Admin always receives full LMS access.' : 'Select exactly which modules this account can access.'}</p>
            </div>
            <div className="admin-permission-grid">
              {ADMIN_PERMISSION_MODULES.map((module) => {
                const selected = draft.role === 'super_admin' || module.permissions.every((permission) => (draft.permissions ?? []).includes(permission));
                return (
                  <label key={module.id} className="admin-permission-option">
                    <input
                      checked={selected}
                      disabled={draft.role === 'super_admin'}
                      onChange={() => toggleModulePermissions(module.permissions)}
                      type="checkbox"
                    />
                    <span>
                      <strong>{module.label}</strong>
                      <small>{module.description}</small>
                    </span>
                  </label>
                );
              })}
            </div>
          </section>

          <footer>
            <button className="segmented-button" disabled={saveAdmin.isPending} onClick={resetForm} type="button">
              Clear
            </button>
            <button className="segmented-button segmented-button--active" disabled={saveAdmin.isPending} type="submit">
              {saveAdmin.isPending ? 'Saving...' : editingEmail ? 'Update Access' : 'Add Access'}
            </button>
          </footer>
        </form>

        <section className="feature-control-panel admin-users-list">
          <header>
            <div>
              <h2>Admin access list</h2>
              <span>Only role, status, name, and email are shown here.</span>
            </div>
          </header>

          {admins.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Updated</th>
                    <th>Modules</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map((admin) => (
                    <tr key={admin.id}>
                      <td>
                        <strong>{admin.fullName || admin.email}</strong>
                        <small>{admin.email}</small>
                      </td>
                      <td>{roleLabel(admin.role)}</td>
                      <td>
                        <StatusBadge tone={statusTone(admin.status)}>{admin.status}</StatusBadge>
                      </td>
                      <td>{formatDate(admin.updatedAt ?? admin.createdAt)}</td>
                      <td>
                        {admin.role === 'super_admin'
                          ? 'Full access'
                          : `${ADMIN_PERMISSION_MODULES.filter((module) => module.permissions.every((permission) => (admin.permissions ?? ROLE_PERMISSIONS[admin.role]).includes(permission))).length} modules`}
                      </td>
                      <td>
                        <div className="admin-users-actions">
                          <button className="segmented-button" onClick={() => startEdit(admin)} type="button">
                            Edit
                          </button>
                          {admin.status === 'active' ? (
                            <button className="segmented-button segmented-button--danger" disabled={deactivateAdmin.isPending} onClick={() => void handleDeactivate(admin)} type="button">
                              Deactivate
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </div>
  );
}
