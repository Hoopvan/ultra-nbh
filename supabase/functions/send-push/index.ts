import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push';

const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT     = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:hoopvan.vw@gmail.com';
const PUSH_SECRET       = Deno.env.get('PUSH_SECRET')!;
const SERVICE_ROLE_KEY  = Deno.env.get('SB_SERVICE_ROLE_KEY')!;
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!;

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

Deno.serve(async (req) => {
  const auth = req.headers.get('Authorization') ?? '';
  if (auth !== `Bearer ${PUSH_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { title, body, url } = await req.json() as {
    title: string; body: string; url?: string;
  };

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: subs, error: dbError } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth');

  if (dbError) {
    return new Response(JSON.stringify({ error: dbError.message, code: dbError.code }), { status: 500 });
  }

  if (!subs?.length) {
    return new Response(JSON.stringify({ sent: 0, failed: 0, note: 'no subscriptions' }), { status: 200 });
  }

  const payload = JSON.stringify({ title, body, url: url ?? '/' });

  const results = await Promise.allSettled(
    subs.map(s =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload
      )
    )
  );

  // Supprimer les abonnements expirés (410 Gone)
  const expired = subs.filter((_, i) => {
    const r = results[i];
    return r.status === 'rejected' && (r.reason as { statusCode?: number }).statusCode === 410;
  });
  if (expired.length) {
    await supabase.from('push_subscriptions')
      .delete()
      .in('endpoint', expired.map(s => s.endpoint));
  }

  const sent   = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  return new Response(JSON.stringify({ sent, failed }), { status: 200 });
});
