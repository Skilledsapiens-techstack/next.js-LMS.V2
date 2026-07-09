import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type AdminRole = 'admin' | 'moderator' | 'super_admin';
type AdminStatus = 'active' | 'inactive';

const permissionAllowlist = new Set([
  'admin.dashboard.view',
  'admin.students.view',
  'admin.students.manage',
  'admin.students.import',
  'admin.students.export',
  'admin.students.invite',
  'admin.cohorts.view',
  'admin.cohorts.manage',
  'admin.programs.view',
  'admin.programs.manage',
  'admin.projects.view',
  'admin.projects.manage',
  'admin.submissions.view',
  'admin.submissions.review',
  'admin.meetings.view',
  'admin.meetings.manage',
  'admin.recordings.view',
  'admin.recordings.manage',
  'admin.resources.view',
  'admin.resources.manage',
  'admin.certificates.view',
  'admin.certificates.issue',
  'admin.enrollments.view',
  'admin.announcements.view',
  'admin.announcements.manage',
  'admin.community.view',
  'admin.community.manage',
  'admin.support.view',
  'admin.support.manage',
  'admin.email.view',
  'admin.email.manage',
  'admin.observability.view',
  'admin.payments.view',
  'admin.paid_access.view'
]);

type AdminUsersPayload = {
  action?: 'list' | 'save' | 'deactivate';
  adminId?: string;
  email?: string;
  fullName?: string;
  permissions?: unknown;
  role?: AdminRole;
  status?: AdminStatus;
};

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*'
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status
  });
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeEmail(value: unknown) {
  return text(value).toLowerCase();
}

function normalizeRole(value: unknown): AdminRole {
  const role = text(value).toLowerCase().replace(/[\s-]+/g, '_');
  if (role === 'super_admin') return 'super_admin';
  if (role === 'admin') return 'admin';
  if (role === 'moderator') return 'moderator';
  throw new Error('Select a valid admin role.');
}

function normalizeStatus(value: unknown): AdminStatus {
  const status = text(value).toLowerCase();
  if (status === 'active' || status === 'inactive') return status;
  throw new Error('Select a valid admin status.');
}

function normalizePermissions(value: unknown, role: AdminRole) {
  if (role === 'super_admin') return null;
  if (!Array.isArray(value)) return [];
  const permissions = value.map((item) => text(item)).filter(Boolean);
  const invalidPermission = permissions.find((permission) => !permissionAllowlist.has(permission));
  if (invalidPermission) throw new Error('One or more selected permissions are not allowed.');
  return Array.from(new Set(permissions));
}

async function getSuperAdmin(supabase: ReturnType<typeof createClient>, authorization: string) {
  const token = authorization.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new Error('Missing access token.');

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user?.email) throw new Error('Invalid session.');

  const email = normalizeEmail(userData.user.email);
  const { data, error } = await supabase
    .from('admin_users')
    .select('id,email,full_name,status,role,auth_user_id')
    .or(`auth_user_id.eq.${userData.user.id},email.eq.${email}`)
    .limit(2);

  if (error) throw error;
  const row = (data ?? []).find((item) => item.auth_user_id === userData.user.id) ?? (data ?? []).find((item) => normalizeEmail(item.email) === email);
  if (!row || row.status !== 'active' || row.role !== 'super_admin') throw new Error('Super Admin access is required.');

  return {
    adminUserId: String(row.id ?? ''),
    authUserId: userData.user.id,
    email
  };
}

function safeAdmin(row: Record<string, unknown>) {
  return {
    createdAt: row.created_at ?? null,
    email: row.email ?? '',
    fullName: row.full_name ?? '',
    id: row.id,
    permissions: Array.isArray(row.permissions) ? row.permissions : null,
    role: row.role ?? 'admin',
    status: row.status ?? 'inactive',
    updatedAt: row.updated_at ?? null
  };
}

async function findAuthUserIdByEmail(supabase: ReturnType<typeof createClient>, email: string) {
  let page = 1;
  const perPage = 1000;
  while (page <= 50) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const match = (data.users ?? []).find((user) => normalizeEmail(user.email) === email);
    if (match?.id) return match.id;
    if (!data.users || data.users.length < perPage) break;
    page += 1;
  }
  return null;
}

async function assertEmailIsNotStudent(supabase: ReturnType<typeof createClient>, email: string, authUserId: string | null) {
  const { data: studentByEmail, error: emailError } = await supabase.from('students').select('id,email').ilike('email', email).maybeSingle();
  if (emailError) throw emailError;
  if (studentByEmail) {
    throw new Error('This email is already linked to a Student account. Use another email for Admin access.');
  }

  if (authUserId) {
    const { data: studentByAuth, error: authError } = await supabase.from('students').select('id,email').eq('auth_user_id', authUserId).maybeSingle();
    if (authError) throw authError;
    if (studentByAuth) {
      throw new Error('This login is already linked to a Student account. Use another login for Admin access.');
    }
  }
}

async function writeAudit(supabase: ReturnType<typeof createClient>, actorEmail: string, action: string, adminId: string, details: Record<string, unknown>) {
  await supabase.from('audit_logs').insert({
    action,
    actor_email: actorEmail,
    actor_role: 'admin',
    details,
    entity_id: adminId,
    entity_type: 'admin_user',
    status: 'success'
  });
}

async function listAdmins(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase
    .from('admin_users')
    .select('id,email,full_name,role,status,permissions,created_at,updated_at')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return { admins: (data ?? []).map((row) => safeAdmin(row as Record<string, unknown>)) };
}

async function saveAdmin(supabase: ReturnType<typeof createClient>, actor: Awaited<ReturnType<typeof getSuperAdmin>>, payload: AdminUsersPayload) {
  const email = normalizeEmail(payload.email);
  const fullName = text(payload.fullName);
  const role = normalizeRole(payload.role);
  const status = normalizeStatus(payload.status ?? 'active');
  const permissions = normalizePermissions(payload.permissions, role);
  if (!email || !email.includes('@')) throw new Error('Enter a valid admin email.');
  if (!fullName) throw new Error('Enter the admin account holder name.');

  const { data: existing, error: lookupError } = await supabase.from('admin_users').select('id,email,auth_user_id').ilike('email', email).maybeSingle();
  if (lookupError) throw lookupError;

  if (existing && existing.auth_user_id === actor.authUserId && (role !== 'super_admin' || status !== 'active')) {
    throw new Error('You cannot demote or deactivate your own Super Admin account.');
  }

  const authUserId = existing?.auth_user_id ?? (await findAuthUserIdByEmail(supabase, email));
  await assertEmailIsNotStudent(supabase, email, authUserId);
  const row = {
    auth_user_id: authUserId,
    email,
    full_name: fullName,
    permissions,
    role,
    status,
    updated_at: new Date().toISOString()
  };

  const request = existing
    ? supabase.from('admin_users').update(row).eq('id', existing.id).select('id,email,full_name,role,status,permissions,created_at,updated_at').single()
    : supabase.from('admin_users').insert(row).select('id,email,full_name,role,status,permissions,created_at,updated_at').single();

  const { data, error } = await request;
  if (error) throw error;

  await writeAudit(supabase, actor.email, existing ? 'admin_user_updated' : 'admin_user_created', String(data.id ?? ''), { email, permissions, role, status });
  return { admin: safeAdmin(data as Record<string, unknown>) };
}

async function deactivateAdmin(supabase: ReturnType<typeof createClient>, actor: Awaited<ReturnType<typeof getSuperAdmin>>, payload: AdminUsersPayload) {
  const adminId = text(payload.adminId);
  if (!adminId) throw new Error('Admin id is required.');
  if (adminId === actor.adminUserId) throw new Error('You cannot deactivate your own Super Admin account.');

  const { data, error } = await supabase
    .from('admin_users')
    .update({ status: 'inactive', updated_at: new Date().toISOString() })
    .eq('id', adminId)
    .select('id,email,full_name,role,status,permissions,created_at,updated_at')
    .single();
  if (error) throw error;

  await writeAudit(supabase, actor.email, 'admin_user_deactivated', adminId, { email: data.email, role: data.role });
  return { admin: safeAdmin(data as Record<string, unknown>) };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  try {
    if (!supabaseUrl || !serviceRoleKey) throw new Error('Admin users function is not configured.');
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const actor = await getSuperAdmin(supabase, request.headers.get('Authorization') ?? '');
    const payload = (await request.json().catch(() => ({}))) as AdminUsersPayload;
    const action = payload.action ?? 'list';

    if (action === 'list') return jsonResponse(await listAdmins(supabase));
    if (action === 'save') return jsonResponse(await saveAdmin(supabase, actor, payload));
    if (action === 'deactivate') return jsonResponse(await deactivateAdmin(supabase, actor, payload));

    return jsonResponse({ error: 'Unsupported admin users action.' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? text((error as { message?: unknown }).message) || 'Admin users action failed.' : 'Admin users action failed.';
    return jsonResponse({ error: message }, 400);
  }
});
