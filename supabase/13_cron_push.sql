-- 13_cron_push.sql
-- Configure les tâches cron pour les push notifications.
-- Prérequis : extensions pg_cron et pg_net activées dans le dashboard Supabase.
--
-- ÉTAPE 0 (à faire UNE FOIS dans le SQL Editor, séparément) :
--   SELECT vault.create_secret('<TON_PUSH_SECRET>', 'push_secret');
--   Le secret est stocké dans Supabase Vault, jamais dans le code.
--
-- Ensuite exécuter ce fichier dans Supabase Dashboard > SQL Editor.

-- ── Fonctions d'envoi ────────────────────────────────────────────────────────

-- Envoie un rappel missions quotidien
CREATE OR REPLACE FUNCTION public.cron_daily_push()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name = 'push_secret' LIMIT 1;
  IF v_secret IS NULL THEN RETURN; END IF;
  PERFORM net.http_post(
    url     := 'https://adkephbplykqdejhpted.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_secret,
      'Content-Type',  'application/json'
    ),
    body    := '{"title":"🎯 Hoop NBH","body":"Tes missions du jour t''attendent !","url":"/"}'::jsonb
  );
END;
$$;

-- Envoie une notif pré-match si un pronostic est actif aujourd'hui
CREATE OR REPLACE FUNCTION public.cron_match_push()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret text;
  v_match  text;
BEGIN
  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name = 'push_secret' LIMIT 1;
  IF v_secret IS NULL THEN RETURN; END IF;

  SELECT content->>'match'
    INTO v_match
    FROM public.games
   WHERE type   = 'pronostic'
     AND date   = CURRENT_DATE
     AND active = true
   LIMIT 1;

  IF v_match IS NULL THEN RETURN; END IF;

  PERFORM net.http_post(
    url     := 'https://adkephbplykqdejhpted.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_secret,
      'Content-Type',  'application/json'
    ),
    body    := jsonb_build_object(
      'title', '🏀 Match ce soir !',
      'body',  v_match || ' — fais ton pronostic !',
      'url',   '/'
    )
  );
END;
$$;

-- ── Cron jobs ────────────────────────────────────────────────────────────────

-- Rappel missions tous les jours à 8h UTC (9h Paris heure d'hiver, 10h été)
SELECT cron.schedule(
  'daily-missions-push',
  '0 8 * * *',
  'SELECT public.cron_daily_push()'
);

-- Notif pré-match tous les jours à 16h UTC (18h Paris) si match ce soir
SELECT cron.schedule(
  'daily-match-push',
  '0 16 * * *',
  'SELECT public.cron_match_push()'
);
