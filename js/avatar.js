import {
  UNLOCKABLES, AVATAR_SKINS, AVATAR_TOPS, AVATAR_HAIR_COLORS,
  AVATAR_EYES, AVATAR_MOUTHS, AVATAR_FACIAL_HAIRS, AVATAR_CLOTHES, db
} from './config.js';

const DICEBEAR_API = 'https://api.dicebear.com/8.x/avataaars/svg';
const FALLBACK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 280"><circle cx="140" cy="140" r="140" fill="#1a1a2e"/><text x="140" y="185" text-anchor="middle" font-size="110">🏀</text></svg>`;
const HAIR_HEX = { brown:'5a3a1a', black:'1a1a1a', blonde:'d4a843', red:'b5330a', silverGray:'aaaaaa' };
const SKIN_HEX = { light:'edb98a', tanned:'fd9841', brown:'d08b5b', darkBrown:'ae5d29' };
const CLOTHE_HEX = { gray01:'e6e6e6', blue03:'25557c' };
import { profile, demoMode, setProfile } from './state.js';
import { updateProfile } from './profile.js';
import { showNotif } from './utils.js';

// ── Overlays SVG NBH — coordonnées calées sur le SVG DiceBear avataaars v8
// Structure : viewBox 0 0 280 280, avatar dans <g transform="translate(8)">
// Face : centre x=140 y=92 r=56 | yeux y≈112 | sourcils y≈102 | col y≈185

const OVERLAY_ECHARPE = `
<g opacity="0.95">
  <rect x="100" y="178" width="80" height="24" rx="12" fill="#e8192c"/>
  <rect x="100" y="187" width="80" height="4" fill="white" opacity="0.35"/>
  <rect x="104" y="198" width="22" height="52" rx="9" fill="#e8192c"/>
  <rect x="154" y="198" width="22" height="40" rx="9" fill="#e8192c"/>
  <rect x="104" y="216" width="22" height="4" fill="white" opacity="0.3"/>
  <text x="140" y="193" text-anchor="middle" font-family="Barlow Condensed,sans-serif" font-weight="700" font-size="9" fill="white" letter-spacing="1">HERMINE</text>
</g>`;

const OVERLAY_CASQUETTE = `
<g opacity="0.97">
  <path d="M78,82 Q72,28 140,8 Q208,28 202,82 Z" fill="#0d1b3e"/>
  <rect x="72" y="80" width="136" height="7" rx="3" fill="#0b1e42"/>
  <path d="M72,87 L208,87 Q222,95 212,106 L72,106 Z" fill="#0b1e42"/>
  <circle cx="140" cy="10" r="4" fill="#1a3060"/>
  <text x="140" y="64" text-anchor="middle" font-family="Barlow Condensed,sans-serif" font-weight="800" font-size="16" fill="#e8192c">NBH</text>
</g>`;

const OVERLAY_BANDEAU = `
<g opacity="0.95">
  <rect x="84" y="70" width="112" height="17" rx="8.5" fill="#e8192c"/>
  <rect x="84" y="77" width="112" height="3" fill="white" opacity="0.25"/>
</g>`;

const OVERLAY_MAILLOT = `
<text x="140" y="268" text-anchor="middle" font-family="Barlow Condensed,sans-serif" font-weight="800" font-size="24" fill="white" opacity="0.85">NBH</text>`;

// ── Génération avatar via API HTTP DiceBear ───────────────────────────────────

async function fetchDicebear(p, size) {
  const worn = p?.worn_items || [];
  const hasCouleurs = worn.includes('couleurs');
  const hasLunettes = worn.includes('lunettes');
  const hasMaillot  = worn.includes('maillot');

  const params = new URLSearchParams({
    seed:      String(p?.id || p?.name || 'default'),
    skinColor: SKIN_HEX[p?.avatar_skin] || SKIN_HEX.light,
    top:       p?.avatar_top        || 'shortHairShortFlat',
    hairColor: HAIR_HEX[p?.avatar_hair_color] || HAIR_HEX.brown,
    eyes:      p?.avatar_eyes       || 'default',
    mouth:     p?.avatar_mouth      || 'smile',
    clothing:    p?.avatar_clothe     || 'shirtCrewNeck',
    clothesColor: (hasCouleurs || hasMaillot) ? CLOTHE_HEX.blue03 : CLOTHE_HEX.gray01,
    facialHairProbability: p?.avatar_facial_hair ? '100' : '0',
    accessoriesProbability: hasLunettes ? '100' : '0',
    size: String(size),
  });
  if (p?.avatar_facial_hair) {
    params.set('facialHair', p.avatar_facial_hair);
    params.set('facialHairColor', HAIR_HEX[p?.avatar_hair_color] || HAIR_HEX.brown);
  }
  if (hasLunettes) params.set('accessories', 'sunglasses');

  const res = await fetch(`${DICEBEAR_API}?${params}`);
  if (!res.ok) throw new Error('dicebear');
  return res.text();
}

function applyOverlays(svg, worn) {
  const overlays = [];
  if (worn.includes('bandeau'))   overlays.push(OVERLAY_BANDEAU);
  if (worn.includes('echarpe'))   overlays.push(OVERLAY_ECHARPE);
  if (worn.includes('casquette')) overlays.push(OVERLAY_CASQUETTE);
  if (worn.includes('maillot'))   overlays.push(OVERLAY_MAILLOT);
  return overlays.length ? svg.replace('</svg>', overlays.join('') + '</svg>') : svg;
}

export async function buildAvatarSVG(p, size = 280) {
  const key = _mainCacheKey(p);
  if (_mainCache[key]) return _mainCache[key];
  const worn = p?.worn_items || [];
  try {
    const svg = applyOverlays(await fetchDicebear(p, size), worn);
    _mainCache[key] = svg;
    return svg;
  } catch { return FALLBACK_SVG; }
}

const _miniCache = {};
const _mainCache = {};

function _mainCacheKey(p) {
  const worn = (p?.worn_items || []).slice().sort().join(',');
  return [p?.id, p?.avatar_skin, p?.avatar_top, p?.avatar_hair_color,
          p?.avatar_eyes, p?.avatar_mouth, p?.avatar_facial_hair,
          p?.avatar_clothe, worn].join('|');
}

export function invalidateAvatarCache(p) {
  delete _mainCache[_mainCacheKey(p)];
  if (p?.id) delete _miniCache[p.id];
}

export async function miniAvatarSVG(p) {
  const key = p?.id;
  if (key && _miniCache[key]) return _miniCache[key];
  try {
    const svg = applyOverlays(await fetchDicebear(p, 52), p?.worn_items || []);
    if (key) _miniCache[key] = svg;
    return svg;
  } catch { return FALLBACK_SVG; }
}

export async function renderAvatar() {
  const wrap = document.getElementById('avatar-svg');
  if (wrap) wrap.innerHTML = await buildAvatarSVG(profile);
}

// ── Boutique / équipements ────────────────────────────────────────────────────

export function renderEquip() {
  const grid = document.getElementById('equip-grid');
  if (!grid) return;
  const owned  = profile?.active_items || [];
  const worn   = profile?.worn_items   || [];
  const coins  = profile?.coins        || 0;

  grid.innerHTML = UNLOCKABLES.map(u => {
    const isOwned = owned.includes(u.id);
    const isWorn  = worn.includes(u.id);
    const canAfford = coins >= u.cost;
    if (isOwned) {
      return `<div class="equip-item unlocked ${isWorn ? 'active-eq' : ''}" data-toggle-item="${u.id}">
        <div class="equip-icon">${u.icon}</div>
        <div class="equip-name">${u.name}</div>
        <div style="font-size:9px;color:${isWorn ? 'var(--red)' : 'var(--white-muted)'};margin-top:2px">${isWorn ? '✓ Porté' : 'Tap pour porter'}</div>
      </div>`;
    }
    return `<div class="equip-item locked-eq" ${canAfford ? `data-buy-item="${u.id}"` : ''}
      style="${canAfford ? 'cursor:pointer;opacity:1;border-color:rgba(245,166,35,.3)' : ''}">
      <div class="equip-icon">${u.icon}</div>
      <div class="equip-name">${u.name}</div>
      <div class="equip-req">${u.cost} 🐾 ${canAfford ? '🛒' : '🔒'}</div>
    </div>`;
  }).join('');
}

export function renderNextUnlocks() {
  const wrap = document.getElementById('next-unlocks');
  if (!wrap) return;
  const owned = profile?.active_items || [];
  const coins = profile?.coins || 0;
  const next  = UNLOCKABLES.filter(u => !owned.includes(u.id)).slice(0, 3);
  if (!next.length) {
    wrap.innerHTML = '<div style="font-size:13px;color:var(--red);padding:0 0 4px">🏆 Tout débloqué !</div>';
    return;
  }
  wrap.innerHTML = next.map(u => {
    const pct = Math.min(100, Math.round(coins / u.cost * 100));
    return `<div class="next-unlock-row">
      <div style="font-size:22px;flex-shrink:0">${u.icon}</div>
      <div class="next-unlock-info">
        <div class="next-unlock-name">${u.name}</div>
        <div class="next-unlock-bar"><div class="next-unlock-fill" style="width:${pct}%"></div></div>
      </div>
      <div class="next-unlock-count">${coins}/${u.cost} 🐾</div>
    </div>`;
  }).join('');
}

export async function toggleWorn(id) {
  if (!profile) return;
  const worn = [...(profile.worn_items || [])];
  const idx = worn.indexOf(id);
  if (idx > -1) worn.splice(idx, 1); else worn.push(id);
  invalidateAvatarCache(profile);
  await updateProfile({ worn_items: worn });
  renderAvatar(); renderEquip();
}

export async function buyItem(id) {
  if (!profile) return;
  const item = UNLOCKABLES.find(u => u.id === id);
  if (!item) return;
  if (demoMode) {
    const coins = profile.coins || 0;
    if (coins < item.cost) { showNotif('Pas assez de 🐾 Hermines'); return; }
    const owned = [...(profile.active_items || []), id];
    const worn  = [...(profile.worn_items   || []), id];
    setProfile({ ...profile, coins: coins - item.cost, active_items: owned, worn_items: worn });
  } else {
    const { data, error } = await db.rpc('buy_unlockable', { p_item_id: id });
    if (error) {
      const msg = error.message?.includes('NOT_ENOUGH_COINS') ? 'Pas assez de 🐾 Hermines'
        : error.message?.includes('ALREADY_OWNED') ? 'Tu possèdes déjà cet objet !'
        : 'Oups, achat impossible.';
      showNotif(msg); return;
    }
    setProfile(data);
  }
  invalidateAvatarCache(profile);
  showNotif(`${item.icon} ${item.name} débloqué !`);
  renderAvatar(); renderEquip(); renderNextUnlocks();
  ['coins-t','coins-m','coins-a'].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent = profile.coins || 0;
  });
}

// ── Édition avatar ────────────────────────────────────────────────────────────

let editParams = {};

function buildPickerHTML(items, paramKey, currentVal, type = 'opt') {
  return items.map(item => {
    const sel = item.id === currentVal ? ' sel' : '';
    if (type === 'skin') {
      return `<button class="skin-btn${sel}" data-param="${paramKey}" data-value="${item.id}" style="background:${item.color}"></button>`;
    }
    if (type === 'haircolor') {
      return `<button class="hair-color-btn${sel}" data-param="${paramKey}" data-value="${item.id}" style="background:${item.color}" title="${item.label}"></button>`;
    }
    return `<button class="opt-btn${sel}" data-param="${paramKey}" data-value="${item.id}">${item.label}</button>`;
  }).join('');
}

function renderEditPickers() {
  const g = id => document.getElementById(id);
  if (!g('edit-skin-grid')) return;
  g('edit-skin-grid').innerHTML      = buildPickerHTML(AVATAR_SKINS,        'skin',       editParams.skin,       'skin');
  g('edit-top-grid').innerHTML       = buildPickerHTML(AVATAR_TOPS,         'top',        editParams.top,        'opt');
  g('edit-haircolor-grid').innerHTML = buildPickerHTML(AVATAR_HAIR_COLORS,  'hairColor',  editParams.hairColor,  'haircolor');
  g('edit-eyes-grid').innerHTML      = buildPickerHTML(AVATAR_EYES,         'eyes',       editParams.eyes,       'opt');
  g('edit-mouth-grid').innerHTML     = buildPickerHTML(AVATAR_MOUTHS,       'mouth',      editParams.mouth,      'opt');
  g('edit-facialhair-grid').innerHTML= buildPickerHTML(AVATAR_FACIAL_HAIRS, 'facialHair', editParams.facialHair, 'opt');
  g('edit-clothe-grid').innerHTML    = buildPickerHTML(AVATAR_CLOTHES,      'clothe',     editParams.clothe,     'opt');
}

export function openAvatarEdit() {
  const panel = document.getElementById('avatar-edit-panel');
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) {
    editParams = {
      skin:       profile?.avatar_skin        || 'light',
      top:        profile?.avatar_top         || 'shortHairShortFlat',
      hairColor:  profile?.avatar_hair_color  || 'brown',
      eyes:       profile?.avatar_eyes        || 'default',
      mouth:      profile?.avatar_mouth       || 'smile',
      facialHair: profile?.avatar_facial_hair || '',
      clothe:     profile?.avatar_clothe      || 'shirtCrewNeck',
    };
    renderEditPickers();
  }
}

export async function setEditParam(key, value) {
  editParams[key] = value;
  document.querySelectorAll(`#avatar-edit-content [data-param="${key}"]`)
    .forEach(b => b.classList.toggle('sel', b.dataset.value === value));
  const wrap = document.getElementById('avatar-svg');
  if (wrap) wrap.innerHTML = await buildAvatarSVG({
    ...profile,
    avatar_skin:        editParams.skin,
    avatar_top:         editParams.top,
    avatar_hair_color:  editParams.hairColor,
    avatar_eyes:        editParams.eyes,
    avatar_mouth:       editParams.mouth,
    avatar_facial_hair: editParams.facialHair,
    avatar_clothe:      editParams.clothe,
  });
}

export async function saveAvatarEdit() {
  invalidateAvatarCache(profile);
  await updateProfile({
    avatar_skin:        editParams.skin,
    avatar_top:         editParams.top,
    avatar_hair_color:  editParams.hairColor,
    avatar_eyes:        editParams.eyes,
    avatar_mouth:       editParams.mouth,
    avatar_facial_hair: editParams.facialHair,
    avatar_clothe:      editParams.clothe,
  });
  editParams = {};
  document.getElementById('avatar-edit-panel').style.display = 'none';
  renderAvatar();
  showNotif('Avatar mis à jour ✓');
}
