alter table public.groups
  add column if not exists archived_at timestamptz;

alter table public.groups
  add column if not exists archived_by uuid;
