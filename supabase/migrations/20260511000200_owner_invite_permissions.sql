ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS can_create_groups boolean NOT NULL DEFAULT false;

UPDATE public.profiles p
SET can_create_groups = true
WHERE EXISTS (
  SELECT 1
  FROM public.groups g
  WHERE g.owner_id = p.id
);

CREATE OR REPLACE FUNCTION public.gen_owner_invite_token()
RETURNS text
LANGUAGE sql
AS $$
  SELECT rtrim(
    replace(replace(encode(extensions.gen_random_bytes(32), 'base64'), '+', '-'), '/', '_'),
    '='
  );
$$;

CREATE TABLE IF NOT EXISTS public.owner_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL DEFAULT public.gen_owner_invite_token(),
  email text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  redeemed_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  redeemed_at timestamptz NULL,
  expires_at timestamptz NULL,
  CONSTRAINT owner_invites_status_check CHECK (status IN ('pending', 'redeemed', 'revoked')),
  CONSTRAINT owner_invites_email_not_blank CHECK (length(trim(email)) > 0)
);

ALTER TABLE public.owner_invites ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS owner_invites_lower_email_idx
ON public.owner_invites(lower(email));

DROP POLICY IF EXISTS "groups_insert_authenticated" ON public.groups;
DROP POLICY IF EXISTS "groups_insert_can_create_groups" ON public.groups;

CREATE POLICY "groups_insert_can_create_groups"
ON public.groups
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = owner_id
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.can_create_groups IS TRUE
  )
);

CREATE OR REPLACE FUNCTION public.redeem_owner_invite(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_user_email text;
  v_invite public.owner_invites%ROWTYPE;
  v_display_name text;
BEGIN
  v_user_id := auth.uid();
  v_user_email := nullif(trim(auth.jwt() ->> 'email'), '');

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  IF p_token IS NULL OR length(trim(p_token)) = 0 THEN
    RAISE EXCEPTION 'Invalid owner invite token';
  END IF;

  SELECT *
    INTO v_invite
  FROM public.owner_invites
  WHERE token = trim(p_token)
  FOR UPDATE;

  IF v_invite.id IS NULL THEN
    RAISE EXCEPTION 'Invalid owner invite token';
  END IF;

  IF v_invite.status = 'redeemed' THEN
    RAISE EXCEPTION 'Owner invite has already been redeemed';
  END IF;

  IF v_invite.status = 'revoked' THEN
    RAISE EXCEPTION 'Owner invite has been revoked';
  END IF;

  IF v_invite.status <> 'pending' THEN
    RAISE EXCEPTION 'Owner invite is not pending';
  END IF;

  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at <= now() THEN
    RAISE EXCEPTION 'Owner invite has expired';
  END IF;

  IF v_user_email IS NULL OR lower(v_user_email) <> lower(trim(v_invite.email)) THEN
    RAISE EXCEPTION 'Owner invite is for a different email address';
  END IF;

  v_display_name := COALESCE(
    NULLIF(trim(auth.jwt() -> 'user_metadata' ->> 'display_name'), ''),
    NULLIF(trim(auth.jwt() -> 'user_metadata' ->> 'name'), ''),
    v_user_email
  );

  INSERT INTO public.profiles (id, display_name, can_create_groups)
  VALUES (v_user_id, v_display_name, true)
  ON CONFLICT (id) DO UPDATE
  SET
    can_create_groups = true,
    display_name = COALESCE(
      NULLIF(trim(public.profiles.display_name), ''),
      excluded.display_name
    );

  UPDATE public.owner_invites
  SET
    status = 'redeemed',
    redeemed_by = v_user_id,
    redeemed_at = now()
  WHERE id = v_invite.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_owner_invite(text) TO authenticated;
