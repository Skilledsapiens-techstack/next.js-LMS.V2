import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

function parseEnv(content) {
  return Object.fromEntries(
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=');
        return [line.slice(0, index), line.slice(index + 1).replace(/^["']|["']$/g, '')];
      })
  );
}

async function main() {
  const env = parseEnv(await readFile(resolve('.env'), 'utf8'));
  const supabaseUrl = env.SUPABASE_URL?.startsWith('http') ? env.SUPABASE_URL : env.VITE_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new Error('SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env.');

  const leadershipPath = process.argv[2];
  const liveProjectPath = process.argv[3];
  if (!leadershipPath || !liveProjectPath) {
    throw new Error('Usage: node scripts/upload-certificate-templates.mjs <leadership-template.pdf> <live-project-template.pdf>');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const templates = [
    {
      filePath: leadershipPath,
      name: 'Leadership Program Certificate',
      storagePath: 'leadership-program/master-template.pdf',
      type: 'leadership_program'
    },
    {
      filePath: liveProjectPath,
      name: 'Live Project Certificate',
      storagePath: 'live-project/master-template.pdf',
      type: 'live_project'
    }
  ];

  for (const template of templates) {
    const bytes = await readFile(template.filePath);
    const { error: uploadError } = await supabase.storage
      .from('certificate-templates')
      .upload(template.storagePath, bytes, {
        contentType: 'application/pdf',
        upsert: true
      });
    if (uploadError) throw uploadError;

    const row = {
      is_active: true,
      storage_bucket: 'certificate-templates',
      storage_path: template.storagePath,
      template_name: template.name,
      template_type: template.type,
      updated_at: new Date().toISOString(),
      version: 1
    };
    const { data: existing, error: existingError } = await supabase
      .from('certificate_templates')
      .select('id')
      .eq('template_type', template.type)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    if (existingError) throw existingError;
    const { error: templateError } = existing
      ? await supabase.from('certificate_templates').update(row).eq('id', existing.id)
      : await supabase.from('certificate_templates').insert(row);
    if (templateError) throw templateError;
    console.log(`Uploaded ${template.name} -> ${template.storagePath}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
