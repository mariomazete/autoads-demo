select cron.schedule(
  'autoads-sync-campaign-metrics',
  '*/30 * * * *',
  $$select net.http_post(
    url := 'https://your-project-ref.supabase.co/functions/v1/meta-sync-campaign-metrics-v1',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-autoads-cron-secret', (select secret from public.autoads_cron_config where id = true)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );$$
);
