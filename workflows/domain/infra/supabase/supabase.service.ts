import { ConfigService } from "@app/common/runtime/config";
import { createClient, SupabaseClient } from '@supabase/supabase-js';
export class SupabaseService {
  readonly anon: SupabaseClient;
  readonly admin: SupabaseClient;
  private readonly supabaseUrl: string;
  private readonly supabaseAnonKey: string;

  constructor(config: ConfigService) {
    this.supabaseUrl = config.getOrThrow<string>('SUPABASE_URL');
    this.supabaseAnonKey = config.getOrThrow<string>('SUPABASE_ANON_KEY');

    this.anon = createClient(this.supabaseUrl, this.supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false }
   });

    this.admin = createClient(this.supabaseUrl, config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false }
   });
 }

  forUser(accessToken: string): SupabaseClient {
    return createClient(this.supabaseUrl, this.supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`
       }
     }
   });
 }
}
