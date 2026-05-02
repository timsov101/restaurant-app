create or replace function public.group_invite_summary(p_token text)
returns table (
  group_id uuid,
  group_name text,
  member_count integer,
  owner_display_name text,
  preview_members jsonb
)
language sql
security definer
set search_path = public
as $$
  with invite_group as (
    select
      g.id,
      g.name
    from public.group_by_invite(p_token) as g
    limit 1
  ),
  ordered_members as (
    select
      gm.user_id,
      gm.role,
      coalesce(nullif(trim(p.display_name), ''), 'Member') as display_name,
      row_number() over (
        order by
          case when gm.role = 'owner' then 0 else 1 end,
          coalesce(nullif(trim(p.display_name), ''), 'Member'),
          gm.user_id
      ) as preview_rank
    from invite_group ig
    join public.group_members gm on gm.group_id = ig.id
    left join public.profiles p on p.id = gm.user_id
  )
  select
    ig.id as group_id,
    ig.name as group_name,
    count(om.user_id)::integer as member_count,
    coalesce(
      max(om.display_name) filter (where om.role = 'owner'),
      'Someone'
    ) as owner_display_name,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'display_name', om.display_name,
          'role', om.role
        )
        order by om.preview_rank
      ) filter (where om.preview_rank <= 5),
      '[]'::jsonb
    ) as preview_members
  from invite_group ig
  left join ordered_members om on true
  group by ig.id, ig.name;
$$;

grant execute on function public.group_invite_summary(text) to anon, authenticated;
