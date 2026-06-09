import { SKINS, UNLOCKABLES, db } from './config.js';
import { profile, demoMode, setProfile } from './state.js';
import { updateProfile } from './profile.js';
import { showNotif } from './utils.js';

export function buildAvatarSVG(echarpe, casquette, maillot, sil='A', skin='skin1', hair='hair1') {
  const sc = SKINS[skin] || '#f5c89a';
  const bodyColor = maillot ? '#0d1b3e' : '#1c1c26';
  const hc = '#2a1a0a';

  const faceSVG = sil === 'B'
    ? `<!-- Visage féminin : ovale, traits fins, cils -->
       <ellipse cx="75" cy="63" rx="25" ry="28" fill="${sc}"/>
       <ellipse cx="47" cy="65" rx="5" ry="6.5" fill="${sc}"/>
       <ellipse cx="103" cy="65" rx="5" ry="6.5" fill="${sc}"/>
       <circle cx="65" cy="58" r="4" fill="#1a1a2e"/><circle cx="85" cy="58" r="4" fill="#1a1a2e"/>
       <circle cx="66.5" cy="56.5" r="1.5" fill="white"/><circle cx="86.5" cy="56.5" r="1.5" fill="white"/>
       <path d="M61 52 Q65 49 69 52" stroke="#3a2010" stroke-width="1.8" fill="none" stroke-linecap="round"/>
       <path d="M81 52 Q85 49 89 52" stroke="#3a2010" stroke-width="1.8" fill="none" stroke-linecap="round"/>
       <path d="M61 50 Q65 47.5 69 50" stroke="#1a1a2e" stroke-width="2" fill="none" stroke-linecap="round"/>
       <path d="M81 50 Q85 47.5 89 50" stroke="#1a1a2e" stroke-width="2" fill="none" stroke-linecap="round"/>
       <ellipse cx="75" cy="66" rx="2.5" ry="2" fill="${sc}" stroke="#c49a6c" stroke-width=".5"/>
       <path d="M69 73 Q75 78 81 73" stroke="#c0506a" stroke-width="2" fill="none" stroke-linecap="round"/>
       <ellipse cx="64" cy="62" rx="4" ry="2.5" fill="rgba(232,100,120,.15)"/>
       <ellipse cx="86" cy="62" rx="4" ry="2.5" fill="rgba(232,100,120,.15)"/>`
    : `<!-- Visage masculin : légèrement carré, mâchoire marquée -->
       <ellipse cx="75" cy="64" rx="27" ry="29" fill="${sc}"/>
       <ellipse cx="48" cy="66" rx="5.5" ry="7" fill="${sc}"/>
       <ellipse cx="102" cy="66" rx="5.5" ry="7" fill="${sc}"/>
       <path d="M52 78 Q75 86 98 78" fill="${sc}"/>
       <circle cx="65" cy="59" r="4.5" fill="#1a1a2e"/><circle cx="85" cy="59" r="4.5" fill="#1a1a2e"/>
       <circle cx="66.5" cy="57.5" r="1.5" fill="white"/><circle cx="86.5" cy="57.5" r="1.5" fill="white"/>
       <path d="M60 53 Q65 50 70 53" stroke="#5a3a1a" stroke-width="2" fill="none" stroke-linecap="round"/>
       <path d="M80 53 Q85 50 90 53" stroke="#5a3a1a" stroke-width="2" fill="none" stroke-linecap="round"/>
       <ellipse cx="75" cy="68" rx="3" ry="2.5" fill="${sc}" stroke="#c49a6c" stroke-width=".5"/>
       <path d="M69 75 Q75 80 81 75" stroke="#8b4513" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;

  const hairSVG = {
    hair1: `<ellipse cx="75" cy="38" rx="27" ry="14" fill="${hc}"/><ellipse cx="75" cy="34" rx="24" ry="10" fill="${hc}"/>
            <ellipse cx="50" cy="50" rx="6" ry="10" fill="${hc}"/><ellipse cx="100" cy="50" rx="6" ry="10" fill="${hc}"/>`,
    hair2: `<ellipse cx="75" cy="36" rx="27" ry="12" fill="${hc}"/>
            <rect x="48" y="36" width="7" height="16" rx="3.5" fill="${hc}" opacity=".6"/>
            <rect x="95" y="36" width="7" height="16" rx="3.5" fill="${hc}" opacity=".6"/>
            <ellipse cx="75" cy="32" rx="22" ry="10" fill="${hc}"/>`,
    hair3: `<ellipse cx="75" cy="38" rx="27" ry="15" fill="${hc}"/>
            <ellipse cx="75" cy="30" rx="20" ry="12" fill="${hc}"/>
            <ellipse cx="47" cy="60" rx="5" ry="14" fill="${hc}"/>
            <ellipse cx="103" cy="60" rx="5" ry="14" fill="${hc}"/>
            <circle cx="75" cy="22" r="10" fill="${hc}"/>
            <rect x="69" y="24" width="12" height="6" rx="3" fill="${hc}"/>`,
    hair4: `<ellipse cx="75" cy="37" rx="27" ry="14" fill="${hc}"/>
            <ellipse cx="75" cy="32" rx="23" ry="10" fill="${hc}"/>
            <ellipse cx="47" cy="58" rx="5" ry="13" fill="${hc}"/>
            <ellipse cx="103" cy="58" rx="5" ry="13" fill="${hc}"/>
            <rect x="70" y="28" width="10" height="5" rx="2.5" fill="#e8192c"/>
            <path d="M98 38 Q115 48 112 65 Q110 75 103 72" stroke="${hc}" stroke-width="8" fill="none" stroke-linecap="round"/>`
  }[hair] || '';

  const capSVG = casquette
    ? `<ellipse cx="75" cy="36" rx="32" ry="14" fill="#0d1b3e"/><rect x="43" y="29" width="64" height="18" rx="4" fill="#0d1b3e"/><rect x="41" y="44" width="24" height="7" rx="3" fill="#0d1b3e"/><text x="75" y="44" text-anchor="middle" font-family="Barlow Condensed" font-weight="800" font-size="11" fill="#e8192c">NBH</text>`
    : hairSVG;

  const bodySVG = `<ellipse cx="75" cy="112" rx="32" ry="38" fill="${bodyColor}"/>
    ${maillot ? `<text x="75" y="118" text-anchor="middle" font-family="Barlow Condensed" font-weight="800" font-size="14" fill="white">NBH</text>` : ''}`;

  const scarfSVG = echarpe
    ? `<rect x="52" y="85" width="46" height="10" rx="5" fill="#e8192c"/><rect x="57" y="93" width="6" height="15" rx="3" fill="#e8192c"/><rect x="87" y="93" width="6" height="15" rx="3" fill="#e8192c"/><text x="75" y="93" text-anchor="middle" font-family="Barlow Condensed" font-weight="700" font-size="7" fill="white">HERMINE</text>`
    : '';

  return `<svg viewBox="0 0 150 168" fill="none" xmlns="http://www.w3.org/2000/svg">
    ${bodySVG}
    ${faceSVG}
    ${capSVG}
    ${scarfSVG}
    <ellipse cx="42" cy="110" rx="8.5" ry="21" fill="${bodyColor}" transform="rotate(-10 42 110)"/>
    <ellipse cx="108" cy="110" rx="8.5" ry="21" fill="${bodyColor}" transform="rotate(10 108 110)"/>
    <ellipse cx="36" cy="128" rx="8" ry="7" fill="${sc}" transform="rotate(-10 36 128)"/>
    <ellipse cx="114" cy="128" rx="8" ry="7" fill="${sc}" transform="rotate(10 114 128)"/>
    <rect x="57" y="147" width="15" height="17" rx="7" fill="#252530"/>
    <rect x="78" y="147" width="15" height="17" rx="7" fill="#252530"/>
  </svg>`;
}

export function miniAvatarSVG(p) {
  const sc = SKINS[p?.avatar_skin || 'skin1'] || '#f5c89a';
  const worn = p?.worn_items || [];
  const hasCap = worn.includes('casquette');
  const hasScarf = worn.includes('echarpe');
  const hasMaillot = worn.includes('maillot');
  const hc = '#2a1a0a';
  const bodyColor = hasMaillot ? '#0d1b3e' : '#1c1c26';

  const hairMap = {
    hair1: `<ellipse cx="26" cy="13" rx="12" ry="7" fill="${hc}"/><ellipse cx="26" cy="11" rx="10" ry="5" fill="${hc}"/>`,
    hair2: `<ellipse cx="26" cy="12" rx="12" ry="6" fill="${hc}"/><rect x="14" y="13" width="3" height="7" rx="1.5" fill="${hc}" opacity=".6"/><rect x="35" y="13" width="3" height="7" rx="1.5" fill="${hc}" opacity=".6"/>`,
    hair3: `<ellipse cx="26" cy="13" rx="12" ry="8" fill="${hc}"/><circle cx="26" cy="8" r="5" fill="${hc}"/>`,
    hair4: `<ellipse cx="26" cy="12" rx="12" ry="6" fill="${hc}"/><path d="M34 13 Q40 17 39 24" stroke="${hc}" stroke-width="3" fill="none" stroke-linecap="round"/>`
  };
  const hairSVG = hasCap
    ? `<ellipse cx="26" cy="12" rx="13" ry="6" fill="#0d1b3e"/><rect x="13" y="9" width="26" height="8" rx="2" fill="#0d1b3e"/><rect x="11" y="15" width="9" height="4" rx="2" fill="#0d1b3e"/>`
    : (hairMap[p?.avatar_hair || 'hair1'] || hairMap.hair1);

  return `<svg viewBox="0 0 52 52" fill="none">
    <ellipse cx="26" cy="33" rx="13" ry="15" fill="${bodyColor}"/>
    ${hasMaillot ? `<text x="26" y="36" text-anchor="middle" font-family="Barlow Condensed" font-weight="800" font-size="6" fill="white">NBH</text>` : ''}
    <ellipse cx="26" cy="21" rx="10" ry="11" fill="${sc}"/>
    ${hairSVG}
    ${hasScarf ? `<rect x="16" y="29" width="20" height="5" rx="2.5" fill="#e8192c"/>` : ''}
    <circle cx="22" cy="20" r="2" fill="#1a1a2e"/>
    <circle cx="30" cy="20" r="2" fill="#1a1a2e"/>
  </svg>`;
}

export function renderAvatar() {
  const wrap = document.getElementById('avatar-svg'); if (!wrap) return;
  const worn = profile?.worn_items || [];
  wrap.innerHTML = buildAvatarSVG(
    worn.includes('echarpe'), worn.includes('casquette'), worn.includes('maillot'),
    profile?.avatar_silhouette || 'A',
    profile?.avatar_skin || 'skin1',
    profile?.avatar_hair || 'hair1'
  );
}

export function renderEquip() {
  const grid = document.getElementById('equip-grid'); if (!grid) return;
  const owned = profile?.active_items || [];
  const worn = profile?.worn_items || [];
  const coins = profile?.coins || 0;

  grid.innerHTML = UNLOCKABLES.map(u => {
    const isOwned = owned.includes(u.id);
    const isWorn = worn.includes(u.id);
    const canAfford = coins >= u.cost;

    if (isOwned) {
      return `<div class="equip-item unlocked ${isWorn ? 'active-eq' : ''}" onclick="toggleWorn('${u.id}')">
        <div class="equip-icon">${u.icon}</div>
        <div class="equip-name">${u.name}</div>
        <div style="font-size:9px;color:${isWorn ? 'var(--red)' : 'var(--white-muted)'};margin-top:2px">${isWorn ? '✓ Porté' : 'Tap pour porter'}</div>
      </div>`;
    } else {
      return `<div class="equip-item locked-eq" onclick="${canAfford ? `buyItem('${u.id}')` : ''}"
        style="${canAfford ? 'cursor:pointer;opacity:1;border-color:rgba(245,166,35,.3)' : ''}">
        <div class="equip-icon">${u.icon}</div>
        <div class="equip-name">${u.name}</div>
        <div class="equip-req">${u.cost} 🐾 ${canAfford ? '🛒' : '🔒'}</div>
      </div>`;
    }
  }).join('');
}

export async function toggleWorn(id) {
  if (!profile) return;
  const worn = [...(profile.worn_items || [])];
  const idx = worn.indexOf(id);
  if (idx > -1) worn.splice(idx, 1); else worn.push(id);
  await updateProfile({ worn_items: worn });
  renderAvatar(); renderEquip();
}

export function renderNextUnlocks() {
  const wrap = document.getElementById('next-unlocks'); if (!wrap) return;
  const items = profile?.worn_items || [];
  const coins = profile?.coins || 0;
  const next = UNLOCKABLES.filter(u => !items.includes(u.id)).slice(0, 3);
  if (!next.length) { wrap.innerHTML = '<div style="font-size:13px;color:var(--red);padding:0 0 4px">🏆 Tout débloqué !</div>'; return; }
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

// ── Avatar edit ────────────────────────────────────────────
let editSilVal, editSkinVal, editHairVal;

export function openAvatarEdit() {
  const panel = document.getElementById('avatar-edit-panel');
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) {
    const sil = profile?.avatar_silhouette || 'A';
    const skin = profile?.avatar_skin || 'skin1';
    const hair = profile?.avatar_hair || 'hair1';
    ['A','B'].forEach(s => document.getElementById('edit-sil-'+s)?.classList.toggle('sel', s===sil));
    ['skin1','skin2','skin3','skin4'].forEach(s => {
      const el = document.getElementById('edit-skin-'+s);
      if (el) { el.classList.toggle('sel', s===skin); el.style.transform = s===skin ? 'scale(1.08)' : ''; el.style.borderColor = s===skin ? 'var(--red)' : 'var(--black4)'; }
    });
    ['hair1','hair2','hair3','hair4'].forEach(h => document.getElementById('edit-hair-'+h)?.classList.toggle('sel', h===hair));
  }
}

export function editSil(v) {
  editSilVal = v;
  ['A','B'].forEach(s => document.getElementById('edit-sil-'+s)?.classList.toggle('sel', s===v));
  const items = profile?.worn_items || [];
  const wrap = document.getElementById('avatar-svg');
  if (wrap) wrap.innerHTML = buildAvatarSVG(items.includes('echarpe'),items.includes('casquette'),items.includes('maillot'),v,editSkinVal||profile?.avatar_skin||'skin1',editHairVal||profile?.avatar_hair||'hair1');
}

export function editSkin(v) {
  editSkinVal = v;
  ['skin1','skin2','skin3','skin4'].forEach(s => {
    const el = document.getElementById('edit-skin-'+s);
    if (el) { el.style.borderColor = s===v ? 'var(--red)' : 'var(--black4)'; el.style.transform = s===v ? 'scale(1.08)' : ''; }
  });
  const items = profile?.worn_items || [];
  const wrap = document.getElementById('avatar-svg');
  if (wrap) wrap.innerHTML = buildAvatarSVG(items.includes('echarpe'),items.includes('casquette'),items.includes('maillot'),editSilVal||profile?.avatar_silhouette||'A',v,editHairVal||profile?.avatar_hair||'hair1');
}

export function editHair(v) {
  editHairVal = v;
  ['hair1','hair2','hair3','hair4'].forEach(h => document.getElementById('edit-hair-'+h)?.classList.toggle('sel', h===v));
  const items = profile?.worn_items || [];
  const wrap = document.getElementById('avatar-svg');
  if (wrap) wrap.innerHTML = buildAvatarSVG(items.includes('echarpe'),items.includes('casquette'),items.includes('maillot'),editSilVal||profile?.avatar_silhouette||'A',editSkinVal||profile?.avatar_skin||'skin1',v);
}

export async function saveAvatarEdit() {
  const fields = {};
  if (editSilVal) fields.avatar_silhouette = editSilVal;
  if (editSkinVal) fields.avatar_skin = editSkinVal;
  if (editHairVal) fields.avatar_hair = editHairVal;
  if (Object.keys(fields).length) await updateProfile(fields);
  editSilVal = editSkinVal = editHairVal = null;
  document.getElementById('avatar-edit-panel').style.display = 'none';
  renderAvatar();
  showNotif('Avatar mis à jour ✓');
}

export async function buyItem(id) {
  if (!profile) return;
  const item = UNLOCKABLES.find(u => u.id === id);
  if (!item) return;

  if (demoMode) {
    const coins = profile.coins || 0;
    if (coins < item.cost) { showNotif('Pas assez de 🐾 Hermines'); return; }
    const owned = [...(profile.active_items || []), id];
    const worn = [...(profile.worn_items || []), id];
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

  showNotif(`${item.icon} ${item.name} débloqué !`);
  renderAvatar(); renderEquip(); renderNextUnlocks();
  ['coins-t','coins-m','coins-a'].forEach(elId => {
    const el = document.getElementById(elId); if (el) el.textContent = profile.coins || 0;
  });
}
