import { db } from './config.js';
import { currentUser, profile, demoMode, setProfile } from './state.js';

export async function updateProfile(fields) {
  if (demoMode) { setProfile({...profile, ...fields}); return; }
  const { data } = await db.from('users').update(fields).eq('id', currentUser.id).select().single();
  if (data) setProfile(data);
}
