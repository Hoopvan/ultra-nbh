import { db } from './config.js';
import { demoMode, profile, setProfile } from './state.js';
import { buildAvatarSVG } from './avatar.js';
import { showScreen, showMain } from './nav.js';

let newName = '';
let newSil = 'A';
let newSkin = 'skin1';
let newHair = 'hair1';

export function goToAvatarCreate() {
  const name = document.getElementById('name-input').value.trim();
  if (!name) { document.getElementById('name-input').focus(); return; }
  newName = name;
  showScreen('create-avatar');
  updateCreatePreview();
}

export function setSil(v) {
  newSil = v;
  ['A','B'].forEach(s => document.getElementById('sil-'+s).classList.toggle('sel', s===v));
  updateCreatePreview();
}

export function setSkin(v) {
  newSkin = v;
  ['skin1','skin2','skin3','skin4'].forEach(s => document.getElementById('skin-'+s).classList.toggle('sel', s===v));
  updateCreatePreview();
}

export function setHair(v) {
  newHair = v;
  ['hair1','hair2','hair3','hair4'].forEach(h => document.getElementById('hair-'+h).classList.toggle('sel', h===v));
  updateCreatePreview();
}

function updateCreatePreview() {
  const el = document.getElementById('create-preview');
  if (el) el.innerHTML = buildAvatarSVG(false, false, false, newSil, newSkin, newHair);
}

export async function submitProfile() {
  if (demoMode) {
    setProfile({ ...profile, name: newName, avatar_silhouette: newSil, avatar_skin: newSkin, avatar_hair: newHair });
    showMain(); return;
  }
  const { data, error } = await db.rpc('create_profile', {
    p_name: newName, p_silhouette: newSil, p_skin: newSkin, p_hair: newHair
  });
  if (data) { setProfile(data); showMain(); }
  else console.error('Insert error:', error);
}
