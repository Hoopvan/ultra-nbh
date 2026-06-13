import { db } from './config.js';
import { currentUser, profile, demoMode, setCurrentUser, setProfile, setDemoMode, gamesData } from './state.js';
import { updateProfile } from './profile.js';
import { loadCommunityData } from './community.js';
import { loadGames } from './games/loader.js';
import { showScreen, showMain } from './nav.js';
import { subscribeToPush } from './push.js';

export async function signInWithGoogle() {
  const { error } = await db.auth.signInWithOAuth({
    provider: 'google', options: {
      redirectTo: window.location.href,
      queryParams: { prompt: 'select_account' }
    }
  });
  if (error) document.getElementById('auth-error').classList.add('show');
}

export async function loadOrCreateProfile() {
  const { data } = await db.from('users').select('*').eq('id', currentUser.id).single();
  if (data) {
    setProfile(data);
    await checkStreak();
    await loadGames();
    await loadCommunityData();
    showMain();
  } else {
    showScreen('name');
  }
}

export async function checkStreak() {
  if (!profile) return;
  const today = new Date().toISOString().split('T')[0];
  if (profile.last_play === today) return;
  if (demoMode) {
    const diff = Math.floor((new Date(today) - new Date(profile.last_play)) / 86400000);
    if (diff === 1) setProfile({ ...profile, streak: profile.streak + 1, last_play: today });
    else if (diff > 1) setProfile({ ...profile, streak: 1, last_play: today });
    return;
  }
  const { data, error } = await db.rpc('update_streak');
  if (!error && data) setProfile(data);
  else if (error) console.error('update_streak error:', error);
}

export function startDemoMode() {
  setCurrentUser({ id: 'demo-user-local' });
  setProfile({
    id: 'demo-user-local',
    name: 'Fan Demo',
    xp: 150,
    coins: 1000,
    interactions: 8,
    streak: 3,
    last_play: new Date().toISOString().split('T')[0],
    active_items: ['couleurs', 'echarpe'],
    worn_items: ['couleurs', 'echarpe'],
    avatar_skin:        'tanned',
    avatar_top:         'shortFlat',
    avatar_hair_color:  'brown',
    avatar_eyes:        'default',
    avatar_mouth:       'smile',
    avatar_facial_hair: '',
    avatar_clothe:      'shirtCrewNeck',
    pouls_date: null,
    vestiaire_date: null
  });
  setDemoMode(true);
  loadGames().then(() => {
    loadCommunityData();
    showMain();
  });
}

export async function signOut() {
  await db.auth.signOut();
  setCurrentUser(null);
  setProfile(null);
  document.getElementById('navbar').style.display = 'none';
  showScreen('onboarding');
}

export function confirmDeleteAccount() {
  document.getElementById('delete-modal').classList.add('show');
}

export async function deleteAccount() {
  try {
    await db.from('pouls_votes').delete().eq('user_id', currentUser.id);
    await db.from('users').delete().eq('id', currentUser.id);
    await db.rpc('delete_user');
    await db.auth.signOut();
    setCurrentUser(null);
    setProfile(null);
    document.getElementById('delete-modal').classList.remove('show');
    document.getElementById('navbar').style.display = 'none';
    showScreen('onboarding');
  } catch(e) {
    console.error('Delete error:', e);
  }
}

export function initAuth() {
  db.auth.getSession().then(({ data: { session } }) => {
    if (session) { setCurrentUser(session.user); loadOrCreateProfile(); }
    else showScreen('onboarding');
  });
  db.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) { setCurrentUser(session.user); await loadOrCreateProfile(); }
  });
}
