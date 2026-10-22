
CREATE OR REPLACE FUNCTION public.sync_auth_email_to_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public."User"
    SET email = NEW.email
    WHERE supabase_id = NEW.id::text;
  END IF;

  RETURN NEW;
END;
$$;

-- auth.users hanya tersedia di database Supabase asli,
-- bukan di shadow database Prisma.
DO $migration$
BEGIN
  IF to_regclass('auth.users') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgname = 'on_auth_email_updated'
        AND tgrelid = to_regclass('auth.users')
        AND NOT tgisinternal
    ) THEN
      EXECUTE '
        CREATE TRIGGER on_auth_email_updated
        AFTER UPDATE OF email ON auth.users
        FOR EACH ROW
        WHEN (OLD.email IS DISTINCT FROM NEW.email)
        EXECUTE FUNCTION public.sync_auth_email_to_user()
      ';
    END IF;
  END IF;
END;
$migration$;
