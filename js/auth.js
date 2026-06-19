import { db, CURRENT_ORG_ID } from './config.js';
import { getToday } from './date.js';
import { currentUser, profile, demoMode, setCurrentUser, setProfile, setDemoMode, gamesData } from './state.js';
import { updateProfile } from './profile.js';
import { loadCommunityData } from './community.js';
import { loadGames } from './games/loader.js';
import { showScreen, showMain } from './nav.js';
import { subscribeToPush } from './push.js';

export async function signInWithGoogle() {
  try { localStorage.setItem('hoop_rgpd', '1'); } catch(e) {}
  const { error } = await db.auth.signInWithOAuth({
    provider: 'google', options: {
      redirectTo: window.location.origin + '/',
      queryParams: { prompt: 'select_account' }
    }
  });
  if (error) document.getElementById('auth-error').classList.add('show');
}

export async function loadOrCreateProfile() {
  const { data } = await db.from('users').select('*').eq('id', currentUser.id).single();
  if (data) {
    setProfile(data);
    // Persiste le consentement RGPD en DB si localStorage l'a mais pas encore la DB
    if (!data.rgpd_consent) {
      try {
        const localConsent = localStorage.getItem('hoop_rgpd') === '1';
        if (localConsent) await db.rpc('set_rgpd_consent');
      } catch(e) {}
    }
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
  const today = getToday();
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
    last_play: getToday(),
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
  const input = document.getElementById('delete-confirm-input');
  if (input) input.value = '';
  const btn = document.getElementById('delete-account-confirm-btn');
  if (btn) { btn.disabled = true; btn.style.opacity = '.4'; btn.style.cursor = 'not-allowed'; }
  document.getElementById('delete-modal').classList.add('show');
}

export async function deleteAccount() {
  const input = document.getElementById('delete-confirm-input');
  if (!input || input.value.trim().toUpperCase() !== 'SUPPRIMER') return;
  try {
    await db.from('pouls_votes').delete().eq('user_id', currentUser.id).eq('org_id', CURRENT_ORG_ID);
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
