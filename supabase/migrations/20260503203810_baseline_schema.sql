


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."delete_event"("p_event_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_creator uuid;
begin
  select created_by into v_creator
  from public.dining_events
  where id = p_event_id;

  if v_creator is null then
    raise exception 'Event not found';
  end if;

  if v_creator <> auth.uid() then
    raise exception 'Not authorized';
  end if;

  delete from public.dining_events where id = p_event_id;
end;
$$;


ALTER FUNCTION "public"."delete_event"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gen_invite_token"() RETURNS "text"
    LANGUAGE "sql"
    AS $$
  select replace(gen_random_uuid()::text, '-', '');
$$;


ALTER FUNCTION "public"."gen_invite_token"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_draft_event"("p_group_id" "uuid", "p_participants" "uuid"[]) RETURNS TABLE("event_id" "uuid", "chosen_restaurant_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  eid uuid;
  chosen uuid;
begin
  -- Must be a member of the group
  if not exists (
    select 1 from public.group_members gm
    where gm.group_id = p_group_id and gm.user_id = auth.uid()
  ) then
    raise exception 'Not authorized for group';
  end if;

  -- Reuse recent draft (3 hours)
  select e.id, e.chosen_restaurant_id
  into eid, chosen
  from public.dining_events e
  where e.group_id = p_group_id
    and e.created_by = auth.uid()
    and e.status = 'draft'
    and e.chosen_restaurant_id is null
    and e.updated_at >= now() - interval '3 hours'
  order by e.updated_at desc
  limit 1;

  if eid is null then
    insert into public.dining_events (group_id, created_by, status)
    values (p_group_id, auth.uid(), 'draft')
    returning id into eid;

    chosen := null;
  end if;

  -- Replace participants
  delete from public.dining_event_participants where event_id = eid;
  insert into public.dining_event_participants (event_id, user_id)
  select eid, unnest(p_participants);

  -- Touch updated_at
  update public.dining_events set updated_at = now() where id = eid;

  return query select eid, chosen;
end;
$$;


ALTER FUNCTION "public"."get_or_create_draft_event"("p_group_id" "uuid", "p_participants" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."group_by_invite"("p_token" "text") RETURNS TABLE("id" "uuid", "name" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select g.id, g.name
  from public.groups g
  where g.invite_token = p_token
  limit 1;
$$;


ALTER FUNCTION "public"."group_by_invite"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."group_invite_summary"("p_token" "text") RETURNS TABLE("group_id" "uuid", "group_name" "text", "member_count" integer, "owner_display_name" "text", "preview_members" "jsonb")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
  with raw_invite_group as (
    select to_jsonb(g) as group_data
    from public.group_by_invite($1) as g
    limit 1
  ),
  invite_group as (
    select
      coalesce(group_data ->> 'id', group_data ->> 'group_id')::uuid as id,
      coalesce(group_data ->> 'name', group_data ->> 'group_name')::text as name
    from raw_invite_group
    where coalesce(group_data ->> 'id', group_data ->> 'group_id') is not null
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
$_$;


ALTER FUNCTION "public"."group_invite_summary"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."history_for_group"("p_group_id" "uuid") RETURNS TABLE("event_id" "uuid", "chosen_at" timestamp with time zone, "group_id" "uuid", "group_name" "text", "restaurant_id" "uuid", "restaurant_name" "text", "restaurant_address" "text", "cuisine" "text", "diners" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    de.id as event_id,
    de.chosen_at,
    g.id as group_id,
    g.name as group_name,
    r.id as restaurant_id,
    r.name as restaurant_name,
    r.address as restaurant_address,
    r.primary_type as cuisine,
    coalesce(
      string_agg(distinct p.display_name, ', ' order by p.display_name),
      ''
    ) as diners
  from public.dining_events de
  join public.groups g
    on g.id = de.group_id
  join public.restaurants r
    on r.id = de.chosen_restaurant_id
  left join public.dining_event_participants dep
    on dep.event_id = de.id
  left join public.profiles p
    on p.id = dep.user_id
  where de.group_id = p_group_id
    and de.chosen_restaurant_id is not null
    and coalesce(de.status, '') <> 'draft'
  group by
    de.id,
    de.chosen_at,
    g.id,
    g.name,
    r.id,
    r.name,
    r.address,
    r.primary_type
  order by de.chosen_at desc nulls last;
$$;


ALTER FUNCTION "public"."history_for_group"("p_group_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."history_for_user"() RETURNS TABLE("event_id" "uuid", "chosen_at" timestamp with time zone, "group_id" "uuid", "group_name" "text", "restaurant_id" "uuid", "restaurant_name" "text", "restaurant_address" "text", "diners" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    e.id as event_id,
    e.chosen_at,
    g.id as group_id,
    g.name as group_name,
    r.id as restaurant_id,
    r.name as restaurant_name,
    r.address as restaurant_address,
    (
      select string_agg(coalesce(p.display_name, 'Unknown'), ', ' order by coalesce(p.display_name,'Unknown'))
      from public.dining_event_participants dep
      join public.profiles p on p.id = dep.user_id
      where dep.event_id = e.id
    ) as diners
  from public.dining_events e
  join public.groups g on g.id = e.group_id
  join public.restaurants r on r.id = e.chosen_restaurant_id
  where e.created_by = auth.uid()
    and e.status = 'completed'
    and e.chosen_at is not null
  order by e.chosen_at desc;
$$;


ALTER FUNCTION "public"."history_for_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_event_creator"("eid" "uuid", "uid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select exists (
    select 1 from public.dining_events e
    where e.id = eid and e.created_by = uid
  );
$$;


ALTER FUNCTION "public"."is_event_creator"("eid" "uuid", "uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_group_member"("gid" "uuid", "uid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = gid and gm.user_id = uid
  );
$$;


ALTER FUNCTION "public"."is_group_member"("gid" "uuid", "uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_group_owner"("gid" "uuid", "uid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = gid and gm.user_id = uid and gm.role = 'owner'
  );
$$;


ALTER FUNCTION "public"."is_group_owner"("gid" "uuid", "uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."members_for_group"("p_group_id" "uuid") RETURNS TABLE("user_id" "uuid", "role" "text", "display_name" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  -- Only allow if the caller is in the group
  select gm.user_id, gm.role, p.display_name
  from public.group_members gm
  join public.profiles p on p.id = gm.user_id
  where gm.group_id = p_group_id
    and exists (
      select 1
      from public.group_members me
      where me.group_id = p_group_id
        and me.user_id = auth.uid()
    )
  order by case when gm.role = 'owner' then 0 else 1 end, p.display_name;
$$;


ALTER FUNCTION "public"."members_for_group"("p_group_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recommendations_for_event"("p_event_id" "uuid") RETURNS TABLE("restaurant_id" "uuid", "name" "text", "address" "text", "price_level" integer, "overall_avg" numeric, "nutrition_avg" numeric, "recency_score" numeric, "cost_score" numeric, "final_score" numeric, "last_visit_at" timestamp with time zone, "last_visit_event_id" "uuid", "last_visit_diner_count" integer, "last_visit_diner_names" "text"[])
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
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
recency as (
  select
    rv.restaurant_id,
    avg(
      case
        when rv.last_visited_at is null then 100
        else 100 * (1 - power(0.5, extract(epoch from (now() - rv.last_visited_at)) / 86400.0 / 30.0))
      end
    ) as recency_score
  from parts p
  left join public.restaurant_visits rv
    on rv.user_id = p.user_id
  group by rv.restaurant_id
),
base as (
  select
    r.id as restaurant_id,
    r.name,
    r.address,
    r.price_level,
    coalesce(rat.overall_avg_raw, 4)::numeric as overall_avg,
    coalesce(rat.nutrition_avg_raw, 3)::numeric as nutrition_avg,
    coalesce(rec.recency_score, 100)::numeric as recency_score,
    case
      when r.price_level is null then 50
      else ((4 - r.price_level)::numeric / 4.0) * 100
    end as cost_score
  from r
  left join ratings rat on rat.restaurant_id = r.id
  left join recency rec on rec.restaurant_id = r.id
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
  from public.dining_events de
  where de.chosen_restaurant_id is not null
    and coalesce(de.status, '') <> 'draft'
    and exists (
      select 1
      from public.dining_event_participants dep
      join parts p on p.user_id = dep.user_id
      where dep.event_id = de.id
    )
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


ALTER FUNCTION "public"."recommendations_for_event"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."saved_restaurants_for_group"("p_group_id" "uuid") RETURNS TABLE("restaurant_id" "uuid", "group_id" "uuid", "saved_at" timestamp with time zone, "saved_by_user_id" "uuid", "name" "text", "address" "text", "primary_type" "text", "types" "text"[], "price_level" integer, "price_currency" "text", "price_range_start" numeric, "price_range_end" numeric, "distance_miles" numeric, "group_avg_overall" numeric, "group_avg_nutrition" numeric, "group_rating_count" integer, "current_user_overall" numeric, "current_user_nutrition" numeric, "current_user_has_rating" boolean, "current_user_rating_state" "text")
    LANGUAGE "sql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."saved_restaurants_for_group"("p_group_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_event_choice"("p_event_id" "uuid", "p_restaurant_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_creator uuid;
  v_group_id uuid;
  v_old_rest uuid;
begin
  select created_by, group_id, chosen_restaurant_id
    into v_creator, v_group_id, v_old_rest
  from public.dining_events
  where id = p_event_id;

  if v_creator is null then
    raise exception 'Event not found';
  end if;

  if v_creator <> auth.uid() then
    raise exception 'Only the event creator can set the choice';
  end if;

  if v_old_rest is not null and v_old_rest <> p_restaurant_id then
    delete from public.restaurant_visits rv
    using public.dining_event_visit_backups b
    where b.event_id = p_event_id
      and b.restaurant_id = v_old_rest
      and b.user_id = rv.user_id
      and rv.restaurant_id = v_old_rest
      and b.prev_last_visited_at is null;

    insert into public.restaurant_visits (restaurant_id, user_id, last_visited_at, updated_at)
    select
      v_old_rest,
      b.user_id,
      b.prev_last_visited_at,
      now()
    from public.dining_event_visit_backups b
    where b.event_id = p_event_id
      and b.restaurant_id = v_old_rest
      and b.prev_last_visited_at is not null
    on conflict (restaurant_id, user_id)
    do update set last_visited_at = excluded.last_visited_at, updated_at = now();

    delete from public.dining_event_visit_backups
    where event_id = p_event_id and restaurant_id = v_old_rest;
  end if;

  insert into public.dining_event_visit_backups (event_id, restaurant_id, user_id, prev_last_visited_at)
  select
    p_event_id,
    p_restaurant_id,
    p.user_id,
    rv.last_visited_at
  from public.dining_event_participants p
  left join public.restaurant_visits rv
    on rv.restaurant_id = p_restaurant_id
   and rv.user_id = p.user_id
  where p.event_id = p_event_id
  on conflict (event_id, restaurant_id, user_id) do nothing;

  insert into public.restaurant_visits (restaurant_id, user_id, last_visited_at, updated_at)
  select p_restaurant_id, p.user_id, now(), now()
  from public.dining_event_participants p
  where p.event_id = p_event_id
  on conflict (restaurant_id, user_id)
  do update set last_visited_at = excluded.last_visited_at, updated_at = now();

  update public.dining_events
  set chosen_restaurant_id = p_restaurant_id,
      chosen_at = now(),
      status = 'completed'
  where id = p_event_id;
end;
$$;


ALTER FUNCTION "public"."set_event_choice"("p_event_id" "uuid", "p_restaurant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_event_participants"("p_event_id" "uuid", "p_user_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_creator uuid;
begin
  select created_by into v_creator
  from public.dining_events
  where id = p_event_id;

  if v_creator is null then
    raise exception 'Event not found';
  end if;

  if v_creator <> auth.uid() then
    raise exception 'Only the event creator can update participants';
  end if;

  -- Clear existing participants
  delete from public.dining_event_participants
  where event_id = p_event_id;

  -- Insert new participants
  insert into public.dining_event_participants (event_id, user_id)
  select p_event_id, unnest(p_user_ids);

end;
$$;


ALTER FUNCTION "public"."set_event_participants"("p_event_id" "uuid", "p_user_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."dining_event_participants" (
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL
);


ALTER TABLE "public"."dining_event_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dining_event_visit_backups" (
    "event_id" "uuid" NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "prev_last_visited_at" timestamp with time zone
);


ALTER TABLE "public"."dining_event_visit_backups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dining_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "event_time" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "chosen_restaurant_id" "uuid",
    "chosen_at" timestamp with time zone,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "dining_events_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'completed'::"text", 'abandoned'::"text"])))
);


ALTER TABLE "public"."dining_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_members" (
    "group_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "group_members_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'member'::"text"])))
);


ALTER TABLE "public"."group_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_restaurants" (
    "group_id" "uuid" NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "added_by_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."group_restaurants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "invite_token" "text",
    "location_label" "text",
    "location_lat" double precision,
    "location_lng" double precision,
    "location_place_id" "text",
    "archived_at" timestamp with time zone,
    "archived_by" "uuid"
);


ALTER TABLE "public"."groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "display_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."restaurant_ratings" (
    "restaurant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "overall" integer,
    "nutrition" integer,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "restaurant_ratings_nutrition_check" CHECK (("nutrition" = ANY (ARRAY[1, 3, 5]))),
    CONSTRAINT "restaurant_ratings_overall_check" CHECK ((("overall" >= 1) AND ("overall" <= 5)))
);


ALTER TABLE "public"."restaurant_ratings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."restaurant_visits" (
    "restaurant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "last_visited_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."restaurant_visits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."restaurants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "google_place_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "address" "text",
    "price_level" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "primary_type" "text",
    "types" "text"[],
    "price_currency" "text",
    "price_range_start" numeric,
    "price_range_end" numeric,
    "lat" double precision,
    "lng" double precision,
    CONSTRAINT "restaurants_price_level_check" CHECK ((("price_level" >= 0) AND ("price_level" <= 4)))
);


ALTER TABLE "public"."restaurants" OWNER TO "postgres";


ALTER TABLE ONLY "public"."dining_event_participants"
    ADD CONSTRAINT "dining_event_participants_pkey" PRIMARY KEY ("event_id", "user_id");



ALTER TABLE ONLY "public"."dining_event_visit_backups"
    ADD CONSTRAINT "dining_event_visit_backups_pkey" PRIMARY KEY ("event_id", "restaurant_id", "user_id");



ALTER TABLE ONLY "public"."dining_events"
    ADD CONSTRAINT "dining_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_pkey" PRIMARY KEY ("group_id", "user_id");



ALTER TABLE ONLY "public"."group_restaurants"
    ADD CONSTRAINT "group_restaurants_pkey" PRIMARY KEY ("group_id", "restaurant_id");



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_invite_token_key" UNIQUE ("invite_token");



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurant_ratings"
    ADD CONSTRAINT "restaurant_ratings_pkey" PRIMARY KEY ("restaurant_id", "user_id");



ALTER TABLE ONLY "public"."restaurant_visits"
    ADD CONSTRAINT "restaurant_visits_pkey" PRIMARY KEY ("restaurant_id", "user_id");



ALTER TABLE ONLY "public"."restaurants"
    ADD CONSTRAINT "restaurants_google_place_id_key" UNIQUE ("google_place_id");



ALTER TABLE ONLY "public"."restaurants"
    ADD CONSTRAINT "restaurants_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_group_members_group_user" ON "public"."group_members" USING "btree" ("group_id", "user_id");



CREATE INDEX "idx_group_restaurants_group_created_at" ON "public"."group_restaurants" USING "btree" ("group_id", "created_at" DESC);



CREATE INDEX "idx_group_restaurants_group_id" ON "public"."group_restaurants" USING "btree" ("group_id");



CREATE INDEX "idx_group_restaurants_restaurant_id" ON "public"."group_restaurants" USING "btree" ("restaurant_id");



CREATE INDEX "idx_groups_location_lat_lng" ON "public"."groups" USING "btree" ("location_lat", "location_lng");



CREATE INDEX "idx_restaurant_ratings_restaurant_user" ON "public"."restaurant_ratings" USING "btree" ("restaurant_id", "user_id");



CREATE UNIQUE INDEX "idx_restaurant_ratings_user_restaurant_unique" ON "public"."restaurant_ratings" USING "btree" ("user_id", "restaurant_id");



CREATE INDEX "idx_restaurants_lat_lng" ON "public"."restaurants" USING "btree" ("lat", "lng");



CREATE OR REPLACE TRIGGER "dining_events_set_updated_at" BEFORE UPDATE ON "public"."dining_events" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."dining_event_participants"
    ADD CONSTRAINT "dining_event_participants_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."dining_events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dining_event_participants"
    ADD CONSTRAINT "dining_event_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dining_event_visit_backups"
    ADD CONSTRAINT "dining_event_visit_backups_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."dining_events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dining_event_visit_backups"
    ADD CONSTRAINT "dining_event_visit_backups_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dining_event_visit_backups"
    ADD CONSTRAINT "dining_event_visit_backups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dining_events"
    ADD CONSTRAINT "dining_events_chosen_restaurant_id_fkey" FOREIGN KEY ("chosen_restaurant_id") REFERENCES "public"."restaurants"("id");



ALTER TABLE ONLY "public"."dining_events"
    ADD CONSTRAINT "dining_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."dining_events"
    ADD CONSTRAINT "dining_events_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_restaurants"
    ADD CONSTRAINT "group_restaurants_added_by_user_id_fkey" FOREIGN KEY ("added_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."group_restaurants"
    ADD CONSTRAINT "group_restaurants_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_restaurants"
    ADD CONSTRAINT "group_restaurants_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restaurant_ratings"
    ADD CONSTRAINT "restaurant_ratings_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restaurant_ratings"
    ADD CONSTRAINT "restaurant_ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restaurant_visits"
    ADD CONSTRAINT "restaurant_visits_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restaurant_visits"
    ADD CONSTRAINT "restaurant_visits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE "public"."dining_event_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dining_event_visit_backups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dining_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "events_insert_group_member" ON "public"."dining_events" FOR INSERT WITH CHECK (("public"."is_group_member"("group_id", "auth"."uid"()) AND ("created_by" = "auth"."uid"())));



CREATE POLICY "events_select_group_member" ON "public"."dining_events" FOR SELECT USING ("public"."is_group_member"("group_id", "auth"."uid"()));



ALTER TABLE "public"."group_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "group_members_delete_owner" ON "public"."group_members" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."groups" "g"
  WHERE (("g"."id" = "group_members"."group_id") AND ("g"."owner_id" = "auth"."uid"())))));



CREATE POLICY "group_members_insert_owner" ON "public"."group_members" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."groups" "g"
  WHERE (("g"."id" = "group_members"."group_id") AND ("g"."owner_id" = "auth"."uid"())))) AND ((("user_id" = "auth"."uid"()) AND ("role" = 'owner'::"text")) OR ("role" = 'member'::"text"))));



CREATE POLICY "group_members_select_member" ON "public"."group_members" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."groups" "g"
  WHERE (("g"."id" = "group_members"."group_id") AND ("g"."owner_id" = "auth"."uid"()))))));



CREATE POLICY "group_members_self_join_member" ON "public"."group_members" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) AND ("role" = 'member'::"text")));



ALTER TABLE "public"."group_restaurants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "group_restaurants_delete_for_group_members" ON "public"."group_restaurants" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."group_members" "gm"
  WHERE (("gm"."group_id" = "group_restaurants"."group_id") AND ("gm"."user_id" = "auth"."uid"())))));



CREATE POLICY "group_restaurants_insert_for_group_members" ON "public"."group_restaurants" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."group_members" "gm"
  WHERE (("gm"."group_id" = "group_restaurants"."group_id") AND ("gm"."user_id" = "auth"."uid"())))));



CREATE POLICY "group_restaurants_select_for_group_members" ON "public"."group_restaurants" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."group_members" "gm"
  WHERE (("gm"."group_id" = "group_restaurants"."group_id") AND ("gm"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."groups" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "groups_insert_authenticated" ON "public"."groups" FOR INSERT WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "groups_select_member" ON "public"."groups" FOR SELECT USING (("public"."is_group_member"("id", "auth"."uid"()) OR ("owner_id" = "auth"."uid"())));



CREATE POLICY "groups_update_owner" ON "public"."groups" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "owner_id")) WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "participants_delete_event_creator" ON "public"."dining_event_participants" FOR DELETE USING ("public"."is_event_creator"("event_id", "auth"."uid"()));



CREATE POLICY "participants_insert_event_creator" ON "public"."dining_event_participants" FOR INSERT WITH CHECK ("public"."is_event_creator"("event_id", "auth"."uid"()));



CREATE POLICY "participants_select_group_member" ON "public"."dining_event_participants" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."dining_events" "e"
  WHERE (("e"."id" = "dining_event_participants"."event_id") AND "public"."is_group_member"("e"."group_id", "auth"."uid"())))));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_insert_own" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "profiles_select_own" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "ratings_delete_own" ON "public"."restaurant_ratings" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "ratings_select_own" ON "public"."restaurant_ratings" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "ratings_update_own" ON "public"."restaurant_ratings" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "ratings_upsert_own" ON "public"."restaurant_ratings" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."restaurant_ratings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."restaurant_visits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."restaurants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "restaurants_insert_auth" ON "public"."restaurants" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "restaurants_select_auth" ON "public"."restaurants" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "visits_select_own" ON "public"."restaurant_visits" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "visits_update_own" ON "public"."restaurant_visits" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "visits_upsert_own" ON "public"."restaurant_visits" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."delete_event"("p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_event"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_event"("p_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."gen_invite_token"() TO "anon";
GRANT ALL ON FUNCTION "public"."gen_invite_token"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."gen_invite_token"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_or_create_draft_event"("p_group_id" "uuid", "p_participants" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_or_create_draft_event"("p_group_id" "uuid", "p_participants" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_draft_event"("p_group_id" "uuid", "p_participants" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."group_by_invite"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."group_by_invite"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."group_by_invite"("p_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."group_invite_summary"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."group_invite_summary"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."group_invite_summary"("p_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."history_for_group"("p_group_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."history_for_group"("p_group_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."history_for_group"("p_group_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."history_for_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."history_for_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."history_for_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_event_creator"("eid" "uuid", "uid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_event_creator"("eid" "uuid", "uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_event_creator"("eid" "uuid", "uid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_group_member"("gid" "uuid", "uid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_group_member"("gid" "uuid", "uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_group_member"("gid" "uuid", "uid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_group_owner"("gid" "uuid", "uid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_group_owner"("gid" "uuid", "uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_group_owner"("gid" "uuid", "uid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."members_for_group"("p_group_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."members_for_group"("p_group_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."members_for_group"("p_group_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."recommendations_for_event"("p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."recommendations_for_event"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."recommendations_for_event"("p_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."saved_restaurants_for_group"("p_group_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."saved_restaurants_for_group"("p_group_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."saved_restaurants_for_group"("p_group_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_event_choice"("p_event_id" "uuid", "p_restaurant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."set_event_choice"("p_event_id" "uuid", "p_restaurant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_event_choice"("p_event_id" "uuid", "p_restaurant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_event_participants"("p_event_id" "uuid", "p_user_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."set_event_participants"("p_event_id" "uuid", "p_user_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_event_participants"("p_event_id" "uuid", "p_user_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."dining_event_participants" TO "anon";
GRANT ALL ON TABLE "public"."dining_event_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."dining_event_participants" TO "service_role";



GRANT ALL ON TABLE "public"."dining_event_visit_backups" TO "service_role";



GRANT ALL ON TABLE "public"."dining_events" TO "anon";
GRANT ALL ON TABLE "public"."dining_events" TO "authenticated";
GRANT ALL ON TABLE "public"."dining_events" TO "service_role";



GRANT ALL ON TABLE "public"."group_members" TO "anon";
GRANT ALL ON TABLE "public"."group_members" TO "authenticated";
GRANT ALL ON TABLE "public"."group_members" TO "service_role";



GRANT ALL ON TABLE "public"."group_restaurants" TO "authenticated";
GRANT ALL ON TABLE "public"."group_restaurants" TO "service_role";



GRANT ALL ON TABLE "public"."groups" TO "anon";
GRANT ALL ON TABLE "public"."groups" TO "authenticated";
GRANT ALL ON TABLE "public"."groups" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."restaurant_ratings" TO "anon";
GRANT ALL ON TABLE "public"."restaurant_ratings" TO "authenticated";
GRANT ALL ON TABLE "public"."restaurant_ratings" TO "service_role";



GRANT ALL ON TABLE "public"."restaurant_visits" TO "anon";
GRANT ALL ON TABLE "public"."restaurant_visits" TO "authenticated";
GRANT ALL ON TABLE "public"."restaurant_visits" TO "service_role";



GRANT ALL ON TABLE "public"."restaurants" TO "anon";
GRANT ALL ON TABLE "public"."restaurants" TO "authenticated";
GRANT ALL ON TABLE "public"."restaurants" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";

revoke delete on table "public"."dining_event_visit_backups" from "anon";

revoke insert on table "public"."dining_event_visit_backups" from "anon";

revoke references on table "public"."dining_event_visit_backups" from "anon";

revoke select on table "public"."dining_event_visit_backups" from "anon";

revoke trigger on table "public"."dining_event_visit_backups" from "anon";

revoke truncate on table "public"."dining_event_visit_backups" from "anon";

revoke update on table "public"."dining_event_visit_backups" from "anon";

revoke delete on table "public"."dining_event_visit_backups" from "authenticated";

revoke insert on table "public"."dining_event_visit_backups" from "authenticated";

revoke references on table "public"."dining_event_visit_backups" from "authenticated";

revoke select on table "public"."dining_event_visit_backups" from "authenticated";

revoke trigger on table "public"."dining_event_visit_backups" from "authenticated";

revoke truncate on table "public"."dining_event_visit_backups" from "authenticated";

revoke update on table "public"."dining_event_visit_backups" from "authenticated";

revoke delete on table "public"."group_restaurants" from "anon";

revoke insert on table "public"."group_restaurants" from "anon";

revoke references on table "public"."group_restaurants" from "anon";

revoke select on table "public"."group_restaurants" from "anon";

revoke trigger on table "public"."group_restaurants" from "anon";

revoke truncate on table "public"."group_restaurants" from "anon";

revoke update on table "public"."group_restaurants" from "anon";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


