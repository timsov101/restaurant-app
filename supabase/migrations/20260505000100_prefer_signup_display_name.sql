CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  preferred_display_name text;
BEGIN
  preferred_display_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    new.email
  );

  INSERT INTO public.profiles (id, display_name)
  VALUES (new.id, preferred_display_name)
  ON CONFLICT (id) DO UPDATE
  SET display_name = excluded.display_name
  WHERE
    public.profiles.display_name IS NULL
    OR nullif(trim(public.profiles.display_name), '') IS NULL
    OR public.profiles.display_name = new.email;

  RETURN new;
END;
$$;
