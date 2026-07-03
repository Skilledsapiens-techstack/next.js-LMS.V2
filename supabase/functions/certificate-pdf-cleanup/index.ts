import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cleanup-secret',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  const expectedSecret = Deno.env.get('CERTIFICATE_CLEANUP_SECRET');
  const providedSecret = (request.headers.get('x-cleanup-secret') ?? request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '').trim();
  if (expectedSecret && providedSecret !== expectedSecret) return jsonResponse({ error: 'Unauthorized cleanup request.' }, 401);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data, error } = await supabase
    .from('certificates')
    .select('id,pdf_storage_path')
    .not('pdf_storage_path', 'is', null)
    .lt('pdf_expires_at', new Date().toISOString())
    .limit(500);

  if (error) return jsonResponse({ error: error.message }, 503);
  const paths = (data ?? []).map((row) => String(row.pdf_storage_path ?? '')).filter(Boolean);
  if (paths.length > 0) {
    const { error: removeError } = await supabase.storage.from('temporary-certificates').remove(paths);
    if (removeError) return jsonResponse({ error: removeError.message }, 503);
  }

  const ids = (data ?? []).map((row) => String(row.id));
  if (ids.length > 0) {
    const { error: updateError } = await supabase
      .from('certificates')
      .update({
        generation_status: 'expired',
        pdf_expires_at: null,
        pdf_storage_path: null,
        updated_at: new Date().toISOString()
      })
      .in('id', ids);
    if (updateError) return jsonResponse({ error: updateError.message }, 503);
  }

  return jsonResponse({ deleted: paths.length, updated: ids.length });
});
