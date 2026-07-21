import { db } from './config.js';
import { currentUser, profile, demoMode, setProfile } from './state.js';

const BIO_MAX = 100;

export async function updateProfile(fields) {
  if (demoMode) { setProfile({...profile, ...fields}); return; }
  const { data } = await db.from('users').update(fields).eq('id', currentUser.id).select().single();
  if (data) setProfile(data);
}

export function renderBio() {
  const display = document.getElementById('profile-bio-display');
  if (!display) return;
  const bio = profile?.bio;
  display.textContent = bio || 'Ajoute une petite bio';
  display.classList.toggle('profile-bio-empty', !bio);
}

export function openBioEdit() {
  const display = document.getElementById('profile-bio-display');
  const editWrap = document.getElementById('profile-bio-edit');
  const input = document.getElementById('profile-bio-input');
  if (!display || !editWrap || !input) return;
  input.value = profile?.bio || '';
  display.style.display = 'none';
  editWrap.style.display = 'block';
  input.focus();
  updateBioCount();
}

export function updateBioCount() {
  const input = document.getElementById('profile-bio-input');
  const count = document.getElementById('profile-bio-count');
  if (input && count) count.textContent = `${input.value.length}/${BIO_MAX}`;
}

export async function saveBio() {
  const display = document.getElementById('profile-bio-display');
  const editWrap = document.getElementById('profile-bio-edit');
  const input = document.getElementById('profile-bio-input');
  if (!input) return;
  const bio = input.value.trim().slice(0, BIO_MAX);
  await updateProfile({ bio });
  renderBio();
  if (display) display.style.display = '';
  if (editWrap) editWrap.style.display = 'none';
}
