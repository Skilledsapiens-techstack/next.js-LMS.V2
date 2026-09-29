create or replace function public.accept_pulse_invite(invite_code text)
returns table (
  accepted boolean,
  invite_id uuid,
  invited_by_profile_id uuid,
  message text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_code text := upper(btrim(invite_code));
  current_profile public.pulse_profiles%rowtype;
  inviter_profile public.pulse_profiles%rowtype;
  matching_invite public.pulse_invites%rowtype;
begin
  if (select auth.uid()) is null then
    return query select false, null::uuid, null::uuid, 'Sign in before accepting a Pulse invite.';
    return;
  end if;

  if clean_code is null or clean_code = '' then
    return query select false, null::uuid, null::uuid, 'Invite code is missing.';
    return;
  end if;

  select *
  into current_profile
  from public.pulse_profiles
  where auth_user_id = (select auth.uid())
    and pulse_status = 'active'
  limit 1;

  if current_profile.id is null then
    return query select false, null::uuid, null::uuid, 'Create your Pulse profile before accepting an invite.';
    return;
  end if;

  select *
  into inviter_profile
  from public.pulse_profiles
  where referral_code = clean_code
    and pulse_status = 'active'
  limit 1;

  if inviter_profile.id is null then
    return query select false, null::uuid, null::uuid, 'This Pulse invite code is not active.';
    return;
  end if;

  if inviter_profile.id = current_profile.id then
    return query select false, null::uuid, inviter_profile.id, 'You cannot accept your own Pulse invite.';
    return;
  end if;

  if current_profile.referred_by_profile_id is null then
    update public.pulse_profiles
    set
      referred_by_profile_id = inviter_profile.id,
      updated_at = now()
    where id = current_profile.id;
  end if;

  select *
  into matching_invite
  from public.pulse_invites
  where referral_code = clean_code
    and invited_by_profile_id = inviter_profile.id
    and (
      status = 'pending'
      or accepted_by_profile_id = current_profile.id
    )
  order by
    case when accepted_by_profile_id = current_profile.id then 0 else 1 end,
    created_at asc
  limit 1;

  if matching_invite.id is not null then
    update public.pulse_invites
    set
      accepted_at = coalesce(public.pulse_invites.accepted_at, now()),
      accepted_by_profile_id = current_profile.id,
      college_id = coalesce(public.pulse_invites.college_id, current_profile.college_id, inviter_profile.college_id),
      status = 'accepted',
      updated_at = now()
    where id = matching_invite.id
    returning * into matching_invite;

    return query select true, matching_invite.id, inviter_profile.id, 'Pulse invite accepted.';
    return;
  end if;

  insert into public.pulse_invites (
    accepted_at,
    accepted_by_profile_id,
    college_id,
    invited_by_profile_id,
    referral_code,
    status
  )
  values (
    now(),
    current_profile.id,
    coalesce(current_profile.college_id, inviter_profile.college_id),
    inviter_profile.id,
    clean_code,
    'accepted'
  )
  returning * into matching_invite;

  return query select true, matching_invite.id, inviter_profile.id, 'Pulse invite accepted.';
end;
$$;

revoke all on function public.accept_pulse_invite(text) from public;
grant execute on function public.accept_pulse_invite(text) to authenticated;
