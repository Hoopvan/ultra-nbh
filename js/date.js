import { db } from './config.js';

let _serverDate = null;

export async function initServerDate() {
  try {
    const { data } = await db.rpc('get_server_date');
    if (data) _serverDate = data;
  } catch(e) {
    // fallback sur date locale si RPC indisponible
  }
}

export function getToday() {
  return _serverDate || new Date().toISOString().split('T')[0];
}
