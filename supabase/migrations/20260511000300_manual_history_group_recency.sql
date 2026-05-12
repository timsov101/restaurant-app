DROP FUNCTION IF EXISTS public.log_manual_dining_event(uuid, uuid, date, uuid[]);

CREATE OR REPLACE FUNCTION public.log_manual_dining_event(
  p_group_id uuid,
  p_restaurant_id uuid,
  p_user_ids uuid[],
  p_visited_on date
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_event_id uuid;
  v_visited_at timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  IF p_group_id IS NULL THEN
    RAISE EXCEPTION 'Group is required';
  END IF;

  IF p_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'Restaurant is required';
  END IF;

  IF p_visited_on IS NULL THEN
    RAISE EXCEPTION 'Visit date is required';
  END IF;

  IF p_visited_on > current_date THEN
    RAISE EXCEPTION 'Select today or a past date';
  END IF;

  IF p_user_ids IS NULL OR cardinality(p_user_ids) = 0 THEN
    RAISE EXCEPTION 'Select at least one diner';
  END IF;

  IF cardinality(p_user_ids) <> (
    SELECT count(DISTINCT user_id)
    FROM unnest(p_user_ids) AS selected(user_id)
  ) THEN
    RAISE EXCEPTION 'Diner list contains duplicates';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = p_group_id
      AND gm.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only group members can log events';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.group_restaurants gr
    WHERE gr.group_id = p_group_id
      AND gr.restaurant_id = p_restaurant_id
  ) THEN
    RAISE EXCEPTION 'Restaurant is not saved for this group';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(p_user_ids) AS selected(user_id)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.group_members gm
      WHERE gm.group_id = p_group_id
        AND gm.user_id = selected.user_id
    )
  ) THEN
    RAISE EXCEPTION 'All selected diners must belong to this group';
  END IF;

  v_visited_at := LEAST((p_visited_on + time '12:00') AT TIME ZONE 'UTC', now());

  INSERT INTO public.dining_events (
    group_id,
    created_by,
    event_time,
    chosen_restaurant_id,
    chosen_at,
    status
  )
  VALUES (
    p_group_id,
    auth.uid(),
    v_visited_at,
    p_restaurant_id,
    v_visited_at,
    'completed'
  )
  RETURNING id INTO v_event_id;

  INSERT INTO public.dining_event_participants (event_id, user_id)
  SELECT v_event_id, selected.user_id
  FROM unnest(p_user_ids) AS selected(user_id);

  RETURN v_event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_manual_dining_event(uuid, uuid, uuid[], date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_manual_dining_event(uuid, uuid, uuid[], date) FROM anon;
GRANT EXECUTE ON FUNCTION public.log_manual_dining_event(uuid, uuid, uuid[], date) TO authenticated;

CREATE OR REPLACE FUNCTION public.recommendations_for_event(p_event_id uuid)
RETURNS TABLE(
  restaurant_id uuid,
  name text,
  address text,
  price_level integer,
  overall_avg numeric,
  nutrition_avg numeric,
  recency_score numeric,
  cost_score numeric,
  final_score numeric,
  last_visit_at timestamp with time zone,
  last_visit_event_id uuid,
  last_visit_diner_count integer,
  last_visit_diner_names text[]
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
with ev as (
  select id, group_id
  from public.dining_events
  where id = p_event_id
),
authz as (
  select 1 ok
  from ev
  where exists (
    select 1
    from public.group_members gm
    where gm.group_id = ev.group_id
      and gm.user_id = auth.uid()
  )
),
parts as (
  select dep.user_id
  from public.dining_event_participants dep
  where dep.event_id = p_event_id
),
r as (
  select
    r.id,
    r.name,
    r.address,
    r.price_level
  from ev
  join public.group_restaurants gr
    on gr.group_id = ev.group_id
  join public.restaurants r
    on r.id = gr.restaurant_id
),
ratings as (
  select
    rr.restaurant_id,
    avg(rr.overall) filter (where rr.overall is not null) as overall_avg_raw,
    avg(rr.nutrition) filter (where rr.nutrition is not null) as nutrition_avg_raw
  from public.restaurant_ratings rr
  join parts p on p.user_id = rr.user_id
  group by rr.restaurant_id
),
group_recency as (
  select distinct on (de.chosen_restaurant_id)
    de.chosen_restaurant_id as restaurant_id,
    de.chosen_at as last_group_visit_at
  from ev
  join public.dining_events de
    on de.group_id = ev.group_id
  where de.chosen_restaurant_id is not null
    and coalesce(de.status, '') <> 'draft'
  order by de.chosen_restaurant_id, de.chosen_at desc nulls last, de.id desc
),
base as (
  select
    r.id as restaurant_id,
    r.name,
    r.address,
    r.price_level,
    coalesce(rat.overall_avg_raw, 4)::numeric as overall_avg,
    coalesce(rat.nutrition_avg_raw, 3)::numeric as nutrition_avg,
    (
      case
        when gr.last_group_visit_at is null then 100
        else 100 * (1 - power(0.5, extract(epoch from (now() - gr.last_group_visit_at)) / 86400.0 / 30.0))
      end
    )::numeric as recency_score,
    case
      when r.price_level is null then 50
      else ((4 - r.price_level)::numeric / 4.0) * 100
    end as cost_score
  from r
  left join ratings rat on rat.restaurant_id = r.id
  left join group_recency gr on gr.restaurant_id = r.id
),
scored as (
  select
    b.restaurant_id,
    b.name,
    b.address,
    b.price_level,
    b.overall_avg,
    b.nutrition_avg,
    b.recency_score,
    b.cost_score,
    (
      0.40 * ((b.overall_avg - 1) / 4.0 * 100) +
      0.30 * b.recency_score +
      0.15 * ((b.nutrition_avg - 1) / 4.0 * 100) +
      0.15 * b.cost_score
    ) as final_score
  from base b
),
candidate_visits as (
  select
    de.chosen_restaurant_id as restaurant_id,
    de.id as event_id,
    de.chosen_at as visited_at
  from ev
  join public.dining_events de
    on de.group_id = ev.group_id
  where de.chosen_restaurant_id is not null
    and coalesce(de.status, '') <> 'draft'
),
latest_visit as (
  select distinct on (cv.restaurant_id)
    cv.restaurant_id,
    cv.event_id,
    cv.visited_at
  from candidate_visits cv
  order by cv.restaurant_id, cv.visited_at desc nulls last, cv.event_id desc
),
latest_visit_diners as (
  select
    lv.restaurant_id,
    lv.event_id,
    lv.visited_at,
    count(distinct dep.user_id)::integer as diner_count,
    array_remove(array_agg(distinct p.display_name order by p.display_name), null) as diner_names
  from latest_visit lv
  left join public.dining_event_participants dep
    on dep.event_id = lv.event_id
  left join public.profiles p
    on p.id = dep.user_id
  group by lv.restaurant_id, lv.event_id, lv.visited_at
)
select
  s.restaurant_id,
  s.name,
  s.address,
  s.price_level,
  s.overall_avg,
  s.nutrition_avg,
  s.recency_score,
  s.cost_score,
  s.final_score,
  lvd.visited_at as last_visit_at,
  lvd.event_id as last_visit_event_id,
  lvd.diner_count as last_visit_diner_count,
  lvd.diner_names as last_visit_diner_names
from scored s
left join latest_visit_diners lvd
  on lvd.restaurant_id = s.restaurant_id
where exists (select 1 from authz)
order by s.final_score desc;
$$;

GRANT ALL ON FUNCTION public.recommendations_for_event(uuid) TO anon;
GRANT ALL ON FUNCTION public.recommendations_for_event(uuid) TO authenticated;
GRANT ALL ON FUNCTION public.recommendations_for_event(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
