import { db, CURRENT_ORG_ID } from './config.js';
import {
  AVATAR_SKINS, AVATAR_TOPS, AVATAR_HAIR_COLORS,
  AVATAR_EYES, AVATAR_MOUTHS, AVATAR_FACIAL_HAIRS, AVATAR_CLOTHES
} from './config.js';
import { demoMode, profile, setProfile } from './state.js';
import { buildAvatarSVG } from './avatar.js';
import { showScreen, showMain } from './nav.js';

let newName = '';
let newParams = {
  skin: 'light', top: 'shortFlat', hairColor: 'brown',
  eyes: 'default', mouth: 'smile', facialHair: '', clothe: 'shirtCrewNeck',
};

export function goToAvatarCreate() {
  const name = document.getElementById('name-input').value.trim();
  if (!name) { document.getElementById('name-input').focus(); return; }
  newName = name;
  showScreen('create-avatar');
  initCreatePickers();
  updateCreatePreview();
}

function initCreatePickers() {
  const g = id => document.getElementById(id);
  g('create-skin-grid').innerHTML = AVATAR_SKINS.map(s =>
    `<button class="skin-btn${s.id === newParams.skin ? ' sel' : ''}" data-param="skin" data-value="${s.id}" style="background:${s.color}"></button>`
  ).join('');
  g('create-top-grid').innerHTML = AVATAR_TOPS.map(t =>
    `<button class="opt-btn${t.id === newParams.top ? ' sel' : ''}" data-param="top" data-value="${t.id}">${t.label}</button>`
  ).join('');
  g('create-haircolor-grid').innerHTML = AVATAR_HAIR_COLORS.map(c =>
    `<button class="hair-color-btn${c.id === newParams.hairColor ? ' sel' : ''}" data-param="hairColor" data-value="${c.id}" style="background:${c.color}" title="${c.label}"></button>`
  ).join('');
  g('create-eyes-grid').innerHTML = AVATAR_EYES.map(e =>
    `<button class="opt-btn${e.id === newParams.eyes ? ' sel' : ''}" data-param="eyes" data-value="${e.id}">${e.label}</button>`
  ).join('');
  g('create-mouth-grid').innerHTML = AVATAR_MOUTHS.map(m =>
    `<button class="opt-btn${m.id === newParams.mouth ? ' sel' : ''}" data-param="mouth" data-value="${m.id}">${m.label}</button>`
  ).join('');
  g('create-facialhair-grid').innerHTML = AVATAR_FACIAL_HAIRS.map(f =>
    `<button class="opt-btn${f.id === newParams.facialHair ? ' sel' : ''}" data-param="facialHair" data-value="${f.id}">${f.label}</button>`
  ).join('');
  g('create-clothe-grid').innerHTML = AVATAR_CLOTHES.map(c =>
    `<button class="opt-btn${c.id === newParams.clothe ? ' sel' : ''}" data-param="clothe" data-value="${c.id}">${c.label}</button>`
  ).join('');
}

export function setCreateParam(key, value) {
  newParams[key] = value;
  document.querySelectorAll(`#create-av-scroll [data-param="${key}"]`)
    .forEach(b => b.classList.toggle('sel', b.dataset.value === value));
  updateCreatePreview();
}

async function updateCreatePreview() {
  const el = document.getElementById('create-preview');
  if (!el) return;
  el.innerHTML = await buildAvatarSVG({
    name: newName || 'preview',
    avatar_skin:        newParams.skin,
    avatar_top:         newParams.top,
    avatar_hair_color:  newParams.hairColor,
    avatar_eyes:        newParams.eyes,
    avatar_mouth:       newParams.mouth,
    avatar_facial_hair: newParams.facialHair,
    avatar_clothe:      newParams.clothe,
    worn_items: [],
  }, 130);
}

export async function submitProfile() {
  if (demoMode) {
    setProfile({
      ...profile,
      name:               newName,
      avatar_skin:        newParams.skin,
      avatar_top:         newParams.top,
      avatar_hair_color:  newParams.hairColor,
      avatar_eyes:        newParams.eyes,
      avatar_mouth:       newParams.mouth,
      avatar_facial_hair: newParams.facialHair,
      avatar_clothe:      newParams.clothe,
    });
    showMain(); return;
  }
  const { data, error } = await db.rpc('create_profile', {
    p_name:        newName,
    p_skin:        newParams.skin,
    p_top:         newParams.top,
    p_hair_color:  newParams.hairColor,
    p_eyes:        newParams.eyes,
    p_mouth:       newParams.mouth,
    p_facial_hair: newParams.facialHair,
    p_clothe:      newParams.clothe,
    p_org_id:      CURRENT_ORG_ID,
  });
  if (data) { setProfile(data); showMain(); }
  else console.error('create_profile error:', error);
}
