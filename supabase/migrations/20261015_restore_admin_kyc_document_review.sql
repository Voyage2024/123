-- 20261015_restore_admin_kyc_document_review.sql
-- Owner/admin can review both passport (level 1) and video (level 2) submissions.
-- The bucket remains private. All access remains authenticated and role-gated.
-- Apply only if the intended policy is that both owner and admin review passports.

begin;

drop policy if exists "kyc: founder reads all" on public.kyc_submissions;
drop policy if exists "kyc: staff reads video" on public.kyc_submissions;
drop policy if exists "kyc: founder reviews all" on public.kyc_submissions;
drop policy if exists "kyc: staff reviews video" on public.kyc_submissions;

create policy "kyc: staff reads submissions"
on public.kyc_submissions
for select
to authenticated
using (public.voyage_is_staff());

create policy "kyc: staff reviews submissions"
on public.kyc_submissions
for update
to authenticated
using (public.voyage_is_staff())
with check (public.voyage_is_staff());

drop policy if exists "kyc-vault: founder reads passports" on storage.objects;
drop policy if exists "kyc-vault: staff reads videos" on storage.objects;

create policy "kyc-vault: staff reads documents"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'kyc-vault'
  and (storage.foldername(name))[2] in ('passport', 'video')
  and public.voyage_is_staff()
);

create or replace function public.club_admin_reject_kyc(p_submission uuid)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  s public.kyc_submissions%rowtype;
  v_level integer;
begin
  if not public.voyage_is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into s
  from public.kyc_submissions
  where id = p_submission
  for update;

  if not found then
    raise exception 'submission % not found', p_submission using errcode = 'P0002';
  end if;

  update public.kyc_submissions
     set status = 'rejected',
         reviewed_at = now(),
         reviewed_by = auth.uid()
   where id = s.id;

  update public.profiles
     set kyc_level = s.level - 1
   where id = s.profile_id
     and coalesce(kyc_level, 0) >= s.level;

  select coalesce(kyc_level, 0)
    into v_level
    from public.profiles
   where id = s.profile_id;

  return v_level;
end;
$$;

revoke all on function public.club_admin_reject_kyc(uuid) from public;
revoke all on function public.club_admin_reject_kyc(uuid) from anon;
grant execute on function public.club_admin_reject_kyc(uuid) to authenticated;

commit;
