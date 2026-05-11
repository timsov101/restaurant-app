CREATE OR REPLACE FUNCTION public.delete_event(p_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_creator uuid;
  v_group_id uuid;
  v_group_owner uuid;
BEGIN
  SELECT de.created_by, de.group_id, g.owner_id
    INTO v_creator, v_group_id, v_group_owner
  FROM public.dining_events de
  JOIN public.groups g
    ON g.id = de.group_id
  WHERE de.id = p_event_id;

  IF v_creator IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  IF auth.uid() IS NULL OR (auth.uid() <> v_creator AND auth.uid() <> v_group_owner) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  DELETE FROM public.dining_events
  WHERE id = p_event_id;
END;
$$;

DROP FUNCTION IF EXISTS public.history_for_group(uuid);

CREATE OR REPLACE FUNCTION public.history_for_group(p_group_id uuid)
RETURNS TABLE(
  event_id uuid,
  chosen_at timestamp with time zone,
  group_id uuid,
  group_name text,
  created_by uuid,
  restaurant_id uuid,
  restaurant_name text,
  restaurant_address text,
  cuisine text,
  diners text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    de.id AS event_id,
    de.chosen_at,
    g.id AS group_id,
    g.name AS group_name,
    de.created_by,
    r.id AS restaurant_id,
    r.name AS restaurant_name,
    r.address AS restaurant_address,
    r.primary_type AS cuisine,
    COALESCE(
      string_agg(DISTINCT p.display_name, ', ' ORDER BY p.display_name),
      ''
    ) AS diners
  FROM public.dining_events de
  JOIN public.groups g
    ON g.id = de.group_id
  JOIN public.restaurants r
    ON r.id = de.chosen_restaurant_id
  LEFT JOIN public.dining_event_participants dep
    ON dep.event_id = de.id
  LEFT JOIN public.profiles p
    ON p.id = dep.user_id
  WHERE de.group_id = p_group_id
    AND de.chosen_restaurant_id IS NOT NULL
    AND COALESCE(de.status, '') <> 'draft'
  GROUP BY
    de.id,
    de.chosen_at,
    g.id,
    g.name,
    de.created_by,
    r.id,
    r.name,
    r.address,
    r.primary_type
  ORDER BY de.chosen_at DESC NULLS LAST;
$$;

GRANT ALL ON FUNCTION public.history_for_group(uuid) TO anon;
GRANT ALL ON FUNCTION public.history_for_group(uuid) TO authenticated;
GRANT ALL ON FUNCTION public.history_for_group(uuid) TO service_role;

DROP POLICY IF EXISTS "events_delete_creator_or_group_owner" ON public.dining_events;

CREATE POLICY "events_delete_creator_or_group_owner"
ON public.dining_events
FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.groups g
    WHERE g.id = dining_events.group_id
      AND g.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "participants_delete_event_creator" ON public.dining_event_participants;
DROP POLICY IF EXISTS "participants_delete_event_creator_or_group_owner" ON public.dining_event_participants;

CREATE POLICY "participants_delete_event_creator_or_group_owner"
ON public.dining_event_participants
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.dining_events de
    JOIN public.groups g
      ON g.id = de.group_id
    WHERE de.id = dining_event_participants.event_id
      AND (de.created_by = auth.uid() OR g.owner_id = auth.uid())
  )
);
