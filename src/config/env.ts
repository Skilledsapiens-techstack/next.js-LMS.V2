export type WebEnv = {
  lmsAppUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  writeActionsEnabled: boolean;
};

function readBoolean(value: string | undefined, defaultValue: boolean) {
  if (value === undefined) {
    return defaultValue;
  }

  return value === 'true';
}

export const webEnv: WebEnv = {
  lmsAppUrl: import.meta.env.VITE_LMS_APP_URL || 'https://login.skilledsapiens.com',
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
  writeActionsEnabled: readBoolean(import.meta.env.VITE_WRITE_ACTIONS_ENABLED, false)
};
