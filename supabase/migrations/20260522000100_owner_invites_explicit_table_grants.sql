revoke all on table public.owner_invites from anon;
revoke all on table public.owner_invites from authenticated;
grant all on table public.owner_invites to service_role;

notify pgrst, 'reload schema';
