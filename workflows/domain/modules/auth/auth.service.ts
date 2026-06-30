import { UnauthorizedException } from "@app/common/runtime/errors";
import { User } from '@supabase/supabase-js';
import { SupabaseService } from '../../infra/supabase/supabase.service';

export type AuthenticatedSession = {
  user: User;
  accessToken: string;
};
export class AuthService {
  constructor(private readonly supabase: SupabaseService) {}

  async getSessionFromBearerToken(authorizationHeader: string | undefined): Promise<AuthenticatedSession> {
    const token = this.extractBearerToken(authorizationHeader);
    const { data, error } = await this.supabase.anon.auth.getUser(token);

    if (error || !data.user) {
      throw new UnauthorizedException('Valid Supabase session is required.');
   }

    return {
      user: data.user,
      accessToken: token
   };
 }

  private extractBearerToken(authorizationHeader: string | undefined) {
    if (!authorizationHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bearer token is required.');
   }

    return authorizationHeader.slice('Bearer '.length).trim();
 }
}
