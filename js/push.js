import { db } from './config.js';
import { demoMode, currentUser } from './state.js';

const VAPID_PUBLIC_KEY = '{{VAPID_PUBLIC_KEY}}';

function urlBase64ToUint8Array(base64) {
  const pad = '='.repeat((4 - base64.length % 4) % 4);
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

export async function subscribeToPush() {
  if (demoMode) return;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return;

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
  }

  const { endpoint, keys: { p256dh, auth } } = sub.toJSON();
  await db.rpc('save_push_subscription', { p_endpoint: endpoint, p_p256dh: p256dh, p_auth: auth });
}

export async function unsubscribeFromPush() {
  if (demoMode) return;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await db.from('push_subscriptions').delete().eq('user_id', currentUser.id);
    await sub.unsubscribe();
  }
}

export async function isPushSubscribed() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return !!sub && Notification.permission === 'granted';
}
