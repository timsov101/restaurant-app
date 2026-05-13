ALTER TABLE public.group_restaurants
ADD COLUMN IF NOT EXISTS cost_override_level smallint NULL,
ADD COLUMN IF NOT EXISTS cost_override_updated_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS cost_override_updated_at timestamptz NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'group_restaurants_cost_override_level_check'
      AND conrelid = 'public.group_restaurants'::regclass
  ) THEN
    ALTER TABLE public.group_restaurants
    ADD CONSTRAINT group_restaurants_cost_override_level_check
    CHECK (
      cost_override_level IS NULL
      OR cost_override_level BETWEEN 1 AND 4
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_group_restaurant_cost_override(
  p_group_id uuid,
  p_restaurant_id uuid,
  p_cost_level smallint
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  IF p_cost_level IS NOT NULL AND (p_cost_level < 1 OR p_cost_level > 4) THEN
    RAISE EXCEPTION 'Cost level must be between 1 and 4';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = p_group_id
      AND gm.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only group members can update restaurant cost';
  END IF;

  UPDATE public.group_restaurants gr
  SET
    cost_override_level = p_cost_level,
    cost_override_updated_by = auth.uid(),
    cost_override_updated_at = now()
  WHERE gr.group_id = p_group_id
    AND gr.restaurant_id = p_restaurant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Restaurant is not saved for this group';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_group_restaurant_cost_override(uuid, uuid, smallint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_group_restaurant_cost_override(uuid, uuid, smallint) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_group_restaurant_cost_override(uuid, uuid, smallint) TO authenticated;

DROP FUNCTION IF EXISTS public.saved_restaurants_for_group(uuid);

CREATE OR REPLACE FUNCTION public.saved_restaurants_for_group(p_group_id uuid)
RETURNS TABLE(
  restaurant_id uuid,
  group_id uuid,
  saved_at timestamp with time zone,
  saved_by_user_id uuid,
  name text,
  address text,
  primary_type text,
  types text[],
  price_level integer,
  google_price_level integer,
  cost_override_level smallint,
  effective_cost_level smallint,
  price_currency text,
  price_range_start numeric,
  price_range_end numeric,
  distance_miles numeric,
  group_avg_overall numeric,
  group_avg_nutrition numeric,
  group_rating_count integer,
  current_user_overall integer,
  current_user_nutrition integer,
  current_user_has_rating boolean,
  current_user_rating_state text
)
LANGUAGE sql
SET search_path TO 'public'
AS $$
  with member_ids as (
    select gm.user_id
    from public.group_members gm
    where gm.group_id = p_group_id
  ),
  group_anchor as (
    select
      g.id,
      g.location_lat,
      g.location_lng
    from public.groups g
    where g.id = p_group_id
  ),
  group_rating_aggs as (
    select
      rr.restaurant_id,
      avg(rr.overall) filter (where rr.overall is not null) as group_avg_overall,
      avg(rr.nutrition) filter (where rr.nutrition is not null) as group_avg_nutrition,
      count(*) filter (
        where rr.overall is not null or rr.nutrition is not null
      )::integer as group_rating_count
    from public.restaurant_ratings rr
    join member_ids m
      on m.user_id = rr.user_id
    group by rr.restaurant_id
  ),
  me as (
    select auth.uid() as user_id
  )
  select
    r.id as restaurant_id,
    gr.group_id,
    gr.created_at as saved_at,
    gr.added_by_user_id as saved_by_user_id,

    r.name,
    r.address,
    r.primary_type,
    r.types,
    r.price_level,
    r.price_level as google_price_level,
    gr.cost_override_level,
    coalesce(
      gr.cost_override_level,
      case
        when r.price_level between 1 and 4 then r.price_level::smallint
        else null
      end,
      2::smallint
    ) as effective_cost_level,
    r.price_currency,
    r.price_range_start,
    r.price_range_end,

    case
      when ga.location_lat is null
        or ga.location_lng is null
        or r.lat is null
        or r.lng is null
      then null
      else 2 * 3958.7613 * asin(
        sqrt(
          power(sin(radians(r.lat - ga.location_lat) / 2), 2) +
          cos(radians(ga.location_lat)) *
          cos(radians(r.lat)) *
          power(sin(radians(r.lng - ga.location_lng) / 2), 2)
        )
      )
    end as distance_miles,

    gra.group_avg_overall,
    gra.group_avg_nutrition,
    coalesce(gra.group_rating_count, 0) as group_rating_count,

    my_rr.overall as current_user_overall,
    my_rr.nutrition as current_user_nutrition,
    (my_rr.overall is not null or my_rr.nutrition is not null) as current_user_has_rating,
    case
      when my_rr.overall is not null or my_rr.nutrition is not null then 'rated'
      else 'unrated'
    end as current_user_rating_state
  from public.group_restaurants gr
  join public.restaurants r
    on r.id = gr.restaurant_id
  left join group_anchor ga
    on ga.id = gr.group_id
  left join group_rating_aggs gra
    on gra.restaurant_id = r.id
  left join me
    on true
  left join public.restaurant_ratings my_rr
    on my_rr.restaurant_id = r.id
   and my_rr.user_id = me.user_id
  where gr.group_id = p_group_id
  order by r.name asc;
$$;

GRANT ALL ON FUNCTION public.saved_restaurants_for_group(uuid) TO anon;
GRANT ALL ON FUNCTION public.saved_restaurants_for_group(uuid) TO authenticated;
GRANT ALL ON FUNCTION public.saved_restaurants_for_group(uuid) TO service_role;

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
    coalesce(
      gr.cost_override_level,
      case
        when r.price_level between 1 and 4 then r.price_level::smallint
        else null
      end,
      2::smallint
    ) as effective_cost_level
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
    r.effective_cost_level,
    coalesce(rat.overall_avg_raw, 4)::numeric as overall_avg,
    coalesce(rat.nutrition_avg_raw, 3)::numeric as nutrition_avg,
    (
      case
        when gr.last_group_visit_at is null then 100
        else 100 * (1 - power(0.5, extract(epoch from (now() - gr.last_group_visit_at)) / 86400.0 / 30.0))
      end
    )::numeric as recency_score,
    (((4 - r.effective_cost_level)::numeric / 3.0) * 100) as cost_score
  from r
  left join ratings rat on rat.restaurant_id = r.id
  left join group_recency gr on gr.restaurant_id = r.id
),
scored as (
  select
    b.restaurant_id,
    b.name,
    b.address,
    b.effective_cost_level as price_level,
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
