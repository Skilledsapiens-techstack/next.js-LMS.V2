export type WebEnv = {
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
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
  writeActionsEnabled: readBoolean(import.meta.env.VITE_WRITE_ACTIONS_ENABLED, false)
};
